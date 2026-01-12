"use client";

import { useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectOrganizationAction } from "@/server/actions/organizations";
import { MembershipRole } from "@prisma/client";

type Membership = {
  id: string;
  role: MembershipRole;
  organization: {
    id: string;
    name: string;
  };
};

type Props = {
  currentOrganizationId: string;
  memberships: Membership[];
};

const roleLabels: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  CONTRIBUTOR: "Contributor",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

const roleColors: Record<MembershipRole, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CONTRIBUTOR: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  REVIEWER: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  VIEWER: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

export function OrganizationSwitcher({ currentOrganizationId, memberships }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const currentMembership = memberships.find(
    (m) => m.organization.id === currentOrganizationId
  );

  // Only show switcher if user has multiple organizations
  if (memberships.length <= 1) {
    return null;
  }

  const handleSelect = async (organizationId: string) => {
    if (organizationId === currentOrganizationId) {
      setIsOpen(false);
      return;
    }

    setIsLoading(organizationId);
    try {
      await selectOrganizationAction(organizationId);
    } catch (error) {
      console.error("Failed to switch organization:", error);
      setIsLoading(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[200px] truncate">
          {currentMembership?.organization.name || "Organization"}
        </span>
        {currentMembership && (
          <Badge className={`${roleColors[currentMembership.role]} text-xs px-1.5 py-0`}>
            {roleLabels[currentMembership.role]}
          </Badge>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 rounded-md border bg-white shadow-lg z-20 max-h-[400px] overflow-y-auto">
            <div className="p-2">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                Switch Organization
              </p>
              {memberships.map((membership) => {
                const isCurrent = membership.organization.id === currentOrganizationId;
                const isSwitching = isLoading === membership.organization.id;
                return (
                  <button
                    key={membership.id}
                    onClick={() => handleSelect(membership.organization.id)}
                    disabled={isSwitching}
                    className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                      isCurrent
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-50 text-gray-700"
                    } ${isSwitching ? "opacity-50 cursor-wait" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{membership.organization.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${roleColors[membership.role]} text-xs px-1.5 py-0`}>
                        {roleLabels[membership.role]}
                      </Badge>
                      {isCurrent && <Check className="h-4 w-4 text-blue-600" />}
                      {isSwitching && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

