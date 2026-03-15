import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type ResolvedSkill = {
	name: string;
	content: string;
};

function stripFrontmatter(content: string): string {
	const normalized = content.replace(/\r\n/g, "\n");
	if (!normalized.startsWith("---")) return normalized.trim();
	const endIndex = normalized.indexOf("\n---", 3);
	if (endIndex === -1) return normalized.trim();
	return normalized.slice(endIndex + 4).trim();
}

function collectSkillFiles(root: string, found: Map<string, ResolvedSkill>): void {
	if (!fs.existsSync(root)) return;
	const entries = fs.readdirSync(root, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			const skillFile = path.join(fullPath, "SKILL.md");
			if (fs.existsSync(skillFile) && !found.has(entry.name)) {
				found.set(entry.name, {
					name: entry.name,
					content: stripFrontmatter(fs.readFileSync(skillFile, "utf-8")),
				});
				continue;
			}
			collectSkillFiles(fullPath, found);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".md")) {
			const skillName = entry.name.replace(/\.md$/i, "");
			if (!found.has(skillName)) {
				found.set(skillName, {
					name: skillName,
					content: stripFrontmatter(fs.readFileSync(fullPath, "utf-8")),
				});
			}
		}
	}
}

function discoverSkills(cwd: string): Map<string, ResolvedSkill> {
	const found = new Map<string, ResolvedSkill>();
	collectSkillFiles(path.join(cwd, ".pi", "skills"), found);
	collectSkillFiles(path.join(os.homedir(), ".pi", "agent", "skills"), found);
	return found;
}

export function resolveStepSkills(skillNames: string[], cwd: string): { resolved: ResolvedSkill[]; missing: string[] } {
	const available = discoverSkills(cwd);
	const resolved: ResolvedSkill[] = [];
	const missing: string[] = [];
	for (const rawName of skillNames) {
		const name = rawName.trim();
		if (!name) continue;
		const skill = available.get(name);
		if (skill) resolved.push(skill);
		else missing.push(name);
	}
	return { resolved, missing };
}

export function buildSkillInjection(skills: ResolvedSkill[]): string {
	if (skills.length === 0) return "";
	return skills
		.map((skill) => `<skill name="${skill.name}">\n${skill.content}\n</skill>`)
		.join("\n\n");
}
