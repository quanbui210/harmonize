# HarmonizeAI - Complete App Flow Guide

## 🎯 Main User Journeys

---

## Journey 1: Classify a Product & Generate Dossier

**When:** You need to import a product and want to know the correct HTS/CN code and duty rate.

### Step-by-Step Flow:

#### 1. **Navigate to Classification**
- **Where:** Click "Classify & Search" in sidebar (or `/classify`)
- **What you see:** Product input form

#### 2. **Enter Product Details**
- **Input fields:**
  - Product Name: `"Electric water kettle, 1.7L, stainless steel"`
  - Description: `"Portable electric kettle with auto-shutoff, 1700ml capacity"`
  - Intended Use: `"Household kitchen appliance"` (optional)
- **Click:** "Classify" button

#### 3. **AI Analysis & Refinement (if needed)**
- **What happens:**
  - AI analyzes your product
  - If classification is ambiguous, you see: **"ACTION REQUIRED"** box
  - Example question: `"Is this for medical therapy or general relaxation?"`
- **You do:** Select an answer (e.g., "General Relaxation")
- **System:** Re-classifies with your answer

#### 4. **View Classification Results**
- **What you see:** Top 3 HTS candidates with:
  - CN Code: `8516.79.70`
  - Confidence: `92% Match`
  - Duty Rate: `0%` (Free)
  - VAT Rate: `25.5%`
  - Precedent: `M932918` (if available)
- **You do:** Click **"Select & Create Dossier"** on the top match

#### 5. **Generate Defense Dossier**
- **Where:** `/classify/[id]/dossier` page
- **What you see:**
  - Product information summary
  - "Generate Defense Dossier" button
- **You do:** Click "Generate Defense Dossier"
- **System:** Creates PDF with GRI reasoning, legal citations, sources
- **Result:** Downloadable PDF dossier for customs audit protection

---

## Journey 2: Validate Supplier/Customer VAT Number

**When:** You're importing from an EU supplier or selling B2B to EU customers.

### Current Status: ⚠️ **Not Yet Built in UI**

**What we have:**
- ✅ Backend API ready (`validateVATAction`)
- ✅ VIES client working
- ❌ No UI component yet

### Proposed Flow (To Be Built):

#### Option A: Supplier Management Page
- **Where:** New page `/suppliers` or section in `/vault`
- **What you do:**
  1. Click "Add Supplier"
  2. Enter supplier details:
     - Company Name: `"Amazon EU S.à r.l."`
     - Country: `"Luxembourg"` (dropdown)
     - VAT Number: `"LU20260743"`
  3. Click "Validate VAT"
  4. **System shows:**
     - ✅ Valid: Company name and address
     - ❌ Invalid: Error message
  5. Save supplier with validation status

#### Option B: Quick Validation Tool
- **Where:** Dashboard widget or `/tools/vat-validator`
- **What you do:**
  1. Enter VAT number: `"LU20260743"`
  2. Select country: `"LU"`
  3. Click "Validate"
  4. **System shows:** Validation result with company details

---

## Journey 3: Validate EORI Number

**When:** You need to verify an EORI number for customs clearance.

### Current Status: ⚠️ **Not Yet Built in UI**

**What we have:**
- ✅ Backend API ready (`validateEORIAction`)
- ✅ EORI client ready
- ❌ No UI component yet

### Proposed Flow (To Be Built):

#### EORI Validator Page
- **Where:** `/tools/eori-validator` or in supplier management
- **What you do:**
  1. Enter EORI number: `"FR123456789012"`
  2. Click "Validate EORI"
  3. **System shows:**
     - ✅ Valid: Registration info, country, status
     - ❌ Invalid: Error message
  4. Save to compliance vault if valid

---

## Journey 4: Supplier Document Collection (Vault)

**When:** You need to collect compliance documents from suppliers (MSDS, invoices, etc.).

### Step-by-Step Flow:

#### 1. **Navigate to Compliance Vault**
- **Where:** Click "Compliance Vault" in sidebar (or `/vault`)
- **What you see:** Vault dashboard

#### 2. **Generate Supplier Link**
- **What you do:** Click "Send Secure Link" button
- **System generates:** Secure upload link
- **Example:** `http://localhost:3000/vault/upload/abc123?org=xyz`
- **You do:** Copy link and send to supplier via email

#### 3. **Supplier Uploads Documents**
- **Supplier receives:** Secure link
- **Supplier uploads:**
  - MSDS (Material Safety Data Sheet)
  - Invoices
  - Photos
  - Technical specifications
- **System:** Stores files with SHA-256 hash for integrity

