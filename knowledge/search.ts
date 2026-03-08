import fs from "fs";
import path from "path";

export type KnowledgeHit = {
  file: string;
  score: number;
  content: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

function scoreContent(query: string, content: string): number {
  const q = query.toLowerCase();
  const c = content.toLowerCase();

  let score = 0;

  const queryWords = q.split(/\s+/).filter(Boolean);

  for (const word of queryWords) {
    if (c.includes(word)) {
      score += 1;
    }
  }

  if (c.includes(q)) {
    score += 5;
  }

  return score;
}

export function searchKnowledge(query: string): KnowledgeHit | null {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return null;
  }

  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((file) => file.endsWith(".md"));

  let bestHit: KnowledgeHit | null = null;

  for (const file of files) {
    const fullPath = path.join(KNOWLEDGE_DIR, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const score = scoreContent(query, content);

    if (!bestHit || score > bestHit.score) {
      bestHit = {
        file,
        score,
        content,
      };
    }
  }

  if (!bestHit || bestHit.score === 0) {
    return null;
  }

  return bestHit;
}

export function formatKnowledgeAnswer(hit: KnowledgeHit): string {
  const preview = hit.content.trim().slice(0, 700);

  return [
    `*from knowledge base: \`${hit.file}\`*`,
    "",
    preview,
  ].join("\n");
}