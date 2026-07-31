#!/usr/bin/env bash
# US English in user-facing copy.
#
# packages/shared has its own guard inside check.ts, which is the strict one:
# en-US there is the source locale every translation derives from, so one en-GB
# string silently corrupts all twenty. This covers the rest of the repo, which
# check.ts cannot reach without importing across package boundaries.
#
# It exists because vigilance already failed twice — a "hex colour" validation
# error in Settings and "not one we recognise" on a failed upload, both shipped,
# both seen by users.
#
# Comments are deliberately not checked. They aren't user-facing and rewriting
# them is diff noise. Matcher patterns live in packages/shared and are excluded
# there by construction: they must accept both spellings, never one.
set -euo pipefail
cd "$(dirname "$0")/.."

MARKERS='itemis(e|ed|ing)|acknowledgement|totalling|cheque|licence|organis(e|ed|ing|ation)|recognis(e|ed)|colour|behaviour|programme|apologise|centre'

hits=$(
  grep -rnEI --include='*.ts' --include='*.tsx' \
    --exclude='*.test.ts' --exclude='*.test.tsx' \
    "$MARKERS" functions/src web/src 2>/dev/null |
    grep -vE '^[^:]+:[0-9]+: *(\*|//|/\*)' || true
)

if [ -n "$hits" ]; then
  echo "✗ en-GB spelling in user-facing copy. TaxFax is a US tax product; these read as typos."
  echo "$hits"
  exit 1
fi

echo "✓ User-facing copy is US English."
