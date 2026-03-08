import {
  askClaude,
  draftLinearIssueFromThread,
  summarizeSlackThread,
} from "./claude";
import { searchKnowledge } from "@/knowledge/search";
import { createLinearIssue } from "@/linear/create-issue";

export type ChudCommand =
  | { type: "ping" }
  | { type: "help" }
  | { type: "summarize_thread" }
  | { type: "create_linear_issue" }
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

  if (
    /create (a )?linear issue from this thread/.test(normalized) ||
    /make (a )?linear issue from this thread/.test(normalized) ||
    /create (an )?issue from this thread/.test(normalized)
  ) {
    return { type: "create_linear_issue" };
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
        "• `create linear issue from this thread` → create a Linear issue from thread context",
      ].join("\n");

    case "summarize_thread":
      if (!threadText) {
        return "i can only summarize a thread when you ask me inside a thread.";
      }

      return await summarizeSlackThread(threadText);

    case "create_linear_issue":
      if (!threadText) {
        return "i can only create a Linear issue when you ask me inside a thread.";
      }

      const draftedIssue = await draftLinearIssueFromThread(threadText);

      if (!draftedIssue) {
        return "i couldn't draft a Linear issue from that thread.";
      }

      try {
        const created = await createLinearIssue(draftedIssue);

        return [
          `created linear issue: *${created.identifier}*`,
          created.title,
          created.url,
        ].join("\n");
      } catch (error) {
        console.error("createLinearIssue error:", error);
        return "i couldn't create the Linear issue. check runtime logs and env vars.";
      }

    case "unknown": {
      const knowledgeHit = searchKnowledge(command.raw);

      if (knowledgeHit) {
        return await askClaude(
          `You are Chud, an internal Slack agent.

Answer the user's question using the internal knowledge document below.
Use the document as your primary source.
Be concise, clear, and natural for Slack.
Do not mention limitations unless necessary.

Question:
${command.raw}

Knowledge document:
${knowledgeHit.content}`
        );
      }

      return await askClaude(`
You are Chud, an internal Slack agent for the team.

Behave like a helpful internal assistant.
Do not assume every question is about Gnomos.
If the user asks a general question, answer it normally and concisely.
If the user asks about company/project context, answer based on the information available.
Do not refuse just because the question is outside the knowledge base.

User message:
${command.raw}
`);
    }
  }
}