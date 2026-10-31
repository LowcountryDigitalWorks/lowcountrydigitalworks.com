#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_workflow_policy import (
    EXPECTED_VALIDATE_RUN_STEPS,
    extract_validate_run_steps,
    validate_workflow_install_policy,
)

CURRENT = (ROOT / ".github/workflows/validate.yml").read_text()
COMMANDS = dict(EXPECTED_VALIDATE_RUN_STEPS)
PRIMARY = "Install dependencies from committed lockfile"

EXPECTED_PR_TRIGGER = (
    "  pull_request:\n"
    "    types: [opened, synchronize, reopened, ready_for_review]\n"
)
EXPECTED_PUSH_TRIGGER = "  push:\n    branches:\n      - main\n"
EXPECTED_WORKFLOW_DISPATCH = "  workflow_dispatch:\n"
EXPECTED_PERMISSIONS = "permissions:\n  contents: read\n"
EXPECTED_CONCURRENCY_GROUP = (
    "  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}\n"
)
EXPECTED_CANCEL_POLICY = (
    "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n"
)
EXPECTED_VALIDATE_IF = (
    "    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}\n"
)
EXPECTED_VALIDATE_RUNS_ON = "    runs-on: ubuntu-latest\n"
EXPECTED_VALIDATE_TIMEOUT = "    timeout-minutes: 20\n"
EXPECTED_GOVERNANCE_PREFIX = (
    "name: Validate repository\n\n"
    "on:\n"
    + EXPECTED_PR_TRIGGER
    + EXPECTED_PUSH_TRIGGER
    + EXPECTED_WORKFLOW_DISPATCH
    + "\n"
    + EXPECTED_PERMISSIONS
    + "\n"
    + "concurrency:\n"
    + EXPECTED_CONCURRENCY_GROUP
    + EXPECTED_CANCEL_POLICY
    + "\n"
    + "jobs:\n"
    + "  validate:\n"
    + EXPECTED_VALIDATE_IF
    + EXPECTED_VALIDATE_RUNS_ON
    + EXPECTED_VALIDATE_TIMEOUT
    + "    steps:\n"
)
EXPECTED_ACTION_REFS = {
    "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/setup-node": "949feb2413d6458794dcd2491c4babbbce0c15c1",
    "actions/setup-python": "6d4fd22b20465ccc0f7354476588e8df7c9ca0e0",
    "actions/upload-artifact": "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
}
EXPECTED_CHECKOUT_CREDENTIAL_POLICY = "          persist-credentials: false\n"
EXPECTED_UPLOAD_ARTIFACT_TAIL = (
    "      - name: Upload resolved lockfile\n"
    f"        uses: actions/upload-artifact@{EXPECTED_ACTION_REFS['actions/upload-artifact']} # v7.0.2\n"
    "        with:\n"
    "          name: package-lock\n"
    "          path: package-lock.json\n"
    "          if-no-files-found: error\n"
)


def replace_run(step_name: str, run_yaml: str) -> str:
    current_command = COMMANDS[step_name]
    needle = f"      - name: {step_name}\n        run: {current_command}\n"
    replacement = f"      - name: {step_name}\n        run: {run_yaml}\n"
    if needle not in CURRENT:
        raise AssertionError(f"current workflow step not found: {step_name}")
    return CURRENT.replace(needle, replacement, 1)


def append_run_step(name: str, command: str) -> str:
    marker = "      - name: Upload resolved lockfile\n"
    if marker not in CURRENT:
        raise AssertionError("upload step marker missing")
    addition = f"      - name: {name}\n        run: {command}\n\n"
    return CURRENT.replace(marker, addition + marker, 1)


def append_direct_step_yaml(step_yaml: str) -> str:
    marker = "      - name: Upload resolved lockfile\n"
    if marker not in CURRENT:
        raise AssertionError("upload step marker missing")
    addition = f"      {step_yaml}\n\n"
    return CURRENT.replace(marker, addition + marker, 1)


def primary_run(workflow: str) -> str:
    matches = [step.run for step in extract_validate_run_steps(workflow) if step.name == PRIMARY]
    if len(matches) != 1:
        raise AssertionError(f"expected one primary step, found {len(matches)}")
    return matches[0]


