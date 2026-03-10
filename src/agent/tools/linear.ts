import { getLinearClient } from "../../linear/client";
import { PaginationOrderBy } from "@linear/sdk";

async function getTeamId(): Promise<string> {
  const teamId = process.env.LINEAR_TEAM_ID;
  if (!teamId) throw new Error("LINEAR_TEAM_ID is missing");
  return teamId;
}

export async function createLinearIssueTool(input: {
  title: string;
  description: string;
  priority?: number;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const res = await linear.createIssue({
      teamId,
      title: input.title,
      description: input.description,
      priority: input.priority,
    });
    if (!res.success || !res.issue) throw new Error("Failed to create issue");
    const issue = await res.issue;
    return JSON.stringify({ id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function updateLinearIssueTool(input: {
  id: string;
  title?: string;
  description?: string;
  priority?: number;
  state?: string;
}): Promise<string> {
  try {
    const linear = getLinearClient();

    // Resolve state name → ID if provided
    let stateId: string | undefined;
    if (input.state) {
      const teamId = await getTeamId();
      const states = await linear.workflowStates({ filter: { team: { id: { eq: teamId } } } });
      const match = states.nodes.find(
        (s) => s.name.toLowerCase() === input.state!.toLowerCase()
      );
      stateId = match?.id;
    }

    const res = await linear.updateIssue(input.id, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      stateId,
    });

    if (!res.success || !res.issue) throw new Error("Failed to update issue");
    const issue = await res.issue;
    return JSON.stringify({ id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function getLinearIssueTool(input: { id: string }): Promise<string> {
  try {
    const linear = getLinearClient();
    const issue = await linear.issue(input.id);
    if (!issue) return JSON.stringify({ error: "Issue not found" });

    const [state, assignee] = await Promise.all([issue.state, issue.assignee]);
    return JSON.stringify({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      state: state?.name ?? null,
      assignee: assignee?.name ?? null,
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listLinearIssuesTool(input: {
  query?: string;
  state?: string;
  assignee?: string;
  limit?: number;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const limit = input.limit ?? 10;

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { team: { id: { eq: teamId } } };
    if (input.state) filter.state = { name: { eqIgnoreCase: input.state } };
    if (input.assignee) filter.assignee = { name: { containsIgnoreCase: input.assignee } };
    if (input.query) filter.or = [
      { title: { containsIgnoreCase: input.query } },
      { description: { containsIgnoreCase: input.query } },
    ];

    const issues = await linear.issues({ filter, first: limit, orderBy: PaginationOrderBy.UpdatedAt });

    const results = await Promise.all(
      issues.nodes.map(async (issue) => {
        const [state, assignee] = await Promise.all([issue.state, issue.assignee]);
        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          state: state?.name ?? null,
          assignee: assignee?.name ?? null,
          priority: issue.priority,
          url: issue.url,
        };
      })
    );

    return JSON.stringify({ issues: results, total: results.length });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
