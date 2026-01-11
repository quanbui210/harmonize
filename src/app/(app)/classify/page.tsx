import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
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
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { ClassificationSearchForm } from "@/components/classification/classification-search-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button";

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

export default async function ClassifyPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  // Get all classifications for this organization
  const classifications = await prisma.classification.findMany({
    where: {
      organizationId: membership.organizationId,
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
            All Classifications
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage all product classifications ({classifications.length} total)
          </p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
          <Link href="/classify#search">+ New Classification</Link>
        </Button>
      </div>

      {/* Search Form Section */}
      <div id="search">
        <ClassificationSearchForm
          organizationId={membership.organizationId}
          userId={user.id}
        />
      </div>

      {/* All Classifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Classifications</CardTitle>
          <CardDescription>
            Click on any row to view full details, legal rationale, and generate dossiers
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>HS Code</TableHead>
                <TableHead>CN Code</TableHead>
                <TableHead>HTS Code</TableHead>
                <TableHead>Duty Rate</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Legal Rationale</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm py-8">
                    <div className="space-y-2">
                      <p className="font-medium">No classifications yet</p>
                      <p className="text-muted-foreground">
                        Start by classifying a product above.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {classifications.map((item) => {
                const hasValidCode = item.htsCode && item.htsCode !== "0000000000";
                const hsCode = (item as { hsCode?: string | null }).hsCode || item.htsCode?.substring(0, 6) || "";
                const cnCode = item.htsCode?.substring(0, 8) || "";
                const hasLegalRationale = !!(item as any).legalRationale;

                return (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="max-w-[200px] md:max-w-[300px] lg:max-w-[400px]">
                      <Link href={`/classify/${item.id}`} className="block">
                        <div className="min-w-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="font-medium truncate cursor-help">
                                  {item.product?.name ?? "Untitled Product"}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{item.product?.name ?? "Untitled Product"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <p className="text-xs text-muted-foreground truncate">
                            {String(item.product?.id ?? "")}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/classify/${item.id}`} className="block">
                        {hasValidCode && hsCode ? (
                          <p className="font-mono text-sm">
                            {formatHSCode(hsCode)}
                          </p>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/classify/${item.id}`} className="block">
                        {hasValidCode ? (
                          <p className="font-mono text-sm">
                            {formatCNCode(cnCode)}
                          </p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link href={`/classify/${item.id}`} className="block">
                        {hasValidCode && item.htsCode ? (
                          <p className="font-mono text-sm">
                            {formatHTSCode(item.htsCode)}
                          </p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link href={`/classify/${item.id}`} className="block">
                        {item.dutySummary ? (
                          <span className={Number(item.dutySummary.dutyRate) === 0 ? "text-green-600 font-semibold" : ""}>
                            {Number(item.dutySummary.dutyRate) === 0
                              ? "Free (0%)"
                              : `${Number(item.dutySummary.dutyRate)}%`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link href={`/classify/${item.id}`} className="block">
                        {item.confidence ? (
                          <Badge variant="outline">
                            {Math.round(Number(item.confidence) * 100)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/classify/${item.id}`} className="block">
                        {item.dossier ? (
                          <Badge className="bg-green-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Missing
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <Link href={`/classify/${item.id}`} className="block">
                        {hasLegalRationale ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <FileText className="mr-1 h-3 w-3" />
                            Available
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </Link>
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
