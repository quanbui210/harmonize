"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpenCheck, Search, FileText, Calendar, Hash } from "lucide-react";
import { listRulingsAction } from "@/server/actions/rulings";
import { MarketCode } from "@prisma/client";
function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}
import Link from "next/link";

type Ruling = {
  id: string;
  market: MarketCode;
  reference: string;
  title: string;
  body: string;
  htsCode: string;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MarketOption = {
  value: string;
  label: string;
};

type Props = {
  initialRulings: Ruling[];
  total: number;
  currentPage: number;
  limit: number;
  marketOptions: { value: string; label: string }[];
  initialFilters: {
    market?: string;
    htsCode?: string;
    search?: string;
  };
};

export function RulingsPageClient({
  initialRulings,
  total,
  currentPage,
  limit,
  marketOptions,
  initialFilters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [rulings, setRulings] = useState<Ruling[]>(initialRulings);
  const [search, setSearch] = useState(initialFilters.search || "");
  const [market, setMarket] = useState(initialFilters.market || "all");
  const [htsCode, setHtsCode] = useState(initialFilters.htsCode || "");

  const handleSearch = () => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (market && market !== "all") params.set("market", market);
      if (htsCode) params.set("htsCode", htsCode);
      if (search) params.set("search", search);
      params.set("page", "1");

      router.push(`/rulings?${params.toString()}`);
      
      // Reload data
      const result = await listRulingsAction({
        market: market && market !== "all" ? (market as MarketCode) : undefined,
        htsCode: htsCode || undefined,
        search: search || undefined,
        limit,
        offset: 0,
      });
      setRulings(result.rulings);
    });
  };

  const handleClear = () => {
    setSearch("");
    setMarket("all");
    setHtsCode("");
    router.push("/rulings");
    setRulings(initialRulings);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Ruling Database</h1>
            <p className="text-sm text-muted-foreground">
              Search and browse official binding tariff information (BTI) rulings from customs authorities
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Rulings</CardTitle>
          <CardDescription>
            Filter by market, HTS code, or search by reference, title, or content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Market</label>
                <Select value={market || "all"} onValueChange={(value) => setMarket(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All markets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All markets</SelectItem>
                    {marketOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">HTS Code</label>
                <Input
                  placeholder="e.g., 8806"
                  value={htsCode}
                  onChange={(e) => setHtsCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Reference, title, or content..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={isPending}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isPending}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Rulings {total > 0 && `(${total})`}
          </CardTitle>
          <CardDescription>
            {total === 0
              ? "No rulings found. Rulings are official data from customs authorities and need to be ingested from official sources."
              : `Showing ${rulings.length} of ${total} rulings`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulings.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No rulings found. Try adjusting your search criteria.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                To populate the database, you&apos;ll need to ingest official rulings from customs authorities
                (e.g., EU BTI database, US CBP rulings).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rulings.map((ruling) => (
                <Card key={ruling.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{ruling.market}</Badge>
                            <span className="font-mono text-sm font-semibold text-blue-600">
                              {ruling.reference}
                            </span>
                          </div>
                          <h3 className="font-semibold text-lg">{ruling.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Hash className="h-4 w-4" />
                              <span className="font-mono">
                                {ruling.htsCode.length === 10
                                  ? formatCNCode(ruling.htsCode.substring(0, 8))
                                  : ruling.htsCode}
                              </span>
                            </div>
                            {ruling.issuedAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {new Date(ruling.issuedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Link href={`/rulings/${ruling.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ruling.body.substring(0, 200)}
                        {ruling.body.length > 200 ? "..." : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1 || isPending}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("page", String(currentPage - 1));
                        router.push(`/rulings?${params.toString()}`);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages || isPending}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("page", String(currentPage + 1));
                        router.push(`/rulings?${params.toString()}`);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

