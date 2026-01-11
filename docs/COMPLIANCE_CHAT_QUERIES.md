# Compliance Q&A Chatbot - Useful Queries

The Compliance Q&A chatbot is powered by **COMMISSION IMPLEMENTING REGULATION (EU) 2021/1832** and can answer questions about EU customs classification, CN codes, GRI rules, and legal guidance.

## 📋 What Users Can Ask

### 1. **CN Code Queries**
Ask about specific 8-digit Combined Nomenclature codes:

- `"What is CN code 8806 00 00?"`
- `"What does CN code 9503 00 00 cover?"`
- `"Explain CN code 9019 10 00"`
- `"What is the description for 88060000?"` (works with or without spaces/dots)

**What you'll get:**
- Official product description
- Relevant legal notes
- Classification guidance

---

### 2. **GRI Rules (General Rules of Interpretation)**
Ask about how GRI rules work:

- `"How does GRI 1 work?"`
- `"What is GRI 3 about sets?"`
- `"Explain GRI 2"`
- `"What does GRI 4 say about most specific description?"`
- `"How to apply GRI 5 for packing?"`
- `"What is GRI 6?"`

**What you'll get:**
- Step-by-step explanation of the GRI rule
- How it applies to classification
- Examples from the regulation

---

### 3. **Chapter Notes**
Ask about notes for specific chapters:

- `"What are the notes for Chapter 88?"`
- `"What exclusions apply to Chapter 90?"`
- `"Explain Chapter 84 notes"`
- `"What is excluded from Chapter 95?"`

**What you'll get:**
- Chapter-specific legal notes
- Exclusions and inclusions
- Special provisions

---

### 4. **Heading Notes**
Ask about specific heading-level guidance:

- `"What exclusions apply to heading 8806?"`
- `"What are the notes for heading 9503?"`
- `"Explain heading 9019 notes"`

**What you'll get:**
- Heading-specific legal notes
- Distinctions between similar headings
- Classification boundaries

---

### 5. **Classification Guidance**
Ask how to classify specific products or understand differences:

- `"How are drones classified?"`
- `"What is the difference between heading 8806 and 9503?"`
- `"How do I classify a textile product?"`
- `"What CN code applies to electronic devices?"`
- `"How are incomplete products classified?"`

**What you'll get:**
- Classification logic
- Distinctions between competing headings
- Step-by-step guidance

---

### 6. **End-Use Provisions**
Ask about special end-use arrangements:

- `"What are end-use arrangements?"`
- `"What products qualify for civil aircraft end-use?"`
- `"How does end-use relief work?"`
- `"What is the end-use procedure?"`

**What you'll get:**
- End-use provisions from the regulation
- Qualification criteria
- Procedural requirements

---

### 7. **General Rules & Concepts**
Ask about general classification concepts:

- `"What is the packing rule?"`
- `"How are sets classified?"`
- `"What is the most specific description rule?"`
- `"How are incomplete products classified?"`
- `"What is the essential character rule?"`

**What you'll get:**
- Explanation of general rules
- How they apply in practice
- Legal citations

---

### 8. **Special Provisions**
Ask about special arrangements and provisions:

- `"What are the special provisions for certain countries?"`
- `"What is the inward processing procedure?"`
- `"How does temporary admission work?"`

**What you'll get:**
- Special provisions from the regulation
- Qualification requirements
- Procedural details

---

## 🎯 Example Use Cases

### Use Case 1: Classifying a Drone
**User asks:** `"How are drones classified?"`

**Chatbot provides:**
- CN code 8806 00 00 (Unmanned aircraft)
- GRI rule application
- Distinction from heading 9503 (toys)
- Legal rationale

---

### Use Case 2: Understanding GRI 3
**User asks:** `"What is GRI 3 about sets?"`

**Chatbot provides:**
- Full text of GRI 3 from the regulation
- How it applies to sets of goods
- Examples and case studies
- Step-by-step application

---

### Use Case 3: Checking CN Code Description
**User asks:** `"What is CN code 8806 00 00?"`

**Chatbot provides:**
- Official product description
- Relevant chapter/heading notes
- Any special provisions
- Source citation (section path)

---

## 🔍 How It Works

1. **Keyword Search**: The chatbot searches `LegalSourceChunk` table for relevant content
2. **Smart Matching**: 
   - Extracts CN codes (e.g., "8806 00 00" → "88060000")
   - Detects GRI rules (e.g., "GRI 1" → searches sectionPath)
   - Finds chapter numbers (e.g., "Chapter 88")
3. **AI Synthesis**: OpenAI GPT-4o generates a clear answer from the legal sources
4. **Source Attribution**: Each answer includes citations with section paths and page numbers

---

## 📚 Data Source

All answers are based on:
- **Regulation (EU) 2021/1832**: COMMISSION IMPLEMENTING REGULATION
- **Source**: EUR-Lex official database
- **Language**: English (EN)
- **Coverage**: 
  - Part One: General Rules for Interpretation
  - Part Two: Schedule of Customs Duties (CN codes)
  - Legal Notes: Chapter and heading notes

---

## 🚀 Future Enhancements

- **Vector Search**: Upgrade to semantic similarity search when embeddings are populated
- **Multi-language**: Support for other EU languages (FR, DE, etc.)
- **BTI Integration**: Include Binding Tariff Information decisions
- **Classification History**: Link answers to user's classification history
- **Export Answers**: Download answers as PDF for audit documentation

---

## 💡 Tips for Best Results

1. **Be Specific**: Ask about specific CN codes, GRI rules, or chapters
2. **Use Official Terms**: Use terms like "GRI 1", "Chapter 88", "heading 8806"
3. **Ask Follow-ups**: The chatbot remembers context within a session
4. **Check Sources**: Always review the source citations for accuracy
5. **Combine Queries**: Ask multiple related questions to get comprehensive answers

---

## 📞 Support

If the chatbot can't find an answer:
- Try rephrasing your question
- Use more specific terms (CN codes, GRI numbers, chapter numbers)
- Check that your question relates to Regulation (EU) 2021/1832
- Contact support if you need help with other regulations

