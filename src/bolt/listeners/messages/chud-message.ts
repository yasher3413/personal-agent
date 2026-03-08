import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { handleChudRequest } from "@/agent/agent";

export const chudMessageCallback = async ({
  event,
  say,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">) => {
  try {
    const text = event.text ?? "";

    if (!text) {
      return;
    }

    const response = await handleChudRequest(text);
    await say(response);
  } catch (error) {
    logger.error(error);
  }
};