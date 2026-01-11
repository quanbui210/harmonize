export type CNCode = string;

export interface EUProductAttributes {
  name: string;
  description: string;
  materials: Array<{ material: string; percentage: number }>;
  intendedUse?: string;
  function?: string;
  composition?: Record<string, unknown>;
  dimensions?: Record<string, unknown>;
  technicalSpecs?: Record<string, unknown>;
}

export interface GRIReasoningStep {
  griRule: "GRI_1" | "GRI_2" | "GRI_3" | "GRI_4" | "GRI_5" | "GRI_6";
  level: "CHAPTER" | "HEADING" | "SUBHEADING" | "NOTE";
  selection: string;
  rationale: string;
  score: number;
  excludedOptions?: string[];
}

export interface TARICMeasure {
  cnCode: CNCode;
  measureType: string;
  dutyRate: number;
  vatRate?: number;
  quota?: {
    quantity: number;
    unit: string;
  };
  additionalDuty?: number;
  effectiveDate: Date;
  expiryDate?: Date;
  notes?: string;
}

export interface EURuling {
  reference: string;
  title: string;
  cnCode: CNCode;
  summary: string;
  fullText?: string;
  issuedBy: string;
  issuedAt: Date;
}

export interface EULegalNote {
  chapter: number;
  heading?: number;
  subheading?: number;
  noteKey: string;
  content: string;
  market: "EU";
}

export interface EUClassificationResult {
  cnCode: CNCode;
  confidence: number;
  reasoningTrail: GRIReasoningStep[];
  sources: Array<{
    sourceType: "TARIC" | "LEGAL_NOTE" | "BINDING_RULING" | "EXPLANATORY_NOTE";
    referenceId?: string;
    excerpt: string;
    metadata?: Record<string, unknown>;
  }>;
  dutySummary: {
    baseDutyRate: number;
    vatRate: number;
    additionalMeasures?: Array<{
      type: string;
      rate: number;
    }>;
  };
  riskFlags: Array<{
    type: "QUOTA" | "ANTI_DUMPING" | "SAFEGUARD" | "PERMIT" | "OTHER";
    label: string;
    details?: string;
  }>;
  exclusionNotes: string[];
}

