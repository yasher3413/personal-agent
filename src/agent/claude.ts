import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeMemoryTool, MemoryCommand } from "@supermemory/tools/claude-memory";

const MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 20;
const MEMORY_BETA = "context-management-2025-06-27";
// Built-in memory tool definition — no schema needed, Claude knows how to use it
const MEMORY_TOOL_DEF = { type: "memory_20250818" as const };

type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

type RunAgentLoopParams = {
  system: string | SystemBlock[];
  toolDefinitions: Anthropic.Tool[];
  toolExecutors: Record<string, (input: unknown) => Promise<string>>;
  userMessage: string;
  memoryTool?: ClaudeMemoryTool;
  onChunk?: (delta: string) => Promise<void>;
  onToolCall?: (toolName: string) => Promise<void>;
};

export async function runAgentLoop({
  system,
  toolDefinitions,
  toolExecutors,
  userMessage,
  memoryTool,
  onChunk,
  onToolCall,
}: RunAgentLoopParams): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return "claude api key missing.";

  const anthropic = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Cache breakpoint on last regular tool, then append memory tool after (uncached)
  const cachedToolDefs = toolDefinitions.map((t, i) =>
    i === toolDefinitions.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t
  );
  const allTools = memoryTool
    ? ([...cachedToolDefs, MEMORY_TOOL_DEF] as Anthropic.Tool[])
    : cachedToolDefs;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let accumulatedText = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamParams: any = {
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: allTools,
      messages,
    };
    if (memoryTool) streamParams.betas = [MEMORY_BETA];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: any = memoryTool
      ? anthropic.beta.messages.stream(streamParams)
      : anthropic.messages.stream(streamParams);

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
    const content = response.content as Anthropic.ContentBlock[];
    messages.push({ role: "assistant", content: content as Anthropic.MessageParam["content"] });

    if (response.stop_reason === "end_turn") {
      const text = content.find((b) => b.type === "text");
      return (text as Anthropic.TextBlock | undefined)?.text?.trim() ?? "(no response)";
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of content) {
        if (block.type !== "tool_use") continue;

        if (onToolCall) await onToolCall(block.name);

        const executor = toolExecutors[block.name];

        if (!executor && memoryTool) {
          // Route to native memory tool
          const memResult = await memoryTool.handleCommandForToolResult(
            block.input as MemoryCommand,
            block.id
          );
          toolResults.push(memResult as unknown as Anthropic.ToolResultBlockParam);
        } else if (!executor) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: `unknown tool: ${block.name}` }),
          });
        } else {
          let result: string;
          try {
            result = await executor(block.input);
          } catch (err) {
            result = JSON.stringify({ error: String(err) });
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return "agent loop exceeded max iterations.";
}
