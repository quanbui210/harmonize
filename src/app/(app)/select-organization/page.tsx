import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getAllUserMemberships, getSelectedOrganizationId } from "@/server/queries/organizations";
import { SelectOrganizationClient } from "@/components/organizations/select-organization-client";

export default async function SelectOrganizationPage() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login");
  }

  const memberships = await getAllUserMemberships(user.id);

  // If user has no organizations, redirect to login (shouldn't happen)
  if (memberships.length === 0) {
    redirect("/login?error=no_organization");
  }

  // If user has only one organization, auto-select it
  if (memberships.length === 1) {
    const orgId = memberships[0].organizationId;
    const selectedOrgId = await getSelectedOrganizationId(user.id);
    
    // Only redirect if not already selected
    if (selectedOrgId !== orgId) {
      const { setSelectedOrganization } = await import("@/server/queries/organizations");
      await setSelectedOrganization(orgId);
    }
    redirect("/dashboard");
  }

  // User has multiple organizations - show selection page
  return <SelectOrganizationClient memberships={memberships} />;
}

