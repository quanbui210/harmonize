# HTS/CN Code Data Sources for EU Classification

## 🎯 What You Need for Journey 1 (Product Classification)

To properly classify products, you need:

1. **CN Code Descriptions** - What each code means (e.g., "8516.79.70 = Electric kettles")
2. **Legal Notes** - Chapter and heading notes that explain classification rules
3. **Binding Rulings** - Precedents from EU customs authorities
4. **TARIC Data** - Duty rates (already handled via TARIC API)

---

## 📚 Official EU Data Sources

### 1. EU Combined Nomenclature (CN) - Official Tariff

**What it is:** The complete EU tariff with all CN codes and descriptions.

**Where to get it:**
- **Official Source:** European Commission - TARIC database
- **URL:** https://ec.europa.eu/taxation_customs/dds2/taric/
- **Format:** XML, CSV, or via TARIC API

**What you get:**
- All 8-digit CN codes
- Descriptions for each code
- Chapter and heading structure
- Updated annually (new version each January)

**How to access:**
1. **Via TARIC API** (Recommended):
   - Use the TARIC client we built (`taric-client.ts`)
   - Set `TARIC_PROVIDER=REST` and get API key from Taric Support
   - They provide CN code descriptions via API

2. **Direct Download** (Manual):
   - Visit: https://ec.europa.eu/taxation_customs/dds2/taric/
   - Download XML/CSV files
   - Parse and ingest into database

### 2. EU Explanatory Notes

**What it is:** Detailed explanations of classification rules for each chapter/heading.

**Where to get it:**
- **Official Source:** European Commission
- **URL:** https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32021R1832
- **Format:** PDF or online database

**What you get:**
- Chapter notes (general rules)
- Heading notes (specific rules)
- Classification guidance
- Examples and exclusions

**How to access:**
- Download PDF from EUR-Lex
- Or use third-party services that parse and structure this data

### 3. EU Binding Tariff Information (BTI) Rulings

**What it is:** Official EU customs rulings on specific products.

**Where to get it:**
- **Official Source:** EU Binding Tariff Information database
- **URL:** https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_consultation.jsp
- **Format:** Web interface or database export

**What you get:**
- Ruling reference numbers (e.g., "DE123456")
- Product descriptions
- Assigned CN codes
- Legal reasoning
- Valid for 3-6 years

**How to access:**
1. **Manual Search:**
   - Visit the BTI database
   - Search by product or CN code
   - Copy relevant rulings

2. **Automated (Future):**
   - Some third-party services provide BTI databases
   - Or scrape/parse the official database

### 4. TARIC Database (Duty Rates)

**What it is:** Real-time duty rates, VAT rates, quotas, and measures.

**Where to get it:**
- ✅ **Already implemented** in `taric-client.ts`
- Use TARIC API (SOAP or REST)
- See `docs/API_ACCESS_GUIDE.md` for setup

---

## 🚀 Recommended Approach: Third-Party Aggregators

**For fastest setup, use third-party services that aggregate all this data:**

### Option 1: Taric Support API (Recommended)

**What they provide:**
- ✅ CN code descriptions
- ✅ Duty rates (TARIC)
- ✅ Legal notes (parsed)
- ✅ Binding rulings (some)

**How to get:**
1. Sign up: https://www.taricsupport.com/api
2. Get API key
3. Use their REST API to fetch:
   - CN code descriptions
   - Duty rates
   - Legal notes

**Cost:** Free trial, then €50-500/month

### Option 2: TariffApi

**What they provide:**
- ✅ CN code descriptions
- ✅ Duty rates
- ✅ Some legal notes

**How to get:**
1. Sign up: https://tariffapi.org
2. Get API key
3. Use their API

**Cost:** Free tier (100 requests/month), then $29+/month

### Option 3: Build Your Own Parser

**If you want to use official sources directly:**

1. **Download CN Tariff:**
   - Get from EU TARIC database
   - Parse XML/CSV
   - Ingest into `LegalNote` and create a new `CNCode` model

2. **Download Explanatory Notes:**
   - Get from EUR-Lex
   - Parse PDF or structured data
   - Ingest into `LegalNote` table

3. **Scrape BTI Rulings:**
   - Access BTI database
   - Extract rulings
   - Ingest into `BindingRuling` table

---

## 📥 How to Ingest Data into Your Database

### Step 1: Create Data Ingestion Scripts

I'll create scripts to help you ingest:

1. **CN Code Descriptions** → New table or enhance existing
2. **Legal Notes** → `LegalNote` table (already exists)
3. **Binding Rulings** → `BindingRuling` table (already exists)

### Step 2: Use the Ingestion Actions

**For Legal Notes:**
```typescript
import { ingestLegalNotesAction } from "@/server/actions/legal-notes";

await ingestLegalNotesAction([
  {
    chapter: 85,
    heading: 16,
    noteKey: "8516",
    content: "Electric kettles and other electro-thermic appliances..."
  }
]);
```

**For Binding Rulings:**
- Create similar action for `BindingRuling` table

### Step 3: Set Up Data Sync

**Option A: One-time import**
- Download data once
- Parse and ingest
- Update manually when needed

**Option B: Automated sync** (Future)
- Set up cron job
- Fetch from TARIC API regularly
- Update database automatically

---

## 🎯 What You Need Right Now

**For Journey 1 to work properly, you need:**

### Minimum Required:
1. ✅ **TARIC API access** - For duty rates (already set up)
2. ⚠️ **CN code descriptions** - Currently using AI + hardcoded examples
3. ⚠️ **Legal notes** - Database exists but empty
4. ⚠️ **Binding rulings** - Database exists but empty

### Current State:
- **GRI Engine:** Uses logic but no actual legal notes
- **AI Service:** Uses GPT-4o knowledge (good but not official)
- **TARIC Client:** Gets duty rates (if API key provided)
- **Legal Notes DB:** Empty (needs data ingestion)
- **Rulings DB:** Empty (needs data ingestion)

---

## 🛠️ Quick Start: Get CN Code Descriptions

### Option 1: Use TARIC API (Easiest)

1. **Sign up for Taric Support:**
   - Visit: https://www.taricsupport.com/api
   - Request free trial
   - Get API key

2. **Update your code:**
   - Set `TARIC_PROVIDER=REST` in `.env`
   - Add `TARIC_API_KEY=your-key`
   - Add `TARIC_REST_API_URL=https://api.taricsupport.com/v1`

3. **Enhance TARIC client:**
   - Add method to fetch CN code descriptions
   - Store in database or cache

### Option 2: Manual Download (Free but more work)

1. **Download CN Tariff:**
   - Visit: https://ec.europa.eu/taxation_customs/dds2/taric/
   - Download latest XML/CSV
   - Parse and ingest

2. **Create ingestion script:**
   - Parse XML/CSV
   - Extract CN codes and descriptions
   - Insert into database

---

## 📋 Next Steps

1. **Decide on data source:**
   - [ ] Use third-party API (Taric Support) - Easiest
   - [ ] Download official EU data - Free but more work
   - [ ] Hybrid approach - API for rates, manual for notes

2. **Set up data ingestion:**
   - [ ] Create CN code description table/model
   - [ ] Create ingestion scripts
   - [ ] Populate initial data

3. **Enhance classification:**
   - [ ] Update GRI engine to use real legal notes
   - [ ] Add CN code descriptions to results
   - [ ] Link to binding rulings

Would you like me to:
1. **Create a CN code description model** in Prisma?
2. **Build ingestion scripts** for legal notes and rulings?
3. **Enhance the TARIC client** to fetch descriptions?
4. **Set up a data sync system**?

Let me know which approach you prefer!

