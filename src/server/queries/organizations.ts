import { prisma } from "@/lib/prisma"

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

