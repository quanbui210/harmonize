# HarmonizeAI

Foundational codebase for an AI-driven HTS classification suite that delivers the GRI Engine, Reasoning Dossier, Compliance Vault, and Duty Calculator.

## Phase 1 · Platform setup

- Next.js 16 App Router with strict TypeScript configuration
- Tailwind CSS v4 with Shadcn UI (button, input, textarea, select, label, card, badge, table, form primitives)
- Prisma wired for PostgreSQL + pgvector plus resilient Prisma client helper
- Supabase admin client stub and environment contract for future project wiring

## Phase 2 · Domain modeling (in-progress)

- Multi-tenant Prisma schema covering organizations, memberships, products, materials, classifications, dossiers, risk flags, duty summaries, vault files, legal notes, and tariff metadata
- Validation layer powered by Zod for product intake and classification pipelines
- Server actions for creating and updating products plus classification upserts, ready to plug into UI flows or background workers

## Getting started

1. `cp env.example .env` and supply `DATABASE_URL`, Supabase keys, and app URL.
2. `npm install`
3. `npm run dev` to boot the Next.js server on `http://localhost:3000`.
4. `npm run db:push` once a database is available to sync the Prisma schema.

## Key scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run lint checks |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run db:push` | Push the Prisma schema to the configured database |
| `npm run db:migrate` | Create and run a named migration |
| `npm run db:studio` | Open Prisma Studio |

## Stack

- Framework: Next.js 16 (App Router, RSC, Server Actions ready)
- Styling: Tailwind CSS v4, Shadcn UI, Geist font stack
- Data: Prisma, PostgreSQL with pgvector, Supabase client SDK
- Tooling: ESLint (core web vitals), TypeScript strict mode, npm scripts for database workflows

## Next phases

1. Define the multi-tenant data model (organizations, products, classifications, dossiers, vault files).
2. Wire authentication (Supabase and optional SSO provider) plus RBAC.
3. Build the AI pipelines for classification, dossier generation, and duty intelligence.
4. Ship compliance vault storage, hashing, and audit log services.
