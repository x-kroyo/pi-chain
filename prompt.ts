import fs from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getChainDirectory } from "./chain-files.ts";
import { buildSkillInjection, resolveStepSkills } from "./skills.ts";
import type { ChainDefinition, ChainStep } from "./types.ts";

export type BuiltStepPrompt = {
	prompt: string;
	missingSkills: string[];
};

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function resolveStepInstructions(step: ChainStep, cwd: string): string {
	if (hasText(step.instructions_file)) {
		const instructionPath = path.isAbsolute(step.instructions_file) ? step.instructions_file : path.join(cwd, step.instructions_file);
		return fs.readFileSync(instructionPath, "utf-8").trim();
	}
	if (hasText(step.instructions)) {
		return step.instructions.trim();
	}
	throw new Error("Step must define at least one instruction source: 'instructions_file' or 'instructions'");
}

export function buildStepPrompt(
	chain: ChainDefinition,
	step: ChainStep,
	ctx: ExtensionContext,
): BuiltStepPrompt {
	const stepReadLines = (step.reads ?? []).map((readPath) => `- ${readPath}`);
	const chainDirectory = getChainDirectory(chain.id, ctx.cwd);
	const resolvedInstructions = resolveStepInstructions(step, chainDirectory);
	const { resolved: resolvedSkills, missing: missingSkills } = resolveStepSkills(step.skills ?? [], ctx.cwd);

	const prompt = [
		((injection) => (injection ? `Resolved skill content:\n${injection}` : undefined))(
			buildSkillInjection(resolvedSkills),
		),
		stepReadLines.length > 0 ? `Read these files or paths before answering:\n${stepReadLines.join("\n")}` : undefined,
		`Project cwd: ${ctx.cwd}`,
		`Step instructions:\n${resolvedInstructions}`
	]
		.filter(Boolean)
		.join("\n\n");

	return { prompt, missingSkills };
}
