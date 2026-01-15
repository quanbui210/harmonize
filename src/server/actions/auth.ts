"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

