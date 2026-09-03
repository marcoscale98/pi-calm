/**
 * pi-calm — conversation-only transcript presentation for the Pi coding agent.
 *
 * Ported from Firstmate's `/calm` extension (kunchenguid/firstmate) for general
 * use. On by default. Preference persists under the Pi agent dir.
 *
 * While active:
 *   - genuine user prompts stay visible
 *   - genuine assistant text stays visible
 *   - Pi's built-in Working... activity is always visible and cannot be turned off
 *   - thinking / CoT blocks are hidden by default; `/calm thinking` shows them
 *   - reads of `SKILL.md` stay hidden by default; `/calm skills` shows them
 *   - all tool shells (built-in and user-defined) are removed from the transcript,
 *     or only fixed-name built-in tool shells with `/calm no-built-ins`
 *   - operational user rows marked with U+2063 envelopes render at zero height
 *
 * Presentation only. Delivery, tool execution, model context, session storage,
 * and /export /share content are unchanged. Export/share briefly restore stock
 * rendering for the serialization pass.
 *
 * Install:
 *   pi install /absolute/path/to/calm-mode
 *   # or copy extensions/calm → ~/.pi/agent/extensions/calm
 *   # or: pi -e ./extensions/calm/index.ts
 *
 * Usage:
 *   /calm on [thinking|skills|no-built-ins ...]
 *                      Calm on; distinct modifiers may be combined in any order
 *   /calm thinking|skills|no-built-ins [...]
 *                      Toggle one or more modifiers in any order
 *   /calm off          Calm off; must be used alone
 *
 * `on` and `off` cannot be combined; `off` cannot be combined with modifiers;
 * unknown and repeated arguments are rejected.
 *
 * Verified against Pi 0.81.1–0.82.1. Adapters probe the exact APIs they patch
 * and degrade independently if a future Pi removes a seam.
 */
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getKeybindings, type AutocompleteItem } from "@earendil-works/pi-tui";
import { installCalmAssistantLayout } from "./lib/assistant-layout.ts";
import { installCalmOperationalUserLayout } from "./lib/operational-user-layout.ts";
import { installCalmToolExecutionLayout } from "./lib/tool-execution-layout.ts";
import { installCalmWorkingLock } from "./lib/working-lock.ts";
import {
  applyCalmPreference,
  CALM_PRESENTATION_EVENT,
  DEFAULT_CALM_PREFERENCE,
  getCalmPreference,
  parseCalmPreference,
  registerSyntheticPresentation,
  serializeCalmPreference,
  setCalmStockExportRendering,
  type CalmPreference,
} from "./lib/visibility.ts";

// Each presentation adapter probes the exact Pi API it patches. If a future Pi
// removes that API, only the affected adapter degrades.
function installCalmPresentationAdapter(name: string, install: () => void): void {
  try {
    install();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `pi-calm: ${name} presentation adapter unavailable, skipping. ${reason}`,
    );
  }
}

function describeCalmState(preference: CalmPreference): string {
  if (!preference.active) return "Calm off — ordinary transcript restored";
  const shown = [
    preference.thinking ? "thinking" : undefined,
    preference.skills ? "skill reads" : undefined,
  ].filter(Boolean);
  const hiddenTools = preference.noBuiltIns ? "built-in tools" : "tools";
  return shown.length > 0
    ? `Calm on — ${hiddenTools} hidden, ${shown.join(" and ")} shown`
    : `Calm on — ${hiddenTools} and thinking hidden`;
}

const CALM_ARGUMENTS = new Set([
  "on",
  "off",
  "thinking",
  "skills",
  "no-built-ins",
]);

export function getCalmPreferenceForCommand(
  argument: string,
  current: CalmPreference,
): CalmPreference | undefined {
  const normalized = argument.trim().toLowerCase();
  const tokens = normalized ? normalized.split(/\s+/) : [];
  if (
    tokens.length === 0 ||
    tokens.some((token) => !CALM_ARGUMENTS.has(token)) ||
    new Set(tokens).size !== tokens.length ||
    (tokens.includes("off") && tokens.length > 1)
  ) {
    return undefined;
  }

  if (tokens.includes("off")) {
    return {
      active: false,
      thinking: false,
      skills: false,
      noBuiltIns: false,
    };
  }

  const base = tokens.includes("on")
    ? { thinking: false, skills: false, noBuiltIns: false }
    : current.active
      ? {
          thinking: current.thinking,
          skills: current.skills,
          noBuiltIns: current.noBuiltIns ?? false,
        }
      : { thinking: false, skills: false, noBuiltIns: false };
  return {
    active: true,
    thinking: tokens.includes("thinking") ? !base.thinking : base.thinking,
    skills: tokens.includes("skills") ? !base.skills : base.skills,
    noBuiltIns: tokens.includes("no-built-ins")
      ? !base.noBuiltIns
      : base.noBuiltIns,
  };
}

