"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Package, Upload, Download, Trash2, Edit, Plus } from "lucide-react";
import type { AuditLog, User } from "@prisma/client";

type AuditLogWithUser = AuditLog & {
  user: Pick<User, "id" | "email" | "fullName"> | null;
};

type Props = {
  initialLogs: AuditLogWithUser[];
  organizationId: string;
};

const actionIcons: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-4 w-4" />,
  UPDATE: <Edit className="h-4 w-4" />,
  DELETE: <Trash2 className="h-4 w-4" />,
  GENERATE: <FileText className="h-4 w-4" />,
  EXPORT: <Download className="h-4 w-4" />,
  UPLOAD: <Upload className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  CREATE: "bg-blue-100 text-blue-800",
  UPDATE: "bg-yellow-100 text-yellow-800",
  DELETE: "bg-red-100 text-red-800",
  GENERATE: "bg-green-100 text-green-800",
  EXPORT: "bg-purple-100 text-purple-800",
  UPLOAD: "bg-cyan-100 text-cyan-800",
};

const entityTypeLabels: Record<string, string> = {
  CLASSIFICATION: "Classification",
  DOSSIER: "Dossier",
  VAULT_FILE: "Vault File",
  PRODUCT: "Product",
  SUPPLIER_LINK: "Supplier Link",
  AUDIT_PACKAGE: "Audit Package",
  CHAT_SESSION: "Chat Session",
};

export function AuditLogPageClient({ initialLogs, organizationId }: Props) {
  const [logs] = useState<AuditLogWithUser[]>(initialLogs);

  const formatAction = (action: string) => {
    return action.charAt(0) + action.slice(1).toLowerCase();
  };

  const formatEntityType = (entityType: string) => {
    return entityTypeLabels[entityType] || entityType;
  };

  const getActionIcon = (action: string) => {
    return actionIcons[action] || <AlertTriangle className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    return actionColors[action] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Track all compliance-related actions and changes in your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>
            Complete audit trail of all actions performed in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No audit log entries yet. Actions will appear here as you use the system.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <div>
                          <p className="text-sm font-medium">
                            {log.user.fullName || log.user.email}
                          </p>
                          {log.user.fullName && (
                            <p className="text-xs text-muted-foreground">
                              {log.user.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>
                        <span className="mr-1">{getActionIcon(log.action)}</span>
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {formatEntityType(log.entityType)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {log.entityId.substring(0, 8)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.payload ? (
                        <div className="text-xs text-muted-foreground">
                          {typeof log.payload === "object" ? (
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          ) : (
                            String(log.payload)
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

