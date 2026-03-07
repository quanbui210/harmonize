# TulliCheck Use Cases: VAT, TARIC, and EORI Explained

## Real-World Scenarios for Importers & Exporters

---

## Scenario 1: Vietnam Seller → EU Buyer (Non-EU to EU)

**Example:** You're a Vietnamese manufacturer selling electronics to EU customers.

### 🎯 **TARIC (Tariff Classification) - PRIMARY USE**

**When you need it:**
- Your Vietnamese factory ships products to EU customers
- EU customs needs to know the **HTS/CN code** to calculate duties
- You need to provide correct classification on shipping documents

**What TulliCheck does:**
1. You input: "Wireless Bluetooth headphones with lithium battery"
2. AI classifies: `CN Code 8518.30.00` (Headphones, earphones)
3. TARIC provides: **Duty rate: 0%** (Free for this category)
4. You generate a **Defense Dossier** proving this classification is correct

**Why it matters:**
- ✅ Correct classification = correct duty rate
- ✅ Wrong classification = customs delays, penalties, or overpayment
- ✅ Defense Dossier protects you if customs challenges your classification

### 🆔 **EORI (Economic Operator ID) - REQUIRED**

**When you need it:**
- Your EU customer (or their customs broker) needs an EORI number to clear customs
- If you're shipping directly to EU consumers, you may need your own EORI

**What TulliCheck does:**
- Validates your customer's EORI number before shipping
- Ensures customs clearance won't be delayed due to invalid EORI

**Why it matters:**
- ❌ Invalid EORI = customs won't release goods
- ✅ Valid EORI = smooth customs clearance

### 💰 **VAT (VIES) - CONDITIONAL**

**When you need it:**
- **B2B sales only**: If your EU customer is a business (not consumer)
- You need to verify their VAT number for **reverse charge** mechanism

**Example:**
- Customer: German company with VAT `DE123456789`
- You validate: ✅ Valid → Apply reverse charge (customer pays VAT, not you)
- You validate: ❌ Invalid → You must charge VAT yourself

**Why it matters:**
- B2B: Customer handles VAT (reverse charge) - you don't charge VAT
- B2C: You must charge VAT and register for VAT in EU
- Invalid VAT = You're responsible for VAT payment

---

## Scenario 2: EU Seller Importing from Asia → Selling Within EU

**Example:** You're a French e-commerce company importing products from China, then selling to EU customers.

### 🎯 **TARIC (Tariff Classification) - CRITICAL**

**When you need it:**
- **At import**: When goods arrive in EU from China
- **For customs declaration**: You must provide correct CN code
- **For duty calculation**: Customs calculates duties based on CN code

**What TulliCheck does:**
1. You classify: "Electric water kettle, 1.7L, stainless steel"
2. AI determines: `CN Code 8516.79.70` (Electric kettles)
3. TARIC shows: **Duty rate: 0%** (Free for this category)
4. You generate dossier for customs broker

**Why it matters:**
- ✅ Correct classification = Pay correct duties
- ✅ Wrong classification = Overpay duties OR customs penalties
- ✅ Defense Dossier = Proof if customs audits you later

**Real example from your Amazon invoice:**
- Product: "Amazon Basics portable stainless steel kettle, 1.7L"
- This was classified correctly → You paid correct VAT (25.5% Finland rate)
- If misclassified, you could face penalties

### 🆔 **EORI (Economic Operator ID) - MANDATORY**

**When you need it:**
- **Required for ALL imports** into EU
- You must have EORI before goods arrive
- Customs broker uses your EORI to clear goods

**What HarmonizeAI does:**
- Validates your EORI number
- Ensures it's active and correct format
- Stores in compliance vault for audit trail

**Why it matters:**
- ❌ No EORI = Goods stuck at customs
- ❌ Invalid EORI = Customs won't process declaration
- ✅ Valid EORI = Goods clear customs smoothly

### 💰 **VAT (VIES) - MULTIPLE USE CASES**

**Use Case A: Validating Your Suppliers (Asia → EU)**
- When importing from Asian suppliers who claim to be EU entities
- Verify if supplier has valid EU VAT number
- Example: Chinese supplier claims to have `DE123456789` → Validate it

