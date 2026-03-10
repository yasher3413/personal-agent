import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

const STREAM_THROTTLE_MS = 300;

const TOOL_STATUS: Record<string, string> = {
  fetch_slack_history: "_reading slack history..._",
  search_knowledge: "_searching knowledge base..._",
  create_linear_issue: "_creating linear issue..._",
  lookup_user: "_looking up user..._",
  list_users: "_fetching team directory..._",
};

export const chudMessageCallback = async ({ event, client }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  const placeholder = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: "...",
  });

  const messageTs = placeholder.ts!;
  let lastUpdateAt = 0;

  const onChunk = async (text: string) => {
    const now = Date.now();
    if (now - lastUpdateAt < STREAM_THROTTLE_MS) return;
    lastUpdateAt = now;
    await client.chat.update({ channel: event.channel, ts: messageTs, text });
  };

  const onToolCall = async (toolName: string) => {
    const status = TOOL_STATUS[toolName] ?? `_running ${toolName}..._`;
    await client.chat.update({ channel: event.channel, ts: messageTs, text: status });
  };

  const response = await runAgent({
    text: event.text,
    slackClient: client,
    channel: event.channel,
    threadTs,
    onChunk,
    onToolCall,
  });

  await client.chat.update({ channel: event.channel, ts: messageTs, text: response });
};