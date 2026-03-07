import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getRulingAction } from "@/server/actions/rulings";
import { RulingDetailClient } from "@/components/rulings/ruling-detail-client";

type Props = {
  params: { rulingId: string };
};

export default async function RulingDetailPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  
  let ruling;
  try {
    ruling = await getRulingAction(params.rulingId);
  } catch (error) {
    console.error("Error fetching ruling:", error);
    return <div>Ruling not found or error occurred.</div>;
  }

  if (!ruling) {
    return <div>Ruling not found.</div>;
  }

  return <RulingDetailClient ruling={ruling} />;
}

