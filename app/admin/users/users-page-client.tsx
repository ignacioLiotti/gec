"use client";

import * as React from "react";
import Link from "next/link";
import {
	Ban,
	Check,
	ChevronRight,
	Loader2,
	LockKeyhole,
	Minus,
	Plus,
	RotateCcw,
	Search,
	Settings2,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type MembershipRole = "owner" | "admin" | "member";
type OverrideState = "inherit" | "grant" | "deny";

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
};

const MEMBERSHIP_LABELS: Record<MembershipRole, string> = {
	owner: "Propietario",
	admin: "Admin",
	member: "Miembro",
};

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

function formatDate(value: string | null) {
	if (!value) return "Sin registro";
	return new Intl.DateTimeFormat("es-AR", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
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
}: UsersPageClientProps) {
	const [usersState, setUsersState] = React.useState<UserCardData[]>(users);
	const [query, setQuery] = React.useState("");
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [activeUserId, setActiveUserId] = React.useState<string | null>(null);
	const [activeAccess, setActiveAccess] = React.useState<UserAccessState | null>(
		null,
	);
	const [selectedOrgRole, setSelectedOrgRole] =
		React.useState<MembershipRole>("member");
	const [loadingAccess, setLoadingAccess] = React.useState(false);
	const [savingKey, setSavingKey] = React.useState<string | null>(null);
	const [batchRoleId, setBatchRoleId] = React.useState("");
	const [batchPermissionId, setBatchPermissionId] = React.useState("");

	React.useEffect(() => {
		setUsersState(users);
	}, [users]);

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

	React.useEffect(() => {
		if (!activeUser) return;
		setSelectedOrgRole(toMembershipRole(activeUser.membership_role));
	}, [activeUser]);

	React.useEffect(() => {
		if (!activeUserId) {
			setActiveAccess(null);
			return;
		}

		let cancelled = false;
		setLoadingAccess(true);
		loadUserAccess(tenantId, activeUserId)
			.then((access) => {
				if (!cancelled) setActiveAccess(access);
			})
			.catch((error) => {
				if (!cancelled) {
					toast.error(getErrorMessage(error, "No se pudo cargar el usuario"));
				}
			})
			.finally(() => {
				if (!cancelled) setLoadingAccess(false);
			});

		return () => {
			cancelled = true;
		};
	}, [activeUserId, tenantId]);

	const filteredUsers = React.useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return usersState;

		return usersState.filter((user) => {
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
	}, [query, rolesById, usersState]);

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
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
			<section className="space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="relative w-full sm:max-w-sm">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.currentTarget.value)}
							placeholder="Buscar usuario, email o rol"
							className="pl-9"
						/>
					</div>
					<div className="flex items-center gap-2">
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
							{visibleSelected ? "Limpiar vista" : "Seleccionar vista"}
						</Button>
						<Button asChild type="button" variant="ghost" size="sm">
							<Link href="/admin/roles">
								<Settings2 className="size-4" />
								Roles
							</Link>
						</Button>
					</div>
				</div>

				{filteredUsers.length === 0 ? (
					<div className="rounded-lg border border-dashed border-stone-300 bg-white/70 px-6 py-16 text-center text-sm text-stone-500">
						Sin usuarios para mostrar.
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{filteredUsers.map((user) => (
							<UserCard
								key={user.user_id}
								user={user}
								rolesById={rolesById}
								selected={selectedIds.has(user.user_id)}
								onSelect={() => toggleSelected(user.user_id)}
								onOpen={() => setActiveUserId(user.user_id)}
							/>
						))}
					</div>
				)}
			</section>

			<aside className="sticky top-4 h-fit rounded-lg border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_40px_-34px_rgba(0,0,0,0.55)]">
				<div className="flex items-center gap-3">
					<div className="grid size-10 place-items-center rounded-lg bg-stone-100 text-stone-700">
						<Users className="size-5" />
					</div>
					<div>
						<p className="text-sm font-semibold">Seleccionados</p>
						<p className="text-xs text-stone-500">
							{selectedUsers.length} de {usersState.length} usuarios
						</p>
					</div>
				</div>

				<div className="mt-5 space-y-4">
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
							Roles
						</p>
						<select
							value={batchRoleId}
							onChange={(event) => setBatchRoleId(event.currentTarget.value)}
							className="h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-500"
						>
							<option value="">Elegir rol</option>
							{allRoles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.name}
								</option>
							))}
						</select>
						<div className="grid grid-cols-2 gap-2">
							<Button
								type="button"
								size="sm"
								disabled={!batchRoleId || selectedUsers.length === 0 || Boolean(savingKey)}
								onClick={() => applyBatchRole(true)}
							>
								<Plus className="size-4" />
								Asignar
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!batchRoleId || selectedUsers.length === 0 || Boolean(savingKey)}
								onClick={() => applyBatchRole(false)}
							>
								<Minus className="size-4" />
								Quitar
							</Button>
						</div>
					</div>

					<div className="h-px bg-stone-200" />

					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
							Permisos directos
						</p>
						<select
							value={batchPermissionId}
							onChange={(event) =>
								setBatchPermissionId(event.currentTarget.value)
							}
							className="h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-500"
						>
							<option value="">Elegir permiso</option>
							{allPermissions.map((permission) => (
								<option key={permission.id} value={permission.id}>
									{permission.key}
								</option>
							))}
						</select>
						<div className="grid grid-cols-3 gap-2">
							<Button
								type="button"
								variant="successSecondary"
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
								variant="destructiveSecondary"
								size="sm"
								disabled={
									!batchPermissionId ||
									selectedUsers.length === 0 ||
									Boolean(savingKey)
								}
								onClick={() => applyBatchPermission("deny")}
							>
								<Ban className="size-4" />
								Bloquear
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
								<RotateCcw className="size-4" />
								Heredar
							</Button>
						</div>
					</div>
				</div>
			</aside>

			<Sheet
				open={Boolean(activeUser)}
				onOpenChange={(open) => {
					if (!open) setActiveUserId(null);
				}}
			>
				<SheetContent className="w-full border-l border-stone-200 bg-[#fbfaf7] p-0 sm:max-w-2xl">
					{activeUser ? (
						<ScrollArea className="h-full">
							<SheetHeader className="border-b border-stone-200 bg-white px-6 py-5">
								<div className="flex items-start gap-4 pr-8">
									<UserColorCloud user={activeUser} size="large" />
									<div className="min-w-0 flex-1">
										<SheetTitle className="truncate text-xl">
											{getUserLabel(activeUser)}
										</SheetTitle>
										<SheetDescription className="mt-1 truncate">
											{activeUser.email ?? activeUser.user_id}
										</SheetDescription>
										<div className="mt-3 flex flex-wrap gap-2">
											<Badge variant="outline" className="bg-white">
												{MEMBERSHIP_LABELS[
													toMembershipRole(activeUser.membership_role)
												]}
											</Badge>
											<Badge variant="outline" className="bg-white">
												{activeAccess?.roleIds.length ?? activeUser.assigned_role_ids.length} roles
											</Badge>
											<Badge variant="outline" className="bg-white">
												{activeUser.override_count + activeUser.denied_override_count} excepciones
											</Badge>
										</div>
									</div>
								</div>
							</SheetHeader>

							<div className="space-y-6 px-6 py-6">
								<section className="grid gap-3 sm:grid-cols-2">
									<ProfileDatum label="ID" value={activeUser.user_id} mono />
									<ProfileDatum
										label="Alta"
										value={formatDate(activeUser.created_at)}
									/>
									<ProfileDatum
										label="Ultimo ingreso"
										value={formatDate(activeUser.last_sign_in_at)}
									/>
									<ProfileDatum
										label="Email"
										value={activeUser.email ?? "Sin email"}
									/>
								</section>

								<section className="rounded-lg border border-stone-200 bg-white p-4">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<h3 className="text-sm font-semibold">
												Rol de organizacion
											</h3>
											<p className="mt-1 text-xs text-stone-500">
												Owner y admin tienen acceso total.
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Select
												value={selectedOrgRole}
												onValueChange={(value) =>
													setSelectedOrgRole(toMembershipRole(value))
												}
											>
												<SelectTrigger className="w-36">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="owner">Propietario</SelectItem>
													<SelectItem value="admin">Admin</SelectItem>
													<SelectItem value="member">Miembro</SelectItem>
												</SelectContent>
											</Select>
											<Button
												type="button"
												size="sm"
												disabled={savingKey === "membership"}
												onClick={updateMembershipRole}
											>
												{savingKey === "membership" ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Check className="size-4" />
												)}
												Guardar
											</Button>
										</div>
									</div>
								</section>

								<section className="space-y-3">
									<div className="flex items-center justify-between gap-3">
										<div>
											<h3 className="text-sm font-semibold">Roles</h3>
											<p className="mt-1 text-xs text-stone-500">
												Roles custom del tenant.
											</p>
										</div>
										{loadingAccess ? (
											<Loader2 className="size-4 animate-spin text-stone-400" />
										) : null}
									</div>
									{allRoles.length === 0 ? (
										<div className="rounded-lg border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center text-sm text-stone-500">
											No hay roles configurados.
										</div>
									) : (
										<div className="grid gap-2 sm:grid-cols-2">
											{allRoles.map((role) => {
												const assigned = Boolean(
													activeAccess?.roleIds.includes(role.id),
												);
												const isSaving =
													savingKey ===
													`role:${activeUser.user_id}:${role.id}`;
												return (
													<button
														key={role.id}
														type="button"
														disabled={Boolean(savingKey) && !isSaving}
														onClick={() =>
															setUserRole(
																activeUser.user_id,
																role.id,
																!assigned,
															)
														}
														className={cn(
															"flex min-h-16 items-start gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-stone-400 disabled:opacity-60",
															assigned
																? "border-stone-900 shadow-[0_0_0_2px_rgba(0,0,0,0.03)]"
																: "border-stone-200",
														)}
													>
														<span
															className="mt-1 size-3 rounded-full"
															style={{
																backgroundColor:
																	role.color ?? "rgb(120 113 108)",
															}}
														/>
														<span className="min-w-0 flex-1">
															<span className="block truncate text-sm font-semibold">
																{role.name}
															</span>
															{role.description ? (
																<span className="mt-1 line-clamp-2 block text-xs text-stone-500">
																	{role.description}
																</span>
															) : null}
														</span>
														{isSaving ? (
															<Loader2 className="size-4 animate-spin text-stone-500" />
														) : assigned ? (
															<Check className="size-4 text-emerald-600" />
														) : (
															<Plus className="size-4 text-stone-400" />
														)}
													</button>
												);
											})}
										</div>
									)}
								</section>

								<section className="space-y-4">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<h3 className="text-sm font-semibold">
												Permisos del usuario
											</h3>
											<p className="mt-1 text-xs text-stone-500">
												Excepciones directas sobre roles.
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												variant="successSecondary"
												size="sm"
												disabled={
													!activeAccess ||
													activeAccess.sources.isAdmin ||
													Boolean(savingKey)
												}
												onClick={() => setAllOverrides(activeUser.user_id, "grant")}
											>
												<Check className="size-4" />
												Permitir todos
											</Button>
											<Button
												type="button"
												variant="destructiveSecondary"
												size="sm"
												disabled={
													!activeAccess ||
													activeAccess.sources.isAdmin ||
													Boolean(savingKey)
												}
												onClick={() => setAllOverrides(activeUser.user_id, "deny")}
											>
												<Ban className="size-4" />
												Bloquear todos
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={
													!activeAccess ||
													activeAccess.sources.isAdmin ||
													Boolean(savingKey)
												}
												onClick={() =>
													setAllOverrides(activeUser.user_id, "inherit")
												}
											>
												<RotateCcw className="size-4" />
												Heredar todos
											</Button>
										</div>
									</div>

									{activeAccess?.sources.isAdmin ? (
										<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
											Este usuario conserva acceso total por su rol de
											organizacion.
										</div>
									) : null}

									{loadingAccess ? (
										<div className="grid place-items-center rounded-lg border border-stone-200 bg-white py-12">
											<Loader2 className="size-5 animate-spin text-stone-400" />
										</div>
									) : (
										<div className="space-y-5">
											{permissionsByCategory.map((group) => (
												<div key={group.category} className="space-y-2">
													<div className="flex items-center gap-2">
														<Sparkles className="size-4 text-stone-400" />
														<h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
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
																	`permission:${activeUser.user_id}:${permission.id}`
																}
																onChange={(state) =>
																	setPermissionOverride(
																		activeUser.user_id,
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
									<section className="rounded-lg border border-stone-200 bg-white p-4">
										<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
											<div>
												<h3 className="text-sm font-semibold">Suplantacion</h3>
												<p className="mt-1 text-xs text-stone-500">
													Entrar temporalmente como este usuario.
												</p>
											</div>
											<Button
												type="button"
												variant="dark"
												size="sm"
												disabled={savingKey === `impersonate:${activeUser.user_id}`}
												onClick={() => startImpersonation(activeUser.user_id)}
											>
												{savingKey === `impersonate:${activeUser.user_id}` ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<UserCog className="size-4" />
												)}
												Suplantar usuario
											</Button>
										</div>
									</section>
								) : null}
							</div>
						</ScrollArea>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function UserCard({
	user,
	rolesById,
	selected,
	onSelect,
	onOpen,
}: {
	user: UserCardData;
	rolesById: Map<string, RoleOption>;
	selected: boolean;
	onSelect: () => void;
	onOpen: () => void;
}) {
	const membershipRole = toMembershipRole(user.membership_role);
	const assignedRoles = user.assigned_role_ids
		.map((roleId) => rolesById.get(roleId))
		.filter((role): role is RoleOption => Boolean(role));

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
				"group min-h-[13rem] cursor-pointer rounded-lg border bg-white p-4 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_30px_-28px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_18px_40px_-28px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-stone-900/10",
				selected
					? "border-stone-900 ring-2 ring-stone-900/5"
					: "border-stone-200",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<UserColorCloud user={user} />
					<div className="min-w-0">
						<h2 className="truncate text-sm font-semibold">
							{getUserLabel(user)}
						</h2>
						<p className="mt-1 truncate text-xs text-stone-500">
							{user.email ?? user.user_id}
						</p>
					</div>
				</div>
				<Checkbox
					checked={selected}
					onClick={(event) => event.stopPropagation()}
					onCheckedChange={() => onSelect()}
					aria-label={selected ? "Quitar seleccion" : "Seleccionar usuario"}
					className="mt-1"
				/>
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				<Badge
					variant="outline"
					className={cn(
						"bg-white",
						membershipRole === "member"
							? "text-stone-600"
							: "border-emerald-200 bg-emerald-50 text-emerald-700",
					)}
				>
					<ShieldCheck className="size-3" />
					{MEMBERSHIP_LABELS[membershipRole]}
				</Badge>
				<Badge variant="outline" className="bg-white text-stone-600">
					<UserRound className="size-3" />
					{assignedRoles.length} roles
				</Badge>
			</div>

			<div className="mt-4 min-h-14">
				{assignedRoles.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{assignedRoles.slice(0, 4).map((role) => (
							<span
								key={role.id}
								className="inline-flex max-w-full items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700"
							>
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: role.color ?? "rgb(120 113 108)" }}
								/>
								<span className="truncate">{role.name}</span>
							</span>
						))}
						{assignedRoles.length > 4 ? (
							<span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-500">
								+{assignedRoles.length - 4}
							</span>
						) : null}
					</div>
				) : (
					<p className="text-xs text-stone-400">Sin roles custom.</p>
				)}
			</div>

			<div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3">
				<div className="flex items-center gap-2 text-xs text-stone-500">
					<span>{user.override_count} permitidos</span>
					<span className="size-1 rounded-full bg-stone-300" />
					<span>{user.denied_override_count} bloqueados</span>
				</div>
				<ChevronRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" />
			</div>
		</article>
	);
}

