export const marketCodes = ["US", "EU", "UK", "VN", "CA", "AU", "FI", "DE", "NL", "FR", "OTHER"] as const;

export const marketOptions = [
  { value: "FI", label: "Finland" },
  { value: "EU", label: "European Union" },
  { value: "DE", label: "Germany" },
  { value: "NL", label: "Netherlands" },
  { value: "FR", label: "France" },
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  { value: "VN", label: "Viet Nam" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "OTHER", label: "Other" },
] as const;

export const vaultTags = [
  { value: "LAB_TEST", label: "Lab Test" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PHOTO", label: "Photo" },
  { value: "SPEC", label: "Specification" },
  { value: "OTHER", label: "Other" },
] as const;

export const riskTypes = [
  { value: "AD", label: "Anti-dumping" },
  { value: "CVD", label: "Countervailing Duty" },
  { value: "PERMIT", label: "Permit Required" },
  { value: "TARIFF", label: "Special Tariff" },
  { value: "OTHER", label: "Other" },
] as const;

export const classificationStatuses = [
  { value: "DRAFT", label: "Draft" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

export const membershipRoles = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "CONTRIBUTOR", label: "Contributor" },
  { value: "REVIEWER", label: "Reviewer" },
  { value: "VIEWER", label: "Viewer" },
] as const;

