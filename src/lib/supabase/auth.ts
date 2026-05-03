import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

async function getBearerUser() {
  try {
    const authHeader = headers().get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    return data.user;
  }

  const bearerUser = await getBearerUser();
  if (bearerUser) {
    return bearerUser;
  }

  redirect("/login");
}

export async function getOptionalUser() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return data.user;
  }

  return await getBearerUser();
}

