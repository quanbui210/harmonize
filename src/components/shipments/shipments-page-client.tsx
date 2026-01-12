"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Package, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { ShipmentStatus, ShipmentType } from "@prisma/client";
import { formatHSCode, formatCNCode, formatHTSCode } from "@/lib/utils/code-formatters";

type ShipmentItem = {
  id: string;
  product: { name: string | null; id: string } | null;
  classification: {
    id: string;
    htsCode: string | null;
    dossier: { id: string } | null;
  } | null;
  quantity: number;
  unitValue: number;
  cnCode: string | null;
  hsCode: string | null;
  htsCode: string | null;
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
  items: ShipmentItem[];
  createdAt: Date;
};

type Props = {
  initialShipments: Shipment[];
  total: number;
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

export function ShipmentsPageClient({ initialShipments, total, organizationId }: Props) {
  const router = useRouter();
  const [shipments, setShipments] = useState(initialShipments);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ShipmentType | "all">("all");
  const [isPending, startTransition] = useTransition();

  const filteredShipments = shipments.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    return true;
  });

  const getComplianceStatus = (shipment: Shipment) => {
    const itemsWithDossier = shipment.items.filter(
      (item) => item.classification?.dossier?.id,
    ).length;
    const totalItems = shipment.items.length;
    const allClassified = shipment.items.every((item) => item.classification?.id);
    
    if (totalItems === 0) return { status: "empty", label: "No items", color: "gray" };
    if (!allClassified) return { status: "incomplete", label: "Missing classifications", color: "red" };
    if (itemsWithDossier === totalItems) return { status: "ready", label: "Compliance Ready", color: "green" };
    if (itemsWithDossier > 0) return { status: "partial", label: "Partial Dossiers", color: "yellow" };
    return { status: "missing", label: "No Dossiers", color: "red" };
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Shipments</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage your import/export shipments ({total} total)
          </p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700" asChild>
          <Link href="/shipments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Shipment
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ShipmentStatus | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as ShipmentType | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="IMPORT">Import</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
          <CardDescription>
            Click on any row to view details, compliance status, and manage items
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origin → Destination</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm py-8">
                    <div className="space-y-2">
                      <p className="font-medium">No shipments found</p>
                      <p className="text-muted-foreground">
                        {shipments.length === 0
                          ? "Create your first shipment to get started."
                          : "Try adjusting your filters."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filteredShipments.map((shipment) => {
                const compliance = getComplianceStatus(shipment);
                const StatusIcon = statusConfig[shipment.status].icon;

                return (
                  <TableRow
                    key={shipment.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/shipments/${shipment.id}`)}
                  >
                    <TableCell className="font-medium">
                      {shipment.shipmentNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shipment.type === "IMPORT" ? "default" : "secondary"}>
                        {shipment.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[shipment.status].variant}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig[shipment.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {shipment.originCountry && shipment.destinationCountry ? (
                        <span className="text-sm">
                          {shipment.originCountry} → {shipment.destinationCountry}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{shipment.items.length} items</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          compliance.color === "green"
                            ? "default"
                            : compliance.color === "red"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {compliance.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {shipment.invoiceValue ? (
                        <span className="text-sm font-medium">
                          €{Number(shipment.invoiceValue).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/shipments/${shipment.id}`);
                        }}
                      >
                        View Details
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

