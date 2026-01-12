"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { ShipmentType, ShipmentStatus } from "@prisma/client";
import { createAuditLogEntry } from "./audit-log";

export async function createShipmentAction(input: {
  shipmentNumber: string;
  type: ShipmentType;
  originCountry?: string;
  destinationCountry?: string;
  shippingDate?: string;
  arrivalDate?: string;
  customsDeclarationNumber?: string;
  invoiceValue?: number;
  incoterms?: string;
  carrier?: string;
  freightForwarder?: string;
  notes?: string;
  items?: Array<{
    productId: string;
    classificationId?: string;
    quantity: number;
    unitValue: number;
    notes?: string;
  }>;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const shipment = await prisma.shipment.create({
    data: {
      organizationId: membership.organizationId,
      shipmentNumber: input.shipmentNumber,
      type: input.type,
      status: ShipmentStatus.DRAFT,
      originCountry: input.originCountry || null,
      destinationCountry: input.destinationCountry || null,
      shippingDate: input.shippingDate ? new Date(input.shippingDate) : null,
      arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
      customsDeclarationNumber: input.customsDeclarationNumber || null,
      invoiceValue: input.invoiceValue ? input.invoiceValue : null,
      incoterms: input.incoterms || null,
      carrier: input.carrier || null,
      freightForwarder: input.freightForwarder || null,
      notes: input.notes || null,
    },
  });

  // Add items if provided
  if (input.items && input.items.length > 0) {
    for (const itemInput of input.items) {
      // Get classification if provided, to copy CN/HS/HTS codes
      let cnCode: string | null = null;
      let hsCode: string | null = null;
      let htsCode: string | null = null;
      let dutyRate: number | null = null;

      if (itemInput.classificationId) {
        const classification = await prisma.classification.findFirst({
          where: {
            id: itemInput.classificationId,
            organizationId: membership.organizationId,
          },
          include: {
            dutySummary: true,
          },
        });

        if (classification) {
          hsCode = classification.hsCode || null;
          htsCode = classification.htsCode || null;
          cnCode = htsCode ? htsCode.substring(0, 8) : null;
          dutyRate = classification.dutySummary?.dutyRate
            ? Number(classification.dutySummary.dutyRate)
            : null;
        }
      }

      await prisma.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          productId: itemInput.productId,
          classificationId: itemInput.classificationId || null,
          quantity: itemInput.quantity,
          unitValue: itemInput.unitValue,
          cnCode,
          hsCode,
          htsCode,
          dutyRate,
          notes: itemInput.notes || null,
        },
      });
    }
  }

  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "SHIPMENT",
    entityId: shipment.id,
    action: "CREATE",
    payload: {
      shipmentNumber: input.shipmentNumber,
      type: input.type,
      itemCount: input.items?.length || 0,
    },
  });

  // Fetch shipment with items to return
  const shipmentWithItems = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: {
      items: {
        include: {
          product: true,
          classification: {
            include: {
              dossier: true,
              dutySummary: true,
            },
          },
        },
      },
    },
  });

  if (!shipmentWithItems) {
    return shipment;
  }

  // Convert Decimal to number for client components
  return {
    ...shipmentWithItems,
    invoiceValue: shipmentWithItems.invoiceValue ? Number(shipmentWithItems.invoiceValue) : null,
    totalDuty: shipmentWithItems.totalDuty ? Number(shipmentWithItems.totalDuty) : null,
    items: shipmentWithItems.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitValue: Number(item.unitValue),
      dutyRate: item.dutyRate ? Number(item.dutyRate) : null,
      classification: item.classification
        ? {
            ...item.classification,
            confidence: item.classification.confidence
              ? Number(item.classification.confidence)
              : null,
            dutySummary: item.classification.dutySummary
              ? {
                  ...item.classification.dutySummary,
                  dutyRate: item.classification.dutySummary.dutyRate
                    ? Number(item.classification.dutySummary.dutyRate)
                    : null,
                }
              : null,
          }
        : null,
    })),
  };
}

export async function listShipmentsAction(input: {
  status?: ShipmentStatus;
  type?: ShipmentType;
  limit?: number;
  offset?: number;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const where: any = {
    organizationId: membership.organizationId,
  };

  if (input.status) {
    where.status = input.status;
  }

  if (input.type) {
    where.type = input.type;
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
            classification: {
              include: {
                dossier: true,
              },
            },
          },
        },
        documents: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit || 50,
      skip: input.offset || 0,
    }),
    prisma.shipment.count({ where }),
  ]);

  // Convert Decimal to number for client components
  const serializedShipments = shipments.map((shipment) => ({
    ...shipment,
    invoiceValue: shipment.invoiceValue ? Number(shipment.invoiceValue) : null,
    totalDuty: shipment.totalDuty ? Number(shipment.totalDuty) : null,
    items: shipment.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitValue: Number(item.unitValue),
      dutyRate: item.dutyRate ? Number(item.dutyRate) : null,
    })),
  }));

  return { shipments: serializedShipments, total };
}

