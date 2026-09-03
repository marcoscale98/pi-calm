/**
 * Zero-height tool-row presentation adapter.
 *
 * registerTool() can lose to another extension under Pi's first-wins tool
 * ownership. This adapter patches ToolExecutionComponent.render so every
 * tool row—built-in or user-defined—stays hidden under Calm, except for
 * read rows targeting SKILL.md when `/calm skills` is enabled. In
 * `/calm no-built-ins` mode, only the fixed built-in-name denylist is hidden.
 *
 * Presentation only. Execution, results, and session storage are unchanged.
 */
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { calmToolCallIsVisible } from "./visibility.ts";

type ToolExecutionPresentation = {
  toolName?: unknown;
  args?: unknown;
  render(width: number): string[];
};

type CalmToolExecutionLayoutPatch = {
  isToolCallVisible: (toolName: unknown, args: unknown) => boolean;
};

const CALM_TOOL_EXECUTION_LAYOUT_PATCH = Symbol.for(
  "pi-calm:tool-execution-layout:pi-0.81.1",
);

export function installCalmToolExecutionLayout(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmToolExecutionLayoutPatch | undefined;
  };
  const isToolCallVisible = (toolName: unknown, args: unknown): boolean =>
    calmToolCallIsVisible(toolName, args);
  const installed = registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH];
  if (installed) {
    installed.isToolCallVisible = isToolCallVisible;
    return;
  }

  const patch: CalmToolExecutionLayoutPatch = { isToolCallVisible };
  const ToolExecutionComponent = (
    PiCodingAgent as typeof PiCodingAgent & {
      ToolExecutionComponent?: new (...args: never[]) => ToolExecutionPresentation;
    }
  ).ToolExecutionComponent;
  if (typeof ToolExecutionComponent !== "function") {
    throw new Error("pi-calm requires Pi ToolExecutionComponent");
  }

  const prototype =
    ToolExecutionComponent.prototype as unknown as ToolExecutionPresentation;
  const originalRender = prototype.render;
  if (typeof originalRender !== "function") {
    throw new Error("pi-calm requires Pi ToolExecutionComponent.render");
  }

  prototype.render = function (
    this: ToolExecutionPresentation,
    width: number,
  ): string[] {
    if (!patch.isToolCallVisible(this.toolName, this.args)) {
      return [];
    }
    return originalRender.call(this, width);
  };

  registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH] = patch;
}
