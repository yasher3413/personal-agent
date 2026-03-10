import Exa from "exa-js";

export async function webSearchTool(input: {
  query: string;
  num_results?: number;
}): Promise<string> {
  try {
    const exa = new Exa();
    const res = await exa.searchAndContents(input.query, {
      numResults: input.num_results ?? 5,
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
      type: "auto",
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
