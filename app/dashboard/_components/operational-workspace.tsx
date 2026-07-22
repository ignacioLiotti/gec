"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

import styles from "./operational-workspace.module.css";

type Detail = {
	title: string;
	description: string;
	row: string;
	value: string;
	percentage: number;
	tone: "dark" | "orange" | "danger" | "muted";
};

type MetricKind = "progress" | "elapsed" | "delay" | "balance";

export type OperationalWorkspaceData = {
	company: string;
	updatedAt: string;
	unreadNotifications: number;
	expiredPolicies: number;
	flaggedAmount: string;
	lateWorks: number;
	activeWorks: number;
	kpis: Array<{
		id: string;
		label: string;
		value: string;
		note: string;
		tone?: "default" | "warning" | "danger";
		detail: Detail;
	}>;
	policyMonths: Array<{
		label: string;
		count: number;
		risk: number;
		balance: string;
	}>;
	signals: Array<{
		value: string;
		label: string;
		note: string;
		tone: "danger" | "warning" | "neutral";
	}>;
	projects: Array<{
		id: number;
		name: string;
		title: string;
		entity: string;
		updated: string;
		progress: number;
		elapsed: number;
		balance: string;
		balanceShare: number;
		contract: string;
		certified: string;
		timeframe: string;
	}>;
	notifications: Array<{
		title: string;
		detail: string;
		when: string;
	}>;
	reviews: Array<{
		name: string;
		work: number;
		status: "Generado" | "En revisión";
		when: string;
		file: string;
	}>;
};

function DetailPopover({ detail, align = "left" }: { detail: Detail; align?: "left" | "right" }) {
	return (
		<div className={styles.detailPopover} data-align={align} role="tooltip">
			<span className={styles.popoverIcon} data-tone={detail.tone}><span /></span>
			<strong>{detail.title}</strong>
			<p>{detail.description}</p>
			<div className={styles.popoverMetric}>
				<span className={styles.popoverTrack}>
					<span data-tone={detail.tone} style={{ width: `${Math.min(Math.max(detail.percentage, 0), 100)}%` }} />
				</span>
				<div><span>{detail.row}</span><strong>{detail.value}</strong></div>
			</div>
		</div>
	);
}

function MetricCell({
	project,
	kind,
	active,
	onActiveChange,
}: {
	project: OperationalWorkspaceData["projects"][number];
	kind: MetricKind;
	active: boolean;
	onActiveChange: (active: boolean) => void;
}) {
	const delay = Math.max(0, project.elapsed - project.progress);
	const late = delay >= 10;
	const metric = {
		progress: {
			value: `${project.progress}%`,
			percentage: project.progress,
			tone: "dark" as const,
			detail: { title: "Avance físico", description: "Progreso de obra medido y certificado sobre el total contratado.", row: "% de obra ejecutada", value: `${project.progress}%`, percentage: project.progress, tone: "dark" as const },
		},
		elapsed: {
			value: `${project.elapsed}%`,
			percentage: Math.min(project.elapsed, 100),
			tone: late ? "danger" as const : "muted" as const,
			detail: { title: "Plazo transcurrido", description: `${project.timeframe} contractuales consumidos${project.elapsed > 100 ? ". La obra corre fuera de su plazo." : "."}`, row: "% del plazo consumido", value: `${project.elapsed}%`, percentage: Math.min(project.elapsed, 100), tone: late ? "danger" as const : "muted" as const },
		},
		delay: {
			value: delay > 0 ? `+${delay} pp` : "al día",
			percentage: Math.min(delay * 2.5, 100),
			tone: late ? "danger" as const : delay > 0 ? "orange" as const : "muted" as const,
			detail: { title: "Desvío", description: delay > 0 ? `El plazo consumido supera el avance físico en ${delay} puntos. Umbral de atraso: 10 pp.` : "El avance acompaña el plazo. Sin señales de atraso.", row: "puntos de desvío", value: `${delay} pp`, percentage: Math.min(delay * 2.5, 100), tone: late ? "danger" as const : delay > 0 ? "orange" as const : "muted" as const },
		},
		balance: {
			value: project.balance,
			percentage: project.balanceShare,
			tone: "orange" as const,
			detail: { title: "Saldo a certificar", description: "Ingreso futuro pendiente de certificación en esta obra.", row: "% del saldo total activo", value: `${project.balanceShare.toLocaleString("es-AR")}%`, percentage: project.balanceShare, tone: "orange" as const },
		},
	}[kind];

	return (
		<button
			type="button"
			className={styles.metricCell}
			data-active={active}
			data-tone={metric.tone}
			onMouseEnter={() => onActiveChange(true)}
			onMouseLeave={() => onActiveChange(false)}
			onFocus={() => onActiveChange(true)}
			onBlur={() => onActiveChange(false)}
		onClick={() => onActiveChange(true)}
			aria-label={`${metric.detail.title}: ${metric.value}`}
		>
			<strong>{metric.value}</strong>
			<span className={styles.progressTrack}><span data-tone={metric.tone} style={{ width: `${metric.percentage}%` }} /></span>
			{active ? <DetailPopover detail={metric.detail} align="right" /> : null}
		</button>
	);
}

