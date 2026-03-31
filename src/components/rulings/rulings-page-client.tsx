"use client";

import { useState, useTransition, useEffect } from "react";
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
import { listRulingsAction, getRulingCategoriesAction } from "@/server/actions/rulings";
import Link from "next/link";

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

type Ruling = {
  id: string;
  market: string;
  reference: string;
  title: string;
  body: string;
  isTranslated?: boolean;
  category?: string | null;
  htsCode: string;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MarketOption = {
  value: string;
  label: string;
};

type Props = {
  initialRulings: Ruling[];
  total: number;
  initialResultMeta: {
    requestedMarket: string;
    effectiveMarket: string;
    usedCrossMarketFallback: boolean;
  };
  currentPage: number;
  limit: number;
  marketOptions: { value: string; label: string }[];
  categories?: string[];
  initialFilters: {
    market?: string;
    htsCode?: string;
    search?: string;
    category?: string;
  };
};

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Info } from "lucide-react";

export function RulingsPageClient({
  initialRulings,
  total,
  initialResultMeta,
  currentPage,
  limit,
  marketOptions,
  initialFilters,
  categories = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [rulings, setRulings] = useState<Ruling[]>(initialRulings);
  const [resultTotal, setResultTotal] = useState(total);
  const [resultMeta, setResultMeta] = useState(initialResultMeta);
  const [search, setSearch] = useState(initialFilters.search || "");
  const [market, setMarket] = useState(initialFilters.market || "FI");
  const [category, setCategory] = useState(initialFilters.category || "all");
  const [htsCode, setHtsCode] = useState(initialFilters.htsCode || "");
  const [availableCategories, setAvailableCategories] = useState<string[]>(categories);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvailableCategories(categories);
  }, [categories]);

  useEffect(() => {
    if (market === "FI" && availableCategories.length === 0) {
      startTransition(async () => {
        const cats = await getRulingCategoriesAction("FI");
        setAvailableCategories(cats);
      });
    }
  }, [market, availableCategories.length]);

  const mergedMarketOptions: MarketOption[] = marketOptions.some((option) => option.value === "all")
    ? [...marketOptions]
    : [{ value: "all", label: "All countries" }, ...marketOptions];

  const handleSearch = () => {
    startTransition(async () => {
      const params = new URLSearchParams();
      // Always set market if it's not empty, defaulting to FI logic is handled in initial state
      if (market) params.set("market", market);
      if (htsCode) params.set("htsCode", htsCode);
      if (search) params.set("search", search);
      if (category && category !== "all") params.set("category", category);
      params.set("page", "1");

      router.push(`/rulings?${params.toString()}`);
      
      // Reload data
      const result = await listRulingsAction({
        market: market || "FI",
        htsCode: htsCode || undefined,
        search: search || undefined,
        category: category !== "all" ? category : undefined,
        limit,
        offset: 0,
      });
      setRulings(result.rulings);
      setResultTotal(result.total);
      setResultMeta({
        requestedMarket: result.requestedMarket,
        effectiveMarket: result.effectiveMarket,
        usedCrossMarketFallback: result.usedCrossMarketFallback,
      });
    });
  };

  const handleClear = () => {
    setSearch("");
    setMarket("FI");
    setHtsCode("");
    setCategory("all");
    
    startTransition(async () => {
      router.push("/rulings?market=FI");
      const result = await listRulingsAction({ 
        market: "FI",
        limit, 
        offset: 0 
      });
      setRulings(result.rulings);
      setResultTotal(result.total);
      setResultMeta({
        requestedMarket: result.requestedMarket,
        effectiveMarket: result.effectiveMarket,
        usedCrossMarketFallback: result.usedCrossMarketFallback,
      });
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(async () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      if (market) params.set("market", market);
      if (category && category !== "all") params.set("category", category);
      
      router.push(`/rulings?${params.toString()}`);
      
      const result = await listRulingsAction({
        market: market || "FI",
        htsCode: htsCode || undefined,
        search: search || undefined,
        category: category !== "all" ? category : undefined,
        limit,
        offset: (newPage - 1) * limit,
      });
      setRulings(result.rulings);
      setResultTotal(result.total);
      setResultMeta({
        requestedMarket: result.requestedMarket,
        effectiveMarket: result.effectiveMarket,
        usedCrossMarketFallback: result.usedCrossMarketFallback,
      });
    });
  };

  const totalPages = Math.ceil(resultTotal / limit);

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

      {/* Info Section */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="what-is-bti" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Info className="h-5 w-5" />
                <span className="font-semibold">What is a Binding Tariff Information (BTI) ruling?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  A <strong>Binding Tariff Information (BTI)</strong> ruling is a written legal decision issued by EU customs authorities. It confirms the correct classification (CN/TARIC code) for a specific product.
                </p>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium text-foreground mb-1">It IS:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>A legal precedent for product classification.</li>
                      <li>Binding on all EU customs administrations for 3 years.</li>
                      <li>A way to ensure legal certainty for importers.</li>
                    </ul>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium text-foreground mb-1">It is NOT:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>A list of all products imported into the EU.</li>
                      <li>An approval of product safety or quality.</li>
                      <li>Binding for products that are not identical.</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs italic mt-2">
                  Note: While a BTI is legally binding only for the holder, they are public records that provide authoritative guidance for classifying similar goods.
                </p>
              <p className="text-xs text-muted-foreground">
                Source: EU Binding Tariff Information (BTI) database.{" "}
                <a
                  href="https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_home.jsp?Lang=en"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  Official site
                </a>
              </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Rulings</CardTitle>
          <CardDescription>
            Filter by market, HTS code, or search by reference, title, or content
            <span className="block text-xs text-muted-foreground mt-1">
              Data is sourced from the EU’s official Binding Tariff Information (BTI) records.{" "}
              <a
                href="https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_home.jsp?Lang=en"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                Learn more
              </a>
              .
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className={`grid gap-4 ${market === "FI" && availableCategories.length > 0 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Market</label>
                <Select 
                  value={market || "FI"} 
                  onValueChange={(value) => {
                    setMarket(value);
                    if (value !== "FI") {
                      setCategory("all");
                    }
                  }} 
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent>
                    {mergedMarketOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {market === "FI" && availableCategories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={category || "all"} onValueChange={(value) => setCategory(value)} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">HTS Code</label>
                <Input
                  placeholder="e.g., 8806"
                  value={htsCode}
                  onChange={(e) => setHtsCode(e.target.value)}
                  disabled={isPending}
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
                  disabled={isPending}
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
            Rulings {resultTotal > 0 && `(${resultTotal})`}
          </CardTitle>
          <CardDescription>
            {resultTotal === 0
              ? "No rulings found. Rulings are official data from customs authorities and need to be ingested from official sources."
              : `Showing ${rulings.length} of ${resultTotal} rulings`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resultMeta.usedCrossMarketFallback && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No exact matches in {resultMeta.requestedMarket}. Showing best matches across all countries instead.
            </div>
          )}
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
                            {ruling.category && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                                {ruling.category}
                              </Badge>
                            )}
                            {ruling.isTranslated && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                Translated
                              </Badge>
                            )}
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
                                  {mounted ? new Date(ruling.issuedAt).toLocaleDateString() : new Date(ruling.issuedAt).toISOString().split('T')[0]}
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
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages || isPending}
                      onClick={() => handlePageChange(currentPage + 1)}
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
