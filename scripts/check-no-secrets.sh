#!/usr/bin/env bash
# This repository is public and the Firebase admin SDK key that lives in .env/
# can read and write every tenant's documents, bypassing all security rules.
# Committing it once is unrecoverable — it is public the moment it is pushed,
# and rotating it is the only fix. So: check on every run, fail loudly.
set -euo pipefail

fail=0

# 1. Files that must never be tracked, by path shape.
while IFS= read -r f; do
  case "$f" in
    .env|.env/*|*/.env|*.secret.local|*firebase-adminsdk*.json|service-account*.json)
      echo "::error file=$f::$f is tracked by git and must not be. Remove it with 'git rm --cached' and confirm .gitignore covers it."
      fail=1
      ;;
  esac
done < <(git ls-files)

# 2. Private keys and live provider tokens, by content. Scans tracked files
#    only — an untracked scratch file is not a leak.
patterns=(
  'BEGIN [A-Z ]*PRIVATE KEY'
  '"private_key_id"[[:space:]]*:'
  'AIza[0-9A-Za-z_-]{35}'          # Google API key
  'sk-[A-Za-z0-9]{32,}'            # provider secret key
  'SG\.[A-Za-z0-9_-]{20,}'         # SendGrid
  'AC[0-9a-f]{32}'                 # Twilio account SID (real ones are hex)
  'gh[pousr]_[A-Za-z0-9]{36}'      # GitHub token
)

for p in "${patterns[@]}"; do
  # -I skips binaries. The web Firebase config is a deliberate exception: it is
  # an identifier, not a credential, and access control lives in the rules.
  hits=$(git grep -InE "$p" -- \
    ':!web/src/lib/firebase.ts' \
    ':!scripts/check-no-secrets.sh' \
    ':!*.lock' ':!*-lock.json' 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "::error::Possible credential committed (pattern: $p)"
    echo "$hits"
    fail=1
  fi
done

# 3. The extension config files are committed on purpose, so prove they still
#    hold placeholders rather than someone's real Twilio SID or SMTP URI.
for f in extensions/*.env; do
  [ -f "$f" ] || continue
  if grep -qE '^TWILIO_ACCOUNT_SID=AC[0-9a-f]{32}' "$f"; then
    echo "::error file=$f::a real Twilio Account SID is committed; move it to Secret Manager"
    fail=1
  fi
  if grep -qE '^SMTP_CONNECTION_URI=smtps?://[^:]+:[^@]+@' "$f"; then
    echo "::error file=$f::the SMTP URI contains an inline password; the password belongs in *.secret.local"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "✓ No credentials tracked. Admin SDK key, extension secrets and provider tokens are all absent."
fi
exit "$fail"
