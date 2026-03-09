import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

export const chudMessageCallback = async ({ event, client }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  const response = await runAgent({
    text: event.text,
    slackClient: client,
    channel: event.channel,
    threadTs,
  });

  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: response,
  });
};