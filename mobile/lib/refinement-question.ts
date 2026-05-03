export type RefinementQuestionOption = {
  value: string;
  label: string;
};

export type ParsedRefinementQuestion = {
  question: string;
  explanation?: string;
  options: RefinementQuestionOption[];
  field?: string;
};

function textFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseRefinementQuestion(value: unknown): ParsedRefinementQuestion | null {
  if (!value) return null;

  const parsed = typeof value === 'string' ? parseJsonSafely(value) : value;
  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;
  const question = textFromUnknown(record.question);
  if (!question) return null;

  const options = Array.isArray(record.options)
    ? record.options
        .map((option) => {
          if (typeof option === 'string' && option.trim().length > 0) {
            return { value: option, label: option };
          }

          if (option && typeof option === 'object') {
            const entry = option as Record<string, unknown>;
            const value = textFromUnknown(entry.value) || textFromUnknown(entry.label);
            const label = textFromUnknown(entry.label) || textFromUnknown(entry.value);

            if (value && label) {
              return { value, label };
            }
          }

          return null;
        })
        .filter((option): option is RefinementQuestionOption => Boolean(option))
    : [];

  return {
    question,
    explanation: textFromUnknown(record.explanation) || undefined,
    options,
    field: textFromUnknown(record.field) || undefined,
  };
}
