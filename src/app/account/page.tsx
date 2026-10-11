import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Account } from "@/components/account";
import { AccountUnavailable } from "@/components/account-unavailable";
import { issuerOrigin } from "@/lib/auth-config";
import { currentViewer, signInPath } from "@/lib/auth-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };
export default async function AccountPage() {
  const requestHeaders = await headers();
  const viewer = await currentViewer(requestHeaders);
  if (viewer.state === "unavailable") return <AccountUnavailable />;
  if (viewer.state === "signed-out") redirect(signInPath("/account", requestHeaders.get("cookie")));
  if (viewer.state !== "signed-in") redirect("/login?returnTo=%2Faccount");
  const { principal } = viewer;
  return (
    <Account
      key={principal.id}
      name={principal.name}
      email={principal.email}
      manageURL={new URL("/account", issuerOrigin()).href}
    />
  );
}