def validate_workflow_governance(workflow: str) -> list[str]:
    """Enforce #65 invariants after GitHub has parsed the workflow syntax itself."""
    errors: list[str] = []
    lines = workflow.splitlines()
    uncommented_workflow = "\n".join(
        line for line in lines if not line.lstrip().startswith("#")
    )
    if workflow.endswith("\n"):
        uncommented_workflow += "\n"

    if not workflow.startswith(EXPECTED_GOVERNANCE_PREFIX):
        errors.append(
            "workflow governance header drifted: expected the exact accepted "
            "trigger/permission/concurrency/job preamble"
        )

    required_singletons = {
        "pull-request trigger contract": EXPECTED_PR_TRIGGER,
        "main push trigger contract": EXPECTED_PUSH_TRIGGER,
        "manual dispatch contract": EXPECTED_WORKFLOW_DISPATCH,
        "permissions contract": EXPECTED_PERMISSIONS,
        "concurrency group contract": EXPECTED_CONCURRENCY_GROUP,
        "pull-request-only cancellation contract": EXPECTED_CANCEL_POLICY,
        "draft-skip contract": EXPECTED_VALIDATE_IF,
        "runner contract": EXPECTED_VALIDATE_RUNS_ON,
    }
    for label, snippet in required_singletons.items():
        count = uncommented_workflow.count(snippet)
        if count != 1:
            errors.append(f"{label} drifted: expected exactly one accepted form, found {count}")

    top_level_keys: list[str] = []
    for line in lines:
        match = re.match(r'^["\']?([A-Za-z0-9_-]+)["\']?\s*:', line)
        if match:
            top_level_keys.append(match.group(1))
    if top_level_keys != ["name", "on", "permissions", "concurrency", "jobs"]:
        errors.append(
            "top-level workflow surface drifted: expected only "
            "name/on/permissions/concurrency/jobs"
        )

    for line in lines:
        if re.match(r'^\s*["\']?pull_request_target["\']?\s*:', line):
            errors.append("pull_request_target is not authorized for ordinary validation")
            break

    job_names: list[str] = []
    in_jobs = False
    for line in lines:
        if line == "jobs:":
            if in_jobs:
                errors.append("jobs mapping must appear exactly once")
            in_jobs = True
            continue
        if not in_jobs:
            continue
        if line and not line.startswith(" "):
            in_jobs = False
            continue
        match = re.match(r'^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$', line)
        if match:
            job_names.append(match.group(1))
    if job_names != ["validate"]:
        errors.append(f"workflow job surface drifted: expected ['validate'], found {job_names!r}")

    validate_job_keys: list[str] = []
    in_validate_job = False
    for line in lines:
        if line == "  validate:":
            in_validate_job = True
            continue
        if not in_validate_job:
            continue
        if line and not line.startswith("    "):
            in_validate_job = False
            continue
        match = re.match(r'^    ["\']?([A-Za-z0-9_-]+)["\']?\s*:', line)
        if match:
            validate_job_keys.append(match.group(1))
    expected_validate_job_keys = ["if", "runs-on", "timeout-minutes", "steps"]
    if validate_job_keys != expected_validate_job_keys:
        errors.append(
            "validate job governance surface drifted: expected "
            f"{expected_validate_job_keys!r}, found {validate_job_keys!r}"
        )

    concurrency_keys = [line for line in lines if re.match(r'^\s*concurrency\s*:', line)]
    if concurrency_keys != ["concurrency:"]:
        errors.append("concurrency must exist only at workflow scope")

    top_level_env = [line for line in lines if re.match(r'^["\']?env["\']?\s*:', line)]
    if top_level_env:
        errors.append("workflow-level env is not authorized")

    branch_policy_lines = [
        line.strip()
        for line in lines
        if re.match(r'^\s*(branches|branches-ignore)\s*:', line)
    ]
    if branch_policy_lines != ["branches:"]:
        errors.append(
            "branch filter surface drifted: expected only the accepted main push branches block"
        )

    uses_refs: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        match = re.match(r'^-?\s*["\']?uses["\']?\s*:\s*([^\s#}]+)', stripped)
        if match:
            uses_refs.append(match.group(1))
            continue
        if re.search(r'(^|[{,]\s*)["\']?uses["\']?\s*:', stripped):
            errors.append(f"unsupported uses syntax must fail closed: {stripped!r}")

    for action, sha in EXPECTED_ACTION_REFS.items():
        matches = [ref for ref in uses_refs if ref.startswith(f"{action}@")]
        expected = f"{action}@{sha}"
        if matches != [expected]:
            errors.append(
                f"{action} ref drifted: expected exactly {expected!r}, found {matches!r}"
            )

    if len(uses_refs) != len(EXPECTED_ACTION_REFS):
        errors.append(
            "validate job Action surface drifted: "
            f"expected {len(EXPECTED_ACTION_REFS)} uses refs, found {len(uses_refs)}"
        )

    checkout_marker = (
        "      - name: Check out repository\n"
        f"        uses: actions/checkout@{EXPECTED_ACTION_REFS['actions/checkout']} # v7.0.1\n"
        "        with:\n"
        + EXPECTED_CHECKOUT_CREDENTIAL_POLICY
        + "\n"
        + "      - name: Set up Node.js\n"
    )
    if workflow.count(checkout_marker) != 1:
        errors.append(
            "checkout must keep the exact accepted immutable ref and "
            "persist-credentials-only option surface"
        )

    if not workflow.endswith(EXPECTED_UPLOAD_ARTIFACT_TAIL):
        errors.append("upload-artifact must keep the exact accepted evidence/failure contract")

    return errors


