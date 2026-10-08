import { AuthShell } from "@/components/auth-shell";
import { TwoFactor } from "@/components/two-factor";
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <AuthShell
      eyebrow="A second check"
      title="Make it yours."
      description="Your password is one part. A rotating code from your authenticator app completes this sign-in."
    >
      <TwoFactor returnTo={returnTo || null} />
    </AuthShell>
  );
}
