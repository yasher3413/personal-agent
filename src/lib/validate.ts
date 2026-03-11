const MAX_INPUT_LENGTH = 4000;

// Patterns that look like prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /system prompt/i,
  /you are now/i,
  /disregard (all |your |previous )?/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
];

export type ValidationResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export function validateInput(text: string): ValidationResult {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, reason: "empty message" };
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: `message too long (max ${MAX_INPUT_LENGTH} chars)` };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: "message contains disallowed content" };
    }
  }

  return { ok: true, text: trimmed };
}
