import type Anthropic from "@anthropic-ai/sdk";
import type { WebClient } from "@slack/web-api";
import { fetchSlackHistory } from "./fetch-slack-history";
import { searchKnowledgeTool } from "./search-knowledge";
import { createLinearIssueTool } from "./create-linear-issue";
import { lookupUser } from "./lookup-user";

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
    name: "search_knowledge",
    description: "Search the internal Gnomos knowledge base for a given query.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
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
    name: "lookup_user",
    description: "Look up a Gnomos team member by their Slack user ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        slack_user_id: {
          type: "string",
          description: "Slack user ID (e.g. U012AB3CD)",
        },
      },
      required: ["slack_user_id"],
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
    search_knowledge: (input) =>
      searchKnowledgeTool(input as { query: string }),
    create_linear_issue: (input) =>
      createLinearIssueTool(input as { title: string; description: string }),
    lookup_user: (input) => lookupUser(input as { slack_user_id: string }, ctx.slackClient),
  };
}
