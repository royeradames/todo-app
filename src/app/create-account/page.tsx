import { AuthShell } from "@/components/auth-shell";
import { CreateAccount } from "@/components/create-account";
export default function CreateAccountPage() {
  return (
    <AuthShell
      eyebrow="Make yourself at home"
      title="Your account starts here."
      description="Choose your own sign-in details. You can add more ways to sign in whenever you need them."
    >
      <CreateAccount />
    </AuthShell>
  );
}
