import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function askClaude(prompt: string): Promise<string> {
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

  if (!textBlock) {
    return "claude returned no text response.";
  }

  return textBlock.text;
}