"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { ShipmentStatus, ShipmentType } from "@prisma/client";
import { formatHSCode, formatCNCode, formatHTSCode } from "@/lib/utils/code-formatters";
import { removeShipmentItemAction } from "@/server/actions/shipments";

type ShipmentItem = {
  id: string;
  product: { name: string | null; id: string } | null;
  classification: {
    id: string;
    htsCode: string | null;
    hsCode: string | null;
    dossier: { id: string } | null;
    dutySummary: { dutyRate: number } | null;
  } | null;
  quantity: number;
  unitValue: number;
  cnCode: string | null;
  hsCode: string | null;
  htsCode: string | null;
  dutyRate: number | null;
  notes: string | null;
};

type Shipment = {
  id: string;
  shipmentNumber: string;
  type: ShipmentType;
  status: ShipmentStatus;
  originCountry: string | null;
  destinationCountry: string | null;
  shippingDate: Date | null;
  arrivalDate: Date | null;
  customsDeclarationNumber: string | null;
  invoiceValue: number | null;
  totalDuty: number | null;
  incoterms: string | null;
  carrier: string | null;
  freightForwarder: string | null;
  notes: string | null;
  items: ShipmentItem[];
  documents: Array<{ id: string; fileName: string; documentType: string }>;
  createdAt: Date;
  updatedAt: Date;
};

type Props = {
  shipment: Shipment;
  organizationId: string;
};

const statusConfig: Record<ShipmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  DRAFT: { label: "Draft", variant: "outline", icon: Clock },
  IN_TRANSIT: { label: "In Transit", variant: "secondary", icon: Package },
  CLEARED: { label: "Cleared", variant: "default", icon: CheckCircle2 },
  AUDITED: { label: "Audited", variant: "default", icon: CheckCircle2 },
  DISPUTED: { label: "Disputed", variant: "destructive", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", variant: "outline", icon: XCircle },
};

export function ShipmentDetailPageClient({ shipment, organizationId }: Props) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const StatusIcon = statusConfig[shipment.status].icon;

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this item from the shipment?")) {
      return;
    }

    setIsRemoving(itemId);
    try {
      await removeShipmentItemAction(itemId);
      router.refresh();
    } catch (error) {
      console.error("Failed to remove item:", error);
      alert("Failed to remove item. Please try again.");
    } finally {
      setIsRemoving(null);
    }
  };

  const totalValue = shipment.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitValue),
    0,
  );

  const itemsWithDossier = shipment.items.filter(
    (item) => item.classification?.dossier?.id,
  ).length;
  const compliancePercentage = shipment.items.length > 0
    ? Math.round((itemsWithDossier / shipment.items.length) * 100)
    : 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/shipments">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Shipments
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Shipment {shipment.shipmentNumber}
            </h1>
            <Badge variant={statusConfig[shipment.status].variant}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig[shipment.status].label}
            </Badge>
            <Badge variant={shipment.type === "IMPORT" ? "default" : "secondary"}>
              {shipment.type}
            </Badge>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/shipments/${shipment.id}/edit`}>Edit Shipment</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Origin</p>
                  <p className="text-sm font-semibold">
                    {shipment.originCountry || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Destination</p>
                  <p className="text-sm font-semibold">
                    {shipment.destinationCountry || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Shipping Date</p>
                  <p className="text-sm font-semibold">
                    {shipment.shippingDate
                      ? new Date(shipment.shippingDate).toLocaleDateString()
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Arrival Date</p>
                  <p className="text-sm font-semibold">
                    {shipment.arrivalDate
                      ? new Date(shipment.arrivalDate).toLocaleDateString()
                      : "Not specified"}
                  </p>
                </div>
                {shipment.customsDeclarationNumber && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Customs Declaration
                    </p>
                    <p className="text-sm font-semibold">{shipment.customsDeclarationNumber}</p>
                  </div>
                )}
                {shipment.carrier && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Carrier</p>
                    <p className="text-sm font-semibold">{shipment.carrier}</p>
                  </div>
                )}
                {shipment.incoterms && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Incoterms</p>
                    <p className="text-sm font-semibold">{shipment.incoterms}</p>
                  </div>
                )}
              </div>
              {shipment.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{shipment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipment Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Items ({shipment.items.length})</CardTitle>
                <CardDescription>Products in this shipment</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link href={`/shipments/${shipment.id}/items/add`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {shipment.items.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <p>No items in this shipment yet.</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href={`/shipments/${shipment.id}/items/add`}>Add your first item</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>HS Code</TableHead>
                      <TableHead>CN Code</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Value</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Dossier</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.items.map((item) => {
                      const itemTotal = Number(item.quantity) * Number(item.unitValue);
                      const hasDossier = !!item.classification?.dossier?.id;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[200px]">
                            <div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="font-medium truncate cursor-help">
                                      {item.product?.name || "Unknown Product"}
                                    </p>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{item.product?.name || "Unknown Product"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {item.classification && (
                                <Link
                                  href={`/classify/${item.classification.id}`}
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Classification
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.hsCode ? (
                              <span className="font-mono text-sm">{formatHSCode(item.hsCode)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.cnCode ? (
                              <span className="font-mono text-sm">{formatCNCode(item.cnCode)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{Number(item.quantity).toLocaleString()}</TableCell>
                          <TableCell>€{Number(item.unitValue).toLocaleString()}</TableCell>
                          <TableCell className="font-medium">
                            €{itemTotal.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {hasDossier ? (
                              <Badge variant="default">Ready</Badge>
                            ) : (
                              <Badge variant="destructive">Missing</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(item.id);
                              }}
                              disabled={isRemoving === item.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compliance Status */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Dossier Coverage</p>
                  <p className="text-sm font-semibold">{compliancePercentage}%</p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${compliancePercentage}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items with dossiers:</span>
                  <span className="font-medium">{itemsWithDossier} / {shipment.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total value:</span>
                  <span className="font-medium">€{totalValue.toLocaleString()}</span>
                </div>
                {shipment.totalDuty && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated duty:</span>
                    <span className="font-medium">€{Number(shipment.totalDuty).toLocaleString()}</span>
                  </div>
                )}
              </div>
              {compliancePercentage < 100 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/classify">Generate Missing Dossiers</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Value:</span>
                <span className="font-medium">
                  {shipment.invoiceValue
                    ? `€${Number(shipment.invoiceValue).toLocaleString()}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items:</span>
                <span className="font-medium">{shipment.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">
                  {new Date(shipment.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

