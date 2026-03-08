import type { WebClient } from "@slack/web-api";

type SearchSlackInput = {
  client: WebClient;
  query: string;
  actionToken?: string;
};

export async function searchSlackMessages({
  client,
  query,
  actionToken,
}: SearchSlackInput): Promise<string> {
  const cleanedQuery = query.replace(/<@[^>]+>/g, "").trim();

  if (!cleanedQuery) {
    return "please give me something to search for, e.g. `@chud search slack billing`.";
  }

  if (!actionToken) {
    return "slack search needs an action token from the current app mention event.";
  }

  try {
    const result = await client.apiCall("assistant.search.context", {
      query: cleanedQuery,
      content_types: ["messages"],
      channel_types: ["public_channel"],
      action_token: actionToken,
    });

    const items = Array.isArray((result as any).results)
      ? (result as any).results
      : [];

    if (items.length === 0) {
      return `no Slack results found for: \`${cleanedQuery}\``;
    }

    const lines = [`*top Slack results for:* \`${cleanedQuery}\``, ""];

    for (const item of items.slice(0, 5)) {
      const channelName =
        item.channel?.name ? `#${item.channel.name}` : "unknown-channel";
      const text =
        typeof item.text === "string"
          ? item.text.slice(0, 180)
          : "(no text preview)";
      const permalink =
        typeof item.permalink === "string" ? item.permalink : "";

      lines.push(`• *${channelName}* — ${text}`);
      if (permalink) lines.push(`  ${permalink}`);
      lines.push("");
    }

    return lines.join("\n");
  } catch (error) {
    console.error("assistant.search.context runtime error:", error);
    return "slack real-time search failed. check runtime logs and app scopes.";
  }
}