import type Anthropic from "@anthropic-ai/sdk";
import type { WebClient } from "@slack/web-api";
import { fetchSlackHistory } from "./fetch-slack-history";
import { searchNotionTool, getNotionPageTool } from "./search-notion";
import { writeNotionPageTool, appendNotionPageTool } from "./write-notion-page";
import { createLinearIssueTool, updateLinearIssueTool, getLinearIssueTool, listLinearIssuesTool, addLinearCommentTool, listLinearProjectsTool, listLinearLabelsTool, listLinearWorkflowStatesTool } from "./linear";
import { lookupUser, listUsers } from "./lookup-user";
import { addKnowledgeIndexItemTool, updateKnowledgeIndexItemTool } from "./notion-index";
import { listChannels } from "./list-channels";
import { webSearchTool, readUrlTool } from "./web-search";

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
        area: { type: "string", description: "Knowledge base area/section (optional)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "append_notion_page",
    description: "Append content to an existing Notion page by its page ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "Notion page ID to append to" },
        content: { type: "string", description: "Content to append in markdown" },
      },
      required: ["page_id", "content"],
    },
  },
  {
    name: "add_knowledge_index_item",
    description: "Add a new entry to the Knowledge Base Index database after creating a Notion page. Always call this after write_notion_page to keep the index in sync.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Page title" },
        summary: { type: "string", description: "One-sentence summary for the index" },
        area: { type: "string", description: "Knowledge base area/category" },
        tags: { type: "array", items: { type: "string" }, description: "Searchable tags" },
        page_id: { type: "string", description: "The Notion page ID returned by write_notion_page" },
      },
      required: ["title", "summary", "area", "tags", "page_id"],
    },
  },
  {
    name: "update_knowledge_index_item",
    description: "Update an existing Knowledge Base Index entry after modifying a Notion page. Always call this after append_notion_page to keep the index in sync.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "The Notion page ID to find and update in the index" },
        summary: { type: "string", description: "Updated summary (optional)" },
        tags: { type: "array", items: { type: "string" }, description: "Updated tags (optional)" },
        area: { type: "string", description: "Updated area (optional)" },
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
        description: { type: "string", description: "Issue description in markdown" },
        priority: { type: "number", description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low (optional)" },
        project: { type: "string", description: "Project name or ID to assign the issue to (optional)" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_linear_issue",
    description: "Update an existing Linear issue. Use to change title, description, priority, state, or project.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Linear issue ID" },
        title: { type: "string", description: "New title (optional)" },
        description: { type: "string", description: "New description in markdown (optional)" },
        priority: { type: "number", description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low (optional)" },
        state: { type: "string", description: "State name e.g. 'In Progress', 'Done', 'Backlog' (optional)" },
        project: { type: "string", description: "Project name or ID to move the issue to (optional)" },
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
    name: "add_linear_comment",
    description: "Add a comment to an existing Linear issue.",
    input_schema: {
      type: "object" as const,
      properties: {
        issue_id: { type: "string", description: "Linear issue ID" },
        body: { type: "string", description: "Comment body in markdown" },
      },
      required: ["issue_id", "body"],
    },
  },
  {
    name: "list_linear_projects",
    description: "List all Linear projects for the workspace.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_linear_labels",
    description: "List all issue labels for the team.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_linear_workflow_states",
    description: "List all workflow states (e.g. Todo, In Progress, Done) for the team.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_url",
    description: "Read the full content of a URL. Use when someone shares a link and asks to summarize or explain it.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL to read" },
      },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for current information, news, documentation, or anything not in the internal knowledge base.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: { type: "number", description: "Number of results to return (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_channels",
    description:
      "List all Slack channels in the workspace. Use this when you need to find a channel by name before fetching its history.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
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
    write_notion_page: (input) => writeNotionPageTool(input as { title: string; content: string; area?: string }),
    append_notion_page: (input) => appendNotionPageTool(input as { page_id: string; content: string }),
    add_knowledge_index_item: (input) =>
      addKnowledgeIndexItemTool(input as { title: string; summary: string; area: string; tags: string[]; page_id: string }),
    update_knowledge_index_item: (input) =>
      updateKnowledgeIndexItemTool(input as { page_id: string; summary?: string; tags?: string[]; area?: string }),
    create_linear_issue: (input) =>
      createLinearIssueTool(input as { title: string; description: string; priority?: number; project?: string }),
    update_linear_issue: (input) =>
      updateLinearIssueTool(input as { id: string; title?: string; description?: string; priority?: number; state?: string; project?: string }),
    get_linear_issue: (input) => getLinearIssueTool(input as { id: string }),
    list_linear_issues: (input) =>
      listLinearIssuesTool(input as { query?: string; state?: string; assignee?: string; limit?: number }),
    add_linear_comment: (input) => addLinearCommentTool(input as { issue_id: string; body: string }),
    list_linear_projects: () => listLinearProjectsTool(),
    list_linear_labels: () => listLinearLabelsTool(),
    list_linear_workflow_states: () => listLinearWorkflowStatesTool(),
    read_url: (input) => readUrlTool(input as { url: string }),
    web_search: (input) => webSearchTool(input as { query: string; num_results?: number }),
    list_channels: () => listChannels(ctx.slackClient),
    list_users: () => listUsers(ctx.slackClient),
    lookup_user: (input) => lookupUser(input as { slack_user_id: string; name?: string }, ctx.slackClient),
  };
}
