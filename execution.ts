import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { buildStepPrompt } from "./prompt.ts";
import type { ChainDefinition, ChainStep } from "./types.ts";

async function applyStepModel(pi: ExtensionAPI, step: ChainStep, ctx: ExtensionCommandContext): Promise<void> {
	if (!step.model) return;

	const model = ctx.modelRegistry.find(step.model_provider, step.model);
	if (!model) {
		ctx.ui.notify(`Chain model '${step.model_provider}/${step.model}' was not found.`, "warning");
		return;
	}

	const success = await pi.setModel(model);
	if (!success) {
		ctx.ui.notify(`No API key available for chain model '${model.provider}/${model.id}'.`, "warning");
	}
}

export async function executeStep(
	pi: ExtensionAPI,
	chain: ChainDefinition,
	step: ChainStep,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const { prompt, missingSkills } = buildStepPrompt(chain, step, ctx);
	if (missingSkills.length > 0) {
		ctx.ui.notify(`Missing skills for step '${step.name}': ${missingSkills.join(", ")}`, "warning");
	}

	pi.setActiveTools(step.tools ?? []);
	await applyStepModel(pi, step, ctx);
	if (step.thinking) {
		pi.setThinkingLevel(step.thinking);
	}

	ctx.ui.setWorkingMessage(`Running chain step ${step.name}...`);
	try {
		pi.sendUserMessage(prompt);
		await ctx.waitForIdle();
	} finally {
		ctx.ui.setWorkingMessage();
	}
}
