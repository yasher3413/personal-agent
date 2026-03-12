import { getLinearClient } from "../../linear/client";
import { PaginationOrderBy } from "@linear/sdk";

async function resolveProjectId(linear: ReturnType<typeof getLinearClient>, project: string): Promise<string | undefined> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project)) return project;
  const projects = await linear.projects({ first: 50 });
  const match = projects.nodes.find((p) => p.name.toLowerCase() === project.toLowerCase());
  return match?.id;
}

// Resolves milestone name → ID within a given project
async function resolveProjectMilestoneId(
  linear: ReturnType<typeof getLinearClient>,
  projectId: string,
  milestone: string
): Promise<string | undefined> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(milestone)) return milestone;
  const project = await linear.project(projectId);
  const milestones = await project.projectMilestones();
  const match = milestones.nodes.find((m) => m.name.toLowerCase() === milestone.toLowerCase());
  return match?.id;
}

async function getTeamId(): Promise<string> {
  const teamId = process.env.LINEAR_TEAM_ID;
  if (!teamId) throw new Error("LINEAR_TEAM_ID is missing");
  return teamId;
}

// Accepts UUID, "INT-523", or bare "523" — returns the internal UUID
async function resolveIssueId(linear: ReturnType<typeof getLinearClient>, id: string): Promise<string> {
  // Already a UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;

  const teamId = await getTeamId();
  let filter: Record<string, unknown>;

  if (/^\d+$/.test(id)) {
    // Bare number e.g. "523"
    filter = { team: { id: { eq: teamId } }, number: { eq: Number(id) } };
  } else {
    // Identifier e.g. "INT-523"
    filter = { team: { id: { eq: teamId } }, identifier: { eq: id.toUpperCase() } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await linear.issues({ filter: filter as any, first: 1 });
  const match = res.nodes[0];
  if (!match) throw new Error(`Issue not found: ${id}`);
  return match.id;
}

export async function createLinearIssueTool(input: {
  title: string;
  description: string;
  priority?: number;
  project?: string;
  milestone?: string;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const projectId = input.project ? await resolveProjectId(linear, input.project) : undefined;
    const projectMilestoneId = projectId && input.milestone
      ? await resolveProjectMilestoneId(linear, projectId, input.milestone)
      : undefined;
    const res = await linear.createIssue({
      teamId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      projectId,
      projectMilestoneId,
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
  project?: string;
  milestone?: string;
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

    const projectId = input.project ? await resolveProjectId(linear, input.project) : undefined;

    // For milestone, we need a projectId — use provided or fetch from the issue
    let projectMilestoneId: string | undefined;
    if (input.milestone) {
      let resolvedProjectId = projectId;
      if (!resolvedProjectId) {
        const issue = await linear.issue(await resolveIssueId(linear, input.id));
        const issueProject = await issue.project;
        resolvedProjectId = issueProject?.id;
      }
      if (resolvedProjectId) {
        projectMilestoneId = await resolveProjectMilestoneId(linear, resolvedProjectId, input.milestone);
      }
    }

    const res = await linear.updateIssue(await resolveIssueId(linear, input.id), {
      title: input.title,
      description: input.description,
      priority: input.priority,
      stateId,
      projectId,
      projectMilestoneId,
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
    const issue = await linear.issue(await resolveIssueId(linear, input.id));
    if (!issue) return JSON.stringify({ error: "Issue not found" });

    const [state, assignee, project] = await Promise.all([issue.state, issue.assignee, issue.project]);
    return JSON.stringify({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      state: state?.name ?? null,
      assignee: assignee?.name ?? null,
      project: project?.name ?? null,
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
        const [state, assignee, project] = await Promise.all([issue.state, issue.assignee, issue.project]);
        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          state: state?.name ?? null,
          assignee: assignee?.name ?? null,
          project: project?.name ?? null,
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

export async function addLinearCommentTool(input: {
  issue_id: string;
  body: string;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const res = await linear.createComment({ issueId: await resolveIssueId(linear, input.issue_id), body: input.body });
    if (!res.success) throw new Error("Failed to create comment");
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function createLinearProjectTool(input: {
  name: string;
  description?: string;
  target_date?: string;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const res = await linear.createProject({
      name: input.name,
      description: input.description,
      targetDate: input.target_date,
      teamIds: [teamId],
    });
    if (!res.success || !res.project) throw new Error("Failed to create project");
    const project = await res.project;
    return JSON.stringify({ id: project.id, name: project.name, url: project.url });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function createLinearMilestoneTool(input: {
  project: string;
  name: string;
  description?: string;
  target_date?: string;
}): Promise<string> {
  try {
    const linear = getLinearClient();
    const projectId = await resolveProjectId(linear, input.project);
    if (!projectId) throw new Error(`Project not found: ${input.project}`);
    const res = await linear.createProjectMilestone({
      projectId,
      name: input.name,
      description: input.description,
      targetDate: input.target_date,
    });
    if (!res.success || !res.projectMilestone) throw new Error("Failed to create milestone");
    const milestone = await res.projectMilestone;
    return JSON.stringify({ id: milestone.id, name: milestone.name });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listLinearProjectsTool(): Promise<string> {
  try {
    const linear = getLinearClient();
    const projects = await linear.projects({ first: 50 });
    const results = projects.nodes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      state: p.state,
      url: p.url,
    }));
    return JSON.stringify({ projects: results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listLinearLabelsTool(): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const labels = await linear.issueLabels({ filter: { team: { id: { eq: teamId } } } });
    const results = labels.nodes.map((l) => ({ id: l.id, name: l.name, color: l.color }));
    return JSON.stringify({ labels: results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function listLinearWorkflowStatesTool(): Promise<string> {
  try {
    const linear = getLinearClient();
    const teamId = await getTeamId();
    const states = await linear.workflowStates({ filter: { team: { id: { eq: teamId } } } });
    const results = states.nodes.map((s) => ({ id: s.id, name: s.name, type: s.type }));
    return JSON.stringify({ states: results });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