function ProfileDatum({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2.5">
			<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
				{label}
			</p>
			<p
				className={cn(
					"mt-1 truncate text-sm text-stone-800",
					mono && "font-mono text-xs",
				)}
				title={value}
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
			? "Admin"
			: fromOverride
				? "Directo"
				: fromRoleDeny
					? "Bloqueo por rol"
					: fromRole
						? "Rol"
						: "Sin acceso";
	const controlsDisabled = disabled || saving || fromAdmin || !sources;

	return (
		<div className="rounded-lg border border-stone-200 bg-white p-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate font-mono text-xs font-semibold text-stone-900">
							{permission.key}
						</p>
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
								effective
									? "bg-emerald-50 text-emerald-700"
									: "bg-stone-100 text-stone-500",
							)}
						>
							{effective ? (
								<LockKeyhole className="size-3" />
							) : (
								<Ban className="size-3" />
							)}
							{sourceLabel}
						</span>
					</div>
					<p className="mt-1 text-sm font-medium text-stone-800">
						{permissionLabel(permission)}
					</p>
					{permission.description ? (
						<p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
							{permission.description}
						</p>
					) : null}
				</div>

				<div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 text-[11px] font-medium">
					<PermissionStateButton
						state="inherit"
						activeState={overrideState}
						disabled={controlsDisabled}
						onChange={onChange}
					/>
					<PermissionStateButton
						state="grant"
						activeState={overrideState}
						disabled={controlsDisabled}
						onChange={onChange}
					/>
					<PermissionStateButton
						state="deny"
						activeState={overrideState}
						disabled={controlsDisabled}
						onChange={onChange}
					/>
				</div>
			</div>
		</div>
	);
}

function PermissionStateButton({
	state,
	activeState,
	disabled,
	onChange,
}: {
	state: OverrideState;
	activeState: OverrideState;
	disabled: boolean;
	onChange: (state: OverrideState) => void;
}) {
	const active = state === activeState;
	const label =
		state === "inherit" ? "Heredar" : state === "grant" ? "Permitir" : "Bloquear";
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={() => onChange(state)}
			className={cn(
				"px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-50",
				active && state === "inherit" && "bg-stone-900 text-white",
				active && state === "grant" && "bg-emerald-600 text-white",
				active && state === "deny" && "bg-red-600 text-white",
				!active && "bg-white text-stone-600 hover:bg-stone-100",
			)}
		>
			{label}
		</button>
	);
}