export async function getShipmentAction(shipmentId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      organizationId: membership.organizationId,
    },
    include: {
      items: {
        include: {
          product: true,
          classification: {
            include: {
              dossier: true,
              dutySummary: true,
            },
          },
        },
      },
      documents: true,
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  // Convert Decimal to number for client components
  return {
    ...shipment,
    invoiceValue: shipment.invoiceValue ? Number(shipment.invoiceValue) : null,
    totalDuty: shipment.totalDuty ? Number(shipment.totalDuty) : null,
    items: shipment.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitValue: Number(item.unitValue),
      dutyRate: item.dutyRate ? Number(item.dutyRate) : null,
      classification: item.classification
        ? {
            ...item.classification,
            confidence: item.classification.confidence
              ? Number(item.classification.confidence)
              : null,
            dutySummary: item.classification.dutySummary
              ? {
                  ...item.classification.dutySummary,
                  dutyRate: item.classification.dutySummary.dutyRate
                    ? Number(item.classification.dutySummary.dutyRate)
                    : null,
                }
              : null,
          }
        : null,
    })),
  };
}

export async function updateShipmentAction(
  shipmentId: string,
  input: {
    shipmentNumber?: string;
    status?: ShipmentStatus;
    originCountry?: string;
    destinationCountry?: string;
    shippingDate?: string;
    arrivalDate?: string;
    customsDeclarationNumber?: string;
    invoiceValue?: number;
    totalDuty?: number;
    incoterms?: string;
    carrier?: string;
    freightForwarder?: string;
    notes?: string;
  },
) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      organizationId: membership.organizationId,
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      shipmentNumber: input.shipmentNumber,
      status: input.status,
      originCountry: input.originCountry,
      destinationCountry: input.destinationCountry,
      shippingDate: input.shippingDate ? new Date(input.shippingDate) : undefined,
      arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : undefined,
      customsDeclarationNumber: input.customsDeclarationNumber,
      invoiceValue: input.invoiceValue,
      totalDuty: input.totalDuty,
      incoterms: input.incoterms,
      carrier: input.carrier,
      freightForwarder: input.freightForwarder,
      notes: input.notes,
    },
  });

  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "SHIPMENT",
    entityId: shipmentId,
    action: "UPDATE",
    payload: {
      status: input.status,
      shipmentNumber: input.shipmentNumber,
    },
  });

  return updated;
}

export async function addShipmentItemAction(
  shipmentId: string,
  input: {
    productId: string;
    classificationId?: string;
    quantity: number;
    unitValue: number;
    notes?: string;
  },
) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  // Verify shipment belongs to organization
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      organizationId: membership.organizationId,
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  // Get classification if provided, to copy CN/HS/HTS codes
  let cnCode: string | null = null;
  let hsCode: string | null = null;
  let htsCode: string | null = null;
  let dutyRate: number | null = null;

  if (input.classificationId) {
    const classification = await prisma.classification.findFirst({
      where: {
        id: input.classificationId,
        organizationId: membership.organizationId,
      },
      include: {
        dutySummary: true,
      },
    });

    if (classification) {
      hsCode = classification.hsCode || null;
      htsCode = classification.htsCode || null;
      cnCode = htsCode ? htsCode.substring(0, 8) : null;
      dutyRate = classification.dutySummary?.dutyRate
        ? Number(classification.dutySummary.dutyRate)
        : null;
    }
  }

  const item = await prisma.shipmentItem.create({
    data: {
      shipmentId,
      productId: input.productId,
      classificationId: input.classificationId || null,
      quantity: input.quantity,
      unitValue: input.unitValue,
      cnCode,
      hsCode,
      htsCode,
      dutyRate,
      notes: input.notes || null,
    },
  });

  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "SHIPMENT_ITEM",
    entityId: item.id,
    action: "CREATE",
    payload: {
      shipmentId,
      productId: input.productId,
      classificationId: input.classificationId,
    },
  });

  return item;
}

export async function removeShipmentItemAction(itemId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  // Verify item belongs to shipment in organization
  const item = await prisma.shipmentItem.findFirst({
    where: { id: itemId },
    include: {
      shipment: true,
    },
  });

  if (!item || item.shipment.organizationId !== membership.organizationId) {
    throw new Error("Shipment item not found");
  }

  await prisma.shipmentItem.delete({
    where: { id: itemId },
  });

  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "SHIPMENT_ITEM",
    entityId: itemId,
    action: "DELETE",
    payload: {
      shipmentId: item.shipmentId,
    },
  });

  return { success: true };
}

export async function deleteShipmentAction(shipmentId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      organizationId: membership.organizationId,
    },
  });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  await prisma.shipment.delete({
    where: { id: shipmentId },
  });

  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "SHIPMENT",
    entityId: shipmentId,
    action: "DELETE",
    payload: {
      shipmentNumber: shipment.shipmentNumber,
    },
  });

  return { success: true };
}

