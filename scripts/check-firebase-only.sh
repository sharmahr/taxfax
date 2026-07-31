#!/usr/bin/env bash
# Every backend service in TaxFax must be Firebase. Email and SMS go through
# Firebase Extensions, which talk to the providers on our behalf — application
# code never holds a provider SDK, so a provider swap is a console change and a
# leaked provider key is not a thing we can do.
#
# It is not a sandbox; it is the tripwire that catches the realistic failure,
# which is someone reaching for a familiar package or a familiar REST endpoint
# under deadline. A denylist of dependency *names* only catches the first of
# those, so this checks four things:
#
#   1. manifests, discovered rather than listed, so a new workspace is not
#      invisible to the check the day it is created;
#   2. imports in source, because `npm i` and a commit are separate acts and the
#      import lands first;
#   3. direct HTTP to a provider's API host, which needs no dependency at all —
#      `fetch('https://api.sendgrid.com/v3/mail/send')` is the whole bypass;
#   4. imports straight from a CDN, which route around the manifest and so
#      around check 1.
#
# Scans every workspace's source, not just functions: a Postgres client or a
# mail provider called from the browser is the same product violation, and the
# web app is where a "quick" third-party integration is most tempting.
set -euo pipefail

fail=0

# Source we own, in every workspace. Tracked files only — an untracked scratch
# file is not shipped, and this keeps node_modules and build output out.
code=(':!scripts/*' '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.svelte' '*.vue')

# package -> why it is not allowed here
banned=(
  # Databases and ORMs — Firestore is the datastore.
  "pg:Postgres client; use Firestore"
  "mysql:MySQL client; use Firestore"
  "mysql2:MySQL client; use Firestore"
  "mongodb:MongoDB driver; use Firestore"
  "mongoose:MongoDB ODM; use Firestore"
  "redis:Redis client; use Firestore"
  "ioredis:Redis client; use Firestore"
  "@upstash/redis:hosted Redis; use Firestore"
  "@neondatabase/serverless:hosted Postgres; use Firestore"
  "@libsql/client:hosted SQLite; use Firestore"
  "better-sqlite3:a local database file has no place in a stateless function"
  "sqlite3:a local database file has no place in a stateless function"
  "@prisma/client:ORM implies a non-Firebase database"
  "prisma:ORM implies a non-Firebase database"
  "drizzle-orm:ORM implies a non-Firebase database"
  "knex:query builder implies a non-Firebase database"
  "sequelize:ORM implies a non-Firebase database"
  "typeorm:ORM implies a non-Firebase database"
  "@supabase/supabase-js:competing BaaS"
  "@planetscale/database:non-Firebase database"

  # Queues and schedulers — Cloud Scheduler via onSchedule.
  "bull:job queue; use Cloud Scheduler + Firestore"
  "bullmq:job queue; use Cloud Scheduler + Firestore"
  "agenda:job scheduler; use onSchedule"
  "node-cron:in-process cron; use onSchedule"
  "kafkajs:message broker; use Firestore triggers"
  "amqplib:message broker; use Firestore triggers"

  # Mail and SMS — must go through Firebase Extensions.
  "nodemailer:send email via the firestore-send-email extension"
  "@sendgrid/mail:send email via the firestore-send-email extension"
  "postmark:send email via the firestore-send-email extension"
  "resend:send email via the firestore-send-email extension"
  "mailgun.js:send email via the firestore-send-email extension"
  "twilio:send SMS via the twilio/send-message extension"
  "@vonage/server-sdk:send SMS via the twilio/send-message extension"

  # Other clouds and hosts.
  "aws-sdk:another cloud"
  "@aws-sdk/client-s3:another cloud; use Cloud Storage"
  "@aws-sdk/client-ses:another cloud"
  "@azure/storage-blob:another cloud; use Cloud Storage"
  "@vercel/kv:another host"
  "@netlify/functions:another host"

  # Long-lived servers — Cloud Functions is the compute.
  "express:implies a long-lived server; use Cloud Functions"
  "fastify:implies a long-lived server; use Cloud Functions"
  "koa:implies a long-lived server; use Cloud Functions"
  "next:implies a non-Firebase render host"

  # The classifier is deterministic on purpose: IRS forms have fixed literal
  # titles, so pattern matching is more accurate than a model, explainable to a
  # preparer, free, and about 5ms. It also keeps client tax documents out of
  # third-party inference.
  "openai:classification must stay deterministic and on-Firebase"
  "@anthropic-ai/sdk:classification must stay deterministic and on-Firebase"
  "@google/generative-ai:classification must stay deterministic and on-Firebase"
)

