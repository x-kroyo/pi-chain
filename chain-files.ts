import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { ChainDefinition } from "./types.ts";

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function getChainsDirectory(cwd: string = process.cwd()): string {
	return path.join(cwd, ".pi", "chains");
}

export function getChainDirectory(chainId: string, cwd: string = process.cwd()): string {
	return path.join(getChainsDirectory(cwd), chainId);
}

function validateStep(step: ChainDefinition["steps"][number], chainId: string, index: number): void {
	const stepLabel = `Chain step ${index + 1}`;

	if (!hasText(step.name)) {
		throw new Error(`${stepLabel} must define 'name': ${chainId}`);
	}
	if (!hasText(step.instructions) && !hasText(step.instructions_file)) {
		throw new Error(`${stepLabel} must define at least one of 'instructions_file' or 'instructions': ${chainId}`);
	}
	if (!hasText(step.model)) {
		throw new Error(`${stepLabel} has invalid 'model': ${chainId}`);
	}
	if (!hasText(step.model_provider)) {
		throw new Error(`${stepLabel} has invalid 'model_provider': ${chainId}`);
	}
	if (step.skills !== undefined && !Array.isArray(step.skills)) {
		throw new Error(`${stepLabel} has invalid 'skills': ${chainId}`);
	}
	if (step.reads !== undefined && !Array.isArray(step.reads)) {
		throw new Error(`${stepLabel} has invalid 'reads': ${chainId}`);
	}
	if (step.tools !== undefined && !Array.isArray(step.tools)) {
		throw new Error(`${stepLabel} has invalid 'tools': ${chainId}`);
	}
	if (step.model.includes("/")) {
		throw new Error(`${stepLabel} model must be a model id only (no provider/ prefix): ${chainId}`);
	}
}

export function getChainLabel(chain: ChainDefinition): string {
	return chain.name?.trim() || chain.id;
}

export function discoverChainIds(): string[] {
	const chainsDirectory = getChainsDirectory();
	if (!fs.existsSync(chainsDirectory)) return [];
	return fs
		.readdirSync(chainsDirectory, { withFileTypes: true })
		.filter((entry) => {
			if (!entry.isDirectory()) return false;
			const base = getChainDirectory(entry.name);
			return fs.existsSync(path.join(base, "chain.yaml"));
		})
		.map((entry) => entry.name)
		.sort();
}

export function loadChain(chainId: string): ChainDefinition {
	const chainFilePath = path.join(getChainDirectory(chainId), "chain.yaml");
	const rawChainFileContent = fs.readFileSync(chainFilePath, "utf-8");
	const parsedChainDefinition = YAML.parse(rawChainFileContent) as Omit<ChainDefinition, "id">;

	if (!parsedChainDefinition || typeof parsedChainDefinition !== "object" || !Array.isArray(parsedChainDefinition.steps)) {
		throw new Error(`Chain must define 'steps': ${chainId}`);
	}
	if (parsedChainDefinition.session !== undefined && parsedChainDefinition.session !== false && typeof parsedChainDefinition.session !== "string") {
		throw new Error(`Chain 'session' must be false or a directory string: ${chainId}`);
	}

	for (const [index, step] of parsedChainDefinition.steps.entries()) {
		validateStep(step, chainId, index);
	}

	return {
		...parsedChainDefinition,
		id: chainId,
	};
}

export function getNextStepIndex(chain: ChainDefinition, stepIndex: number | null): number | null {
	if (stepIndex === null) return chain.steps.length > 0 ? 0 : null;
	const nextIndex = stepIndex + 1;
	return nextIndex < chain.steps.length ? nextIndex : null;
}
