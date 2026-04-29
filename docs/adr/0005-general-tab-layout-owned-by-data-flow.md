# General tab layout owned by data-flow

Status: accepted

The General tab layout is persisted as part of data-flow, with blocks that carry stable ids, type, enabled state, selected fields/results, order, width and grid coordinates (`gridX`, `gridY`, `gridH`). The visual editor uses React Grid Layout, and the final obra General tab must interpret the same grid contract so drag/resize edits land in the same position in production UI.

The rejected path was a separate hardcoded JSX layout plus a side-sheet of toggles. Persisting layout in data-flow lets tenant admins define general layout for all obras and lets a particular obra override that layout without forking the page implementation.
