
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireSystemAdmin() {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // Check database role
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { systemRole: true },
  });

  if (!dbUser || dbUser.systemRole !== "ADMIN") {
    // Log unauthorized attempt?
    console.warn(`Unauthorized admin access attempt by ${user.email}`);
    redirect("/"); // Redirect to home or a "Not Authorized" page
  }

  return user;
}
