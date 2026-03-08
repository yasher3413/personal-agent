import { linear } from "./client";

export type LinearIssueInput = {
  title: string;
  description: string;
};

export async function createLinearIssue(input: LinearIssueInput) {
  const teamId = process.env.LINEAR_TEAM_ID;

  if (!teamId) {
    throw new Error("LINEAR_TEAM_ID is missing");
  }
  

  const response = await linear.createIssue({
    teamId,
    title: input.title,
    description: input.description,
  });
  

  if (!response.success || !response.issue) {
    throw new Error("Failed to create Linear issue");
  }

  const issue = await response.issue;

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
  };
}