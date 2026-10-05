#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
import json
import re

EXPECTED_VALIDATE_RUN_STEPS = (
    ("Workflow install policy unit tests", "python tests/validate-workflow-policy.unit.py"),
    ("Install dependencies from committed lockfile", "npm ci"),
    ("Build static site", "npm run build"),
    ("Validate repository and built site", "python scripts/validate_repository.py"),
    ("Production smoke unit tests", "npm run test:smoke"),
    ("Dependency policy unit tests", "npm run test:dependency-policy"),
    ("Install Chromium", "npx playwright install --with-deps chromium"),
    ("Browser and accessibility tests", "npm run test:e2e"),
    ("Dependency audits (runtime + full tree)", "node scripts/dependency-audit-policy.mjs"),
)

_KEY_RE = re.compile(r"^(?P<indent> *)(?P<key>[A-Za-z0-9_-]+):(?P<value>.*)$")
_STEP_RE = re.compile(r"^(?P<indent> *)-(?: +(?P<rest>.*))?$")
_INLINE_ENTRY_RE = re.compile(r"(?P<key>[A-Za-z0-9_-]+):(?P<value>.*)$")
_BLOCK_MARKER_RE = re.compile(r"^(?P<style>[|>])(?P<chomp>[+-]?)$")
_SUPPORTED_DIRECT_STEP_KEYS = frozenset({"name", "run", "uses", "with"})


@dataclass(frozen=True)
class RunStep:
    name: str | None
    run: str


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _strip_yaml_comment(value: str) -> str:
    """Strip an unquoted YAML comment from a scalar fragment."""
    out: list[str] = []
    single = False
    double = False
    escaped = False
    for index, char in enumerate(value):
        if escaped:
            out.append(char)
            escaped = False
            continue
        if char == "\\" and double:
            out.append(char)
            escaped = True
            continue
        if char == "'" and not double:
            single = not single
            out.append(char)
            continue
        if char == '"' and not single:
            double = not double
            out.append(char)
            continue
        if char == "#" and not single and not double and (
            index == 0 or value[index - 1].isspace()
        ):
            break
        out.append(char)
    return "".join(out).rstrip()


def _decode_inline_scalar(raw_value: str) -> str:
    value = _strip_yaml_comment(raw_value).strip()
    if not value:
        raise ValueError("run scalar must not be blank")
    if value.startswith(("|", ">")):
        raise ValueError("block scalar marker must be decoded structurally")
    if value[0] in {"[", "{", "&", "*", "!"}:
        raise ValueError("unsupported inline run scalar form")
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        if value[0] == "'":
            return value[1:-1].replace("''", "'")
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError("invalid double-quoted run scalar") from exc
        if not isinstance(decoded, str):
            raise ValueError("double-quoted run scalar must decode to text")
        return decoded
    return value


def _apply_chomp(text: str, chomp: str) -> str:
    if chomp == "-":
        return text.rstrip("\n")
    if chomp == "+":
        return text + "\n"
    return text.rstrip("\n") + "\n"


def _decode_block_scalar(
    lines: list[str],
    start: int,
    end: int,
    key_indent: int,
    marker: str,
) -> str:
    match = _BLOCK_MARKER_RE.fullmatch(marker)
    if not match:
        raise ValueError(f"unsupported run block scalar marker: {marker!r}")

    body: list[tuple[str, int]] = []
    index = start
    while index < end:
        line = lines[index]
        if line.strip() and _indent(line) <= key_indent:
            break
        body.append((line, _indent(line)))
        index += 1

    nonblank_indents = [indent for line, indent in body if line.strip()]
    if not nonblank_indents:
        return _apply_chomp("", match.group("chomp"))

    content_indent = min(nonblank_indents)
    if content_indent <= key_indent:
        raise ValueError("run block scalar content must be indented")

    logical: list[tuple[str, int]] = []
    for line, indent in body:
        if not line.strip():
            logical.append(("", indent))
            continue
        logical.append((line[content_indent:], indent))

    if match.group("style") == "|":
        text = "\n".join(line for line, _ in logical)
        return _apply_chomp(text, match.group("chomp"))

    pieces: list[str] = []
    for position, (line, indent) in enumerate(logical):
        pieces.append(line)
        if position == len(logical) - 1:
            continue
        next_line, next_indent = logical[position + 1]
        if not line or not next_line:
            pieces.append("\n")
        elif indent > content_indent or next_indent > content_indent:
            pieces.append("\n")
        else:
            pieces.append(" ")
    return _apply_chomp("".join(pieces), match.group("chomp"))


def _find_unique_mapping(
    lines: list[str],
    start: int,
    end: int,
    *,
    indent: int,
    key: str,
) -> int:
    matches: list[int] = []
    for index in range(start, end):
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = _KEY_RE.match(line)
        if not match or len(match.group("indent")) != indent:
            continue
        if match.group("key") != key:
            continue
        if _strip_yaml_comment(match.group("value")).strip():
            raise ValueError(f"{key}: must be a block mapping")
        matches.append(index)
    if len(matches) != 1:
        raise ValueError(f"expected exactly one {key}: mapping, found {len(matches)}")
    return matches[0]


def _block_end(lines: list[str], start: int, parent_indent: int) -> int:
    index = start
    while index < len(lines):
        line = lines[index]
        if line.strip() and _indent(line) <= parent_indent:
            break
        index += 1
    return index


def _direct_mapping_indent(
    lines: list[str],
    start: int,
    end: int,
    parent_indent: int,
) -> int:
    candidates: list[int] = []
    for index in range(start, end):
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = _KEY_RE.match(line)
        if match:
            indent = len(match.group("indent"))
            if indent > parent_indent:
                candidates.append(indent)
    if not candidates:
        raise ValueError("mapping has no direct child keys")
    return min(candidates)


