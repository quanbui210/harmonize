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
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { addShipmentItemAction } from "@/server/actions/shipments";

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

type Shipment = {
  id: string;
  shipmentNumber: string;
};

type Props = {
  shipment: Shipment;
  products: Product[];
  organizationId: string;
};

type ItemFormData = {
  productId: string;
  classificationId: string;
  quantity: string;
  unitValue: string;
  notes: string;
};

export function AddShipmentItemForm({ shipment, products, organizationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ItemFormData[]>([
    {
      productId: "",
      classificationId: "",
      quantity: "",
      unitValue: "",
      notes: "",
    },
  ]);

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
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
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

    // Validate all items
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

    startTransition(async () => {
      try {
        // Add all items
        await Promise.all(
          items.map((item) =>
            addShipmentItemAction(shipment.id, {
              productId: item.productId,
              classificationId: item.classificationId || undefined,
              quantity: parseFloat(item.quantity),
              unitValue: parseFloat(item.unitValue),
              notes: item.notes || undefined,
            }),
          ),
        );

        router.push(`/shipments/${shipment.id}`);
      } catch (err) {
        console.error("Failed to add items:", err);
        setError(err instanceof Error ? err.message : "Failed to add items to shipment");
      }
    });
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/shipments/${shipment.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shipment
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight">
          Add Item to {shipment.shipmentNumber}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Add Items to Shipment</CardTitle>
            <CardDescription>
              Add one or more products from your classifications to this shipment. Select products and their classifications, 
              then specify quantities and unit values. CN/HS/HTS codes and duty rates will be automatically copied from the classifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {items.map((item, index) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              const availableClassifications = selectedProduct?.classifications || [];

              return (
                <Card key={index} className="border-2">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Item {index + 1}</CardTitle>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemRow(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`product-${index}`}>
                        Product <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, "productId", value)}
                      >
                        <SelectTrigger id={`product-${index}`}>
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
                        <Label htmlFor={`classification-${index}`}>Classification (Optional)</Label>
                        <Select
                          value={item.classificationId || "none"}
                          onValueChange={(value) => updateItem(index, "classificationId", value === "none" ? "" : value)}
                        >
                          <SelectTrigger id={`classification-${index}`}>
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
                          Selecting a classification will automatically copy CN/HS/HTS codes and duty rates
                          to this item.
                        </p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`quantity-${index}`}>
                          Quantity <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`quantity-${index}`}
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
                        <Label htmlFor={`unitValue-${index}`}>
                          Unit Value (€) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`unitValue-${index}`}
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
                      <Label htmlFor={`notes-${index}`}>Notes</Label>
                      <Textarea
                        id={`notes-${index}`}
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

            <Button
              type="button"
              variant="outline"
              onClick={addItemRow}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Item
            </Button>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" asChild>
                <Link href={`/shipments/${shipment.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding {items.length} item{items.length !== 1 ? "s" : ""}...
                  </>
                ) : (
                  `Add ${items.length} Item${items.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

