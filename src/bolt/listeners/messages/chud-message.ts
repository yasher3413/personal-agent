import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { handleChudRequest } from "@/agent/agent";

export const chudMessageCallback = async ({
  event,
  say,
  logger
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"message">) => {
  try {
    const text = "text" in event ? event.text ?? "" : "";
    const response = await handleChudRequest(text);
    await say(response);
  } catch (error) {
    logger.error(error);
  }
};