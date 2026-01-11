import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { DossierGenerator } from "@/components/classification/dossier-generator";

type Props = {
  params: { classificationId: string };
};

export default async function DossierPage({ params }: Props) {
  const user = await getOptionalUser();
  if (!user) {
    return null;
  }

  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    return null;
  }

  const { classificationId } = params;

  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: {
        include: {
          materials: true,
        },
      },
      sources: true,
      dutySummary: true,
      dossier: true,
    },
  });

  if (!classification) {
    redirect("/classify");
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Generate Defense Dossier
        </h1>
        <p className="text-sm text-muted-foreground">
          Create an audit-ready reasoning document for {classification.product.name}
        </p>
      </div>

      <DossierGenerator 
        classification={classification}
        organizationId={membership.organizationId}
        userId={user.id}
      />
    </div>
  );
}

