# CN Code vs HTS Code - Explained

## Quick Answer

- **CN Code (Combined Nomenclature)**: EU system, **8 digits**
- **HTS Code (Harmonized Tariff Schedule)**: US system, **10 digits**
- **HS Code (Harmonized System)**: International base system, **6 digits**

## Detailed Explanation

### HS Code (Harmonized System)
- **6 digits** - International standard
- Used by most countries as a base
- First 2 digits = Chapter
- Next 2 digits = Heading
- Last 2 digits = Subheading
- Example: `9019.10` (Mechano-therapy appliances)

### CN Code (Combined Nomenclature) - EU
- **8 digits** - EU-specific extension of HS
- First 6 digits = HS code
- Next 2 digits = EU-specific subheadings
- Example: `9019.10.00` (Mechano-therapy appliances; massage apparatus)
- Used for EU customs classification and duty calculation

### HTS Code (Harmonized Tariff Schedule) - US
- **10 digits** - US-specific extension of HS
- First 6 digits = HS code
- Next 2 digits = US subheading
- Last 2 digits = Statistical suffix
- Example: `9019.10.00.00` (US version)
- Used for US customs classification

## In Our Application (HarmonizeAI)

Since we're focusing on **EU classification first**, we should be using:

✅ **CN Code (8 digits)** - This is what we classify
- Example: `90191000`
- Stored in database as `cnCode`

⚠️ **HTS Code (10 digits)** - We're padding CN codes to 10 digits for display
- Example: `9019100000` (CN code + 2 zeros)
- Stored in database as `htsCode`
- This is technically incorrect terminology for EU, but we're doing it for:
  1. Consistency with future US market support
  2. Display format (10 digits looks more complete)

## Current Implementation

In our codebase:
- **Classification Engine** returns `cnCode` (8 digits)
- **Database** stores both `cnCode` and `htsCode`
- **Display** shows `htsCode` (10 digits, padded from CN code)
- **TARIC API** uses CN codes (8 digits)

## Recommendation

For EU-only classification:
- Use **CN Code** terminology in UI
- Store as 8 digits
- Only pad to 10 digits if needed for display consistency

For multi-market support (future):
- Use **HS Code** (6 digits) as base
- Extend to **CN Code** (8 digits) for EU
- Extend to **HTS Code** (10 digits) for US

## Code References

- `src/lib/eu/types.ts` - Defines `CNCode` type
- `src/server/actions/classification-search.ts` - Pads CN to HTS: `cnCode.padEnd(10, "0")`
- `prisma/schema.prisma` - Stores both `htsCode` (String) and uses CN codes internally

