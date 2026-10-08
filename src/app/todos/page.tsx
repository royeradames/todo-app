import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth-server";
import { SavedTodos } from "@/components/saved-todos";
import { Providers } from "@/components/providers";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your tasks",
  robots: { index: false, follow: false },
};
export default async function TodosPage() {
  const principal = await getAuth().getPrincipal(await headers());
  if (!principal) redirect("/login?returnTo=%2Ftodos");
  return (
    <Providers>
      <SavedTodos key={principal.id} ownerId={principal.id} />
    </Providers>
  );
}
