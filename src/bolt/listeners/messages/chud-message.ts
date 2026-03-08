import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { handleChudRequest } from "@/agent/agent";

export const chudMessageCallback = async ({
  event,
  say,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"message">) => {
  try {
    const text = "text" in event ? event.text ?? "" : "";

    // Ignore bot messages or empty events
    if (!text || ("subtype" in event && event.subtype)) {
      return;
    }

    const response = await handleChudRequest(text);
    await say(response);
  } catch (error) {
    logger.error(error);
  }
};