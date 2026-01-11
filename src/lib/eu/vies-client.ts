import * as soap from "soap";

export interface VIESCheckResult {
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  name?: string;
  address?: string;
  requestDate: Date;
  error?: string;
}

export class VIESClient {
  private wsdlUrl: string;

  constructor(wsdlUrl?: string) {
    this.wsdlUrl =
      wsdlUrl ||
      process.env.VIES_WSDL_URL ||
      "http://ec.europa.eu/taxation_customs/vies/services/checkVatService?wsdl";
  }

  async checkVAT(
    countryCode: string,
    vatNumber: string,
  ): Promise<VIESCheckResult> {
    try {
      const client = await soap.createClientAsync(this.wsdlUrl);

      const result = await new Promise<{
        countryCode: string;
        vatNumber: string;
        requestDate: string;
        valid: boolean;
        name?: string;
        address?: string;
      }>((resolve, reject) => {
        client.checkVat(
          {
            countryCode: countryCode.toUpperCase(),
            vatNumber: vatNumber.replace(/\s+/g, ""),
          },
          (err: Error | null, result: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(result as {
                countryCode: string;
                vatNumber: string;
                requestDate: string;
                valid: boolean;
                name?: string;
                address?: string;
              });
            }
          },
        );
      });

      const normalizeField = (value?: string) => {
        if (!value || value.trim() === "---" || value.trim() === "") {
          return undefined;
        }
        return value.trim();
      };

      return {
        valid: result.valid,
        countryCode: result.countryCode,
        vatNumber: result.vatNumber,
        name: normalizeField(result.name),
        address: normalizeField(result.address),
        requestDate: new Date(result.requestDate),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown VIES error";

      return {
        valid: false,
        countryCode: countryCode.toUpperCase(),
        vatNumber: vatNumber.replace(/\s+/g, ""),
        requestDate: new Date(),
        error: errorMessage,
      };
    }
  }

  async checkVATBatch(
    vatNumbers: Array<{ countryCode: string; vatNumber: string }>,
  ): Promise<VIESCheckResult[]> {
    const results = await Promise.all(
      vatNumbers.map((vat) =>
        this.checkVAT(vat.countryCode, vat.vatNumber),
      ),
    );

    return results;
  }

  validateCountryCode(countryCode: string): boolean {
    const validCodes = [
      "AT",
      "BE",
      "BG",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "EL",
      "ES",
      "FI",
      "FR",
      "HR",
      "HU",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SE",
      "SI",
      "SK",
      "XI",
    ];

    return validCodes.includes(countryCode.toUpperCase());
  }
}

export const viesClient = new VIESClient();


