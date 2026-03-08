import Anthropic from "@anthropic-ai/sdk";

export async function askClaude(prompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return "claude api key missing in vercel env vars.";
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const cleanedPrompt = prompt.replace(/<@[^>]+>/g, "").trim();

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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