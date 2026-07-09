"use client";

import * as React from "react";
import {
	Ban,
	Building2,
	CalendarClock,
	Check,
	ChevronRight,
	Crown,
	KeyRound,
	Loader2,
	LockKeyhole,
	Mail,
	Minus,
	Plus,
	RotateCcw,
	Search,
	ShieldCheck,
	Sparkles,
	UserCog,
	UserRound,
	Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { UserManagementNav } from "../_components/user-management-nav";
import { InviteUsersDialog } from "./_components/invite-users-dialog";

type MembershipRole = "owner" | "admin" | "member";
type OverrideState = "inherit" | "grant" | "deny";
type UserFilter = "all" | MembershipRole | "with_roles" | "overrides";

type UserCardData = {
	user_id: string;
	full_name: string | null;
	email: string | null;
	membership_role: string;
	assigned_role_ids: string[];
	override_count: number;
	denied_override_count: number;
	created_at: string | null;
	last_sign_in_at: string | null;
};

type RoleOption = {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
};

type PermissionOption = {
	id: string;
	key: string;
	description: string | null;
	category: string | null;
	display_name: string | null;
	sort_order: number | null;
};

type PermissionSources = {
	roleGrants: { roleId: string; permissionId: string }[];
	roleDenials: { roleId: string; permissionId: string }[];
	overrideIds: string[];
	deniedOverrideIds: string[];
	isAdmin: boolean;
};

type UserAccessState = {
	roleIds: string[];
	sources: PermissionSources;
};

const USER_CLOUD_PALETTES = [
	{
		name: "lake",
		light: "#9be7ff",
		mid: "#4a8cff",
		deep: "#1d3f8f",
		accent: "#64d6bf",
	},
	{
		name: "sage",
		light: "#b7f2c5",
		mid: "#35b979",
		deep: "#116044",
		accent: "#7edfd6",
	},
	{
		name: "orchid",
		light: "#d8b4fe",
		mid: "#8b5cf6",
		deep: "#43308a",
		accent: "#f0a7c4",
	},
	{
		name: "coral",
		light: "#ffc9a8",
		mid: "#ff7a59",
		deep: "#8f2f32",
		accent: "#f5b45c",
	},
	{
		name: "aqua",
		light: "#a8fff3",
		mid: "#24b8c8",
		deep: "#0b5266",
		accent: "#75d686",
	},
	{
		name: "berry",
		light: "#ffb8d2",
		mid: "#d9468f",
		deep: "#73255f",
		accent: "#c7a4ff",
	},
	{
		name: "amber",
		light: "#ffe3a3",
		mid: "#e9a93a",
		deep: "#7a4618",
		accent: "#f58b6a",
	},
] as const;

type UsersPageClientProps = {
	users: UserCardData[];
	tenantId: string;
	allRoles: RoleOption[];
	allPermissions: PermissionOption[];
	canImpersonate: boolean;
	canManageUsers: boolean;
};

const MEMBERSHIP_LABELS: Record<MembershipRole, string> = {
	owner: "Propietario",
	admin: "Administrador",
	member: "Miembro",
};

const USER_STATUS_LABELS = {
	active: "Activo",
	pending: "Pendiente",
} as const;

const CATEGORY_LABELS: Record<string, string> = {
	admin: "Administracion",
	certificados: "Certificados",
	"data-flow": "Data-flow",
	documents: "Documentos",
	"document-ai": "Document AI",
	macro: "Macro",
	navigation: "Navegacion",
	obras: "Obras",
};

function toMembershipRole(value: string | null | undefined): MembershipRole {
	return value === "owner" || value === "admin" || value === "member"
		? value
		: "member";
}

function getUserLabel(user: Pick<UserCardData, "full_name" | "email" | "user_id">) {
	return user.full_name ?? user.email ?? user.user_id;
}

function getInitials(user: Pick<UserCardData, "full_name" | "email" | "user_id">) {
	const label = getUserLabel(user);
	const parts = label
		.replace(/@.*/, "")
		.split(/\s|[._-]/)
		.filter(Boolean);
	const initials = parts.slice(0, 2).map((part) => part[0]).join("");
	return (initials || label.slice(0, 2)).toUpperCase();
}

function hashString(value: string) {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

function getUserCloudTheme(seed: string): {
	frame: React.CSSProperties;
	core: React.CSSProperties;
	glow: React.CSSProperties;
} {
	const hash = hashString(seed);
	const palette = USER_CLOUD_PALETTES[hash % USER_CLOUD_PALETTES.length];

	return {
		frame: {
			background: [
				`linear-gradient(145deg, ${palette.light}, ${palette.mid} 52%, ${palette.deep})`,
				"linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.08))",
			].join(", "),
		},
		core: {
			background: [
				`radial-gradient(circle at 30% 22%, ${palette.light} 0 26%, transparent 38%)`,
				`radial-gradient(circle at 72% 36%, ${palette.accent} 0 20%, transparent 33%)`,
				`radial-gradient(circle at 62% 78%, ${palette.mid} 0 30%, transparent 44%)`,
				`linear-gradient(145deg, ${palette.mid} 0%, ${palette.deep} 100%)`,
			].join(", "),
			color: "white",
			textShadow: "0 1px 2px rgba(0,0,0,0.3)",
		},
		glow: {
			background: `linear-gradient(135deg, ${palette.light}, ${palette.mid})`,
			opacity: 0.28,
		},
	};
}

function categoryLabel(category: string | null) {
	const key = category ?? "general";
	return CATEGORY_LABELS[key] ?? key.replace(/[-_]/g, " ");
}

function permissionLabel(permission: PermissionOption) {
	return permission.display_name ?? permission.key;
}

function getUserHandle(user: Pick<UserCardData, "full_name" | "email" | "user_id">) {
	const source = user.email ?? user.full_name ?? user.user_id;
	const handle = source
		.replace(/@.*/, "")
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, ".");
	return `@${handle || user.user_id.slice(0, 8)}`;
}

function getUserStatus(user: Pick<UserCardData, "last_sign_in_at">) {
	return user.last_sign_in_at ? "active" : "pending";
}

function getPrimaryRoleLabel(
	user: Pick<UserCardData, "assigned_role_ids" | "membership_role">,
	rolesById: Map<string, RoleOption>,
) {
	const firstAssignedRole = user.assigned_role_ids
		.map((roleId) => rolesById.get(roleId))
		.find(Boolean);

	return (
		firstAssignedRole?.name ??
		MEMBERSHIP_LABELS[toMembershipRole(user.membership_role)]
	);
}

function formatDate(value: string | null) {
	if (!value) return "Sin registro";
	return new Intl.DateTimeFormat("es-AR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function formatActivity(value: string | null) {
	if (!value) return "Sin ingreso";
	return formatDate(value);
}

function shortId(value: string) {
	return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

async function loadUserAccess(
	tenantId: string,
	userId: string,
): Promise<UserAccessState> {
	const mod = await import("../roles/server-actions");
	const [roleRows, sources] = await Promise.all([
		mod.listUserRoles({ userId }),
		mod.userPermissionSources({ tenantId, userId }),
	]);

	return {
		roleIds: roleRows.map((role) => role.role_id),
		sources,
	};
}

function UserColorCloud({
	user,
	size = "default",
}: {
	user: Pick<UserCardData, "user_id" | "full_name" | "email">;
	size?: "default" | "large";
}) {
	const theme = getUserCloudTheme(
		user.user_id || user.email || getUserLabel(user),
	);

	return (
		<div
			className={cn(
				"relative shrink-0 rounded-full p-[2px] shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_10px_24px_-16px_rgba(0,0,0,0.62)]",
				size === "large" ? "size-16" : "size-11",
			)}
			style={theme.frame}
		>
			<div
				className="absolute inset-0 rounded-full blur-[3px]"
				style={theme.glow}
			/>
			<div
				className={cn(
					"relative grid size-full place-items-center overflow-hidden rounded-full font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.44),inset_0_-10px_18px_rgba(0,0,0,0.18)]",
					size === "large" ? "text-lg" : "text-sm",
				)}
				style={theme.core}
			>
				<span className="pointer-events-none absolute inset-x-[18%] top-[10%] h-[24%] rounded-full bg-white/38 blur-[3px]" />
				<span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/35" />
				<span className="relative tracking-[0.02em]">{getInitials(user)}</span>
			</div>
		</div>
	);
}

export function UsersPageClient({
	users,
	tenantId,
	allRoles,
	allPermissions,
	canImpersonate,
	canManageUsers,
}: UsersPageClientProps) {
	const [usersState, setUsersState] = React.useState<UserCardData[]>(users);
	const [query, setQuery] = React.useState("");
	const [userFilter, setUserFilter] = React.useState<UserFilter>("all");
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [activeUserId, setActiveUserId] = React.useState<string | null>(
		() => users[0]?.user_id ?? null,
	);
	const [activeAccess, setActiveAccess] = React.useState<UserAccessState | null>(
		null,
	);
	const [selectedOrgRoleDraft, setSelectedOrgRoleDraft] = React.useState<{
		userId: string;
		role: MembershipRole;
	} | null>(null);
	const [loadingAccess, setLoadingAccess] = React.useState(false);
	const [savingKey, setSavingKey] = React.useState<string | null>(null);
	const [batchRoleId, setBatchRoleId] = React.useState("");
	const [batchPermissionId, setBatchPermissionId] = React.useState("");

	const rolesById = React.useMemo(
		() => new Map(allRoles.map((role) => [role.id, role])),
		[allRoles],
	);

	const permissionsByCategory = React.useMemo(() => {
		const groups = new Map<string, PermissionOption[]>();
		for (const permission of allPermissions) {
			const category = permission.category ?? "general";
			const current = groups.get(category) ?? [];
			current.push(permission);
			groups.set(category, current);
		}

		return Array.from(groups.entries()).map(([category, permissions]) => ({
			category,
			permissions: permissions.sort((left, right) => {
				const leftOrder = left.sort_order ?? 0;
				const rightOrder = right.sort_order ?? 0;
				return leftOrder === rightOrder
					? left.key.localeCompare(right.key)
					: leftOrder - rightOrder;
			}),
		}));
	}, [allPermissions]);

	const activeUser = React.useMemo(
		() => usersState.find((user) => user.user_id === activeUserId) ?? null,
		[activeUserId, usersState],
	);

	const selectedOrgRole =
		activeUser && selectedOrgRoleDraft?.userId === activeUser.user_id
			? selectedOrgRoleDraft.role
			: toMembershipRole(activeUser?.membership_role);

	const handleSelectedOrgRoleChange = React.useCallback(
		(role: MembershipRole) => {
			if (!activeUser) return;
			setSelectedOrgRoleDraft({ userId: activeUser.user_id, role });
		},
		[activeUser],
	);

	React.useEffect(() => {
		if (!activeUserId) {
			return;
		}
		const userId = activeUserId;

		let cancelled = false;
		async function loadActiveAccess() {
			setLoadingAccess(true);
			try {
				const access = await loadUserAccess(tenantId, userId);
				if (!cancelled) setActiveAccess(access);
			} catch (error) {
				if (!cancelled) {
					toast.error(getErrorMessage(error, "No se pudo cargar el usuario"));
				}
			} finally {
				if (!cancelled) setLoadingAccess(false);
			}
		}

		void loadActiveAccess();

		return () => {
			cancelled = true;
		};
	}, [activeUserId, tenantId]);

	const filteredUsers = React.useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return usersState.filter((user) => {
			if (
				userFilter !== "all" &&
				userFilter !== "with_roles" &&
				userFilter !== "overrides" &&
				toMembershipRole(user.membership_role) !== userFilter
			) {
				return false;
			}
			if (userFilter === "with_roles" && user.assigned_role_ids.length === 0) {
				return false;
			}
			if (
				userFilter === "overrides" &&
				user.override_count + user.denied_override_count === 0
			) {
				return false;
			}
			if (!normalizedQuery) return true;

			const roleNames = user.assigned_role_ids
				.map((roleId) => rolesById.get(roleId)?.name ?? "")
				.join(" ");
			const haystack = [
				user.full_name,
				user.email,
				user.user_id,
				user.membership_role,
				roleNames,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(normalizedQuery);
		});
	}, [query, rolesById, userFilter, usersState]);

	const selectedUsers = React.useMemo(
		() => usersState.filter((user) => selectedIds.has(user.user_id)),
		[selectedIds, usersState],
	);
	const visibleSelected =
		filteredUsers.length > 0 &&
		filteredUsers.every((user) => selectedIds.has(user.user_id));

	const refreshAccessForUsers = React.useCallback(
		async (userIds: string[]) => {
			const uniqueUserIds = Array.from(new Set(userIds));
			const updates = await Promise.all(
				uniqueUserIds.map(async (userId) => ({
					userId,
					access: await loadUserAccess(tenantId, userId),
				})),
			);
			const updateMap = new Map(updates.map((update) => [update.userId, update.access]));

			setUsersState((currentUsers) =>
				currentUsers.map((user) => {
					const access = updateMap.get(user.user_id);
					if (!access) return user;
					return {
						...user,
						assigned_role_ids: access.roleIds,
						override_count: access.sources.overrideIds.length,
						denied_override_count: access.sources.deniedOverrideIds.length,
					};
				}),
			);

			if (activeUserId && updateMap.has(activeUserId)) {
				setActiveAccess(updateMap.get(activeUserId) ?? null);
			}
		},
		[activeUserId, tenantId],
	);

	function toggleSelected(userId: string) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(userId)) {
				next.delete(userId);
			} else {
				next.add(userId);
			}
			return next;
		});
	}

	function toggleVisibleSelection() {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (visibleSelected) {
				for (const user of filteredUsers) next.delete(user.user_id);
			} else {
				for (const user of filteredUsers) next.add(user.user_id);
			}
			return next;
		});
	}

	async function setUserRole(userId: string, roleId: string, shouldAssign: boolean) {
		setSavingKey(`role:${userId}:${roleId}`);
		try {
			const mod = await import("../roles/server-actions");
			if (shouldAssign) {
				await mod.assignUserRole({ userId, roleId });
			} else {
				await mod.revokeUserRole({ userId, roleId });
			}
			await refreshAccessForUsers([userId]);
			toast.success(shouldAssign ? "Rol asignado" : "Rol quitado");
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudo actualizar el rol"));
		} finally {
			setSavingKey(null);
		}
	}

	async function applyBatchRole(shouldAssign: boolean) {
		if (!batchRoleId || selectedUsers.length === 0) return;
		setSavingKey(shouldAssign ? "batch-role-assign" : "batch-role-revoke");
		try {
			const mod = await import("../roles/server-actions");
			for (const user of selectedUsers) {
				const hasRole = user.assigned_role_ids.includes(batchRoleId);
				if (shouldAssign && !hasRole) {
					await mod.assignUserRole({ userId: user.user_id, roleId: batchRoleId });
				}
				if (!shouldAssign && hasRole) {
					await mod.revokeUserRole({ userId: user.user_id, roleId: batchRoleId });
				}
			}
			await refreshAccessForUsers(selectedUsers.map((user) => user.user_id));
			toast.success("Roles actualizados");
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudieron actualizar los roles"));
		} finally {
			setSavingKey(null);
		}
	}

	async function setPermissionOverride(
		userId: string,
		permissionId: string,
		state: OverrideState,
	) {
		if (!permissionId) return;
		setSavingKey(`permission:${userId}:${permissionId}`);
		try {
			const mod = await import("../roles/server-actions");
			if (state === "inherit") {
				await mod.removeUserOverride({ userId, permissionId });
			} else {
				await mod.setUserOverride({
					userId,
					permissionId,
					isGranted: state === "grant",
				});
			}
			await refreshAccessForUsers([userId]);
			toast.success("Permiso actualizado");
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudo actualizar el permiso"));
		} finally {
			setSavingKey(null);
		}
	}

	async function applyBatchPermission(state: OverrideState) {
		if (!batchPermissionId || selectedUsers.length === 0) return;
		setSavingKey(`batch-permission:${state}`);
		try {
			const mod = await import("../roles/server-actions");
			for (const user of selectedUsers) {
				if (state === "inherit") {
					await mod.removeUserOverride({
						userId: user.user_id,
						permissionId: batchPermissionId,
					});
				} else {
					await mod.setUserOverride({
						userId: user.user_id,
						permissionId: batchPermissionId,
						isGranted: state === "grant",
					});
				}
			}
			await refreshAccessForUsers(selectedUsers.map((user) => user.user_id));
			toast.success("Permisos directos actualizados");
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudieron actualizar los permisos"));
		} finally {
			setSavingKey(null);
		}
	}

	async function updateMembershipRole() {
		if (!activeUser) return;
		setSavingKey("membership");
		try {
			const mod = await import("../roles/server-actions");
			await mod.updateMembershipRole({
				tenantId,
				userId: activeUser.user_id,
				role: selectedOrgRole,
			});
			setUsersState((currentUsers) =>
				currentUsers.map((user) =>
					user.user_id === activeUser.user_id
						? { ...user, membership_role: selectedOrgRole }
						: user,
				),
			);
			setSelectedOrgRoleDraft(null);
			await refreshAccessForUsers([activeUser.user_id]);
			toast.success("Rol de organizacion actualizado");
		} catch (error) {
			toast.error(
				getErrorMessage(error, "No se pudo actualizar el rol de organizacion"),
			);
		} finally {
			setSavingKey(null);
		}
	}

	async function setAllOverrides(userId: string, state: OverrideState) {
		setSavingKey(`all-overrides:${state}`);
		try {
			const mod = await import("../roles/server-actions");
			if (state === "inherit") {
				await mod.clearUserOverrides({ userId });
			} else {
				await mod.setAllUserOverrides({
					userId,
					isGranted: state === "grant",
				});
			}
			await refreshAccessForUsers([userId]);
			toast.success("Permisos directos actualizados");
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudieron actualizar permisos"));
		} finally {
			setSavingKey(null);
		}
	}

	async function startImpersonation(userId: string) {
		setSavingKey(`impersonate:${userId}`);
		try {
			const formData = new FormData();
			formData.set("user_id", userId);
			const response = await fetch(
				new URL("/api/impersonate/start", window.location.origin),
				{
					method: "POST",
					body: formData,
					credentials: "same-origin",
					cache: "no-store",
				},
			);

			if (!response.ok) {
				const payload = await response.json().catch(async () => ({
					error: await response.text().catch(() => ""),
				}));
				const message =
					typeof payload.error === "string" && payload.error.trim()
						? payload.error
						: `No se pudo suplantar usuario (${response.status})`;
				throw new Error(message);
			}

			window.location.reload();
		} catch (error) {
			toast.error(getErrorMessage(error, "No se pudo suplantar usuario"));
			setSavingKey(null);
		}
	}

	return (
		<div className="space-y-5">
			<header className="space-y-5">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
					<div className="min-w-0 space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight text-content">
							Usuarios
						</h1>
						<p className="max-w-2xl text-sm leading-6 text-content-secondary">
							Invitá personas, asigná responsabilidades y revisá accesos desde un solo lugar.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant="success"
							shape="pill"
							className="h-8 px-3"
							leadingIcon={<ShieldCheck className="size-3.5" />}
						>
							Administrador
						</Badge>
						{canImpersonate ? (
							<Badge
								variant="outline"
								shape="pill"
								className="h-8 px-3"
								leadingIcon={<Crown className="size-3.5" />}
							>
								Superadministrador
							</Badge>
						) : null}
						{canManageUsers ? (
							<InviteUsersDialog
								tenantId={tenantId}
								triggerLabel="Invitar persona"
								triggerSize="sm"
								triggerVariant="dark"
							/>
						) : null}
					</div>
				</div>

				<UserManagementNav active="users" />

				<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
					<div className="relative w-full lg:max-w-[28rem]">
						<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-content-muted" />
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.currentTarget.value)}
							placeholder="Buscar por nombre, rol o correo"
							className="h-11 pl-10"
						/>
					</div>
					<Select
						value={userFilter}
						onValueChange={(value) => setUserFilter(value as UserFilter)}
					>
						<SelectTrigger className="h-11 w-full lg:w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value="all">Todas las personas</SelectItem>
							<SelectItem value="owner">Propietarios</SelectItem>
							<SelectItem value="admin">Administradores</SelectItem>
							<SelectItem value="member">Miembros</SelectItem>
							<SelectItem value="with_roles">Con roles asignados</SelectItem>
							<SelectItem value="overrides">Con permisos especiales</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</header>

			<section className="rounded-lg border border-stroke-soft bg-surface px-4 py-3 shadow-card">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0">
						<p className="text-sm font-semibold text-content">
							{selectedUsers.length} seleccionadas
						</p>
						<p className="text-sm text-content-secondary">
							{selectedUsers.length > 0
								? "Los cambios se aplicarán a todas las personas seleccionadas."
								: "Seleccioná personas para realizar una acción conjunta."}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Select
							disabled={allRoles.length === 0}
							value={batchRoleId || "none"}
							onValueChange={(value) =>
								setBatchRoleId(value === "none" ? "" : value)
							}
						>
							<SelectTrigger size="sm" className="w-full sm:w-40">
								<SelectValue placeholder="Rol" />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="none">Elegir rol</SelectItem>
								{allRoles.map((role) => (
									<SelectItem key={role.id} value={role.id}>
										{role.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								!batchRoleId || selectedUsers.length === 0 || Boolean(savingKey)
							}
							onClick={() => applyBatchRole(true)}
						>
							<UserRound className="size-4" />
							Asignar rol
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								!batchRoleId || selectedUsers.length === 0 || Boolean(savingKey)
							}
							onClick={() => applyBatchRole(false)}
						>
							<Minus className="size-4" />
							Quitar rol
						</Button>
						<Select
							disabled={allPermissions.length === 0}
							value={batchPermissionId || "none"}
							onValueChange={(value) =>
								setBatchPermissionId(value === "none" ? "" : value)
							}
						>
							<SelectTrigger size="sm" className="w-full sm:w-48">
								<SelectValue placeholder="Permiso" />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="none">Elegir permiso</SelectItem>
								{allPermissions.map((permission) => (
									<SelectItem key={permission.id} value={permission.id}>
										{permissionLabel(permission)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="dark"
							size="sm"
							disabled={
								!batchPermissionId ||
								selectedUsers.length === 0 ||
								Boolean(savingKey)
							}
							onClick={() => applyBatchPermission("grant")}
						>
							<Check className="size-4" />
							Permitir
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								!batchPermissionId ||
								selectedUsers.length === 0 ||
								Boolean(savingKey)
							}
							onClick={() => applyBatchPermission("inherit")}
						>
							<LockKeyhole className="size-4" />
							Usar valor del rol
						</Button>
					</div>
				</div>
			</section>

			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
				<section className="space-y-3">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold text-content">Personas</h2>
							<p className="text-sm text-content-secondary">
								{filteredUsers.length} resultados
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="h-7 px-3" count={usersState.length}>
								En total
							</Badge>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={toggleVisibleSelection}
								disabled={filteredUsers.length === 0}
							>
								{visibleSelected ? (
									<Minus className="size-4" />
								) : (
									<Check className="size-4" />
								)}
							{visibleSelected ? "Quitar selección" : "Seleccionar visibles"}
							</Button>
						</div>
					</div>

					{filteredUsers.length === 0 ? (
						<div className="rounded-lg border border-dashed border-stroke bg-surface px-6 py-16 text-center text-sm text-content-muted">
							No encontramos personas con esos filtros.
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{filteredUsers.map((user) => (
								<UserCard
									key={user.user_id}
									user={user}
									rolesById={rolesById}
									selected={selectedIds.has(user.user_id)}
									active={activeUserId === user.user_id}
									onSelect={() => toggleSelected(user.user_id)}
									onOpen={() => setActiveUserId(user.user_id)}
								/>
							))}
						</div>
					)}
				</section>

				<UserDetailPanel
					user={activeUser}
					allRoles={allRoles}
					allPermissions={allPermissions}
					permissionsByCategory={permissionsByCategory}
					activeAccess={activeAccess}
					loadingAccess={loadingAccess}
					selectedOrgRole={selectedOrgRole}
					savingKey={savingKey}
					canImpersonate={canImpersonate}
					onSelectedOrgRoleChange={handleSelectedOrgRoleChange}
					onUpdateMembershipRole={updateMembershipRole}
					onSetUserRole={setUserRole}
					onSetPermissionOverride={setPermissionOverride}
					onSetAllOverrides={setAllOverrides}
					onStartImpersonation={startImpersonation}
				/>
			</div>
		</div>
	);
}

function UserCard({
	user,
	rolesById,
	selected,
	active,
	onSelect,
	onOpen,
}: {
	user: UserCardData;
	rolesById: Map<string, RoleOption>;
	selected: boolean;
	active: boolean;
	onSelect: () => void;
	onOpen: () => void;
}) {
	const membershipRole = toMembershipRole(user.membership_role);
	const status = getUserStatus(user);
	const assignedRoles = user.assigned_role_ids
		.map((roleId) => rolesById.get(roleId))
		.filter((role): role is RoleOption => Boolean(role));
	const primaryRole = getPrimaryRoleLabel(user, rolesById);

	return (
		<article
			role="button"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onOpen();
				}
			}}
			className={cn(
				"group min-h-[13.75rem] cursor-pointer rounded-lg border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-stroke hover:shadow-raised-hover focus:outline-none focus:ring-2 focus:ring-orange-primary/20",
				active && "border-stroke-strong ring-2 ring-stroke-soft",
				selected && "border-orange-primary ring-2 ring-orange-primary/15",
				!active && !selected && "border-stroke-soft",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<UserColorCloud user={user} />
					<div className="min-w-0">
						<h2 className="truncate text-sm font-semibold text-content">
							{getUserLabel(user)}
						</h2>
						<p className="mt-1 truncate text-xs text-content-secondary">
							{getUserHandle(user)}
						</p>
					</div>
				</div>
				<Checkbox
					checked={selected}
					onClick={(event) => event.stopPropagation()}
					onCheckedChange={() => onSelect()}
					aria-label={selected ? "Quitar de la selección" : "Seleccionar persona"}
					className="mt-1"
				/>
			</div>

			<div className="mt-4 flex flex-wrap gap-2">
				<Badge
					variant={membershipRole === "member" ? "outline" : "info"}
					leadingIcon={<ShieldCheck className="size-3" />}
				>
					{MEMBERSHIP_LABELS[membershipRole]}
				</Badge>
				<Badge
					variant={status === "active" ? "success" : "warning"}
					dot
				>
					{USER_STATUS_LABELS[status]}
				</Badge>
			</div>

			<div className="mt-4 space-y-2 text-sm text-content-secondary">
				<div className="flex min-w-0 items-center gap-2">
					<Mail className="size-4 shrink-0 text-content-muted" />
					<span className="truncate">{user.email ?? user.user_id}</span>
				</div>
				<div className="flex items-center justify-between gap-3">
					<span className="min-w-0 truncate">{primaryRole}</span>
					<span className="shrink-0 text-xs">{formatActivity(user.last_sign_in_at)}</span>
				</div>
			</div>

			<div className="mt-4 flex min-h-7 flex-wrap items-center gap-1.5">
				{assignedRoles.slice(0, 2).map((role) => (
					<span
						key={role.id}
						className="inline-flex max-w-full items-center gap-1 rounded-md border border-stroke-soft bg-surface px-2 py-1 text-[11px] font-medium text-content-secondary"
					>
						<span
							className="size-2 rounded-full"
							style={{ backgroundColor: role.color ?? "rgb(120 113 108)" }}
						/>
						<span className="truncate">{role.name}</span>
					</span>
				))}
				{assignedRoles.length > 2 ? (
					<span className="rounded-md border border-stroke-soft bg-surface px-2 py-1 text-[11px] font-medium text-content-muted">
						Y {assignedRoles.length - 2} más
					</span>
				) : null}
			</div>

			<div className="mt-4 flex items-center justify-between border-t border-stroke-soft pt-3">
				<div className="flex items-center gap-2 text-xs text-content-muted">
					<span>{user.override_count} permisos directos</span>
					<span className="size-1 rounded-full bg-stroke" />
					<span>{user.denied_override_count} bloqueados</span>
				</div>
				<ChevronRight className="size-4 text-content-muted transition group-hover:translate-x-0.5 group-hover:text-content" />
			</div>
		</article>
	);
}

function isPermissionEffective(permissionId: string, sources: PermissionSources) {
	const roleGrantSet = new Set(
		sources.roleGrants.map((grant) => grant.permissionId),
	);
	const roleDenySet = new Set(
		sources.roleDenials.map((deny) => deny.permissionId),
	);
	const overrideSet = new Set(sources.overrideIds);
	const deniedOverrideSet = new Set(sources.deniedOverrideIds);

	return (
		sources.isAdmin ||
		(!deniedOverrideSet.has(permissionId) &&
			(overrideSet.has(permissionId) ||
				(roleGrantSet.has(permissionId) && !roleDenySet.has(permissionId))))
	);
}

function UserDetailPanel({
	user,
	allRoles,
	allPermissions,
	permissionsByCategory,
	activeAccess,
	loadingAccess,
	selectedOrgRole,
	savingKey,
	canImpersonate,
	onSelectedOrgRoleChange,
	onUpdateMembershipRole,
	onSetUserRole,
	onSetPermissionOverride,
	onSetAllOverrides,
	onStartImpersonation,
}: {
	user: UserCardData | null;
	allRoles: RoleOption[];
	allPermissions: PermissionOption[];
	permissionsByCategory: { category: string; permissions: PermissionOption[] }[];
	activeAccess: UserAccessState | null;
	loadingAccess: boolean;
	selectedOrgRole: MembershipRole;
	savingKey: string | null;
	canImpersonate: boolean;
	onSelectedOrgRoleChange: (role: MembershipRole) => void;
	onUpdateMembershipRole: () => void;
	onSetUserRole: (
		userId: string,
		roleId: string,
		shouldAssign: boolean,
	) => void;
	onSetPermissionOverride: (
		userId: string,
		permissionId: string,
		state: OverrideState,
	) => void;
	onSetAllOverrides: (userId: string, state: OverrideState) => void;
	onStartImpersonation: (userId: string) => void;
}) {
	if (!user) {
		return (
			<aside className="sticky top-4 grid min-h-[26rem] place-items-center rounded-lg border border-stroke-soft bg-surface p-6 text-center shadow-card">
				<div className="max-w-64 space-y-3">
					<div className="mx-auto grid size-14 place-items-center rounded-lg border border-stroke-soft bg-surface-recessed text-content-muted">
						<Users className="size-6" />
					</div>
					<div>
						<h2 className="text-base font-semibold text-content">
							Ninguna persona seleccionada
						</h2>
						<p className="mt-1 text-sm leading-6 text-content-secondary">
							Elegí una persona de la lista para revisar sus roles y permisos.
						</p>
					</div>
				</div>
			</aside>
		);
	}

	const membershipRole = toMembershipRole(user.membership_role);
	const status = getUserStatus(user);
	const roleCount = activeAccess?.roleIds.length ?? user.assigned_role_ids.length;
	const permissionCount = activeAccess
		? allPermissions.filter((permission) =>
				isPermissionEffective(permission.id, activeAccess.sources),
			).length
		: user.override_count;

	return (
		<aside className="sticky top-4 h-fit max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border border-stroke-soft bg-surface shadow-card">
			<div className="border-b border-stroke-soft px-5 py-5">
				<div className="flex items-start gap-4">
					<UserColorCloud user={user} size="large" />
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-lg font-semibold text-content">
							{getUserLabel(user)}
						</h2>
						<p className="mt-1 truncate text-sm text-content-secondary">
							{user.email ?? user.user_id}
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<Badge
								variant={membershipRole === "member" ? "outline" : "info"}
							>
								{MEMBERSHIP_LABELS[membershipRole]}
							</Badge>
							<Badge
								variant={status === "active" ? "success" : "warning"}
								dot
							>
								{USER_STATUS_LABELS[status]}
							</Badge>
						</div>
					</div>
				</div>
			</div>

			<div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
					<ProfileDatum
					label="Roles"
					value={`${roleCount} asignados`}
						icon={<Building2 className="size-4" />}
					/>
					<ProfileDatum
					label="Último ingreso"
						value={formatActivity(user.last_sign_in_at)}
						icon={<CalendarClock className="size-4" />}
					/>
					<ProfileDatum
					label="Permisos"
					value={`${permissionCount} habilitados`}
						icon={<KeyRound className="size-4" />}
					/>
					<ProfileDatum
					label="Identificador"
						value={shortId(user.user_id)}
						mono
						icon={<UserRound className="size-4" />}
					/>
				</div>

				<section className="mt-5 space-y-2">
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-sm font-semibold text-content">Rol en la organización</h3>
						{loadingAccess ? (
							<Loader2 className="size-4 animate-spin text-content-muted" />
						) : null}
					</div>
					<div className="flex gap-2">
						<Select
							value={selectedOrgRole}
							onValueChange={(value) =>
								onSelectedOrgRoleChange(toMembershipRole(value))
							}
						>
							<SelectTrigger className="h-10 flex-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
							<SelectItem value="owner">Propietario</SelectItem>
							<SelectItem value="admin">Administrador</SelectItem>
							<SelectItem value="member">Miembro</SelectItem>
							</SelectContent>
						</Select>
						<Button
							type="button"
							size="sm"
							disabled={savingKey === "membership"}
							onClick={onUpdateMembershipRole}
						>
							{savingKey === "membership" ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Check className="size-4" />
							)}
						Guardar
						</Button>
					</div>
				</section>

				<section className="mt-5 space-y-3">
					<div>
						<h3 className="text-sm font-semibold text-content">Responsabilidades</h3>
						<p className="mt-1 text-xs text-content-secondary">
							Elegí qué tipo de trabajo puede realizar esta persona.
						</p>
					</div>
					{allRoles.length === 0 ? (
						<div className="rounded-lg border border-dashed border-stroke bg-surface-recessed px-4 py-6 text-center text-sm text-content-muted">
							Todavía no hay roles configurados.
						</div>
					) : (
						<div className="grid gap-2">
							{allRoles.map((role) => {
								const assigned = activeAccess
									? activeAccess.roleIds.includes(role.id)
									: user.assigned_role_ids.includes(role.id);
								const isSaving =
									savingKey === `role:${user.user_id}:${role.id}`;
								return (
									<button
										key={role.id}
										type="button"
										disabled={Boolean(savingKey) && !isSaving}
										onClick={() =>
											onSetUserRole(user.user_id, role.id, !assigned)
										}
										className={cn(
											"flex min-h-14 items-start gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-stroke disabled:opacity-60",
											assigned
												? "border-stroke-strong"
												: "border-stroke-soft",
										)}
									>
										<span
											className="mt-1 size-3 shrink-0 rounded-full"
											style={{
												backgroundColor: role.color ?? "rgb(120 113 108)",
											}}
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-semibold text-content">
												{role.name}
											</span>
											{role.description ? (
												<span className="mt-1 line-clamp-2 block text-xs text-content-secondary">
													{role.description}
												</span>
											) : null}
										</span>
										{isSaving ? (
											<Loader2 className="size-4 animate-spin text-content-muted" />
										) : assigned ? (
											<Check className="size-4 text-success" />
										) : (
											<Plus className="size-4 text-content-muted" />
										)}
									</button>
								);
							})}
						</div>
					)}
				</section>

				<section className="mt-5 space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h3 className="text-sm font-semibold text-content">
								Permisos avanzados
							</h3>
							<p className="mt-1 text-xs text-content-secondary">
								{permissionCount} habilitados
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="successSecondary"
								size="xs"
								disabled={
									!activeAccess ||
									activeAccess.sources.isAdmin ||
									Boolean(savingKey)
								}
								onClick={() => onSetAllOverrides(user.user_id, "grant")}
							>
								<Check className="size-3.5" />
								Permitir todos
							</Button>
							<Button
								type="button"
								variant="destructiveSecondary"
								size="xs"
								disabled={
									!activeAccess ||
									activeAccess.sources.isAdmin ||
									Boolean(savingKey)
								}
								onClick={() => onSetAllOverrides(user.user_id, "deny")}
							>
								<Ban className="size-3.5" />
								Bloquear todos
							</Button>
							<Button
								type="button"
								variant="outline"
								size="xs"
								disabled={
									!activeAccess ||
									activeAccess.sources.isAdmin ||
									Boolean(savingKey)
								}
								onClick={() => onSetAllOverrides(user.user_id, "inherit")}
							>
								<RotateCcw className="size-3.5" />
								Usar roles
							</Button>
						</div>
					</div>

					{activeAccess?.sources.isAdmin ? (
						<div className="rounded-lg border border-warning/35 bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
							Esta persona tiene acceso completo por su rol en la organización.
						</div>
					) : null}

					{loadingAccess ? (
						<div className="grid place-items-center rounded-lg border border-stroke-soft bg-card py-10">
							<Loader2 className="size-5 animate-spin text-content-muted" />
						</div>
					) : (
						<div className="space-y-4">
							{permissionsByCategory.map((group) => (
								<div key={group.category} className="space-y-2">
									<div className="flex items-center gap-2">
										<Sparkles className="size-4 text-content-muted" />
										<h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-content-muted">
											{categoryLabel(group.category)}
										</h4>
									</div>
									<div className="grid gap-2">
										{group.permissions.map((permission) => (
											<PermissionCard
												key={permission.id}
												permission={permission}
												sources={activeAccess?.sources ?? null}
												disabled={Boolean(savingKey)}
												saving={
													savingKey ===
													`permission:${user.user_id}:${permission.id}`
												}
												onChange={(state) =>
													onSetPermissionOverride(
														user.user_id,
														permission.id,
														state,
													)
												}
											/>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{canImpersonate ? (
					<section className="mt-5 rounded-lg border border-stroke-soft bg-card p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 className="text-sm font-semibold text-content">
									Suplantación temporal
								</h3>
								<p className="mt-1 text-xs text-content-secondary">
									Entrá temporalmente con la misma vista y permisos para brindar soporte.
								</p>
							</div>
							<Button
								type="button"
								variant="dark"
								size="sm"
								disabled={savingKey === `impersonate:${user.user_id}`}
								onClick={() => onStartImpersonation(user.user_id)}
							>
								{savingKey === `impersonate:${user.user_id}` ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<UserCog className="size-4" />
								)}
								Ingresar como esta persona
							</Button>
						</div>
					</section>
				) : null}
			</div>
		</aside>
	);
}

function ProfileDatum({
	label,
	value,
	icon,
	mono = false,
}: {
	label: string;
	value: string;
	icon?: React.ReactNode;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0 rounded-lg border border-stroke-soft bg-card px-3 py-2.5">
			<div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted">
				{icon}
				{label}
			</div>
			<p
				className={cn(
					"mt-1 truncate text-sm text-content",
					mono && "font-mono text-xs",
				)}
			>
				{value}
			</p>
		</div>
	);
}

function PermissionCard({
	permission,
	sources,
	disabled,
	saving,
	onChange,
}: {
	permission: PermissionOption;
	sources: PermissionSources | null;
	disabled: boolean;
	saving: boolean;
	onChange: (state: OverrideState) => void;
}) {
	const roleGrantSet = React.useMemo(
		() => new Set((sources?.roleGrants ?? []).map((grant) => grant.permissionId)),
		[sources],
	);
	const roleDenySet = React.useMemo(
		() => new Set((sources?.roleDenials ?? []).map((grant) => grant.permissionId)),
		[sources],
	);
	const overrideSet = React.useMemo(
		() => new Set(sources?.overrideIds ?? []),
		[sources],
	);
	const deniedOverrideSet = React.useMemo(
		() => new Set(sources?.deniedOverrideIds ?? []),
		[sources],
	);

	const overrideState: OverrideState = deniedOverrideSet.has(permission.id)
		? "deny"
		: overrideSet.has(permission.id)
			? "grant"
			: "inherit";
	const fromAdmin = sources?.isAdmin ?? false;
	const fromRole = roleGrantSet.has(permission.id);
	const fromRoleDeny = roleDenySet.has(permission.id);
	const fromOverride = overrideSet.has(permission.id);
	const deniedOverride = deniedOverrideSet.has(permission.id);
	const effective =
		fromAdmin ||
		(!deniedOverride && (fromOverride || (fromRole && !fromRoleDeny)));
	const sourceLabel = deniedOverride && !fromAdmin
		? "Bloqueo directo"
		: fromAdmin
			? "Administrador"
			: fromOverride
				? "Permiso directo"
				: fromRoleDeny
					? "Bloqueado por rol"
					: fromRole
						? "Permitido por rol"
						: "Sin acceso";
	const controlsDisabled = disabled || saving || fromAdmin || !sources;
	const offState: OverrideState = fromRole && !fromRoleDeny ? "deny" : "inherit";

	return (
		<div className="rounded-lg border border-stroke-soft bg-card p-3">
			<div className="flex items-start gap-3">
				<div className="grid size-9 shrink-0 place-items-center rounded-md border border-stroke-soft bg-surface-recessed text-content-muted">
					{effective ? (
						<LockKeyhole className="size-4" />
					) : (
						<Ban className="size-4" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<p className="text-sm font-semibold text-content">
							{permissionLabel(permission)}
						</p>
						<Badge
							variant={
								effective
									? "success"
									: deniedOverride || fromRoleDeny
										? "destructive"
										: "outline"
							}
						>
							{sourceLabel}
						</Badge>
					</div>
					{permission.description ? (
						<p className="mt-1 line-clamp-2 text-xs leading-5 text-content-secondary">
							{permission.description}
						</p>
					) : null}
					<details className="mt-2 text-xs text-content-muted">
						<summary className="cursor-pointer select-none font-medium hover:text-content">
							Ver detalle técnico
						</summary>
						<code className="mt-1 block break-all rounded bg-surface-recessed px-2 py-1 font-mono">
							{permission.key}
						</code>
					</details>
					{overrideState !== "inherit" ? (
						<button
							type="button"
							disabled={controlsDisabled}
							onClick={() => onChange("inherit")}
							className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-content-muted underline-offset-4 hover:text-content hover:underline disabled:pointer-events-none disabled:opacity-50"
						>
							<RotateCcw className="size-3.5" />
							Usar permiso del rol
						</button>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{saving ? (
						<Loader2 className="size-4 animate-spin text-content-muted" />
					) : null}
					<Switch
						checked={effective}
						disabled={controlsDisabled}
						onCheckedChange={(checked) =>
							onChange(checked ? "grant" : offState)
						}
						aria-label={`${effective ? "Deshabilitar" : "Habilitar"} ${permissionLabel(permission)}`}
					/>
				</div>
			</div>
		</div>
	);
}
