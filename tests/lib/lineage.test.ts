import { describe, expect, it } from "vitest";

import {
	buildContentFingerprintSource,
	computeContentFingerprintNormalized,
	computeFileFingerprint,
	deriveLineageRowKeys,
} from "@/lib/lineage";

describe("lineage", () => {
	it("keeps the same semantic content fingerprint regardless of item order", () => {
		const left = computeContentFingerprintNormalized(
			buildContentFingerprintSource({
				parentData: { nro: "OC-001", proveedor: "Hormigones" },
				itemRows: [
					{ material: "H21", cantidad: 10 },
					{ material: "Arena", cantidad: 4 },
				],
			}),
		);
		const right = computeContentFingerprintNormalized(
			buildContentFingerprintSource({
				parentData: { proveedor: "Hormigones", nro: "OC-001" },
				itemRows: [
					{ material: "Arena", cantidad: 4 },
					{ cantidad: 10, material: "H21" },
				],
			}),
		);

		expect(left).toBe(right);
	});

	it("preserves row lineage for equivalent reimports even if the binary file changes", () => {
		const parentColumns = [{ fieldKey: "nro", config: {} }];
		const itemColumns = [{ fieldKey: "material", config: {} }, { fieldKey: "cantidad", config: {} }];
		const parentData = { nro: "OC-001" };
		const itemRows = [{ material: "H21", cantidad: 10 }];
		const contentFingerprint = computeContentFingerprintNormalized(
			buildContentFingerprintSource({ parentData, itemRows }),
		);

		const firstImport = deriveLineageRowKeys({
			tableIdentity: "tabla:orders",
			parentData,
			itemRows,
			parentColumns,
			itemColumns,
			fileFingerprint: computeFileFingerprint(Buffer.from("file-a")),
			contentFingerprintNormalized: contentFingerprint,
		});
		const secondImport = deriveLineageRowKeys({
			tableIdentity: "tabla:orders",
			parentData,
			itemRows,
			parentColumns,
			itemColumns,
			fileFingerprint: computeFileFingerprint(Buffer.from("file-b")),
			contentFingerprintNormalized: contentFingerprint,
		});

		expect(firstImport).toEqual(secondImport);
	});

	it("uses position fallback to disambiguate repeated identical items", () => {
		const keys = deriveLineageRowKeys({
			tableIdentity: "tabla:orders",
			parentData: { nro: "OC-002" },
			itemRows: [
				{ material: "H21", cantidad: 10 },
				{ material: "H21", cantidad: 10 },
			],
			parentColumns: [{ fieldKey: "nro", config: {} }],
			itemColumns: [{ fieldKey: "material", config: {} }, { fieldKey: "cantidad", config: {} }],
			fileFingerprint: computeFileFingerprint(Buffer.from("same-file")),
			contentFingerprintNormalized: computeContentFingerprintNormalized(
				buildContentFingerprintSource({
					parentData: { nro: "OC-002" },
					itemRows: [
						{ material: "H21", cantidad: 10 },
						{ material: "H21", cantidad: 10 },
					],
				}),
			),
		});

		expect(keys).toHaveLength(2);
		expect(keys[0]).not.toBe(keys[1]);
		expect(keys[0].startsWith("pos:")).toBe(true);
		expect(keys[1].startsWith("pos:")).toBe(true);
	});
});
