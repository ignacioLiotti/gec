"use client";

import * as React from "react";
import { m } from "framer-motion";
import { toast } from "sonner";

import { updateDigitalSignature, updateEmail, updateProfile } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileFormProps = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    full_name: string | null;
    digital_signature_data_url: string | null;
  } | null;
};

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [signatureDataUrl, setSignatureDataUrl] = React.useState(profile?.digital_signature_data_url ?? "");
  const [email, setEmail] = React.useState(user.email ?? "");

  const [isSavingProfile, startSaveProfile] = React.useTransition();
  const [isSavingEmail, startSaveEmail] = React.useTransition();
  const [isSavingSignature, startSaveSignature] = React.useTransition();

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
      toast.error("El email no puede estar vacio.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error("Ingresa un email valido.");
      return;
    }

    startSaveEmail(async () => {
      const result = await updateEmail({ email: trimmed });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Email actualizado. Revisa tu bandeja de entrada para confirmar el cambio.");
      }
    });
  };

  const onSignatureFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("La firma debe ser PNG, JPG o WebP.");
      return;
    }
    if (file.size > 500_000) {
      toast.error("La firma debe pesar menos de 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureDataUrl(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  };

  const onSubmitSignature = (event: React.FormEvent) => {
    event.preventDefault();
    startSaveSignature(async () => {
      const result = await updateDigitalSignature({ signatureDataUrl: signatureDataUrl || null });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Firma digital actualizada");
      }
    });
  };

  return (
    <div className="space-y-6">
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Informacion basica</h2>
            <p className="text-sm text-muted-foreground">
              Estos datos se usan para personalizar tu experiencia en la aplicacion.
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
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.03 }}
      >
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Firma digital</h2>
            <p className="text-sm text-muted-foreground">
              Esta firma se inserta al aprobar documentos generados.
            </p>
          </div>
          <form onSubmit={onSubmitSignature} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="digital_signature">Imagen de firma</Label>
              <Input
                id="digital_signature"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onSignatureFileChange}
              />
            </div>
            {signatureDataUrl ? (
              <div className="rounded-md border border-stone-200 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureDataUrl}
                  alt="Vista previa de firma digital"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-muted-foreground">
                No hay firma configurada.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {signatureDataUrl ? (
                <Button type="button" variant="outline" onClick={() => setSignatureDataUrl("")}>
                  Quitar firma
                </Button>
              ) : null}
              <Button type="submit" disabled={isSavingSignature}>
                {isSavingSignature ? "Guardando..." : "Guardar firma"}
              </Button>
            </div>
          </form>
        </Card>
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Cuenta</h2>
            <p className="text-sm text-muted-foreground">
              Actualiza el email asociado a tu cuenta. Es posible que debas confirmar el cambio desde tu correo.
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
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Este es el email que usas para iniciar sesion.</span>
              <Button type="submit" size="sm" disabled={isSavingEmail}>
                {isSavingEmail ? "Actualizando..." : "Actualizar email"}
              </Button>
            </div>
          </form>
        </Card>
      </m.div>
    </div>
  );
}
