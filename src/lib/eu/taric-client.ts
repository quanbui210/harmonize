import type { TARICMeasure, CNCode } from "./types";

type TARICProvider = "SOAP" | "REST" | "MOCK";

interface TARICClientConfig {
  provider?: TARICProvider;
  apiKey?: string;
  baseUrl?: string;
  wsdlUrl?: string;
  useMock?: boolean;
}

interface RESTTARICResponse {
  cnCode: string;
  dutyRate: number;
  vatRate?: number;
  quota?: { quantity: number; unit: string };
  additionalDuty?: number;
  effectiveDate: string;
  expiryDate?: string;
  notes?: string;
}

export class TARICClient {
  private config: {
    apiKey: string;
    baseUrl: string;
    wsdlUrl: string;
    useMock: boolean;
  };
  private provider: TARICProvider;

  constructor(config: TARICClientConfig = {}) {
    const providerEnv = process.env.TARIC_PROVIDER as TARICProvider;
    // Default to SOAP (official EU API) if no provider specified
    this.provider =
      config.provider ||
      providerEnv ||
      (config.useMock ?? process.env.NODE_ENV === "development"
        ? "MOCK"
        : "SOAP");

    this.config = {
      apiKey: config.apiKey || process.env.TARIC_API_KEY || "",
      baseUrl:
        config.baseUrl ||
        process.env.TARIC_BASE_URL ||
        this.getDefaultBaseUrl(this.provider),
      wsdlUrl:
        config.wsdlUrl ||
        process.env.TARIC_WSDL_URL ||
        "https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl",
      useMock:
        config.useMock ??
        (this.provider === "MOCK" || process.env.NODE_ENV === "development"),
    };
  }

  private getDefaultBaseUrl(provider: TARICProvider): string {
    switch (provider) {
      case "SOAP":
        return "https://ec.europa.eu/taxation_customs/dds2";
      case "REST":
        return process.env.TARIC_REST_API_URL || "https://api.taricsupport.com/v1";
      case "MOCK":
        return "";
      default:
        return "";
    }
  }

  async getDutyRate(cnCode: CNCode): Promise<TARICMeasure | null> {
    if (this.provider === "MOCK" || this.config.useMock) {
      return this.getMockDutyRate(cnCode);
    }

    try {
      if (this.provider === "SOAP") {
        return await this.getDutyRateSOAP(cnCode);
      } else {
        return await this.getDutyRateREST(cnCode);
      }
    } catch (error) {
      console.error(`TARIC API error for CN ${cnCode}:`, error);
      return this.getMockDutyRate(cnCode);
    }
  }

  async getMeasuresForCode(cnCode: CNCode): Promise<TARICMeasure[]> {
    if (this.provider === "MOCK" || this.config.useMock) {
      return [this.getMockDutyRate(cnCode)!].filter(Boolean);
    }

    try {
      if (this.provider === "SOAP") {
        const measure = await this.getDutyRateSOAP(cnCode);
        return measure ? [measure] : [];
      } else {
        return await this.getMeasuresREST(cnCode);
      }
    } catch (error) {
      console.error(`TARIC measures error for CN ${cnCode}:`, error);
      return [this.getMockDutyRate(cnCode)!].filter(Boolean);
    }
  }

  private async getDutyRateSOAP(cnCode: CNCode): Promise<TARICMeasure | null> {
    try {
      const soap = await import("soap");
      const client = await soap.createClientAsync(this.config.wsdlUrl!);

      // New TARIC API methods (2025):
      // - getMeasuresPerGoodsCode: Get duty rates and measures
      // - getDescriptionsPerGoodsCode: Get CN code descriptions
      
      const result = await new Promise<unknown>((resolve, reject) => {
        // Try the new API method first
        if (client.getMeasuresPerGoodsCode) {
          client.getMeasuresPerGoodsCode(
            {
              goodsCode: cnCode,
              date: new Date().toISOString().split("T")[0],
            },
            (err: Error | null, result: unknown) => {
              if (err) reject(err);
              else resolve(result);
            },
          );
        } else if (client.GetData?.v1) {
          // Fallback to old method if new one doesn't exist
          client.GetData.v1(
            {
              cnCode,
              date: new Date().toISOString().split("T")[0],
            },
            (err: Error | null, result: unknown) => {
              if (err) reject(err);
              else resolve(result);
            },
          );
        } else {
          reject(new Error("No compatible TARIC SOAP method found"));
        }
      });

      return this.parseSOAPResponse(result, cnCode);
    } catch (error) {
      console.error("SOAP TARIC error:", error);
      throw error;
    }
  }

  async getDescriptionForCode(cnCode: CNCode): Promise<string | null> {
    if (this.provider === "MOCK" || this.config.useMock) {
      return this.getMockDescription(cnCode);
    }

    try {
      if (this.provider === "SOAP") {
        return await this.getDescriptionSOAP(cnCode);
      }
      return null;
    } catch (error) {
      console.error(`TARIC description error for CN ${cnCode}:`, error);
      return this.getMockDescription(cnCode);
    }
  }

