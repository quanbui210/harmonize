import { supabase } from './supabase';
import type {
  ApiMembership,
  ApiOrganization,
  ApiUser,
  ChatSessionRecord,
  ChatSessionSummary,
  ClassificationRecord,
  ClassificationDossierRecord,
  CursorPaginatedResponse,
  CreateShipmentPayload,
  CreateUploadUrlPayload,
  DashboardOverview,
  FinalizeVaultUploadPayload,
  GeneratedLabelResult,
  GenerateLabelPayload,
  LabelRecord,
  ProductInput,
  ProductRecord,
  RulingRecord,
  ShipmentRecord,
  SignedUploadResponse,
  UpdateShipmentPayload,
  VaultFileRecord,
} from '../types/api';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function getAuthHeaders(
  extraHeaders?: HeadersInit,
  contentType: string | null = 'application/json',
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
    ...extraHeaders,
  };
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body
        ? String(body.error)
        : typeof body === 'string'
          ? body
          : 'Request failed';
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

function buildPaginationQuery(params?: { limit?: number; cursor?: string | null }) {
  const search = new URLSearchParams();
  const limit = Number.isFinite(params?.limit) ? Number(params?.limit) : undefined;
  if (limit != null) {
    search.set('limit', String(limit));
  }
  if (params?.cursor) {
    search.set('cursor', params.cursor);
  }
  return search.toString();
}

export class ApiClient {
  static resolveUrl(path: string) {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    return `${API_ORIGIN}${path}`;
  }

