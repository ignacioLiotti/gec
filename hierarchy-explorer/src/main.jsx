import React from "react";
import ReactDOM from "react-dom/client";
import { HierarchyExplorer } from "./HierarchyExplorer/index.js";
import "./preview.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HierarchyExplorer />
  </React.StrictMode>,
);
