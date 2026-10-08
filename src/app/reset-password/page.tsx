import { AuthShell } from "@/components/auth-shell";
import { ResetPassword } from "@/components/recovery";
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="A fresh start."
      description="Choose a password you have not used for this account before."
    >
      <ResetPassword token={token || null} />
    </AuthShell>
  );
}
