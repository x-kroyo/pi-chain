import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export type ChainStep = {
	name: string;
	instructions_file?: string;
	instructions?: string;
	model: string;
	model_provider: string;
	thinking?: ThinkingLevel;
	skills?: string[];
	reads?: string[];
	tools?: string[];
};

export type ChainDefinition = {
	id: string;
	name?: string;
	description?: string;
	session?: false | string;
	steps: ChainStep[];
};

export interface ChainRunState {
	chainId: string;
	currentStepIndex: number;
	startedAt: string;
}

export const STATE_ENTRY_TYPE = "pi-chain-state";
