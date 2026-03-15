import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { buildSkillInjection, resolveStepSkills } from "./skills.ts";
import type { ChainStep } from "./types.ts";

export type BuiltStepPrompt = {
	prompt: string;
	missingSkills: string[];
};

export function buildStepPrompt(
	step: ChainStep,
	ctx: ExtensionContext,
): BuiltStepPrompt {

	const stepReadLines = (step.reads ?? []).map((readPath) => `- ${readPath}`);
	const resolvedPrompt = step.prompt.trim();
	const { resolved: resolvedSkills, missing: missingSkills } = resolveStepSkills(step.skills ?? [], ctx.cwd);

	const prompt = [
		((injection) => (injection ? `Resolved skill content:\n${injection}` : undefined))(
			buildSkillInjection(resolvedSkills),
		),
		stepReadLines.length > 0 ? `Read these files or paths before answering:\n${stepReadLines.join("\n")}` : undefined,
		`Project cwd: ${ctx.cwd}`,
		`Step instructions:\n${resolvedPrompt}`
	]
		.filter(Boolean)
		.join("\n\n");

	return { prompt, missingSkills };
}
