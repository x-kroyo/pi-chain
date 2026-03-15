import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { ChainDefinition } from "./types.ts";

const CHAINS_DIRECTORY = path.join(process.cwd(), ".pi", "chains");

export function getChainLabel(chain: ChainDefinition): string {
	return chain.name?.trim() || chain.id;
}

export function discoverChainIds(): string[] {
	if (!fs.existsSync(CHAINS_DIRECTORY)) return [];
	return fs
		.readdirSync(CHAINS_DIRECTORY, { withFileTypes: true })
		.filter((entry) => {
			if (!entry.isDirectory()) return false;
			const base = path.join(CHAINS_DIRECTORY, entry.name);
			return fs.existsSync(path.join(base, "chain.yaml"));
		})
		.map((entry) => entry.name)
		.sort();
}

export function loadChain(chainId: string): ChainDefinition {
	const chainFilePath = path.join(CHAINS_DIRECTORY, chainId, "chain.yaml");
	const rawChainFileContent = fs.readFileSync(chainFilePath, "utf-8");
	const parsedChainDefinition = YAML.parse(rawChainFileContent) as Omit<ChainDefinition, "id">;

	if (!parsedChainDefinition || typeof parsedChainDefinition !== "object" || !Array.isArray(parsedChainDefinition.steps)) {
		throw new Error(`Chain must define 'steps': ${chainId}`);
	}
	if (parsedChainDefinition.session !== undefined && parsedChainDefinition.session !== false && typeof parsedChainDefinition.session !== "string") {
		throw new Error(`Chain 'session' must be false or a directory string: ${chainId}`);
	}

	for (const [index, step] of parsedChainDefinition.steps.entries()) {
		if (!step.name || !step.prompt) {
			throw new Error(`Chain step ${index + 1} must define 'name' and 'prompt': ${chainId}`);
		}
		if (typeof step.model !== "string" || step.model.trim().length === 0) {
			throw new Error(`Chain step ${index + 1} has invalid 'model': ${chainId}`);
		}
		if (typeof step.model_provider !== "string" || step.model_provider.trim().length === 0) {
			throw new Error(`Chain step ${index + 1} has invalid 'model_provider': ${chainId}`);
		}
		if (step.skills !== undefined && !Array.isArray(step.skills)) {
			throw new Error(`Chain step ${index + 1} has invalid 'skills': ${chainId}`);
		}
		if (step.reads !== undefined && !Array.isArray(step.reads)) {
			throw new Error(`Chain step ${index + 1} has invalid 'reads': ${chainId}`);
		}
		if (step.tools !== undefined && !Array.isArray(step.tools)) {
			throw new Error(`Chain step ${index + 1} has invalid 'tools': ${chainId}`);
		}
		if (step.model.includes("/")) {
			throw new Error(
				`Chain step ${index + 1} model must be a model id only (no provider/ prefix): ${chainId}`,
			);
		}
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
