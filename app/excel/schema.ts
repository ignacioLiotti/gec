import { z } from "zod";

export const obraSchema = z.object({
	id: z.string().uuid().optional(),
	n: z.number().min(1, "El número debe ser mayor a 0"),
	designacionYUbicacion: z.string().min(1, "La designación es requerida"),
	supDeObraM2: z.number().min(0, "La superficie debe ser positiva"),
	entidadContratante: z.string().min(1, "La entidad contratante es requerida"),
	mesBasicoDeContrato: z.string().min(1, "El mes básico es requerido"),
	iniciacion: z.string().min(1, "La fecha de iniciación es requerida"),
	contratoMasAmpliaciones: z.number().min(0, "El importe debe ser positivo"),
	certificadoALaFecha: z.number().min(0, "El importe debe ser positivo"),
	saldoACertificar: z.number().min(0, "El importe debe ser positivo"),
	segunContrato: z.number().min(0, "Los meses deben ser positivos"),
	prorrogasAcordadas: z.number().min(0, "Los meses deben ser positivos"),
	plazoTotal: z.number().min(0, "Los meses deben ser positivos"),
	plazoTransc: z.number().min(0, "Los meses deben ser positivos"),
	porcentaje: z.number().min(0).max(100, "El porcentaje debe estar entre 0 y 100"),
	customData: z.record(z.string(), z.unknown()).optional(),
	onFinishFirstMessage: z.string().nullable().optional(),
	onFinishSecondMessage: z.string().nullable().optional(),
	onFinishSecondSendAt: z.string().nullable().optional(),
});

export const obrasFormSchema = z.object({
	detalleObras: z.array(obraSchema).min(1, "Debe haber al menos una obra"),
});

export type Obra = z.infer<typeof obraSchema>;
export type ObrasForm = z.infer<typeof obrasFormSchema>;
