import { createHmac, randomBytes } from "crypto";

const INVITATION_TOKEN_BYTES = 32;

function getInviteTokenSecret() {
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("INVITE_TOKEN_SECRET is not configured");
  }
  return secret;
}

export function hashInvitationToken(rawToken: string) {
  return createHmac("sha256", getInviteTokenSecret())
    .update(rawToken)
    .digest("hex");
}

export function createInvitationToken() {
  const rawToken = randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
  return {
    rawToken,
    tokenHash: hashInvitationToken(rawToken),
  };
}
