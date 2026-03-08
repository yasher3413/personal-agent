import fs from "fs";
import path from "path";

const KNOWLEDGE_INBOX_DIR = path.join(process.cwd(), "knowledge", "inbox");

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function extractTitle(markdown: string): string {
  const firstLine = markdown.split("\n")[0]?.trim() ?? "";
  const title = firstLine.replace(/^#\s*/, "").trim();
  return title || "untitled-note";
}

export function saveKnowledgeNote(markdown: string): { filename: string; path: string } {
  if (!fs.existsSync(KNOWLEDGE_INBOX_DIR)) {
    fs.mkdirSync(KNOWLEDGE_INBOX_DIR, { recursive: true });
  }

  const title = extractTitle(markdown);
  const slug = slugify(title);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${slug}.md`;
  const fullPath = path.join(KNOWLEDGE_INBOX_DIR, filename);

  fs.writeFileSync(fullPath, markdown, "utf8");

  return {
    filename,
    path: fullPath,
  };
}