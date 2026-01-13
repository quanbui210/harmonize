# HarmonizeAI - Complete Features Documentation

## Overview

HarmonizeAI is a comprehensive customs classification and compliance management platform designed to help businesses accurately classify products, manage shipments, and maintain audit-ready documentation for customs authorities.

---

## 🎯 Core Features

### 1. Product Classification & Search

**Location**: `/classify`

**Features**:
- **AI-Powered Classification**: Uses GPT-4o with EU GRI (General Rules of Interpretation) engine to classify products
- **Image Upload & OCR**: 
  - Upload product label or ingredient list images
  - Automatic OCR and data extraction using OpenAI Vision
  - Auto-fills classification form with extracted data
  - Extracts: product name, description, materials, composition, specifications, intended use, origin country
- **Interactive Refinement Questions**: 
  - AI detects classification ambiguity
  - Displays targeted questions to refine classification
  - User answers update classification in real-time
- **Multi-Candidate Display**: 
  - Shows top 3-5 classification candidates with confidence scores
  - Displays CN codes, duty rates, VAT rates, and precedents
  - Visual code formatting (e.g., `2008 19 13`)
- **RAG-Enhanced Search**: 
  - Vector search on legal documents (Regulation EU 2021/1832)
  - Retrieves relevant legal chunks using pgvector
  - Combines LLM knowledge with legal sources
- **Chapter Validation**: 
  - Validates extracted codes against product type
  - Filters out codes from irrelevant chapters
  - Prioritizes LLM knowledge over RAG when appropriate
- **CN Code Normalization**: 
  - Handles various formats (spaces, dots, dashes)
  - Ensures 8-digit codes for EU classification
  - Constructs codes from chapter/heading/subheading if needed

**Technical Details**:
- Uses OpenAI `text-embedding-3-small` for embeddings
- PostgreSQL with pgvector for vector similarity search
- Priority-based code selection (LLM → Constructed → RAG → Fallback)

---

### 2. Defense Dossier Generation

**Location**: `/classify/[classificationId]/dossier`

**Features**:
- **One-Click Generation**: Generate comprehensive defense dossier from classification
- **Legal Rationale**: AI-generated explanation using GRI rules
- **Source Attribution**: 
  - Citations from legal notes, binding rulings, TARIC measures
  - Reference IDs and excerpts
- **GRI Reasoning Trail**: Step-by-step classification logic
- **Distinctions**: Why this heading over competing headings
- **Key Features**: Product characteristics supporting classification
- **Duty Rate Information**: 
  - MFN duty rates (7.5-12% for Chapter 20, etc.)
  - VAT rates
  - Additional measures (anti-dumping, etc.)
- **HTML/PDF Export**: Downloadable dossier for audit defense

**Technical Details**:
- Stores dossiers in Supabase Storage (`dossiers` bucket)
- SHA256 hash for integrity verification
- Links to classification for traceability

---

### 3. Compliance Q&A Chat

**Location**: `/compliance-chat` and `/compliance-chat/[sessionId]`

**Features**:
- **ChatGPT-Style Interface**: 
  - Multiple chat sessions with unique IDs
  - Session-based routing
  - Collapsible sidebar for session list
- **RAG-Powered Responses**: 
  - Searches legal documents and binding rulings
  - Provides source citations with excerpts
  - Collapsible source sections
- **Session Management**: 
  - Create new chat sessions
  - Switch between sessions
  - Persistent message history
- **Mobile Responsive**: 
  - Collapsible sidebar with menu button
  - Responsive layout for mobile/desktop

**Technical Details**:
- Vector search on `LegalSourceChunk` and `BindingRuling` tables
- OpenAI GPT-4o for response generation
- Markdown rendering for assistant messages

---

### 4. Audit Dashboard

**Location**: `/dashboard`

**Features**:
- **Audit Readiness Score**: Overall compliance health metric
- **Key Metrics**:
  - Approved classifications count
  - Pending reviews count
  - Missing reasonings count
  - Auto-classified products count
  - Rulings matched count
- **Action Items**: 
  - Products missing dossiers
  - Classifications requiring review
  - Missing reasoning trails
- **Recent Classifications**: 
  - Latest 5 classifications with status
  - Quick access to dossiers
  - Delete functionality
- **Recent Shipments**: 
  - Latest 5 shipments with status
  - Quick navigation to shipment details
- **Missing Dossiers Page**: 
  - Dedicated view for products without dossiers
  - Bulk actions (future)

**Technical Details**:
- Real-time data aggregation
- Status badges and visual indicators
- Quick action buttons

---

### 5. Compliance Vault

**Location**: `/vault`

**Features**:
- **Supplier Link Generation**: 
  - Generate secure upload links for suppliers
  - Token-based access (no login required)
  - Expiring links for security
- **File Management**: 
  - Upload documents (MSDS, invoices, certificates, photos, specs)
  - Tag files (LAB_TEST, INVOICE, PHOTO, SPEC, OTHER)
  - Link files to products
  - View file metadata (size, type, upload date)
- **Compliance Timeline**: 
  - Track document uploads over time
  - Link documents to shipments/classifications
