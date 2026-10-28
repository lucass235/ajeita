"""Controles com gcloud simulado: nunca acessam Google Cloud."""
import os
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).parents[1]


class ControlsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.log = pathlib.Path(self.temp.name) / 'calls'
        cli = pathlib.Path(self.temp.name) / 'gcloud'
        cli.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  "projects describe "*) printf '%s\\n' "$FAKE_LABEL" ;;
  "run services describe "*) printf '%s\\n' "$FAKE_LABEL" ;;
esac
''')
        cli.chmod(0o700)
        self.env = dict(os.environ, PATH=self.temp.name + ':' + os.environ['PATH'],
                        CALL_LOG=str(self.log), FAKE_LABEL='ajeita')

    def run_control(self, project, action, execute=True, confirmation=''):
        return subprocess.run(['bash', str(ROOT / 'cloudrun/panico.sh'), project, action]
                              + (['--execute'] if execute else []), env=self.env,
                              input=confirmation, text=True, capture_output=True)

    def test_rejects_ebenezer_before_any_cloud_call(self):
        self.assertNotEqual(self.run_control('ebenezer-prod', 'parar').returncode, 0)
        self.assertFalse(self.log.exists())

    def test_rejects_project_without_isolation_label(self):
        self.env['FAKE_LABEL'] = 'ebenezer'
        self.assertNotEqual(self.run_control('ajeita-test123', 'parar').returncode, 0)
        self.assertNotIn('run services update', self.log.read_text())

    def test_preview_does_not_call_cloud(self):
        self.assertEqual(self.run_control('ajeita-test123', 'parar', False).returncode, 0)
        self.assertFalse(self.log.exists())

    def test_stop_scales_zero_and_clears_revision_tags(self):
        self.assertEqual(self.run_control('ajeita-test123', 'parar').returncode, 0)
        calls = self.log.read_text()
        self.assertIn('--scaling=0', calls)
        self.assertIn('--clear-tags', calls)
        for line in calls.splitlines():
            if line.startswith('run '):
                self.assertIn('ajeita-bot', line)
                self.assertIn('--project=ajeita-test123', line)

    def test_delete_requires_confirmation(self):
        self.assertNotEqual(self.run_control('ajeita-test123', 'excluir', confirmation='NAO\n').returncode, 0)
        self.assertNotIn('services delete', self.log.read_text())


if __name__ == '__main__':
    unittest.main()
