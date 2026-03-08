import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { handleChudRequest } from "@/agent/agent";

export const chudMessageCallback = async ({
  event,
  client,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  try {
    const text = event.text ?? "";

    if (!text) {
      return;
    }

    let threadText: string | null = null;

    // If the mention happened inside a thread, fetch that whole thread
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
      slackClient: client,
      actionToken: (event as any).action_token,
    });

    // Always reply in-thread:
    // - if already in a thread, stay there
    // - if top-level, create/use a thread rooted on the current message
    const replyThreadTs = event.thread_ts ?? event.ts;

    await client.chat.postMessage({
      channel: event.channel,
      text: response,
      thread_ts: replyThreadTs,
    });
  } catch (error) {
    logger.error(error);
  }
};