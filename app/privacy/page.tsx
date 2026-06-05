export const metadata = {
	title: "Politica de privacidad | Sintesis",
	description: "Politica de privacidad de Sintesis para usuarios e integraciones operativas.",
};

export default function PrivacyPage() {
	return (
		<main className="mx-auto max-w-3xl space-y-8 px-6 py-12 text-stone-800">
			<header className="space-y-3">
				<p className="text-sm font-medium uppercase tracking-wide text-stone-500">
					Sintesis
				</p>
				<h1 className="text-3xl font-semibold text-stone-950">
					Politica de privacidad
				</h1>
				<p className="text-sm text-stone-600">Ultima actualizacion: 5 de junio de 2026</p>
			</header>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Alcance</h2>
				<p>
					Sintesis es una plataforma para gestion documental, seguimiento operativo y
					captura de informacion vinculada a obras y procesos internos. Esta politica
					describe como tratamos datos enviados por usuarios autorizados mediante la
					aplicacion web, integraciones, correo, WhatsApp y otros canales operativos.
				</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Datos que podemos tratar</h2>
				<p>
					Podemos tratar datos de identificacion y contacto, mensajes, archivos,
					imagenes, documentos, respuestas de formularios, metadatos tecnicos,
					registros de auditoria y datos de uso necesarios para operar el servicio.
				</p>
				<p>
					En integraciones de WhatsApp, tratamos el numero de telefono del remitente,
					el contenido del mensaje, archivos adjuntos y respuestas estructuradas
					enviadas por contactos autorizados.
				</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Finalidad</h2>
				<p>
					Usamos los datos para prestar el servicio, cargar documentos, responder
					solicitudes operativas, registrar formularios, controlar permisos, mantener
					trazabilidad, prevenir abusos, diagnosticar errores y mejorar la plataforma.
				</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Acceso y conservacion</h2>
				<p>
					El acceso a la informacion queda limitado a usuarios autorizados de cada
					organizacion y a personal tecnico que necesite intervenir para soporte,
					seguridad u operacion. Conservamos los datos mientras sean necesarios para
					los fines operativos, contractuales, legales o de auditoria aplicables.
				</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Proveedores</h2>
				<p>
					Podemos usar proveedores de infraestructura, almacenamiento, autenticacion,
					mensajeria, analisis documental e integraciones, incluyendo servicios de Meta
					para WhatsApp Business Platform cuando una organizacion habilita ese canal.
				</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold text-stone-950">Derechos y contacto</h2>
				<p>
					Las solicitudes de acceso, correccion, eliminacion o consultas sobre
					privacidad pueden canalizarse a traves del administrador de la organizacion
					que utiliza Sintesis o por los canales comerciales y de soporte informados
					por Sintesis.
				</p>
			</section>
		</main>
	);
}
