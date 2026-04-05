import { notFound } from "next/navigation";
import { getLabelAction } from "@/server/actions/labels";
import { EditLabelClient } from "./edit-label-client";

interface EditLabelPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLabelPage({ params }: EditLabelPageProps) {
  const { id } = await params;

  let label;
  try {
    label = await getLabelAction(id);
  } catch {
    notFound();
  }

  if (!label) {
    notFound();
  }

  return (
    <EditLabelClient
      labelId={id}
      initialLabelData={label.labelData as any}
      initialComplianceScore={Number(label.complianceScore || 0)}
    />
  );
}
