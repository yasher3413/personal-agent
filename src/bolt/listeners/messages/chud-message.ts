import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { handleChudRequest } from "@/agent/agent";

export const chudMessageCallback = async ({
  event,
  client,
  say,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  try {
    const text = event.text ?? "";

    if (!text) {
      return;
    }

    let threadText: string | null = null;

    if (event.thread_ts) {
      const replies = await client.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
      });

      const messages = replies.messages ?? [];

      threadText = messages
        .map((message) => {
          const user = "user" in message && message.user ? message.user : "unknown";
          const msgText = "text" in message && message.text ? message.text : "";
          return `${user}: ${msgText}`;
        })
        .join("\n");
    }

    const response = await handleChudRequest({
      text,
      threadText,
    });

    await say(response);
  } catch (error) {
    logger.error(error);
  }
};