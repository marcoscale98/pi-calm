/**
 * Zero-height tool-row presentation adapter.
 *
 * registerTool() can lose to another extension under Pi's first-wins tool
 * ownership. This adapter patches ToolExecutionComponent.render so every
 * tool row—built-in or user-defined—stays hidden under Calm regardless of
 * which extension owns the tool definition.
 *
 * Presentation only. Execution, results, and session storage are unchanged.
 */
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { calmPresentationHides } from "./visibility.ts";

type ToolExecutionPresentation = {
  render(width: number): string[];
};

type CalmToolExecutionLayoutPatch = {
  hidesTools: () => boolean;
};

const CALM_TOOL_EXECUTION_LAYOUT_PATCH = Symbol.for(
  "pi-calm:tool-execution-layout:pi-0.81.1",
);

export function installCalmToolExecutionLayout(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmToolExecutionLayoutPatch | undefined;
  };
  const hidesTools = (): boolean =>
    calmPresentationHides("assistant-tool-call");
  const installed = registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH];
  if (installed) {
    installed.hidesTools = hidesTools;
    return;
  }

  const patch: CalmToolExecutionLayoutPatch = { hidesTools };
  const ToolExecutionComponent = (
    PiCodingAgent as typeof PiCodingAgent & {
      ToolExecutionComponent?: new (...args: never[]) => ToolExecutionPresentation;
    }
  ).ToolExecutionComponent;
  if (typeof ToolExecutionComponent !== "function") {
    throw new Error("pi-calm requires Pi ToolExecutionComponent");
  }

  const prototype = ToolExecutionComponent.prototype as ToolExecutionPresentation;
  const originalRender = prototype.render;
  if (typeof originalRender !== "function") {
    throw new Error("pi-calm requires Pi ToolExecutionComponent.render");
  }

  prototype.render = function (this: ToolExecutionPresentation, width: number): string[] {
    if (patch.hidesTools()) {
      return [];
    }
    return originalRender.call(this, width);
  };

  registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH] = patch;
}
