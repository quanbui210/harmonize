import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { ChangePasswordClient } from "./change-password-client";

export default async function ChangePasswordPage() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login?redirectTo=/change-password");
  }

  return <ChangePasswordClient email={user.email ?? null} />;
}
