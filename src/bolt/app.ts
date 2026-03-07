import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

app.message(/ping/, async ({ message, say }) => {
  await say("pong");
});

(async () => {
  await app.start(3000);
  console.log("⚡️ chud running");
})();