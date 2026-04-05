const EMPLOYEE_EMAIL_DOMAIN = "employees.harmonize.local";
const MAX_USERNAME_LENGTH = 32;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

export function employeeUsernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

function normalizeTenantSuffix(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized;
}

export function buildTenantSuffix(input: {
  organizationSlug?: string | null;
  organizationName?: string | null;
  organizationId: string;
}) {
  const fallbackTenant = `org_${input.organizationId.replace(/-/g, "").slice(0, 6)}`;
  return (
    normalizeTenantSuffix(input.organizationSlug ?? "") ||
    normalizeTenantSuffix(input.organizationName ?? "") ||
    fallbackTenant
  );
}

export function buildTenantScopedUsername(input: {
  baseUsername: string;
  organizationSlug?: string | null;
  organizationName?: string | null;
  organizationId: string;
}) {
  const base = normalizeUsername(input.baseUsername).replace(/[^a-z0-9._-]/g, "");
  const tenant = buildTenantSuffix({
    organizationSlug: input.organizationSlug,
    organizationName: input.organizationName,
    organizationId: input.organizationId,
  });

  const suffix = `_${tenant}`;
  const availableBaseLength = Math.max(3, MAX_USERNAME_LENGTH - suffix.length);
  const trimmedBase = (base || "user").slice(0, availableBaseLength);
  return `${trimmedBase}${suffix}`;
}

export function resolveAuthIdentifierToEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) {
    return trimmed;
  }
  return employeeUsernameToEmail(trimmed);
}
