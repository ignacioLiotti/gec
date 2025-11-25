"use client";

import * as React from "react";
import type { AnyFormApi, AnyFormState } from "@tanstack/form-core";
import { useStore } from "@tanstack/react-form";

import { AdvancedDataTable } from "./advanced-data-table";
import type { AdvancedDataTableProps } from "./advanced-data-table";

type FormAdvancedDataTableProps<TData extends Record<string, any>> = Omit<
	AdvancedDataTableProps<TData>,
	"data" | "onRowsChange" | "rowStateMode"
> & {
	form: AnyFormApi;
	field: string;
	selector?: (values: any) => TData[] | undefined;
	afterRowsChange?: (rows: TData[]) => void;
};

export function FormAdvancedDataTable<TData extends Record<string, any>>({
	form,
	field,
	selector,
	afterRowsChange,
	...tableProps
}: FormAdvancedDataTableProps<TData>) {
	const rowsSelector = React.useCallback(
		(state: AnyFormState) => {
			const values = state.values;
			const resolved = selector ? selector(values) : getValueAtPath(values, field);
			return Array.isArray(resolved) ? (resolved as TData[]) : [];
		},
		[field, selector],
	);

	const rows = useStore(form.store, rowsSelector);

	const handleRowsChange = React.useCallback(
		(next: TData[]) => {
			form.setFieldValue(field as any, () => next);
			afterRowsChange?.(next);
		},
		[form, field, afterRowsChange],
	);

	return (
		<AdvancedDataTable
			{...tableProps}
			data={rows ?? []}
			rowStateMode="controlled"
			onRowsChange={handleRowsChange}
		/>
	);
}

function getValueAtPath(source: unknown, path: string): unknown {
	if (!path) return source;
	const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
	return normalizedPath
		.split(".")
		.filter(Boolean)
		.reduce<unknown>((acc, segment) => {
			if (acc == null) return acc;
			if (typeof acc !== "object") return undefined;
			return (acc as Record<string, unknown>)[segment];
		}, source);
}

