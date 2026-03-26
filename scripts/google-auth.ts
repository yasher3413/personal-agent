import { google } from "googleapis";
import * as readline from "readline";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000"
);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
  ],
});

console.log("\nOpen this URL in your browser:\n");
console.log(url);
console.log("\nAfter approving, you'll be redirected to localhost:3000 with a 'code' param in the URL.");
console.log("Copy the code value and paste it here:\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Code: ", async (code) => {
  rl.close();
  const { tokens } = await oauth2Client.getToken(code.trim());
  console.log("\nAdd this to your .env and Vercel env vars:");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
});