const CALM_MODIFIER_SUBSETS = [
  ["thinking"],
  ["skills"],
  ["no-built-ins"],
  ["thinking", "skills"],
  ["thinking", "no-built-ins"],
  ["skills", "no-built-ins"],
  ["thinking", "skills", "no-built-ins"],
] as const;

function getArgumentPermutations(tokens: readonly string[]): string[][] {
  if (tokens.length <= 1) return [Array.from(tokens)];
  return tokens.flatMap((token, index) =>
    getArgumentPermutations([
      ...tokens.slice(0, index),
      ...tokens.slice(index + 1),
    ]).map((rest) => [token, ...rest]),
  );
}

const CALM_ON_ARGUMENTS: AutocompleteItem[] = CALM_MODIFIER_SUBSETS.flatMap(
  (modifiers) =>
    getArgumentPermutations(["on", ...modifiers]).map((tokens) => {
      const value = tokens.join(" ");
      return {
        value,
        label: value,
        description: "Enable Calm and toggle these modifiers in any order",
      };
    }),
);

const CALM_COMMAND_ARGUMENTS: AutocompleteItem[] = [
  {
    value: "on",
    label: "on",
    description: "Enable Calm and hide thinking",
  },
  {
    value: "thinking",
    label: "thinking",
    description: "Keep Calm on and toggle thinking / CoT",
  },
  {
    value: "skills",
    label: "skills",
    description: "Keep Calm on and toggle SKILL.md reads",
  },
  {
    value: "no-built-ins",
    label: "no-built-ins",
    description: "Keep Calm on and hide only built-in tool rows",
  },
  {
    value: "off",
    label: "off",
    description: "Disable Calm",
  },
  {
    value: "thinking skills",
    label: "thinking skills",
    description: "Keep Calm on and toggle thinking / CoT and SKILL.md reads",
  },
  {
    value: "thinking no-built-ins",
    label: "thinking no-built-ins",
    description: "Toggle thinking / CoT and hide only built-in tool rows",
  },
  {
    value: "no-built-ins thinking",
    label: "no-built-ins thinking",
    description: "Hide only built-in tool rows and toggle thinking / CoT",
  },
  {
    value: "no-built-ins skills",
    label: "no-built-ins skills",
    description: "Hide only built-in tool rows and toggle SKILL.md reads",
  },
  {
    value: "skills no-built-ins",
    label: "skills no-built-ins",
    description: "Toggle SKILL.md reads and hide only built-in tool rows",
  },
  {
    value: "skills thinking",
    label: "skills thinking",
    description: "Toggle SKILL.md reads and thinking / CoT",
  },
  {
    value: "thinking skills no-built-ins",
    label: "thinking skills no-built-ins",
    description:
      "Toggle thinking / CoT, SKILL.md reads, and hide only built-in tool rows",
  },
  {
    value: "thinking no-built-ins skills",
    label: "thinking no-built-ins skills",
    description:
      "Toggle thinking / CoT, hide only built-in tool rows, and SKILL.md reads",
  },
  {
    value: "skills thinking no-built-ins",
    label: "skills thinking no-built-ins",
    description:
      "Toggle SKILL.md reads, thinking / CoT, and hide only built-in tool rows",
  },
  {
    value: "skills no-built-ins thinking",
    label: "skills no-built-ins thinking",
    description:
      "Toggle SKILL.md reads, hide only built-in tool rows, and thinking / CoT",
  },
  {
    value: "no-built-ins thinking skills",
    label: "no-built-ins thinking skills",
    description:
      "Hide only built-in tool rows and toggle thinking / CoT and SKILL.md reads",
  },
  {
    value: "no-built-ins skills thinking",
    label: "no-built-ins skills thinking",
    description:
      "Hide only built-in tool rows and toggle SKILL.md reads and thinking / CoT",
  },
  ...CALM_ON_ARGUMENTS,
];

export function getCalmArgumentCompletions(
  argumentPrefix: string,
): AutocompleteItem[] | null {
  const prefix = argumentPrefix.trimStart().toLowerCase();
  const matches = CALM_COMMAND_ARGUMENTS.filter((item) =>
    item.value.startsWith(prefix),
  );
  return matches.length > 0 ? matches : null;
}

