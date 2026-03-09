type Input = { slack_user_id: string };

// stub — no DB yet
export async function lookupUser(_input: Input): Promise<string> {
  return JSON.stringify({ found: false });
}
