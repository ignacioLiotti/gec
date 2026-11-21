import { expect, test as base } from "@playwright/test";

import { cleanupScenario, createScenario } from "./scenario";
import type { Actor, ActorName, Scenario } from "./types";

type ScenarioFixtures = {
	scenario: Scenario;
};

export const test = base.extend<ScenarioFixtures>({
	scenario: async ({ browser, contextOptions }, provide, testInfo) => {
		const scenario = await createScenario({ browser, contextOptions, testInfo });
		try {
			await provide(scenario);
		} finally {
			await cleanupScenario(scenario);
		}
	},
	context: async ({ scenario }, provide) => {
		await provide((await scenario.actor("owner")).context);
	},
	page: async ({ context }, provide) => {
		const page = await context.newPage();
		await provide(page);
	},
	request: async ({ scenario }, provide) => {
		await provide((await scenario.actor("owner")).request);
	},
});

export { expect };
export type { Actor, ActorName, Scenario };
