"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type ChangePasswordClientProps = {
  email: string | null;
};

export function ChangePasswordClient({ email }: ChangePasswordClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
      });
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          must_change_password: false,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        variant: "success",
        title: "Password updated",
        description: "Welcome! You can now continue to your workspace.",
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update password",
        description: error?.message || "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            First login detected{email ? ` for ${email}` : ""}. You must set a new password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSaving}
                required
              />
            </div>
            <Button type="submit" disabled={isSaving} className="w-full">
              {isSaving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
