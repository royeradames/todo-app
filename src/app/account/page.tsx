import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "@/components/account";
import { getAuth } from "@/lib/auth-server";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const auth = await getAuth();
  const requestHeaders = await headers();
  const principal = await auth.getPrincipal(requestHeaders);
  if (!principal) redirect("/login");
  return (
    <Account
      key={principal.id}
      ownerId={principal.id}
      name={principal.name}
      email={principal.email}
    />
  );
}
