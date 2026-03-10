import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

export const chudMessageCallback = async ({ event, client }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  // post placeholder immediately so the user sees a response right away
  const placeholder = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: "...",
  });

  const response = await runAgent({
    text: event.text,
    slackClient: client,
    channel: event.channel,
    threadTs,
  });

  // update placeholder with the real response
  await client.chat.update({
    channel: event.channel,
    ts: placeholder.ts!,
    text: response,
  });
};