/**
 * Zero-height tool-row presentation adapter.
 *
 * registerTool() can lose to another extension under Pi's first-wins tool
 * ownership. This adapter patches ToolExecutionComponent.render so every
 * tool row—built-in or user-defined—stays hidden under Calm, except for
 * native read rows targeting SKILL.md when `/calm skills` is enabled.
 *
 * Presentation only. Execution, results, and session storage are unchanged.
 */
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { calmToolCallIsVisible } from "./visibility.ts";

type ToolDefinitionPresentation = {
  parameters?: unknown;
};

type ToolExecutionPresentation = {
  toolName?: unknown;
  args?: unknown;
  toolDefinition?: ToolDefinitionPresentation;
  render(width: number): string[];
};

type ToolSessionPresentation = {
  getToolDefinition(name: string): ToolDefinitionPresentation | undefined;
  getAllTools(): {
    name: unknown;
    parameters: unknown;
    sourceInfo?: { source?: unknown };
  }[];
};

type CalmToolExecutionLayoutPatch = {
  isToolCallVisible: (
    toolName: unknown,
    args: unknown,
    isNativeRead: boolean,
  ) => boolean;
  nativeReadDefinitions: WeakSet<ToolDefinitionPresentation>;
};

const CALM_TOOL_EXECUTION_LAYOUT_PATCH = Symbol.for(
  "pi-calm:tool-execution-layout:pi-0.81.1",
);

function isNativeReadDefinition(
  presentation: ToolExecutionPresentation,
  nativeReadDefinitions: WeakSet<ToolDefinitionPresentation>,
): boolean {
  return (
    presentation.toolName === "read" &&
    presentation.toolDefinition !== undefined &&
    nativeReadDefinitions.has(presentation.toolDefinition)
  );
}

export function installCalmToolExecutionLayout(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmToolExecutionLayoutPatch | undefined;
  };
  const isToolCallVisible = (
    toolName: unknown,
    args: unknown,
    isNativeRead: boolean,
  ): boolean => calmToolCallIsVisible(toolName, args, isNativeRead);
  const installed = registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH];
  if (installed) {
    installed.isToolCallVisible = isToolCallVisible;
    return;
  }

  const patch: CalmToolExecutionLayoutPatch = {
    isToolCallVisible,
    nativeReadDefinitions: new WeakSet(),
  };
  const AgentSession = PiCodingAgent.AgentSession as unknown as {
    prototype: ToolSessionPresentation;
  } | undefined;
  if (!AgentSession) {
    throw new Error("pi-calm requires Pi AgentSession");
  }
  const sessionPrototype = AgentSession.prototype;
  const originalGetToolDefinition = sessionPrototype.getToolDefinition;
  if (
    typeof originalGetToolDefinition !== "function" ||
    typeof sessionPrototype.getAllTools !== "function"
  ) {
    throw new Error("pi-calm requires Pi AgentSession tool provenance");
  }
  sessionPrototype.getToolDefinition = function (
    this: ToolSessionPresentation,
    name: string,
  ): ToolDefinitionPresentation | undefined {
    // Pi's registry, not a copyable definition property, establishes provenance.
    const definition = originalGetToolDefinition.call(this, name);
    if (
      name === "read" &&
      definition &&
      this.getAllTools().some(
        (tool) =>
          tool.name === "read" &&
          tool.parameters === definition.parameters &&
          tool.sourceInfo?.source === "builtin",
      )
    ) {
      patch.nativeReadDefinitions.add(definition);
    }
    return definition;
  };

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

  prototype.render = function (this: ToolExecutionPresentation, width: number): string[] {
    if (
      !patch.isToolCallVisible(
        this.toolName,
        this.args,
        isNativeReadDefinition(this, patch.nativeReadDefinitions),
      )
    ) {
      return [];
    }
    return originalRender.call(this, width);
  };

  registry[CALM_TOOL_EXECUTION_LAYOUT_PATCH] = patch;
}
