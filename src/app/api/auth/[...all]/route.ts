import { getAuth } from "@/lib/auth-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch {
    return Response.json(
      { error: "Account access is temporarily unavailable. Please try again." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
