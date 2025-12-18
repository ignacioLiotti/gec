"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

type TenantSwitchButtonProps = ButtonProps & {
	tenantId: string;
	children: React.ReactNode;
};

export function TenantSwitchButton({
	tenantId,
	children,
	...buttonProps
}: TenantSwitchButtonProps) {
	const router = useRouter();
	const [pending, setPending] = React.useState(false);

	const handleClick = React.useCallback(async () => {
		if (pending) return;
		setPending(true);
		try {
			const response = await fetch(`/api/tenants/${tenantId}/switch`, {
				method: "POST",
			});
			if (!response.ok) {
				console.error("[tenant-switch] failed", response.status);
				return;
			}
			router.refresh();
		} catch (error) {
			console.error("[tenant-switch] error", error);
		} finally {
			setPending(false);
		}
	}, [router, tenantId, pending]);

	return (
		<Button type="button" onClick={handleClick} disabled={pending} {...buttonProps}>
			{pending && <Loader2 className="mr-2 size-4 animate-spin" />}
			{children}
		</Button>
	);
}
