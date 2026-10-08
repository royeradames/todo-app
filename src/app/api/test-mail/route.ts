import { readTestMail } from "@/lib/mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const inbox = readTestMail(request);
    return inbox
      ? Response.json(inbox, {
          headers: { "cache-control": "private, no-store" },
        })
      : new Response(null, { status: 404 });
  } catch {
    return new Response(null, { status: 404 });
  }
}
