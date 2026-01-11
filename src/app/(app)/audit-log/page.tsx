import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getAuditLogsAction } from "@/server/actions/audit-log";
import { AuditLogPageClient } from "@/components/audit-log/audit-log-page-client";

export default async function AuditLogPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }

  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    redirect("/login?error=organization");
  }

  const logs = await getAuditLogsAction({
    organizationId: membership.organizationId,
    limit: 100,
  });

  return (
    <AuditLogPageClient
      initialLogs={logs}
      organizationId={membership.organizationId}
    />
  );
}

