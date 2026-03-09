import type { WebClient } from "@slack/web-api";

type Input = { slack_user_id: string };

export async function lookupUser(input: Input, slackClient: WebClient): Promise<string> {
  try {
    const res = await slackClient.users.info({ user: input.slack_user_id });
    const user = res.user;

    if (!user) return JSON.stringify({ found: false });

    return JSON.stringify({
      found: true,
      slack_user_id: user.id,
      display_name: user.profile?.display_name || user.real_name,
      real_name: user.real_name,
      email: user.profile?.email ?? null,
      title: user.profile?.title ?? null,
      is_bot: user.is_bot ?? false,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
