import { AuthShell } from "@/components/auth-shell";
import { Login } from "@/components/login";
export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Your tasks, on every device."
      description="One Breakthrough account opens Todo and the other apps in the family. Your list stays private to you."
    >
      <Login
        returnTo={returnTo || null}
        failure={
          error === "unavailable"
            ? "Your account could not be reached. Please try again in a moment."
            : error === "linking"
              ? "This account needs a quick review before it can open Todo. Ask the app owner to review it; starting again will not help."
              : error === "expired"
              ? "That sign-in expired or could not be verified. Please start again."
              : null
        }
      />
    </AuthShell>
  );
}
