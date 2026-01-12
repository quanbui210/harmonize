"use client";

import { useState } from "react";
import { Building2, Users, Upload, X, Mail, Clock, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { updateOrganizationActionForm, sendInvitationAction } from "@/server/actions/organizations";
import { MembershipRole, Organization } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

type Membership = {
  id: string;
  role: MembershipRole;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: MembershipRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  invitedBy: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type Props = {
  organization: Organization & { logoUrl?: string | null };
  currentMembership: {
    id: string;
    role: MembershipRole;
  };
  members: Membership[];
  invitations: Invitation[];
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

export function SettingsClient({ organization, currentMembership, members, invitations }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [orgName, setOrgName] = useState(organization.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logoUrl || null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("CONTRIBUTOR");

  const canManage = currentMembership.role === "OWNER" || currentMembership.role === "ADMIN";

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append("organizationId", organization.id);
      if (orgName !== organization.name) {
        formData.append("name", orgName);
      }
      if (logoFile) {
        formData.append("logoFile", logoFile);
      }

      await updateOrganizationActionForm(formData);
      
      // Clear the file input after successful upload
      setLogoFile(null);
      
      // Refresh to show updated organization data (including logo)
      router.refresh();
      
      toast({
        variant: "success",
        title: "Organization updated",
        description: "Your organization settings have been saved successfully.",
      });
    } catch (error: any) {
      console.error("Update error:", error);
      const errorMessage = error.message || "Failed to update organization";
      
      // If it's a bucket error, provide helpful message
      if (errorMessage.includes("bucket") || errorMessage.includes("Storage") || errorMessage.includes("not found")) {
        toast({
          variant: "destructive",
          title: "Storage bucket not found",
          description: "Please create the 'organization-assets' bucket in Supabase Storage → Buckets. Make it PUBLIC.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: errorMessage,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);
    try {
      const result = await sendInvitationAction({
        organizationId: organization.id,
        email: inviteEmail,
        role: inviteRole,
      });

      // TODO: In production, email will be sent automatically
      // For now, show the invitation link for testing
      toast({
        variant: "success",
        title: "Invitation sent",
        description: `Invitation sent to ${inviteEmail}. In production, an email will be sent automatically.`,
      });
      
      setInviteEmail("");
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send invitation",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization settings and members
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="members" disabled={!canManage}>
            Members {canManage && `(${members.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Update your organization name and logo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateOrganization} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canManage || isUpdating}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Organization Logo</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview && (
                      <div className="relative h-20 w-20 overflow-hidden rounded-lg border">
                        <img
                          src={logoPreview}
                          alt="Organization logo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        disabled={!canManage || isUpdating}
                        className="cursor-pointer"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recommended: Square image, at least 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Updating..." : "Save Changes"}
                  </Button>
                )}
                {!canManage && (
                  <p className="text-sm text-muted-foreground">
                    Only owners and admins can update organization settings
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          {canManage ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Invite Member
                  </CardTitle>
                  <CardDescription>
                    Send an invitation to join your organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSendInvitation} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inviteEmail">Email Address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@example.com"
                          disabled={isSendingInvite}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inviteRole">Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(value) => setInviteRole(value as MembershipRole)}
                          disabled={isSendingInvite}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                            <SelectItem value="REVIEWER">Reviewer</SelectItem>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" disabled={isSendingInvite}>
                      {isSendingInvite ? "Sending..." : "Send Invitation"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members ({members.length})
                  </CardTitle>
                  <CardDescription>
                    Manage organization members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                            <span className="text-sm font-semibold">
                              {member.user.fullName
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase() ||
                                member.user.email.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {member.user.fullName || member.user.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={roleColors[member.role]}>
                            {roleLabels[member.role]}
                          </Badge>
                          {member.user.id === currentMembership.id && (
                            <Badge variant="outline">You</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {invitations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Pending Invitations ({invitations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {invitations
                        .filter((inv) => !inv.acceptedAt)
                        .map((invitation) => {
                          const isExpired = new Date(invitation.expiresAt) < new Date();
                          return (
                            <div
                              key={invitation.id}
                              className="flex items-center justify-between rounded-lg border p-4"
                            >
                              <div className="flex items-center gap-4">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{invitation.email}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Invited by {invitation.invitedBy.fullName || invitation.invitedBy.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={roleColors[invitation.role]}>
                                  {roleLabels[invitation.role]}
                                </Badge>
                                {isExpired ? (
                                  <Badge variant="destructive">Expired</Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <Clock className="mr-1 h-3 w-3" />
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Only owners and admins can manage members
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

