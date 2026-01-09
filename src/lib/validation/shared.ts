import { z } from "zod";
import {
  classificationStatuses,
  marketCodes,
  membershipRoles,
  riskTypes,
  vaultTags,
} from "@/lib/constants/markets";

export const marketCodeSchema = z.enum(marketCodes);
export const vaultTagSchema = z.enum(vaultTags.map((tag) => tag.value) as [
  string,
  ...string[],
]);
export const riskTypeSchema = z.enum(riskTypes.map((tag) => tag.value) as [
  string,
  ...string[],
]);
export const classificationStatusSchema = z.enum(
  classificationStatuses.map((tag) => tag.value) as [string, ...string[]],
);
export const membershipRoleSchema = z.enum(
  membershipRoles.map((tag) => tag.value) as [string, ...string[]],
);

export type MarketCode = z.infer<typeof marketCodeSchema>;
export type VaultTag = z.infer<typeof vaultTagSchema>;
export type RiskType = z.infer<typeof riskTypeSchema>;
export type ClassificationStatus = z.infer<typeof classificationStatusSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

