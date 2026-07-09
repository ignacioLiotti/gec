"use client";

import * as React from "react";
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
	const [pending, setPending] = React.useState(false);

	const handleClick = React.useCallback(() => {
		if (pending) return;
		setPending(true);
		const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		window.location.assign(
			`/api/tenants/${tenantId}/switch?next=${encodeURIComponent(nextPath)}`
		);
	}, [tenantId, pending]);

	return (
		<Button type="button" onClick={handleClick} disabled={pending} {...buttonProps}>
			{pending && <Loader2 className="mr-2 size-4 animate-spin" />}
			{children}
		</Button>
	);
}
