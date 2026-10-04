#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
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


def primary_run(workflow: str) -> str:
    matches = [step.run for step in extract_validate_run_steps(workflow) if step.name == PRIMARY]
    if len(matches) != 1:
        raise AssertionError(f"expected one primary step, found {len(matches)}")
    return matches[0]


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
            "        env:\n          NOTE: npm install is forbidden here\n"
            "        with:\n          python-version: '3.12'\n",
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


if __name__ == "__main__":
    unittest.main()