- **Audit Export**: 
  - Generate audit package (manifest + file references)
  - Export all dossiers and evidence files
  - ZIP export capability (requires `jszip`)

**Technical Details**:
- Supabase Storage integration (`vault-files` bucket)
- SHA256 hashing for integrity
- RLS policies for secure access

---

### 6. Shipment Management

**Location**: `/shipments`, `/shipments/new`, `/shipments/[shipmentId]`

**Features**:
- **Create Shipments**: 
  - Import/Export types
  - Origin/destination countries
  - Shipping dates, arrival dates
  - Customs declaration numbers
  - Invoice values, total duty
  - Incoterms, carrier, freight forwarder
  - Notes and metadata
- **Shipment Items**: 
  - Add products to shipments
  - Link to classifications
  - Quantity, unit value
  - CN/HS/HTS codes
  - Duty rates per item
- **Shipment Status Tracking**: 
  - DRAFT, IN_TRANSIT, CLEARED, AUDITED, DISPUTED, CANCELLED
  - Status updates and history
- **Document Management**: 
  - Upload shipment documents
  - Types: CUSTOMS_DECLARATION, INVOICE, CERTIFICATE, CLEARANCE, etc.
  - Link documents to shipments
- **Shipment Details View**: 
  - Complete shipment information
  - Itemized list with classifications
  - Document attachments
  - Status timeline

**Technical Details**:
- Full CRUD operations
- Links to products and classifications
- Document storage in Supabase

---

### 7. Ruling Database

**Location**: `/rulings` and `/rulings/[rulingId]`

**Features**:
- **Binding Rulings Search**: 
  - Search by market, HTS code, reference
  - Vector search on ruling content
  - Filter by market (US, EU, UK, VN, CA, AU, OTHER)
- **Ruling Details**: 
  - View full ruling text
  - Reference ID, issue date
  - Associated HTS codes
  - Related classifications
- **Ruling Matching**: 
  - Automatic matching to classifications
  - Display matched rulings in classification results

**Technical Details**:
- Vector embeddings for semantic search
- Market-specific filtering
- Links to classifications

---

### 8. Audit Log

**Location**: `/audit-log`

**Features**:
- **Activity Tracking**: 
  - All user actions logged
  - Entity type and ID tracking
  - Action descriptions
  - Timestamps
  - User attribution
- **Filtering**: 
  - Filter by entity type
  - Filter by action
  - Filter by user
  - Date range filtering
- **Audit Trail**: 
  - Complete history of changes
  - Payload data for debugging
  - Organization-scoped

**Technical Details**:
- JSON payload storage
- Indexed for performance
- User and organization scoped

---

### 9. Organization & User Management

**Location**: `/settings`, `/select-organization`

**Features**:
- **Multi-Organization Support**: 
  - Users can belong to multiple organizations
  - Organization switcher in sidebar
  - Primary organization selection
- **Membership Roles**: 
  - OWNER: Full access
  - ADMIN: Management access
  - CONTRIBUTOR: Create/edit access
  - REVIEWER: Review-only access
  - VIEWER: Read-only access
- **Invitations**: 
  - Send email invitations
  - Token-based acceptance
  - Role assignment
  - Expiring invitations
- **Organization Settings**: 
  - Organization name, logo
  - Timezone settings
  - Member management
- **User Profile**: 
  - Full name, email
  - Auth provider (Google OAuth)
  - Organization memberships

**Technical Details**:
- Supabase Auth integration
- Google OAuth provider
- Role-based access control (RBAC)

---

### 10. Entity Validation (Backend Ready)

**Location**: Backend API (UI pending)

**Features**:
- **VAT Validation (VIES)**: 
  - Validate EU VAT numbers
  - Real-time validation via EU VIES SOAP service
  - Returns company name and address
  - Batch validation support
  - All 27 EU member states + UK (XI)
- **EORI Validation**: 
  - Validate Economic Operator Registration and Identification numbers
  - UK EORI via HMRC API (REST)
  - EU EORI via national customs authorities
  - Format validation
  - Registration info lookup

**Technical Details**:
- VIES SOAP client (`src/lib/eu/vies-client.ts`)
- EORI client (`src/lib/eu/eori-client.ts`)
- Server actions ready (`src/server/actions/entity-validation.ts`)
- **Note**: UI components not yet built

---

## 🔧 Technical Infrastructure

### AI & Machine Learning
- **OpenAI Integration**:
  - GPT-4o for classification and rationale generation
  - GPT-4 Vision for image extraction
  - `text-embedding-3-small` for embeddings
- **Vector Search**:
  - PostgreSQL with pgvector extension
  - Cosine similarity search
  - Embeddings for legal documents and rulings

### Database (Prisma + PostgreSQL)
- **Models**: 20+ models covering:
  - Organizations, Users, Memberships
  - Products, Classifications, Dossiers
  - Shipments, ShipmentItems, ShipmentDocuments
  - LegalNotes, LegalSourceChunks, BindingRulings
  - ChatSessions, ChatMessages
  - VaultFiles, ProductImages
  - AuditLogs, DutySummaries, RiskFlags

