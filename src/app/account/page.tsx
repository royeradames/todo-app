import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "@/components/account";
import { AccountUnavailable } from "@/components/account-unavailable";
import { authSettings } from "@/lib/auth-config";
import { currentViewer } from "@/lib/auth-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };
export default async function AccountPage() {
  const viewer = await currentViewer(await headers());
  if (viewer.state === "unavailable") return <AccountUnavailable />;
  if (viewer.state !== "signed-in") redirect("/login?returnTo=%2Faccount");
  const { principal } = viewer;
  return (
    <Account
      key={principal.id}
      name={principal.name}
      email={principal.email}
      manageURL={new URL("/account", authSettings().issuerOrigin).href}
    />
  );
}
