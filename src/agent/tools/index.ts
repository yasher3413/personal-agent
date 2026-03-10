import type Anthropic from "@anthropic-ai/sdk";
import type { WebClient } from "@slack/web-api";
import { fetchSlackHistory } from "./fetch-slack-history";
import { searchNotionTool, getNotionPageTool } from "./search-notion";
import { writeNotionPageTool } from "./write-notion-page";
import { createLinearIssueTool, updateLinearIssueTool, getLinearIssueTool, listLinearIssuesTool } from "./linear";
import { lookupUser, listUsers } from "./lookup-user";
import { searchMemoryTool, addMemoryTool } from "./supermemory";

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
        thread_ts: { type: "string", description: "Thread timestamp to fetch replies (optional)" },
        limit: { type: "number", description: "Max messages to return (default 20)" },
        cursor: { type: "string", description: "Pagination cursor from a previous call (optional)" },
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
    name: "write_notion_page",
    description:
      "Create a new page in the Internet Backyard knowledge base. Use this when the user explicitly asks to save, document, or add something to the knowledge base.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Page title" },
        content: { type: "string", description: "Page content in markdown" },
      },
      required: ["title", "content"],
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
        description: { type: "string", description: "Issue description in markdown" },
        priority: { type: "number", description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low (optional)" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_linear_issue",
    description: "Update an existing Linear issue. Use to change title, description, priority, or state.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Linear issue ID" },
        title: { type: "string", description: "New title (optional)" },
        description: { type: "string", description: "New description in markdown (optional)" },
        priority: { type: "number", description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low (optional)" },
        state: { type: "string", description: "State name e.g. 'In Progress', 'Done', 'Backlog' (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_linear_issue",
    description: "Get full details of a specific Linear issue by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Linear issue ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_linear_issues",
    description:
      "List Linear issues for the team. Can filter by state, assignee, or search query. Use this when asked about what's in progress, what's assigned to someone, or to find issues.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term to filter by title/description (optional)" },
        state: { type: "string", description: "Filter by state name e.g. 'In Progress', 'Todo' (optional)" },
        assignee: { type: "string", description: "Filter by assignee name (optional)" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "search_memory",
    description:
      "Search persistent memory for things previously remembered about a user or the team. Use this proactively at the start of conversations to recall relevant context.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "What to search for" },
        user_id: { type: "string", description: "Slack user ID to scope results to a specific person (optional)" },
      },
      required: ["query"],
    },
  },
  {
    name: "add_memory",
    description:
      "Save something to persistent memory — user preferences, decisions, or context worth remembering across conversations. Only call when the user asks you to remember something, or when you learn something clearly worth retaining.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "What to remember" },
        user_id: { type: "string", description: "Slack user ID to associate this memory with (optional)" },
      },
      required: ["content"],
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
        slack_user_id: { type: "string", description: "Slack user ID (e.g. U012AB3CD)" },
        name: { type: "string", description: "Name or partial name to search for (e.g. 'jonah', 'gabe')" },
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
      fetchSlackHistory(input as Parameters<typeof fetchSlackHistory>[0], ctx.slackClient),
    search_notion: (input) => searchNotionTool(input as { query: string }),
    get_notion_page: (input) => getNotionPageTool(input as { page_id: string }),
    write_notion_page: (input) => writeNotionPageTool(input as { title: string; content: string }),
    create_linear_issue: (input) =>
      createLinearIssueTool(input as { title: string; description: string; priority?: number }),
    update_linear_issue: (input) =>
      updateLinearIssueTool(input as { id: string; title?: string; description?: string; priority?: number; state?: string }),
    get_linear_issue: (input) => getLinearIssueTool(input as { id: string }),
    list_linear_issues: (input) =>
      listLinearIssuesTool(input as { query?: string; state?: string; assignee?: string; limit?: number }),
    search_memory: (input) => searchMemoryTool(input as { query: string; user_id?: string }),
    add_memory: (input) => addMemoryTool(input as { content: string; user_id?: string }),
    list_users: () => listUsers(ctx.slackClient),
    lookup_user: (input) => lookupUser(input as { slack_user_id: string; name?: string }, ctx.slackClient),
  };
}
