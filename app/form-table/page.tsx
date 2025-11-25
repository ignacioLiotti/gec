'use client';

import { FormTable } from "@/components/form-table/form-table";
import { obrasDetalleConfig } from "@/components/form-table/configs/obras-detalle";

export default function FormTablePage() {
	return <FormTable config={obrasDetalleConfig} />;
}
