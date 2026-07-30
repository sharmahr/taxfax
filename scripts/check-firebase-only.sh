#!/usr/bin/env bash
# Every backend service in TaxFax must be Firebase. Email and SMS go through
# Firebase Extensions, which talk to the providers on our behalf — application
# code never holds a provider SDK, so a provider swap is a console change and a
# leaked provider key is not a thing we can do.
#
# This check is dependency-level. It is not a sandbox; it is the tripwire that
# catches the realistic failure, which is someone reaching for a familiar npm
# package under deadline.
set -euo pipefail

fail=0

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

for manifest in package.json web/package.json functions/package.json packages/shared/package.json; do
  [ -f "$manifest" ] || continue
  for entry in "${banned[@]}"; do
    pkg="${entry%%:*}"
    why="${entry#*:}"
    if node -e "
      const m = require('./$manifest');
      const deps = { ...(m.dependencies||{}), ...(m.devDependencies||{}), ...(m.peerDependencies||{}) };
      process.exit(deps['$pkg'] ? 0 : 1);
    " 2>/dev/null; then
      echo "::error file=$manifest::'$pkg' is not allowed — $why"
      fail=1
    fi
  done
done

# Cloud Functions must not be handed provider credentials directly. If these
# appear in function source, something is bypassing the Extensions.
if [ -d functions/src ]; then
  if grep -rInE '\b(SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|SMTP_PASSWORD|AWS_SECRET_ACCESS_KEY)\b' functions/src >/dev/null 2>&1; then
    echo "::error::Function source references a provider credential. Email and SMS must be sent by writing to the extension queue collections (mail/, messages/), never by calling a provider directly."
    grep -rInE '\b(SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|SMTP_PASSWORD|AWS_SECRET_ACCESS_KEY)\b' functions/src || true
    fail=1
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "✓ Backend is Firebase-only: no competing database, queue, mail/SMS provider, cloud, or server framework."
fi
exit "$fail"
