const BASE = "https://api.supermemory.ai";

function getApiKey(): string | null {
  return process.env.SUPERMEMORY_API_KEY ?? null;
}

export async function searchMemoryTool(input: { query: string; user_id?: string }): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return JSON.stringify({ error: "SUPERMEMORY_API_KEY not set" });

  try {
    const body: Record<string, unknown> = {
      q: input.query,
      limit: 5,
      searchMode: "hybrid",
      rerank: true,
    };
    if (input.user_id) body.containerTag = input.user_id;

    const res = await fetch(`${BASE}/v4/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return JSON.stringify({ error: data });

    const results = (data.results ?? []).map((r: { memory?: string; chunk?: string; similarity: number }) => ({
      content: r.memory ?? r.chunk,
      similarity: r.similarity,
    }));

    return JSON.stringify({ found: results.length > 0, results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function addMemoryTool(input: { content: string; user_id?: string }): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return JSON.stringify({ error: "SUPERMEMORY_API_KEY not set" });

  try {
    const body: Record<string, unknown> = { content: input.content };
    if (input.user_id) body.containerTag = input.user_id;

    const res = await fetch(`${BASE}/v3/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) return JSON.stringify({ error: data });

    return JSON.stringify({ success: true, id: data.id, status: data.status });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
