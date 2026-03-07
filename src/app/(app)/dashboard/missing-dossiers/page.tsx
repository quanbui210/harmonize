import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

export default async function MissingDossiersPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }

  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    redirect("/login?error=organization");
  }

  // Get all classifications without dossiers
  const classifications = await prisma.classification.findMany({
    where: {
      organizationId: membership.organizationId,
      dossier: null, // Only show classifications without dossiers
    },
    include: {
      product: true,
      dossier: true,
      dutySummary: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Check total classifications to distinguish empty state
  const totalClassifications = await prisma.classification.count({
    where: {
      organizationId: membership.organizationId,
    },
  });

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Missing Reasoning Dossiers
          </h1>
          <p className="text-sm text-muted-foreground">
            All classifications that need audit-ready coverage ({classifications.length} total)
          </p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Classifications Requiring Dossiers</CardTitle>
          <CardDescription>
            Generate defense dossiers for these products to ensure audit readiness
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product / SKU</TableHead>
                <TableHead>HTS Code</TableHead>
                <TableHead>CN Code</TableHead>
                <TableHead>Duty Rate</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm py-8">
                    {totalClassifications === 0 ? (
                      <div className="space-y-2">
                        <p className="font-medium">No classifications yet</p>
                        <p className="text-muted-foreground">
                          Start by classifying a product from the dashboard.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium">All classifications are covered!</p>
                        <p className="text-muted-foreground">
                          Great job. All your products have defense dossiers.
                        </p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {classifications.map((item) => {
                const hasValidCode = item.htsCode && item.htsCode !== "0000000000";
                const cnCode = item.htsCode?.substring(0, 8) || "";

                return (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
                      <div className="min-w-0">
                        <p 
                          className="font-medium truncate" 
                          title={item.product?.name ?? "Untitled Product"}
                        >
                          {item.product?.name ?? "Untitled Product"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {String(item.product?.id ?? "")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasValidCode && item.htsCode ? (
                        <p className="font-mono text-sm">
                          {formatHTSCode(item.htsCode)}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">Pending classification</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasValidCode ? (
                        <p className="font-mono text-sm">
                          {formatCNCode(cnCode)}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.dutySummary ? (
                        <span className={Number(item.dutySummary.dutyRate) === 0 ? "text-green-600 font-semibold" : ""}>
                          {Number(item.dutySummary.dutyRate) === 0
                            ? "Free (0%)"
                            : `${Number(item.dutySummary.dutyRate)}%`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.confidence ? (
                        <Badge variant="outline">
                          {Math.round(Number(item.confidence) * 100)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        No Dossier
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        asChild
                      >
                        <Link href={`/classify/${item.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