**Use Case B: Validating Your Customers (EU → EU)**
- **B2B sales**: Validate customer VAT for reverse charge
  - Customer: `LU20260743` (Amazon EU) → Valid ✅
  - You don't charge VAT (customer handles it)
- **B2C sales**: No VAT validation needed (you charge VAT directly)

**Use Case C: Your Own VAT Registration**
- If you're selling B2C, you need your own EU VAT number
- Validate your own VAT number is active
- Required for VAT returns and compliance

---

## Scenario 3: EU Seller → EU Customer (Intra-EU Trade)

**Example:** You're a German company selling to French customers.

### 🎯 **TARIC - NOT NEEDED**
- No customs duties for intra-EU trade
- TARIC only applies to imports from outside EU

### 🆔 **EORI - NOT NEEDED**
- EORI only needed for imports/exports with non-EU countries
- Intra-EU trade doesn't require EORI

### 💰 **VAT (VIES) - ESSENTIAL**

**B2B Sales:**
- Validate customer VAT number
- Apply reverse charge mechanism
- Customer handles VAT in their country

**B2C Sales:**
- Charge VAT at your country's rate
- No VAT validation needed (consumers don't have VAT numbers)

---

## Summary Table

| Scenario | TARIC Needed? | EORI Needed? | VAT Validation Needed? |
|----------|---------------|--------------|------------------------|
| **Vietnam → EU (B2B)** | ✅ Yes (for customs) | ✅ Yes (customer's EORI) | ✅ Yes (customer VAT) |
| **Vietnam → EU (B2C)** | ✅ Yes (for customs) | ✅ Yes (your EORI) | ❌ No (you charge VAT) |
| **Asia → EU (Import)** | ✅ Yes (for customs) | ✅ Yes (your EORI) | ⚠️ Maybe (supplier VAT) |
| **EU → EU (B2B)** | ❌ No | ❌ No | ✅ Yes (customer VAT) |
| **EU → EU (B2C)** | ❌ No | ❌ No | ❌ No |

---

## How TulliCheck Helps in Each Scenario

### For Vietnam Seller → EU Buyer:

1. **Before Shipping:**
   - Validate customer's EORI number
   - Validate customer's VAT number (if B2B)
   - Classify product with TARIC to know duty rate

2. **During Shipping:**
   - Provide correct CN code on shipping documents
   - Include Defense Dossier for customs

3. **After Customs:**
   - Store all validation results in Compliance Vault
   - Export audit package if customs questions anything

### For EU Importer → EU Seller:

1. **Before Import:**
   - Classify product with TARIC
   - Know duty rate you'll pay
   - Validate your EORI is active
   - Generate Defense Dossier for customs broker

2. **At Import:**
   - Provide CN code to customs broker
   - Pay correct duties based on TARIC classification
   - Use Defense Dossier if customs challenges classification

3. **When Selling:**
   - Validate customer VAT (if B2B)
   - Apply correct VAT treatment
   - Store all records in Compliance Vault

---

## Real Example: Your Amazon Invoice

Looking at your Amazon invoice:

**Product:** Amazon Basics portable stainless steel kettle, 1.7L

**What happened:**
1. ✅ Product was correctly classified (some CN code)
2. ✅ VAT was calculated at 25.5% (Finland rate for this product)
3. ✅ Amazon EU's VAT number `LU20260743` is valid
4. ✅ You paid correct amount: €21.08 (€16.80 + €4.28 VAT)

**If TulliCheck was used:**
- You'd have a Defense Dossier proving the classification
- You'd have validated Amazon's VAT number
- All stored in Compliance Vault for audit protection

---

## Key Takeaways

1. **TARIC**: Always needed when importing goods into EU (from outside EU)
2. **EORI**: Always needed for imports/exports with non-EU countries
3. **VAT**: Needed for B2B transactions to verify reverse charge eligibility

**TulliCheck's value:**
- ✅ Prevents classification errors (saves money on duties)
- ✅ Validates business partners (prevents fraud)
- ✅ Creates audit trail (protects you from penalties)
- ✅ Generates Defense Dossiers (proves compliance)

