import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getSelectedOrganizationId, getAllUserMemberships } from "@/server/queries/organizations";
import { getMembersAction, getInvitationsAction } from "@/server/actions/organizations";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";
import { MembershipRole } from "@prisma/client";

export default async function SettingsPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }

  const memberships = await getAllUserMemberships(user.id);
  const selectedOrgId = await getSelectedOrganizationId(user.id);
  
  if (!selectedOrgId) {
    redirect("/select-organization");
  }

  const membership = memberships.find((m) => m.organizationId === selectedOrgId);
  if (!membership) {
    redirect("/select-organization");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: selectedOrgId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      logoUrl: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!organization) {
    redirect("/dashboard");
  }

  // Get members and invitations (only if user is OWNER or ADMIN)
  let members: { id: string; role: MembershipRole; createdAt: Date; user: { id: string; email: string; fullName: string | null; }; }[] = [];
  let invitations: Awaited<ReturnType<typeof getInvitationsAction>> = [];
  
  if (membership.role === "OWNER" || membership.role === "ADMIN") {
    try {
      [members, invitations] = await Promise.all([
        getMembersAction(selectedOrgId),
        getInvitationsAction(selectedOrgId),
      ]);
    } catch (error) {
      console.error("Failed to load members/invitations:", error);
    }
  }

  return (
    <SettingsClient
      organization={organization}
      currentMembership={membership}
      members={members}
      invitations={invitations}
    />
  );
}

