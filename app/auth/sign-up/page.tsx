import { redirect } from "next/navigation";
import { AuthEntry } from "@/components/auth/auth-entry";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Crear cuenta" };

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/onboarding");
  return <AuthEntry mode="sign_up" />;
}
