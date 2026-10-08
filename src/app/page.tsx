import { LocalTodos } from "@/components/local-todos";
import { getAuth } from "@/lib/auth-server";

// Reads this deployment's account settings on each request, so a build
// never bakes in another environment's answer.
export const dynamic = "force-dynamic";

export default function Home() {
  return <LocalTodos accounts={getAuth() !== null} />;
}
