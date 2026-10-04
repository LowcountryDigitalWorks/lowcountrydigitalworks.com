#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_workflow_policy import validate_workflow_install_policy


VALID = textwrap.dedent(
    """\
    name: Validate repository
    jobs:
      validate:
        steps:
          - name: Install dependencies from committed lockfile
            run: npm ci
          - name: Build static site
            run: npm run build
    """
)


def append_step(workflow: str, step: str) -> str:
    return workflow + textwrap.indent(textwrap.dedent(step), "      ")


class WorkflowInstallPolicyTests(unittest.TestCase):
    def assert_blocked(self, workflow: str) -> None:
        errors = validate_workflow_install_policy(workflow)
        self.assertTrue(errors, "expected workflow to be rejected")
        self.assertTrue(
            any("npm install" in error or "npm ci" in error for error in errors),
            errors,
        )

    def test_current_repository_workflow_passes(self) -> None:
        workflow = (ROOT / ".github/workflows/validate.yml").read_text()
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_minimal_primary_npm_ci_step_passes(self) -> None:
        self.assertEqual(validate_workflow_install_policy(VALID), [])

    def test_comment_and_non_run_text_do_not_trigger_false_positive(self) -> None:
        workflow = append_step(
            VALID,
            """\
            # run: npm install
            - name: Documentation note
              env:
                NOTE: npm install is forbidden here
              run: echo ok
            """,
        )
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_echoed_npm_install_text_is_not_an_executable_install(self) -> None:
        workflow = append_step(
            VALID,
            """\
            - name: Explain policy
              run: echo "npm install is not allowed"
            """,
        )
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_inline_npm_install_blocks(self) -> None:
        self.assert_blocked(VALID.replace("run: npm ci", "run: npm install"))

    def test_literal_block_npm_install_blocks(self) -> None:
        workflow = VALID.replace(
            "run: npm ci",
            "run: |\n          npm install",
        )
        self.assert_blocked(workflow)

    def test_folded_block_npm_install_blocks(self) -> None:
        workflow = VALID.replace(
            "run: npm ci",
            "run: >\n          npm install",
        )
        self.assert_blocked(workflow)

    def test_additional_step_npm_install_blocks(self) -> None:
        workflow = append_step(
            VALID,
            """\
            - name: Another install
              run: npm install
            """,
        )
        self.assert_blocked(workflow)

    def test_multiline_block_npm_install_after_other_command_blocks(self) -> None:
        workflow = VALID.replace(
            "run: npm ci",
            "run: |\n          echo preparing\n          npm install",
        )
        self.assert_blocked(workflow)

    def test_leading_trailing_and_internal_whitespace_npm_install_blocks(self) -> None:
        workflow = VALID.replace("run: npm ci", "run:       npm   install    ")
        self.assert_blocked(workflow)

    def test_folded_split_npm_install_blocks(self) -> None:
        workflow = VALID.replace(
            "run: npm ci",
            "run: >\n          npm\n          install",
        )
        self.assert_blocked(workflow)

    def test_shell_comment_inside_run_block_does_not_trigger(self) -> None:
        workflow = append_step(
            VALID,
            """\
            - name: Commented example
              run: |
                # npm install
                echo ok
            """,
        )
        self.assertEqual(validate_workflow_install_policy(workflow), [])

    def test_primary_step_without_executable_npm_ci_blocks(self) -> None:
        workflow = VALID.replace("run: npm ci", "run: echo npm ci")
        self.assert_blocked(workflow)


if __name__ == "__main__":
    unittest.main()
