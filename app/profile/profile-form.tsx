"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updateEmail, updatePassword, updateProfile } from "@/app/profile/actions";

type ProfileFormProps = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    full_name: string | null;
  } | null;
};

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [email, setEmail] = React.useState(user.email ?? "");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");

  const [isSavingProfile, startSaveProfile] = React.useTransition();
  const [isSavingEmail, startSaveEmail] = React.useTransition();
  const [isSavingPassword, startSavePassword] = React.useTransition();

  const onSubmitProfile = (event: React.FormEvent) => {
    event.preventDefault();
    startSaveProfile(async () => {
      const result = await updateProfile({ fullName });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Perfil actualizado");
      }
    });
  };

  const onSubmitEmail = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("El email no puede estar vacío.");
      return;
    }
    // Reutilizamos validación simple de email similar al diálogo de invitaciones
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error("Ingresá un email válido.");
      return;
    }

    startSaveEmail(async () => {
      const result = await updateEmail({ email: trimmed });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result.message ??
          "Email actualizado. Revisá tu bandeja de entrada para confirmar el cambio."
        );
      }
    });
  };

  const onSubmitPassword = (event: React.FormEvent) => {
    event.preventDefault();

    if (!password) {
      toast.error("Ingresá una nueva contraseña.");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    startSavePassword(async () => {
      const result = await updatePassword({ password });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Contraseña actualizada");
        setPassword("");
        setPasswordConfirm("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Información básica</h2>
            <p className="text-sm text-muted-foreground">
              Estos datos se usan para personalizar tu experiencia en la
              aplicación.
            </p>
          </div>
          <form onSubmit={onSubmitProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tu nombre y apellido"
                autoComplete="name"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Cuenta</h2>
            <p className="text-sm text-muted-foreground">
              Actualizá el email asociado a tu cuenta. Es posible que debas
              confirmar el cambio desde tu correo.
            </p>
          </div>
          <form onSubmit={onSubmitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="flex justify-between items-center gap-3 text-xs text-muted-foreground">
              <span>Este es el email que usás para iniciar sesión.</span>
              <Button type="submit" size="sm" disabled={isSavingEmail}>
                {isSavingEmail ? "Actualizando..." : "Actualizar email"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Seguridad</h2>
            <p className="text-sm text-muted-foreground">
              Cambiá tu contraseña periódicamente para mantener tu cuenta
              segura.
            </p>
          </div>
          <form onSubmit={onSubmitPassword} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirm">Repetir contraseña</Label>
                <Input
                  id="password_confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={isSavingPassword}
              >
                {isSavingPassword ? "Actualizando..." : "Actualizar contraseña"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}


