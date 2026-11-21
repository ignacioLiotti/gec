"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormTableConfig, FormTableRow, TabFilterOption } from "./types";

import { readPersistedActiveTab, writePersistedActiveTab } from "./persistence";

function resolveActiveTabId<Row extends FormTableRow>(
	tabFilters: TabFilterOption<Row>[],
	...preferredTabIds: Array<string | null | undefined>
) {
	for (const tabId of preferredTabIds) {
		if (tabId && tabFilters.some((tab) => tab.id === tabId)) {
			return tabId;
		}
	}
	return tabFilters[0]?.id ?? null;
}

export function useTableTabs<Row extends FormTableRow, Filters>(
	config: FormTableConfig<Row, Filters>
) {
	const defaultTabFilters = useMemo<TabFilterOption<Row>[]>(
		() => [{ id: "all", label: "Todas" }],
		[]
	);
	const tabFilters = Array.isArray(config.tabFilters) ? config.tabFilters : defaultTabFilters;
	const hasTabFilters = Array.isArray(config.tabFilters) && tabFilters.length > 0;
	const defaultActiveTab = useMemo(
		() => resolveActiveTabId(tabFilters, config.defaultActiveTab),
		[config.defaultActiveTab, tabFilters]
	);
	const activeTabStorageKey = config.activeTabStorageKey ?? null;
	const [activeTab, setActiveTab] = useState<string | null>(defaultActiveTab);
	const [restoredActiveTabStorageKey, setRestoredActiveTabStorageKey] = useState<string | null>(
		() => (activeTabStorageKey ? null : "")
	);
	const activeTabStorageReady =
		!activeTabStorageKey || restoredActiveTabStorageKey === activeTabStorageKey;
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser storage after hydration; server rendering uses the configured tab.
		setActiveTab((current) => {
			if (!activeTabStorageKey) {
				return resolveActiveTabId(tabFilters, current, defaultActiveTab);
			}

			const storedActiveTab = readPersistedActiveTab(activeTabStorageKey);
			return resolveActiveTabId(tabFilters, storedActiveTab, current, defaultActiveTab);
		});
		setRestoredActiveTabStorageKey(activeTabStorageKey ?? "");
	}, [activeTabStorageKey, defaultActiveTab, tabFilters]);
	useEffect(() => {
		if (!activeTabStorageKey || !activeTabStorageReady || !activeTab) return;
		if (!tabFilters.some((tab) => tab.id === activeTab)) return;
		writePersistedActiveTab(activeTabStorageKey, activeTab);
	}, [activeTab, activeTabStorageKey, activeTabStorageReady, tabFilters]);
	return { tabFilters, hasTabFilters, activeTab, setActiveTab };
}
