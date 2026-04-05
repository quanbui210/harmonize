"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { acceptInvitationAction } from "@/server/actions/organizations";
import { useToast } from "@/components/ui/use-toast";

type InvitationResult =
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "accepted" }
  | {
      status: "valid";
      invitation: {
        email: string;
        role: string;
        organizationName: string;
        invitedByName: string;
        expiresAt: Date;
      };
    };

type Props = {
  token: string;
  invitationResult: InvitationResult;
  initialUserEmail: string | null;
};

function getInviteRedirectPath(token: string) {
  return `/invite/accept?token=${encodeURIComponent(token)}&complete=1`;
}

export function AcceptInviteClient({ token, invitationResult, initialUserEmail }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentEmail, setCurrentEmail] = useState<string | null>(initialUserEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canAccept = invitationResult.status === "valid";
  const invite = invitationResult.status === "valid" ? invitationResult.invitation : null;
  const normalizedCurrentEmail = currentEmail?.trim().toLowerCase() ?? null;
  const normalizedInviteEmail = invite?.email?.trim().toLowerCase() ?? null;
  const emailMatchesInvite = Boolean(
    normalizedCurrentEmail &&
      normalizedInviteEmail &&
      normalizedCurrentEmail === normalizedInviteEmail
  );

  const expiresAtText = useMemo(() => {
    if (!invite) {
      return null;
    }
    return new Date(invite.expiresAt).toLocaleString();
  }, [invite]);

  async function refreshCurrentUser() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentEmail(user?.email ?? null);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    if (!invite) {
      return;
    }

    setIsWorking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectPath = getInviteRedirectPath(token);
      const redirectTo = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
        redirectPath
      )}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        throw error;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      setIsWorking(false);
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: error?.message ?? "Please try again.",
      });
    }
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite) {
      return;
    }
    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }

    setIsCreatingAccount(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectPath = getInviteRedirectPath(token);
      const redirectTo = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
        redirectPath
      )}`;
      const { data, error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: fullName ? { full_name: fullName } : undefined,
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setStatusMessage("Account created. You can now accept the invitation.");
        await refreshCurrentUser();
      } else {
        setStatusMessage("Account created. Please confirm your email, then open this invitation link again.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to create account",
        description: error?.message ?? "Please try again.",
      });
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleSignInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite) {
      return;
    }

    setIsSigningIn(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });

      if (error) {
        throw error;
      }

      setStatusMessage("Signed in successfully.");
      await refreshCurrentUser();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: error?.message ?? "Please check your password and try again.",
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!invite) {
      return;
    }
    setIsWorking(true);
    try {
      await acceptInvitationAction(token);
      toast({
        variant: "success",
        title: "Invitation accepted",
        description: `You joined ${invite.organizationName}.`,
      });
      router.push("/dashboard");
    } catch (error: any) {
      setIsWorking(false);
      toast({
        variant: "destructive",
        title: "Could not accept invitation",
        description: error?.message ?? "Please try again.",
      });
    }
  }

  async function handleSignOut() {
    setIsWorking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setCurrentEmail(null);
      router.refresh();
    } finally {
      setIsWorking(false);
    }
  }

  if (invitationResult.status === "not_found") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>This invitation link is invalid or has been removed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Go to Login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitationResult.status === "expired") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>Ask your organization admin to send a new invitation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Go to Login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccept || !invite) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <Badge className="w-fit">Workspace Invitation</Badge>
          <CardTitle className="text-2xl">Join {invite.organizationName}</CardTitle>
          <CardDescription>
            {invite.invitedByName} invited you as {invite.role}. This link expires {expiresAtText}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              Invitation email: <span className="font-medium">{invite.email}</span>
            </p>
            {currentEmail ? (
              <p className="mt-1">
                Signed in as: <span className="font-medium">{currentEmail}</span>
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Sign in with the invited email to continue.</p>
            )}
          </div>

          {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}

          {!currentEmail ? (
            <div className="space-y-5">
              <Button type="button" onClick={handleGoogleSignIn} disabled={isWorking} className="w-full">
                Continue with Google
              </Button>

              <form onSubmit={handleCreateAccount} className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Create Member Account</p>
                <p className="text-xs text-muted-foreground">
                  Create an email/password account for {invite.email}. Password is securely hashed by Supabase.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name (optional)</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={isCreatingAccount}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createPassword">Password</Label>
                  <Input
                    id="createPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={isCreatingAccount}
                    required
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={isCreatingAccount}>
                  {isCreatingAccount ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <form onSubmit={handleSignInWithPassword} className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Already have a password account?</p>
                <div className="space-y-2">
                  <Label htmlFor="signInPassword">Password</Label>
                  <Input
                    id="signInPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSigningIn}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" disabled={isSigningIn}>
                  {isSigningIn ? "Signing in..." : "Sign in with password"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {!emailMatchesInvite ? (
                <>
                  <p className="text-sm text-destructive">
                    This invite is for {invite.email}. Sign in with that account to continue.
                  </p>
                  <Button type="button" variant="outline" onClick={handleSignOut} disabled={isWorking}>
                    Sign out and switch account
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={handleAcceptInvitation} disabled={isWorking}>
                  {isWorking ? "Joining workspace..." : "Accept Invitation"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
