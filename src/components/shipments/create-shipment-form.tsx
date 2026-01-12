"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, HelpCircle, Plus, Trash2 } from "lucide-react";
import { createShipmentAction } from "@/server/actions/shipments";
import { ShipmentType } from "@prisma/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Product = {
  id: string;
  name: string;
  classifications: Array<{
    id: string;
    htsCode: string | null;
    hsCode: string | null;
    dossier: { id: string } | null;
  }>;
};

type ItemFormData = {
  productId: string;
  classificationId: string;
  quantity: string;
  unitValue: string;
  notes: string;
};

type Props = {
  organizationId: string;
  products: Product[];
};

export function CreateShipmentForm({ organizationId, products }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    shipmentNumber: "",
    type: "IMPORT" as ShipmentType,
    originCountry: "",
    destinationCountry: "",
    shippingDate: "",
    arrivalDate: "",
    customsDeclarationNumber: "",
    invoiceValue: "",
    incoterms: "",
    carrier: "",
    freightForwarder: "",
    notes: "",
  });

  const [items, setItems] = useState<ItemFormData[]>([]);

  const addItemRow = () => {
    setItems([
      ...items,
      {
        productId: "",
        classificationId: "",
        quantity: "",
        unitValue: "",
        notes: "",
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemFormData, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    // Reset classification when product changes
    if (field === "productId") {
      newItems[index].classificationId = "";
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.shipmentNumber.trim()) {
      setError("Shipment number is required");
      return;
    }

    // Validate items if any are provided
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productId) {
          setError(`Item ${i + 1}: Please select a product`);
          return;
        }
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          setError(`Item ${i + 1}: Please enter a valid quantity`);
          return;
        }
        if (!item.unitValue || parseFloat(item.unitValue) <= 0) {
          setError(`Item ${i + 1}: Please enter a valid unit value`);
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        const shipment = await createShipmentAction({
          shipmentNumber: formData.shipmentNumber,
          type: formData.type,
          originCountry: formData.originCountry || undefined,
          destinationCountry: formData.destinationCountry || undefined,
          shippingDate: formData.shippingDate || undefined,
          arrivalDate: formData.arrivalDate || undefined,
          customsDeclarationNumber: formData.customsDeclarationNumber || undefined,
          invoiceValue: formData.invoiceValue ? parseFloat(formData.invoiceValue) : undefined,
          incoterms: formData.incoterms || undefined,
          carrier: formData.carrier || undefined,
          freightForwarder: formData.freightForwarder || undefined,
          notes: formData.notes || undefined,
          items: items.length > 0
            ? items.map((item) => ({
                productId: item.productId,
                classificationId: item.classificationId || undefined,
                quantity: parseFloat(item.quantity),
                unitValue: parseFloat(item.unitValue),
                notes: item.notes || undefined,
              }))
            : undefined,
        });

        router.push(`/shipments/${shipment.id}`);
      } catch (err) {
        console.error("Failed to create shipment:", err);
        setError(err instanceof Error ? err.message : "Failed to create shipment");
      }
    });
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/shipments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shipments
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">New Shipment</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Shipment Information</CardTitle>
            <CardDescription>
              Create a new import or export shipment. After creating, you'll add products from your classifications and specify quantities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shipmentNumber">
                  Shipment Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="shipmentNumber"
                  value={formData.shipmentNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, shipmentNumber: e.target.value })
                  }
                  placeholder="SHIP-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as ShipmentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMPORT">Import</SelectItem>
                    <SelectItem value="EXPORT">Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="originCountry">Origin Country</Label>
                <Input
                  id="originCountry"
                  value={formData.originCountry}
                  onChange={(e) =>
                    setFormData({ ...formData, originCountry: e.target.value })
                  }
                  placeholder="e.g., CN, US, DE"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationCountry">Destination Country</Label>
                <Input
                  id="destinationCountry"
                  value={formData.destinationCountry}
                  onChange={(e) =>
                    setFormData({ ...formData, destinationCountry: e.target.value })
                  }
                  placeholder="e.g., EU, US, UK"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingDate">Shipping Date</Label>
                <Input
                  id="shippingDate"
                  type="date"
                  value={formData.shippingDate}
                  onChange={(e) =>
                    setFormData({ ...formData, shippingDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arrivalDate">Arrival Date</Label>
                <Input
                  id="arrivalDate"
                  type="date"
                  value={formData.arrivalDate}
                  onChange={(e) =>
                    setFormData({ ...formData, arrivalDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="customsDeclarationNumber">Customs Declaration Number</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          The official reference number assigned by customs authorities when you file your import/export declaration. 
                          This is typically provided by your customs broker or freight forwarder after the declaration is submitted.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="customsDeclarationNumber"
                  value={formData.customsDeclarationNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, customsDeclarationNumber: e.target.value })
                  }
                  placeholder="e.g., CUS-123456"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceValue">Invoice Value (€)</Label>
                <Input
                  id="invoiceValue"
                  type="number"
                  step="0.01"
                  value={formData.invoiceValue}
                  onChange={(e) =>
                    setFormData({ ...formData, invoiceValue: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="incoterms">Incoterms</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          International Commercial Terms that define responsibilities between buyer and seller for delivery, 
                          costs, and risks. Common terms: <strong>FOB</strong> (Free On Board), <strong>CIF</strong> (Cost, Insurance, Freight), 
                          <strong>DDP</strong> (Delivered Duty Paid), <strong>EXW</strong> (Ex Works).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="incoterms"
                  value={formData.incoterms}
                  onChange={(e) => setFormData({ ...formData, incoterms: e.target.value })}
                  placeholder="e.g., FOB, CIF, DDP"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  value={formData.carrier}
                  onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                  placeholder="e.g., DHL, FedEx"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="freightForwarder">Freight Forwarder</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          A company that organizes shipments for individuals or corporations to get goods from manufacturer to market. 
                          They handle logistics, customs documentation, and coordinate with carriers. Examples: DHL Global Forwarding, 
                          Kuehne + Nagel, DB Schenker.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="freightForwarder"
                  value={formData.freightForwarder}
                  onChange={(e) =>
                    setFormData({ ...formData, freightForwarder: e.target.value })
                  }
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this shipment..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items Section */}
        <Card>
          <CardHeader>
            <CardTitle>Items (Optional)</CardTitle>
            <CardDescription>
              Add products from your classifications to this shipment. You can also add items later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              const availableClassifications = selectedProduct?.classifications || [];

              return (
                <Card key={index} className="border-2">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Item {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItemRow(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`item-product-${index}`}>
                        Product <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, "productId", value)}
                      >
                        <SelectTrigger id={`item-product-${index}`}>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                              {product.classifications.length > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({product.classifications.length} classification
                                  {product.classifications.length !== 1 ? "s" : ""})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProduct && availableClassifications.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor={`item-classification-${index}`}>
                          Classification (Optional)
                        </Label>
                        <Select
                          value={item.classificationId || "none"}
                          onValueChange={(value) =>
                            updateItem(index, "classificationId", value === "none" ? "" : value)
                          }
                        >
                          <SelectTrigger id={`item-classification-${index}`}>
                            <SelectValue placeholder="Select a classification (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No classification</SelectItem>
                            {availableClassifications.map((classification) => (
                              <SelectItem key={classification.id} value={classification.id}>
                                {classification.htsCode
                                  ? `HTS: ${classification.htsCode.substring(0, 8)}`
                                  : "Unclassified"}
                                {classification.dossier && (
                                  <span className="ml-2 text-xs text-green-600">✓ Dossier Ready</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Selecting a classification will automatically copy CN/HS/HTS codes and
                          duty rates to this item.
                        </p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`item-quantity-${index}`}>
                          Quantity <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`item-quantity-${index}`}
                          type="number"
                          step="1"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          placeholder="0"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`item-unitValue-${index}`}>
                          Unit Value (€) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`item-unitValue-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitValue}
                          onChange={(e) => updateItem(index, "unitValue", e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`item-notes-${index}`}>Notes</Label>
                      <Textarea
                        id={`item-notes-${index}`}
                        value={item.notes}
                        onChange={(e) => updateItem(index, "notes", e.target.value)}
                        placeholder="Additional notes about this item..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Button type="button" variant="outline" onClick={addItemRow} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/shipments">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Shipment"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

