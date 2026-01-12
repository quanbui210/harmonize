"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getMembership, setSelectedOrganization, getPrimaryMembership } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { MembershipRole } from "@prisma/client";
import { createAuditLogEntry } from "@/server/actions/audit-log";
import { slugify } from "@/lib/utils";

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
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, input.organizationId);
  
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
    where: { email: input.email },
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
        email: input.email,
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

  // Generate secure token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
      invitedById: user.id,
      token,
      expiresAt,
    },
    include: {
      organization: true,
      invitedBy: true,
    },
  });

  // TODO: Send email with invitation link
  // For now, we'll return the token so it can be displayed in UI for testing
  // In production, send email with: /invite/accept?token={token}

  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "ORGANIZATION_INVITATION",
    entityId: invitation.id,
    action: "CREATE",
    payload: {
      email: input.email,
      role: input.role,
    },
  });

  return { invitation, token }; // Return token for testing, remove in production
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

  return prisma.membership.findMany({
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
}

