import { z } from "zod";

export const certificateSchema = z.object({
	id: z.string().uuid().optional(),
	obra_id: z.string().uuid({ message: "Debe seleccionar una obra válida" }),
	n_exp: z.string().min(1, "El N° Exp es requerido"),
	n_certificado: z.number().int().min(1, "El número de certificado debe ser mayor a 0"),
	monto: z.number().min(0, "El monto debe ser positivo"),
	mes: z.string().min(1, "El mes es requerido"),
	estado: z.string().min(1, "El estado es requerido"),
});

export const certificatesFormSchema = z.object({
	detalleCertificados: z.array(certificateSchema).min(1, "Debe haber al menos un certificado"),
});

export type Certificate = z.infer<typeof certificateSchema>;
export type CertificatesForm = z.infer<typeof certificatesFormSchema>;
