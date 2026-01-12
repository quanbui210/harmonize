"use client";

import { useState } from "react";
import { Building2, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { selectOrganizationAction } from "@/server/actions/organizations";
import { MembershipRole } from "@prisma/client";

type Membership = {
  id: string;
  role: MembershipRole;
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  };
};

type Props = {
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

export function SelectOrganizationClient({ memberships }: Props) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (organizationId: string) => {
    setSelectedOrgId(organizationId);
    setIsLoading(true);
    try {
      await selectOrganizationAction(organizationId);
    } catch (error) {
      console.error("Failed to select organization:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Select Organization</h1>
          <p className="mt-2 text-muted-foreground">
            You belong to multiple organizations. Choose one to continue.
          </p>
        </div>

        <div className="grid gap-4">
          {memberships.map((membership) => (
            <Card
              key={membership.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedOrgId === membership.organization.id
                  ? "ring-2 ring-blue-500"
                  : ""
              }`}
              onClick={() => !isLoading && handleSelect(membership.organization.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                      <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {membership.organization.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Created {new Date(membership.organization.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    className={roleColors[membership.role]}
                  >
                    {roleLabels[membership.role]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {membership.organization.slug}
                  </p>
                  {selectedOrgId === membership.organization.id && isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Loading...
                    </div>
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Need to create a new organization? Contact support or create one from your dashboard.</p>
        </div>
      </div>
    </div>
  );
}

