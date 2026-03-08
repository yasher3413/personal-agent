import Anthropic from "@anthropic-ai/sdk";

export async function askClaude(prompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return "claude api key is missing in the deployment environment.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
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
      return "claude returned no text response.";
    }

    return textBlock.text;
  } catch (error) {
    console.error("claude error:", error);
    return "claude request failed. check vercel env vars and function logs.";
  }
}