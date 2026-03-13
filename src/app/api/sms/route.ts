import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
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

  waitUntil(
    (async () => {
      try {
        let response = "";
        const onChunk = (delta: string) => { response += delta; };

        await runAgent({ text, userId: from, onChunk });

        const chunks = response.match(/[\s\S]{1,1600}/g) ?? [];
        console.log("SMS response length:", response.length, "chunks:", chunks.length);
        for (const chunk of chunks) {
          const msg = await client.messages.create({ body: chunk, from: fromNumber, to: from });
          console.log("SMS sent:", msg.sid, msg.status, msg.errorCode, msg.errorMessage);
        }
      } catch (err) {
        console.error("SMS handler error:", err);
        await client.messages.create({
          body: "Something went wrong. Please try again.",
          from: fromNumber,
          to: from,
        });
      }
    })()
  );

  return new NextResponse("", { status: 200 });
}
