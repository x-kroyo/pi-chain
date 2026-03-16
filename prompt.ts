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

function resolveReadPath(readPath: string, cwd: string): string {
	return path.isAbsolute(readPath) ? readPath : path.join(cwd, readPath);
}

function readContextSnippet(readPath: string, cwd: string): string {
	const resolvedPath = resolveReadPath(readPath, cwd);
	try {
		const raw = fs.readFileSync(resolvedPath, "utf-8");
		const trimmed = raw.trim();
		if (!trimmed) {
			return `<read path="${readPath}" resolved="${resolvedPath}">\n[empty file]\n</read>`;
		}
		return `<read path="${readPath}" resolved="${resolvedPath}">\n${trimmed}\n</read>`;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return `<read path="${readPath}" resolved="${resolvedPath}">\n[unavailable: ${message}]\n</read>`;
	}
}

export function buildStepPrompt(
	chain: ChainDefinition,
	step: ChainStep,
	ctx: ExtensionContext,
): BuiltStepPrompt {
	const inlinedReads = (step.reads ?? []).map((readPath) => readContextSnippet(readPath, ctx.cwd));
	const chainDirectory = getChainDirectory(chain.id, ctx.cwd);
	const resolvedInstructions = resolveStepInstructions(step, chainDirectory);
	const { resolved: resolvedSkills, missing: missingSkills } = resolveStepSkills(step.skills ?? [], ctx.cwd);

	const prompt = [
		((injection) => (injection ? `Resolved skill content:\n${injection}` : undefined))(
			buildSkillInjection(resolvedSkills),
		),
		inlinedReads.length > 0 ? `Additional read context:\n${inlinedReads.join("\n\n")}` : undefined,
		`Project cwd: ${ctx.cwd}`,
		`Step instructions:\n${resolvedInstructions}`
	]
		.filter(Boolean)
		.join("\n\n");

	return { prompt, missingSkills };
}
