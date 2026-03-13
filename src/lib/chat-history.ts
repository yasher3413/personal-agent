import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const MAX_MESSAGES = 20;
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type Message = { role: "user" | "assistant"; content: string };

export async function getChatHistory(chatId: string): Promise<Message[]> {
  try {
    const history = await redis.get<Message[]>(`chat:${chatId}`);
    return history ?? [];
  } catch {
    return [];
  }
}

export async function appendChatHistory(
  chatId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  try {
    const history = await getChatHistory(chatId);
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: assistantMessage });
    const trimmed = history.slice(-MAX_MESSAGES);
    await redis.set(`chat:${chatId}`, trimmed, { ex: TTL_SECONDS });
  } catch {}
}

export function formatHistoryAsContext(history: Message[]): string {
  if (!history.length) return "";
  const lines = history.map((m) => `${m.role === "user" ? "User" : "Gork"}: ${m.content}`);
  return `## Conversation History\n\n${lines.join("\n")}`;
}