#### 4. **View Uploaded Files**
- **Where:** Vault dashboard → "Vault Files" table
- **What you see:**
  - File name
  - Type (LAB_TEST, INVOICE, PHOTO, etc.)
  - Size
  - Upload date
  - Download button

#### 5. **Export Audit Package**
- **When:** Customs audits you (2 years later)
- **What you do:** Click "Generate Audit Zip"
- **System creates:** ZIP file with:
  - All dossiers
  - All supplier documents
  - Manifest (index of all files)
- **Result:** Complete audit package ready for customs

---

## Journey 5: Complete Import Workflow (End-to-End)

**Scenario:** You're importing "Electric water kettle" from China to sell in EU.

### Complete Flow:

#### Phase 1: Pre-Import Preparation

1. **Classify Product** (`/classify`)
   - Input: "Electric water kettle, 1.7L, stainless steel"
   - Get: CN Code `8516.79.70`, Duty Rate `0%`
   - Generate: Defense Dossier

2. **Validate Your EORI** (`/tools/eori-validator` - to be built)
   - Enter: Your EORI number
   - Verify: It's active and valid

3. **Validate Supplier VAT** (if supplier claims EU entity)
   - Enter: Supplier VAT number
   - Verify: It's valid (or catch fraud)

#### Phase 2: During Import

4. **Provide Documents to Customs Broker**
   - CN Code: `8516.79.70`
   - Defense Dossier: PDF proof of classification
   - EORI Number: Your validated EORI

5. **Customs Clears Goods**
   - Broker uses your CN code
   - Pays duties (if any)
   - Goods released

#### Phase 3: Post-Import Compliance

6. **Store Documents in Vault** (`/vault`)
   - Upload: Customs declaration
   - Upload: Shipping documents
   - Link: To your Defense Dossier

7. **If Customs Audits (Later)**
   - Go to: `/vault`
   - Click: "Generate Audit Zip"
   - Download: Complete package with all evidence

---

## Current App Structure

```
Dashboard (/dashboard)
├── Overview metrics
├── Action items (missing dossiers)
└── Quick access to classifications

Classify & Search (/classify)
├── Product input form
├── AI classification
├── Refinement questions (if needed)
├── HTS candidates display
└── → Generate Dossier button

Dossier Generation (/classify/[id]/dossier)
├── Product summary
├── Generate Defense Dossier button
└── Download PDF

Compliance Vault (/vault)
├── Supplier link generation
├── File upload management
├── Compliance timeline
└── Audit export

[TO BE BUILT]
├── VAT Validator (/tools/vat-validator)
├── EORI Validator (/tools/eori-validator)
└── Supplier Management (/suppliers)
```

---

## What's Missing (To Be Built)

### 1. **VAT Validation UI**
- **Where:** New page or widget
- **Input:** Country code + VAT number
- **Output:** Validation result with company details
- **Action:** Save to supplier/customer record

### 2. **EORI Validation UI**
- **Where:** New page or widget
- **Input:** EORI number
- **Output:** Validation result with registration info
- **Action:** Save to compliance vault

### 3. **Supplier Management**
- **Where:** New page `/suppliers`
- **Features:**
  - Add/edit suppliers
  - Validate supplier VAT
  - Link suppliers to products
  - View supplier documents

### 4. **Customer Management** (for B2B sellers)
- **Where:** New page `/customers`
- **Features:**
  - Add/edit customers
  - Validate customer VAT
  - Track B2B transactions
  - Reverse charge management

---

## Quick Reference: Where to Go For What

| What You Want to Do | Where to Go | Current Status |
|---------------------|-------------|----------------|
| **Classify a product** | `/classify` | ✅ Built |
| **Generate dossier** | `/classify/[id]/dossier` | ✅ Built |
| **Collect supplier docs** | `/vault` | ✅ Built |
| **Export audit package** | `/vault` → "Generate Audit Zip" | ✅ Built |
| **Validate VAT number** | `/tools/vat-validator` | ❌ Not built yet |
| **Validate EORI number** | `/tools/eori-validator` | ❌ Not built yet |
| **Manage suppliers** | `/suppliers` | ❌ Not built yet |
| **View dashboard** | `/dashboard` | ✅ Built |

---

## Recommended Next Steps

1. **Build VAT Validator UI** - Most requested feature
2. **Build EORI Validator UI** - Critical for imports
3. **Add Supplier Management** - Complete the compliance workflow
4. **Link Everything Together** - Connect classifications, suppliers, and validations

Would you like me to build the VAT/EORI validator UI components now?

