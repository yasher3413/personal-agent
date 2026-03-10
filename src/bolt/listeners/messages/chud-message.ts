import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

const TOOL_STATUS: Record<string, string> = {
  fetch_slack_history: "Reading Slack history...",
  search_notion: "Searching Notion...",
  get_notion_page: "Reading Notion page...",
  write_notion_page: "Saving to Notion...",
  create_linear_issue: "Creating Linear issue...",
  lookup_user: "Looking up user...",
  list_users: "Fetching team directory...",
};

export const chudMessageCallback = async ({ event, client, body }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  const streamer = client.chatStream({
    channel: event.channel,
    thread_ts: threadTs,
    recipient_user_id: event.user,
    recipient_team_id: body.team_id,
  });

  const onChunk = async (delta: string) => {
    await streamer.append({ markdown_text: delta });
  };

  const onToolCall = async (toolName: string) => {
    const status = TOOL_STATUS[toolName] ?? `Running ${toolName}...`;
    await streamer.append({ markdown_text: `_${status}_\n` });
  };

  try {
    await runAgent({
      text: event.text,
      slackClient: client,
      channel: event.channel,
      threadTs,
      onChunk,
      onToolCall,
    });
    await streamer.stop({});
  } catch (err) {
    await streamer.stop({});
  }
};
