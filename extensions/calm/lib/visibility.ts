import { basename } from "node:path";
import {
  getMarkdownTheme,
  type ExtensionAPI,
  UserMessageComponent,
} from "@earendil-works/pi-coding-agent";

/** Audited transcript classes Calm may control when Pi exposes a renderer. */
export const CALM_TRANSCRIPT_CLASSES = [
  "genuine-user-prompt",
  "genuine-agent-response",
  "assistant-thinking",
  "assistant-tool-call",
  "tool-result",
  "tool-image",
  "user-bash",
  "skill-invocation",
  "custom-message",
  "custom-entry",
  "compaction-summary",
  "branch-summary",
  "working-status",
  "command-status",
  "system-notice",
  "cache-notice",
  "project-trust-warning",
  "synthetic-user",
  "synthetic-assistant",
  "unknown",
] as const;

export type CalmTranscriptClass = (typeof CALM_TRANSCRIPT_CLASSES)[number];

/** Classes that stay visible while Calm is active (thinking is optional). */
const CALM_VISIBLE_CLASSES = new Set<CalmTranscriptClass>([
  "genuine-user-prompt",
  "genuine-agent-response",
  "working-status",
]);

/**
 * Legacy custom-entry type from early Firstmate Calm sessions.
 * Current operational input stays ordinary user-role messages.
 */
export const CALM_SYNTHETIC_PRESENTATION_TYPE =
  "firstmate-synthetic-input-presentation";

/** Cross-extension presentation state event. */
export const CALM_PRESENTATION_EVENT = "pi-calm:presentation";

export type CalmPresentationState = {
  active: boolean;
  /** When calm is on, whether thinking / CoT blocks are shown. */
  thinking: boolean;
  /** When calm is on, whether SKILL.md read rows are shown. */
  skills: boolean;
  /** When calm is on, whether only built-in tool rows are hidden. */
  noBuiltIns: boolean;
  stockExportRendering: boolean;
};

export type CalmPreference = {
  active: boolean;
  thinking: boolean;
  skills: boolean;
  noBuiltIns: boolean;
};

export type SyntheticPresentation = {
  content: string;
  kind?: string;
};

/** Default: calm on, thinking hidden, Working... always on. */
export const DEFAULT_CALM_PREFERENCE: CalmPreference = {
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: false,
};

let calm = DEFAULT_CALM_PREFERENCE.active;
let thinkingVisible = DEFAULT_CALM_PREFERENCE.thinking;
let skillsVisible = DEFAULT_CALM_PREFERENCE.skills;
let noBuiltIns = DEFAULT_CALM_PREFERENCE.noBuiltIns;
let stockExportRendering = false;

export function calmTranscriptClassIsVisible(
  itemClass: CalmTranscriptClass,
): boolean {
  if (itemClass === "assistant-thinking" && thinkingVisible) return true;
  return CALM_VISIBLE_CLASSES.has(itemClass);
}

export function setCalmPresentation(active: boolean): void {
  calm = active;
}

export function setCalmThinkingVisible(visible: boolean): void {
  thinkingVisible = visible;
}

export function setCalmSkillsVisible(visible: boolean): void {
  skillsVisible = visible;
}

export function setCalmStockExportRendering(active: boolean): void {
  stockExportRendering = active;
}

export function calmPresentationIsActive(): boolean {
  return calm;
}

export function calmThinkingIsVisible(): boolean {
  return thinkingVisible;
}

export function calmSkillsAreVisible(): boolean {
  return skillsVisible;
}

export function getCalmPreference(): CalmPreference {
  return {
    active: calm,
    thinking: thinkingVisible,
    skills: skillsVisible,
    noBuiltIns,
  };
}

/**
 * Apply a full preference snapshot to the in-memory presentation flags.
 * Does not touch stockExportRendering.
 */
export function applyCalmPreference(preference: CalmPreference): void {
  calm = preference.active;
  thinkingVisible = preference.thinking;
  skillsVisible = preference.skills;
  noBuiltIns = preference.noBuiltIns ?? false;
}