class WorkflowInstallPolicyTests(unittest.TestCase):
    def assert_blocked(self, workflow: str) -> None:
        errors = validate_workflow_install_policy(workflow)
        self.assertTrue(errors, "expected workflow to be rejected")
        self.assertTrue(
            any("run-command" in error or "run step" in error for error in errors),
            errors,
        )

    def test_current_repository_workflow_passes(self) -> None:
        self.assertEqual(validate_workflow_install_policy(CURRENT), [])

    def test_current_exact_manifest_is_extracted(self) -> None:
        actual = [(step.name, step.run) for step in extract_validate_run_steps(CURRENT)]
        self.assertEqual(actual, list(EXPECTED_VALIDATE_RUN_STEPS))

    def test_current_uses_steps_are_not_run_commands(self) -> None:
        names = {step.name for step in extract_validate_run_steps(CURRENT)}
        self.assertNotIn("Check out repository", names)
        self.assertNotIn("Set up Node.js", names)
        self.assertNotIn("Set up Python", names)
        self.assertNotIn("Upload resolved lockfile", names)

    def test_comments_and_non_run_yaml_data_pass(self) -> None:
        workflow = CURRENT.replace(
            "      - name: Set up Python\n",
            "      # npm install is forbidden executable policy text\n"
            "      - name: Set up Python\n",
            1,
        ).replace(
            "        with:\n          python-version: '3.12'\n",
            "        with:\n          NOTE: npm install is forbidden here\n"
            "          python-version: '3.12'\n",
            1,
        )
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_unrelated_nested_steps_mapping_is_ignored(self) -> None:
        workflow = CURRENT + (
            "\nmetadata:\n"
            "  steps:\n"
            "    - name: Not a GitHub Actions job step\n"
            "      run: npm install\n"
        )
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_literal_and_folded_scalars_have_distinct_semantics(self) -> None:
        literal = replace_run(PRIMARY, "|\n          npm\n          install")
        folded = replace_run(PRIMARY, ">\n          npm\n          install")
        self.assertEqual(primary_run(literal), "npm\ninstall\n")
        self.assertEqual(primary_run(folded), "npm install\n")
        self.assertNotEqual(primary_run(literal), primary_run(folded))
        self.assert_blocked(literal)
        self.assert_blocked(folded)

    def test_direct_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "npm install"))

    def test_whitespace_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "npm   install"))

    def test_sudo_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "sudo npm install"))

    def test_command_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "command npm install"))

    def test_env_prefix_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "env FOO=bar npm install"))

    def test_assignment_prefix_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "FOO=bar npm install"))

    def test_exec_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "exec npm install"))

    def test_bash_c_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "bash -c 'npm install'"))

    def test_sh_c_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, 'sh -c "npm install"'))

    def test_subshell_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "(npm install)"))

    def test_grouped_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "{ npm install; }"))

    def test_if_then_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "if true; then npm install; fi"))

    def test_while_do_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "while false; do npm install; done"))

    def test_background_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "true & npm install"))

    def test_command_substitution_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, 'echo "$(npm install)"'))

    def test_shell_line_continuation_npm_install_blocks(self) -> None:
        workflow = replace_run(PRIMARY, "|\n          npm \\\n            install")
        self.assert_blocked(workflow)

    def test_quoted_semicolon_npm_install_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, 'echo "example; npm install"'))

    def test_here_doc_npm_install_blocks(self) -> None:
        workflow = replace_run(
            PRIMARY,
            "|\n          cat <<'EOF'\n          npm install\n          EOF",
        )
        self.assert_blocked(workflow)

    def test_multiline_quoted_npm_install_blocks(self) -> None:
        workflow = replace_run(
            PRIMARY,
            "|\n          printf '%s\\n' \"npm\n          install\"",
        )
        self.assert_blocked(workflow)

    def test_quoted_semicolon_false_npm_ci_proof_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, 'echo "example; npm ci"'))

    def test_here_doc_false_npm_ci_proof_blocks(self) -> None:
        workflow = replace_run(
            PRIMARY,
            "|\n          cat <<'EOF'\n          npm ci\n          EOF",
        )
        self.assert_blocked(workflow)

    def test_bash_c_false_npm_ci_proof_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "bash -c 'npm ci'"))

    def test_primary_npm_ci_plus_extra_command_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "npm ci && echo extra"))

    def test_primary_echo_npm_ci_blocks(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "echo npm ci"))

    def test_added_executable_run_step_blocks(self) -> None:
        self.assert_blocked(append_run_step("Unexpected command", "echo extra"))

    def test_removed_required_run_step_blocks(self) -> None:
        needle = (
            "      - name: Production smoke unit tests\n"
            "        run: npm run test:smoke\n\n"
        )
        self.assertIn(needle, CURRENT)
        self.assert_blocked(CURRENT.replace(needle, "", 1))

    def test_renamed_required_run_step_blocks(self) -> None:
        self.assert_blocked(
            CURRENT.replace(
                "      - name: Build static site\n",
                "      - name: Build website\n",
                1,
            )
        )

    def test_duplicate_required_run_step_blocks(self) -> None:
        block = (
            "      - name: Install dependencies from committed lockfile\n"
            "        run: npm ci\n\n"
        )
        self.assertIn(block, CURRENT)
        self.assert_blocked(CURRENT.replace(block, block + block, 1))

    def test_changed_accepted_run_command_blocks(self) -> None:
        self.assert_blocked(replace_run("Build static site", "npm run build --if-present"))

    def test_duplicate_run_key_fails_closed(self) -> None:
        workflow = CURRENT.replace(
            "      - name: Install dependencies from committed lockfile\n"
            "        run: npm ci\n",
            "      - name: Install dependencies from committed lockfile\n"
            "        run: npm ci\n"
            "        run: npm install\n",
            1,
        )
        self.assert_blocked(workflow)

    def test_unsupported_block_indent_marker_fails_closed(self) -> None:
        self.assert_blocked(replace_run(PRIMARY, "|2\n          npm ci"))

    def test_primary_inline_yaml_comment_preserves_semantic_command(self) -> None:
        workflow = replace_run(PRIMARY, "npm ci # deterministic install")
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_flow_style_direct_run_fails_closed(self) -> None:
        self.assert_blocked(append_direct_step_yaml("- { run: npm install }"))

    def test_flow_style_named_direct_run_fails_closed(self) -> None:
        self.assert_blocked(
            append_direct_step_yaml("- { name: Unexpected install, run: npm install }")
        )

    def test_direct_alias_step_fails_closed(self) -> None:
        self.assert_blocked(append_direct_step_yaml("- *unexpected-step"))

    def test_bare_direct_sequence_entry_fails_closed(self) -> None:
        self.assert_blocked(
            append_direct_step_yaml("-\n        name: Unexpected install\n        run: npm install")
        )

    def test_quoted_direct_run_key_fails_closed(self) -> None:
        workflow = CURRENT.replace(
            "      - name: Install dependencies from committed lockfile\n"
            "        run: npm ci\n",
            "      - name: Install dependencies from committed lockfile\n"
            '        "run": npm install\n',
            1,
        )
        self.assert_blocked(workflow)

    def test_reordered_required_run_steps_block(self) -> None:
        build = "      - name: Build static site\n        run: npm run build\n\n"
        validate = (
            "      - name: Validate repository and built site\n"
            "        run: python scripts/validate_repository.py\n\n"
        )
        self.assertIn(build + validate, CURRENT)
        self.assert_blocked(CURRENT.replace(build + validate, validate + build, 1))


