/**
 * Zero-height thinking / CoT presentation adapter.
 *
 * Verified against Pi 0.81.1–0.82.1 exports of AssistantMessageComponent with
 * updateContent. Probes that exact method and throws if missing so the main
 * extension can skip only this adapter with a diagnostic.
 *
 * Presentation-only: filters thinking blocks from a shallow copy used for
 * layout while Pi still holds the original message for expansion/invalidation.
 * When calm is on and `/calm thinking` has enabled CoT, thinking blocks pass
 * through expanded (hideThinkingBlock forced off for that layout pass).
 *
 * Reinstall-safe: always rebinds the outermost prototype wrapper so a code
 * upgrade after `/reload` still filters thinking even if an older calm patch
 * remains underneath (e.g. one that required hideThinkingBlock === true).
 */
import type { AssistantMessageComponent as PiAssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import {
  calmPresentationHides,
  calmPresentationIsActive,
} from "./visibility.ts";

type AssistantMessage = Parameters<
  PiAssistantMessageComponent["updateContent"]
>[0];

type AssistantMessagePresentationState = {
  hideThinkingBlock?: boolean;
  lastMessage?: AssistantMessage;
};

type CalmAssistantLayoutPatch = {
  hidesThinking: () => boolean;
  showsExpandedThinking: () => boolean;
};

type UpdateContentFn = (message: AssistantMessage) => void;

// Versioned symbols: bump when wrapper body changes so upgrades rebind cleanly.
const CALM_ASSISTANT_LAYOUT_PATCH = Symbol.for(
  "pi-calm:assistant-layout:patch:v3",
);
const CALM_ASSISTANT_LAYOUT_ORIGINAL = Symbol.for(
  "pi-calm:assistant-layout:original-updateContent:v3",
);

function isThinkingBlock(block: unknown): boolean {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "thinking"
  );
}

export function installCalmAssistantLayout(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmAssistantLayoutPatch | UpdateContentFn | undefined;
  };
  const hidesThinking = (): boolean =>
    calmPresentationHides("assistant-thinking");
  const showsExpandedThinking = (): boolean =>
    calmPresentationIsActive() && !hidesThinking();

  const AssistantMessageComponent = PiCodingAgent.AssistantMessageComponent;
  if (typeof AssistantMessageComponent !== "function") {
    throw new Error("pi-calm requires Pi AssistantMessageComponent");
  }
  const prototype = AssistantMessageComponent.prototype as {
    updateContent: UpdateContentFn;
  };
  if (typeof prototype.updateContent !== "function") {
    throw new Error(
      "pi-calm requires Pi AssistantMessageComponent.updateContent",
    );
  }

  // Capture the next function in the chain once per process. This may be Pi's
  // real updateContent or an older calm wrapper; either is fine because the
  // outermost wrapper below always strips thinking first when calm hides it.
  if (typeof registry[CALM_ASSISTANT_LAYOUT_ORIGINAL] !== "function") {
    registry[CALM_ASSISTANT_LAYOUT_ORIGINAL] = prototype.updateContent;
  }

  const existing = registry[CALM_ASSISTANT_LAYOUT_PATCH] as
    | CalmAssistantLayoutPatch
    | undefined;
  const patch: CalmAssistantLayoutPatch = existing ?? {
    hidesThinking,
    showsExpandedThinking,
  };
  patch.hidesThinking = hidesThinking;
  patch.showsExpandedThinking = showsExpandedThinking;
  registry[CALM_ASSISTANT_LAYOUT_PATCH] = patch;

  const originalUpdateContent = registry[
    CALM_ASSISTANT_LAYOUT_ORIGINAL
  ] as UpdateContentFn;

  // Always rebind so upgraded logic wins after /reload without process restart.
  prototype.updateContent = function (
    this: AssistantMessagePresentationState,
    message: AssistantMessage,
  ): void {
    const hideThinking = patch.hidesThinking();
    const presentationMessage = hideThinking
      ? {
          ...message,
          content: message.content.filter((block) => !isThinkingBlock(block)),
        }
      : message;

    // Under `/calm thinking`, force expanded CoT for this layout pass even if
    // the user has hideThinkingBlock enabled in Pi settings.
    const previousHideBlock = this.hideThinkingBlock;
    const forceExpand = patch.showsExpandedThinking();
    if (forceExpand) this.hideThinkingBlock = false;

    originalUpdateContent.call(this, presentationMessage);

    if (forceExpand) this.hideThinkingBlock = previousHideBlock;
    // Keep the original message so toggling thinking back on can re-render CoT.
    if (presentationMessage !== message) this.lastMessage = message;
  };
}
