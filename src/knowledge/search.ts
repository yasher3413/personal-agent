import fs from "fs";
import path from "path";

export type KnowledgeHit = {
  file: string;
  score: number;
  content: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// common low-signal words we should ignore
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "am",
  "what",
  "how",
  "why",
  "when",
  "where",
  "who",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "i",
  "we",
  "you",
  "it",
  "this",
  "that",
  "about",
  "explain",
  "tell",
  "me",
  "or",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<@[^>]+>/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));
}

function scoreContent(query: string, content: string): number {
  const queryWords = tokenize(query);
  const contentLower = content.toLowerCase();

  if (queryWords.length === 0) {
    return 0;
  }

  let score = 0;

  for (const word of queryWords) {
    if (contentLower.includes(word)) {
      score += 2;
    }
  }

  const cleanedFullQuery = queryWords.join(" ");
  if (cleanedFullQuery && contentLower.includes(cleanedFullQuery)) {
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

  // require a meaningful match before treating it as KB-backed
  if (!bestHit || bestHit.score < 2) {
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