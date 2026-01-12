import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

export async function getPrimaryMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })
}

export async function getAllUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })
}

export async function getMembership(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: true,
    },
  })
}

export async function getSelectedOrganizationId(userId: string): Promise<string | null> {
  const cookieStore = cookies()
  const selectedOrgId = cookieStore.get("selectedOrganizationId")?.value

  if (selectedOrgId) {
    // Verify user has access to this organization
    const membership = await getMembership(userId, selectedOrgId)
    if (membership) {
      return selectedOrgId
    }
  }

  // Fallback to primary membership
  const primaryMembership = await getPrimaryMembership(userId)
  return primaryMembership?.organizationId || null
}

export async function setSelectedOrganization(organizationId: string) {
  const cookieStore = cookies()
  cookieStore.set("selectedOrganizationId", organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  })
}

