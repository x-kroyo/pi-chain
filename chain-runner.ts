import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { executeStep } from "./execution.ts";
import { buildStartState, isChainComplete, parseChainCommand } from "./settings.ts";
import { getLatestState, updateWidget } from "./state-ui.ts";
import { STATE_ENTRY_TYPE, type ChainDefinition, type ChainRunState } from "./types.ts";
import { loadChain } from "./chain-files.ts";

export function refreshChainUI(ctx: ExtensionContext): void {
	const state = getLatestState(ctx);
	if (!state) {
		updateWidget(ctx);
		return;
	}

	try {
		const chain = loadChain(state.chainId);
		updateWidget(ctx, chain, state);
	} catch {
		updateWidget(ctx);
	}
}

function hasRemainingSteps(state: ChainRunState, chain: ChainDefinition): boolean {
	return chain.steps.length > 0 && !isChainComplete(state, chain);
}

async function runStep(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	chain: ChainDefinition,
	previousState: ChainRunState,
	stepIndex: number,
): Promise<void> {
	await ctx.waitForIdle();
	if (!ctx.isIdle()) {
		ctx.ui.notify("Agent is busy. Wait for the current turn to finish.", "warning");
		return;
	}

	const runningStep = chain.steps[stepIndex];

	const currentState: ChainRunState = { ...previousState, currentStepIndex: stepIndex };
	const createdSession = await ctx.newSession({
		setup: async (sessionManager) => {
			sessionManager.appendCustomEntry(STATE_ENTRY_TYPE, currentState);
		},
	});
	if (createdSession.cancelled) {
		ctx.ui.notify("Step did not run because session startup was cancelled.", "warning");
		return;
	}
	updateWidget(ctx, chain, currentState);

	try {
		await executeStep(pi, chain, runningStep, ctx);
	} catch (error) {
		ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		return;
	}
}

function getActiveChainState(ctx: ExtensionContext, chainId: string): ChainRunState | null {
	const state = getLatestState(ctx);
	if (!state || state.chainId !== chainId) {
		ctx.ui.notify(`No active chain state in this session. Run /chain:${chainId} start`, "warning");
		return null;
	}
	return state;
}

async function handleStartSubcommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	chain: ChainDefinition,
): Promise<void> {
	if (chain.steps.length === 0) {
		ctx.ui.notify("No steps to run", "info")
		return;
	}
	const state = buildStartState(chain.id);
	await runStep(pi, ctx, chain, state, 0);
}

// async function handleRunSubcommand(
// 	stepIndex: string,
// 	pi: ExtensionAPI,
// 	ctx: ExtensionCommandContext,
// 	chain: ChainDefinition,
// 	state: ChainRunState,
// ): Promise<void> {
// 	const hasStepIndex = stepIndex.trim().length > 0;
// 	const parsedStepIndex = Number.parseInt(stepIndex, 10);
// 	if (hasStepIndex && !Number.isFinite(parsedStepIndex)) {
// 		ctx.ui.notify("Invalid step index. Use: run <1-based index>", "warning");
// 		return;
// 	}
// 	const resolvedStepIndex = Number.isFinite(parsedStepIndex) ? parsedStepIndex - 1 : state.currentStepIndex;
// 	if (!hasRemainingSteps(state, chain) || resolvedStepIndex < 0) {
// 		ctx.ui.notify("Chain is already complete.", "info");
// 		return;
// 	}
// 	await runStep(pi, ctx, chain, state, resolvedStepIndex);
// }

async function handleNextSubcommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	chain: ChainDefinition,
	state: ChainRunState,
): Promise<void> {
	// TODO : add a chain completed if no steps lefty
	if (!hasRemainingSteps(state, chain)) {
		ctx.ui.notify("Chain is already complete.", "info");
		return;
	}
	const nextStepIndex = state.currentStepIndex + 1;

	await runStep(pi, ctx, chain, state, nextStepIndex);

}

export async function handleChainCommand(chainId: string, args: string, pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	const commandCtx = ctx as ExtensionCommandContext;
	const chain = loadChain(chainId);
	const { subcommand, arguments: argumentsValue } = parseChainCommand(args);

	switch (subcommand) {
		case "start":
			await handleStartSubcommand(pi, commandCtx, chain);
			return;
		// case "run": {
		// 	const state = getActiveChainState(ctx, chainId);
		// 	if (!state) return;
		// 	await handleRunSubcommand(argumentsValue, pi, commandCtx, chain, state);
		// 	return;
		// }
		case "next": {
			const state = getActiveChainState(ctx, chainId);
			if (!state) return;
			await handleNextSubcommand(pi, commandCtx, chain, state);
			return;
		}
		default:
			ctx.ui.notify(`Unknown subcommand for ${chainId}: ${subcommand}`, "warning");
	}
}
