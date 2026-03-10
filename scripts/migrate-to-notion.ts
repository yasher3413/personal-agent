import { Client } from "@notionhq/client";
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";

const KNOWLEDGE_DIR = join(import.meta.dir, "../knowledge");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// You need to create a parent page in Notion and paste its ID here.
// Open the page in Notion, click "Share" → "Copy link", and extract the ID
// from the URL: notion.so/workspace/PAGE-TITLE-<THIS_IS_THE_ID>
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

if (!process.env.NOTION_API_KEY) {
  console.error("NOTION_API_KEY not set");
  process.exit(1);
}
if (!PARENT_PAGE_ID) {
  console.error("NOTION_PARENT_PAGE_ID not set — create a parent page in Notion and set this env var to its page ID");
  process.exit(1);
}

function mdToNotionBlocks(content: string) {
  const lines = content.split("\n");
  const blocks: object[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2).trim() } }] } });
    } else if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3).trim() } }] } });
    } else if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4).trim() } }] } });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2).trim() } }] } });
    } else if (/^\d+\. /.test(line)) {
      blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: [{ type: "text", text: { content: line.replace(/^\d+\. /, "").trim() } }] } });
    } else if (line.trim() === "") {
      // skip blank lines
    } else {
      // Truncate lines that exceed Notion's 2000 char limit per rich_text
      const text = line.slice(0, 2000);
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text } }] } });
    }
  }

  return blocks;
}

async function createNotionPage(title: string, content: string) {
  const blocks = mdToNotionBlocks(content);

  // Notion API limits: 100 blocks per request
  const CHUNK_SIZE = 100;
  const firstChunk = blocks.slice(0, CHUNK_SIZE);
  const remaining = blocks.slice(CHUNK_SIZE);

  const page = await notion.pages.create({
    parent: { type: "page_id", page_id: PARENT_PAGE_ID! },
    properties: {
      title: { title: [{ type: "text", text: { content: title } }] },
    },
    // @ts-expect-error blocks type
    children: firstChunk,
  });

  // Append remaining blocks in chunks
  for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
    await notion.blocks.children.append({
      block_id: page.id,
      // @ts-expect-error blocks type
      children: remaining.slice(i, i + CHUNK_SIZE),
    });
  }

  return page.id;
}

async function main() {
  const files = (await readdir(KNOWLEDGE_DIR))
    .filter((f) => f.endsWith(".md"));

  console.log(`Migrating ${files.length} files to Notion...`);

  for (const file of files) {
    const title = basename(file, ".md").replace(/_/g, " ");
    const content = await readFile(join(KNOWLEDGE_DIR, file), "utf-8");

    try {
      const id = await createNotionPage(title, content);
      console.log(`✓ ${file} → ${id}`);
    } catch (err) {
      console.error(`✗ ${file}: ${err}`);
    }
  }

  console.log("Done.");
}

main();
