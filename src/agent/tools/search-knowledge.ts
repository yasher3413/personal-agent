import { searchKnowledge } from "../../knowledge/search";

type Input = { query: string };

export async function searchKnowledgeTool(input: Input): Promise<string> {
  const hit = searchKnowledge(input.query);
  if (!hit) return JSON.stringify({ found: false });
  return JSON.stringify({ found: true, file: hit.file, content: hit.content });
}
