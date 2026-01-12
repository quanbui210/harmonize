"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeDisplay } from "@/components/classification/code-display";
import { DeleteClassificationButton } from "@/components/classification/delete-classification-button";

type ClassificationItem = {
  id: string;
  htsCode: string | null;
  dossier: any;
  product: {
    name: string | null;
  } | null;
};

type Props = {
  items: ClassificationItem[];
};

const INITIAL_SHOW_COUNT = 8;

export function RecentClassifications({ items }: Props) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = items.length > INITIAL_SHOW_COUNT;
  const displayItems = showAll ? items : items.slice(0, INITIAL_SHOW_COUNT);

  return (
    <>
      {/* Mobile/Tablet: Card Layout */}
      <div className="space-y-4 md:hidden">
        {items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            All classifications are covered. Great job.
          </p>
        )}
        {displayItems.map((item) => (
          <div
            key={item.id}
            className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/classify/${item.id}`} className="flex-1 min-w-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-medium text-sm leading-tight cursor-help">
                          {item.product?.name ?? "Untitled Product"}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{item.product?.name ?? "Untitled Product"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Link>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0">
                        {item.dossier ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.dossier ? "Dossier Ready" : "No Dossier"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Link href={`/classify/${item.id}`} className="block">
                {item.htsCode && item.htsCode !== "0000000000" ? (
                  <CodeDisplay
                    cnCode={item.htsCode.substring(0, 8)}
                    hsCode={(item as any).hsCode || item.htsCode.substring(0, 6)}
                    htsCode={item.htsCode}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Pending classification</span>
                )}
              </Link>
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <Link href={item.dossier 
                    ? `/classify/${item.id}/dossier` 
                    : `/classify/${item.id}`}
                  >
                    {item.dossier ? "View Dossier" : "View"}
                  </Link>
                </Button>
                <DeleteClassificationButton
                  classificationId={item.id}
                  productName={item.product?.name ?? "Untitled Product"}
                />
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="pt-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : `Show more (${items.length - INITIAL_SHOW_COUNT} more)`}
            </Button>
          </div>
        )}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block">
        <div className="overflow-x-auto -mx-2">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px] px-3 py-2">Product</TableHead>
                <TableHead className="min-w-[140px] px-3 py-2">Code</TableHead>
                <TableHead className="min-w-[50px] text-center px-2 py-2">Dossier</TableHead>
                <TableHead className="text-right min-w-[50px] px-2 py-2">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm py-4">
                    All classifications are covered. Great job.
                  </TableCell>
                </TableRow>
              )}
              {displayItems.map((item) => (
                <TableRow 
                  key={item.id} 
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="min-w-[150px] px-3 py-2">
                    <Link href={`/classify/${item.id}`} className="block w-full">
                      <div className="min-w-0 w-full">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="font-medium truncate cursor-help w-full text-sm">
                                {item.product?.name ?? "Untitled Product"}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{item.product?.name ?? "Untitled Product"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[140px] px-3 py-2">
                    <Link href={`/classify/${item.id}`} className="block">
                      {item.htsCode && item.htsCode !== "0000000000" ? (
                        <CodeDisplay
                          cnCode={item.htsCode.substring(0, 8)}
                          hsCode={(item as any).hsCode || item.htsCode.substring(0, 6)}
                          htsCode={item.htsCode}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">Pending classification</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[50px] text-center px-2 py-2">
                    <Link href={`/classify/${item.id}`} className="flex justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              {item.dossier ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{item.dossier ? "Dossier Ready" : "No Dossier"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right min-w-[50px] px-1 py-2">
                    <div className="flex items-center justify-end">
                      <DeleteClassificationButton
                        classificationId={item.id}
                        productName={item.product?.name ?? "Untitled Product"}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show less" : `Show more (${items.length - INITIAL_SHOW_COUNT} more)`}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
