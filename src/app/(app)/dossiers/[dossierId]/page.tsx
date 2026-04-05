import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Download, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: { dossierId: string };
};

function getProductNameString(productName: unknown): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";

  const candidate = productName as Record<string, unknown>;
  const translations =
    candidate.translations && typeof candidate.translations === "object"
      ? (candidate.translations as Record<string, unknown>)
      : null;

  if (translations?.fi && typeof translations.fi === "string") return translations.fi;
  if (translations?.sv && typeof translations.sv === "string") return translations.sv;
  if (typeof candidate.original === "string") return candidate.original;
  if (typeof candidate.fi === "string") return candidate.fi;
  if (typeof candidate.sv === "string") return candidate.sv;
  return "Product";
}

export default async function DossierDetailPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  const dossier = await prisma.dossier.findUnique({
    where: {
      id: params.dossierId,
    },
    include: {
      classification: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!dossier || dossier.classification.organizationId !== membership.organizationId) {
    redirect("/dossiers");
  }

  const previewUrl = `/api/dossier/${dossier.id}/preview`;
  const exportUrl = `/api/dossier/${dossier.id}/export`;
  const pdfUrl = `/api/dossier/${dossier.id}/pdf`;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dossiers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dossiers
            </Link>
          </Button>
          <h1 className="truncate text-3xl font-semibold tracking-tight" title={getProductNameString(dossier.classification.product.name)}>
            {getProductNameString(dossier.classification.product.name)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Defense dossier preview and export tools
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={previewUrl} target="_blank">
              <Eye className="mr-2 h-4 w-4" />
              Open HTML
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={exportUrl} target="_blank">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Link>
          </Button>
          <Button asChild>
            <Link href={pdfUrl} target="_blank">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HTML Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src={previewUrl}
            className="h-[780px] w-full rounded-lg border"
            title="Defense dossier preview"
          />
        </CardContent>
      </Card>
    </div>
  );
}
