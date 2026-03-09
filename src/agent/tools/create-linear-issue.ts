import { createLinearIssue } from "../../linear/create-issue";

type Input = { title: string; description: string };

export async function createLinearIssueTool(input: Input): Promise<string> {
  try {
    const issue = await createLinearIssue(input);
    return JSON.stringify(issue);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
