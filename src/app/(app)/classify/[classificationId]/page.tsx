import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button";

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
    },
  });

  if (!classification) {
    redirect("/classify");
  }

  const hsCode = (classification as { hsCode?: string | null }).hsCode || classification.htsCode?.substring(0, 6) || "";
  const cnCode = classification.htsCode?.substring(0, 8) || "";
  const htsCode = classification.htsCode || "";
  const hasValidCode = htsCode && htsCode !== "0000000000";

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

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {classification.product.name}
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
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/classify">Back to Search</Link>
            </Button>
            {classification.dossier ? (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
                <Link href={`/classify/${classificationId}/dossier`}>
                  <FileText className="mr-2 h-4 w-4" />
                  View Dossier
                </Link>
              </Button>
            ) : (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
                <Link href={`/classify/${classificationId}/dossier`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Dossier
                </Link>
              </Button>
            )}
          </div>
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

      {/* Bottom Section: Notes & Recommendations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {classification.griRule && (
          <Card>
            <CardHeader>
              <CardTitle>GRI Rule Applied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This classification was determined using <strong>{classification.griRule}</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>Defense Dossier Recommendation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-900 mb-4">
              {hasValidCode 
                ? `Given recent scrutiny on tech imports, we recommend generating a defense dossier for CN Code ${formatCNCode(cnCode)} to ensure compliance with customs authorities.`
                : "Complete the classification to generate a defense dossier."}
            </p>
            <Button 
              className="bg-blue-600 text-white hover:bg-blue-700" 
              asChild
              disabled={!hasValidCode}
            >
              <Link href={`/classify/${classificationId}/dossier`}>
                <FileText className="mr-2 h-4 w-4" />
                {classification.dossier ? "View Compliance Dossier" : "Generate Compliance Dossier"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sources & References */}
      {classification.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources & References</CardTitle>
            <CardDescription>Legal sources supporting this classification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classification.sources.map((source, index) => (
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
    </div>
  );
}

