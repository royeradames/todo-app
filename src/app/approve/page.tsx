import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Approve } from "@/components/approve";
import { getAuth } from "@/lib/auth-server";
export const dynamic = "force-dynamic";
export default async function ApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;
  const auth = await getAuth();
  if (!(await auth.getPrincipal(await headers())))
    redirect(
      `/login?returnTo=${encodeURIComponent(`/approve?code=${encodeURIComponent(code)}`)}`,
    );
  return (
    <AuthShell
      eyebrow="Another device"
      title="Let the right device in."
      description="Review each request with care. You should have started it yourself and be able to match the code."
    >
      <Approve initialCode={code} />
    </AuthShell>
  );
}
