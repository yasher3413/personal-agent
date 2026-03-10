import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

const TOOL_STATUS: Record<string, string> = {
  fetch_slack_history: "Reading Slack history...",
  search_notion: "Searching Notion...",
  get_notion_page: "Reading Notion page...",
  write_notion_page: "Saving to Notion...",
  create_linear_issue: "Creating Linear issue...",
  update_linear_issue: "Updating Linear issue...",
  get_linear_issue: "Fetching Linear issue...",
  list_linear_issues: "Searching Linear issues...",
  lookup_user: "Looking up user...",
  list_users: "Fetching team directory...",
  append_notion_page: "Updating Notion page...",
  add_knowledge_index_item: "Updating knowledge index...",
  update_knowledge_index_item: "Updating knowledge index...",
};

export const chudMessageCallback = async ({ event, client, body }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  // Status message shown during tool calls — deleted once the response starts streaming
  const statusMsg = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: "_Analyzing..._",
  });

  const streamer = client.chatStream({
    channel: event.channel,
    thread_ts: threadTs,
    recipient_user_id: event.user,
    recipient_team_id: body.team_id,
  });

  let statusDeleted = false;
  const deleteStatus = async () => {
    if (!statusDeleted && statusMsg.ts) {
      statusDeleted = true;
      await client.chat.delete({ channel: event.channel, ts: statusMsg.ts }).catch(() => {});
    }
  };

  const onChunk = async (delta: string) => {
    await deleteStatus();
    await streamer.append({ markdown_text: delta });
  };

  const onToolCall = async (toolName: string) => {
    if (statusDeleted) return;
    const status = TOOL_STATUS[toolName] ?? `Running ${toolName}...`;
    await client.chat.update({
      channel: event.channel,
      ts: statusMsg.ts!,
      text: `_${status}_`,
    }).catch(() => {});
  };

  try {
    await runAgent({
      text: event.text,
      slackClient: client,
      channel: event.channel,
      threadTs,
      userId: event.user,
      onChunk,
      onToolCall,
    });
    await deleteStatus();
    await streamer.stop({});
  } catch {
    await deleteStatus();
    await streamer.stop({});
  }
};
