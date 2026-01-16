"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  cnCode: string;
  hsCode: string;
  htsCode: string;
};

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHSCode(hsCode: string): string {
  if (!hsCode || hsCode.length !== 6) return hsCode;
  return `${hsCode.substring(0, 2)}.${hsCode.substring(2, 4)}.${hsCode.substring(4, 6)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

export function CodeDisplay({ cnCode, hsCode, htsCode }: Props) {
  const [viewMode, setViewMode] = useState<"CN" | "HS" | "HTS">("CN");

  const getDisplayCode = () => {
    switch (viewMode) {
      case "CN":
        return formatCNCode(cnCode);
      case "HS":
        return formatHSCode(hsCode);
      case "HTS":
        return formatHTSCode(htsCode);
    }
  };

  return (
    <div 
      className="flex items-center gap-2 w-[240px]"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-mono text-sm font-semibold whitespace-nowrap min-w-[160px] text-left">{getDisplayCode()}</p>
      <Select value={viewMode} onValueChange={(value) => setViewMode(value as "CN" | "HS" | "HTS")}>
        <SelectTrigger className="h-7 w-[60px] text-xs px-1.5 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CN">CN</SelectItem>
          <SelectItem value="HS">HS</SelectItem>
          <SelectItem value="HTS">HTS</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

