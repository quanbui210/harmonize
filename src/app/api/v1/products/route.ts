import { NextRequest, NextResponse } from "next/server";
import { createProductAction, listProductsAction } from "@/server/actions/products";
import { createProductSchema } from "@/lib/validation/product";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const createProductApiSchema = createProductSchema.omit({
  organizationId: true,
  createdById: true,
});

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const products = await listProductsAction(membership.organizationId);
    return NextResponse.json({ products });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const body = await request.json();
    const payload = createProductApiSchema.parse(body);

    const product = await createProductAction({
      ...payload,
      organizationId: membership.organizationId,
      createdById: user.id,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
