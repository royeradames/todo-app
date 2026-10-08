import { headers } from "next/headers";
import { LocalTodos } from "@/components/local-todos";
import { currentViewer } from "@/lib/auth-server";

// Reads this deployment's account settings on each request, so a build
// never bakes in another environment's answer.
export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await currentViewer(await headers());
  return (
    <LocalTodos
      accounts={
        viewer.state === "accounts-off"
          ? "off"
          : viewer.state === "signed-in"
            ? "signed-in"
            : "signed-out"
      }
    />
  );
}
