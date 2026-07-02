# Table Filters

Use structured filter controls for table sidebars. A filter should show the column name, the condition, the required value inputs, a short behavior summary, and an individual clear action.

Prefer the shared components in `components/form-table/filter-components.tsx`:

- `TextConditionFilter` for text columns, with match conditions such as contains, exact, starts with, ends with, empty, and not empty.
- `NumberConditionFilter` for amounts, quantities, percentages, and numeric identifiers, with comparison and range conditions.
- `DateConditionFilter` for date columns, with exact, before, after, range, relative period, overdue, empty, and not empty conditions.
- `BooleanConditionFilter` for yes/no fields, with yes, no, and any states.

For tables whose filters should follow the visible columns, use `components/form-table/column-filters.tsx` to generate the filter state, renderer, active count, and local row matcher from `ColumnDef` metadata. Set `column.filterType` when the display cell type does not express the data semantics, such as a numeric badge.

Avoid relying only on placeholder text to explain a filter. The selected condition and summary text should make the active behavior clear before the user applies the filters.
