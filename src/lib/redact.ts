const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g,           // Anthropic/OpenAI keys
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,   // Bearer tokens
  /token=\S{10,}/gi,                   // token= query params
  /api[_-]?key[=:]\s*\S{10,}/gi,      // api_key=... or apikey: ...
  /xoxb-[a-zA-Z0-9-]+/g,              // Slack bot tokens
  /xoxp-[a-zA-Z0-9-]+/g,              // Slack user tokens
  /lin_api_[a-zA-Z0-9]+/g,            // Linear API keys
  /secret_[a-zA-Z0-9]+/g,             // Notion secrets
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function safeError(err: unknown): string {
  return redactSecrets(String(err));
}
