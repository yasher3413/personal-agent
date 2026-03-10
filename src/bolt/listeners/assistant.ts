import { Assistant } from "@slack/bolt";
import { runAgent } from "../../agent/agent";

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

export const assistant = new Assistant({
  threadStarted: async ({ setSuggestedPrompts }) => {
    await setSuggestedPrompts({
      prompts: [
        { title: "Search the knowledge base", message: "Search the knowledge base for..." },
        { title: "Who's on the team?", message: "List everyone at Internet Backyard" },
        { title: "Create a Linear issue", message: "Create a Linear issue for..." },
        { title: "Save this thread to KB", message: "Save this thread to the knowledge base" },
      ],
    });
  },

  userMessage: async ({ message, client, setStatus }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = message as any;
    const channel: string = msg.channel;
    const threadTs: string = msg.thread_ts ?? msg.ts;
    const text: string = msg.text ?? "";

    await setStatus("Analyzing...");

    const streamer = client.chatStream({
      channel,
      thread_ts: threadTs,
      recipient_user_id: msg.user,
      recipient_team_id: msg.team,
    });

    const onChunk = async (delta: string) => {
      await streamer.append({ markdown_text: delta });
    };

    const onToolCall = async (toolName: string) => {
      const status = TOOL_STATUS[toolName] ?? `Running ${toolName}...`;
      await setStatus(status);
    };

    try {
      await runAgent({ text, slackClient: client, channel, threadTs, userId: msg.user, onChunk, onToolCall });
      await streamer.stop({});
    } catch (err) {
      await streamer.stop({});
    }
  },
});
