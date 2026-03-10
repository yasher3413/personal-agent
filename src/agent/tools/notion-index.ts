import { Client } from "@notionhq/client";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

const DB_ID = () => process.env.NOTION_INDEX_DATABASE_ID ?? null;

export async function addKnowledgeIndexItemTool(input: {
  title: string;
  summary: string;
  area: string;
  tags: string[];
  page_id: string;
}): Promise<string> {
  const notion = getNotionClient();
  const dbId = DB_ID();
  if (!notion || !dbId) return JSON.stringify({ error: "NOTION_INDEX_DATABASE_ID not set" });

  try {
    await notion.pages.create({
      parent: { type: "database_id", database_id: dbId },
      properties: {
        Title: { title: [{ type: "text", text: { content: input.title } }] },
        Summary: { rich_text: [{ type: "text", text: { content: input.summary } }] },
        Area: { select: { name: input.area } },
        Tags: { multi_select: input.tags.map((t) => ({ name: t })) },
        "Page ID": { rich_text: [{ type: "text", text: { content: input.page_id } }] },
        "Last Updated": { date: { start: new Date().toISOString().slice(0, 10) } },
      },
    });
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function updateKnowledgeIndexItemTool(input: {
  page_id: string;
  summary?: string;
  tags?: string[];
  area?: string;
}): Promise<string> {
  const notion = getNotionClient();
  const dbId = DB_ID();
  if (!notion || !dbId) return JSON.stringify({ error: "NOTION_INDEX_DATABASE_ID not set" });

  try {
    // Find the index row with this page_id
    const res = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "Page ID",
        rich_text: { equals: input.page_id },
      },
      page_size: 1,
    });

    if (!res.results.length) return JSON.stringify({ error: "Index row not found for page_id" });
    const rowId = res.results[0].id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: Record<string, any> = {
      "Last Updated": { date: { start: new Date().toISOString().slice(0, 10) } },
    };
    if (input.summary)
      props["Summary"] = { rich_text: [{ type: "text", text: { content: input.summary } }] };
    if (input.tags)
      props["Tags"] = { multi_select: input.tags.map((t) => ({ name: t })) };
    if (input.area)
      props["Area"] = { select: { name: input.area } };

    await notion.pages.update({ page_id: rowId, properties: props });
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
