# Changelog (fork of Seagey/couch-tv, MIT)

Upstream is the `upstream` git remote. Pull updates with `git fetch upstream`.

## Unreleased
- No AI at runtime: the bridge never starts `claude -p` (run_claude raises, ask is off, the
  recommendation refresh loop does not run). Guard test: tests/test_no_ai.py.