  private async getDescriptionSOAP(cnCode: CNCode): Promise<string | null> {
    try {
      const soap = await import("soap");
      const client = await soap.createClientAsync(this.config.wsdlUrl!);

      const result = await new Promise<unknown>((resolve, reject) => {
        if (client.getDescriptionsPerGoodsCode) {
          client.getDescriptionsPerGoodsCode(
            {
              goodsCode: cnCode,
              date: new Date().toISOString().split("T")[0],
            },
            (err: Error | null, result: unknown) => {
              if (err) reject(err);
              else resolve(result);
            },
          );
        } else {
          reject(new Error("getDescriptionsPerGoodsCode method not available"));
        }
      });

      const raw = result as Record<string, unknown>;
      const description = raw.description || raw.descriptionText || raw.text;
      return description ? String(description) : null;
    } catch (error) {
      console.error("SOAP TARIC description error:", error);
      return null;
    }
  }

  private getMockDescription(cnCode: CNCode): string | null {
    const chapter = parseInt(cnCode.substring(0, 2), 10);
    const heading = parseInt(cnCode.substring(2, 4), 10);
    
    const descriptions: Record<string, string> = {
      "8516": "Electric instantaneous water heaters, immersion heaters and other electro-thermic appliances",
      "8518": "Microphones, loudspeakers, headphones, earphones",
      "8509": "Electromechanical domestic appliances, with self-contained electric motor",
      "9019": "Mechano-therapy appliances; massage apparatus",
    };

    const key = `${chapter}${heading.toString().padStart(2, "0")}`;
    return descriptions[key] || `CN Code ${cnCode} - Classification under Chapter ${chapter}, Heading ${heading}`;
  }

  private async getDutyRateREST(cnCode: CNCode): Promise<TARICMeasure | null> {
    const response = await fetch(`${this.config.baseUrl}/tariff/${cnCode}`, {
      headers: {
        Authorization: this.config.apiKey
          ? `Bearer ${this.config.apiKey}`
          : this.config.apiKey
            ? `API-Key ${this.config.apiKey}`
            : "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`TARIC REST API error: ${response.statusText}`);
    }

    const data = (await response.json()) as RESTTARICResponse;
    return this.parseRESTResponse(data);
  }

  private async getMeasuresREST(cnCode: CNCode): Promise<TARICMeasure[]> {
    const response = await fetch(
      `${this.config.baseUrl}/tariff/${cnCode}/measures`,
      {
        headers: {
          Authorization: this.config.apiKey
            ? `Bearer ${this.config.apiKey}`
            : this.config.apiKey
              ? `API-Key ${this.config.apiKey}`
              : "",
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as RESTTARICResponse[];
    return data.map((item) => this.parseRESTResponse(item));
  }

  private parseSOAPResponse(data: unknown, cnCode: CNCode): TARICMeasure {
    const raw = data as Record<string, unknown>;
    const measure = (raw.measure || raw) as Record<string, unknown>;

    return {
      cnCode,
      measureType: String(measure.measureType || "STANDARD"),
      dutyRate: Number(measure.dutyRate || 0),
      vatRate: measure.vatRate ? Number(measure.vatRate) : undefined,
      quota: measure.quota
        ? {
            quantity: Number((measure.quota as { quantity: unknown }).quantity),
            unit: String((measure.quota as { unit: unknown }).unit),
          }
        : undefined,
      additionalDuty: measure.additionalDuty
        ? Number(measure.additionalDuty)
        : undefined,
      effectiveDate: measure.effectiveDate
        ? new Date(String(measure.effectiveDate))
        : new Date(),
      expiryDate: measure.expiryDate
        ? new Date(String(measure.expiryDate))
        : undefined,
      notes: measure.notes ? String(measure.notes) : undefined,
    };
  }

  private parseRESTResponse(data: RESTTARICResponse): TARICMeasure {
    return {
      cnCode: data.cnCode,
      measureType: "STANDARD",
      dutyRate: data.dutyRate,
      vatRate: data.vatRate,
      quota: data.quota,
      additionalDuty: data.additionalDuty,
      effectiveDate: new Date(data.effectiveDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      notes: data.notes,
    };
  }

  private getMockDutyRate(cnCode: CNCode): TARICMeasure | null {
    const chapter = parseInt(cnCode.substring(0, 2), 10);
    if (isNaN(chapter) || chapter < 1 || chapter > 97) {
      return null;
    }

    // Improved mock duty rates based on common EU tariff structure
    // Note: This is a fallback - real TARIC API should be used in production
    let baseRate = 0.0;
    
    // Textiles and clothing (Chapters 50-63) typically have 12% duty
    if (chapter >= 50 && chapter <= 63) {
      baseRate = 12.0;
    }
    // Electronics and machinery (Chapters 84-85) typically have 0-6.5%
    else if (chapter >= 84 && chapter <= 85) {
      baseRate = 0.0;
    }
    // Agricultural products (Chapters 1-24) vary but often 0-15%
    else if (chapter >= 1 && chapter <= 24) {
      baseRate = chapter < 10 ? 0.0 : 8.0;
    }
    // Other manufactured goods
    else if (chapter >= 25 && chapter < 50) {
      baseRate = 0.0;
    }
    // Other goods
    else {
      baseRate = 6.5;
    }
    
    const vatRate = 20.0;

    return {
      cnCode,
      measureType: "STANDARD",
      dutyRate: baseRate,
      vatRate,
      effectiveDate: new Date(),
    };
  }
}

export const taricClient = new TARICClient();
