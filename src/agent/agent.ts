import { tools } from "./tools";

export async function runAgent({
  text,
  slackClient,
  channel,
  threadTs,
}) {

  const response = await askClaude({
    system: `
You are Chud, an internal AI assistant.

You have access to tools.

If you need more context, call fetch_slack_history.
If you need company info, search the knowledge base.
If a user asks to create an issue, call create_linear_issue.
`,
    tools,
    message: text
  });

  return response;
}