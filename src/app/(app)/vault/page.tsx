import { getOptionalUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { VaultDashboard } from "@/components/vault/vault-dashboard";

export default async function VaultPage() {
  const user = await getOptionalUser();
  if (!user) {
    return null;
  }

  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Compliance Vault
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage supplier documents and audit-ready evidence
        </p>
      </div>

      <VaultDashboard organizationId={membership.organizationId} />
    </div>
  );
}

