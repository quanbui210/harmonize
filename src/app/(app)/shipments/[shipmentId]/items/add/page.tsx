import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getShipmentAction } from "@/server/actions/shipments";
import { AddShipmentItemForm } from "@/components/shipments/add-shipment-item-form";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Props = {
  params: { shipmentId: string };
};

export default async function AddShipmentItemPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  try {
    const shipment = await getShipmentAction(params.shipmentId);
    
    // Get all products and their classifications for this organization
    const products = await prisma.product.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      include: {
        classifications: {
          where: {
            market: "EU", // Default to EU for now
          },
          include: {
            dossier: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to recent products
    });

    return (
      <AddShipmentItemForm
        shipment={shipment}
        products={products}
        organizationId={membership.organizationId}
      />
    );
  } catch (error) {
    redirect(`/shipments/${params.shipmentId}`);
  }
}

