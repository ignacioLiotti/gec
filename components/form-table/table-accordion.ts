import { useCallback, useState } from "react";
import type { AccordionRowConfig, FormTableRow } from "./types";

type AccordionState<Row extends FormTableRow> = {
	rows: Row[];
	rowOrder: string[];
	config: AccordionRowConfig<Row> | undefined;
	autoOpenKey: string | number | null | undefined;
	expanded: Set<string>;
	autoExpanded: Set<string>;
};

function reconcileAccordion<Row extends FormTableRow>(
	previous: AccordionState<Row>,
	config: AccordionRowConfig<Row> | undefined,
	rowOrder: string[],
	rows: Row[]
): AccordionState<Row> {
	const next = { ...previous, rows, rowOrder, config };
	if (!config) return { ...next, expanded: new Set(), autoExpanded: new Set() };
	if (config.alwaysOpen) return next;
	const allowed = new Set(rowOrder);
	next.expanded = new Set([...previous.expanded].filter((id) => allowed.has(id)));
	next.autoExpanded =
		config.autoOpenKey === previous.autoOpenKey
			? new Set([...previous.autoExpanded].filter((id) => allowed.has(id)))
			: new Set();
	next.autoOpenKey = config.autoOpenKey;
	if (config.defaultOpen) {
		for (const row of rows) {
			if (!next.autoExpanded.has(row.id) && config.defaultOpen(row)) {
				next.expanded.add(row.id);
				next.autoExpanded.add(row.id);
			}
		}
	}
	return next;
}

export function useTableAccordion<Row extends FormTableRow>(
	accordionRowConfig: AccordionRowConfig<Row> | undefined,
	rowOrder: string[],
	rows: Row[]
) {
	const [state, setState] = useState<AccordionState<Row>>(() =>
		reconcileAccordion(
			{
				rows,
				rowOrder,
				config: accordionRowConfig,
				autoOpenKey: accordionRowConfig?.autoOpenKey,
				expanded: new Set(),
				autoExpanded: new Set(),
			},
			accordionRowConfig,
			rowOrder,
			rows
		)
	);
	if (state.rows !== rows || state.rowOrder !== rowOrder || state.config !== accordionRowConfig) {
		setState(reconcileAccordion(state, accordionRowConfig, rowOrder, rows));
	}
	const alwaysOpen = accordionRowConfig?.alwaysOpen === true;
	const hasAccordionRows = Boolean(accordionRowConfig);
	const isRowExpanded = useCallback(
		(id: string) => alwaysOpen || state.expanded.has(id),
		[alwaysOpen, state.expanded]
	);
	const toggleAccordionRow = useCallback(
		(id: string) => {
			if (!hasAccordionRows || alwaysOpen) return;
			setState((current) => {
				const expanded = new Set(current.expanded);
				if (expanded.has(id)) expanded.delete(id);
				else expanded.add(id);
				return { ...current, expanded };
			});
		},
		[alwaysOpen, hasAccordionRows]
	);
	return { hasAccordionRows, accordionRowConfig, isRowExpanded, toggleAccordionRow };
}
