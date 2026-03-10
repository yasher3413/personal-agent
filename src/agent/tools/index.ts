import type Anthropic from "@anthropic-ai/sdk";
import type { WebClient } from "@slack/web-api";
import { fetchSlackHistory } from "./fetch-slack-history";
import { searchNotionTool, getNotionPageTool } from "./search-notion";
import { createLinearIssueTool } from "./create-linear-issue";
import { lookupUser, listUsers } from "./lookup-user";

export type ToolContext = { slackClient: WebClient };

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "fetch_slack_history",
    description:
      "Fetch messages from a Slack channel or thread. Use thread_ts to fetch replies in a specific thread.",
    input_schema: {
      type: "object" as const,
      properties: {
        channel_id: { type: "string", description: "Slack channel ID" },
        thread_ts: {
          type: "string",
          description: "Thread timestamp to fetch replies (optional)",
        },
        limit: {
          type: "number",
          description: "Max messages to return (default 20)",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from a previous call (optional)",
        },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "search_notion",
    description:
      "Search the Internet Backyard Notion workspace for internal documentation, processes, or knowledge. Use this to answer questions about the company, product, or team.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_notion_page",
    description:
      "Retrieve the full content of a specific Notion page by its ID. Use this after search_notion to read a page in detail.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "Notion page ID" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "create_linear_issue",
    description:
      "Create a Linear issue. Only call this when the user has explicitly asked to create or file an issue.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Issue title" },
        description: {
          type: "string",
          description: "Issue description in markdown",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "list_users",
    description:
      "List all active team members at Internet Backyard. Use this when asked for a directory, team list, or 'who's on the team'.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "lookup_user",
    description:
      "Look up an Internet Backyard team member. Provide either slack_user_id for a direct lookup, or name to search by display name or real name.",
    input_schema: {
      type: "object" as const,
      properties: {
        slack_user_id: {
          type: "string",
          description: "Slack user ID (e.g. U012AB3CD)",
        },
        name: {
          type: "string",
          description: "Name or partial name to search for (e.g. 'jonah', 'gabe')",
        },
      },
      required: [],
    },
  },
];

export function createToolExecutors(
  ctx: ToolContext
): Record<string, (input: unknown) => Promise<string>> {
  return {
    fetch_slack_history: (input) =>
      fetchSlackHistory(
        input as Parameters<typeof fetchSlackHistory>[0],
        ctx.slackClient
      ),
    search_notion: (input) => searchNotionTool(input as { query: string }),
    get_notion_page: (input) => getNotionPageTool(input as { page_id: string }),
    create_linear_issue: (input) =>
      createLinearIssueTool(input as { title: string; description: string }),
    list_users: () => listUsers(ctx.slackClient),
    lookup_user: (input) => lookupUser(input as { slack_user_id: string; name?: string }, ctx.slackClient),
  };
}
