import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { discoverChainIds } from "./chain-files.ts";
import { handleChainCommand, refreshChainUI } from "./chain-runner.ts";

export default function registerChain(pi: ExtensionAPI): void {
	for (const chainId of discoverChainIds()) {
		pi.registerCommand(`chain:${chainId}`, {
			description: `Run chain '${chainId}'`,
			handler: async (args, ctx) => handleChainCommand(chainId, args, pi, ctx),
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		refreshChainUI(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		refreshChainUI(ctx);
	});

	pi.on("session_fork", async (_event, ctx) => {
		refreshChainUI(ctx);
	});
}
