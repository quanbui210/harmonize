import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { updateProductAction } from "@/server/actions/products";
import { updateProductSchema } from "@/lib/validation/product";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const updateProductApiSchema = updateProductSchema.omit({
  organizationId: true,
  productId: true,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { productId } = await params;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: membership.organizationId,
      },
      include: {
        materials: true,
        images: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const supabase = getSupabaseAdminClient();
    const images = await Promise.all(
      product.images.map(async (image) => {
        const { data } = await supabase.storage
          .from("product-images")
          .createSignedUrl(image.storagePath, 3600);

        return {
          ...image,
          signedUrl: data?.signedUrl ?? null,
        };
      }),
    );

    return NextResponse.json({
      product: {
        ...product,
        images,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { productId } = await params;
    const body = await request.json();
    const payload = updateProductApiSchema.parse(body);

    const product = await updateProductAction({
      ...payload,
      productId,
      organizationId: membership.organizationId,
    });

    return NextResponse.json({ product });
  } catch (error) {
    return handleApiError(error);
  }
}
