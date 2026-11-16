# Changelog (fork of Seagey/couch-tv, MIT)

Upstream is the `upstream` git remote. Pull updates with `git fetch upstream`.
This fork is the guest/rental TV home only (couch-tv option A): no phone remote, no bridge.

## Unreleased
- Removed: bridge/, remote/ (phone web UI), on-tv/, standalone/, sync/, other TV brands
  (lg, samsung, roku, tvos, vega, titan), their scripts, docs and tests, and the CI workflow.
  This also removes the Claude assistant (`claude -p`): no AI at runtime.
- MainActivity: any bridge address is ignored and a saved one is dropped; `alone()` is always true.
- scripts/build-apk.sh builds only the TV home, with self-update off (`UPDATE_REPO=`).
- Not used, ever: network discovery (find-tvs.py was removed).