def extract_validate_run_steps(workflow_text: str) -> list[RunStep]:
    """Extract jobs -> validate -> steps and fail closed on every direct entry."""
    lines = workflow_text.splitlines()
    for line in lines:
        leading = line[: len(line) - len(line.lstrip())]
        if "\t" in leading:
            raise ValueError("workflow indentation must not use tabs")

    jobs_line = _find_unique_mapping(lines, 0, len(lines), indent=0, key="jobs")
    jobs_end = _block_end(lines, jobs_line + 1, 0)
    job_indent = _direct_mapping_indent(lines, jobs_line + 1, jobs_end, 0)
    validate_line = _find_unique_mapping(
        lines,
        jobs_line + 1,
        jobs_end,
        indent=job_indent,
        key="validate",
    )
    validate_end = _block_end(lines, validate_line + 1, job_indent)
    property_indent = _direct_mapping_indent(
        lines,
        validate_line + 1,
        validate_end,
        job_indent,
    )
    steps_line = _find_unique_mapping(
        lines,
        validate_line + 1,
        validate_end,
        indent=property_indent,
        key="steps",
    )
    steps_end = _block_end(lines, steps_line + 1, property_indent)

    step_indents = [
        len(match.group("indent"))
        for index in range(steps_line + 1, steps_end)
        if (match := _STEP_RE.match(lines[index]))
        and len(match.group("indent")) > property_indent
    ]
    if not step_indents:
        raise ValueError("validate job steps: must contain direct list entries")
    step_indent = min(step_indents)

    step_starts = [
        index
        for index in range(steps_line + 1, steps_end)
        if (match := _STEP_RE.match(lines[index]))
        and len(match.group("indent")) == step_indent
    ]

    run_steps: list[RunStep] = []
    for position, step_start in enumerate(step_starts):
        step_end = (
            step_starts[position + 1]
            if position + 1 < len(step_starts)
            else steps_end
        )
        start_match = _STEP_RE.match(lines[step_start])
        assert start_match is not None

        rest = start_match.group("rest")
        if rest is None or not rest.strip():
            raise ValueError("validate job contains unsupported direct step syntax")

        first = _INLINE_ENTRY_RE.fullmatch(rest)
        if not first:
            raise ValueError("validate job contains unsupported direct step syntax")

        entries: list[tuple[str, str, int, int]] = [
            (first.group("key"), first.group("value"), step_start, step_indent)
        ]

        entry_indent = step_indent + 2
        for index in range(step_start + 1, step_end):
            line = lines[index]
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            if _indent(line) != entry_indent:
                continue
            match = _KEY_RE.match(line)
            if not match:
                raise ValueError(
                    "validate job step contains unsupported direct mapping-key syntax"
                )
            entries.append(
                (match.group("key"), match.group("value"), index, entry_indent)
            )

        seen_keys: set[str] = set()
        for key, _, _, _ in entries:
            if key in seen_keys:
                raise ValueError(f"validate job step contains duplicate {key} keys")
            seen_keys.add(key)
            if key not in _SUPPORTED_DIRECT_STEP_KEYS:
                raise ValueError(
                    f"validate job step contains unsupported direct key: {key}"
                )

        names = [entry for entry in entries if entry[0] == "name"]
        runs = [entry for entry in entries if entry[0] == "run"]
        uses = [entry for entry in entries if entry[0] == "uses"]
        with_entries = [entry for entry in entries if entry[0] == "with"]

        if runs and uses:
            raise ValueError("validate job step cannot contain both run and uses")
        if not runs and not uses:
            raise ValueError(
                "validate job direct step must contain exactly one of run or uses"
            )
        if runs and with_entries:
            raise ValueError("validate job run step must not contain with")

        name = _decode_inline_scalar(names[0][1]) if names else None
        if uses:
            _decode_inline_scalar(uses[0][1])
            continue

        _, raw_value, absolute_index, key_indent = runs[0]
        marker = _strip_yaml_comment(raw_value).strip()
        if marker.startswith(("|", ">")):
            run = _decode_block_scalar(
                lines,
                absolute_index + 1,
                step_end,
                key_indent,
                marker,
            )
        else:
            run = _decode_inline_scalar(raw_value)
        run_steps.append(RunStep(name=name, run=run))

    return run_steps


def validate_workflow_install_policy(workflow_text: str) -> list[str]:
    """Enforce the exact executable run-command contract for the validate job."""
    try:
        actual = extract_validate_run_steps(workflow_text)
    except ValueError as exc:
        return [f"Validate workflow run-command structure is ambiguous: {exc}"]

    expected = [RunStep(name=name, run=run) for name, run in EXPECTED_VALIDATE_RUN_STEPS]
    errors: list[str] = []
    if len(actual) != len(expected):
        errors.append(
            "Validate job run-command contract drifted: "
            f"expected {len(expected)} executable run steps, found {len(actual)}"
        )

    for index in range(max(len(actual), len(expected))):
        if index >= len(expected):
            step = actual[index]
            errors.append(
                "Validate job contains an unexpected executable run step at "
                f"position {index + 1}: name={step.name!r}, run={step.run!r}"
            )
            continue
        if index >= len(actual):
            step = expected[index]
            errors.append(
                "Validate job is missing required executable run step at "
                f"position {index + 1}: name={step.name!r}, run={step.run!r}"
            )
            continue
        if actual[index] != expected[index]:
            errors.append(
                "Validate job run-command contract mismatch at "
                f"position {index + 1}: expected name={expected[index].name!r}, "
                f"run={expected[index].run!r}; found name={actual[index].name!r}, "
                f"run={actual[index].run!r}"
            )

    return errors
