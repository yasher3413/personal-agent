import { Client } from "@notionhq/client";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

function str(prop: unknown): string {
  if (!prop || typeof prop !== "object") return "";
  const p = prop as Record<string, unknown>;
  if (p.type === "title" && Array.isArray(p.title))
    return (p.title as Array<{ plain_text: string }>).map((t) => t.plain_text).join("") || "";
  if (p.type === "rich_text" && Array.isArray(p.rich_text))
    return (p.rich_text as Array<{ plain_text: string }>).map((t) => t.plain_text).join("") || "";
  if (p.type === "select" && p.select && typeof p.select === "object")
    return (p.select as { name: string }).name || "";
  if (p.type === "multi_select" && Array.isArray(p.multi_select))
    return (p.multi_select as Array<{ name: string }>).map((t) => t.name).join(", ") || "";
  if (p.type === "date" && p.date && typeof p.date === "object")
    return ((p.date as { start: string }).start || "").slice(0, 10);
  return "";
}

export type KnowledgeIndexRow = {
  title: string;
  summary: string;
  area: string;
  tags: string;
  pageId: string;
  lastUpdated: string;
};

export async function getKnowledgeIndex(): Promise<KnowledgeIndexRow[]> {
  const notion = getNotionClient();
  const dbId = process.env.NOTION_INDEX_DATABASE_ID;
  if (!notion || !dbId) return [];

  try {
    const res = await notion.databases.query({ database_id: dbId, page_size: 100 });
    return res.results
      .filter((p) => p.object === "page")
      .map((p) => {
        const props = (p as { properties: Record<string, unknown> }).properties;
        return {
          title: str(props["Title"] ?? props["Name"]),
          summary: str(props["Summary"]),
          area: str(props["Area"]),
          tags: str(props["Tags"]),
          pageId: str(props["Page ID"]),
          lastUpdated: str(props["Last Updated"]),
        };
      })
      .filter((r) => r.title);
  } catch {
    return [];
  }
}

export async function getKnowledgeContext(): Promise<string> {
  const rows = await getKnowledgeIndex();
  if (!rows.length) return "";

  const header = "| Area | Title | Summary | Tags | Page ID | Last Updated |\n|------|-------|---------|------|---------|--------------|";
  const body = rows
    .map(
      (r) =>
        `| ${r.area} | ${r.title} | ${r.summary} | ${r.tags} | ${r.pageId} | ${r.lastUpdated} |`
    )
    .join("\n");

  return `## Knowledge Base Index\n\n${header}\n${body}`;
}
