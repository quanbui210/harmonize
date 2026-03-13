"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ApiRuling = {
  id: string;
  market: string;
  reference: string;
  title: string;
  htsCode: string | null;
  category: string | null;
  issuedAt: string | null;
};

type ApiResponse = {
  rulings: ApiRuling[];
};

type SuggestionsResponse = {
  suggestions: Array<{ label: string; query: string }>;
};

function formatHs(code: string) {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  if (digits.length === 6) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
  return code;
}

export function RulingsRecommendationsCard({
  market = "FI",
  className,
}: {
  market?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ label: string; query: string }>>([]);
  const [rulings, setRulings] = useState<ApiRuling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [suggestionsRes, latestRes] = await Promise.all([
          fetch(`/api/rulings?suggest=1&market=${encodeURIComponent(market)}&limit=8`),
          fetch(`/api/rulings?market=${encodeURIComponent(market)}&limit=6`),
        ]);

        if (!suggestionsRes.ok) {
          throw new Error("Failed to load suggestions");
        }
        if (!latestRes.ok) {
          throw new Error("Failed to load rulings");
        }

        const suggestionsJson = (await suggestionsRes.json()) as SuggestionsResponse;
        const latestJson = (await latestRes.json()) as ApiResponse;

        if (cancelled) return;
        setSuggestions(suggestionsJson.suggestions ?? []);
        setRulings(latestJson.rulings ?? []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load rulings");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    if (normalizedQuery.length === 0) return;

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/rulings?market=${encodeURIComponent(market)}&limit=6&includeRelated=1&search=${encodeURIComponent(
            normalizedQuery
          )}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error("Search failed");
        }
        const json = (await res.json()) as ApiResponse;
        setRulings(json.rulings ?? []);
        setError(null);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [market, normalizedQuery]);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-blue-600" />
              Rulings recommendations
            </CardTitle>
            <CardDescription>Search precedent and pull in related BTI rulings.</CardDescription>
          </div>
          <Badge variant="secondary">{market}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try: "energy drink", "1905 90 60", "electric vehicle"...'
            className="pl-10"
            aria-label="Search BTI rulings"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((s) => (
              <Button
                key={s.query}
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => setQuery(s.query)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        )}

        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rulings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rulings found.</p>
        ) : (
          <div className="space-y-2">
            {rulings.map((r) => (
              <Link
                key={r.id}
                href={`/rulings/${r.id}`}
                className="block rounded-xl border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate">{r.reference}</p>
                      {r.htsCode ? (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {formatHs(r.htsCode)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium mt-1 line-clamp-2">{r.title}</p>
                    {r.category ? (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{r.category}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-blue-600">Open</span>
                </div>
              </Link>
            ))}
            <Button variant="ghost" className="w-full text-blue-600" asChild>
              <Link href="/rulings">Open full database</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

