import { google } from "googleapis";

function getGmailClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3000");
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(payload: any): string {
  if (payload.body?.data) return decodeBase64(payload.body.data).slice(0, 2000);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data).slice(0, 2000);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      }
    }
  }
  return "";
}

export async function listEmailsTool(input: {
  max_results?: number;
  query?: string;
  unread_only?: boolean;
}): Promise<string> {
  const gmail = getGmailClient();
  if (!gmail) return JSON.stringify({ error: "Gmail not configured" });

  try {
    let q = input.query ?? "";
    if (input.unread_only) q = `is:unread ${q}`.trim();

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: input.max_results ?? 10,
      q: q || undefined,
    });

    const messages = res.data.messages ?? [];
    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: msg.id,
          from: getHeader(headers, "from"),
          subject: getHeader(headers, "subject"),
          date: getHeader(headers, "date"),
          snippet: detail.data.snippet ?? "",
        };
      })
    );

    return JSON.stringify({ emails, total: emails.length });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function getEmailTool(input: { email_id: string }): Promise<string> {
  const gmail = getGmailClient();
  if (!gmail) return JSON.stringify({ error: "Gmail not configured" });

  try {
    const res = await gmail.users.messages.get({ userId: "me", id: input.email_id, format: "full" });
    const headers = res.data.payload?.headers ?? [];
    const body = extractBody(res.data.payload);

    return JSON.stringify({
      id: res.data.id,
      from: getHeader(headers, "from"),
      to: getHeader(headers, "to"),
      subject: getHeader(headers, "subject"),
      date: getHeader(headers, "date"),
      body,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function sendEmailTool(input: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<string> {
  const gmail = getGmailClient();
  if (!gmail) return JSON.stringify({ error: "Gmail not configured" });

  try {
    const lines = [
      `To: ${input.to}`,
      ...(input.cc ? [`Cc: ${input.cc}`] : []),
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ];

    const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return JSON.stringify({ success: true, id: res.data.id });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function trashEmailsTool(input: { email_ids: string[] }): Promise<string> {
  const gmail = getGmailClient();
  if (!gmail) return JSON.stringify({ error: "Gmail not configured" });

  try {
    await Promise.all(
      input.email_ids.map((id) => gmail.users.messages.trash({ userId: "me", id }))
    );
    return JSON.stringify({ success: true, trashed: input.email_ids.length });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
