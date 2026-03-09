import { WebClient } from "@slack/web-api";

type FetchSlackHistoryInput = {
  slackClient: WebClient;
  channel: string;
  latest?: string;
  limit?: number;
  cursor?: string;
};

export async function fetchSlackHistory({
  slackClient,
  channel,
  latest,
  limit = 20,
  cursor,
}: FetchSlackHistoryInput) {
  const res = await slackClient.conversations.history({
    channel,
    latest,
    limit,
    cursor,
    inclusive: true,
  });

  return {
    messages: res.messages ?? [],
    has_more: res.has_more ?? false,
    next_cursor: res.response_metadata?.next_cursor ?? null,
  };
}