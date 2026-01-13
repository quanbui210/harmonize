"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

const DISCLAIMER_VERSION = "1.0.0";

export async function checkLegalAcceptanceAction(feature: string): Promise<boolean> {
  const user = await requireAuthenticatedUser();
  
  const acceptance = await prisma.userLegalAcceptance.findUnique({
    where: {
      userId_feature: {
        userId: user.id,
        feature,
      },
    },
  });

  return acceptance?.disclaimerVersion === DISCLAIMER_VERSION;
}

export async function acceptLegalDisclaimerAction(
  feature: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = await requireAuthenticatedUser();

  await prisma.userLegalAcceptance.upsert({
    where: {
      userId_feature: {
        userId: user.id,
        feature,
      },
    },
    create: {
      userId: user.id,
      feature,
      disclaimerVersion: DISCLAIMER_VERSION,
      ipAddress,
      userAgent,
    },
    update: {
      disclaimerVersion: DISCLAIMER_VERSION,
      acceptedAt: new Date(),
      ipAddress,
      userAgent,
    },
  });
}

