const EMPLOYEE_EMAIL_DOMAIN = 'employees.harmonize.local';

export function resolveAuthIdentifierToEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  return `${trimmed}@${EMPLOYEE_EMAIL_DOMAIN}`;
}
