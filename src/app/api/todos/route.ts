import { getAuth } from "@/lib/auth-server";
import { authSettings } from "@/lib/auth-config";
import { getDatabase } from "@/lib/database";
import { createTodoStore, TodoConflict } from "@/lib/todos/store";
import { InvalidTodoChange } from "@/lib/todos/model";
import { BadTodoRequest, readTodoMutation } from "@/lib/todos/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };
function errorResponse(error: unknown) {
  if (error instanceof BadTodoRequest)
    return Response.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof TodoConflict)
    return Response.json({ error: error.message }, { status: 409, headers });
  if (error instanceof InvalidTodoChange)
    return Response.json({ error: error.message }, { status: 400, headers });
  console.error(JSON.stringify({ event: "todo_request_failed" }));
  return Response.json(
    { error: "Your list is temporarily unavailable. Please try again." },
    { status: 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const principal = await getAuth().getPrincipal(request.headers);
    if (!principal)
      return Response.json(
        { error: "Sign in to view your list." },
        { status: 401, headers },
      );
    return Response.json(
      {
        ownerId: principal.id,
        ...(await createTodoStore(getDatabase()).read(principal.id)),
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const principal = await getAuth().getPrincipal(request.headers);
    if (!principal)
      return Response.json(
        { error: "Sign in to change your list." },
        { status: 401, headers },
      );
    // The cookie may change in another tab while this screen still shows the
    // previous person. This assertion can only reject; principal remains authority.
    if (request.headers.get("x-todo-account") !== principal.id)
      return Response.json(
        { error: "Your account changed. Reload your list before saving." },
        { status: 401, headers },
      );
    const change = await readTodoMutation(request, authSettings().baseURL);
    return Response.json(
      {
        ownerId: principal.id,
        ...(await createTodoStore(getDatabase()).change(
          principal.id,
          change.version,
          change.command,
        )),
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
