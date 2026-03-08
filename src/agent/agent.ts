import { askClaude } from "./claude";
import { formatKnowledgeAnswer, searchKnowledge } from "@/knowledge/search";

export type ChudCommand =
  | { type: "ping" }
  | { type: "help" }
  | { type: "unknown"; raw: string };

export function parseChudCommand(text: string): ChudCommand {
  const normalized = text.toLowerCase().trim();

  if (normalized.includes("ping")) {
    return { type: "ping" };
  }

  if (
    normalized.includes("help") ||
    normalized.includes("what can you do") ||
    normalized.includes("commands")
  ) {
    return { type: "help" };
  }

  return { type: "unknown", raw: text };
}

export async function handleChudRequest(text: string): Promise<string> {
  const command = parseChudCommand(text);

  switch (command.type) {
    case "ping":
      return "pong";

    case "help":
      return [
        "*chud is online*",
        "",
        "*currently supported:*",
        "• `ping` → health check",
        "• `help` / `what can you do` → show supported commands",
        "• questions about knowledge docs → search markdown knowledge base",
        "",
        "*coming next:*",
        "• summarize threads",
        "• create linear issues",
      ].join("\n");

    case "unknown": {
      const knowledgeHit = searchKnowledge(command.raw);

      if (knowledgeHit) {
        return await askClaude(
          `Answer the user's question using the following internal knowledge document.
        
        Question:
        ${command.raw}
        
        Knowledge document:
        ${knowledgeHit.content}
        
        Respond concisely for Slack.`
        );      
      }

      return await askClaude(command.raw);
    }
  }
}