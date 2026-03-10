import { LinearClient } from "@linear/sdk";

function getLinearClient(): LinearClient {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY is missing");
  return new LinearClient({ apiKey });
}

export { getLinearClient };
