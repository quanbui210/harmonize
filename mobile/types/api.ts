export type ApiUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

export type ApiOrganization = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type ApiMembership = {
  id: string;
  role: string;
};

export type DashboardOverview = {
  auditReadinessScore: number;
  approvedCount: number;
  pendingCount: number;
  missingReasonings: number;
  autoClassified: number;
  totalLabels: number;
  actionItems: any[];
  activeImports: any[];
  recentShipments: any[];
};

export type ProductMaterial = {
  material: string;
  percentage: number;
};

export type ProductInput = {
  name: string;
  description: string;
  intendedUse?: string;
  targetMarkets: string[];
  materials?: ProductMaterial[];
  metadata?: Record<string, unknown>;
};

export type ProductRecord = {
  id: string;
  organizationId: string;
  createdById: string;
  name: string;
  description: string;
  intendedUse: string | null;
  targetMarkets: string[];
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  materials?: ProductMaterial[];
  images?: ProductImageRecord[];
};

export type ProductImageRecord = {
  id: string;
  productId: string | null;
  organizationId: string;
  uploadedById: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  ocrText: string | null;
  ocrConfidence: number | null;
  extractedData: Record<string, unknown> | null;
  createdAt: string;
  signedUrl?: string | null;
};

export type ClassificationRecord = {
  id: string;
  organizationId: string;
  productId: string;
  market: string;
  hsCode: string | null;
  htsCode: string | null;
  cnCode?: string | null;
  cnCodeDescription?: string | null;
  codeBreakdown?: Array<{
    level: 'chapter' | 'heading' | 'subheading' | 'commodity';
    code: string;
    title: string;
    description: string;
  }>;
  status: string;
  confidence: number | null;
  summary: string | null;
  legalRationale?: string | null;
  distinctions?: string | null;
  keyFeatures?: string[] | null;
  notes?: string | null;
  humanNotes?: {
    importGuidance?: {
      importStatus?: 'ALLOWED' | 'RESTRICTED' | 'PROHIBITED';
      importStatusMessage?: string;
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      requiredDocuments?: string[];
      foodSafetyRisks?: Array<{
        risk?: string;
        level?: 'LOW' | 'MEDIUM' | 'HIGH';
        reason?: string;
      }>;
      recommendedTests?: string[];
      labellingRequirements?: string[];
      borderControlLikelihood?: 'LOW' | 'MEDIUM' | 'HIGH';
      borderControlReason?: string;
      nextActions?: string[];
    } | null;
    alternativeClassifications?: Array<Record<string, unknown>>;
  } | null;
  refinementQuestion?: string | null;
  requiresReview: boolean;
  product?: ProductRecord;
  dutySummary?: {
    dutyRate?: number | null;
    vatRate?: number | null;
    supplementaryUnit?: string | null;
  } | null;
  riskFlags?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
  dossier?: { id: string; generatedAt: string } | null;
  labels?: Array<LabelRecord>;
};

export type ClassificationDossierRecord = {
  id: string;
  generatedAt: string;
  previewUrl: string;
  pdfUrl: string;
  exportUrl: string;
};

export type GenerateLabelPayload = {
  productName: string;
  description?: string;
  originCountry?: string;
  destinationCountry?: string;
  cnCode?: string;
  originalLabelText?: string;
  nutrition?: {
    energy?: number;
    fat?: number;
    carbs?: number;
    protein?: number;
    salt?: number;
  };
  productCategory?: string;
  endUse: "B2C" | "B2B" | "internal";
  labelSize?: {
    width: number;
    height: number;
  };
  importerAddress?: string;
  bestBeforeDate?: string;
  netQuantity?: string;
  quidIngredientName?: string;
  quidPercentage?: number;
  classificationId?: string;
  save?: boolean;
};

export type GeneratedLabelResult = {
  label: any;
  complianceScore: number;
  complianceResults: any[];
  labelId: string | null;
};

export type LabelRecord = {
  id: string;
  organizationId: string;
  productId: string | null;
  classificationId: string | null;
  labelData: any;
  complianceScore: number;
  version: number;
  isDraft: boolean;
  generatedAt: string;
};

export type VaultFileRecord = {
  id: string;
  organizationId: string;
  productId: string | null;
  uploadedById: string | null;
  tag: string;
  label: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  signedUrl?: string | null;
};

export type CreateUploadUrlPayload = {
  fileName: string;
  contentType: string;
  scope?: "vault" | "product-image";
};

export type SignedUploadResponse = {
  bucket: "vault-files" | "product-images";
  path: string;
  token: string;
  signedUrl: string;
  contentType: string;
  finalizeRequired: boolean;
};

export type FinalizeVaultUploadPayload = {
  path: string;
  bucket?: "vault-files";
  label: string;
  tag?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
};

export type ShipmentRecord = {
  id: string;
  organizationId: string;
  shipmentNumber: string;
  type: string;
  status: string;
  originCountry: string | null;
  destinationCountry: string | null;
  shippingDate: string | null;
  arrivalDate: string | null;
  customsDeclarationNumber: string | null;
  invoiceValue: number | null;
  totalDuty?: number | null;
  incoterms: string | null;
  carrier: string | null;
  freightForwarder: string | null;
  notes: string | null;
  items?: any[];
  documents?: any[];
};

export type CreateShipmentPayload = {
  shipmentNumber: string;
  type: "IMPORT" | "EXPORT";
  originCountry?: string;
  destinationCountry?: string;
  shippingDate?: string;
  arrivalDate?: string;
  customsDeclarationNumber?: string;
  invoiceValue?: number;
  incoterms?: string;
  carrier?: string;
  freightForwarder?: string;
  notes?: string;
  items?: Array<{
    productId: string;
    classificationId?: string;
    quantity: number;
    unitValue: number;
    notes?: string;
  }>;
};

export type UpdateShipmentPayload = Partial<
  Omit<CreateShipmentPayload, "type" | "items">
> & {
  status?: "DRAFT" | "IN_TRANSIT" | "CLEARED" | "AUDITED" | "DISPUTED" | "CANCELLED";
  totalDuty?: number;
};

export type RulingRecord = {
  id: string;
  market: string;
  reference: string;
  title: string;
  body: string;
  originalBody?: string;
  isTranslated?: boolean;
  category?: string | null;
  htsCode?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  justification?: string | null;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  lastMessage: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    sectionPath: string;
    excerpt: string;
    pageStart?: number;
    pageEnd?: number;
    source?: string;
  }>;
  createdAt: string;
};

export type ChatSessionRecord = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
};
