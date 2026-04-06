import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";

export default async function LabelsPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  const labels = await prisma.label.findMany({
    where: {
      organizationId: membership.organizationId,
      isDraft: false,
    },
    orderBy: {
      generatedAt: "desc",
    },
    take: 50,
  });

  const getAnyTranslation = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    const translations = value as Record<string, unknown>;
    const first = Object.values(translations).find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
    return typeof first === "string" ? first : null;
  };

  const getProductName = (labelData: any): string => {
    if (!labelData?.productName) return "Unnamed Product";
    if (typeof labelData.productName === "string") {
      return labelData.productName;
    }
    if (typeof labelData.productName !== "object") return "Unnamed Product";

    if (labelData.productName.translations && typeof labelData.productName.translations === "object") {
      const translatedName = getAnyTranslation(labelData.productName.translations);
      if (translatedName) return translatedName;
      if (typeof labelData.productName.original === "string") return labelData.productName.original;
    }

    const directLocalizedName = getAnyTranslation(labelData.productName);
    if (directLocalizedName) return directLocalizedName;

    // Final fallback
    if (typeof labelData.productName.original === "string") return labelData.productName.original;

    return "Unnamed Product";
  };

  const getComplianceStatus = (score: number | null) => {
    if (score === null) return { text: "Unknown", color: "text-gray-600", icon: AlertCircle };
    if (score >= 100) return { text: "Compliant", color: "text-green-600", icon: CheckCircle2 };
    if (score >= 80) return { text: "Action Required", color: "text-yellow-600", icon: AlertCircle };
    return { text: "Issues Found", color: "text-red-600", icon: AlertCircle };
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product Labels</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your generated product labels
          </p>
        </div>
        <Button asChild>
          <Link href="/labels/new">
            <Plus className="mr-2 h-4 w-4" />
            Create New Label
          </Link>
        </Button>
      </div>

      {labels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No labels yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first product label to get started
            </p>
            <Button asChild>
              <Link href="/labels/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Label
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {labels.map((label) => {
            const labelData = label.labelData as unknown as EnhancedLabelData & {
              productName?: string | { original?: string; translations?: Record<string, string | undefined> };
              productCategory?: string;
            };
            const productName = getProductName(labelData);
            const status = getComplianceStatus(Number(label.complianceScore));
            const StatusIcon = status.icon;

            return (
              <Card key={label.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{productName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {labelData.productCategory || "General"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(label.generatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {label.complianceScore !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <StatusIcon className={`h-4 w-4 ${status.color}`} />
                        <span className={status.color}>
                          {status.text} ({Number(label.complianceScore)}%)
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/labels/${label.id}`}>
                          <FileText className="mr-2 h-4 w-4" />
                          View Label
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

