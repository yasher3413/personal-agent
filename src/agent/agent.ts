import { askClaude, summarizeSlackThread } from "./claude";
import { formatKnowledgeAnswer, searchKnowledge } from "@/knowledge/search";

export type ChudCommand =
  | { type: "ping" }
  | { type: "help" }
  | { type: "summarize_thread" }
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

  if (
    normalized.includes("summarize this thread") ||
    normalized.includes("summarise this thread") ||
    normalized.includes("summarize thread") ||
    normalized.includes("summarise thread")
  ) {
    return { type: "summarize_thread" };
  }

  return { type: "unknown", raw: text };
}

type HandleChudRequestInput = {
  text: string;
  threadText?: string | null;
};

export async function handleChudRequest({
  text,
  threadText,
}: HandleChudRequestInput): Promise<string> {
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
        "• knowledge questions → search markdown knowledge base",
        "• `summarize this thread` → summarize the current Slack thread",
        "",
        "*coming next:*",
        "• linear issue creation",
        "• smarter tool routing",
      ].join("\n");

    case "summarize_thread":
      if (!threadText) {
        return "i can only summarize a thread when you ask me inside a thread.";
      }

      return await summarizeSlackThread(threadText);

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