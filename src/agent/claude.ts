import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

export async function askClaude(prompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return "claude api key missing in vercel env vars.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const cleanedPrompt = prompt.replace(/<@[^>]+>/g, "").trim();

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: cleanedPrompt,
        },
      ],
    });

    const textBlock = msg.content.find((c) => c.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      return "claude returned no text.";
    }

    return textBlock.text.trim();
  } catch (error) {
    console.error("claude runtime error:", error);
    return "claude request failed. check vercel runtime logs.";
  }
}

export async function summarizeSlackThread(threadText: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return "claude api key missing in vercel env vars.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = `
You are summarizing an internal Slack thread for a startup team.

Summarize the thread in this exact Slack-friendly structure:

*thread summary*

*topic*
<one short sentence>

*key points*
• point 1
• point 2
• point 3

*action items*
• owner → action
• owner → action

If there are no clear action items, say:
• none

Thread:
${threadText}
    `.trim();

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textBlock = msg.content.find((c) => c.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      return "claude returned no thread summary.";
    }

    return textBlock.text.trim();
  } catch (error) {
    console.error("thread summarization error:", error);
    return "thread summarization failed. check vercel runtime logs.";
  }
}

export type DraftLinearIssue = {
  title: string;
  description: string;
};

export async function draftLinearIssueFromThread(
  threadText: string
): Promise<DraftLinearIssue | null> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = `
You are helping create a Linear issue from an internal Slack thread.

Return only valid JSON with this shape:
{
  "title": "short issue title",
  "description": "clear markdown description with context, problem, and action items"
}

Rules:
- title should be concise and specific
- description should be useful to an engineering/ops team
- no markdown code fences
- no extra commentary

Thread:
${threadText}
    `.trim();

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textBlock = msg.content.find((c) => c.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      return null;
    }

    const parsed = JSON.parse(textBlock.text) as DraftLinearIssue;

    if (!parsed.title || !parsed.description) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("draftLinearIssueFromThread error:", error);
    return null;
  }
}