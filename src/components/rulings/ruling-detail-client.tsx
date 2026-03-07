
"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hash, Calendar, ArrowLeft, Languages } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type RulingDetailProps = {
  ruling: {
    id: string;
    market: string;
    reference: string;
    title: string;
    body: string;
    originalBody?: string;
    justification?: string | null;
    originalJustification?: string | null;
    isTranslated?: boolean;
    category?: string | null;
    keywords?: string[];
    htsCode: string;
    issuedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB");
}

export function RulingDetailClient({ ruling }: RulingDetailProps) {
  const [view, setView] = useState<"translated" | "original">("translated");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasTranslation = ruling.isTranslated;
  const currentBody = view === "translated" ? ruling.body : (ruling.originalBody || ruling.body);
  const currentJustification = view === "translated" 
    ? (ruling.justification || "No justification provided") 
    : (ruling.originalJustification || ruling.justification || "No justification provided");

  const formattedDate = mounted && ruling.issuedAt 
    ? new Date(ruling.issuedAt).toLocaleDateString() // Use browser locale on client
    : ruling.issuedAt ? new Date(ruling.issuedAt).toISOString().split('T')[0] : ""; // Fallback for server/initial render

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rulings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rulings
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-4 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ruling.market}</Badge>
                {ruling.category && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                    {ruling.category}
                  </Badge>
                )}
                {hasTranslation && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    AI Translated
                  </Badge>
                )}
                <span className="font-mono text-lg font-semibold text-blue-600 ml-auto">
                  {ruling.reference}
                </span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{ruling.title}</CardTitle>
                  <CardDescription>
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Hash className="h-4 w-4" />
                          <span className="font-mono">
                            {ruling.htsCode}
                          </span>
                        </div>
                        {ruling.issuedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Issued: {mounted ? new Date(ruling.issuedAt).toLocaleDateString() : new Date(ruling.issuedAt).toISOString().split('T')[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {ruling.keywords && ruling.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ruling.keywords.map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-normal text-muted-foreground">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardDescription>
                </div>

                {hasTranslation && (
                  <div className="flex-shrink-0">
                    <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[200px]">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="translated">English</TabsTrigger>
                        <TabsTrigger value="original">Original</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <div className="p-4 bg-muted/30 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
                {currentBody}
              </div>
            </div>

            {currentJustification && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h3 className="text-lg font-semibold mb-2">Justification / Legal Reasoning</h3>
                <div className="p-4 bg-muted/30 rounded-lg whitespace-pre-wrap text-sm leading-relaxed">
                  {currentJustification}
                </div>
              </div>
            )}
            
            {hasTranslation && view === "translated" && (
              <p className="text-xs text-muted-foreground italic mt-4">
                * This content was automatically translated by AI. Please refer to the original text for legal accuracy.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
