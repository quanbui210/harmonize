import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { CreateShipmentForm } from "@/components/shipments/create-shipment-form";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewShipmentPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

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
    <CreateShipmentForm
      organizationId={membership.organizationId}
      products={products}
    />
  );
}

