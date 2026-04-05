import Link from "next/link";
import { redirect } from "next/navigation";
import { getInvitationByTokenAction } from "@/server/actions/organizations";
import { getOptionalUser } from "@/lib/supabase/auth";
import { AcceptInviteClient } from "./accept-invite-client";

type InviteAcceptPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  const token = searchParams?.token?.trim();
  if (!token) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-xl border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Invalid Invitation Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation link is missing a token.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const [invitationResult, user] = await Promise.all([
    getInvitationByTokenAction(token),
    getOptionalUser(),
  ]);

  if (invitationResult.status === "accepted") {
    redirect("/login?redirectTo=/dashboard");
  }

  return (
    <AcceptInviteClient
      token={token}
      invitationResult={invitationResult}
      initialUserEmail={user?.email ?? null}
    />
  );
}
