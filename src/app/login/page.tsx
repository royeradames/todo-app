import { AuthShell } from "@/components/auth-shell";
import { Login } from "@/components/login";
export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Your tasks, on every device."
      description="One Breakthrough account opens Todo and the other apps in the family. Your list stays private to you."
    >
      <Login returnTo={returnTo || null} />
    </AuthShell>
  );
}
