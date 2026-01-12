import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { listShipmentsAction } from "@/server/actions/shipments";
import { ShipmentsPageClient } from "@/components/shipments/shipments-page-client";
import { ShipmentStatus, ShipmentType } from "@prisma/client";

export default async function ShipmentsPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    return <div>No organization found</div>;
  }

  const { shipments, total } = await listShipmentsAction({
    limit: 50,
    offset: 0,
  });

  return (
    <ShipmentsPageClient
      initialShipments={shipments}
      total={total}
      organizationId={membership.organizationId}
    />
  );
}

