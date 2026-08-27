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
  stockExportRendering: boolean;
};

export type CalmPreference = {
  active: boolean;
  thinking: boolean;
};

export type SyntheticPresentation = {
  content: string;
  kind?: string;
};

/** Default: calm on, thinking hidden, Working... always on. */
export const DEFAULT_CALM_PREFERENCE: CalmPreference = {
  active: true,
  thinking: false,
};

let calm = DEFAULT_CALM_PREFERENCE.active;
let thinkingVisible = DEFAULT_CALM_PREFERENCE.thinking;
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

export function setCalmStockExportRendering(active: boolean): void {
  stockExportRendering = active;
}

export function calmPresentationIsActive(): boolean {
  return calm;
}

export function calmThinkingIsVisible(): boolean {
  return thinkingVisible;
}

export function getCalmPreference(): CalmPreference {
  return { active: calm, thinking: thinkingVisible };
}

/**
 * Apply a full preference snapshot to the in-memory presentation flags.
 * Does not touch stockExportRendering.
 */
export function applyCalmPreference(preference: CalmPreference): void {
  calm = preference.active;
  thinkingVisible = preference.thinking;
}

export function calmPresentationHides(itemClass: CalmTranscriptClass): boolean {
  return (
    calm && !stockExportRendering && !calmTranscriptClassIsVisible(itemClass)
  );
}

/**
 * Parse preference file contents.
 * Supported:
 *   on              → calm on, thinking hidden (default shape)
 *   on thinking     → calm on, thinking / CoT shown
 *   off             → calm off
 * Legacy bare "on" / "off" (with optional trailing whitespace/newlines) still work.
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
    return { active: false, thinking: false };
  }

  if (
    normalized === "on thinking" ||
    normalized === "on+thinking" ||
    normalized === "on thinking:on" ||
    normalized === "on thinking=on"
  ) {
    return { active: true, thinking: true };
  }

  if (normalized === "on" || normalized.startsWith("on ")) {
    // "on" or "on thinking off" etc. — only explicit thinking tokens enable CoT
    const thinking =
      /\bthinking\b/.test(normalized) &&
      !/\bthinking\s*(:|=)?\s*off\b/.test(normalized) &&
      !/\bthinking\s+hidden\b/.test(normalized);
    return { active: true, thinking };
  }

  return { ...DEFAULT_CALM_PREFERENCE };
}

export function serializeCalmPreference(preference: CalmPreference): string {
  if (!preference.active) return "off\n";
  if (preference.thinking) return "on thinking\n";
  return "on\n";
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
