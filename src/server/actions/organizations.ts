"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getMembership, setSelectedOrganization } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { MembershipRole } from "@prisma/client";
import { createAuditLogEntry } from "@/server/actions/audit-log";
import { slugify } from "@/lib/utils";
import { createInvitationToken, hashInvitationToken } from "@/lib/invitations/token";
import { sendEmailWithSendGrid } from "@/lib/email/sendgrid";
import { buildOrganizationInviteEmail } from "@/lib/email/templates/organization-invite";
import { ensureUserWorkspace } from "@/lib/users/sync-user";
import {
  buildTenantScopedUsername,
  employeeUsernameToEmail,
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/employee-accounts";

const INVITATION_EXPIRY_DAYS = 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function findInvitationByToken(token: string) {
  if (!token) {
    return null;
  }
  const tokenHash = hashInvitationToken(token);
  const includeConfig = {
    organization: true,
    invitedBy: true,
  } as const;

  // Primary lookup: hashed token (new secure format).
  let invitation = await prisma.organizationInvitation.findUnique({
    where: { token: tokenHash },
    include: includeConfig,
  });

  // Backward compatibility for existing raw tokens.
  if (!invitation) {
    invitation = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: includeConfig,
    });
  }

  return invitation;
}

export async function selectOrganizationAction(organizationId: string) {
  const user = await requireAuthenticatedUser();
  
  // Verify user has access to this organization
  const membership = await getMembership(user.id, organizationId);
  if (!membership) {
    throw new Error("You don't have access to this organization");
  }

  // Set selected organization in cookie
  await setSelectedOrganization(organizationId);

  // Redirect to dashboard
  redirect("/dashboard");
}

export async function updateOrganizationActionForm(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const organizationId = formData.get("organizationId") as string;
  const name = formData.get("name") as string | null;
  const logoFile = formData.get("logoFile") as File | null;

  const membership = await getMembership(user.id, organizationId);
  
  if (!membership) {
    throw new Error("Unauthorized");
  }

  // Only OWNER and ADMIN can update organization
  if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
    throw new Error("Only owners and admins can update organization settings");
  }

  const updateData: { name?: string; slug?: string; logoUrl?: string } = {};

  if (name) {
    updateData.name = name;
    // Update slug when name changes
    const baseSlug = slugify(name) || "organization";
    const existing = await prisma.organization.findFirst({
      where: {
        slug: { startsWith: baseSlug },
        id: { not: organizationId },
      },
    });
    updateData.slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;
  }

  // Handle logo upload
  if (logoFile && logoFile.size > 0) {
    const supabase = getSupabaseAdminClient();
    const fileExtension = logoFile.name.split(".").pop() || "png";
    const storagePath = `${organizationId}/logo/${Date.now()}.${fileExtension}`;

    const arrayBuffer = await logoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try to upload to organization-assets bucket, create it if it doesn't exist
    let uploadError = null;
    try {
      const { error } = await supabase.storage
        .from("organization-assets")
        .upload(storagePath, buffer, {
          contentType: logoFile.type || "image/png",
          upsert: true,
        });
      uploadError = error;
    } catch (err: any) {
      // If bucket doesn't exist, try creating it first (this might fail if no permissions)
      console.error("Upload error, bucket might not exist:", err);
      throw new Error(`Storage bucket 'organization-assets' might not exist. Please create it in Supabase Storage. Error: ${err.message}`);
    }

    if (uploadError) {
      // Check if it's a bucket not found error
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        throw new Error(`Storage bucket 'organization-assets' not found. Please create it in Supabase Storage → Buckets.`);
      }
      throw new Error(`Failed to upload logo: ${uploadError.message}`);
    }

    // Get public URL
    const { data } = await supabase.storage
      .from("organization-assets")
      .getPublicUrl(storagePath);

    if (!data?.publicUrl) {
      throw new Error("Failed to get public URL for uploaded logo");
    }

    updateData.logoUrl = data.publicUrl;
    console.log("Logo uploaded successfully:", data.publicUrl);
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: updateData,
  });

  await createAuditLogEntry({
    organizationId,
    userId: user.id,
    entityType: "ORGANIZATION",
    entityId: updated.id,
    action: "UPDATE",
    payload: {
      changes: Object.keys(updateData),
    },
  });

  return updated;
}