### Storage (Supabase)
- **Buckets**:
  - `dossiers`: Defense dossier PDFs
  - `vault-files`: Compliance documents
  - `product-images`: Product label/ingredient images
  - `audit-packages`: Audit export ZIPs (future)

### External APIs
- **TARIC (EU Tariff)**: 
  - SOAP, REST, or MOCK providers
  - Duty rates, VAT rates, quotas
  - Additional measures (anti-dumping, etc.)
- **VIES (VAT Validation)**: 
  - EU VAT number validation
  - Public SOAP service
- **EORI Validation**: 
  - UK via HMRC API
  - EU via national authorities

---

## 📊 Data Models & Relationships

### Core Entities
```
Organization
├── Memberships (Users)
├── Products
├── Classifications
├── Shipments
├── VaultFiles
└── ChatSessions

Product
├── Materials (composition)
├── Classifications (per market)
├── Images (labels/ingredients)
├── ReferenceFiles
└── ShipmentItems

Classification
├── Product
├── Dossier
├── DutySummary
├── RiskFlags
├── Sources (legal citations)
└── ShipmentItems

Shipment
├── Items (products)
└── Documents
```

---

## 🚀 Planned Features (Not Yet Implemented)

### 1. Bulk Verification
- **Status**: Design complete, implementation pending
- **Features**:
  - Upload Excel/PDF with product data
  - Batch classification verification
  - Identify incorrect codes
  - Suggest fixes
  - Rate-limited parallel processing
  - See `docs/BULK_VERIFICATION_OPTIMIZATION_STRATEGY.md`

### 2. VAT/EORI Validation UI
- **Status**: Backend ready, UI pending
- **Features**:
  - VAT validator page/widget
  - EORI validator page/widget
  - Batch validation
  - Save to supplier/customer records

### 3. Supplier Management
- **Status**: Not started
- **Features**:
  - Add/edit suppliers
  - Validate supplier VAT
  - Link suppliers to products
  - View supplier documents

### 4. Customer Management
- **Status**: Not started
- **Features**:
  - Add/edit customers
  - Validate customer VAT
  - Track B2B transactions
  - Reverse charge management

### 5. PDF Generation
- **Status**: HTML dossiers ready, PDF pending
- **Features**:
  - Convert HTML dossiers to PDF
  - Use `pdfkit` or `puppeteer`
  - Branded templates

### 6. Advanced Analytics
- **Status**: Not started
- **Features**:
  - Classification accuracy metrics
  - Duty rate trends
  - Risk flag analysis
  - Compliance score trends

---

## 📁 File Structure

```
src/
├── app/(app)/
│   ├── dashboard/              # Audit dashboard
│   ├── classify/               # Classification & search
│   ├── compliance-chat/        # Q&A chat
│   ├── vault/                  # Compliance vault
│   ├── shipments/              # Shipment management
│   ├── rulings/                # Ruling database
│   ├── audit-log/              # Audit log
│   └── settings/               # Settings
├── components/
│   ├── classification/         # Classification UI
│   ├── compliance/             # Chat UI
│   ├── vault/                  # Vault UI
│   ├── shipments/              # Shipment UI
│   └── ui/                     # Shared UI components
├── server/
│   ├── actions/                # Server actions
│   └── queries/                # Database queries
└── lib/
    ├── eu/                     # EU classification engine
    ├── vision/                 # Image extraction
    └── supabase/               # Supabase client
```

---

## 🔐 Security & Compliance

- **Authentication**: Supabase Auth with Google OAuth
- **Authorization**: Role-based access control (RBAC)
- **Data Isolation**: Organization-scoped data access
- **File Security**: RLS policies on Supabase Storage
- **Audit Trail**: Complete activity logging
- **Data Integrity**: SHA256 hashing for files

---

## 📝 Notes

- **Market Support**: Currently focused on EU market, with infrastructure for US, UK, VN, CA, AU
- **Duty Rate Sources**: TARIC API (SOAP/REST/MOCK), with chapter-based fallbacks
- **Legal Sources**: Regulation (EU) 2021/1832, binding rulings, legal notes
- **AI Models**: GPT-4o for classification, GPT-4 Vision for images
- **Vector Database**: PostgreSQL with pgvector (no separate vector DB needed)

---

## 🎯 User Workflows

### 1. Classify a Product
1. Navigate to `/classify`
2. (Optional) Upload product image for auto-fill
3. Enter product details
4. Answer refinement questions if needed
5. Review classification candidates
6. Select top match → Generate dossier

### 2. Manage Shipment
1. Navigate to `/shipments/new`
2. Create shipment with details
3. Add products/items
4. Upload documents
5. Track status through lifecycle

### 3. Compliance Chat
1. Navigate to `/compliance-chat`
2. Ask questions about regulations
3. Review source citations
4. Create new sessions for different topics

### 4. Vault Management
1. Navigate to `/vault`
2. Generate supplier upload link
3. Share link with supplier
4. Review uploaded documents
5. Link to products/shipments

---

*Last Updated: 2025-01-15*

