export type DataTableColumn<TData> = {
	id: string;
	header: React.ReactNode;
	accessorKey?: keyof TData;
	accessorFn?: (row: TData, index: number) => unknown;
	renderCell?: (context: {
		row: TData;
		rowIndex: number;
		column: DataTableColumn<TData>;
		value: unknown;
	}) => React.ReactNode;
	className?: string;
	headerClassName?: string;
	align?: "left" | "center" | "right";
	enableHide?: boolean;
	enablePin?: boolean;
	enableResize?: boolean;
};

export type DataTableColumnVisibilityConfig = {
	enabled: boolean;
	persistKey?: string;
};

export type DataTableColumnPinningConfig = {
	enabled: boolean;
	persistKey?: string;
};

export type DataTableColumnResizingConfig = {
	enabled: boolean;
	mode: "fixed";
};

export type DataTableColumnBalanceConfig = {
	enabled: boolean;
	minVisibleWidth?: number;
};

export type DataTableFeatures<TData> = {
	columnVisibility?: DataTableColumnVisibilityConfig;
	columnPinning?: DataTableColumnPinningConfig;
	columnResizing?: DataTableColumnResizingConfig;
	columnBalance?: DataTableColumnBalanceConfig;
};
