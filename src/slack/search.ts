import type { WebClient } from "@slack/web-api";

export async function searchSlackMessages(
  client: WebClient,
  query: string
): Promise<string> {
  const cleanedQuery = query.replace(/<@[^>]+>/g, "").trim();

  if (!cleanedQuery) {
    return "please give me something to search for.";
  }

  const result = await client.search.messages({
    query: cleanedQuery,
    count: 5,
    sort: "score",
    sort_dir: "desc",
    highlight: false,
  });

  const matches = result.messages?.matches ?? [];

  if (matches.length === 0) {
    return `no Slack results found for: \`${cleanedQuery}\``;
  }

  const lines = [
    `*top Slack results for:* \`${cleanedQuery}\``,
    "",
  ];

  for (const match of matches.slice(0, 5)) {
    const channelName =
      typeof match.channel?.name === "string"
        ? `#${match.channel.name}`
        : "unknown-channel";

    const text =
      typeof match.text === "string"
        ? match.text.slice(0, 180)
        : "(no text preview)";

    const permalink =
      typeof match.permalink === "string" ? match.permalink : "";

    lines.push(`• *${channelName}* — ${text}`);
    if (permalink) {
      lines.push(`  ${permalink}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}