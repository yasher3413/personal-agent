import Exa from "exa-js";

export async function webSearchTool(input: {
  query: string;
  num_results?: number;
}): Promise<string> {
  try {
    const exa = new Exa();
    const res = await exa.search(input.query, {
      numResults: input.num_results ?? 5,
      type: "auto",
      contents: {
        highlights: { numSentences: 3, highlightsPerUrl: 2 },
      },
    });

    const results = res.results.map((r) => ({
      title: r.title,
      url: r.url,
      published: r.publishedDate ?? null,
      highlights: (r as { highlights?: string[] }).highlights ?? [],
    }));

    return JSON.stringify({ results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function readUrlTool(input: { url: string }): Promise<string> {
  try {
    const exa = new Exa();
    const res = await exa.getContents([input.url], {
      text: { maxCharacters: 5000 },
    });

    const page = res.results[0];
    if (!page) return JSON.stringify({ error: "No content found for URL" });

    return JSON.stringify({
      title: page.title,
      url: page.url,
      text: (page as { text?: string }).text ?? null,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
