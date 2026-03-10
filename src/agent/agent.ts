import type { WebClient } from "@slack/web-api";
import { createClaudeMemoryTool } from "@supermemory/tools/claude-memory";
import { runAgentLoop } from "./claude";
import { toolDefinitions, createToolExecutors } from "./tools";

const SYSTEM_PROMPT = `\
You are Chud, an internal AI assistant for Internet Backyard — the company behind gnomos, a financial OS.

Use tools to gather context before responding. Be concise.
Respond in plain Slack-friendly text (bullets, no markdown headers).
Only call create_linear_issue if the user explicitly asks to create or file an issue. Use update_linear_issue, get_linear_issue, and list_linear_issues freely when asked about issues.
Only call write_notion_page if the user explicitly asks to save, document, or add something to the knowledge base.
When asked to save a thread or conversation to the knowledge base, first call fetch_slack_history with the current thread_ts to read the messages, then summarize them into a concise knowledge base article and call write_notion_page with that summary.
If search_notion returns no results, don't just say "I don't know" — acknowledge the gap and offer to create a new knowledge base entry on that topic if the user can provide the details.
You have persistent memory across conversations. Use it to remember user preferences, past decisions, and important context. Store memories proactively when you learn something worth retaining.`;

function getMemoryTool() {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) return undefined;
  return createClaudeMemoryTool(key);
}

type RunAgentParams = {
  text: string;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  userId?: string;
  onChunk?: (text: string) => Promise<void>;
  onToolCall?: (toolName: string) => Promise<void>;
};

export async function runAgent({
  text,
  slackClient,
  channel,
  threadTs,
  userId,
  onChunk,
  onToolCall,
}: RunAgentParams): Promise<string> {
  const ctx = { slackClient };
  const userContext = userId ? `[user: ${userId}, channel: ${channel}, thread_ts: ${threadTs}]` : `[channel: ${channel}, thread_ts: ${threadTs}]`;
  const userMessage = `${userContext}\n\n${text.replace(/<@[^>]+>/g, "").trim()}`;

  return runAgentLoop({
    system: SYSTEM_PROMPT,
    toolDefinitions,
    toolExecutors: createToolExecutors(ctx),
    userMessage,
    memoryTool: getMemoryTool(),
    onChunk,
    onToolCall,
  });
}