export default function (pi: ExtensionAPI) {
  installCalmPresentationAdapter("collapsed-thinking", installCalmAssistantLayout);
  installCalmPresentationAdapter(
    "operational-user-row",
    installCalmOperationalUserLayout,
  );
  // Hide every non-skill tool row regardless of ownership.
  installCalmPresentationAdapter("tool-row", installCalmToolExecutionLayout);
  // Working... is non-optional chrome for this package.
  installCalmPresentationAdapter("working-lock", installCalmWorkingLock);

  let exportRendering = false;
  let removeTerminalInputHandler: (() => void) | undefined;

  // Persist under the Pi agent dir so the preference survives sessions.
  // Override with PI_CALM_PREFERENCE_PATH if needed.
  const preferencePath =
    process.env.PI_CALM_PREFERENCE_PATH ||
    resolve(getAgentDir(), "calm");

  const loadCalmPreference = (): CalmPreference => {
    try {
      return parseCalmPreference(readFileSync(preferencePath, "utf8"));
    } catch {
      // Missing file → default on.
      return { ...DEFAULT_CALM_PREFERENCE };
    }
  };

  const persistCalmPreference = (preference: CalmPreference): void => {
    mkdirSync(dirname(preferencePath), { recursive: true });
    const temporaryPath = `${preferencePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, serializeCalmPreference(preference), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      renameSync(temporaryPath, preferencePath);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  };

  const publishPresentationState = (): void => {
    const preference = getCalmPreference();
    pi.events.emit(CALM_PRESENTATION_EVENT, {
      active: preference.active,
      thinking: preference.thinking,
      skills: preference.skills,
      noBuiltIns: preference.noBuiltIns,
      stockExportRendering: exportRendering,
    });
  };

  const applyAndRefresh = (
    preference: CalmPreference,
    ctx: ExtensionCommandContext | { ui: ExtensionCommandContext["ui"] },
  ): void => {
    applyCalmPreference(preference);
    publishPresentationState();
    // Working... is always forced on.
    ctx.ui.setWorkingVisible(true);
    // When calm hides thinking we blank the collapsed label; otherwise restore
    // Pi's default so expanded CoT / labels render normally.
    // Toggle the label once so existing AssistantMessageComponent rows re-run
    // updateContent through the calm patch (setHiddenThinkingLabel re-renders).
    const calmQuietThinking = preference.active && !preference.thinking;
    ctx.ui.setHiddenThinkingLabel(calmQuietThinking ? undefined : "");
    ctx.ui.setHiddenThinkingLabel(calmQuietThinking ? "" : undefined);
    ctx.ui.setStatus("pi-calm", undefined);

    // Rebuild controllable rows, preserve Ctrl+O expansion state.
    const expanded = ctx.ui.getToolsExpanded();
    ctx.ui.setToolsExpanded(!expanded);
    ctx.ui.setToolsExpanded(expanded);
  };

  const setPreference = (
    preference: CalmPreference,
    ctx: ExtensionCommandContext,
    notify = true,
  ): void => {
    persistCalmPreference(preference);
    applyAndRefresh(preference, ctx);
    if (notify && ctx.hasUI) {
      ctx.ui.notify(describeCalmState(preference), "info");
    }
  };

  registerSyntheticPresentation(pi);

  pi.on("session_start", (_event, ctx) => {
    exportRendering = false;
    setCalmStockExportRendering(false);
    applyAndRefresh(loadCalmPreference(), ctx);
    removeTerminalInputHandler?.();
    removeTerminalInputHandler = ctx.ui.onTerminalInput((data) => {
      if (!getKeybindings().matches(data, "tui.input.submit")) {
        return undefined;
      }

      const input = ctx.ui.getEditorText().trim();
      if (
        input !== "/share" &&
        input !== "/export" &&
        !input.startsWith("/export ")
      ) {
        return undefined;
      }

      // Briefly restore stock rendering so export/share capture full chrome.
      exportRendering = true;
      setCalmStockExportRendering(true);
      publishPresentationState();
      setTimeout(() => {
        exportRendering = false;
        setCalmStockExportRendering(false);
        publishPresentationState();
        // Force controllable rows to rebuild, then restore Ctrl+O state.
        const expanded = ctx.ui.getToolsExpanded();
        ctx.ui.setToolsExpanded(!expanded);
        ctx.ui.setToolsExpanded(expanded);
        // Re-assert Working... after export serialization.
        ctx.ui.setWorkingVisible(true);
      }, 0);

      // Do not consume the submit key; Pi still needs to execute /share or /export.
      return undefined;
    });
  });

  pi.registerCommand("calm", {
    description:
      "Calm transcript: /calm on, optionally with thinking/skills/no-built-ins in any order; or combine those modifiers without on. /calm off must be used alone. on and off, off and modifiers, unknown, or repeated arguments are invalid. Working... always stays on.",
    getArgumentCompletions: getCalmArgumentCompletions,
    handler: async (args, ctx) => {
      const next = getCalmPreferenceForCommand(args, getCalmPreference());
      if (next) {
        setPreference(next, ctx);
        return;
      }

      if (ctx.hasUI) {
        ctx.ui.notify(
          "Usage: /calm on [thinking|skills|no-built-ins ...] (distinct modifiers, any order) | combine thinking, skills, and no-built-ins in any order | /calm off (alone). Invalid: on with off, off with modifiers, unknown or repeated arguments.",
          "warning",
        );
      }
    },
  });
}
