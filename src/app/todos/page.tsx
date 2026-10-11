import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentViewer, signInPath } from "@/lib/auth-server";
import { SavedTodos } from "@/components/saved-todos";
import { Providers } from "@/components/providers";
import { AccountUnavailable } from "@/components/account-unavailable";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your tasks",
  robots: { index: false, follow: false },
};
export default async function TodosPage() {
  const requestHeaders = await headers();
  const viewer = await currentViewer(requestHeaders);
  if (viewer.state === "unavailable") return <AccountUnavailable />;
  if (viewer.state === "signed-out") redirect(signInPath("/todos", requestHeaders.get("cookie")));
  if (viewer.state !== "signed-in") redirect("/login?returnTo=%2Ftodos");
  return (
    <Providers>
      <SavedTodos key={viewer.principal.id} ownerId={viewer.principal.id} />
    </Providers>
  );
}
