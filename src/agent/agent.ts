export async function handleChudRequest(text: string): Promise<string> {
  const normalized = text.toLowerCase();

  if (normalized.includes("ping")) {
    return "pong";
  }

  return "chud is alive";
}