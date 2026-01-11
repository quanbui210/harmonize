# EU Classification Engine

This module implements the EU-focused tri-layer intelligence model for CN (Combined Nomenclature) classification.

## Architecture

### Layer 1: Real-Time API Layer (TARIC)
- **TARIC Client** (`taric-client.ts`): Fetches duty rates, VAT rates, quotas, and additional measures from EU TARIC system
- **Three provider modes:**
  1. **SOAP** (Official EU): Free but requires EU Login (ECAS) and DDS2 registration. Uses WSDL endpoints.
  2. **REST** (Third-party): Easier integration via aggregators like Taric Support, TariffApi. Requires API key and subscription.
  3. **MOCK** (Development): Returns mock data for testing without API calls.
- Configure via `TARIC_PROVIDER` environment variable

### Layer 2: Internal Knowledge & Logic (GRI Engine)
- **GRI Engine** (`gri-engine.ts`): Implements General Rules of Interpretation (GRI 1-6) decision tree
- Searches legal notes and chapter/heading descriptions
- Applies hierarchical classification: Chapter → Heading → Subheading
- Returns confidence scores and excluded options

### Layer 3: AI-Powered Analysis
- **OpenAI Service** (`openai-service.ts`): Uses GPT-4o for:
  - Product attribute extraction
  - Chapter suggestion with reasoning
  - Reasoning Dossier generation
- **Classification Engine** (`classification-engine.ts`): Orchestrates all layers

## Usage

### Classify a Product for EU

```typescript
import { classifyProductForEUAction } from "@/server/actions/eu-classification";

const result = await classifyProductForEUAction(productId, organizationId);
// Returns: { classification, cnCode, confidence, sources, riskFlags }
```

### Generate Reasoning Dossier

```typescript
import { generateReasoningDossierAction } from "@/server/actions/eu-classification";

const dossier = await generateReasoningDossierAction(classificationId, organizationId);
// Creates PDF dossier with full legal reasoning
```

## CN Code Format

EU uses 8-digit CN codes (Combined Nomenclature):
- First 2 digits: Chapter (01-97)
- Next 2 digits: Heading (within chapter)
- Next 2 digits: Subheading (within heading)
- Last 2 digits: CN subheading (EU-specific)

Example: `8471.30.00` = Automatic data processing machines, portable

## Data Sources

1. **TARIC**: Duty rates, VAT, quotas, anti-dumping measures
2. **Legal Notes**: Chapter and heading notes from EU Combined Nomenclature
3. **Binding Rulings**: EU customs authority rulings (stored in `BindingRuling` table)
4. **OpenAI**: Product analysis and dossier generation

## Environment Variables

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# TARIC Configuration
TARIC_PROVIDER=MOCK  # Options: "SOAP", "REST", or "MOCK"
# For SOAP (official EU TARIC):
TARIC_WSDL_URL=https://ec.europa.eu/taxation_customs/dds2/wsdl/taric.wsdl
# For REST (third-party aggregators):
TARIC_API_KEY=your-api-key
TARIC_REST_API_URL=https://api.taricsupport.com/v1
```

### TARIC Provider Comparison

| Provider | Cost | Complexity | Setup Required |
|----------|------|------------|----------------|
| **SOAP** (Official) | Free | High (WSDL/SOAP) | EU Login + DDS2 registration |
| **REST** (Third-party) | Paid subscription | Low (REST/JSON) | API key from aggregator |
| **MOCK** | Free | None | None (development only) |

**Recommendation**: Start with `MOCK` for development, then switch to `REST` for production (easier) or `SOAP` if you need official EU data and can handle the complexity.

## Entity Validation Services

### VIES (VAT Validation)
- **Public SOAP service** - No API key required
- Validates EU VAT numbers in real-time
- Returns company name and address if valid
- Endpoint: `http://ec.europa.eu/taxation_customs/vies/services/checkVatService`

```typescript
import { validateVATAction } from "@/server/actions/entity-validation";

const result = await validateVATAction("FR", "12345678901");
// Returns: { valid: boolean, name?: string, address?: string, ... }
```

### EORI (Economic Operator ID)
- **Requires registration** with national customs authority
- Validates EORI numbers for customs declarations
- Returns company status (ACTIVE, SUSPENDED, REVOKED)
- Register via: French Douanes, German Zoll, or your national authority

```typescript
import { validateEORIAction, getEORIRegistrationInfoAction } from "@/server/actions/entity-validation";

const result = await validateEORIAction("FR123456789012");
const info = await getEORIRegistrationInfoAction("FR");
// Returns registration instructions for your country
```

## Next Steps

1. **RAG Pipeline**: Add vector embeddings for semantic search of rulings and notes
2. **Search Grounding**: Integrate Google Search for recent EU customs rulings
3. **Legal Notes Ingestion**: Populate `LegalNote` table with EU Combined Nomenclature notes
4. **TARIC Integration**: Connect to official DDS2 SOAP service or third-party aggregator