# API host -> why calling it directly is the same violation as installing its
# SDK. Hosts are matched inside a URL, so a mention in prose is not a hit.
banned_hosts=(
  'api\.sendgrid\.com:SendGrid; write to the mail/ queue instead'
  'api\.mailgun\.net:Mailgun; write to the mail/ queue instead'
  'api\.postmarkapp\.com:Postmark; write to the mail/ queue instead'
  'api\.resend\.com:Resend; write to the mail/ queue instead'
  'api\.mailjet\.com:Mailjet; write to the mail/ queue instead'
  'api\.twilio\.com:Twilio; write to the messages/ queue instead'
  'rest\.nexmo\.com:Vonage; write to the messages/ queue instead'
  'api\.openai\.com:classification must stay deterministic and on-Firebase'
  'api\.anthropic\.com:classification must stay deterministic and on-Firebase'
  'generativelanguage\.googleapis\.com:classification must stay deterministic and on-Firebase'
  'api\.stripe\.com:payments go through a Firebase Extension, not a direct call'
  '[a-z0-9-]+\.supabase\.co:competing BaaS'
  '[a-z0-9-]+\.upstash\.io:non-Firebase datastore'
  '[a-z0-9-]+\.neon\.tech:non-Firebase database'
  '[a-z0-9-]+\.planetscale\.com:non-Firebase database'
  '[a-z0-9.-]*amazonaws\.com:another cloud; use Cloud Storage and Cloud Functions'
  '[a-z0-9-]+\.blob\.core\.windows\.net:another cloud; use Cloud Storage'
  'api\.vercel\.com:another host'
  'api\.cloudflare\.com:another host'
)

# Prints one annotation per hit so the offending file and line are named.
report() {
  local why="$1" hits="$2" file rest line
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    rest="${hit#*:}"
    line="${rest%%:*}"
    echo "::error file=$file,line=$line::$why"
    echo "    $hit"
    fail=1
  done <<< "$hits"
}

# 1. Manifests — discovered, not listed, so a workspace added tomorrow is
#    covered today.
manifests=$(git ls-files '*package.json' | grep -v '/node_modules/' || true)
manifest_hits=$(BANNED="$(printf '%s\n' "${banned[@]}")" MANIFESTS="$manifests" node -e '
  const fs = require("fs");
  const banned = (process.env.BANNED || "").split("\n").filter(Boolean).map((e) => {
    const i = e.indexOf(":");
    return [e.slice(0, i), e.slice(i + 1)];
  });
  for (const m of (process.env.MANIFESTS || "").split("\n").filter(Boolean)) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(m, "utf8")); } catch { continue; }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const [name, why] of banned) if (deps[name]) console.log(m + "\t" + name + "\t" + why);
  }
')
while IFS=$'\t' read -r manifest pkg why; do
  [ -z "$manifest" ] && continue
  echo "::error file=$manifest::'$pkg' is not allowed — $why"
  fail=1
done <<< "$manifest_hits"

# 2. Imports — a dependency is in the code before it is in the manifest, and
#    a vendored or transitively-available package never reaches the manifest
#    at all.
for entry in "${banned[@]}"; do
  pkg="${entry%%:*}"
  why="${entry#*:}"
  esc=$(printf '%s' "$pkg" | sed 's/[.]/\\./g')
  hits=$(git grep -InE \
    "(from|import|require)[[:space:]]*\(?[[:space:]]*['\"]${esc}(/[^'\"]*)?['\"]" \
    -- "${code[@]}" 2>/dev/null || true)
  report "imports '$pkg' — $why" "$hits"
done

# 3. Direct HTTP to a provider. Needs no dependency, so checks 1 and 2 cannot
#    see it; this is the bypass that looks like a one-line shortcut.
for entry in "${banned_hosts[@]}"; do
  host="${entry%%:*}"
  why="${entry#*:}"
  hits=$(git grep -InE "https?://${host}" -- "${code[@]}" 2>/dev/null || true)
  report "calls a non-Firebase service host directly — $why" "$hits"
done

# 4. Remote module imports. They route around the manifest, which is where
#    every other dependency check looks, and around npm's integrity checking.
hits=$(git grep -InE "(from|import|require)[[:space:]]*\(?[[:space:]]*['\"]https?://" \
  -- "${code[@]}" 2>/dev/null || true)
report "imports a module over the network — dependencies must come from the manifest, where this check can see them" "$hits"

# 5. Provider credentials in source. If these appear, something is bypassing
#    the Extensions, which are the only thing that should ever hold them.
#    No `\b` here: git grep's regex engine does not implement it, and a check
#    whose pattern never matches is worse than no check at all.
hits=$(git grep -InE '(SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|SMTP_PASSWORD|AWS_SECRET_ACCESS_KEY)' \
  -- "${code[@]}" 2>/dev/null || true)
report "references a provider credential — email and SMS are sent by writing to the extension queue collections (mail/, messages/), never by calling a provider directly" "$hits"

if [ "$fail" -eq 0 ]; then
  echo "✓ Backend is Firebase-only: no competing database, queue, mail/SMS provider, cloud, or server framework — in any manifest, import, or outbound URL."
fi
exit "$fail"
