"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClassificationPageSearchProps = {
  initialSearch: string;
};

export function ClassificationPageSearch({ initialSearch }: ClassificationPageSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialSearch);

  useEffect(() => {
    setValue(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("search", value.trim());
      } else {
        params.delete("search");
      }
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    }, 250);

    return () => clearTimeout(timeout);
  }, [value, router, pathname, searchParams]);

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by product, HS/HTS code, SKU, dossier..."
        className="pl-10 pr-10"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => setValue("")}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
