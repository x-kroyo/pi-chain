import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { isChainComplete } from "./settings.ts";
import { getChainLabel } from "./chain-files.ts";
import type { ChainDefinition, ChainRunState } from "./types.ts";
import { STATE_ENTRY_TYPE } from "./types.ts";

type LegacyChainRunState = {
	chainName?: string;
	chainId?: string;
	currentStepId?: string | null;
	currentStepIndex?: number | null;
	isComplete?: boolean;
	startedAt?: string;
};

function normalizeState(data: unknown): ChainRunState | undefined {
	if (!data || typeof data !== "object") return undefined;
	const raw = data as LegacyChainRunState;

	const startedAt = typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString();
	const legacyChainName = typeof raw.chainName === "string" ? raw.chainName : "";
	const chainId = typeof raw.chainId === "string" ? raw.chainId : legacyChainName;

	// Normalize both new and legacy formats.
	let currentStepIndex: number | undefined;
	if (typeof raw.currentStepIndex === "number" && Number.isInteger(raw.currentStepIndex) && raw.currentStepIndex >= 0) {
		currentStepIndex = raw.currentStepIndex;
	}
	if (currentStepIndex === undefined && typeof raw.currentStepId === "string") {
		const parsed = Number.parseInt(raw.currentStepId, 10);
		if (Number.isInteger(parsed) && parsed >= 0) currentStepIndex = parsed;
	}
	if (raw.currentStepIndex === null || raw.isComplete === true) {
		// Legacy complete states used null index or explicit isComplete.
		currentStepIndex = Number.MAX_SAFE_INTEGER;
	}

	return {
		chainId,
		currentStepIndex: currentStepIndex ?? 0,
		startedAt,
	};
}

export function getLatestState(ctx: ExtensionContext): ChainRunState | undefined {
	let state: ChainRunState | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === STATE_ENTRY_TYPE) {
			state = normalizeState(entry.data);
		}
	}
	return state;
}

export function persistState(pi: ExtensionAPI, state: ChainRunState): void {
	pi.appendEntry<ChainRunState>(STATE_ENTRY_TYPE, state);
}

export function updateWidget(ctx: ExtensionContext, chain?: ChainDefinition, state?: ChainRunState): void {
	if (!chain || !state) {
		ctx.ui.setWidget("pi-chain", undefined);
		ctx.ui.setStatus("pi-chain", undefined);
		return;
	}

	const lines = chain.steps.map((step, index) => {
		const marker = isChainComplete(state, chain)
			? "[x]"
			: index < state.currentStepIndex
			? "[x]"
			: state.currentStepIndex === index
			? "[>]"
			: "[ ]";
		return `${marker} ${index + 1}. ${step.name}`;
	});

	ctx.ui.setWidget("pi-chain", [getChainLabel(chain), ...lines], { placement: "belowEditor" });
	ctx.ui.setStatus("pi-chain", `chain:${state.chainId}:${isChainComplete(state, chain) ? "done" : state.currentStepIndex + 1}`);
}
