"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendInvitation } from "@/app/admin/users/invitation-actions";
import { UserPlus, Mail, Loader2, CheckCircle2, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface InviteUsersDialogProps {
  tenantId: string;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  triggerLabel?: string;
  triggerSize?: ButtonProps["size"];
  triggerVariant?: ButtonProps["variant"];
}

export function InviteUsersDialog({
  tenantId,
  roles,
  triggerLabel = "Invitar Usuarios",
  triggerSize,
  triggerVariant,
}: InviteUsersDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [operationalRoleId, setOperationalRoleId] = useState(
    () => roles[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Por favor ingresá un correo electrónico");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Por favor ingresá un correo electrónico válido");
      return;
    }

    if (role === "member" && roles.length > 0 && !operationalRoleId) {
      toast.error("Elegí el trabajo principal que realizará la persona");
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvitation({
        tenantId,
        email: email.trim(),
        role,
        operationalRoleId: role === "member" ? operationalRoleId || null : null,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.inviteLink) {
        setEmailDelivered(result.emailSent === true);
        if (result.emailSent === true) {
          toast.success(`Invitación enviada a ${email.trim()}`);
        } else {
          toast.warning("La invitación fue creada, pero el correo no pudo enviarse. Copiá el enlace para compartirlo.");
        }
        setInviteLink(result.inviteLink);
        setEmail("");
      }
    } catch {
      toast.error("No pudimos crear la invitación. Volvé a intentarlo.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setRole("member");
    setOperationalRoleId(roles[0]?.id ?? "");
    setInviteLink(null);
    setEmailDelivered(null);
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Enlace de invitación copiado");
    } catch {
      toast.error("No pudimos copiar el enlace. Seleccionalo y copialo manualmente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          size={triggerSize}
          variant={triggerVariant}
        >
          <UserPlus className="mr-2 size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invitar Usuarios a la Organización</DialogTitle>
          <DialogDescription>
            Enviá un enlace de invitación para agregar nuevos miembros a tu organización.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          // Success state - show invite link
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center py-6">
              <div className={emailDelivered === false ? "rounded-full bg-warning/15 p-3" : "rounded-full bg-success/10 p-3"}>
                {emailDelivered === false ? (
                  <AlertTriangle className="size-10 text-warning-foreground" />
                ) : (
                  <CheckCircle2 className="size-10 text-success" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              {emailDelivered === false && (
                <div className="flex gap-3 rounded-lg border border-warning/35 bg-warning/15 p-3 text-sm text-warning-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>El correo no salió. El enlace sigue siendo válido y podés compartirlo por otro medio.</p>
                </div>
              )}
              <Label htmlFor="invite-link">Enlace de Invitación</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link"
                  value={inviteLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copyInviteLink} aria-label="Copiar enlace de invitación">
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-sm text-stone-500">
                Compartí este enlace con la persona que querés invitar. Expira en 72 horas.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteLink(null)}>
                Invitar Otro
              </Button>
              <Button type="button" onClick={handleClose}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Form state - enter email and role
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="inline-block mr-2 size-4" />
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Nivel de acceso</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as "member" | "admin")}
                  disabled={loading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Seleccioná un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Trabajo diario</span>
                        <span className="text-xs text-content-muted">Usa las herramientas según su tarea asignada</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Administrador</span>
                        <span className="text-xs text-stone-500">Puede gestionar usuarios y configuración de la organización</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === "member" && roles.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="operational-role">Trabajo que realizará</Label>
                  <Select
                    value={operationalRoleId}
                    onValueChange={setOperationalRoleId}
                    disabled={loading}
                  >
                    <SelectTrigger id="operational-role">
                      <SelectValue placeholder="Elegí una tarea principal" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((operationalRole) => (
                        <SelectItem key={operationalRole.id} value={operationalRole.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{operationalRole.name}</span>
                            {operationalRole.description ? (
                              <span className="text-xs text-content-muted">
                                {operationalRole.description}
                              </span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-content-muted">
                    Esto deja sus pantallas y permisos listos desde el primer ingreso.
                  </p>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enviando&hellip;
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 size-4" />
                    Enviar Invitación
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
