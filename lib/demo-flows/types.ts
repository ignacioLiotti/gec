export type DemoFlowStep = {
	id: string;
	title: string;
	description: string;
	ctaLabel: string;
	href: string;
};

export type DemoFlowDefinition = {
	id: string;
	title: string;
	description: string;
	eyebrow?: string;
	features?: string[];
	steps: DemoFlowStep[];
};

export type DemoExperienceSettings = {
	landingFlowId: string | null;
	enabledFlowIds: string[];
	headline: string | null;
	subheadline: string | null;
};
