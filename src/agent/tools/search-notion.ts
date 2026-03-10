import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

function getNotionClient(): Client | null {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) return null;
  return new Client({ auth });
}

function extractPlainText(block: BlockObjectResponse | PartialBlockObjectResponse): string {
  if (!("type" in block)) return "";
  const b = block as BlockObjectResponse;
  const type = b.type as string;
  // @ts-expect-error dynamic block types
  const richText = b[type]?.rich_text;
  if (!Array.isArray(richText)) return "";
  return richText.map((t: { plain_text: string }) => t.plain_text).join("");
}

async function getPageContent(notion: Client, pageId: string): Promise<string> {
  const blocks = await notion.blocks.children.list({ block_id: pageId, page_size: 50 });
  return blocks.results
    .map(extractPlainText)
    .filter(Boolean)
    .join("\n");
}

export async function searchNotionTool(input: { query: string }): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  try {
    const res = await notion.search({
      query: input.query,
      filter: { value: "page", property: "object" },
      page_size: 5,
    });

    if (!res.results.length) return JSON.stringify({ found: false });

    const pages = await Promise.all(
      res.results.map(async (page) => {
        if (page.object !== "page") return null;
        // @ts-expect-error dynamic title property
        const titleProp = page.properties?.title ?? page.properties?.Name;
        const title =
          Array.isArray(titleProp?.title)
            ? titleProp.title.map((t: { plain_text: string }) => t.plain_text).join("")
            : page.id;

        const content = await getPageContent(notion, page.id);
        return { page_id: page.id, title, content };
      })
    );

    const results = pages.filter(Boolean);
    return JSON.stringify({ found: true, results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function getNotionPageTool(input: { page_id: string }): Promise<string> {
  const notion = getNotionClient();
  if (!notion) return JSON.stringify({ error: "NOTION_API_KEY not set" });

  try {
    const [page, content] = await Promise.all([
      notion.pages.retrieve({ page_id: input.page_id }),
      getPageContent(notion, input.page_id),
    ]);

    // @ts-expect-error dynamic title property
    const titleProp = page.properties?.title ?? page.properties?.Name;
    const title =
      Array.isArray(titleProp?.title)
        ? titleProp.title.map((t: { plain_text: string }) => t.plain_text).join("")
        : input.page_id;

    return JSON.stringify({ page_id: page.id, title, content });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
