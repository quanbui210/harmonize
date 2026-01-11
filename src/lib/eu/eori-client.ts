export interface EORICheckResult {
  valid: boolean;
  eoriNumber: string;
  countryCode: string;
  name?: string;
  address?: string;
  status?: "ACTIVE" | "SUSPENDED" | "REVOKED";
  requestDate: Date;
  error?: string;
}

export class EORIClient {
  private baseUrl: string;
  private apiKey?: string;
  private useMock: boolean;

  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    useMock?: boolean;
  }) {
    this.baseUrl =
      config?.baseUrl ||
      process.env.EORI_BASE_URL ||
      "https://ec.europa.eu/taxation_customs/dds2/eos";
    this.apiKey = config?.apiKey || process.env.EORI_API_KEY;
    this.useMock =
      config?.useMock ??
      process.env.NODE_ENV === "development" ||
      !this.apiKey;
  }

  async checkEORI(eoriNumber: string): Promise<EORICheckResult> {
    if (this.useMock) {
      return this.getMockEORIResult(eoriNumber);
    }

    if (!this.apiKey) {
      return {
        valid: false,
        eoriNumber,
        countryCode: this.extractCountryCode(eoriNumber),
        requestDate: new Date(),
        error:
          "EORI API key required. Register with your national customs authority (e.g., French Douanes, German Zoll) to obtain a technical certificate for the National Service Bus.",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/eori/${eoriNumber}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`EORI API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        valid: boolean;
        eoriNumber: string;
        countryCode: string;
        name?: string;
        address?: string;
        status?: string;
      };

      return {
        valid: data.valid,
        eoriNumber: data.eoriNumber,
        countryCode: data.countryCode,
        name: data.name,
        address: data.address,
        status: data.status as "ACTIVE" | "SUSPENDED" | "REVOKED" | undefined,
        requestDate: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown EORI error";

      return {
        valid: false,
        eoriNumber,
        countryCode: this.extractCountryCode(eoriNumber),
        requestDate: new Date(),
        error: errorMessage,
      };
    }
  }

  private extractCountryCode(eoriNumber: string): string {
    const match = eoriNumber.match(/^([A-Z]{2})/);
    return match ? match[1] : "UNKNOWN";
  }

  private getMockEORIResult(eoriNumber: string): EORICheckResult {
    const countryCode = this.extractCountryCode(eoriNumber);

    return {
      valid: countryCode !== "UNKNOWN" && eoriNumber.length >= 10,
      eoriNumber,
      countryCode,
      name: "Mock Company Name",
      address: "Mock Address",
      status: "ACTIVE",
      requestDate: new Date(),
    };
  }

  validateEORIFormat(eoriNumber: string): boolean {
    const eoriPattern = /^[A-Z]{2}[A-Z0-9]{1,15}$/;
    return eoriPattern.test(eoriNumber);
  }

  getRegistrationInfo(countryCode: string): {
    authority: string;
    website?: string;
    notes: string;
  } {
    const info: Record<
      string,
      { authority: string; website?: string; notes: string }
    > = {
      FR: {
        authority: "French Douanes",
        website: "https://www.douane.gouv.fr",
        notes: "Register via French customs portal to obtain EORI certificate",
      },
      DE: {
        authority: "German Zoll",
        website: "https://www.zoll.de",
        notes: "Register via German customs portal to obtain EORI certificate",
      },
      IT: {
        authority: "Italian Customs (Agenzia delle Dogane)",
        website: "https://www.agenziadogane.gov.it",
        notes: "Register via Italian customs portal",
      },
      ES: {
        authority: "Spanish Customs (Aduanas)",
        website: "https://www.agenciatributaria.es",
        notes: "Register via Spanish tax agency portal",
      },
      NL: {
        authority: "Dutch Customs (Douane)",
        website: "https://www.belastingdienst.nl",
        notes: "Register via Dutch tax and customs administration",
      },
    };

    return (
      info[countryCode] || {
        authority: "National Customs Authority",
        notes: `Contact your national customs authority (${countryCode}) to register for EORI validation access`,
      }
    );
  }
}

export const eoriClient = new EORIClient();


