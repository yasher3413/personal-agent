import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { runAgent } from "@/agent/agent";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const from = params.get("From") ?? "";
  const text = params.get("Body") ?? "";

  if (!text.trim()) {
    return new NextResponse("", { status: 200 });
  }

  // Fire and forget — Twilio needs a fast 200 response
  (async () => {
    try {
      let response = "";
      const onChunk = (delta: string) => { response += delta; return Promise.resolve(); };

      await runAgent({
        text,
        userId: from,
        onChunk,
      });

      // Split into 1600-char chunks (SMS limit is 1600 chars for long messages)
      const chunks = response.match(/[\s\S]{1,1600}/g) ?? [];
      for (const chunk of chunks) {
        await client.messages.create({
          body: chunk,
          from: fromNumber,
          to: from,
        });
      }
    } catch (err) {
      console.error("SMS handler error:", err);
      await client.messages.create({
        body: "Something went wrong. Please try again.",
        from: fromNumber,
        to: from,
      });
    }
  })();

  return new NextResponse("", { status: 200 });
}
