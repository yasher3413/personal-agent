import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import { runAgent } from "../../../agent/agent";

type AppMentionArgs = SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs;

const STREAM_THROTTLE_MS = 750;

export const chudMessageCallback = async ({ event, client }: AppMentionArgs) => {
  const threadTs = event.thread_ts ?? event.ts;

  const placeholder = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: "...",
  });

  const messageTs = placeholder.ts!;
  let lastUpdateAt = 0;

  const onChunk = async (text: string) => {
    const now = Date.now();
    if (now - lastUpdateAt < STREAM_THROTTLE_MS) return;
    lastUpdateAt = now;
    await client.chat.update({
      channel: event.channel,
      ts: messageTs,
      text,
    });
  };

  const response = await runAgent({
    text: event.text,
    slackClient: client,
    channel: event.channel,
    threadTs,
    onChunk,
  });

  // final update with complete response (no throttle)
  await client.chat.update({
    channel: event.channel,
    ts: messageTs,
    text: response,
  });
};