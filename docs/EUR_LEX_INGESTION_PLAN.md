# EUR-Lex Document Ingestion Plan

## 🎯 Goal
Parse EUR-Lex documents (like Regulation 2021/1832) to extract:
1. **CN Code Descriptions** - Official product descriptions for each 8-digit CN code
2. **Legal Notes** - Chapter notes, heading notes, subheading notes
3. **Binding Rulings** - BTI (Binding Tariff Information) decisions

## 📋 What You Have Access To

From EUR-Lex, you can access:
- **Commission Implementing Regulations** - Updates to the Combined Nomenclature
- **Official Journal (OJ)** - Published in all EU languages
- **HTML/PDF formats** - Structured and unstructured text

## 🚀 Recommended Approach

### Option 1: Start with Official CN Code List (Recommended)
**Don't download all documents yet!** Instead:

1. **Get the official CN code list** from TARIC or EU Access2Markets
   - This gives you all 8-digit codes with descriptions
   - Much cleaner than parsing PDFs
   - Already structured

2. **Parse only the Legal Notes sections** from EUR-Lex
   - These are the explanatory notes that help with classification
   - Usually in Annex I or Annex II of regulations

3. **Scrape BTI database separately** for binding rulings
   - More efficient than parsing individual documents

### Option 2: Parse EUR-Lex Documents (If Option 1 doesn't work)

If you need to parse EUR-Lex documents:

1. **Start with ONE document** (like 2021/1832) as a test
2. **Extract structure:**
   - CN codes (8-digit numbers)
   - Descriptions (text after each code)
   - Legal notes (marked sections)
3. **Create parser script** that can handle:
   - HTML format (easier to parse)
   - PDF format (harder, but more complete)
4. **Ingest into database** using existing actions

## 📊 Data Structure

### CN Code Descriptions
```
CN Code: 9019.10.00
Description: "Mechano-therapy appliances; massage apparatus; psychological aptitude-testing apparatus"
```

### Legal Notes
```
Chapter 90, Note 1:
"Medical, surgical, dental or veterinary instruments and apparatus (heading 9018) are excluded from this chapter."
```

### Binding Rulings
```
BTI Reference: DE/123/2021
CN Code: 9019.10.00
Product: "Electric neck massager"
Decision: Classified under 9019.10.00
```

## 🛠️ Implementation Steps

### Phase 1: Quick Win (Use TARIC API)
1. Use TARIC API to get CN code descriptions
2. Store in database
3. This fixes the "0000000000" issue immediately

### Phase 2: Legal Notes (Parse EUR-Lex)
1. Download one regulation (2021/1832) in HTML format
2. Parse legal notes sections
3. Extract chapter/heading notes
4. Ingest into `LegalNote` table

### Phase 3: Full Database (Future)
1. Set up automated sync
2. Parse all regulations
3. Keep database updated

## 💡 My Recommendation

**Start with TARIC API for CN descriptions** (fastest fix)
- TARIC API can give you descriptions for any CN code
- No parsing needed
- Real-time data

**Then parse EUR-Lex for legal notes** (better classification)
- These help the GRI engine make better decisions
- More complex but necessary for accuracy

**Don't download all documents yet** - start with one, test the parser, then scale up.

