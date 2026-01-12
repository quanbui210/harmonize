import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getShipmentAction } from "@/server/actions/shipments";
import { ShipmentDetailPageClient } from "@/components/shipments/shipment-detail-page-client";
import { redirect } from "next/navigation";

type Props = {
  params: { shipmentId: string };
};

export default async function ShipmentDetailPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  try {
    const shipment = await getShipmentAction(params.shipmentId);
    return (
      <ShipmentDetailPageClient
        shipment={shipment as any}
        organizationId={membership.organizationId}
      />
    );
  } catch (error) {
    redirect("/shipments");
  }
}

