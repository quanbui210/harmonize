"use client";

import { useRouter } from "next/navigation";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ClassificationItem = {
  id: string;
  hsCode: string | null;
  htsCode: string | null;
  dossier: { id: string } | null;
  product: { name: string | null; id: string } | null;
};

type Props = {
  item: ClassificationItem;
  formatHSCode: (code: string) => string;
  formatHTSCode: (code: string) => string;
  formatCNCode: (code: string) => string;
};

export function ClassificationTableRow({ item, formatHSCode, formatHTSCode, formatCNCode }: Props) {
  const router = useRouter();

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/classify/${item.id}`)}
    >
      <TableCell>
        <div>
          <p className="font-medium">
            {item.product?.name ?? "Untitled Product"}
          </p>
          <p className="text-xs text-muted-foreground">
            {String(item.product?.id ?? "")}
          </p>
        </div>
      </TableCell>
      <TableCell>
        {item.htsCode && item.htsCode !== "0000000000" ? (
          <div className="space-y-1">
            <p className="font-mono text-sm">
              {formatHTSCode(item.htsCode)}
            </p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {item.hsCode && (
                <span>HS: {formatHSCode(item.hsCode)}</span>
              )}
              <span>CN: {formatCNCode(item.htsCode.substring(0, 8))}</span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">Pending classification</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={item.dossier ? "default" : "destructive"}
        >
          {item.dossier ? "Dossier Ready" : "No Dossier"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button 
          variant="outline" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(item.dossier 
              ? `/classify/${item.id}/dossier` 
              : `/classify/${item.id}`);
          }}
        >
          {item.dossier ? "View Dossier" : "View Details"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

