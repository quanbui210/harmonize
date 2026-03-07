# TulliCheck - App Features & Documentation

## Overview

TulliCheck is a comprehensive customs classification and compliance management platform designed to help businesses accurately classify products, generate compliant labels, manage shipments, and maintain audit-ready documentation for customs authorities.

## 🧭 Navigation Structure

The application is structured around a primary sidebar navigation that categorizes features into core workflows and management tools.

### Primary Navigation

1.  **Audit Dashboard** (`/dashboard`)
2.  **Classify & Search** (`/classify`)
3.  **Product Labels** (`/labels`)
4.  **Compliance Vault** (`/vault`)
5.  **Compliance Q&A** (`/compliance-chat`)
6.  **Ruling Database** (`/rulings`)

### Secondary Navigation

7.  **Shipments** (`/shipments`)
8.  **Audit Log** (`/audit-log`)
9.  **Settings** (`/settings`)
10. **Support Center** (`/support`)

### Quick Actions
- **New Classification**: Quickly start the classification wizard.
- **New Label**: Create a new product label from an image or template.
- **Request Docs**: Generate a secure link to request documents from suppliers.

---

## 🎯 Feature Details

### 1. Audit Dashboard
**Location**: `/dashboard`

**Purpose**: Provides a high-level view of compliance health and pending actions.

**Key Features**:
-   **Audit Readiness Score**: Real-time score based on classification coverage and dossier completeness.
-   **Action Items**: Alerts for products missing dossiers or requiring review.
-   **Metrics**: Counts for approved classifications, pending reviews, and missing reasonings.
-   **Recent Activity**: Quick access to recently classified products and shipments.
-   **Visualizations**: Charts showing compliance trends and readiness.

### 2. Classify & Search
**Location**: `/classify`

**Purpose**: The core engine for determining the correct CN/HTS codes for products.

**Key Features**:
-   **AI-Powered Classification**: Uses GPT-4o with EU GRI (General Rules of Interpretation) logic.
-   **Image Analysis**: Upload product images or labels for auto-extraction of details using OCR.
-   **Interactive Refinement**: AI asks clarifying questions to resolve ambiguities (e.g., "Is this for medical or general use?").
-   **RAG-Enhanced Search**: vector search against legal regulations (EU 2021/1832) to find relevant precedents.
-   **Results Display**: Shows top candidates with confidence scores, duty rates, and VAT rates.
-   **Dossier Generation**: One-click generation of a "Defense Dossier" (`/classify/[id]/dossier`) which serves as legal proof of due diligence.

### 3. Product Labels
**Location**: `/labels`

**Purpose**: Generate and validate product labels for EU compliance (specifically FI/SV markets).

**Key Features**:
-   **Label Wizard**: Step-by-step process to create compliant labels.
    -   **Step 1**: Upload label image for OCR or manual entry. Auto-fills fields like ingredients, net quantity, and best-before dates.
    -   **Step 2**: Compliance analysis and preview.
-   **AI Compliance Check**: Analyzes label content against EU regulations (e.g., allergen highlighting, language requirements).
-   **Format Support**: Generates labels in standard sizes (100x150mm, etc.).
-   **Export**: Download labels as PDF or SVG.
-   **Management**: View and edit previously generated labels and their compliance scores.

### 4. Compliance Vault
**Location**: `/vault`

**Purpose**: Secure storage for all compliance-related documentation.

**Key Features**:
-   **Supplier Portal**: Generate secure, time-limited links for suppliers to upload documents directly (no login required for suppliers).
-   **Document Management**: Store and tag files (MSDS, Lab Tests, Invoices, Certificates).
-   **Audit Trail**: Immutable logs of file uploads and access.
-   **Audit Export**: Generate a comprehensive ZIP package containing all dossiers and evidence files for a specific period or product, ready for customs inspection.

### 5. Compliance Q&A
**Location**: `/compliance-chat`

**Purpose**: An AI assistant for regulatory questions.

**Key Features**:
-   **Regulatory Knowledge Base**: RAG (Retrieval-Augmented Generation) system indexed on EU customs regulations and binding rulings.
-   **Citations**: Answers include direct references to legal texts and source documents.
-   **Session Management**: Save and review past conversations.

### 6. Ruling Database
**Location**: `/rulings`

**Purpose**: Searchable database of Binding Tariff Information (BTI) rulings.

**Key Features**:
-   **Semantic Search**: Find rulings based on product descriptions, not just keywords.
-   **Market Filtering**: Filter rulings by jurisdiction (EU, UK, US, etc.).
-   **Linkage**: Associate relevant rulings with your own product classifications to strengthen defense dossiers.

### 7. Shipments
**Location**: `/shipments`

**Purpose**: Track physical movement of goods and associate them with compliance data.

**Key Features**:
-   **Shipment Tracking**: Manage import/export workflows.
-   **Item Linkage**: Connect shipment line items to classified products.
-   **Document Association**: Attach invoices and clearance documents to specific shipments.
-   **Status Workflow**: Track shipments from Draft -> In Transit -> Cleared -> Audited.

### 8. Audit Log
**Location**: `/audit-log`

**Purpose**: System-wide logging for security and accountability.

**Key Features**:
-   **Activity Feed**: Chronological list of all user actions (create, update, delete).
-   **User Attribution**: See who did what and when.
-   **Filtering**: Search logs by user, action type, or date.

### 9. Settings
**Location**: `/settings`

**Purpose**: Configuration for the organization and user.

**Key Features**:
-   **Organization Profile**: Manage name, logo, and primary market settings.
-   **Team Management**: Invite users and assign roles (Owner, Admin, Contributor, Viewer).
-   **User Profile**: Manage personal account details.

---

## 🔧 Technical Flow

### Classification Flow
1.  **Input**: User provides text description or image.
2.  **Processing**:
    -   Image -> OCR -> Text Extraction.
    -   Text -> Vector Embedding -> RAG Search (Legal DB).
    -   LLM Analysis (GPT-4o) combines user input + RAG context + GRI rules.
3.  **Output**: Ranked classification candidates with reasoning.
4.  **Refinement**: If confidence is low, dynamic questions are generated.
5.  **Finalization**: User selects code -> System generates Defense Dossier (PDF).

### Label Generation Flow
1.  **Input**: Image upload or manual data entry.
2.  **Extraction**: OCR extracts text, identifying key fields (Ingredients, Nutrition, Dates).
3.  **Validation**: AI checks against specific EU labeling regulations (e.g., "Is 'Gluten' bolded?").
4.  **Generation**: React component renders the label visually.
5.  **Export**: Server-side rendering to PDF/SVG for download.

### Authentication & Data
-   **Auth**: Supabase Auth (Google OAuth).
-   **Database**: PostgreSQL with Prisma ORM.
-   **Storage**: Supabase Storage for files (Dossiers, Images, Vault docs).
-   **Multi-tenancy**: All data is scoped by `OrganizationId`.

---

*Documentation generated based on codebase state as of Jan 2026.*
