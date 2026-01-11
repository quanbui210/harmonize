import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { ComplianceChatLayout } from "@/components/compliance/compliance-chat-layout";
import { getChatSessionAction } from "@/server/actions/compliance-chat";

type Props = {
  params: { sessionId: string };
};

export default async function ComplianceChatSessionPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  let sessionData = null;
  try {
    sessionData = await getChatSessionAction({
      sessionId: params.sessionId,
      organizationId: membership.organizationId,
      userId: user.id,
    });
  } catch (error) {
    // Session not found, redirect to new chat
    redirect("/compliance-chat");
  }

  return (
    <ComplianceChatLayout
      organizationId={membership.organizationId}
      userId={user.id}
      sessionId={params.sessionId}
      initialMessages={sessionData.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
        createdAt: new Date(msg.createdAt),
      }))}
    />
  );
}

