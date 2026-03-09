---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
$env:START_OFFSET="4200"; $env:PROD_DATABASE_URL="postgresql://postgres.kqgjfojdcgjsmufpoyyo:buidamquan1@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true"; npx tsx scripts/migrate-bti-prod.ts


$env:NEXT_PUBLIC_SUPABASE_URL="https://kqgjfojdcgjsmufpoyyo.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ2pmb2pkY2dqc211ZnBveXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU2MjU1OSwiZXhwIjoyMDg0MTM4NTU5fQ.zxzqFisfKqAIumxu-Z99GEf3Uwycna2dVje3m2ufmYs"; $env:DATABASE_URL="postgresql://postgres.kqgjfojdcgjsmufpoyyo:buidamquan1@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true"; npx tsx scripts/seed-admin.ts