import { Client } from "@notionhq/client";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

export async function addTodoItemTool(input: {
  name: string;
  category?: string;
  notes?: string;
  priority?: string;
  blockers?: string;
  status?: string;
  due_date?: string;
}): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  const dbId = process.env.NOTION_TODO_DATABASE_ID;
  if (!dbId) return JSON.stringify({ error: "NOTION_TODO_DATABASE_ID not set" });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      Name: { title: [{ type: "text", text: { content: input.name } }] },
    };

    if (input.category) properties["Category"] = { rich_text: [{ type: "text", text: { content: input.category } }] };
    if (input.notes) properties["Notes"] = { rich_text: [{ type: "text", text: { content: input.notes } }] };
    if (input.priority) properties["Priority"] = { select: { name: input.priority } };
    if (input.blockers) properties["Blockers"] = { rich_text: [{ type: "text", text: { content: input.blockers } }] };
    if (input.status) properties["Status"] = { select: { name: input.status } };
    if (input.due_date) properties["Due date"] = { date: { start: input.due_date } };

    const page = await notion.pages.create({
      parent: { type: "database_id", database_id: dbId },
      properties,
    });

    return JSON.stringify({ success: true, page_id: page.id, name: input.name });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listTodoItemsTool(input: {
  status?: string;
  priority?: string;
}): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  const dbId = process.env.NOTION_TODO_DATABASE_ID;
  if (!dbId) return JSON.stringify({ error: "NOTION_TODO_DATABASE_ID not set" });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];
    if (input.status) filters.push({ property: "Status", select: { equals: input.status } });
    if (input.priority) filters.push({ property: "Priority", select: { equals: input.priority } });

    const res = await notion.databases.query({
      database_id: dbId,
      ...(filters.length ? { filter: filters.length === 1 ? filters[0] : { and: filters } } : {}),
      page_size: 20,
    });

    const items = res.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.text?.content ?? "",
        category: props.Category?.rich_text?.[0]?.text?.content ?? null,
        priority: props.Priority?.select?.name ?? null,
        status: props.Status?.select?.name ?? null,
        due_date: props["Due date"]?.date?.start ?? null,
        blockers: props.Blockers?.rich_text?.[0]?.text?.content ?? null,
      };
    });

    return JSON.stringify({ items, total: items.length });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function updateTodoItemTool(input: {
  page_id: string;
  name?: string;
  category?: string;
  notes?: string;
  priority?: string;
  blockers?: string;
  status?: string;
  due_date?: string;
}): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};

    if (input.name) properties["Name"] = { title: [{ type: "text", text: { content: input.name } }] };
    if (input.category) properties["Category"] = { rich_text: [{ type: "text", text: { content: input.category } }] };
    if (input.notes) properties["Notes"] = { rich_text: [{ type: "text", text: { content: input.notes } }] };
    if (input.priority) properties["Priority"] = { select: { name: input.priority } };
    if (input.blockers) properties["Blockers"] = { rich_text: [{ type: "text", text: { content: input.blockers } }] };
    if (input.status) properties["Status"] = { select: { name: input.status } };
    if (input.due_date) properties["Due date"] = { date: { start: input.due_date } };

    await notion.pages.update({ page_id: input.page_id, properties });
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
