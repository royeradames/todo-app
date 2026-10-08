import { AuthShell } from "@/components/auth-shell";
import { Recovery } from "@/components/recovery";
export default function RecoveryPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="A way back in."
      description="A reset link helps you choose a new password. Keep your account email accessible and your backup codes somewhere safe."
    >
      <Recovery />
    </AuthShell>
  );
}
