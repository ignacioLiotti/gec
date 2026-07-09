import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

type UserManagementNavProps = {
	active: "users" | "roles";
};

const userManagementItems = [
	{
		id: "users",
		label: "Usuarios",
		href: "/admin/users",
		icon: Users,
	},
	{
		id: "roles",
		label: "Roles y permisos",
		href: "/admin/roles",
		icon: ShieldCheck,
	},
] as const;

export function UserManagementNav({ active }: UserManagementNavProps) {
	return (
		<nav
			aria-label="Gestion de usuarios"
			className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-stroke-soft bg-surface p-1"
		>
			{userManagementItems.map((item) => {
				const isActive = active === item.id;
				const Icon = item.icon;

				return (
					<Button
						key={item.id}
						asChild
						size="sm"
						variant={isActive ? "secondary" : "ghost"}
						className="h-8 justify-start gap-2 px-3"
					>
						<Link href={item.href} aria-current={isActive ? "page" : undefined}>
							<Icon className="size-4" />
							{item.label}
						</Link>
					</Button>
				);
			})}
		</nav>
	);
}
