import type { WebClient } from "@slack/web-api";

export async function listChannels(slackClient: WebClient): Promise<string> {
  try {
    const res = await slackClient.conversations.list({
      exclude_archived: true,
      types: "public_channel,private_channel",
      limit: 200,
    });
    const channels = (res.channels ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private ?? false,
      num_members: c.num_members,
    }));
    return JSON.stringify({ channels });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
