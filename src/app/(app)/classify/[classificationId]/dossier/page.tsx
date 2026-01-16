import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { DossierGenerator } from "@/components/classification/dossier-generator";

type Props = {
  params: { classificationId: string };
};

// Helper to safely extract product name string - handles all possible structures
function getProductNameString(productName: any): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  // Handle standard structure: {original: string, translations: {fi: string, sv: string}}
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (typeof trans.fi === "string") return trans.fi;
    if (typeof trans.sv === "string") return trans.sv;
    if (typeof productName.original === "string") return productName.original;
  }
  
  // Handle edge case: direct {fi: string, sv: string} structure
  if (typeof productName.fi === "string") return productName.fi;
  if (typeof productName.sv === "string") return productName.sv;
  
  // Final fallback
  if (typeof productName.original === "string") return productName.original;
  
  return "Product";
}

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
          Create an audit-ready reasoning document for {getProductNameString(classification.product.name)}
        </p>
      </div>

      <DossierGenerator 
        classification={classification as any}
        organizationId={membership.organizationId}
        userId={user.id}
      />
    </div>
  );
}

