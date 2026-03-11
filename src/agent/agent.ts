import type { WebClient } from "@slack/web-api";
import { createClaudeMemoryTool } from "@supermemory/tools/claude-memory";
import { runAgentLoop } from "./claude";
import { toolDefinitions, createToolExecutors } from "./tools";
import { getKnowledgeContext } from "../knowledge/notion-index";
import { logger } from "../lib/logger";
import { checkRateLimit } from "../lib/rate-limit";
import { validateInput } from "../lib/validate";

const BASE_SYSTEM_PROMPT = `\
You are Chud, an internal AI assistant for Internet Backyard — the company behind gnomos, a financial OS.

Use tools to gather context before responding. Be concise.
Respond in plain Slack-friendly text (bullets, no markdown headers).
Only call create_linear_issue if the user explicitly asks to create or file an issue. Use update_linear_issue, get_linear_issue, and list_linear_issues freely when asked about issues.
Only call write_notion_page if the user explicitly asks to save, document, or add something to the knowledge base.
When asked to save a thread or conversation to the knowledge base, first call fetch_slack_history with the current thread_ts to read the messages, then summarize them into a concise knowledge base article and call write_notion_page with that summary.

Knowledge Base Index rules:
- The index table below lists all KB pages. Before searching Notion, check if a matching page is already in the index and use its Page ID directly with get_notion_page.
- After every write_notion_page call, immediately call add_knowledge_index_item to register the new page in the index.
- After every append_notion_page call, call update_knowledge_index_item to refresh the index entry.
- Never create a duplicate KB page — if the index already has an entry for the topic, use append_notion_page instead.
- If search_notion returns no results and the topic is not in the index, acknowledge the gap and offer to create a new KB entry.

You have persistent memory across conversations. Memory takes precedence over the team directory and knowledge base for personal preferences, roles, and facts about specific people — if memory has the answer, use it directly without calling other tools. When storing new memories, always update the existing file (str_replace or view then str_replace) rather than creating a new one — keep everything in a single /memories/context.md file. The current contents of your memory are injected below.`;

function getMemoryTool(userId?: string) {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) return undefined;
  return createClaudeMemoryTool(key, userId ? { memoryContainerTag: userId } : undefined);
}

async function loadMemoryContext(userId: string): Promise<string> {
  const key = process.env.SUPERMEMORY_API_KEY;
  if (!key) return "";
  const tool = createClaudeMemoryTool(key, { memoryContainerTag: userId });
  const sections: string[] = [];

  // Try known paths first (Claude consistently uses these names)
  const knownPaths = ["/memories/context.md", "/memories/user_preferences.md", "/memories/team.md"];
  for (const path of knownPaths) {
    try {
      const result = await tool.handleCommand({ command: "view", path });
      if (result.success && result.content?.trim()) {
        sections.push(result.content.trim());
      }
    } catch {}
  }

  // Then scan directory for any other files
  try {
    const dir = await tool.handleCommand({ command: "view", path: "/memories/" });
    if (dir.success && dir.content?.trim()) {
      const extraFiles = dir.content
        .split("\n")
        .map((l) => l.trim().replace(/^-\s*/, ""))
        .filter((l) => l && !l.startsWith("#") && l.includes(".") && !knownPaths.includes(`/memories/${l}`));
      for (const file of extraFiles.slice(0, 10)) {
        const path = file.startsWith("/") ? file : `/memories/${file}`;
        try {
          const result = await tool.handleCommand({ command: "view", path });
          if (result.success && result.content?.trim()) {
            sections.push(result.content.trim());
          }
        } catch {}
      }
    }
  } catch {}

  if (!sections.length) {
    logger.info("memory.empty", { userId });
    return "";
  }
  const ctx = `## Memory\n\n${sections.join("\n\n---\n\n")}`;
  logger.info("memory.loaded", { userId, chars: ctx.length });
  return ctx;
}

type RunAgentParams = {
  text: string;
  slackContext?: string;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  userId?: string;
  onChunk?: (text: string) => Promise<void>;
  onToolCall?: (toolName: string) => Promise<void>;
};

export async function runAgent({
  text,
  slackContext,
  slackClient,
  channel,
  threadTs,
  userId,
  onChunk,
  onToolCall,
}: RunAgentParams): Promise<string> {
  // Rate limit
  if (userId) {
    const { allowed, remaining } = checkRateLimit(userId);
    if (!allowed) {
      logger.warn("rate_limit.exceeded", { userId, channel });
      return "You're sending messages too quickly. Please wait a moment before trying again.";
    }
    if (remaining <= 2) {
      logger.warn("rate_limit.warning", { userId, remaining });
    }
  }

  // Validate input
  const mention = text.replace(/<@[^>]+>/g, "").trim();
  const validation = validateInput(mention);
  if (!validation.ok) {
    logger.warn("input.rejected", { userId, channel, reason: validation.reason });
    return `I couldn't process that message: ${validation.reason}.`;
  }

  logger.info("agent.start", { userId, channel, threadTs, inputLength: mention.length });

  const ctx = { slackClient };
  const userContext = userId ? `[user: ${userId}, channel: ${channel}, thread_ts: ${threadTs}]` : `[channel: ${channel}, thread_ts: ${threadTs}]`;
  const userMessage = slackContext
    ? `${userContext}\n\n${slackContext}\n\n## User's message\n\n${validation.text}`
    : `${userContext}\n\n${validation.text}`;

  const [kbContext, memoryContext] = await Promise.all([
    getKnowledgeContext(),
    userId ? loadMemoryContext(userId) : Promise.resolve(""),
  ]);

  const system = [
    { type: "text" as const, text: BASE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
    ...(kbContext ? [{ type: "text" as const, text: kbContext }] : []),
    ...(memoryContext ? [{ type: "text" as const, text: memoryContext }] : []),
  ];

  const start = Date.now();
  try {
    const result = await runAgentLoop({
      system,
      toolDefinitions,
      toolExecutors: createToolExecutors(ctx),
      userMessage,
      memoryTool: getMemoryTool(userId),
      onChunk,
      onToolCall,
    });
    logger.info("agent.done", { userId, channel, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    logger.error("agent.error", { userId, channel, error: String(err) });
    throw err;
  }
}