class WorkflowGovernancePolicyTests(unittest.TestCase):
    def assert_governance_blocked(self, workflow: str) -> None:
        errors = validate_workflow_governance(workflow)
        self.assertTrue(errors, "expected governance drift to be rejected")

    def test_current_governance_contract_passes(self) -> None:
        self.assertEqual(validate_workflow_governance(CURRENT), [])

    def test_pull_request_target_is_rejected(self) -> None:
        workflow = CURRENT.replace("  pull_request:\n", "  pull_request_target:\n", 1)
        self.assert_governance_blocked(workflow)

    def test_quoted_pull_request_target_is_rejected(self) -> None:
        workflow = CURRENT.replace("  pull_request:\n", '  "pull_request_target":\n', 1)
        self.assert_governance_blocked(workflow)

    def test_ready_for_review_event_is_required(self) -> None:
        workflow = CURRENT.replace(", ready_for_review", "", 1)
        self.assert_governance_blocked(workflow)

    def test_extra_pull_request_event_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            "ready_for_review]",
            "ready_for_review, edited]",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_main_push_trigger_is_required(self) -> None:
        workflow = CURRENT.replace(EXPECTED_PUSH_TRIGGER, "", 1)
        self.assert_governance_blocked(workflow)

    def test_manual_dispatch_trigger_is_required(self) -> None:
        workflow = CURRENT.replace(EXPECTED_WORKFLOW_DISPATCH, "", 1)
        self.assert_governance_blocked(workflow)

    def test_pr_branch_filter_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_PR_TRIGGER,
            EXPECTED_PR_TRIGGER + "    branches-ignore: ['**']\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_schedule_trigger_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            "on:\n",
            "on:\n  schedule:\n    - cron: '0 0 * * *'\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_workflow_run_trigger_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            "on:\n",
            "on:\n  workflow_run:\n    workflows: ['Other']\n    types: [completed]\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_extra_push_branch_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            "      - main\n",
            "      - main\n      - develop\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_push_paths_filter_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_PUSH_TRIGGER,
            EXPECTED_PUSH_TRIGGER + "    paths:\n      - '**/*.html'\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_draft_skip_condition_is_required(self) -> None:
        workflow = CURRENT.replace(EXPECTED_VALIDATE_IF, "", 1)
        self.assert_governance_blocked(workflow)

    def test_unconditional_cancellation_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_CANCEL_POLICY,
            "  cancel-in-progress: true\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_concurrency_group_drift_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_CONCURRENCY_GROUP,
            "  group: validate-${{ github.ref }}\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_level_concurrency_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON
            + "    concurrency:\n"
            + "      group: validate-${{ github.ref }}\n"
            + "      cancel-in-progress: true\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_mutable_checkout_tag_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            f"actions/checkout@{EXPECTED_ACTION_REFS['actions/checkout']}",
            "actions/checkout@v7",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_dash_uses_mutable_action_is_rejected(self) -> None:
        marker = "      - name: Install dependencies from committed lockfile\n"
        unexpected = "      - uses: actions/checkout@v4\n        with:\n          persist-credentials: true\n"
        self.assertIn(marker, CURRENT)
        self.assert_governance_blocked(CURRENT.replace(marker, unexpected + marker, 1))

    def test_dash_uses_docker_action_is_rejected(self) -> None:
        marker = "      - name: Install dependencies from committed lockfile\n"
        unexpected = "      - uses: docker://alpine:3\n"
        self.assertIn(marker, CURRENT)
        self.assert_governance_blocked(CURRENT.replace(marker, unexpected + marker, 1))

    def test_setup_node_pin_drift_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            f"actions/setup-node@{EXPECTED_ACTION_REFS['actions/setup-node']}",
            "actions/setup-node@0000000000000000000000000000000000000000",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_setup_python_mutable_tag_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            f"actions/setup-python@{EXPECTED_ACTION_REFS['actions/setup-python']}",
            "actions/setup-python@v7",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_upload_artifact_mutable_tag_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            f"actions/upload-artifact@{EXPECTED_ACTION_REFS['actions/upload-artifact']}",
            "actions/upload-artifact@v7",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_checkout_credentials_must_not_persist(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_CHECKOUT_CREDENTIAL_POLICY,
            "          persist-credentials: true\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_checkout_ref_override_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_CHECKOUT_CREDENTIAL_POLICY,
            EXPECTED_CHECKOUT_CREDENTIAL_POLICY + "          ref: main\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_checkout_token_override_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_CHECKOUT_CREDENTIAL_POLICY,
            EXPECTED_CHECKOUT_CREDENTIAL_POLICY + "          token: ${{ secrets.EXAMPLE }}\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_unexpected_action_surface_is_rejected(self) -> None:
        marker = "      - name: Install dependencies from committed lockfile\n"
        unexpected = (
            "      - name: Unexpected action\n"
            "        uses: example/action@0123456789012345678901234567890123456789\n\n"
        )
        self.assertIn(marker, CURRENT)
        self.assert_governance_blocked(CURRENT.replace(marker, unexpected + marker, 1))

    def test_second_job_is_rejected(self) -> None:
        workflow = CURRENT + (
            "\n  unexpected:\n"
            "    runs-on: ubuntu-latest\n"
            "    steps:\n"
            "      - uses: actions/checkout@v4\n"
        )
        self.assert_governance_blocked(workflow)

    def test_permissions_write_all_is_rejected(self) -> None:
        workflow = CURRENT.replace(EXPECTED_PERMISSIONS, "permissions: write-all\n", 1)
        self.assert_governance_blocked(workflow)

    def test_additional_global_permission_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_PERMISSIONS,
            EXPECTED_PERMISSIONS + "  id-token: write\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_level_permissions_write_all_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    permissions: write-all\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_level_contents_write_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    permissions:\n      contents: write\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_level_env_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    env:\n      TOKEN: ${{ secrets.EXAMPLE }}\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_defaults_are_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    defaults:\n      run:\n        shell: echo\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_continue_on_error_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    continue-on-error: true\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_job_container_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            EXPECTED_VALIDATE_RUNS_ON,
            EXPECTED_VALIDATE_RUNS_ON + "    container: alpine:3\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_self_hosted_runner_is_rejected(self) -> None:
        workflow = CURRENT.replace(EXPECTED_VALIDATE_RUNS_ON, "    runs-on: self-hosted\n", 1)
        self.assert_governance_blocked(workflow)

    def test_workflow_level_env_is_rejected(self) -> None:
        workflow = CURRENT.replace(
            "jobs:\n",
            "env:\n  TOKEN: ${{ secrets.EXAMPLE }}\n\njobs:\n",
            1,
        )
        self.assert_governance_blocked(workflow)

    def test_upload_artifact_must_fail_on_missing_file(self) -> None:
        workflow = CURRENT.replace(
            "          if-no-files-found: error\n",
            "          if-no-files-found: ignore\n",
            1,
        )
        self.assert_governance_blocked(workflow)


if __name__ == "__main__":
    unittest.main()
