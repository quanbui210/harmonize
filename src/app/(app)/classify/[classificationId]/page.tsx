import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { CheckCircle2, FileText, AlertTriangle, Plus, Waypoints, Info } from "lucide-react";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button";
import { ImportGuidanceSection } from "@/components/classification/import-guidance-section";
import { AlternativeClassifications } from "@/components/classification/alternative-classifications";
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, AwaitedReactNode, Key } from "react";

type Props = {
  params: { classificationId: string };
};

function formatHSCode(hsCode: string): string {
  if (!hsCode || hsCode.length !== 6) return hsCode;
  return `${hsCode.substring(0, 2)}.${hsCode.substring(2, 4)}.${hsCode.substring(4, 6)}`;
}

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

// Helper to safely extract product name string - handles all possible structures
function getProductNameString(productName: any): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  // Handle standard structure: {original: string, translations: {fi: string, sv: string}}
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (typeof trans.fi === "string") return trans.fi;
    if (typeof trans.sv === "string") return trans.sv;
    if (typeof productName.original === "string") return productName.original;
  }
  
  // Handle edge case: direct {fi: string, sv: string} structure
  if (typeof productName.fi === "string") return productName.fi;
  if (typeof productName.sv === "string") return productName.sv;
  
  // Final fallback
  if (typeof productName.original === "string") return productName.original;
  
  return "Product";
}

