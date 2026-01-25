# TulliCheck - Complete Handover Document

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Database Schema](#database-schema)
6. [Environment Variables](#environment-variables)
7. [Setup Instructions](#setup-instructions)
8. [Key Features & Workflows](#key-features--workflows)
9. [Important Files & Their Purposes](#important-files--their-purposes)
10. [Deployment Guide](#deployment-guide)
11. [Development Guidelines](#development-guidelines)
12. [Troubleshooting](#troubleshooting)
13. [API Integrations](#api-integrations)
14. [RAG Pipeline](#rag-pipeline)
15. [Observability & Monitoring](#observability--monitoring)

---

## Project Overview

**TulliCheck** is an AI-driven HTS (Harmonized Tariff Schedule) classification suite that helps businesses classify products for international trade, generate compliance documentation, and manage regulatory requirements. The platform provides:

- **AI-Powered Product Classification**: Automated HTS/CN code classification using EU GRI (General Rules of Interpretation) engine
- **Defense Dossier Generation**: Automated generation of legal defense documents for customs audits
- **Compliance Chat**: RAG-powered Q&A system for regulatory questions
- **Label Generation**: Automated product label generation with compliance checking
- **Compliance Vault**: Secure document storage and audit trail management
- **Shipment Management**: Track imports/exports with classification and duty calculations
- **Multi-Tenant Architecture**: Organization-based data isolation with role-based access control

### Target Markets
- **Primary**: EU (European Union)
- **Secondary**: US, UK, VN (Vietnam), CA (Canada), AU (Australia)

### Key Use Cases
1. Importers classifying products for customs
2. Exporters generating compliance documentation
3. Compliance officers managing regulatory requirements
4. Customs brokers preparing defense dossiers

---

## Technology Stack

### Core Framework
- **Next.js 14.2** (App Router, React Server Components, Server Actions)
- **React 18.3.1** (Client Components)
- **TypeScript 5** (Strict mode)

### Styling & UI
- **Tailwind CSS v4** (Utility-first CSS)
- **Shadcn UI** (Component library: buttons, inputs, dialogs, tables, etc.)
- **Radix UI** (Accessible primitives)
- **Lucide React** (Icons)

### Database & ORM
- **PostgreSQL** (via Supabase)
- **Prisma 6.19.0** (ORM)
- **pgvector** (Vector embeddings for RAG)

### Authentication & Storage
- **Supabase Auth** (Google OAuth 2.0)
- **Supabase Storage** (File storage with RLS)

### AI & ML
- **OpenAI GPT-4o** (Classification, dossier generation, chat)
- **OpenAI GPT-4 Vision** (Image extraction)
- **OpenAI text-embedding-3-small** (Vector embeddings)

### Observability
- **Langfuse 3.38.6** (LLM observability & tracing)
- **OpenTelemetry** (Distributed tracing)
- **@langfuse/openai 4.5.1** (OpenAI instrumentation)
- **@langfuse/otel 4.5.1** (OTel integration)

### External APIs
- **TARIC SOAP API** (EU customs data - official, free)
- **VIES SOAP API** (EU VAT validation - public, free)
- **EORI API** (Economic Operator ID - requires registration)

### Development Tools
- **ESLint** (Code linting)
- **tsx** (TypeScript execution)
- **Prisma Studio** (Database GUI)

### Key Libraries
- **pdf-parse 2.4.5** (PDF text extraction)
- **react-hook-form** (Form management)
- **zod 4.3.5** (Schema validation)
- **marked** (Markdown parsing)
- **html2canvas** (Canvas rendering)
- **jspdf** (PDF generation)
- **soap** (SOAP client)

---

## Project Structure

```
harmonize-ai/
├── .next/                          # Next.js build output (gitignored)
├── data/                           # Data files for ingestion
│   ├── legal-sources/              # EUR-Lex documents
│   │   ├── eurlex-eu_2021_1832.en.full.jsonl
│   │   ├── eurlex-eu_2021_1832.en.jsonl
│   │   ├── eurlex.html
│   │   └── GRI.pdf
│   └── regolatory-docs/            # Regulatory PDFs (typo in folder name)
│       ├── en-pakkausmerkintojen_valvontaohje-17055_1.pdf
│       ├── food-information-to-be-provided.pdf
│       ├── opas_elintarvikkeista_annettavat_tiedot_fi.pdf
│       ├── Regulation - 1169_2011 - EN - Food Information to Consumers Regulation - EUR-Lex.pdf
│       ├── Regulation - 2023_988 - EN - EUR-Lex.pdf
│       └── ruokavirasto_gm_naytteenotto_ohje_liite_1_232404_02_00_01202_06.pdf
│
├── docs/                           # Documentation
│   ├── HANDOVER_DOCUMENT.md        # This file
│   ├── RAG_PIPELINE.md             # Detailed RAG documentation
│   ├── PRODUCTION_DEPLOYMENT_GUIDE.md
│   ├── PRODUCTION_DOCUMENT_INGESTION.md
│   ├── DEVELOPMENT_DATABASE_SETUP.md
│   ├── GOOGLE_OAUTH_TROUBLESHOOTING.md
│   ├── APP_FLOW_GUIDE.md
│   ├── FEATURES.md
│   └── [33 other documentation files]
│
├── node_modules/                   # Dependencies (gitignored)
│
├── prisma/                         # Database schema & migrations
│   ├── schema.prisma               # Prisma schema (all models)
│   └── init-production.sql         # SQL script for production DB setup
│
├── public/                         # Static assets
│   ├── appicon.svg
│   ├── docs/
│   │   └── 2021-1832.pdf
│   └── [other static files]
│
├── scripts/                        # Data ingestion & utility scripts
│   ├── ingest-eurlex-2021-1832.ts # Ingest EUR-Lex Regulation (EU) 2021/1832
│   ├── ingest-regulatory-docs.ts  # Ingest regulatory PDFs
│   ├── ingest-rulings.ts          # Ingest binding rulings
│   ├── generate-embeddings.ts    # Generate missing embeddings
│   └── check-embeddings.ts        # Check embedding status
│
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── (app)/                 # Protected routes (require auth)
│   │   │   ├── audit-log/
│   │   │   │   └── page.tsx       # Audit log viewer
│   │   │   ├── classify/
│   │   │   │   ├── page.tsx       # Classification search page
│   │   │   │   └── [classificationId]/
│   │   │   │       ├── page.tsx   # Classification detail
│   │   │   │       └── dossier/
│   │   │   │           └── page.tsx # Dossier generation
│   │   │   ├── compliance-chat/
│   │   │   │   ├── page.tsx       # Chat list
│   │   │   │   └── [sessionId]/
│   │   │   │       └── page.tsx   # Chat session
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       # Main dashboard
│   │   │   │   └── missing-dossiers/
│   │   │   │       └── page.tsx   # Missing dossiers view
│   │   │   ├── labels/
│   │   │   │   ├── page.tsx       # Labels list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx   # Create new label
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx   # Label detail/edit
│   │   │   ├── rulings/
│   │   │   │   ├── page.tsx       # Binding rulings list
│   │   │   │   └── [rulingId]/
│   │   │   │       └── page.tsx   # Ruling detail
│   │   │   ├── select-organization/
│   │   │   │   ├── layout.tsx     # Org selection layout
│   │   │   │   └── page.tsx       # Org selection page
│   │   │   ├── settings/
│   │   │   │   └── page.tsx       # Organization settings
│   │   │   ├── shipments/
│   │   │   │   ├── page.tsx       # Shipments list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx   # Create shipment
│   │   │   │   └── [shipmentId]/
│   │   │   │       ├── page.tsx   # Shipment detail
│   │   │   │       └── items/
│   │   │   │           └── add/
│   │   │   │               └── page.tsx # Add shipment items
│   │   │   ├── vault/
│   │   │   │   └── page.tsx       # Compliance vault
│   │   │   └── layout.tsx         # App layout (sidebar, header)
│   │   │
│   │   ├── api/                   # API routes
│   │   │   └── dossier/
│   │   │       └── [dossierId]/
│   │   │           ├── export/
│   │   │           │   └── route.ts # Export dossier as PDF
│   │   │           └── preview/
│   │   │               └── route.ts # Preview dossier HTML
│   │   │
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts       # OAuth callback handler
│   │   │
│   │   ├── login/
│   │   │   ├── loading.tsx        # Loading screen
│   │   │   └── page.tsx           # Login page
│   │   │
│   │   ├── vault/
│   │   │   └── upload/
│   │   │       └── [token]/
│   │   │           └── page.tsx   # Public upload page (for suppliers)
│   │   │
│   │   ├── favicon.ico
│   │   ├── globals.css            # Global styles
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Landing page
│   │
│   ├── components/                 # React components
│   │   ├── audit-log/
│   │   │   └── audit-log-page-client.tsx
│   │   │
│   │   ├── classification/
│   │   │   ├── alternative-classifications.tsx
│   │   │   ├── classification-search-form.tsx
│   │   │   ├── classification-table-row.tsx
│   │   │   ├── code-display.tsx
│   │   │   ├── delete-classification-button.tsx
│   │   │   ├── dossier-generator.tsx
│   │   │   ├── image-upload-section.tsx
│   │   │   ├── import-guidance-section.tsx
│   │   │   └── product-scan-section.tsx
│   │   │
│   │   ├── compliance/
│   │   │   ├── compliance-chat-layout.tsx
│   │   │   ├── compliance-chat-page-client.tsx
│   │   │   └── compliance-question-form.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── recent-classifications.tsx
│   │   │
│   │   ├── labeling/
│   │   │   ├── compliance-audit-report.tsx
│   │   │   ├── label-export-buttons.tsx
│   │   │   ├── label-image-upload.tsx
│   │   │   ├── label-preview.tsx
│   │   │   ├── label-wizard-form.tsx
│   │   │   └── label-wizard-steps.tsx
│   │   │
│   │   ├── landing/
│   │   │   ├── feature-section.tsx
│   │   │   ├── hero-section.tsx
│   │   │   └── landing-content.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── organization-selector.tsx
│   │   │   └── user-menu.tsx
│   │   │
│   │   ├── legal/
│   │   │   ├── legal-acceptance-dialog.tsx
│   │   │   ├── legal-disclaimer.tsx
│   │   │   ├── legal-notes-display.tsx
│   │   │   └── legal-source-citation.tsx
│   │   │
│   │   ├── login/
│   │   │   ├── login-form.tsx
│   │   │   ├── login-page-client.tsx
│   │   │   └── loading-screen.tsx
│   │   │
│   │   ├── organizations/
│   │   │   ├── organization-form.tsx
│   │   │   └── organization-invitation-form.tsx
│   │   │
│   │   ├── rulings/
│   │   │   └── rulings-list.tsx
│   │   │
│   │   ├── settings/
│   │   │   └── settings-page-client.tsx
│   │   │
│   │   ├── shipments/
│   │   │   ├── shipment-detail-client.tsx
│   │   │   ├── shipment-form.tsx
│   │   │   ├── shipment-item-form.tsx
│   │   │   └── shipments-list.tsx
│   │   │
│   │   ├── ui/                     # Shadcn UI components
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toast-provider.tsx
│   │   │   └── tooltip.tsx
│   │   │
│   │   └── vault/
│   │       ├── vault-dashboard.tsx
│   │       └── vault-upload-form.tsx
│   │
│   ├── lib/                        # Shared libraries & utilities
│   │   ├── constants/
│   │   │   └── markets.ts          # Market code constants
│   │   │
│   │   ├── eu/                     # EU classification & compliance
│   │   │   ├── classification-engine.ts  # Main classification logic
│   │   │   ├── eori-client.ts      # EORI validation client
│   │   │   ├── gri-engine.ts       # GRI rules engine
│   │   │   ├── openai-service.ts   # Centralized OpenAI service
│   │   │   ├── taric-client.ts     # TARIC API client
│   │   │   ├── types.ts            # EU-specific types
│   │   │   ├── vat-rates.ts        # VAT rate data
│   │   │   └── vies-client.ts     # VIES VAT validation client
│   │   │
│   │   ├── labeling/               # Label generation & compliance
│   │   │   ├── compliance-checker.ts
│   │   │   ├── label-analyzer.ts
│   │   │   ├── label-generator-enhanced.ts
│   │   │   ├── label-generator.ts
│   │   │   └── label-renderer.ts
│   │   │
│   │   ├── langfuse/               # Langfuse observability
│   │   │   ├── client.ts           # Langfuse client initialization
│   │   │   └── openai-wrapper.ts   # OpenAI wrapper with tracing
│   │   │
│   │   ├── rag/                    # RAG (Retrieval-Augmented Generation)
│   │   │   └── regulatory-search.ts # Regulatory document search
│   │   │
│   │   ├── regulatory/
│   │   │   └── product-type.ts     # Product type detection
│   │   │
│   │   ├── supabase/               # Supabase clients
│   │   │   ├── auth.ts             # Auth helpers
│   │   │   ├── client.ts           # Client-side Supabase
│   │   │   └── server.ts           # Server-side Supabase
│   │   │
│   │   ├── users/
│   │   │   └── sync-user.ts        # User sync from Supabase
│   │   │
│   │   ├── utils/
│   │   │   └── code-formatters.ts  # Code formatting utilities
│   │   │
│   │   ├── validation/             # Zod schemas
│   │   │   ├── classification.ts
│   │   │   ├── product.ts
│   │   │   └── shared.ts
│   │   │
│   │   ├── vision/
│   │   │   └── image-extraction-service.ts # Image OCR & extraction
│   │   │
│   │   ├── prisma.ts               # Prisma client singleton
│   │   └── utils.ts                # General utilities
│   │
│   └── server/
│       ├── actions/                 # Server Actions (Next.js)
│       │   ├── audit-log.ts
│       │   ├── auth.ts
│       │   ├── classification-delete.ts
│       │   ├── classification-search.ts
│       │   ├── classifications.ts
│       │   ├── cn-descriptions.ts
│       │   ├── compliance-chat.ts
│       │   ├── dossier.ts
│       │   ├── entity-validation.ts
│       │   ├── eu-classification.ts
│       │   ├── label-analysis.ts
│       │   ├── labels.ts
│       │   ├── legal-acceptance.ts
│       │   ├── legal-notes.ts
│       │   ├── organizations.ts
│       │   ├── product-images.ts
│       │   ├── products.ts
│       │   ├── rulings.ts
│       │   └── shipments.ts
│       │   └── vault.ts
│       │
│       └── queries/                 # Database query helpers
│           ├── classifications.ts
│           └── products.ts
│
├── .env                            # Environment variables (gitignored)
├── .env.example                    # Environment variable template
├── .gitignore
├── components.json                 # Shadcn UI config
├── eslint.config.mjs               # ESLint configuration
├── instrumentation.ts              # OpenTelemetry initialization
├── middleware.ts                   # Next.js middleware (auth)
├── next.config.mjs                 # Next.js configuration
├── package.json                    # Dependencies & scripts
├── postcss.config.mjs             # PostCSS configuration
├── README.md                       # Project README
├── tsconfig.json                   # TypeScript configuration
└── tsconfig.tsbuildinfo           # TypeScript build cache
```

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React UI   │  │  Next.js App │  │   Supabase   │      │
│  │  Components  │  │    Router    │  │     Auth     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server (Node.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Server     │  │   Server     │  │  Middleware   │      │
│  │   Actions    │  │  Components  │  │   (Auth)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Business Logic Layer                     │  │
│  │  • Classification Engine (GRI)                         │  │
│  │  • RAG Pipeline (Vector Search)                      │  │
│  │  • Label Generator                                   │  │
│  │  • Dossier Generator                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │   Supabase   │  │    OpenAI    │
│  (Prisma)    │  │   Storage    │  │     API     │
│  + pgvector  │  │   (Files)    │  │  (GPT-4o)    │
└──────────────┘  └──────────────┘  └──────────────┘
        │
        ▼
┌──────────────┐
│   Langfuse   │
│ (Observability)│
└──────────────┘
```

### Authentication Flow

1. User clicks "Sign in with Google" on `/login`
2. Redirected to Google OAuth consent screen
3. Google redirects to Supabase callback: `https://[PROJECT].supabase.co/auth/v1/callback`
4. Supabase exchanges code for session
5. Next.js middleware (`middleware.ts`) checks session
6. If authenticated, redirect to `/dashboard`
7. If not authenticated, redirect to `/login`

### Data Flow: Classification

1. **User Input** → Product name, description, intended use
2. **Image Upload (Optional)** → OpenAI Vision extracts product info
3. **RAG Search** → Vector similarity search on legal/regulatory documents
4. **AI Classification** → GPT-4o analyzes product + legal context
5. **GRI Engine** → Applies General Rules of Interpretation
6. **Refinement (if needed)** → User answers clarification questions
7. **Final Classification** → CN/HTS code with confidence score
8. **Dossier Generation** → Legal defense document with sources

### Data Flow: Compliance Chat

1. **User Query** → Natural language question
2. **Query Translation** → Translate to English if needed
3. **Vector Search** → Search `LegalSourceChunk` and `RegulatoryDocumentChunk`
4. **Context Assembly** → Combine top chunks as context
5. **AI Answer** → GPT-4o generates answer with citations
6. **Response** → Display answer + source citations

### Multi-Tenancy

- **Organization-based isolation**: All data scoped to `organizationId`
- **Role-based access**: OWNER, ADMIN, CONTRIBUTOR, REVIEWER, VIEWER
- **Membership model**: Users can belong to multiple organizations
- **Data queries**: Always filtered by `organizationId` in server actions

---

## Database Schema

### Core Models

#### `Organization`
- Multi-tenant root entity
- Fields: `id`, `name`, `slug`, `timezone`, `logoUrl`, `createdById`
- Relations: memberships, products, classifications, vault files, etc.

#### `User`
- User accounts synced from Supabase Auth
- Fields: `id`, `email`, `fullName`, `authProviderId`
- Relations: memberships, products, classifications, etc.

#### `Membership`
- Links users to organizations with roles
- Fields: `id`, `userId`, `organizationId`, `role` (OWNER, ADMIN, CONTRIBUTOR, REVIEWER, VIEWER)
- Unique constraint: `[userId, organizationId]`

#### `Product`
- Products to be classified
- Fields: `id`, `organizationId`, `createdById`, `name`, `description`, `intendedUse`, `targetMarkets[]`, `status`
- Relations: materials, classifications, images, labels, shipment items

#### `Classification`
- HTS/CN code classifications
- Fields: `id`, `organizationId`, `productId`, `market`, `hsCode`, `htsCode`, `status`, `confidence`, `summary`, `reasoningTrail`, `griRule`, `refinementQuestion`, `refinementAnswer`, `legalRationale`
- Relations: product, reviewer, dossier, duty summary, risk flags, sources, labels

#### `Dossier`
- Legal defense documents
- Fields: `id`, `classificationId`, `generatedById`, `storagePath`, `sha256`, `generatedAt`
- One-to-one with Classification

#### `Label`
- Product labels (EU food labeling)
- Fields: `id`, `organizationId`, `productId`, `classificationId`, `labelData` (JSON), `complianceScore`, `version`, `isDraft`

### RAG Models

#### `LegalSourceChunk`
- Chunks from EUR-Lex Regulation (EU) 2021/1832
- Fields: `id`, `source`, `regulation`, `language`, `sectionPath`, `content`, `sha256`, `pageStart`, `pageEnd`, `embedding` (vector)
- Used for classification and compliance chat

#### `RegulatoryDocument`
- Regulatory PDFs (Ruokavirasto, Tukes, Tulli, EU)
- Fields: `id`, `source`, `documentType`, `title`, `language`, `pdfUrl`, `storagePath`, `version`, `effectiveDate`
- Relations: chunks

#### `RegulatoryDocumentChunk`
- Chunks from regulatory PDFs
- Fields: `id`, `documentId`, `chunkIndex`, `sectionPath`, `content`, `pageNumber`, `embedding` (vector), `metadata` (JSON)
- Used for compliance chat

### Supporting Models

- `ProductMaterial`: Material composition percentages
- `ProductImage`: Product images with OCR/extracted data
- `VaultFile`: Compliance vault files
- `ChatSession` / `ChatMessage`: Compliance chat
- `Shipment` / `ShipmentItem`: Import/export tracking
- `BindingRuling`: Precedent rulings
- `CnCodeDescription`: CN code descriptions from TARIC
- `DutySummary`: Duty rate calculations
- `RiskFlag`: Classification risk flags
- `AuditLog`: Activity logging
- `OrganizationInvitation`: Team invitations
- `UserLegalAcceptance`: Legal disclaimer tracking

### Vector Embeddings

- **Storage**: PostgreSQL `vector` type (via pgvector extension)
- **Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Index**: Cosine distance (`<=>`) for similarity search
- **Tables with embeddings**:
  - `LegalSourceChunk.embedding`
  - `RegulatoryDocumentChunk.embedding`
  - `BindingRuling.embedding`

### Indexes

- Organization-scoped queries: `[organizationId]`, `[organizationId, userId]`
- Classification queries: `[organizationId, market]`, `[productId, market]`
- Vector search: Implicit via pgvector
- Foreign keys: All relations indexed

---

## Environment Variables

### Required Variables

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="[SAME_AS_DATABASE_URL]"  # For migrations

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # or production URL

# OpenAI (Required)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o"  # or "gpt-4-turbo-preview"
```

### Optional Variables

```bash
# Langfuse (LLM Observability)
LANGFUSE_SECRET_KEY="sk-..."
LANGFUSE_PUBLIC_KEY="pk-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"  # Default

# TARIC API (EU Customs Data)
TARIC_PROVIDER="SOAP"  # Options: "SOAP" (official, free), "REST" (third-party), "MOCK" (dev)
TARIC_WSDL_URL="https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl"

# VIES (VAT Validation - Public, no key needed)
VIES_WSDL_URL="http://ec.europa.eu/taxation_customs/vies/services/checkVatService?wsdl"

# EORI (Requires registration)
EORI_API_KEY=""
EORI_BASE_URL="https://ec.europa.eu/taxation_customs/dds2/eos"
```

### Environment Files

- **`.env`**: Local development (gitignored)
- **`.env.local`**: Local overrides (gitignored)
- **`.env.production`**: Production (gitignored)
- **`.env.example`**: Template (committed)

---

## Setup Instructions

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** or **yarn**
- **PostgreSQL** (via Supabase)
- **Git**

### Step 1: Clone Repository

```bash
git clone [repository-url]
cd harmonize-ai
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` (from Supabase project settings)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required)
- `NEXT_PUBLIC_APP_URL` (e.g., `http://localhost:3000`)

### Step 4: Set Up Database

#### Option A: Using Prisma (Recommended for Development)

```bash
# Generate Prisma client
npm run prepare

# Push schema to database
npm run db:push
```

#### Option B: Using SQL Script (Recommended for Production)

1. Open Supabase SQL Editor
2. Run `prisma/init-production.sql`
3. This creates all tables, indexes, and the `pgvector` extension

### Step 5: Set Up Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create buckets:
   - `dossiers` (public or private)
   - `vault-files` (private)
   - `product-images` (private)
   - `audit-packages` (private)
3. Set up RLS policies (see `docs/SUPABASE_SETUP.md`)

### Step 6: Set Up Google OAuth

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://[PROJECT_REF].supabase.co/auth/v1/callback`
4. Configure in Supabase Dashboard → Authentication → Providers → Google

### Step 7: Ingest Documents (Optional but Recommended)

```bash
# Ingest EUR-Lex Regulation (EU) 2021/1832
npm run ingest:eurlex:2021:db

# Ingest regulatory PDFs
npm run ingest:regulatory-docs

# Generate embeddings for missing chunks
npm run generate:embeddings
```

### Step 8: Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000`

### Step 9: Verify Setup

1. Sign in with Google OAuth
2. Create or select organization
3. Navigate to `/classify`
4. Try classifying a product

---

## Key Features & Workflows

### 1. Product Classification

**Flow**: `/classify` → Enter product → AI classifies → Review results → Generate dossier

**Key Files**:
- `src/app/(app)/classify/page.tsx`
- `src/server/actions/classification-search.ts`
- `src/lib/eu/classification-engine.ts`
- `src/lib/eu/gri-engine.ts`

**Process**:
1. User enters product details (name, description, intended use)
2. Optional: Upload product image (extracts info via OpenAI Vision)
3. RAG search on legal sources
4. AI classification using GPT-4o + GRI rules
5. If ambiguous, show refinement question
6. Display top 3 candidates with confidence scores
7. User selects top match → Create classification record

### 2. Defense Dossier Generation

**Flow**: `/classify/[id]/dossier` → Generate dossier → Download PDF

**Key Files**:
- `src/app/(app)/classify/[classificationId]/dossier/page.tsx`
- `src/server/actions/dossier.ts`
- `src/components/classification/dossier-generator.tsx`

**Process**:
1. User clicks "Generate Defense Dossier"
2. System generates HTML dossier with:
   - Product information
   - Classification reasoning (GRI rules)
   - Legal sources and citations
   - Precedent rulings (if available)
3. Convert to PDF (or serve HTML)
4. Store in Supabase Storage
5. User downloads dossier

### 3. Compliance Chat

**Flow**: `/compliance-chat` → Ask question → Get AI answer with sources

**Key Files**:
- `src/app/(app)/compliance-chat/page.tsx`
- `src/server/actions/compliance-chat.ts`
- `src/lib/rag/regulatory-search.ts`

**Process**:
1. User asks natural language question
2. System performs vector similarity search on:
   - `LegalSourceChunk` (EUR-Lex)
   - `RegulatoryDocumentChunk` (PDFs)
3. Top chunks assembled as context
4. GPT-4o generates answer with citations
5. Display answer + source links
6. Save to chat session

### 4. Label Generation

**Flow**: `/labels/new` → Enter product info → Generate label → Compliance check → Export

**Key Files**:
- `src/app/(app)/labels/new/page.tsx`
- `src/lib/labeling/label-generator-enhanced.ts`
- `src/lib/labeling/compliance-checker.ts`

**Process**:
1. User enters product information (name, ingredients, allergens, etc.)
2. System generates EU-compliant label
3. Compliance checker validates:
   - Mandatory information present
   - QUID percentages
   - Allergen declarations
   - Bilingual requirements (FI/SV)
4. Display compliance score and audit report
5. User can export as PDF/image

### 5. Compliance Vault

**Flow**: `/vault` → Generate upload link → Share with supplier → Review files

**Key Files**:
- `src/app/(app)/vault/page.tsx`
- `src/server/actions/vault.ts`
- `src/app/vault/upload/[token]/page.tsx`

**Process**:
1. User generates secure upload token
2. Shares link with supplier (public, no auth required)
3. Supplier uploads documents (MSDS, invoices, certificates)
4. Files stored in Supabase Storage
5. User reviews and links to products/shipments
6. Generate audit export (ZIP with all evidence)

### 6. Shipment Management

**Flow**: `/shipments/new` → Create shipment → Add items → Upload documents → Track status

**Key Files**:
- `src/app/(app)/shipments/page.tsx`
- `src/server/actions/shipments.ts`

**Process**:
1. User creates shipment (import/export)
2. Adds products/items with classifications
3. System calculates duty rates
4. Upload customs documents
5. Track status: DRAFT → IN_TRANSIT → CLEARED → AUDITED

---

## Important Files & Their Purposes

### Configuration Files

#### `next.config.mjs`
- Next.js configuration
- Enables `instrumentationHook` for OpenTelemetry

#### `middleware.ts`
- Authentication middleware
- Checks Supabase session
- Redirects unauthenticated users to `/login`
- Handles OAuth callback redirects

#### `instrumentation.ts`
- OpenTelemetry initialization
- Langfuse span processor setup
- Runs once on server startup

#### `prisma/schema.prisma`
- Complete database schema
- All models, relations, indexes
- Vector embedding types

### Core Business Logic

#### `src/lib/eu/classification-engine.ts`
- Main classification orchestration
- Calls GRI engine, RAG search, OpenAI
- Handles refinement questions

#### `src/lib/eu/gri-engine.ts`
- General Rules of Interpretation (GRI) logic
- Rule 1-6 application
- Heading/subheading selection

#### `src/lib/rag/regulatory-search.ts`
- Vector similarity search
- Query translation
- Chunk retrieval and ranking

#### `src/lib/langfuse/openai-wrapper.ts`
- OpenAI client wrapper
- Automatic Langfuse tracing
- Feature tagging (classification, chat, labeling, etc.)

### Server Actions

#### `src/server/actions/classification-search.ts`
- Product classification endpoint
- Returns top candidates with confidence

#### `src/server/actions/compliance-chat.ts`
- Compliance Q&A endpoint
- RAG search + AI answer generation

#### `src/server/actions/dossier.ts`
- Dossier generation
- HTML/PDF creation
- Storage management

#### `src/server/actions/labels.ts`
- Label generation and management
- Compliance checking

### Data Ingestion Scripts

#### `scripts/ingest-eurlex-2021-1832.ts`
- Ingests EUR-Lex Regulation (EU) 2021/1832
- Parses HTML/JSONL
- Chunks content
- Generates embeddings

#### `scripts/ingest-regulatory-docs.ts`
- Ingests regulatory PDFs
- Extracts text via `pdf-parse`
- Chunks and embeds

#### `scripts/generate-embeddings.ts`
- Generates missing embeddings
- Batch processing
- Progress tracking

---

## Deployment Guide

### Production Checklist

1. **Environment Variables**
   - Set all production environment variables
   - Use production Supabase project
   - Set `NEXT_PUBLIC_APP_URL` to production domain

2. **Database Setup**
   - Run `prisma/init-production.sql` in Supabase SQL Editor
   - Verify `pgvector` extension: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Run ingestion scripts (EUR-Lex, regulatory docs)

3. **Supabase Configuration**
   - Create storage buckets
   - Set up RLS policies
   - Configure Google OAuth redirect URI

4. **Build & Deploy**
   ```bash
   npm run build
   npm start
   ```
   Or deploy to Vercel/Netlify (recommended for Next.js)

5. **Post-Deployment**
   - Verify authentication flow
   - Test classification
   - Check Langfuse tracing (if enabled)

### Detailed Deployment

See `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` for complete instructions.

---

## Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended rules
- **Formatting**: Prettier (if configured)
- **Naming**: 
  - Components: PascalCase (`ProductCard.tsx`)
  - Files: kebab-case (`classification-search.ts`)
  - Functions: camelCase (`generateDossier`)

### File Organization

- **Pages**: `src/app/` (Next.js App Router)
- **Components**: `src/components/` (grouped by feature)
- **Server Logic**: `src/server/actions/` (Server Actions)
- **Shared Libraries**: `src/lib/` (utilities, clients, services)
- **UI Components**: `src/components/ui/` (Shadcn components)

### Adding New Features

1. **Create Server Action**: `src/server/actions/[feature].ts`
2. **Create Page**: `src/app/(app)/[feature]/page.tsx`
3. **Create Components**: `src/components/[feature]/`
4. **Add Validation**: `src/lib/validation/[feature].ts`
5. **Update Schema**: `prisma/schema.prisma` → `npm run db:push`

### Database Changes

1. Update `prisma/schema.prisma`
2. Run `npm run db:push` (development)
3. Or create migration: `npm run db:migrate`
4. For production: Update `prisma/init-production.sql` and run in SQL Editor

### Testing OpenAI Calls

- All OpenAI calls use `createFeatureOpenAIClient` for tracing
- Check Langfuse dashboard for traces
- Feature tags: "Classification", "Compliance Chat", "Label Generation", etc.

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"
- **Check**: `DATABASE_URL` in `.env`
- **Verify**: Supabase project is active
- **Test**: `npm run db:studio`

#### 2. "redirect_uri_mismatch" (Google OAuth)
- **Fix**: Add `https://[PROJECT_REF].supabase.co/auth/v1/callback` to Google Cloud Console
- **Wait**: 5-10 minutes for propagation
- **See**: `docs/GOOGLE_OAUTH_TROUBLESHOOTING.md`

#### 3. "No embeddings found" (RAG search)
- **Fix**: Run `npm run generate:embeddings`
- **Check**: `LegalSourceChunk.embedding IS NOT NULL`
- **Verify**: OpenAI API key is valid

#### 4. "pdf-parse did not export a function"
- **Fix**: Use class-based API: `new PDFParse({ data: buffer })`
- **See**: `scripts/ingest-regulatory-docs.ts` for example

#### 5. "Objects are not valid as a React child"
- **Fix**: Ensure `productName` is string, not object
- **See**: `src/components/labeling/compliance-audit-report.tsx` for `getProductNameString` helper

#### 6. Langfuse tracing empty
- **Check**: `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` set
- **Verify**: `instrumentation.ts` runs (check server logs)
- **Note**: No manual `tracer.startSpan()` needed - automatic via `@langfuse/openai`

### Debugging

#### Enable Debug Logs
```bash
# In .env
DEBUG=*
```

#### Check Database
```bash
npm run db:studio
```

#### Check Supabase
- Dashboard → Logs
- Dashboard → Database → Table Editor

#### Check Langfuse
- Dashboard → Traces
- Filter by feature tag

---

## API Integrations

### TARIC (EU Customs Data)

**Provider**: `TARIC_PROVIDER` (SOAP, REST, or MOCK)

**SOAP (Official, Free)**:
- No API key required
- WSDL: `https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl`
- Client: `src/lib/eu/taric-client.ts`

**Usage**:
```typescript
import { taricClient } from "@/lib/eu/taric-client";
const data = await taricClient.getGoodsNomenclature("8516.79.70");
```

### VIES (VAT Validation)

**Provider**: Public SOAP service (no key)

**Usage**:
```typescript
import { viesClient } from "@/lib/eu/vies-client";
const result = await viesClient.validateVAT("FI", "12345678");
```

### EORI (Economic Operator ID)

**Provider**: Requires registration with national customs authority

**Usage**:
```typescript
import { eoriClient } from "@/lib/eu/eori-client";
const result = await eoriClient.validateEORI("FI12345678901234");
```

### OpenAI

**Models Used**:
- `gpt-4o`: Classification, dossier generation, chat
- `gpt-4-vision-preview`: Image extraction
- `text-embedding-3-small`: Vector embeddings

**Wrapper**: `src/lib/langfuse/openai-wrapper.ts`

**Usage**:
```typescript
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";
const openai = createFeatureOpenAIClient("Feature Name", {
  userId: "...",
  organizationId: "...",
});
```

---

## RAG Pipeline

### Overview

The RAG (Retrieval-Augmented Generation) pipeline enables AI to answer questions using legal and regulatory documents.

### Components

1. **Document Ingestion** (`scripts/ingest-*.ts`)
   - Parse PDFs/HTML
   - Extract text
   - Chunk content (semantic chunking)

2. **Embedding Generation** (`scripts/generate-embeddings.ts`)
   - Generate OpenAI embeddings
   - Store as `vector` type in PostgreSQL

3. **Vector Search** (`src/lib/rag/regulatory-search.ts`)
   - Query embedding generation
   - Cosine similarity search (`<=>`)
   - Top-K retrieval

4. **Answer Generation** (`src/server/actions/compliance-chat.ts`)
   - Context assembly
   - GPT-4o generation
   - Source citation

### Detailed Documentation

See `docs/RAG_PIPELINE.md` for complete RAG documentation.

---

## Observability & Monitoring

### Langfuse Integration

**Purpose**: Trace and monitor all LLM calls

**Setup**:
1. Get keys from https://cloud.langfuse.com
2. Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`
3. `instrumentation.ts` automatically initializes OpenTelemetry

**Features**:
- Automatic tracing of OpenAI calls (via `@langfuse/openai`)
- Feature tagging (classification, chat, labeling)
- User/organization tracking
- Cost tracking
- Latency monitoring

**Usage**:
- All OpenAI calls use `createFeatureOpenAIClient`
- No manual instrumentation needed
- View traces in Langfuse dashboard

### Audit Logging

**Model**: `AuditLog`

**Tracks**:
- User actions (create, update, delete)
- Entity changes (products, classifications, etc.)
- Timestamps and user IDs

**View**: `/audit-log`

---

## Additional Resources

### Documentation Files

- `docs/RAG_PIPELINE.md` - Complete RAG documentation
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` - Production setup
- `docs/PRODUCTION_DOCUMENT_INGESTION.md` - Document ingestion
- `docs/DEVELOPMENT_DATABASE_SETUP.md` - Development DB setup
- `docs/GOOGLE_OAUTH_TROUBLESHOOTING.md` - OAuth issues
- `docs/APP_FLOW_GUIDE.md` - User journey documentation
- `docs/FEATURES.md` - Feature list
- `docs/CLASSIFICATION_FLOW.md` - Classification workflow

### External Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase Docs**: https://supabase.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs
- **Langfuse Docs**: https://langfuse.com/docs
- **pgvector Docs**: https://github.com/pgvector/pgvector

---

## Contact & Support

For questions or issues:
1. Check existing documentation in `docs/`
2. Review troubleshooting section
3. Check GitHub issues (if applicable)
4. Contact project maintainer

---

## Version History

- **v0.1.0** (Current): Initial release
  - Multi-tenant architecture
  - AI classification
  - RAG-powered compliance chat
  - Label generation
  - Compliance vault
  - Shipment management
  - Langfuse observability

---

**Last Updated**: 2025-01-XX
**Document Version**: 1.0

