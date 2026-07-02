"use client";

import {
	Footer,
	Hero,
	IBell,
	IDoc,
	IFolder,
	IShield,
	ISpark,
	ITable,
	Nav,
	StatsStrip,
} from "./react-landing/landing-chrome";
import {
	AnchoredFeatures,
	Cierre,
	DarkSteps,
	ModuloCatalogo,
	Perfiles,
	Split,
	useLandingStepScroll,
} from "./react-landing/landing-sections";
import {
	DocumentExtractionAnimation,
	ObrasOverview,
	PermisosMatrix,
} from "./react-landing/landing-mocks";
import { DocumentNavigationAnimation } from "./react-landing/document-navigation-animation";
import { PendientesFlowVideo } from "./react-landing/pendientes-flow-animation";
import "./react-landing/landing-styles.css";

export default function OperativoLandingClient() {
	useLandingStepScroll();

	return (
		<div
			id='root'
			className='min-h-screen overflow-x-hidden bg-[#f7f5f1] font-sans text-stone-900 antialiased [font-feature-settings:"ss01"_1,"cv11"_1]'>
			<OperativoLanding />
		</div>
	);
}

function OperativoLanding() {
	const problema = {
		eyebrow: "El problema",
		title: "La información de la obra existe. <em>Pero está repartida</em>.",
		lead:
			"Los contratos en una carpeta, las fotos en WhatsApp, los datos en Excel y los vencimientos en la memoria de alguien. Cuando hay que encontrar un documento o confirmar un dato, empieza la búsqueda — y cada búsqueda cuesta tiempo, y a veces plata.",
		ctaLabel: "Ver cómo lo ordena Síntesis",
		items: [
			{
				title: "Documentos difíciles de encontrar",
				body:
					"Contratos, pólizas, certificados, remitos y facturas quedan repartidos entre chats, mails, Drive y carpetas físicas. Nadie sabe cuál es la versión vigente.",
			},
			{
				title: "Datos cargados dos veces",
				body:
					"Alguien lee el documento y vuelve a tipear los montos y fechas en una planilla. Cada doble carga es una oportunidad de error.",
			},
			{
				title: "Vencimientos que avisan tarde",
				body:
					"Las pólizas y los plazos dependen de que alguien se acuerde de mirar la planilla. La alerta llega cuando ya venció.",
			},
			{
				title: "Cada uno con su versión",
				body:
					"Obra tiene un número, administración otro y dirección un resumen viejo. Las reuniones se gastan en reconciliar versiones.",
			},
		],
	};

	const quick = {
		eyebrow: "La solución",
		title:
			"Un solo lugar para <em>la documentación y la operación</em> de tus obras.",
		lead:
			"Síntesis junta los documentos, los datos y las alertas que hoy viven repartidos entre Excel, Drive, WhatsApp y carpetas — y los mantiene conectados entre sí.",
		items: [
			{
				icon: IFolder,
				eyebrow: "Documentos por obra",
				value: "Todo en su carpeta.",
				label:
					"Contratos, pólizas, certificados, remitos y facturas quedan en la carpeta de su obra, con fecha, responsable y trazabilidad. Encontrar deja de ser buscar.",
				orange: true,

			},
			{
				icon: ISpark,
				eyebrow: "De documento a dato",
				value: "Sin recargar a mano.",
				label:
					"El sistema lee las fotos y PDFs que ya subís y extrae fechas, montos, proveedores y vencimientos. La planilla se completa sola — y registra de dónde salió cada dato.",
			},
			{
				icon: IBell,
				eyebrow: "Alertas y seguimiento",
				value: "Nada se te pasa.",
				label:
					"Vencimientos, pendientes, recordatorios y notificaciones mantienen cada obra al día. El sistema avisa antes, no después.",
			},
		],
	};

	const anchored = {
		eyebrow: "Producto",
		title: "Cada obra, <em>ordenada y trazable</em>.",
		lead:
			"Lo que sigue no son maquetas: son las pantallas reales del sistema, con la misma interfaz que va a usar tu equipo.",
		blocks: [
			{
				anchor: "Documentos",
				title: "La obra junta <em>todos sus papeles</em>.",
				lead:
					"Cada obra reúne sus documentos, datos, certificados, reportes y pendientes en un mismo lugar. La cartera completa se lee en una tabla que se edita como un Excel.",
				frame: "cool document-navigation-frame",
				mock: <DocumentNavigationAnimation />,
			},
			{
				anchor: "Extracción",
				title: "De la foto o el PDF <em>al dato</em>.",
				lead:
					"El sistema lee los documentos que subís, detecta de qué tipo son y completa fechas, montos, proveedores y vencimientos. Cada dato queda marcado con su origen: extraído, manual o mixto.",
				frame: "cool doc-extraction-frame",
				mock: <DocumentExtractionAnimation />,
			},
			{
				anchor: "Alertas",
				title: "Vencimientos y pendientes <em>que avisan a tiempo</em>.",
				lead:
					"Cada obra tiene pendientes, calendario, recordatorios y alertas atadas a documentos por vencer o tareas sin cerrar. El seguimiento deja de depender de la memoria.",
				frame: "warm pendientes-flow-frame",
				mock: <PendientesFlowVideo />,
			},
			{
				hidden: true,
				anchor: "Equipo",
				title: "Quién ve y toca <em>cada parte</em>.",
				lead:
					"Roles y permisos por módulo, con excepciones por obra. La información queda donde corresponde sin frenar el trabajo del día a día — y cada cambio queda registrado.",
				frame: "dark",
				mock: <PermisosMatrix />,
			},
		],
	};

	const perfiles = {
		eyebrow: "Para quién",
		title: "El mismo sistema, <em>visto desde cada rol</em>.",
		lead:
			"Síntesis no le pide a nadie que cambie su forma de trabajar: le da a cada rol su vista sobre la misma información.",
		items: [
			{
				role: "Administración",
				title: "Documentos y vencimientos al día.",
				body:
					"Las pólizas, certificados y facturas ordenados por obra, con alertas antes de cada vencimiento.",
				bullets: [
					"Carpetas por obra configurables",
					"Alertas de vencimientos",
					"Datos extraídos sin doble carga",
					"Exportación a Excel",
				],
			},
			{
				role: "Obra",
				title: "Cargar desde el celular y seguir.",
				body:
					"Fotos y documentos suben desde la obra y se vuelven datos sin pasar por la oficina.",
				bullets: [
					"Carga desde el celular",
					"Pendientes y recordatorios",
					"Solo ven sus obras",
					"Sin planillas que mantener",
				],
			},
			{
				role: "Oficina técnica",
				title: "Datos conectados, no copiados.",
				body:
					"Planos, mediciones y certificados viven con la obra y alimentan tablas y reportes.",
				bullets: [
					"Documentos técnicos por carpeta",
					"Tablas editables tipo Excel",
					"Origen de cada dato visible",
					"Historial de cambios",
				],
			},
			{
				role: "Dirección",
				title: "El estado real, sin perseguirlo.",
				body:
					"Resúmenes, alertas y reportes muestran cada obra y la cartera completa, al día.",
				bullets: [
					"Dashboard de cartera",
					"Alertas de desvíos",
					"Reportes exportables",
					"Auditoría de cambios",
				],
			},
		],
	};

	const modulos = {
		eyebrow: "Módulos",
		title: "Qué incluye, <em>módulo por módulo</em>.",
		lead:
			"El inventario completo de capacidades del enfoque operativo. Todos los módulos operan sobre las mismas obras y los mismos datos.",
		note:
			"Todos los módulos son configurables por organización: carpetas, tablas, columnas, roles y reportes base se definen una vez y aplican a todas las obras, para que la operación sea comparable.",
		modules: [
			{
				icon: IFolder,
				name: "Documentos por obra",
				desc:
					"Cada obra tiene sus carpetas: contratos, pólizas, certificados, remitos, facturas y planos, con fecha y responsable.",
				bullets: [
					"Estructura de carpetas configurable",
					"Carga desde celular o escritorio",
					"Versiones y trazabilidad",
					"Búsqueda en toda la obra",
				],
			},
			{
				icon: ISpark,
				name: "Extracción de datos",
				desc:
					"El sistema lee fotos y PDFs, detecta el tipo de documento y extrae los datos clave para revisión.",
				bullets: [
					"Tipificación automática del documento",
					"Montos, fechas, proveedores, vencimientos",
					"Revisión y confirmación humana",
					"Origen del dato siempre visible",
				],
			},
			{
				icon: IBell,
				name: "Alertas y pendientes",
				desc:
					"Vencimientos, recordatorios, calendario y notificaciones atados a los documentos y tareas de cada obra.",
				bullets: [
					"Alertas de vencimiento de pólizas",
					"Pendientes asignables por persona",
					"Calendario por obra",
					"Notificaciones por rol",
				],
			},
			{
				icon: ITable,
				name: "Tablas tipo Excel",
				desc:
					"Los datos de obra se trabajan en tablas editables con la experiencia de planilla que tu equipo ya conoce.",
				bullets: [
					"Edición en celda, autocompletes",
					"Columnas configurables por empresa",
					"Filtros, búsqueda y orden",
					"Exportación a Excel y PDF",
				],
			},
			{
				icon: IDoc,
				name: "Generación documental",
				desc:
					"Documentos nuevos se arman desde plantillas con los datos ya cargados, en vez de rehacerse desde cero.",
				bullets: [
					"Plantillas por tipo de documento",
					"Datos de la obra auto-completados",
					"Historial y revisión de generados",
					"Salida en PDF",
				],
			},
			{
				icon: IShield,
				name: "Roles y permisos",
				desc:
					"Quién ve y edita cada módulo se define por rol, con excepciones por obra y auditoría de cambios.",
				bullets: [
					"Permisos por módulo y rol",
					"Overrides por obra",
					"Registro de auditoría",
					"Datos separados por organización",
				],
			},
		],
	};

	const darkSteps = {
		eyebrow: "Empezar",
		title: "Ordená tus obras <em>empezando por una sola</em>.",
		steps: [
			{
				title: "Elegí una obra",
				body:
					"Arrancamos con una obra real, no con toda la empresa de golpe. El riesgo es bajo y el resultado se ve en semanas.",
			},
			{
				title: "Cargá sus documentos",
				body:
					"Subimos los contratos, pólizas, certificados y papeles que ya tenés — tal como están, sin reordenarlos antes.",
			},
			{
				title: "Convertilos en datos",
				body:
					"Activamos la extracción para que los documentos se vuelvan datos y alertas, y tu equipo solo revise y confirme.",
			},
			{
				title: "Sumá al equipo",
				body:
					"Damos acceso a administración, obra y dirección, cada uno con su rol. La obra queda operando en el sistema.",
			},
		],
		ctaLight: "Probar en una obra 30 días",
		ctaGhost: "Ver demo con una obra real",
	};

	const split = {
		eyebrow: "Preguntas frecuentes",
		title: "Se adapta a cómo <em>ya trabajás</em>.",
		lead:
			"Síntesis ordena lo que tu equipo ya hace; no lo obliga a cambiar de golpe ni a abandonar sus Excel. Estas son las preguntas que más nos hacen en la primera reunión.",
		ctaLabel: "Hablar con un especialista",
		items: [
			{
				title: "¿Tengo que cambiar cómo trabaja el equipo?",
				body:
					"No. Mantienen búsquedas, tablas editables, autocompletes y exportaciones. Síntesis ordena eso y lo vuelve trazable — el cambio se siente como orden, no como sistema nuevo.",
			},
			{
				title: "¿Pierdo mis Excel?",
				body:
					"No. Las tablas se editan como una planilla y todo se exporta a Excel. La diferencia es que ahora la planilla está conectada a la obra y a sus documentos.",
			},
			{
				title: "¿La extracción es confiable?",
				body:
					"Cada dato extraído pasa por revisión humana antes de impactar en las tablas, y queda marcado con su origen. Confiás porque podés verificar, no porque te lo pedimos.",
			},
			{
				title: "¿Cuánto lleva implementarlo?",
				body:
					"El piloto arranca con una obra en días. Los documentos se suben tal como están y el equipo se entrena por rol en sesiones cortas.",
			},
			{
				title: "¿Sirve para varias obras y empresas?",
				body:
					"Sí. Cada organización tiene sus obras, sus accesos y sus datos completamente separados del resto. La estructura se define una vez y aplica a todas las obras.",
			},
			{
				title: "¿Puedo sacar la información?",
				body:
					"Siempre. Documentos, tablas y reportes se exportan en cualquier momento a formatos abiertos. Los datos son de tu empresa, no nuestros.",
			},
		],
	};

	const cierre = {
		eyebrow: "La promesa",
		title: "Cada obra puede variar — <em>el control no</em>.",
		lead:
			"Síntesis le da a tu empresa una forma común de trabajar: cada obra puede tener sus particularidades, pero los documentos, los datos y el control se mantienen ordenados, trazables y a la vista de quien decide.",
		primary: "Ver demo con una obra real",
		secondary: "Probar en una obra 30 días",
	};

	return (
		<>
			<Nav variant='operativo' />
			<Hero
				variant='operativo'
				eyebrow='Documentación y operación de obra'
				title='Ordená tus documentos de obra <em>en un solo lugar</em>'
				lead='Síntesis centraliza tu documentación, digitaliza documentos al instante, avisa de vencimientos y desvíos, todo para mantener la dirección de tu obra simple y unificada.'
				primaryCta='Ver demo con una obra real'
				secondaryCta='Probar en una obra 30 días'
				visual={<ObrasOverview variant='operativo' />}
				trust={[
					"Documentos por obra",
					"Extracción de datos",
					"Alertas y vencimientos",
					"Roles y permisos",
					"Exportable a Excel/PDF",
				]}
			/>
			<StatsStrip items={quick.items.map((item) => ({
				eyebrow: item.eyebrow,
				value: item.value,
				label: item.label,
			}))} />
			<Split {...problema} />
			{/* <QuickReference {...quick} /> */}
			<AnchoredFeatures
				{...anchored}
				hideHeader
			/>
			<Perfiles {...perfiles} />
			<ModuloCatalogo {...modulos} />
			<DarkSteps {...darkSteps} />
			<Split
				{...split}
				stacked
			/>
			<Cierre {...cierre} />
			<Footer variant='operativo' />
		</>
	);
}
