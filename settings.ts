import { getNextStepIndex } from "./chain-files.ts";
import type { ChainDefinition, ChainRunState } from "./types.ts";

export type ChainSubcommand = "start" | "next" | "run";

export function parseChainCommand(args: string): { subcommand: string; arguments: string } {
	const [subcommand = "next", ...rest] = args.trim().split(/\s+/).filter(Boolean);
	return { subcommand, arguments: rest.join(" ") };
}

export function buildStartState(chainId: string): ChainRunState {
	return {
		chainId,
		currentStepIndex: 0,
		startedAt: new Date().toISOString(),
	};
}

export function isChainComplete(state: ChainRunState, chain: ChainDefinition): boolean {
	return state.currentStepIndex >= chain.steps.length;
}

export function applyStepCompletion(
	state: ChainRunState,
	chain: ChainDefinition,
	stepIndex: number,
): ChainRunState {
	const nextStepIndex = getNextStepIndex(chain, stepIndex);

	return {
		...state,
		currentStepIndex: nextStepIndex ?? chain.steps.length,
	};
}
