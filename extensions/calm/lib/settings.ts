/**
 * TUI settings panel for `/calm` with no arguments.
 *
 * Mirrors Pi's native `/settings` list: SettingsList + getSettingsListTheme,
 * true/false toggles, immediate apply. Working... is intentionally absent.
 */
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import {
  getCalmPreference,
  type CalmPreference,
} from "./visibility.ts";

export const CALM_SETTING_TRUE = "true";
export const CALM_SETTING_FALSE = "false";
export const CALM_SETTING_VALUES = [
  CALM_SETTING_TRUE,
  CALM_SETTING_FALSE,
] as const;

export const CALM_SETTING_IDS = [
  "calm",
  "thinking",
  "skills",
  "no-built-ins",
] as const;

export type CalmSettingId = (typeof CALM_SETTING_IDS)[number];

export type CalmCommandResolution =
  | { kind: "settings" }
  | { kind: "preference"; next: CalmPreference }
  | { kind: "invalid" };

function settingValue(enabled: boolean): string {
  return enabled ? CALM_SETTING_TRUE : CALM_SETTING_FALSE;
}

function parseSettingValue(value: string): boolean | undefined {
  if (value === CALM_SETTING_TRUE) return true;
  if (value === CALM_SETTING_FALSE) return false;
  return undefined;
}

export function isCalmSettingsCommand(argument: string): boolean {
  return argument.trim() === "";
}

export function canOpenCalmSettingsPanel(ctx: {
  hasUI: boolean;
  mode?: string;
}): boolean {
  if (!ctx.hasUI) return false;
  if (ctx.mode !== undefined) return ctx.mode === "tui";
  return true;
}

export function getCalmSettingsItems(
  preference: CalmPreference,
): SettingItem[] {
  return [
    {
      id: "calm",
      label: "Calm",
      description:
        "Hide tool chatter and optional thinking while keeping the conversation and Working... visible",
      currentValue: settingValue(preference.active),
      values: [...CALM_SETTING_VALUES],
    },
    {
      id: "thinking",
      label: "Thinking / CoT",
      description: "Show thinking / CoT blocks while Calm is on",
      currentValue: settingValue(preference.thinking),
      values: [...CALM_SETTING_VALUES],
    },
    {
      id: "skills",
      label: "SKILL.md reads",
      description: "Show read tool rows that target SKILL.md while Calm is on",
      currentValue: settingValue(preference.skills),
      values: [...CALM_SETTING_VALUES],
    },
    {
      id: "no-built-ins",
      label: "No built-ins",
      description:
        "Hide only fixed-name built-in tool rows instead of all tool shells",
      currentValue: settingValue(preference.noBuiltIns),
      values: [...CALM_SETTING_VALUES],
    },
  ];
}

export function applyCalmSettingsChange(
  id: string,
  newValue: string,
  current: CalmPreference,
): CalmPreference | undefined {
  const enabled = parseSettingValue(newValue);
  if (enabled === undefined) return undefined;

  switch (id) {
    case "calm":
      return { ...current, active: enabled };
    case "thinking":
      return { ...current, thinking: enabled };
    case "skills":
      return { ...current, skills: enabled };
    case "no-built-ins":
      return { ...current, noBuiltIns: enabled };
    default:
      return undefined;
  }
}

export async function openCalmSettingsPanel(
  ctx: ExtensionCommandContext,
  onPreferenceChange: (preference: CalmPreference) => void,
): Promise<void> {
  await ctx.ui.custom((tui, theme, _kb, done) => {
    const items: SettingItem[] = getCalmSettingsItems(getCalmPreference());

    const container = new Container();
    container.addChild(
      new (class {
        render(_width: number) {
          return [theme.fg("accent", theme.bold("Calm")), ""];
        }
        invalidate() {}
      })(),
    );

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 15),
      getSettingsListTheme(),
      (id, newValue) => {
        const next = applyCalmSettingsChange(id, newValue, getCalmPreference());
        if (!next) return;
        onPreferenceChange(next);
      },
      () => {
        done(undefined);
      },
    );

    container.addChild(settingsList);

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput?.(data);
        tui.requestRender();
      },
    };
  });
}
