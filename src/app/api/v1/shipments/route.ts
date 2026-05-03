import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ShipmentStatus, ShipmentType } from "@prisma/client";
import { createShipmentAction, listShipmentsAction } from "@/server/actions/shipments";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const createShipmentApiSchema = z.object({
  shipmentNumber: z.string().min(1),
  type: z.nativeEnum(ShipmentType),
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  shippingDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  customsDeclarationNumber: z.string().optional(),
  invoiceValue: z.number().optional(),
  incoterms: z.string().optional(),
  carrier: z.string().optional(),
  freightForwarder: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        classificationId: z.string().cuid().optional(),
        quantity: z.number().positive(),
        unitValue: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const status = request.nextUrl.searchParams.get("status");
    const type = request.nextUrl.searchParams.get("type");
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const offset = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

    const data = await listShipmentsAction({
      status:
        status && status in ShipmentStatus
          ? (status as ShipmentStatus)
          : undefined,
      type:
        type && type in ShipmentType
          ? (type as ShipmentType)
          : undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const payload = createShipmentApiSchema.parse(body);
    const shipment = await createShipmentAction(payload);
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