  static async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {},
    contentType: string | null = 'application/json',
  ): Promise<T> {
    const headers = await getAuthHeaders(options.headers, contentType);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    return parseApiResponse<T>(response);
  }

  static async getMe(): Promise<{
    user: ApiUser;
    organization: ApiOrganization;
    membership: ApiMembership;
  }> {
    return this.fetchWithAuth('/auth/me');
  }

  static async getDashboard(): Promise<DashboardOverview> {
    return this.fetchWithAuth('/dashboard');
  }

  static async listProducts(
    params?: { limit?: number; cursor?: string | null },
  ): Promise<CursorPaginatedResponse<ProductRecord>> {
    const query = buildPaginationQuery(params);
    return this.fetchWithAuth<CursorPaginatedResponse<ProductRecord>>(
      `/products${query ? `?${query}` : ''}`,
    );
  }

  static async createProduct(input: ProductInput): Promise<ProductRecord> {
    const response = await this.fetchWithAuth<{ product: ProductRecord }>(
      '/products',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
    return response.product;
  }

  static async getProduct(productId: string): Promise<ProductRecord> {
    const response = await this.fetchWithAuth<{ product: ProductRecord }>(
      `/products/${productId}`,
    );
    return response.product;
  }

  static async updateProduct(
    productId: string,
    input: Omit<ProductInput, 'targetMarkets'> & { targetMarkets: string[] },
  ): Promise<ProductRecord> {
    const response = await this.fetchWithAuth<{ product: ProductRecord }>(
      `/products/${productId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
    return response.product;
  }

  static async listProductImages(productId: string) {
    return this.fetchWithAuth<{ images: any[] }>(`/products/${productId}/images`);
  }

  static async uploadProductImage(
    productId: string,
    file:
      | Blob
      | {
          uri: string;
          name: string;
          type: string;
        },
  ) {
    const formData = new FormData();
    if ('uri' in file) {
      formData.append('image', file as any);
    } else {
      formData.append('image', file as Blob);
    }

    return this.fetchWithAuth<{
      image: any;
      extractedData: Record<string, unknown>;
      ocrText: string;
      confidence: number;
    }>(`/products/${productId}/images`, {
      method: 'POST',
      body: formData,
    }, null);
  }

  static async listClassifications(
    params?: { limit?: number; cursor?: string | null },
  ): Promise<CursorPaginatedResponse<ClassificationRecord>> {
    const query = buildPaginationQuery(params);
    return this.fetchWithAuth<CursorPaginatedResponse<ClassificationRecord>>(
      `/classifications${query ? `?${query}` : ''}`,
    );
  }

  static async classifyProduct(
    input:
      | string
      | {
          productId: string;
          productName?: string;
          description?: string;
          intendedUse?: string;
          materials?: Array<{ material: string; percentage: number }>;
          compositionText?: string;
          originCountry?: string;
          destinationCountry?: string;
          imageIds?: string[];
          market?: 'EU' | 'US';
        },
  ) {
    const payload = typeof input === 'string' ? { productId: input } : input;

    return this.fetchWithAuth<{ result: any }>(
      '/classifications',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  static async getClassification(
    classificationId: string,
  ): Promise<ClassificationRecord> {
    const response = await this.fetchWithAuth<{
      classification: ClassificationRecord;
    }>(`/classifications/${classificationId}`);
    return response.classification;
  }

  static async answerClassificationRefinement(
    classificationId: string,
    input: {
      answer: string;
      field: string;
    },
  ) {
    return this.fetchWithAuth<{
      result: {
        classificationId: string;
        confidence: number | null;
        classification: ClassificationRecord;
      };
    }>(`/classifications/${classificationId}/refinement`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  static async deleteClassification(classificationId: string) {
    return this.fetchWithAuth<{ success: boolean; deletedClassificationId: string }>(
      `/classifications/${classificationId}`,
      { method: 'DELETE' },
    );
  }

  static async getClassificationDossier(classificationId: string) {
    return this.fetchWithAuth<{
      dossier: ClassificationDossierRecord | null;
    }>(`/classifications/${classificationId}/dossier`);
  }

  static async generateDossier(classificationId: string) {
    return this.fetchWithAuth<{ dossier: { dossierId: string; dossierUrl: string } }>(
      `/classifications/${classificationId}/dossier`,
      { method: 'POST' },
    );
  }

  static async generateLabel(
    payload: GenerateLabelPayload,
  ): Promise<GeneratedLabelResult> {
    return this.fetchWithAuth<GeneratedLabelResult>(
      '/labels/generate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  static async getLabel(labelId: string): Promise<LabelRecord> {
    const response = await this.fetchWithAuth<{ label: LabelRecord }>(
      `/labels/${labelId}`,
    );
    return response.label;
  }

  static async listLabels(
    params?: { limit?: number; cursor?: string | null },
  ): Promise<CursorPaginatedResponse<LabelRecord>> {
    const query = buildPaginationQuery(params);
    return this.fetchWithAuth<CursorPaginatedResponse<LabelRecord>>(
      `/labels${query ? `?${query}` : ''}`,
    );
  }

  static async getLabelExport(labelId: string) {
    return this.fetchWithAuth<{
      labelId: string;
      htmlUrl: string;
      pdfUrl: string;
    }>(`/labels/${labelId}/export`);
  }

  static async listVaultFiles(): Promise<VaultFileRecord[]> {
    const response = await this.fetchWithAuth<{ files: VaultFileRecord[] }>(
      '/vault/files',
    );
    return response.files;
  }

  static async createVaultUploadUrl(
    payload: CreateUploadUrlPayload,
  ): Promise<SignedUploadResponse> {
    return this.fetchWithAuth<SignedUploadResponse>(
      '/vault/upload-url',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  static async finalizeVaultUpload(
    payload: FinalizeVaultUploadPayload,
  ): Promise<{ file: VaultFileRecord }> {
    return this.fetchWithAuth<{ file: VaultFileRecord }>(
      '/vault/finalize-upload',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  static async uploadVaultFile(
    fileBody: File | Blob,
    payload: FinalizeVaultUploadPayload & { fileName: string; contentType: string },
  ) {
    const signed = await this.createVaultUploadUrl({
      fileName: payload.fileName,
      contentType: payload.contentType,
      scope: 'vault',
    });

    const { error } = await supabase.storage
      .from(signed.bucket)
      .uploadToSignedUrl(signed.path, signed.token, fileBody, {
        contentType: payload.contentType,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return this.finalizeVaultUpload({
      path: signed.path,
      bucket: 'vault-files',
      label: payload.label,
      tag: payload.tag,
      productId: payload.productId,
      metadata: payload.metadata,
    });
  }

  static async listShipments(
    params?: {
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.type) search.set('type', params.type);
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));

    return this.fetchWithAuth<{
      shipments: ShipmentRecord[];
      total: number;
    }>(`/shipments${search.size ? `?${search.toString()}` : ''}`);
  }

  static async createShipment(payload: CreateShipmentPayload) {
    return this.fetchWithAuth<{ shipment: ShipmentRecord }>(
      '/shipments',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  static async getShipment(shipmentId: string): Promise<ShipmentRecord> {
    const response = await this.fetchWithAuth<{ shipment: ShipmentRecord }>(
      `/shipments/${shipmentId}`,
    );
    return response.shipment;
  }

  static async updateShipment(
    shipmentId: string,
    payload: UpdateShipmentPayload,
  ) {
    return this.fetchWithAuth<{ shipment: ShipmentRecord }>(
      `/shipments/${shipmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  }

  static async listRulings(params?: {
    market?: string;
    htsCode?: string;
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const search = new URLSearchParams();
    if (params?.market) search.set('market', params.market);
    if (params?.htsCode) search.set('htsCode', params.htsCode);
    if (params?.search) search.set('search', params.search);
    if (params?.category) search.set('category', params.category);
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));

    return this.fetchWithAuth<{
      rulings: RulingRecord[];
      total: number;
      requestedMarket: string;
      effectiveMarket: string;
      usedCrossMarketFallback: boolean;
      fallbackReason: string | null;
    }>(`/rulings${search.size ? `?${search.toString()}` : ''}`);
  }

  static async getRuling(rulingId: string): Promise<RulingRecord> {
    const response = await this.fetchWithAuth<{ ruling: RulingRecord }>(
      `/rulings/${rulingId}`,
    );
    return response.ruling;
  }

  static async listChatSessions(limit = 20): Promise<ChatSessionSummary[]> {
    const response = await this.fetchWithAuth<{ sessions: ChatSessionSummary[] }>(
      `/chat?limit=${limit}`,
    );
    return response.sessions;
  }

  static async getChatSession(sessionId: string): Promise<ChatSessionRecord> {
    const response = await this.fetchWithAuth<{ session: ChatSessionRecord }>(
      `/chat?sessionId=${encodeURIComponent(sessionId)}`,
    );
    return response.session;
  }

  static async sendChatMessage(
    query: string,
    sessionId?: string,
    context?: { classificationIds?: string[]; labelIds?: string[] }
  ) {
    return this.fetchWithAuth<{
      answer: string;
      sources: Array<{
        sectionPath: string;
        excerpt: string;
        pageStart?: number;
        pageEnd?: number;
        source?: string;
      }>;
      sessionId: string;
      messageId: string;
    }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ query, sessionId, ...context }),
    });
  }

  static async deleteChatSession(sessionId: string) {
    return this.fetchWithAuth<{ success: boolean }>(
      `/chat?sessionId=${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    );
  }
}
