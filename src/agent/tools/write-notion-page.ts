import { Client } from "@notionhq/client";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

function getParentId(area?: string): string | null {
  if (area) {
    try {
      const areaMap = JSON.parse(process.env.NOTION_AREA_PAGE_IDS ?? "{}");
      if (areaMap[area]) return areaMap[area];
    } catch {}
  }
  return process.env.NOTION_PARENT_PAGE_ID ?? null;
}

export function mdToNotionBlocks(content: string) {
  const blocks: object[] = [];
  for (const line of content.split("\n")) {
    if (line.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2).trim().slice(0, 2000) } }] } });
    } else if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3).trim().slice(0, 2000) } }] } });
    } else if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4).trim().slice(0, 2000) } }] } });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2).trim().slice(0, 2000) } }] } });
    } else if (/^\d+\. /.test(line)) {
      blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^\d+\. /, "").trim().slice(0, 2000) } }] } });
    } else if (line.trim()) {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 2000) } }] } });
    }
  }
  return blocks;
}

async function appendBlocks(notion: Client, pageId: string, blocks: object[]) {
  const CHUNK_SIZE = 100;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    await notion.blocks.children.append({
      block_id: pageId,
      // @ts-expect-error blocks type
      children: blocks.slice(i, i + CHUNK_SIZE),
    });
  }
}

export async function writeNotionPageTool(input: {
  title: string;
  content: string;
  area?: string;
}): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });
  const parentId = getParentId(input.area);
  if (!parentId) return JSON.stringify({ error: "NOTION_PARENT_PAGE_ID not set" });

  try {
    const blocks = mdToNotionBlocks(input.content);
    const page = await notion.pages.create({
      parent: { type: "page_id", page_id: parentId },
      properties: {
        title: { title: [{ type: "text", text: { content: input.title } }] },
      },
      // @ts-expect-error blocks type
      children: blocks.slice(0, 100),
    });
    await appendBlocks(notion, page.id, blocks.slice(100));
    return JSON.stringify({ success: true, page_id: page.id, title: input.title });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function appendNotionPageTool(input: {
  page_id: string;
  content: string;
}): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  try {
    const blocks = mdToNotionBlocks(input.content);
    await appendBlocks(notion, input.page_id, blocks);
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
