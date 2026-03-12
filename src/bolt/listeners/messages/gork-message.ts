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
  create_linear_project: "Creating Linear project...",
  create_linear_milestone: "Creating Linear milestone...",
  list_linear_projects: "Fetching Linear projects...",
  list_linear_labels: "Fetching Linear labels...",
  list_linear_workflow_states: "Fetching Linear workflow states...",
  list_channels: "Listing channels...",
  list_users: "Fetching team directory...",
  append_notion_page: "Updating Notion page...",
  add_knowledge_index_item: "Updating knowledge index...",
  update_knowledge_index_item: "Updating knowledge index...",
};

export const gorkMessageCallback = async ({ event, client, body }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  const setStatus = async (status: string) => {
    await client.assistant.threads.setStatus({
      channel_id: event.channel,
      thread_ts: threadTs,
      status,
    }).catch(() => {});
  };

  await setStatus("is thinking...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamer: any = client.chatStream({
    channel: event.channel,
    thread_ts: threadTs,
    recipient_user_id: event.user,
    recipient_team_id: body.team_id,
  });

  const onChunk = async (delta: string) => {
    await streamer.append({ markdown_text: delta });
  };

  const onToolCall = async (toolName: string) => {
    await setStatus(TOOL_STATUS[toolName] ?? `Running ${toolName}...`);
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
    await streamer.stop({});
  } catch (err) {
    console.error("gorkMessageCallback error:", err);
    await streamer.stop({});
  }
};
