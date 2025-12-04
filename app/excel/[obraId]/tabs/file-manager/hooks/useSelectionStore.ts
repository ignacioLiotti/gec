"use client";

import { useReducer, useMemo } from "react";
import type { FileSystemItem } from "../../file-manager/types";

type SelectionState = {
	fileTree: FileSystemItem | null;
	selectedFolder: FileSystemItem | null;
	selectedDocument: FileSystemItem | null;
	sheetDocument: FileSystemItem | null;
	expandedFolderIds: Set<string>;
};

type SelectionAction =
	| { type: "SET_FILE_TREE"; payload: FileSystemItem | null }
	| { type: "SET_SELECTED_FOLDER"; payload: FileSystemItem | null }
	| { type: "SET_SELECTED_DOCUMENT"; payload: FileSystemItem | null }
	| { type: "SET_SHEET_DOCUMENT"; payload: FileSystemItem | null }
	| { type: "SET_EXPANDED_FOLDERS"; payload: Set<string> };

const initialSelectionState: SelectionState = {
	fileTree: null,
	selectedFolder: null,
	selectedDocument: null,
	sheetDocument: null,
	expandedFolderIds: new Set(["root"]),
};

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
	switch (action.type) {
		case "SET_FILE_TREE":
			return { ...state, fileTree: action.payload };
		case "SET_SELECTED_FOLDER":
			return { ...state, selectedFolder: action.payload };
		case "SET_SELECTED_DOCUMENT":
			return { ...state, selectedDocument: action.payload };
		case "SET_SHEET_DOCUMENT":
			return { ...state, sheetDocument: action.payload };
		case "SET_EXPANDED_FOLDERS":
			return { ...state, expandedFolderIds: action.payload };
		default:
			return state;
	}
}

export function useSelectionStore() {
	const [state, dispatch] = useReducer(selectionReducer, initialSelectionState);

	const actions = useMemo(
		() => ({
			setFileTree: (tree: FileSystemItem | null) => dispatch({ type: "SET_FILE_TREE", payload: tree }),
			setSelectedFolder: (folder: FileSystemItem | null) => dispatch({ type: "SET_SELECTED_FOLDER", payload: folder }),
			setSelectedDocument: (doc: FileSystemItem | null) => dispatch({ type: "SET_SELECTED_DOCUMENT", payload: doc }),
			setSheetDocument: (doc: FileSystemItem | null) => dispatch({ type: "SET_SHEET_DOCUMENT", payload: doc }),
			setExpandedFolderIds: (ids: Set<string>) => dispatch({ type: "SET_EXPANDED_FOLDERS", payload: ids }),
		}),
		[]
	);

	return { state, actions };
}
