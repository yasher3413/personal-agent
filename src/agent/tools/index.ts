import type Anthropic from "@anthropic-ai/sdk";
import { searchNotionTool, getNotionPageTool } from "./search-notion";
import { writeNotionPageTool, appendNotionPageTool } from "./write-notion-page";
import { createLinearIssueTool, updateLinearIssueTool, getLinearIssueTool, listLinearIssuesTool, addLinearCommentTool, listLinearProjectsTool, listLinearLabelsTool, listLinearWorkflowStatesTool, createLinearProjectTool, createLinearMilestoneTool } from "./linear";
import { addKnowledgeIndexItemTool, updateKnowledgeIndexItemTool } from "./notion-index";
import { webSearchTool, readUrlTool } from "./web-search";
import { addTodoItemTool, listTodoItemsTool, updateTodoItemTool } from "./notion-todo";
import { listCalendarEventsTool, createCalendarEventTool, updateCalendarEventTool, deleteCalendarEventTool } from "./google-calendar";
import { listEmailsTool, getEmailTool, sendEmailTool } from "./gmail";

export type ToolContext = Record<string, never>;

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_notion",
    description:
      "Search the Notion workspace for internal documentation, processes, or knowledge. Use this to answer questions about the company, product, or team.",
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
      "Create a new page in the knowledge base. Use this when the user explicitly asks to save, document, or add something to the knowledge base.",
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
        milestone: { type: "string", description: "Milestone name within the project (optional, requires project)" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_linear_issue",
    description: "Update an existing Linear issue. Use to change title, description, priority, state, project, or milestone.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Linear issue ID" },
        title: { type: "string", description: "New title (optional)" },
        description: { type: "string", description: "New description in markdown (optional)" },
        priority: { type: "number", description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low (optional)" },
        state: { type: "string", description: "State name e.g. 'In Progress', 'Done', 'Backlog' (optional)" },
        project: { type: "string", description: "Project name or ID to move the issue to (optional)" },
        milestone: { type: "string", description: "Milestone name within the project (optional)" },
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
    name: "create_linear_project",
    description: "Create a new Linear project. Only call when the user explicitly asks to create a project.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description (optional)" },
        target_date: { type: "string", description: "Target completion date in YYYY-MM-DD format (optional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_linear_milestone",
    description: "Create a milestone within an existing Linear project.",
    input_schema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project name or ID" },
        name: { type: "string", description: "Milestone name" },
        description: { type: "string", description: "Milestone description (optional)" },
        target_date: { type: "string", description: "Target date in YYYY-MM-DD format (optional)" },
      },
      required: ["project", "name"],
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
    name: "add_todo_item",
    description: "Add a new item to the user's personal TODO list in Notion. Use when the user asks to add a task, reminder, or todo item.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Task name" },
        category: { type: "string", description: "Category (e.g. Work, Personal, Health)" },
        notes: { type: "string", description: "Additional notes" },
        priority: { type: "string", description: "Priority level (e.g. High, Medium, Low)" },
        blockers: { type: "string", description: "Any blockers for this task" },
        status: { type: "string", description: "Status (e.g. Not started, In progress, Done)" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_todo_items",
    description: "List items from the user's personal TODO list in Notion. Use when the user asks to see their tasks or todos.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status (optional)" },
        priority: { type: "string", description: "Filter by priority (optional)" },
      },
      required: [],
    },
  },
  {
    name: "update_todo_item",
    description: "Update an existing TODO item in Notion. Use when the user asks to change status, priority, notes, or any other field on an existing task. Requires the page_id from list_todo_items.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "Notion page ID of the todo item" },
        name: { type: "string", description: "New task name (optional)" },
        category: { type: "string", description: "Category (optional)" },
        notes: { type: "string", description: "Notes (optional)" },
        priority: { type: "string", description: "Priority (optional)" },
        blockers: { type: "string", description: "Blockers (optional)" },
        status: { type: "string", description: "Status (optional)" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
      },
      required: ["page_id"],
    },
  },
  {
    name: "list_calendar_events",
    description: "List upcoming events from Google Calendar. Use when the user asks what's on their schedule, calendar, or agenda.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look (default 7)" },
        max_results: { type: "number", description: "Max events to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a new Google Calendar event. Can add attendees (sends invites) and create Google Meet links. Use ISO 8601 format for start/end (e.g. 2026-03-17T14:00:00).",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start time in ISO 8601 format" },
        end: { type: "string", description: "End time in ISO 8601 format" },
        description: { type: "string", description: "Event description (optional)" },
        location: { type: "string", description: "Location (optional)" },
        attendees: { type: "array", items: { type: "string" }, description: "List of attendee email addresses (optional)" },
        add_google_meet: { type: "boolean", description: "Whether to add a Google Meet link (optional)" },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Update an existing Google Calendar event. Requires event_id from list_calendar_events.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Google Calendar event ID" },
        title: { type: "string", description: "New title (optional)" },
        start: { type: "string", description: "New start time in ISO 8601 format (optional)" },
        end: { type: "string", description: "New end time in ISO 8601 format (optional)" },
        description: { type: "string", description: "New description (optional)" },
        location: { type: "string", description: "New location (optional)" },
        attendees: { type: "array", items: { type: "string" }, description: "Updated attendee list (optional)" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete a Google Calendar event. Requires event_id from list_calendar_events.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Google Calendar event ID" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "list_emails",
    description: "List recent emails from Gmail. Use when the user asks to check their email, inbox, or unread messages.",
    input_schema: {
      type: "object" as const,
      properties: {
        max_results: { type: "number", description: "Max emails to return (default 10)" },
        query: { type: "string", description: "Gmail search query (optional, e.g. 'from:john@example.com')" },
        unread_only: { type: "boolean", description: "Only return unread emails (optional)" },
      },
      required: [],
    },
  },
  {
    name: "get_email",
    description: "Read the full content of a specific email. Use after list_emails to read a specific message.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_id: { type: "string", description: "Gmail message ID from list_emails" },
      },
      required: ["email_id"],
    },
  },
  {
    name: "send_email",
    description: "Send an email via Gmail. IMPORTANT: Always show the full draft to the user and wait for explicit confirmation before calling this tool.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (plain text)" },
        cc: { type: "string", description: "CC email address (optional)" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

export function createToolExecutors(
  _ctx: ToolContext
): Record<string, (input: unknown) => Promise<string>> {
  return {
    search_notion: (input) => searchNotionTool(input as { query: string }),
    get_notion_page: (input) => getNotionPageTool(input as { page_id: string }),
    write_notion_page: (input) => writeNotionPageTool(input as { title: string; content: string; area?: string }),
    append_notion_page: (input) => appendNotionPageTool(input as { page_id: string; content: string }),
    add_knowledge_index_item: (input) =>
      addKnowledgeIndexItemTool(input as { title: string; summary: string; area: string; tags: string[]; page_id: string }),
    update_knowledge_index_item: (input) =>
      updateKnowledgeIndexItemTool(input as { page_id: string; summary?: string; tags?: string[]; area?: string }),
    create_linear_issue: (input) =>
      createLinearIssueTool(input as { title: string; description: string; priority?: number; project?: string; milestone?: string }),
    update_linear_issue: (input) =>
      updateLinearIssueTool(input as { id: string; title?: string; description?: string; priority?: number; state?: string; project?: string; milestone?: string }),
    get_linear_issue: (input) => getLinearIssueTool(input as { id: string }),
    list_linear_issues: (input) =>
      listLinearIssuesTool(input as { query?: string; state?: string; assignee?: string; limit?: number }),
    add_linear_comment: (input) => addLinearCommentTool(input as { issue_id: string; body: string }),
    create_linear_project: (input) => createLinearProjectTool(input as { name: string; description?: string; target_date?: string }),
    create_linear_milestone: (input) => createLinearMilestoneTool(input as { project: string; name: string; description?: string; target_date?: string }),
    list_linear_projects: () => listLinearProjectsTool(),
    list_linear_labels: () => listLinearLabelsTool(),
    list_linear_workflow_states: () => listLinearWorkflowStatesTool(),
    read_url: (input) => readUrlTool(input as { url: string }),
    web_search: (input) => webSearchTool(input as { query: string; num_results?: number }),
    add_todo_item: (input) => addTodoItemTool(input as { name: string; category?: string; notes?: string; priority?: string; blockers?: string; status?: string; due_date?: string }),
    list_todo_items: (input) => listTodoItemsTool(input as { status?: string; priority?: string }),
    update_todo_item: (input) => updateTodoItemTool(input as { page_id: string; name?: string; category?: string; notes?: string; priority?: string; blockers?: string; status?: string; due_date?: string }),
    list_calendar_events: (input) => listCalendarEventsTool(input as { days_ahead?: number; max_results?: number }),
    create_calendar_event: (input) => createCalendarEventTool(input as { title: string; start: string; end: string; description?: string; location?: string; attendees?: string[]; add_google_meet?: boolean }),
    update_calendar_event: (input) => updateCalendarEventTool(input as { event_id: string; title?: string; start?: string; end?: string; description?: string; location?: string; attendees?: string[] }),
    delete_calendar_event: (input) => deleteCalendarEventTool(input as { event_id: string }),
    list_emails: (input) => listEmailsTool(input as { max_results?: number; query?: string; unread_only?: boolean }),
    get_email: (input) => getEmailTool(input as { email_id: string }),
    send_email: (input) => sendEmailTool(input as { to: string; subject: string; body: string; cc?: string }),
  };
}
