import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "@/components/account";
import { authSettings } from "@/lib/auth-config";
import { getAuth } from "@/lib/auth-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };
export default async function AccountPage() {
  const principal = await getAuth().getPrincipal(await headers());
  if (!principal) redirect("/login?returnTo=%2Faccount");
  return (
    <Account
      key={principal.id}
      name={principal.name}
      email={principal.email}
      manageURL={new URL("/account", authSettings().issuerOrigin).href}
    />
  );
}
