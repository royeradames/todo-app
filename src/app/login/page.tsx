import { AuthShell } from "@/components/auth-shell";
import { Login } from "@/components/login";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="A familiar way in."
      description="One account for this app, with a password, a passkey, or approval from a device you already trust."
    >
      <Login returnTo={returnTo || null} />
    </AuthShell>
  );
}
