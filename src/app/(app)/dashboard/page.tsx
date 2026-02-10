import { redirect } from "next/navigation"
import { AlertTriangle, ArrowUpRight, CheckCircle2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getOptionalUser } from "@/lib/supabase/auth"
import { getPrimaryMembership } from "@/server/queries/organizations"
import { getDashboardOverview } from "@/server/queries/dashboard"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeDisplay } from "@/components/classification/code-display";

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHSCode(hsCode: string): string {
  if (!hsCode || hsCode.length !== 6) return hsCode;
  return `${hsCode.substring(0, 2)}.${hsCode.substring(2, 4)}.${hsCode.substring(4, 6)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

export default async function DashboardPage() {
  const user = await getOptionalUser()
  if (!user) {
    redirect("/login")
  }

  const membership = await getPrimaryMembership(user.id)
  if (!membership) {
    redirect("/login?error=organization")
  }

  const data = await getDashboardOverview(membership.organizationId)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Stage 1 · Audit Protection
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Audit Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time HTS verification and audit readiness monitoring for{" "}
            {membership.organization.name}.
          </p>
        </div>
        
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Audit Readiness Score
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 36 36" className="h-full w-full">
                <path
                  className="text-slate-200"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="transparent"
                  d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600"
                  strokeWidth="3.8"
                  strokeDasharray={`${
                    data.approvedCount + data.pendingCount === 0
                      ? 0
                      : data.auditReadinessScore
                  }, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text
                  x="18"
                  y="20.35"
                  className="fill-slate-900 text-[0.6rem] font-semibold"
                  textAnchor="middle"
                >
                  {data.approvedCount + data.pendingCount === 0
                    ? "N/A"
                    : `${data.auditReadinessScore}%`}
                </text>
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Verified: {data.approvedCount}
              </p>
              <p className="text-sm text-muted-foreground">
                Pending: {data.pendingCount}
              </p>
              {data.approvedCount + data.pendingCount > 0 && (
                <Badge variant="secondary" className="mt-2">
                  {data.auditReadinessScore >= 90
                    ? "High Trust"
                    : data.auditReadinessScore >= 50
                    ? "Medium Risk"
                    : "Action Needed"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <MetricCard
          title="Total Active Imports"
          value={data.approvedCount + data.pendingCount}
          helper="+12% YoY"
        />
        <MetricCard
          title="Missing Reasonings"
          value={data.missingReasonings}
          helper="Requires dossier coverage"
          variant="warning"
        />
        <MetricCard
          title="Labels Generated"
          value={data.totalLabels}
          helper="Ready for use"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3 xl:items-stretch">
        <Card className="xl:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Classifications</CardTitle>
              <CardDescription>
                Latest product classifications and their dossier status.
              </CardDescription>
            </div>
            <Button variant="ghost" className="text-blue-600" asChild>
              <Link href="/classify">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {/* Mobile/Tablet/Laptop: Card Layout */}
            <div className="space-y-4 xl:hidden">
              {data.actionItems.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No classifications yet. Start by classifying a product.
                </p>
              )}
              {data.actionItems.map((item: any) => (
                <div
                  key={item.id}
                  className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <Link href={`/classify/${item.id}`} className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.product?.name ?? "Untitled Product"}
                      </p>
                    </Link>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border text-xs font-medium">
                            {item.dossier ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-green-700">Ready</span>
                              </>
                            ) : (
                              <>
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Pending</span>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.dossier ? "Dossier generated" : "Missing dossier"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/classify/${item.id}`} className="block">
                      {item.htsCode && item.htsCode !== "0000000000" ? (
                        <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {formatCNCode(item.htsCode.substring(0, 8))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pending code</span>
                      )}
                    </Link>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-7 text-xs px-2 hover:bg-blue-50 hover:text-blue-600"
                        asChild
                      >
                        <Link href={`/classify/${item.id}`}>
                          View
                        </Link>
                      </Button>
                      <DeleteClassificationButton
                        classificationId={item.id}
                        productName={item.product?.name ?? "Untitled Product"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop (Large Screens): Table Layout */}
            <div className="hidden xl:block overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Product</TableHead>
                      <TableHead className="min-w-[180px]">Code</TableHead>
                      <TableHead className="min-w-[60px] text-center">Dossier</TableHead>
                      <TableHead className="text-right min-w-[200px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {data.actionItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm py-8">
                        No classifications yet. Start by classifying a product.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.actionItems.map((item: any) => (
                    <TableRow 
                      key={item.id} 
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="min-w-[200px] max-w-[300px]">
                        <Link href={`/classify/${item.id}`} className="block w-full">
                          <div className="min-w-0 w-full">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="font-medium truncate cursor-help w-full">
                                    {item.product?.name ?? "Untitled Product"}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{item.product?.name ?? "Untitled Product"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Link href={`/classify/${item.id}`} className="block">
                          {item.htsCode && item.htsCode !== "0000000000" ? (
                            <CodeDisplay
                              cnCode={item.htsCode.substring(0, 8)}
                              hsCode={(item as any).hsCode || item.htsCode.substring(0, 6)}
                              htsCode={item.htsCode}
                            />
                          ) : (
                            <span className="text-muted-foreground">Pending classification</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-[60px] text-center">
                        <Link href={`/classify/${item.id}`} className="flex justify-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  {item.dossier ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <X className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{item.dossier ? "Dossier Ready" : "No Dossier"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right min-w-[200px]">
                        <div className="flex items-center justify-end">
                          <DeleteClassificationButton
                            classificationId={item.id}
                            productName={item.product?.name ?? "Untitled Product"}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col space-y-6 h-full">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Recent Shipments</CardTitle>
              <CardDescription>Latest active shipments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {data.recentShipments?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active shipments yet. Create a shipment to get started.
                </p>
              )}
              {data.recentShipments?.map((shipment: any) => (
                <Link
                  key={shipment.id}
                  href={`/shipments/${shipment.id}`}
                  className="block rounded-xl border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{shipment.shipmentNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {shipment.items?.length ?? 0} item{(shipment.items?.length ?? 0) !== 1 ? "s" : ""} · {shipment.type}
                      </p>
                    </div>
                    <Badge variant={shipment.status === "CLEARED" ? "default" : shipment.status === "IN_TRANSIT" ? "secondary" : "outline"}>
                      {shipment.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Active Imports Summary</CardTitle>
              <CardDescription>Top shipments needing attention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {data.activeImports.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Classify a product to see shipment readiness here.
                </p>
              )}
              {data.activeImports.map((item) => (
                <div
                  key={String(item.id)}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.product?.name ?? "Product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.market ?? "")} · {item.htsCode ? formatHTSCode(item.htsCode) : "HTS pending"}
                    </p>
                  </div>
                  <Badge
                    variant={item.requiresReview ? "secondary" : "default"}
                  >
                    {item.requiresReview ? "Review" : "Audit Ready"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

type MetricCardProps = {
  title: string
  value: number
  helper?: string
  variant?: "default" | "warning"
}

function MetricCard({
  title,
  value,
  helper,
  variant = "default",
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {variant === "warning" ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-blue-600" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {helper && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              variant === "warning" && "text-amber-600",
            )}
          >
            {helper}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

