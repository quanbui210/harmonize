import { redirect } from "next/navigation";
import { VaultUploadPageClient } from "@/components/vault/vault-upload-page-client";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ org?: string }>;
};

export default async function VaultUploadPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { org } = await searchParams;

  if (!org) {
    redirect("/");
  }

  return <VaultUploadPageClient token={token} organizationId={org} />;
}


