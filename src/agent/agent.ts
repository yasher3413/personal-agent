import type { WebClient } from "@slack/web-api";
import { runAgentLoop } from "./claude";
import { toolDefinitions, createToolExecutors } from "./tools";

const SYSTEM_PROMPT = `\
You are Chud, an internal AI assistant for Internet Backyard — the company behind gnomos, a financial OS.

Use tools to gather context before responding. Be concise.
Respond in plain Slack-friendly text (bullets, no markdown headers).
Only call create_linear_issue if the user explicitly asks to create or file an issue.`;

type RunAgentParams = {
  text: string;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
};

export async function runAgent({
  text,
  slackClient,
  channel,
  threadTs,
}: RunAgentParams): Promise<string> {
  const ctx = { slackClient };
  const userMessage = `[channel: ${channel}, thread_ts: ${threadTs}]\n\n${text.replace(/<@[^>]+>/g, "").trim()}`;

  return runAgentLoop({
    system: SYSTEM_PROMPT,
    toolDefinitions,
    toolExecutors: createToolExecutors(ctx),
    userMessage,
  });
}