import { google } from "googleapis";

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3000");
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

export async function listCalendarEventsTool(input: {
  days_ahead?: number;
  max_results?: number;
}): Promise<string> {
  const calendar = getCalendarClient();
  if (!calendar) return JSON.stringify({ error: "Google Calendar not configured" });

  try {
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (input.days_ahead ?? 7));

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      maxResults: input.max_results ?? 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      location: e.location ?? null,
      description: e.description ?? null,
      attendees: (e.attendees ?? []).map((a) => a.email),
      meet_link: e.hangoutLink ?? null,
    }));

    return JSON.stringify({ events, total: events.length });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function createCalendarEventTool(input: {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  add_google_meet?: boolean;
}): Promise<string> {
  const calendar = getCalendarClient();
  if (!calendar) return JSON.stringify({ error: "Google Calendar not configured" });

  try {
    const event: any = {
      summary: input.title,
      start: { dateTime: input.start, timeZone: "America/Toronto" },
      end: { dateTime: input.end, timeZone: "America/Toronto" },
    };

    if (input.description) event.description = input.description;
    if (input.location) event.location = input.location;
    if (input.attendees?.length) {
      event.attendees = input.attendees.map((email) => ({ email }));
    }
    if (input.add_google_meet) {
      event.conferenceData = {
        createRequest: { requestId: Math.random().toString(36).slice(2) },
      };
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: input.add_google_meet ? 1 : 0,
      requestBody: event,
      sendUpdates: input.attendees?.length ? "all" : "none",
    });

    return JSON.stringify({
      success: true,
      id: res.data.id,
      title: res.data.summary,
      start: res.data.start?.dateTime,
      end: res.data.end?.dateTime,
      meet_link: res.data.hangoutLink ?? null,
      html_link: res.data.htmlLink,
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function updateCalendarEventTool(input: {
  event_id: string;
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): Promise<string> {
  const calendar = getCalendarClient();
  if (!calendar) return JSON.stringify({ error: "Google Calendar not configured" });

  try {
    const existing = await calendar.events.get({ calendarId: "primary", eventId: input.event_id });
    const event: any = { ...existing.data };

    if (input.title) event.summary = input.title;
    if (input.start) event.start = { dateTime: input.start, timeZone: "America/Toronto" };
    if (input.end) event.end = { dateTime: input.end, timeZone: "America/Toronto" };
    if (input.description) event.description = input.description;
    if (input.location) event.location = input.location;
    if (input.attendees) event.attendees = input.attendees.map((email) => ({ email }));

    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: input.event_id,
      requestBody: event,
      sendUpdates: "all",
    });

    return JSON.stringify({ success: true, id: res.data.id, title: res.data.summary });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

export async function deleteCalendarEventTool(input: { event_id: string }): Promise<string> {
  const calendar = getCalendarClient();
  if (!calendar) return JSON.stringify({ error: "Google Calendar not configured" });

  try {
    await calendar.events.delete({ calendarId: "primary", eventId: input.event_id, sendUpdates: "all" });
    return JSON.stringify({ success: true });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