export function calmPresentationHides(itemClass: CalmTranscriptClass): boolean {
  return (
    calm && !stockExportRendering && !calmTranscriptClassIsVisible(itemClass)
  );
}

/** Return whether a read call targets a skill definition file. */
export function isSkillReadToolCall(
  toolName: unknown,
  args: unknown,
): boolean {
  if (toolName !== "read" || typeof args !== "object" || args === null) {
    return false;
  }

  const rawPath = (args as { file_path?: unknown; path?: unknown }).file_path ??
    (args as { path?: unknown }).path;
  return typeof rawPath === "string" && basename(rawPath) === "SKILL.md";
}

/** Fixed built-in tool names hidden by the no-built-ins mode. */
export const CALM_NO_BUILT_INS_TOOL_NAMES: ReadonlySet<string> = new Set([
  "read",
  "bash",
  "powershell",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
]);

/** Tool-row policy: default Calm shows skill reads; no-built-ins shows non-built-in tools. */
export function calmToolCallIsVisible(
  toolName: unknown,
  args: unknown,
): boolean {
  if (!calm || stockExportRendering) return true;
  if (skillsVisible && isSkillReadToolCall(toolName, args)) return true;
  if (!noBuiltIns) return false;
  return (
    typeof toolName !== "string" ||
    !CALM_NO_BUILT_INS_TOOL_NAMES.has(toolName)
  );
}

/**
 * Parse preference file contents.
 * Supported:
 *   on                   → calm on, thinking and skill reads hidden
 *   on thinking          → calm on, thinking shown, skill reads hidden
 *   on skills            → calm on, thinking hidden, skill reads shown
 *   on no-built-ins      → calm on, built-in tool rows hidden
 *   on thinking skills   → calm on, thinking and skill reads shown
 *   off                  → calm off
 * Existing preference values such as "on thinking:on" remain compatible.
 * Missing / empty / unreadable → DEFAULT_CALM_PREFERENCE (on).
 */
export function parseCalmPreference(text: string): CalmPreference {
  const normalized = text
    .trim()
    .toLowerCase()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");

  if (!normalized) return { ...DEFAULT_CALM_PREFERENCE };

  if (normalized === "off") {
    return {
      active: false,
      thinking: false,
      skills: false,
      noBuiltIns: false,
    };
  }

  // Keep the historical compact form accepted by older preference files.
  if (normalized === "on+thinking") {
    return {
      active: true,
      thinking: true,
      skills: false,
      noBuiltIns: false,
    };
  }

  if (normalized === "on" || normalized.startsWith("on ")) {
    // Only explicit tokens enable optional Calm presentation features.
    const thinking =
      /\bthinking\b/.test(normalized) &&
      !/\bthinking\s*(:|=)?\s*off\b/.test(normalized) &&
      !/\bthinking\s+hidden\b/.test(normalized);
    const skills =
      /\bskills\b/.test(normalized) &&
      !/\bskills\s*(:|=)?\s*off\b/.test(normalized) &&
      !/\bskills\s+hidden\b/.test(normalized);
    const noBuiltIns = /\bno-built-ins\b/.test(normalized);
    return { active: true, thinking, skills, noBuiltIns };
  }

  return { ...DEFAULT_CALM_PREFERENCE };
}

export function serializeCalmPreference(preference: CalmPreference): string {
  if (!preference.active) return "off\n";
  const options = [
    preference.noBuiltIns ? "no-built-ins" : undefined,
    preference.thinking ? "thinking" : undefined,
    preference.skills ? "skills" : undefined,
  ].filter(Boolean);
  return `on${options.length > 0 ? ` ${options.join(" ")}` : ""}\n`;
}

/**
 * Register a zero-height-capable renderer for legacy synthetic custom entries.
 * When Calm is on, returning undefined drops the complete row with no residual spacer.
 */
export function registerSyntheticPresentation(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<SyntheticPresentation>(
    CALM_SYNTHETIC_PRESENTATION_TYPE,
    (entry) => {
      if (calmPresentationHides("synthetic-user")) return undefined;
      const data = entry.data;
      if (!data || typeof data.content !== "string") return undefined;
      return new UserMessageComponent(data.content, getMarkdownTheme());
    },
  );
}
