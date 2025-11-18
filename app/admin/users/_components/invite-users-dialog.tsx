"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { UserPlus, Mail, Loader2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

interface InviteUsersDialogProps {
  tenantId: string;
}

export function InviteUsersDialog({ tenantId }: InviteUsersDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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

    setLoading(true);

    const result = await sendInvitation({
      tenantId,
      email: email.trim(),
      role,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.success && result.token) {
      toast.success(`Invitación enviada a ${email.trim()}`);
      setInviteToken(result.token);
      setEmail("");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setRole("member");
    setInviteToken(null);
  };

  const copyInviteLink = () => {
    if (!inviteToken) return;

    const inviteUrl = `${window.location.origin}/invitations/${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Enlace de invitación copiado al portapapeles");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar Usuarios
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invitar Usuarios a la Organización</DialogTitle>
          <DialogDescription>
            Enviá un enlace de invitación para agregar nuevos miembros a tu organización.
          </DialogDescription>
        </DialogHeader>

        {inviteToken ? (
          // Success state - show invite link
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center py-6">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-link">Enlace de Invitación</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link"
                  value={`${window.location.origin}/invitations/${inviteToken}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copyInviteLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Compartí este enlace con la persona que querés invitar. Expira en 72 horas.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteToken(null)}>
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
                  <Mail className="inline-block mr-2 h-4 w-4" />
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
                <Label htmlFor="role">Rol</Label>
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
                        <span className="font-medium">Miembro</span>
                        <span className="text-xs text-gray-500">Acceso regular a recursos de la organización</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Administrador</span>
                        <span className="text-xs text-gray-500">Puede gestionar usuarios y configuración de la organización</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
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
