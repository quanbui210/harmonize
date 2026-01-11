import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { ComplianceChatLayout } from "@/components/compliance/compliance-chat-layout";

export default async function ComplianceChatPage() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  return (
    <ComplianceChatLayout
      organizationId={membership.organizationId}
      userId={user.id}
    />
  );
}

