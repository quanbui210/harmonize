import { MembershipRole } from "@prisma/client"
import type { User } from "@supabase/supabase-js"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"

const randomSuffix = () => Math.random().toString(36).slice(2, 6)

async function createWorkspace(name: string, createdById: string) {
  const baseSlug = slugify(name) || "workspace"
  let attempt = 0

  while (attempt < 5) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSuffix()}`
    try {
      return await prisma.organization.create({
        data: {
          name,
          slug,
          createdById,
        },
      })
    } catch (error) {
      attempt += 1
      if (attempt >= 5) {
        throw error
      }
    }
  }

  throw new Error("Unable to create workspace")
}

export async function ensureUserWorkspace(user: User) {
  if (!user.email) {
    throw new Error("User email is required")
  }

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
    },
    create: {
      id: user.id,
      email: user.email,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      authProviderId: user.id,
    },
  })

  const existingMembership = await prisma.membership.findFirst({
    where: { userId: profile.id },
    include: { organization: true },
  })

  if (existingMembership) {
    return existingMembership
  }

  const organizationName =
    (profile.fullName ? `${profile.fullName.split(" ")[0]}'s Workspace` : "Harmonize Workspace")
  const organization = await createWorkspace(organizationName, profile.id)

  return prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: profile.id,
      role: MembershipRole.OWNER,
    },
    include: {
      organization: true,
    },
  })
}