export async function updateOrganizationAction(input: {
  organizationId: string;
  name?: string;
  logoFile?: File | null;
}) {
  const formData = new FormData();
  formData.append("organizationId", input.organizationId);
  if (input.name) {
    formData.append("name", input.name);
  }
  if (input.logoFile) {
    formData.append("logoFile", input.logoFile);
  }
  return updateOrganizationActionForm(formData);
}

export async function sendInvitationAction(input: {
  organizationId: string;
  email: string;
  role: MembershipRole;
  inviteMode?: "standard" | "create_account";
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, input.organizationId);
  const normalizedEmail = normalizeEmail(input.email);
  
  if (!membership) {
    throw new Error("Unauthorized");
  }

  // Only OWNER and ADMIN can send invitations
  if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
    throw new Error("Only owners and admins can send invitations");
  }

  // Cannot invite as OWNER (only first user gets OWNER)
  if (input.role === MembershipRole.OWNER) {
    throw new Error("Cannot invite users as OWNER");
  }

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        where: { organizationId: input.organizationId },
      },
    },
  });

  if (existingUser && existingUser.memberships.length > 0) {
    throw new Error("User is already a member of this organization");
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.organizationInvitation.findUnique({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: normalizedEmail,
      },
    },
  });

  if (existingInvitation && !existingInvitation.acceptedAt) {
    if (existingInvitation.expiresAt > new Date()) {
      throw new Error("An invitation is already pending for this email");
    }
    // Delete expired invitation
    await prisma.organizationInvitation.delete({
      where: { id: existingInvitation.id },
    });
  }

  // Generate secure invitation token, persist only hash in database.
  const { rawToken, tokenHash } = createInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: input.organizationId,
      email: normalizedEmail,
      role: input.role,
      invitedById: user.id,
      token: tokenHash,
      expiresAt,
    },
    include: {
      organization: true,
      invitedBy: true,
    },
  });

  const acceptUrl = `${getAppUrl()}/invite/accept?token=${encodeURIComponent(rawToken)}`;
  const inviterName = invitation.invitedBy.fullName || invitation.invitedBy.email;
  const emailContent = buildOrganizationInviteEmail({
    organizationName: invitation.organization.name,
    inviteeEmail: normalizedEmail,
    inviterName,
    role: input.role,
    acceptUrl,
    expiresAt,
    inviteMode: input.inviteMode ?? "standard",
  });

  try {
    await sendEmailWithSendGrid({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } catch (error) {
    // Keep data clean if email could not be delivered.
    await prisma.organizationInvitation.delete({
      where: { id: invitation.id },
    });
    throw error;
  }

  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "ORGANIZATION_INVITATION",
    entityId: invitation.id,
    action: "CREATE",
    payload: {
      email: normalizedEmail,
      role: input.role,
      inviteMode: input.inviteMode ?? "standard",
    },
  });

  return {
    invitationId: invitation.id,
    email: normalizedEmail,
    expiresAt,
  };
}

export async function createEmployeeAccountAction(input: {
  organizationId: string;
  username: string;
  temporaryPassword: string;
  fullName?: string;
  role: MembershipRole;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, input.organizationId);

  if (!membership) {
    throw new Error("Unauthorized");
  }
  if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
    throw new Error("Only owners and admins can create employee accounts");
  }
  if (input.role === MembershipRole.OWNER) {
    throw new Error("Cannot create employee accounts with OWNER role");
  }

  const normalizedBaseUsername = normalizeUsername(input.username);
  if (!isValidUsername(normalizedBaseUsername)) {
    throw new Error("Username must be 3-32 chars and use only letters, numbers, dot, underscore, or dash");
  }
  const username = buildTenantScopedUsername({
    baseUsername: normalizedBaseUsername,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    organizationId: membership.organization.id,
  });
  if (!isValidUsername(username)) {
    throw new Error("Generated username is invalid. Please use a different base username.");
  }
  if (!input.temporaryPassword || input.temporaryPassword.length < 8) {
    throw new Error("Temporary password must be at least 8 characters");
  }

  const email = employeeUsernameToEmail(username);
  const existingPrismaUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { organizationId: input.organizationId },
      },
    },
  });

  if (existingPrismaUser?.memberships.length) {
    throw new Error("This username is already a member of your organization");
  }
  if (existingPrismaUser) {
    throw new Error("This username is already taken in another workspace. Please choose another username.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: input.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName?.trim() || username,
      username,
      must_change_password: true,
      is_employee_account: true,
    },
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) {
      throw new Error("This username is already taken. Please choose another username.");
    }
    throw new Error(error?.message || "Failed to create employee auth account");
  }
  const authUserId = data.user.id;

  await prisma.user.upsert({
    where: { id: authUserId },
    update: {
      email,
      fullName: input.fullName?.trim() || username,
      authProviderId: authUserId,
    },
    create: {
      id: authUserId,
      email,
      fullName: input.fullName?.trim() || username,
      authProviderId: authUserId,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: authUserId,
        organizationId: input.organizationId,
      },
    },
    update: {
      role: input.role,
    },
    create: {
      userId: authUserId,
      organizationId: input.organizationId,
      role: input.role,
    },
  });

  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "EMPLOYEE_ACCOUNT",
    entityId: authUserId,
    action: "CREATE",
    payload: {
      username,
      role: input.role,
    },
  });

  return {
    userId: authUserId,
    username,
    email,
    role: input.role,
    mustChangePassword: true,
  };
}