function DocumentCard({ review, index }: { review: OperationalWorkspaceData["reviews"][number]; index: number }) {
	const widths = [82, 64, 91, 55, 73, 40].map((width, lineIndex) => ((width + index * 17 + lineIndex * 9) % 55) + 40);
	return (
		<button type="button" className={styles.reviewCard} title={review.file} style={{ animationDelay: `${300 + index * 50}ms` }}>
			<span className={styles.documentPreview}>
				<span className={styles.fold} />
				<span className={styles.documentBrand}>Constructora Norte S.A.</span>
				<span className={styles.documentTitle} />
				<span className={styles.documentSubtitle} />
				<span className={styles.documentLines}>
					{widths.map((width, lineIndex) => <span key={lineIndex} style={{ width: `${width}%` }} />)}
				</span>
				<span className={styles.documentFooter}><span>Obra {review.work}</span><span /></span>
			</span>
			<span className={styles.reviewMeta}>
				<span><strong>{review.name}</strong><small>{review.when}</small></span>
				<span className={styles.reviewStatus} data-status={review.status}>{review.status}</span>
			</span>
		</button>
	);
}

export function OperationalWorkspace({ data }: { data: OperationalWorkspaceData }) {
	const [activeKpi, setActiveKpi] = useState<string | null>(null);
	const [activeMonth, setActiveMonth] = useState<number | null>(null);
	const [activeMetric, setActiveMetric] = useState<string | null>(null);
	const selectedMonth = activeMonth === null ? null : data.policyMonths[activeMonth];

	return (
		<main className={styles.canvas}>
			<section className={styles.workspace} aria-label="Panel de administración de obras">
				<header className={styles.header}>
					<div className={styles.metaRow}>
						<p>Panel de administración · {data.company}</p>
						<div className={styles.headerActions}>
							<span className={styles.notificationPill}><Bell aria-hidden="true" size={13} />{data.unreadNotifications} sin leer</span>
							<span className={styles.datePill}>{data.updatedAt}</span>
						</div>
					</div>
					<h1><strong>{data.expiredPolicies} pólizas vencidas</strong> siguen activas con <strong className={styles.accent}>{data.flaggedAmount}</strong> comprometidos, y <strong>{data.lateWorks} de {data.activeWorks} obras</strong> corren detrás del plazo.</h1>
				</header>

				<div className={styles.kpiGrid}>
					{data.kpis.map((kpi) => {
						const active = activeKpi === kpi.id;
						return (
							<button
								type="button"
								key={kpi.id}
								className={styles.kpi}
								data-active={active}
								onMouseEnter={() => setActiveKpi(kpi.id)}
								onMouseLeave={() => setActiveKpi(null)}
								onFocus={() => setActiveKpi(kpi.id)}
								onBlur={() => setActiveKpi(null)}
								onClick={() => setActiveKpi(kpi.id)}
							>
								<span className={styles.kpiLabel}>{kpi.label}</span>
								<strong data-tone={kpi.tone ?? "default"}>{kpi.value}</strong>
								<span className={styles.kpiNote}>{kpi.note}</span>
								{active ? <DetailPopover detail={kpi.detail} /> : null}
							</button>
						);
					})}
				</div>

				<div className={styles.contentGrid}>
					<div className={styles.primaryColumn}>
						<section className={styles.panel}>
							<div className={styles.sectionHeading}>
								<div><h2>Vencimientos de pólizas · próximos 12 meses</h2><p><strong>35 vencidas sin baja</strong> · $ 4,8 M + USD 18.400 retenidos · la más antigua hace 685 días</p></div>
								<button type="button">Panel de pólizas →</button>
							</div>
							<div className={styles.monthChart}>
								{data.policyMonths.map((month, index) => (
									<button
										type="button"
										key={month.label}
										className={styles.month}
										data-active={activeMonth === index}
										onMouseEnter={() => setActiveMonth(index)}
										onFocus={() => setActiveMonth(index)}
										onClick={() => setActiveMonth(index)}
									>
										<strong>{month.count}</strong>
										<span className={styles.barStack} style={{ height: `${Math.max(month.count * 13, 8)}px` }}>
											<span className={styles.safeBar} style={{ flex: month.count - month.risk }} />
											<span className={styles.riskBar} style={{ flex: month.risk }} />
										</span>
										<span>{month.label}</span>
									</button>
								))}
							</div>
							<div className={styles.monthDetail}>
								<span>{selectedMonth ? `${selectedMonth.label} — ${selectedMonth.count} pólizas vencen, ${selectedMonth.risk} con señales de riesgo · saldo comprometido ${selectedMonth.balance}` : "Pasá el cursor por un mes para ver el detalle."}</span>
								<span><i data-tone="risk" />con señales de riesgo</span><span><i />sin señales</span>
							</div>
							<div className={styles.signalGrid}>
								{data.signals.map((signal) => <div key={signal.label} className={styles.signal} data-tone={signal.tone}><span className={styles.signalDot} /><div><strong>{signal.value}</strong><p>{signal.label}</p><small>{signal.note}</small></div></div>)}
							</div>
						</section>

						<section className={styles.panel}>
							<div className={styles.sectionHeading}>
								<div><h2>Obras activas · avance contra plazo</h2><p>Pasá el cursor por una celda para entender la métrica. <strong>{data.lateWorks} obras</strong> consumen plazo más rápido de lo que avanzan.</p></div>
								<button type="button">Ver todas las obras →</button>
							</div>
							<div className={styles.projectTable} role="table" aria-label="Obras activas">
								<div className={styles.projectHeader} role="row"><span>Obra</span><span>Avance</span><span>Plazo</span><span>Desvío</span><span>Saldo</span></div>
								{data.projects.map((project) => {
									const delay = Math.max(0, project.elapsed - project.progress);
									const late = delay >= 10;
									return (
										<div className={styles.projectRow} role="row" key={project.id}>
											<div className={styles.projectIdentity} title={project.title}>
												<span className={styles.projectTile} data-late={late}>{project.id}</span>
												<div><strong>{project.name}</strong><small>{project.entity} · actualizada {project.updated}</small></div>
											</div>
											{(["progress", "elapsed", "delay", "balance"] as const).map((kind) => {
												const metricId = `${project.id}-${kind}`;
												return <MetricCell key={kind} project={project} kind={kind} active={activeMetric === metricId} onActiveChange={(active) => setActiveMetric(active ? metricId : null)} />;
											})}
										</div>
									);
								})}
								<div className={styles.projectTotal}><span>Σ&nbsp;&nbsp;Total de {data.activeWorks} obras activas</span><strong>51%</strong><strong>60%</strong><strong>{data.lateWorks} atrasadas</strong><strong>$ 2.809 M</strong></div>
							</div>
						</section>
					</div>

					<aside className={styles.aside}>
						<section className={styles.panel}>
							<div className={styles.asideTitle}><h2>Notificaciones</h2><span>{data.unreadNotifications}</span></div>
							<div className={styles.notificationList}>{data.notifications.map((notification) => <button type="button" key={notification.title}><strong>{notification.title}</strong><p>{notification.detail}</p><small>{notification.when}</small></button>)}</div>
						</section>
						<section className={styles.panel}>
							<div className={styles.sectionHeading}><h2>En revisión · {data.reviews.length}</h2><button type="button">Cola completa →</button></div>
							<div className={styles.reviewGrid}>{data.reviews.map((review, index) => <DocumentCard key={`${review.file}-${review.work}`} review={review} index={index} />)}</div>
						</section>
					</aside>
				</div>
			</section>
		</main>
	);
}
