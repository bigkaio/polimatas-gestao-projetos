import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

/** Primeiro acesso de conta criada pelo admin: troca da senha temporária. */
export default async function SetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect("/inicio");

  return <SetPasswordForm name={session.name.split(" ")[0] ?? session.name} />;
}
