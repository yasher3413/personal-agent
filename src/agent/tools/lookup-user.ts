import type { WebClient } from "@slack/web-api";

type Input = { slack_user_id?: string; name?: string };

function formatUser(user: NonNullable<Awaited<ReturnType<WebClient["users"]["info"]>>["user"]>) {
  return {
    found: true,
    slack_user_id: user.id,
    display_name: user.profile?.display_name || user.real_name,
    real_name: user.real_name,
    email: user.profile?.email ?? null,
    title: user.profile?.title ?? null,
    is_bot: user.is_bot ?? false,
  };
}

export async function lookupUser(input: Input, slackClient: WebClient): Promise<string> {
  try {
    // direct ID lookup
    if (input.slack_user_id) {
      const res = await slackClient.users.info({ user: input.slack_user_id });
      if (!res.user) return JSON.stringify({ found: false });
      return JSON.stringify(formatUser(res.user));
    }

    // name-based search
    if (input.name) {
      const query = input.name.toLowerCase();
      const res = await slackClient.users.list({});
      const match = (res.members ?? []).find(
        (u) =>
          !u.deleted &&
          !u.is_bot &&
          (u.real_name?.toLowerCase().includes(query) ||
            u.profile?.display_name?.toLowerCase().includes(query))
      );
      if (!match) return JSON.stringify({ found: false });
      return JSON.stringify(formatUser(match));
    }

    return JSON.stringify({ error: "provide slack_user_id or name" });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listUsers(slackClient: WebClient): Promise<string> {
  try {
    const res = await slackClient.users.list({});
    const members = (res.members ?? [])
      .filter((u) => !u.deleted && !u.is_bot && u.id !== "USLACKBOT")
      .map((u) => ({
        slack_user_id: u.id,
        display_name: u.profile?.display_name || u.real_name,
        real_name: u.real_name,
        title: u.profile?.title ?? null,
      }));
    return JSON.stringify({ members });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
