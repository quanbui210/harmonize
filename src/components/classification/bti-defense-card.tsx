
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { searchBtiAction } from "@/server/actions/bti-search";
import { BtiSearchResult } from "@/lib/eu/bti-search";
import Link from "next/link";

interface BtiDefenseCardProps {
  hsCode: string;
  description: string;
  className?: string;
}

export function BtiDefenseCard({ hsCode, description, className }: BtiDefenseCardProps) {
  const [loading, setLoading] = useState(true);
  const [rulings, setRulings] = useState<BtiSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRulings() {
      if (!hsCode || !description) return;

      try {
        setLoading(true);
        // Clean HS code for search (remove dots)
        const cleanCode = hsCode.replace(/\./g, "").substring(0, 6);
        
        const result = await searchBtiAction({
          hsCodePrefix: cleanCode,
          description,
          limit: 3,
          minSimilarity: 0.6
        });

        if (result.success && result.data) {
          setRulings(result.data);
        } else {
          setError(result.error || "Failed to fetch rulings");
        }
      } catch (err) {
        console.error("Error fetching BTI rulings:", err);
        setError("An error occurred while fetching rulings");
      } finally {
        setLoading(false);
      }
    }

    fetchRulings();
  }, [hsCode, description]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Legal Precedents
          </CardTitle>
          <CardDescription>Searching EU Binding Tariff Information database...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || rulings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Legal Precedents
          </CardTitle>
          <CardDescription>
            No direct BTI precedents found for HS {hsCode} with high similarity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            While we couldn&apos;t find an exact match in our database of 1.2M rulings, you can search manually for broader precedents.
          </p>
          <Button variant="link" className="px-0 mt-2" asChild>
            <Link href={`/rulings?market=all&htsCode=${hsCode.substring(0, 4)}`}>
              Browse all rulings for Chapter {hsCode.substring(0, 2)} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Find the best match (highest priority: FI, then highest similarity)
  const bestMatch = rulings[0];
  const isFinnish = bestMatch.country === "FI";
  const similarityPercent = Math.round(bestMatch.similarity * 100);

  return (
    <Card className={`${className} border-l-4 ${isFinnish ? "border-l-blue-600" : "border-l-gray-300"}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-600" />
              BTI Defense Card
            </CardTitle>
            <CardDescription>
              {rulings.length} similar ruling{rulings.length !== 1 ? "s" : ""} found
            </CardDescription>
          </div>
          {isFinnish && (
            <Badge className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Finnish Precedent
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Reference: <span className="font-mono text-blue-600">{bestMatch.reference}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Issued by {bestMatch.country} on {bestMatch.startDate ? new Date(bestMatch.startDate).toLocaleDateString() : "Unknown date"}
              </p>
            </div>
            <Badge variant="outline" className={similarityPercent > 85 ? "text-green-600 border-green-200 bg-green-50" : ""}>
              {similarityPercent}% Match
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p className="line-clamp-3 italic">&quot;{bestMatch.description}&quot;</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-medium">Classified as:</span>
            <Badge variant="secondary" className="font-mono">
              {bestMatch.hsCode}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Why this matters:</p>
          <p className="text-sm text-muted-foreground">
            {isFinnish 
              ? "This is a direct precedent from Finnish Customs (Tulli). It provides the strongest possible defense for your classification."
              : `This ruling from ${bestMatch.country} sets a precedent within the EU. While not binding on Tulli, it is strong evidence of correct classification.`
            }
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {rulings.slice(1).map(ruling => (
            <Link 
              key={ruling.id} 
              href={`/rulings/${ruling.id}`}
              className="text-xs text-muted-foreground hover:text-blue-600 flex items-center gap-2 truncate"
            >
              <ArrowRight className="h-3 w-3" />
              {ruling.reference} ({ruling.country}) - {ruling.hsCode}
            </Link>
          ))}
          
          <Button variant="outline" className="w-full mt-2" asChild>
            <Link href={`/rulings?market=all&htsCode=${hsCode.substring(0, 4)}&search=${encodeURIComponent(description.substring(0, 20))}`}>
              View all {rulings.length} precedents
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
