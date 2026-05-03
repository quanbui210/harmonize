import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ShipmentStatus } from "@prisma/client";
import { getShipmentAction, updateShipmentAction } from "@/server/actions/shipments";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const updateShipmentSchema = z.object({
  shipmentNumber: z.string().min(1).optional(),
  status: z.nativeEnum(ShipmentStatus).optional(),
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  shippingDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  customsDeclarationNumber: z.string().optional(),
  invoiceValue: z.number().optional(),
  totalDuty: z.number().optional(),
  incoterms: z.string().optional(),
  carrier: z.string().optional(),
  freightForwarder: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  try {
    await requireApiAuth(request);
    const { shipmentId } = await params;
    const shipment = await getShipmentAction(shipmentId);
    return NextResponse.json({ shipment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  try {
    await requireApiAuth(request);
    const { shipmentId } = await params;
    const body = await request.json();
    const payload = updateShipmentSchema.parse(body);
    const shipment = await updateShipmentAction(shipmentId, payload);
    return NextResponse.json({ shipment });
  } catch (error) {
    return handleApiError(error);
  }
}
