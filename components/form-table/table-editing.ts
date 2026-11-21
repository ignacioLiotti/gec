"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createRowFromColumns, getClearedValue, snapshotValues } from "./table-utils";
import type {
	ColumnDef,
	ColumnField,
	FormFieldComponent,
	FormTableConfig,
	FormTableRow,
	FormValues,
} from "./types";

import { buildFormSnapshot, hasSameRowIdentity } from "./table-utils";

import { buildDirtyIndex, type RowDirtyCacheEntry } from "./dirty-tracking";

export function useTableEditing<Row extends FormTableRow, Filters>(
	config: FormTableConfig<Row, Filters>
) {
	const isReadOnly = config.readOnly === true;
	const columns = config.columns;
	const fetchRowsFn = config.fetchRows;
	const defaultRows = config.defaultRows;
	const [isSaving, setIsSaving] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const initialSnapshot = useMemo(
		() => buildFormSnapshot(config.defaultRows),
		[config.defaultRows]
	);
	const [dirtyBaseline, setDirtyBaseline] = useState<FormValues<Row>>(() =>
		snapshotValues(initialSnapshot.rowOrder, initialSnapshot.rowsById)
	);
	const initialValuesRef = useRef<FormValues<Row>>(dirtyBaseline);
	// TanStack Form setup
	const form = useForm<
		FormValues<Row>,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined
	>({
		defaultValues: {
			rowOrder: initialSnapshot.rowOrder,
			rowsById: initialSnapshot.rowsById,
		},
	});
	const setFormFieldValue = form.setFieldValue as (path: string, updater: unknown) => void;
	type FormStateType = typeof form.store.state;

	const rowOrderSelector = useCallback<(state: FormStateType) => string[]>(
		(state) => (state.values?.rowOrder as string[]) ?? [],
		[]
	);
	const rowsByIdSelector = useCallback<(state: FormStateType) => Record<string, Row>>(
		(state) => (state.values?.rowsById as Record<string, Row>) ?? {},
		[]
	);

	const rowOrder = useStore(form.store, rowOrderSelector);
	const rowsById = useStore(form.store, rowsByIdSelector);
	const setFormRows = useCallback(
		(nextRows: Row[]) => {
			const nextOrder = nextRows.map((row) => row.id);
			const nextMap = nextRows.reduce<Record<string, Row>>((acc, row) => {
				acc[row.id] = { ...row };
				return acc;
			}, {});
			setFormFieldValue("rowOrder", nextOrder);
			setFormFieldValue("rowsById", nextMap);
			const snapshot = snapshotValues(nextOrder, nextMap);
			initialValuesRef.current = snapshot;
			setDirtyBaseline(snapshot);
		},
		[setFormFieldValue]
	);
	const hasInitialRow = useCallback(
		(rowId: string) => Boolean(initialValuesRef.current.rowsById[rowId]),
		[]
	);

	const rows = useMemo(() => {
		return rowOrder.map((id) => rowsById[id]).filter((row): row is Row => Boolean(row));
	}, [rowOrder, rowsById]);

	const dirtyRowCacheRef = useRef<{
		columns: ColumnDef<Row>[] | null;
		dirtyFieldsKey: string;
		map: Map<string, RowDirtyCacheEntry<Row>>;
	}>({ columns: null, dirtyFieldsKey: "", map: new Map() });
	const dirtyFields = useMemo(() => config.dirtyFields ?? [], [config.dirtyFields]);
	const dirtyFieldsKey = dirtyFields.join(",");
	const dirtyIndex = useMemo(() => {
		const cache = dirtyRowCacheRef.current;
		if (cache.columns !== columns || cache.dirtyFieldsKey !== dirtyFieldsKey) {
			cache.columns = columns;
			cache.dirtyFieldsKey = dirtyFieldsKey;
			cache.map.clear();
		}
		return buildDirtyIndex(
			rowOrder,
			dirtyBaseline.rowOrder,
			rowsById,
			columns,
			dirtyBaseline.rowsById,
			dirtyFields,
			cache.map
		);
	}, [rowOrder, rowsById, columns, dirtyBaseline, dirtyFields, dirtyFieldsKey]);

	useEffect(() => {
		if (fetchRowsFn) return;
		if (Array.isArray(defaultRows)) {
			if (dirtyIndex.hasChanges) return;
			if (hasSameRowIdentity(defaultRows, rowOrder)) return;
			setFormRows(defaultRows);
		}
	}, [fetchRowsFn, defaultRows, rowOrder, dirtyIndex.hasChanges, setFormRows]);

	const isCellDirty = useCallback(
		(rowId: string, column: ColumnDef<Row>) =>
			Boolean(dirtyIndex.cellDirtyByRowId[rowId]?.has(column.id)),
		[dirtyIndex]
	);

	const getRowDirtyState = useCallback(
		(rowId: string) => ({
			dirty: Boolean(dirtyIndex.rowDirtyById[rowId]),
			cells: dirtyIndex.dirtyCellsByRowId[rowId] ?? [],
			cellIdsKey: dirtyIndex.dirtyCellIdsByRowId[rowId] ?? "",
		}),
		[dirtyIndex]
	);

	const hasUnsavedChanges = dirtyIndex.hasChanges || config.externalUnsavedChanges === true;

	const handleClearCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly) return;
			if (column.editable === false) return;
			const clearedValue = getClearedValue(column);
			setFormFieldValue(
				`rowsById.${rowId}.${column.field}` as const,
				() => clearedValue as Row[ColumnField<Row>]
			);
		},
		[isReadOnly, setFormFieldValue]
	);

	const handleRestoreCell = useCallback(
		(rowId: string, column: ColumnDef<Row>) => {
			if (isReadOnly) return;
			const initialRow = initialValuesRef.current.rowsById[rowId];
			if (!initialRow) return;
			const initialValue = initialRow[column.field];
			setFormFieldValue(
				`rowsById.${rowId}.${column.field}` as const,
				() => initialValue as Row[ColumnField<Row>]
			);
		},
		[isReadOnly, setFormFieldValue]
	);

	const setCellValue = useCallback(
		(rowId: string, field: ColumnField<Row>, value: unknown) => {
			if (isReadOnly) return;
			setFormFieldValue(`rowsById.${rowId}.${field}` as const, () => value);
		},
		[isReadOnly, setFormFieldValue]
	);

	const updateRow = useCallback(
		(rowId: string, updater: (row: Row) => Row) => {
			if (isReadOnly) return;
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				const currentRow = prev[rowId];
				if (!currentRow) return prev;
				const nextRow = updater(currentRow);
				if (nextRow === currentRow) return prev;
				return {
					...prev,
					[rowId]: nextRow,
				};
			});
		},
		[isReadOnly, setFormFieldValue]
	);

	const handleDelete = useCallback(
		(id: string) => {
			if (isReadOnly) return;
			setFormFieldValue("rowOrder", (prev: string[] = []) => prev.filter((rowId) => rowId !== id));
			setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => {
				if (!(id in prev)) return prev;
				const next = { ...prev };
				delete next[id];
				return next;
			});
			// toast.success("Fila eliminada");
		},
		[isReadOnly, setFormFieldValue]
	);

	const handleSave = useCallback(async () => {
		if (isReadOnly) return;
		if (!hasUnsavedChanges) return;
		setIsSaving(true);
		setServerError(null);
		try {
			if (config.onSave) {
				const dirtyRows = rows.filter((row) => dirtyIndex.rowDirtyById[row.id]);
				const currentIds = new Set(rowOrder);
				const deletedRowIds = initialValuesRef.current.rowOrder.filter(
					(initialId) => !currentIds.has(initialId)
				);
				await config.onSave({ rows, dirtyRows, deletedRowIds });
			} else {
				await new Promise((resolve) => setTimeout(resolve, 900));
			}
			const snapshot = snapshotValues(rowOrder, rowsById);
			initialValuesRef.current = snapshot;
			setDirtyBaseline(snapshot);
			toast.success("Cambios guardados correctamente");
		} catch (error) {
			const errorMessage =
				error instanceof Error && error.message
					? error.message
					: "No se pudieron guardar los cambios";
			setServerError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsSaving(false);
		}
	}, [config, dirtyIndex, hasUnsavedChanges, isReadOnly, rowOrder, rows, rowsById]);

	const handleDiscardChanges = useCallback(() => {
		if (isReadOnly) return;
		if (!hasUnsavedChanges) return;
		const snapshot = snapshotValues(
			initialValuesRef.current.rowOrder,
			initialValuesRef.current.rowsById
		);
		setFormFieldValue("rowOrder", snapshot.rowOrder);
		setFormFieldValue("rowsById", snapshot.rowsById);
		config.onDiscardChanges?.();
		toast.info("Cambios descartados");
	}, [config, hasUnsavedChanges, isReadOnly, setFormFieldValue]);

	const createRow = config.createRow;
	const addRow = useCallback(() => {
		if (isReadOnly) return;
		const newRow = createRow ? createRow() : createRowFromColumns(columns);
		setFormFieldValue("rowOrder", (prev: string[] = []) => [newRow.id, ...prev]);
		setFormFieldValue("rowsById", (prev: Record<string, Row> = {}) => ({
			...prev,
			[newRow.id]: newRow,
		}));
	}, [columns, createRow, isReadOnly, setFormFieldValue]);
	return {
		FieldComponent: form.Field as FormFieldComponent<Row>,
		setFormFieldValue,
		rowOrder,
		rows,
		setFormRows,
		hasInitialRow,
		isCellDirty,
		getRowDirtyState,
		hasUnsavedChanges,
		isSaving,
		serverError,
		setServerError,
		handleClearCell,
		handleRestoreCell,
		setCellValue,
		updateRow,
		handleDelete,
		handleSave,
		handleDiscardChanges,
		addRow,
	};
}
