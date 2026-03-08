import { LinearClient } from "@linear/sdk";

const apiKey = process.env.LINEAR_API_KEY;

if (!apiKey) {
  throw new Error("LINEAR_API_KEY is missing");
}

export const linear = new LinearClient({
  apiKey,
});