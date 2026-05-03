export function normalizeCodeDigits(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

export function isInvalidZeroCode(value?: string | null) {
  const normalized = normalizeCodeDigits(value);
  return (
    normalized === '000000' ||
    normalized === '00000000' ||
    normalized === '0000000000'
  );
}

export function getPreferredClassificationCode(input: {
  cnCode?: string | null;
  htsCode?: string | null;
  hsCode?: string | null;
}) {
  const candidates = [input.cnCode, input.htsCode, input.hsCode];

  for (const candidate of candidates) {
    const normalized = normalizeCodeDigits(candidate);
    if (!normalized || isInvalidZeroCode(candidate)) continue;
    return candidate || null;
  }

  return null;
}

export function formatClassificationCode(value?: string | null) {
  if (!value || isInvalidZeroCode(value)) return null;

  const compact = normalizeCodeDigits(value);
  if (compact.length === 6) {
    return `${compact.slice(0, 2)}.${compact.slice(2, 4)}.${compact.slice(4, 6)}`;
  }
  if (compact.length === 8) {
    return `${compact.slice(0, 4)} ${compact.slice(4, 6)} ${compact.slice(6, 8)}`;
  }
  if (compact.length === 10) {
    return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}.${compact.slice(8, 10)}`;
  }

  return value;
}
