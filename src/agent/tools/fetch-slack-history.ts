import type { WebClient } from "@slack/web-api";

type Input = {
  channel_id: string;
  thread_ts?: string;
  limit?: number;
  cursor?: string;
};

export async function fetchSlackHistory(
  input: Input,
  slackClient: WebClient
): Promise<string> {
  const { channel_id, thread_ts, limit = 20, cursor } = input;

  if (thread_ts) {
    const res = await slackClient.conversations.replies({
      channel: channel_id,
      ts: thread_ts,
      limit,
      cursor,
    });
    return JSON.stringify({
      messages: res.messages ?? [],
      has_more: res.has_more ?? false,
      next_cursor: res.response_metadata?.next_cursor ?? null,
    });
  }

  const res = await slackClient.conversations.history({
    channel: channel_id,
    limit,
    cursor,
    inclusive: true,
  });
  return JSON.stringify({
    messages: res.messages ?? [],
    has_more: res.has_more ?? false,
    next_cursor: res.response_metadata?.next_cursor ?? null,
  });
}
