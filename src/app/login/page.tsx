import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Login } from "@/components/login";
import { currentViewer } from "@/lib/auth-server";
import { safeReturnPath } from "@/lib/return-path";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;
  const viewer = await currentViewer(await headers());
  // Signed-in people never see the sign-in page.
  if (viewer.state === "signed-in")
    redirect(safeReturnPath(returnTo, "http://todo.invalid"));
  if (viewer.state === "accounts-off")
    return (
      <AuthShell
        eyebrow="Accounts"
        title="Accounts are coming soon."
        description="Soon one Breakthrough account will keep your Todo list on every device and open the other apps in the family."
      >
        <div className="stack">
          <h2>Your tasks work today</h2>
          <p className="card-description">
            Until accounts open, Todo saves your list in this browser only. It
            stays on this device, and nothing is sent to a server.
          </p>
          <Link className="button primary full" href="/">
            Open your tasks
          </Link>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Your tasks, on every device."
      description="One Breakthrough account opens Todo and the other apps in the family. Your list stays private to you."
    >
      <Login
        returnTo={returnTo || null}
        failure={
          viewer.state === "unavailable" || error === "unavailable"
            ? "Your account could not be reached. Please try again in a moment."
            : error === "linking"
              ? "This account needs a review before it can open Todo. Ask the app owner to review it; starting again will not help."
              : error === "expired"
                ? "That sign-in expired or could not be verified. Please start again."
                : null
        }
      />
    </AuthShell>
  );
}
