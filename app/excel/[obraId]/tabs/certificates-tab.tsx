'use client';

import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { DollarSign, Plus, Receipt } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Certificate, NewCertificateFormState } from "./types";

type CertificatesTabProps = {
	certificates: Certificate[];
	certificatesTotal: number;
	certificatesLoading: boolean;
	isAddingCertificate: boolean;
	isCreatingCertificate: boolean;
	createCertificateError: string | null;
	newCertificate: NewCertificateFormState;
	handleToggleAddCertificate: () => void;
	handleCreateCertificate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
	handleNewCertificateChange: (field: keyof NewCertificateFormState, value: string) => void;
};

export function ObraCertificatesTab({
	certificates,
	certificatesTotal,
	certificatesLoading,
	isAddingCertificate,
	isCreatingCertificate,
	createCertificateError,
	newCertificate,
	handleToggleAddCertificate,
	handleCreateCertificate,
	handleNewCertificateChange,
}: CertificatesTabProps) {
	return (
		<TabsContent value="certificates" className="space-y-6">
			<motion.section
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="rounded-lg border bg-card shadow-sm overflow-hidden"
			>
				<div className="bg-muted/50 px-6 py-4 border-b">
					<div className="flex items-center justify-between">
						<div>
							<div className="flex items-center gap-2">
								<Receipt className="h-5 w-5 text-primary" />
								<h2 className="text-lg font-semibold">Certificados asdasdade Obra</h2>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								{certificates.length}{" "}
								{certificates.length === 1 ? "certificado registrado" : "certificados registrados"}
							</p>
						</div>
						<Button
							variant={isAddingCertificate ? "outline" : "default"}
							onClick={handleToggleAddCertificate}
							disabled={isCreatingCertificate}
							className="gap-2"
						>
							{isAddingCertificate ? (
								"Cancelar"
							) : (
								<>
									<Plus className="h-4 w-4" />
									Agregar certificado
								</>
							)}
						</Button>
					</div>
				</div>

				<div className="p-6 space-y-6">
					{isAddingCertificate && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="overflow-hidden"
						>
							<form onSubmit={handleCreateCertificate} className="space-y-4 p-4 rounded-lg bg-muted/50 border">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium mb-2">N° de expediente</label>
										<Input
											type="text"
											value={newCertificate.n_exp}
											onChange={(event) => handleNewCertificateChange("n_exp", event.target.value)}
											placeholder="Ej: EXP-2024-001"
											required
										/>
									</div>
									<div>
										<label className="block text-sm font-medium mb-2">N° de certificado</label>
										<Input
											type="number"
											value={newCertificate.n_certificado}
											onChange={(event) =>
												handleNewCertificateChange("n_certificado", event.target.value)
											}
											placeholder="1"
											required
										/>
									</div>
									<div>
										<label className="block text-sm font-medium mb-2">Monto</label>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
												$
											</span>
											<Input
												type="number"
												step="0.01"
												value={newCertificate.monto}
												onChange={(event) => handleNewCertificateChange("monto", event.target.value)}
												className="pl-8 text-right font-mono"
												placeholder="0.00"
												required
											/>
										</div>
									</div>
									<div>
										<label className="block text-sm font-medium mb-2">Mes</label>
										<Input
											type="text"
											value={newCertificate.mes}
											onChange={(event) => handleNewCertificateChange("mes", event.target.value)}
											placeholder="Ej: Enero 2024"
											required
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium mb-2">Estado</label>
										<Input
											type="text"
											value={newCertificate.estado}
											onChange={(event) => handleNewCertificateChange("estado", event.target.value)}
											placeholder="CERTIFICADO"
										/>
									</div>
								</div>
								{createCertificateError && (
									<div className="p-3 rounded-md bg-destructive/10 border border-destructive/50">
										<p className="text-sm text-destructive">{createCertificateError}</p>
									</div>
								)}
								<div className="flex justify-end gap-3 pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={handleToggleAddCertificate}
										disabled={isCreatingCertificate}
									>
										Cancelar
									</Button>
									<Button type="submit" disabled={isCreatingCertificate} className="min-w-[140px]">
										{isCreatingCertificate ? "Guardando..." : "Guardar certificado"}
									</Button>
								</div>
							</form>
						</motion.div>
					)}

					{certificatesLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="space-y-2 text-center">
								<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
								<p className="text-sm text-muted-foreground">Cargando certificados...</p>
							</div>
						</div>
					) : certificates.length === 0 && !isAddingCertificate ? (
						<div className="text-center py-12">
							<Receipt className="h-12 w-12 text-orange-primary/40 mx-auto mb-3" />
							<p className="text-sm text-orange-primary/80 mb-1">No hay certificados registrados</p>
							<p className="text-xs text-muted-foreground">Agregá el primer certificado para esta obra</p>
						</div>
					) : certificates.length > 0 ? (
						<div className="space-y-4">
							<div className="overflow-x-auto rounded-lg border">
								<table className="w-full text-sm">
									<thead className="bg-muted/50">
										<tr>
											<th className="text-left font-medium py-3 px-4 border-b">N° EXP.</th>
											<th className="text-left font-medium py-3 px-4 border-b">N° Certificado</th>
											<th className="text-right font-medium py-3 px-4 border-b">Monto</th>
											<th className="text-left font-medium py-3 px-4 border-b">Mes</th>
											<th className="text-left font-medium py-3 px-4 border-b">Estado</th>
										</tr>
									</thead>
									<tbody>
										{certificates.map((cert, index) => (
											<motion.tr
												key={cert.id}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ delay: index * 0.05 }}
												className="border-b last:border-0 hover:bg-muted/30 transition-colors"
											>
												<td className="py-3 px-4 font-medium">{cert.n_exp}</td>
												<td className="py-3 px-4">{cert.n_certificado}</td>
												<td className="py-3 px-4 text-right font-mono">
													${" "}
													{Number(cert.monto).toLocaleString("es-AR", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</td>
												<td className="py-3 px-4">{cert.mes}</td>
												<td className="py-3 px-4">
													<span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
														{cert.estado}
													</span>
												</td>
											</motion.tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="flex justify-between items-center p-4 rounded-lg bg-muted/50 border">
								<div className="flex items-center gap-2">
									<DollarSign className="h-5 w-5 text-muted-foreground" />
									<span className="font-semibold">Total Certificado</span>
								</div>
								<span className="text-xl font-bold font-mono">
									${" "}
									{Number(certificatesTotal).toLocaleString("es-AR", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</span>
							</div>
						</div>
					) : null}
				</div>
			</motion.section>
		</TabsContent>
	);
}

