#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
import json
import re

PRIMARY_INSTALL_STEP = "Install dependencies from committed lockfile"
_BLOCK_SCALAR_RE = re.compile(r"^[|>](?:[1-9][+-]?|[+-][1-9]?|[+-])?$")
_STEP_START_RE = re.compile(r"^(?P<indent> *)-\s+(?P<rest>.*)$")
_KEY_RE = re.compile(r"^(?P<indent> *)(?P<key>[A-Za-z0-9_-]+):(?P<value>.*)$")
_COMMAND_BOUNDARY = r"(?:^|[\n;]|&&|\|\||\|)"
_NPM_INSTALL_RE = re.compile(_COMMAND_BOUNDARY + r"[ \t]*npm[ \t\r\n]+install\b", re.IGNORECASE)
_NPM_CI_RE = re.compile(_COMMAND_BOUNDARY + r"[ \t]*npm[ \t\r\n]+ci\b", re.IGNORECASE)


@dataclass(frozen=True)
class RunStep:
    name: str | None
    run: str


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _strip_comment(value: str) -> str:
    """Strip an unquoted YAML/shell-style # comment from one line."""
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
        if char == "#" and not single and not double and (index == 0 or value[index - 1].isspace()):
            break
        out.append(char)
    return "".join(out).rstrip()


def _decode_scalar(value: str) -> str:
    value = _strip_comment(value).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        if value[0] == "'":
            return value[1:-1].replace("''", "'")
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            return value[1:-1]
        return decoded if isinstance(decoded, str) else value
    return value


def _block_body(lines: list[str], start: int, end: int, key_indent: int) -> str:
    body: list[str] = []
    index = start
    while index < end:
        line = lines[index]
        if line.strip() and _indent(line) <= key_indent:
            break
        body.append(line)
        index += 1
    nonblank_indents = [_indent(line) for line in body if line.strip()]
    content_indent = min(nonblank_indents) if nonblank_indents else key_indent + 2
    return "\n".join(
        line[content_indent:] if len(line) >= content_indent else ""
        for line in body
    )


def extract_run_steps(workflow_text: str) -> list[RunStep]:
    """Extract top-level workflow step run values without implementing general YAML parsing."""
    if any(line.startswith("\t") for line in workflow_text.splitlines()):
        raise ValueError("workflow indentation must not use tabs")

    lines = workflow_text.splitlines()
    run_steps: list[RunStep] = []
    index = 0

    while index < len(lines):
        steps_match = _KEY_RE.match(lines[index])
        if not steps_match or steps_match.group("key") != "steps" or _strip_comment(steps_match.group("value")).strip():
            index += 1
            continue

        steps_indent = len(steps_match.group("indent"))
        index += 1
        step_indent: int | None = None

        while index < len(lines):
            current = lines[index]
            if not current.strip() or current.lstrip().startswith("#"):
                index += 1
                continue
            if _indent(current) <= steps_indent:
                break

            step_match = _STEP_START_RE.match(current)
            if not step_match:
                index += 1
                continue

            current_step_indent = len(step_match.group("indent"))
            if step_indent is None:
                step_indent = current_step_indent
            if current_step_indent != step_indent:
                index += 1
                continue

            step_end = index + 1
            while step_end < len(lines):
                candidate = lines[step_end]
                if candidate.strip():
                    candidate_indent = _indent(candidate)
                    candidate_step = _STEP_START_RE.match(candidate)
                    if candidate_indent <= steps_indent:
                        break
                    if candidate_step and len(candidate_step.group("indent")) == step_indent:
                        break
                step_end += 1

            entries: list[tuple[str, str, int, int]] = []
            first_entry = re.match(r"(?P<key>[A-Za-z0-9_-]+):(?P<value>.*)$", step_match.group("rest"))
            if first_entry:
                entries.append((first_entry.group("key"), first_entry.group("value"), index, step_indent))

            cursor = index + 1
            while cursor < step_end:
                key_match = _KEY_RE.match(lines[cursor])
                if key_match and len(key_match.group("indent")) == step_indent + 2:
                    entries.append((key_match.group("key"), key_match.group("value"), cursor, step_indent + 2))
                cursor += 1

            name: str | None = None
            run: str | None = None
            run_seen = 0
            for key, raw_value, absolute_index, key_indent in entries:
                if key == "name":
                    name = _decode_scalar(raw_value)
                    continue
                if key != "run":
                    continue
                run_seen += 1
                if run_seen > 1:
                    raise ValueError(f"workflow step {name or '<unnamed>'} contains multiple run keys")
                marker = _strip_comment(raw_value).strip()
                if _BLOCK_SCALAR_RE.fullmatch(marker):
                    run = _block_body(lines, absolute_index + 1, step_end, key_indent)
                else:
                    run = _decode_scalar(raw_value)

            if run is not None:
                run_steps.append(RunStep(name=name, run=run))
            index = step_end

    return run_steps


def _without_shell_comments(script: str) -> str:
    return "\n".join(_strip_comment(line) for line in script.splitlines())


def validate_workflow_install_policy(workflow_text: str) -> list[str]:
    """Return fail-closed install-policy errors for the validation workflow."""
    try:
        run_steps = extract_run_steps(workflow_text)
    except ValueError as exc:
        return [f"Validate workflow run-command structure is ambiguous: {exc}"]

    errors: list[str] = []
    if not run_steps:
        return ["Validate workflow must contain executable run steps"]

    primary_steps = [step for step in run_steps if step.name == PRIMARY_INSTALL_STEP]
    if len(primary_steps) != 1:
        errors.append(
            f'Validate workflow must contain exactly one primary dependency-install step named "{PRIMARY_INSTALL_STEP}"'
        )
    elif not _NPM_CI_RE.search(_without_shell_comments(primary_steps[0].run)):
        errors.append("Validate primary dependency-install step must use npm ci from the committed lockfile")

    offenders = [
        step.name or "<unnamed step>"
        for step in run_steps
        if _NPM_INSTALL_RE.search(_without_shell_comments(step.run))
    ]
    if offenders:
        errors.append(
            "Validate workflow must not contain executable npm install commands: "
            + ", ".join(offenders)
        )

    return errors
