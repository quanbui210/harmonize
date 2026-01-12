"use client";

import { useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";

type UserMenuProps = {
  userName?: string | null;
  userEmail?: string | null;
  organizationName: string;
};

export function UserMenu({ userName, userEmail, organizationName }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initials =
    userName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    userEmail?.slice(0, 2).toUpperCase() ||
    "HM";


  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors"
      >
        <div className="text-right">
          <p className="text-sm font-medium">{userName ?? "Analyst"}</p>
          <p className="text-xs text-muted-foreground">{organizationName}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">
          {initials}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-md border bg-white shadow-lg z-20">
            <div className="p-2">
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

