import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { listRulingsAction, getRulingCategoriesAction } from "@/server/actions/rulings";
import { RulingsPageClient } from "@/components/rulings/rulings-page-client";
import { marketOptions } from "@/lib/constants/markets";

type Props = {
  searchParams: {
    market?: string;
    htsCode?: string;
    search?: string;
    category?: string;
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

  const market = (searchParams.market as any) || "FI";
  const categories = market === "FI" ? await getRulingCategoriesAction(market) : [];

  const result = await listRulingsAction({
    market,
    htsCode: searchParams.htsCode,
    search: searchParams.search,
    category: searchParams.category,
    limit,
    offset,
  });

  return (
    <RulingsPageClient
      initialRulings={result.rulings}
      total={result.total}
      initialResultMeta={{
        requestedMarket: result.requestedMarket,
        effectiveMarket: result.effectiveMarket,
        usedCrossMarketFallback: result.usedCrossMarketFallback,
      }}
      currentPage={page}
      limit={limit}
      marketOptions={[...marketOptions]}
      categories={categories}
      initialFilters={{
        market,
        htsCode: searchParams.htsCode,
        search: searchParams.search,
        category: searchParams.category,
      }}
    />
  );
}

