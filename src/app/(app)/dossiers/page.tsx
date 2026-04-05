import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.slice(0, 4)} ${cnCode.slice(4, 6)} ${cnCode.slice(6, 8)}`;
}

export default async function DossiersPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  const dossiers = await prisma.dossier.findMany({
    where: {
      classification: {
        organizationId: membership.organizationId,
      },
    },
    include: {
      classification: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      generatedAt: "desc",
    },
  });

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">Defense Dossiers</h1>
        <p className="text-sm text-muted-foreground">
          View all generated dossiers, open HTML preview, and download exports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated Dossiers</CardTitle>
          <CardDescription>
            {dossiers.length} dossier{dossiers.length === 1 ? "" : "s"} in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>CN Code</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dossiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <div className="space-y-2">
                      <p className="font-medium">No dossiers yet</p>
                      <p className="text-sm text-muted-foreground">
                        Generate a dossier from a classification detail page.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                dossiers.map((dossier) => {
                  const cnCode = (dossier.classification.htsCode || "").replace(/\D/g, "").slice(0, 8);
                  return (
                    <TableRow key={dossier.id}>
                      <TableCell className="w-[42%] max-w-0">
                        <div className="min-w-0">
                          <p className="max-w-[360px] truncate font-medium">
                            {getProductNameString(dossier.classification.product.name)}
                          </p>
                          <p className="max-w-[360px] truncate text-xs text-muted-foreground">
                            {dossier.classification.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{cnCode ? formatCNCode(cnCode) : "Pending"}</TableCell>
                      <TableCell>
                        {new Date(dossier.generatedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dossiers/${dossier.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">
            Need a new dossier for another product?
          </div>
          <Button asChild>
            <Link href="/classify">
              <FileText className="mr-2 h-4 w-4" />
              Go to Classification
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
