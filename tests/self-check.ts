/**
 * Lightweight self-check for pi-calm presentation helpers.
 * Run: node --experimental-strip-types tests/self-check.ts
 * (or: pi -e ./extensions/calm/index.ts after install smoke)
 */
import assert from "node:assert/strict";
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import {
  classifyOperationalText,
  encodeCalmHideInput,
  encodeFirstmateOperationalInput,
  isOperationalInput,
  INVISIBLE_SEPARATOR,
} from "../extensions/calm/lib/operational-input.ts";
import {
  applyCalmPreference,
  calmPresentationHides,
  calmPresentationIsActive,
  calmThinkingIsVisible,
  DEFAULT_CALM_PREFERENCE,
  parseCalmPreference,
  serializeCalmPreference,
  setCalmStockExportRendering,
} from "../extensions/calm/lib/visibility.ts";
import { getCalmArgumentCompletions } from "../extensions/calm/index.ts";

// --- operational markers ---
const hide = encodeCalmHideInput("watcher done");
assert.equal(hide.startsWith(`${INVISIBLE_SEPARATOR}CALM_HIDE:`), true);
assert.equal(classifyOperationalText(hide), "calm-hide");
assert.equal(isOperationalInput(hide), true);

const watcher = encodeFirstmateOperationalInput(
  "watcher",
  "signal: done\n\nDrain the queue.",
);
assert.equal(classifyOperationalText(watcher), "watcher");

const fromFm = encodeFirstmateOperationalInput(
  "from-firstmate",
  "status update",
);
assert.equal(classifyOperationalText(fromFm), "from-firstmate");

// Near misses stay unclassified
assert.equal(classifyOperationalText("hello captain"), undefined);
assert.equal(
  classifyOperationalText("quote: " + watcher),
  undefined,
);
assert.equal(
  classifyOperationalText("FIRSTMATE_OP: v1 watcher: body"),
  undefined,
);
assert.equal(
  classifyOperationalText(`${INVISIBLE_SEPARATOR}unrelated text`),
  undefined,
);

// Legacy escalate shape
assert.equal(
  classifyOperationalText(`${INVISIBLE_SEPARATOR}Supervisor escalate (x)`),
  "legacy-operational",
);

// --- preference parse / serialize ---
assert.deepEqual(parseCalmPreference(""), DEFAULT_CALM_PREFERENCE);
assert.deepEqual(parseCalmPreference("on"), {
  active: true,
  thinking: false,
});
assert.deepEqual(parseCalmPreference("on thinking"), {
  active: true,
  thinking: true,
});
assert.deepEqual(parseCalmPreference("off"), {
  active: false,
  thinking: false,
});
assert.equal(serializeCalmPreference({ active: true, thinking: false }), "on\n");
assert.equal(
  serializeCalmPreference({ active: true, thinking: true }),
  "on thinking\n",
);
assert.equal(serializeCalmPreference({ active: false, thinking: false }), "off\n");

// --- command argument completion ---
assert.deepEqual(
  getCalmArgumentCompletions("")?.map((item) => item.value),
  ["on", "thinking", "off"],
);
assert.deepEqual(
  getCalmArgumentCompletions("thi")?.map((item) => item.value),
  ["thinking"],
);
assert.equal(getCalmArgumentCompletions("thinking "), null);
assert.equal(getCalmArgumentCompletions("unknown"), null);

// --- visibility policy ---
setCalmStockExportRendering(false);
applyCalmPreference({ active: false, thinking: false });
assert.equal(calmPresentationIsActive(), false);
assert.equal(calmPresentationHides("assistant-tool-call"), false);
assert.equal(calmPresentationHides("assistant-thinking"), false);

applyCalmPreference({ active: true, thinking: false });
assert.equal(calmPresentationIsActive(), true);
assert.equal(calmThinkingIsVisible(), false);
assert.equal(calmPresentationHides("assistant-tool-call"), true);
assert.equal(calmPresentationHides("tool-result"), true);
assert.equal(calmPresentationHides("assistant-thinking"), true);
assert.equal(calmPresentationHides("synthetic-user"), true);
assert.equal(calmPresentationHides("genuine-user-prompt"), false);
assert.equal(calmPresentationHides("genuine-agent-response"), false);
assert.equal(calmPresentationHides("working-status"), false);

// /calm thinking shows CoT while tools stay hidden
applyCalmPreference({ active: true, thinking: true });
assert.equal(calmThinkingIsVisible(), true);
assert.equal(calmPresentationHides("assistant-thinking"), false);
assert.equal(calmPresentationHides("assistant-tool-call"), true);
assert.equal(calmPresentationHides("working-status"), false);

// Export restores stock chrome
setCalmStockExportRendering(true);
assert.equal(calmPresentationHides("assistant-tool-call"), false);
assert.equal(calmPresentationHides("assistant-thinking"), false);
setCalmStockExportRendering(false);

// Default preference is on
assert.deepEqual(DEFAULT_CALM_PREFERENCE, { active: true, thinking: false });

// --- adapter exports load without throwing when Pi APIs exist ---
const { installCalmAssistantLayout } = await import(
  "../extensions/calm/lib/assistant-layout.ts"
);
const { installCalmOperationalUserLayout } = await import(
  "../extensions/calm/lib/operational-user-layout.ts"
);
const { installCalmToolExecutionLayout } = await import(
  "../extensions/calm/lib/tool-execution-layout.ts"
);
const { installCalmWorkingLock } = await import(
  "../extensions/calm/lib/working-lock.ts"
);
installCalmAssistantLayout();
installCalmOperationalUserLayout();
installCalmToolExecutionLayout();
installCalmWorkingLock();

// Tool rows are hidden by their shared renderer, not by a built-in name list.
const toolRender = PiCodingAgent.ToolExecutionComponent.prototype.render;
assert.deepEqual(toolRender.call({}, 80), []);

// Idempotent reinstall
installCalmAssistantLayout();
installCalmOperationalUserLayout();
installCalmToolExecutionLayout();
installCalmWorkingLock();

console.log("pi-calm self-check: ok");