export async function getInvitationByTokenAction(token: string) {
  const invitation = await findInvitationByToken(token);
  if (!invitation) {
    return { status: "not_found" as const };
  }

  if (invitation.acceptedAt) {
    return { status: "accepted" as const };
  }

  if (invitation.expiresAt <= new Date()) {
    return { status: "expired" as const };
  }

  return {
    status: "valid" as const,
    invitation: {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      invitedByName: invitation.invitedBy.fullName || invitation.invitedBy.email,
      expiresAt: invitation.expiresAt,
    },
  };
}

export async function acceptInvitationAction(token: string) {
  const authUser = await requireAuthenticatedUser();
  if (!authUser.email) {
    throw new Error("Authenticated email is required to accept an invitation");
  }

  const invitation = await findInvitationByToken(token);
  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (invitation.acceptedAt) {
    await setSelectedOrganization(invitation.organizationId);
    return { organizationId: invitation.organizationId, organizationName: invitation.organization.name };
  }
  if (invitation.expiresAt <= new Date()) {
    throw new Error("Invitation has expired");
  }

  const authEmail = normalizeEmail(authUser.email);
  const inviteEmail = normalizeEmail(invitation.email);
  if (authEmail !== inviteEmail) {
    throw new Error(`Please sign in with ${invitation.email} to accept this invitation`);
  }

  await ensureUserWorkspace(authUser);

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        userId_organizationId: {
          userId: authUser.id,
          organizationId: invitation.organizationId,
        },
      },
      update: {},
      create: {
        userId: authUser.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  });

  await setSelectedOrganization(invitation.organizationId);

  await createAuditLogEntry({
    organizationId: invitation.organizationId,
    userId: authUser.id,
    entityType: "ORGANIZATION_INVITATION",
    entityId: invitation.id,
    action: "ACCEPT",
    payload: {
      email: invitation.email,
      role: invitation.role,
    },
  });

  return {
    organizationId: invitation.organizationId,
    organizationName: invitation.organization.name,
  };
}

export async function getInvitationsAction(organizationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, organizationId);
  
  if (!membership) {
    throw new Error("Unauthorized");
  }

  // Only OWNER and ADMIN can view invitations
  if (membership.role !== MembershipRole.OWNER && membership.role !== MembershipRole.ADMIN) {
    throw new Error("Only owners and admins can view invitations");
  }

  return prisma.organizationInvitation.findMany({
    where: { organizationId },
    include: {
      invitedBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMembersAction(organizationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, organizationId);
  
  if (!membership) {
    throw new Error("Unauthorized");
  }

  const members = await prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch avatar URLs from Supabase for each member
  const supabase = getSupabaseAdminClient();
  
  const membersWithAvatars = await Promise.all(
    members.map(async (member) => {
      try {
        // Get user from Supabase auth by ID
        const { data: authUser } = await supabase.auth.admin.getUserById(member.user.id);
        const avatarUrl = authUser?.user?.user_metadata?.avatar_url as string | undefined;
        
        return {
          ...member,
          user: {
            ...member.user,
            avatarUrl: avatarUrl ?? null,
          },
        };
      } catch (error) {
        // If we can't fetch avatar, just return without it
        return {
          ...member,
          user: {
            ...member.user,
            avatarUrl: null,
          },
        };
      }
    })
  );

  return membersWithAvatars;
}

