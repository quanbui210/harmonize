# HarmonizeAI

Foundational codebase for an AI-driven HTS classification suite that delivers the GRI Engine, Reasoning Dossier, Compliance Vault, and Duty Calculator.

## Phase 1 · Platform setup

- Next.js 14.2 App Router with strict TypeScript configuration
- Tailwind CSS v4 with Shadcn UI (button, input, textarea, select, label, card, badge, table, form primitives)
- Prisma wired for PostgreSQL + pgvector plus resilient Prisma client helper
- Supabase admin client stub and environment contract for future project wiring

## Phase 2 · Domain modeling (in-progress)

- Multi-tenant Prisma schema covering organizations, memberships, products, materials, classifications, dossiers, risk flags, duty summaries, vault files, legal notes, and tariff metadata
- Validation layer powered by Zod for product intake and classification pipelines
- Server actions for creating and updating products plus classification upserts, ready to plug into UI flows or background workers

## API Access Guide

**📖 For detailed API access instructions, see [docs/API_ACCESS_GUIDE.md](./docs/API_ACCESS_GUIDE.md)**

Quick summary:
- **VIES (VAT):** Public service, no API key needed ✅
- **TARIC:** Use mock mode for dev, third-party REST for production
- **EORI:** Use mock mode for dev, third-party REST for production
- **OpenAI:** Required for classification features

## Getting started

1. `cp env.example .env` and supply `DATABASE_URL`, Supabase keys, and app URL.
2. **Set OpenAI API key** (required for classification): `OPENAI_API_KEY=sk-...`
3. **For development:** Set `TARIC_PROVIDER=MOCK` (no API keys needed)
4. `npm install`
5. `npm run dev` to boot the Next.js server on `http://localhost:3000`.
6. `npm run db:push` once a database is available to sync the Prisma schema.

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

- Framework: Next.js 14.2 (App Router, RSC, Server Actions ready)
- Styling: Tailwind CSS v4, Shadcn UI, Inter/JetBrains Mono font stack
- Data: Prisma, PostgreSQL with pgvector, Supabase client SDK
- Tooling: ESLint (core web vitals), TypeScript strict mode, npm scripts for database workflows

## Documentation

- **App Flow Guide:** [docs/APP_FLOW_GUIDE.md](./docs/APP_FLOW_GUIDE.md) - Complete user journey and navigation
- **Use Cases:** [docs/USE_CASES_EXPLAINED.md](./docs/USE_CASES_EXPLAINED.md) - When to use VAT, TARIC, EORI
- **API Access:** [docs/API_ACCESS_GUIDE.md](./docs/API_ACCESS_GUIDE.md) - How to get API keys
- **Supabase Setup:** [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) - Storage and RLS configuration

## Next phases

1. ✅ Multi-tenant data model (organizations, products, classifications, dossiers, vault files)
2. ✅ Authentication (Supabase with Google OAuth)
3. ✅ AI pipelines for classification and dossier generation
4. ✅ Compliance vault storage and audit export
5. 🔄 **Next:** Build VAT/EORI validator UI components
6. 🔄 **Next:** Supplier and customer management pages