export default async function ClassificationDetailPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  const { classificationId } = params;

  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: {
        include: {
          materials: true,
        },
      },
      sources: true,
      dutySummary: true,
      dossier: true,
      labels: {
        where: {
          isDraft: false,
        },
        orderBy: {
          generatedAt: "desc",
        },
        take: 5,
      },
    },
  }) as any; // Type assertion needed until Prisma types are regenerated

  if (!classification) {
    redirect("/classify");
  }

  const hsCode = (classification as { hsCode?: string | null }).hsCode || classification.htsCode?.substring(0, 6) || "";
  const cnCode = classification.htsCode?.substring(0, 8) || "";
  const htsCode = classification.htsCode || "";
  const hasValidCode = htsCode && htsCode !== "0000000000";
  
  // Determine if this is a food/beverage product (for label generation)
  const isFoodProduct = cnCode ? getRegulatoryProductType(cnCode) === "FOOD" : false;

  const cnMeta = hasValidCode
    ? await prisma.cnCodeDescription.findUnique({
        where: { cnCode },
        select: { description: true, source: true, fetchedAt: true },
      })
    : null;

  const productMeta = (classification.product.metadata as Record<string, unknown> | null) ?? null;
  const originCountry =
    productMeta && typeof productMeta.originCountry === "string"
      ? productMeta.originCountry
      : undefined;
  const compositionText =
    productMeta && typeof productMeta.compositionText === "string"
      ? productMeta.compositionText
      : undefined;

  // Parse stored legal rationale data
  const distinctions = (classification.distinctions as Array<{ heading: string; reason: string }>) || [];
  const keyFeatures = (classification.keyFeatures as string[]) || [];
  
  // Parse import guidance and alternatives from humanNotes (temporary storage until we add proper fields)
  let importGuidance = null;
  let alternativeClassifications: Array<{
    cnCode: string;
    htsCode: string;
    confidence: number;
    dutyRate: number;
    vatRate: number;
    reasoning: string;
    tradeOffs?: string;
  }> = [];
  
  if (classification.humanNotes) {
    try {
      const parsed = JSON.parse(classification.humanNotes);
      // Support both old format (direct import guidance) and new format (object with importGuidance and alternatives)
      if (parsed.importStatus) {
        // Old format - direct import guidance
        importGuidance = parsed;
      } else if (parsed.importGuidance) {
        // New format - object with importGuidance and alternatives
        importGuidance = parsed.importGuidance;
        alternativeClassifications = parsed.alternativeClassifications || [];
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {getProductNameString(classification.product.name)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Classification Snapshot
          </p>
          <div className="pt-1">
            {classification.dossier && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                VERIFIED
              </Badge>
            )}
            {!classification.dossier && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                NO DOSSIER
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/classify">Back to Search</Link>
          </Button>
          {classification.labels && classification.labels.length > 0 && (
            <Button className="bg-green-600 text-white hover:bg-green-700" asChild>
              <Link href={`/labels/${classification.labels[0].id}`}>
                <Waypoints className="mr-2 h-4 w-4" />
                View Label
              </Link>
            </Button>
          )}
          {classification.dossier ? (
            <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
              <Link href={`/classify/${classificationId}/dossier`}>
                <FileText className="mr-2 h-4 w-4" />
                View Dossier
              </Link>
            </Button>
          ) : (
            <>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
                <Link href={`/classify/${classificationId}/dossier`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Dossier
                </Link>
              </Button>
              {hasValidCode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Given recent scrutiny on tech imports, we recommend generating a defense dossier for CN Code {formatCNCode(cnCode)} to ensure compliance with customs authorities.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Codes & Duty Info */}
        <Card>
          <CardHeader>
            <CardTitle>Classification Codes</CardTitle>
            <CardDescription>HTS and CN codes for this product</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Destination market</p>
                <p className="text-sm font-semibold">{classification.market}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Country of origin</p>
                <p className="text-sm font-semibold">
                  {originCountry ? originCountry : "Not provided"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">End use</p>
              <p className="text-sm font-semibold">
                {classification.product.intendedUse ? classification.product.intendedUse : "Not provided"}
              </p>
            </div>

            {compositionText && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Materials / composition</p>
                <p className="text-sm text-muted-foreground">{compositionText}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">HS CODE (International Base)</p>
              {hasValidCode && hsCode ? (
                <p className="font-mono text-xl font-semibold">
                  {formatHSCode(hsCode)}
                </p>
              ) : (
                <p className="text-lg text-muted-foreground">Pending classification</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">CN CODE (EU)</p>
              {hasValidCode ? (
                <p className="font-mono text-xl font-semibold">
                  {formatCNCode(cnCode)}
                </p>
              ) : (
                <p className="text-lg text-muted-foreground">Pending classification</p>
              )}
              {cnMeta?.description && (
                <div className="mt-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">CN description</p>
                  <p className="text-sm">{cnMeta.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: <span className="font-medium">{cnMeta.source}</span>
                    {cnMeta.fetchedAt ? ` · cached ${new Date(cnMeta.fetchedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">HTS CODE (USA)</p>
              {hasValidCode ? (
                <p className="font-mono text-xl font-semibold">
                  {formatHTSCode(htsCode)}
                </p>
              ) : (
                <p className="text-lg text-muted-foreground">Pending classification</p>
              )}
            </div>
            {classification.dutySummary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Estimated Duty (MFN)</p>
                <p className={`text-lg font-semibold ${Number(classification.dutySummary.dutyRate) === 0 ? "text-green-600" : ""}`}>
                  {Number(classification.dutySummary.dutyRate) === 0
                    ? "Free (0%)"
                    : `${Number(classification.dutySummary.dutyRate)}%`}
                </p>
              </div>
            )}
            {classification.confidence && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Confidence</p>
                <p className="text-lg font-semibold">
                  {Math.round(Number(classification.confidence) * 100)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Legal Rationale */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3 text-white" />
              </div>
              Legal Rationale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {classification.legalRationale ? (
              <>
                <div className="text-sm text-muted-foreground space-y-3">
                  <p>{classification.legalRationale}</p>
                  
                  {distinctions.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-semibold text-foreground mb-2">Distinctions:</p>
                      {distinctions.map((dist, idx) => (
                        <div key={idx} className="mb-3">
                          <p className="font-semibold text-foreground">{dist.heading}:</p>
                          <p className="text-muted-foreground">{dist.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {keyFeatures.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-semibold text-foreground mb-2">Key Features:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {keyFeatures.map((feature, idx) => (
                          <li key={idx} className="text-muted-foreground">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {classification.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-semibold text-foreground mb-1">Note:</p>
                      <p className="text-xs text-muted-foreground">{classification.notes}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Legal rationale is being generated...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Labeling Section - Only for Food/Beverage Products, hide if labels already exist */}
      {isFoodProduct && (!classification.labels || classification.labels.length === 0) && (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waypoints className="h-5 w-5 text-green-700" />
              Product Labeling
            </CardTitle>
            <CardDescription>
              Generate compliant EU/Finnish labels for food, beverage, and dried goods products
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-white/60 p-4 border border-green-200">
              <p className="text-sm text-muted-foreground mb-3">
                <strong className="text-foreground">Product labels are available for:</strong> Food products, beverages, dried goods, meat, fish, dairy, supplements, and pet food.
              </p>
              <p className="text-sm text-muted-foreground">
                Our label generator creates compliant bilingual (Finnish/Swedish) labels with nutrition tables, ingredient lists, allergen warnings, and all mandatory EU requirements. Labels can be exported as PDF or SVG for printing.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
                <Link href={`/labels/new?classificationId=${classificationId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Product Label
                </Link>
              </Button>
              {classification.labels && classification.labels.length > 0 && (
                <Button variant="outline" asChild>
                  <Link href={`/labels/${classification.labels[0].id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Existing Labels ({classification.labels.length})
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}



      {/* Alternative Classifications */}
      {alternativeClassifications.length > 0 && (
        <AlternativeClassifications
          alternatives={alternativeClassifications}
          primaryCode={cnCode}
          primaryDutyRate={Number(classification.dutySummary?.dutyRate || 0)}
          primaryVatRate={Number(classification.dutySummary?.vatRate || 20)}
        />
      )}

      {/* Import Guidance Section */}
      {importGuidance && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Import Guidance</h2>
          <ImportGuidanceSection guidance={importGuidance} />
        </div>
      )}

      {/* Associated Labels */}
      {classification.labels && classification.labels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waypoints className="h-5 w-5" />
              Product Labels
            </CardTitle>
            <CardDescription>Labels generated for this classification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classification.labels.map((label: any) => {
                const labelData = label.labelData as any;
                const productName = typeof labelData.productName === "string" 
                  ? labelData.productName 
                  : labelData.productName?.original || "Unnamed Product";
                return (
                  <div key={label.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1">
                      <p className="font-semibold">{productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(label.generatedAt).toLocaleDateString()}
                        {label.complianceScore !== null && (
                          <span className="ml-2">
                            • Compliance: {Number(label.complianceScore)}%
                          </span>
                        )}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/labels/${label.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Label
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" asChild>
                <Link href={`/labels/new?classificationId=${classificationId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Label
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources & References */}
      {classification.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources & References</CardTitle>
            <CardDescription>Legal sources supporting this classification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classification.sources.map((source: { sourceType: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; referenceId: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; excerpt: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; }, index: Key | null | undefined) => (
                <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                  <Badge variant="outline">{source.sourceType}</Badge>
                  <div className="flex-1">
                    {source.referenceId && (
                      <p className="font-mono text-sm font-semibold">{source.referenceId}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Disclaimer */}
      <div className="mt-8 pt-6 border-t border-border/30">
        <p className="text-xs text-muted-foreground italic text-center leading-relaxed">
          Results are informational and non-binding. Final decisions rest with EU customs authorities.
        </p>
      </div>
    </div>
  );
}

