import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import TelegramBot from "node-telegram-bot-api";
import { runAgent } from "@/agent/agent";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token);

export async function POST(req: NextRequest) {
  const update = await req.json();

  const message = update?.message;
  if (!message?.text) return new NextResponse("ok", { status: 200 });

  const chatId = message.chat.id;
  const text: string = message.text;
  const userId = String(message.from?.id ?? chatId);

  waitUntil(
    (async () => {
      try {
        let response = "";
        const onChunk = (delta: string) => { response += delta; };

        await runAgent({ text, userId, onChunk });

        if (!response) return;

        // Telegram max message length is 4096 chars
        const chunks = response.match(/[\s\S]{1,4096}/g) ?? [];
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
        }
      } catch (err) {
        console.error("Telegram handler error:", err);
        await bot.sendMessage(chatId, "Something went wrong. Please try again.");
      }
    })()
  );

  return new NextResponse("ok", { status: 200 });
}
