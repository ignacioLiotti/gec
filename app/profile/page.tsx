import { createClient } from "@/utils/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-sm">
        Iniciá sesión para ver y editar tu perfil.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, digital_signature_data_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná la información de tu cuenta y tus datos personales.
        </p>
      </header>
      <ProfileForm
        user={{ id: user.id, email: user.email ?? null }}
        profile={profile}
      />
    </div>
  );
}


