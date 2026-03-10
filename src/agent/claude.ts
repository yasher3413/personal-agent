import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 20;

type RunAgentLoopParams = {
  system: string;
  toolDefinitions: Anthropic.Tool[];
  toolExecutors: Record<string, (input: unknown) => Promise<string>>;
  userMessage: string;
  onChunk?: (delta: string) => Promise<void>;
  onToolCall?: (toolName: string) => Promise<void>;
};

export async function runAgentLoop({
  system,
  toolDefinitions,
  toolExecutors,
  userMessage,
  onChunk,
  onToolCall,
}: RunAgentLoopParams): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return "claude api key missing.";

  const anthropic = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let accumulatedText = "";

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: toolDefinitions,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        onChunk
      ) {
        accumulatedText += event.delta.text;
        await onChunk(event.delta.text);
      }
    }

    const response = await stream.finalMessage();
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text");
      return text?.text?.trim() ?? "(no response)";
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        if (onToolCall) await onToolCall(block.name);

        const executor = toolExecutors[block.name];
        let result: string;

        if (!executor) {
          result = JSON.stringify({ error: `unknown tool: ${block.name}` });
        } else {
          try {
            result = await executor(block.input);
          } catch (err) {
            result = JSON.stringify({ error: String(err) });
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return "agent loop exceeded max iterations.";
}
