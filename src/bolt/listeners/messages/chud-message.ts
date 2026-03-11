import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { runAgent } from "../../../agent/agent";

type SlackMessage = { ts?: string; user?: string; text?: string; bot_id?: string };

async function fetchMentionContext(
  client: WebClient,
  channel: string,
  eventTs: string,
  threadTs?: string
): Promise<string> {
  try {
    if (threadTs) {
      const res = await client.conversations.replies({ channel, ts: threadTs, limit: 50 });
      const messages = (res.messages as SlackMessage[] ?? []).filter((m) => m.ts !== eventTs);
      return formatMessages(messages, "Thread context");
    } else {
      const res = await client.conversations.history({ channel, limit: 15, latest: eventTs, inclusive: false });
      const messages = (res.messages as SlackMessage[] ?? []).reverse();
      return formatMessages(messages, "Recent channel context");
    }
  } catch {
    return "";
  }
}

function formatMessages(messages: SlackMessage[], label: string): string {
  if (!messages.length) return "";
  const lines = messages
    .filter((m) => m.text?.trim())
    .map((m) => {
      const who = m.bot_id ? "bot" : `<@${m.user ?? "unknown"}>`;
      return `${who}: ${m.text}`;
    });
  if (!lines.length) return "";
  return `## ${label}\n\n${lines.join("\n")}`;
}

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

const TOOL_STATUS: Record<string, string> = {
  web_search: "Searching the web...",
  read_url: "Reading page...",
  fetch_slack_history: "Reading Slack history...",
  search_notion: "Searching Notion...",
  get_notion_page: "Reading Notion page...",
  write_notion_page: "Saving to Notion...",
  create_linear_issue: "Creating Linear issue...",
  update_linear_issue: "Updating Linear issue...",
  get_linear_issue: "Fetching Linear issue...",
  list_linear_issues: "Searching Linear issues...",
  lookup_user: "Looking up user...",
  add_linear_comment: "Adding comment to Linear issue...",
  list_linear_projects: "Fetching Linear projects...",
  list_linear_labels: "Fetching Linear labels...",
  list_linear_workflow_states: "Fetching Linear workflow states...",
  list_channels: "Listing channels...",
  list_users: "Fetching team directory...",
  append_notion_page: "Updating Notion page...",
  add_knowledge_index_item: "Updating knowledge index...",
  update_knowledge_index_item: "Updating knowledge index...",
};

export const chudMessageCallback = async ({ event, client, body }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  // Call chat.startStream immediately so shimmer appears before any processing
  const startRes = await client.chat.startStream({
    channel: event.channel,
    thread_ts: threadTs,
    recipient_user_id: event.user,
    recipient_team_id: body.team_id,
  }).catch((err) => { console.error("chat.startStream error:", err); return null; });

  const streamTs = startRes?.ts ?? null;

  const appendStream = async (delta: string) => {
    if (!streamTs) return;
    await client.chat.appendStream({ channel: event.channel, ts: streamTs, markdown_text: delta })
      .catch((err) => console.error("chat.appendStream error:", err));
  };

  const stopStream = async () => {
    if (!streamTs) return;
    await client.chat.stopStream({ channel: event.channel, ts: streamTs })
      .catch((err) => console.error("chat.stopStream error:", err));
  };

  // Separate ephemeral status message for tool feedback — deleted when response starts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let statusMsg: any = null;
  let statusDeleted = false;

  const deleteStatus = async () => {
    if (!statusDeleted && statusMsg?.ts) {
      statusDeleted = true;
      await client.chat.delete({ channel: event.channel, ts: statusMsg.ts })
        .catch((err) => console.error("chat.delete error:", err));
    }
  };

  const onChunk = async (delta: string) => {
    await deleteStatus();
    await appendStream(delta);
  };

  const onToolCall = async (toolName: string) => {
    if (statusDeleted) return;
    const status = TOOL_STATUS[toolName] ?? `Running ${toolName}...`;
    if (!statusMsg) {
      statusMsg = await client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: `_${status}_`,
      }).catch((err) => { console.error("chat.postMessage error:", err); return null; });
    } else if (statusMsg.ts) {
      await client.chat.update({
        channel: event.channel,
        ts: statusMsg.ts,
        text: `_${status}_`,
      }).catch((err) => console.error("chat.update error:", err));
    }
  };

  const slackContext = await fetchMentionContext(client, event.channel, event.ts, event.thread_ts);

  try {
    await runAgent({
      text: event.text,
      slackContext,
      slackClient: client,
      channel: event.channel,
      threadTs,
      userId: event.user,
      onChunk,
      onToolCall,
    });
    await deleteStatus();
    await stopStream();
  } catch (err) {
    console.error("chudMessageCallback error:", err);
    await deleteStatus();
    await stopStream();
  }
};
