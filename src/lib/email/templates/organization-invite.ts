import { MembershipRole } from "@prisma/client";

type BuildOrganizationInviteEmailParams = {
  organizationName: string;
  inviteeEmail: string;
  inviterName: string;
  role: MembershipRole;
  acceptUrl: string;
  expiresAt: Date;
  inviteMode?: "standard" | "create_account";
};

const roleLabels: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  CONTRIBUTOR: "Contributor",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

export function buildOrganizationInviteEmail(params: BuildOrganizationInviteEmailParams) {
  const {
    organizationName,
    inviteeEmail,
    inviterName,
    role,
    acceptUrl,
    expiresAt,
    inviteMode = "standard",
  } = params;

  const roleLabel = roleLabels[role];
  const expiresAtText = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const title =
    inviteMode === "create_account"
      ? `Create your account and join ${organizationName}`
      : `You're invited to join ${organizationName}`;

  const subtitle =
    inviteMode === "create_account"
      ? "Use this secure link to create a password account or continue with Google."
      : "Use this secure invitation link to join your team workspace.";

  const subject = `${organizationName} invitation - ${roleLabel} access`;

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Harmonize AI Workspace Invitation</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;font-weight:700;">${escapeHtml(title)}</h1>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.6;opacity:.95;">${escapeHtml(subtitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(inviteeEmail)},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
                  <strong>${escapeHtml(inviterName)}</strong> invited you to join
                  <strong>${escapeHtml(organizationName)}</strong> as
                  <strong>${escapeHtml(roleLabel)}</strong>.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#334155;">
                      <div style="margin:0 0 6px;"><strong>Workspace:</strong> ${escapeHtml(organizationName)}</div>
                      <div style="margin:0 0 6px;"><strong>Role:</strong> ${escapeHtml(roleLabel)}</div>
                      <div style="margin:0;"><strong>Expires:</strong> ${escapeHtml(expiresAtText)}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 22px;text-align:center;">
                  <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">
                    Accept Invitation
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;">
                  If the button does not work, paste this URL into your browser:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#0369a1;">
                  <a href="${escapeHtml(acceptUrl)}" style="color:#0369a1;text-decoration:underline;">${escapeHtml(acceptUrl)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                  This invitation was sent to ${escapeHtml(inviteeEmail)}. If you were not expecting it, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const text = [
    `Harmonize AI Workspace Invitation`,
    ``,
    title,
    subtitle,
    ``,
    `${inviterName} invited you to join ${organizationName} as ${roleLabel}.`,
    `This invitation expires at ${expiresAtText}.`,
    ``,
    `Accept invitation: ${acceptUrl}`,
    ``,
    `If you were not expecting this email, you can safely ignore it.`,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
