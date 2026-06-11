# Table bulk edit

`FormTable` supports bulk editing by drag-selecting cells in one editable column.

Use this pattern when users need to apply the same value to several rows without opening each cell individually.

Behavior:

- Drag starts from an editable table cell.
- Selection is constrained to the original column so values keep the same cell type.
- The selected cells use an orange highlight.
- When two or more cells are selected, a compact orange bulk-edit bar appears above the table.
- Applying a value updates the selected rows locally and uses the normal dirty/save flow.
- Read-only tables and read-only columns do not start a bulk selection.

Keep the action scoped to one column unless the table has an explicit, typed multi-column workflow.
