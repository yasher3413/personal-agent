import { Client } from "@notionhq/client";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

function mdToNotionBlocks(content: string) {
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

export async function writeNotionPageTool(input: { title: string; content: string }): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });
  if (!PARENT_PAGE_ID) return JSON.stringify({ error: "NOTION_PARENT_PAGE_ID not set" });

  try {
    const blocks = mdToNotionBlocks(input.content);
    const CHUNK_SIZE = 100;

    const page = await notion.pages.create({
      parent: { type: "page_id", page_id: PARENT_PAGE_ID },
      properties: {
        title: { title: [{ type: "text", text: { content: input.title } }] },
      },
      // @ts-expect-error blocks type
      children: blocks.slice(0, CHUNK_SIZE),
    });

    for (let i = CHUNK_SIZE; i < blocks.length; i += CHUNK_SIZE) {
      await notion.blocks.children.append({
        block_id: page.id,
        // @ts-expect-error blocks type
        children: blocks.slice(i, i + CHUNK_SIZE),
      });
    }

    return JSON.stringify({ success: true, page_id: page.id, title: input.title });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
