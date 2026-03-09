
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Use Service Role Key to bypass RLS and manage users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function main() {
  const email = "admin@admin.com";
  const password = "password";
  const fullName = "System Admin";

  console.log(`Seeding admin user: ${email}...`);

  // 1. Create User in Supabase Auth
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already has been registered")) {
      console.log("User already exists in Supabase Auth. Fetching ID...");
      // Fetch user ID by email (requires listUsers)
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.users.find((u) => u.email === email);
      if (!existingUser) {
        throw new Error("Could not find existing user ID");
      }
      userId = existingUser.id;
    } else {
      throw authError;
    }
  } else {
    userId = authUser.user.id;
    console.log(`Created Supabase Auth user: ${userId}`);
  }

  // 2. Create or Update User in Prisma (Public Schema)
  // We use systemRole: "ADMIN"
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      systemRole: "ADMIN",
    },
    create: {
      id: userId,
      email,
      fullName,
      authProviderId: userId,
      systemRole: "ADMIN",
    },
  });

  console.log(`Synced Admin User to Database: ${user.id} (${user.systemRole})`);

  // 3. Ensure they have an organization (optional, but good for testing app features)
  const orgName = "Admin Workspace";
  const orgSlug = "admin-workspace";

  // Check if user has any membership
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });

  if (!membership) {
    console.log("Creating default organization for admin...");
    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
        createdById: user.id,
        memberships: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });
    console.log(`Created Organization: ${org.id}`);
  } else {
    console.log("Admin already has an organization.");
  }

  console.log("\nDone! You can now login with:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
