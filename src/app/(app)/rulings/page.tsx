import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { listRulingsAction } from "@/server/actions/rulings";
import { RulingsPageClient } from "@/components/rulings/rulings-page-client";
import { marketOptions } from "@/lib/constants/markets";

type Props = {
  searchParams: {
    market?: string;
    htsCode?: string;
    search?: string;
    page?: string;
  };
};

export default async function RulingsPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  const page = parseInt(searchParams.page || "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const { rulings, total } = await listRulingsAction({
    market: searchParams.market as any,
    htsCode: searchParams.htsCode,
    search: searchParams.search,
    limit,
    offset,
  });

  return (
    <RulingsPageClient
      initialRulings={rulings}
      total={total}
      currentPage={page}
      limit={limit}
      marketOptions={[...marketOptions]}
      initialFilters={{
        market: searchParams.market,
        htsCode: searchParams.htsCode,
        search: searchParams.search,
      }}
    />
  );
}

