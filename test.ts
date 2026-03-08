import { LinearClient } from "@linear/sdk";

const client = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

async function run() {
  const teams = await client.teams();

  for (const team of teams.nodes) {
    console.log(team.name, team.id);
  }
}

run();