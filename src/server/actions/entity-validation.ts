"use server";

import { viesClient } from "@/lib/eu/vies-client";
import { eoriClient } from "@/lib/eu/eori-client";
import type { VIESCheckResult } from "@/lib/eu/vies-client";
import type { EORICheckResult } from "@/lib/eu/eori-client";

export async function validateVATAction(
  countryCode: string,
  vatNumber: string,
): Promise<VIESCheckResult> {
  if (!viesClient.validateCountryCode(countryCode)) {
    return {
      valid: false,
      countryCode: countryCode.toUpperCase(),
      vatNumber: vatNumber.replace(/\s+/g, ""),
      requestDate: new Date(),
      error: `Invalid EU country code: ${countryCode}. Must be a valid EU member state code.`,
    };
  }

  return viesClient.checkVAT(countryCode, vatNumber);
}

export async function validateVATBatchAction(
  vatNumbers: Array<{ countryCode: string; vatNumber: string }>,
): Promise<VIESCheckResult[]> {
  const invalid = vatNumbers.filter(
    (vat) => !viesClient.validateCountryCode(vat.countryCode),
  );

  if (invalid.length > 0) {
    return invalid.map((vat) => ({
      valid: false,
      countryCode: vat.countryCode.toUpperCase(),
      vatNumber: vat.vatNumber.replace(/\s+/g, ""),
      requestDate: new Date(),
      error: `Invalid EU country code: ${vat.countryCode}`,
    }));
  }

  return viesClient.checkVATBatch(vatNumbers);
}

export async function validateEORIAction(
  eoriNumber: string,
): Promise<EORICheckResult> {
  if (!eoriClient.validateEORIFormat(eoriNumber)) {
    const countryCode = eoriNumber.match(/^([A-Z]{2})/)?.[1] || "UNKNOWN";
    return {
      valid: false,
      eoriNumber,
      countryCode,
      requestDate: new Date(),
      error:
        "Invalid EORI format. EORI must start with 2-letter country code followed by alphanumeric characters (max 17 total).",
    };
  }

  return eoriClient.checkEORI(eoriNumber);
}

export async function getEORIRegistrationInfoAction(countryCode: string): Promise<{
  authority: string;
  website?: string;
  notes: string;
}> {
  return eoriClient.getRegistrationInfo(countryCode);
}

