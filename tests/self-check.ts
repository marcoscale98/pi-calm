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
  CALM_NO_BUILT_INS_TOOL_NAMES,
  calmPresentationHides,
  calmPresentationIsActive,
  calmSkillsAreVisible,
  calmThinkingIsVisible,
  calmToolCallIsVisible,
  DEFAULT_CALM_PREFERENCE,
  parseCalmPreference,
  serializeCalmPreference,
  setCalmStockExportRendering,
  isSkillReadToolCall,
} from "../extensions/calm/lib/visibility.ts";
import {
  getCalmArgumentCompletions,
  getCalmPreferenceForCommand,
} from "../extensions/calm/index.ts";

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
assert.deepEqual(DEFAULT_CALM_PREFERENCE, {
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on"), {
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on thinking"), {
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on skills"), {
  active: true,
  thinking: false,
  skills: true,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on no-built-ins"), {
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: true,
});
assert.deepEqual(parseCalmPreference("on thinking skills"), {
  active: true,
  thinking: true,
  skills: true,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on no-built-ins thinking skills"), {
  active: true,
  thinking: true,
  skills: true,
  noBuiltIns: true,
});
assert.deepEqual(parseCalmPreference("on+thinking"), {
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on thinking:on"), {
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("on thinking=on"), {
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: false,
});
assert.deepEqual(parseCalmPreference("off"), {
  active: false,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  "on\n",
);
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: false,
  }),
  "on thinking\n",
);
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: false,
    skills: true,
    noBuiltIns: false,
  }),
  "on skills\n",
);
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: false,
  }),
  "on thinking skills\n",
);
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: true,
  }),
  "on no-built-ins\n",
);
assert.equal(
  serializeCalmPreference({
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  "on no-built-ins thinking skills\n",
);
assert.equal(
  serializeCalmPreference({
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  "off\n",
);

// --- command argument completion ---
const allCalmArgumentCompletions = getCalmArgumentCompletions("")?.map(
  (item) => item.value,
);
assert.deepEqual(allCalmArgumentCompletions?.slice(0, 17), [
  "on",
  "thinking",
  "skills",
  "no-built-ins",
  "off",
  "thinking skills",
  "thinking no-built-ins",
  "no-built-ins thinking",
  "no-built-ins skills",
  "skills no-built-ins",
  "skills thinking",
  "thinking skills no-built-ins",
  "thinking no-built-ins skills",
  "skills thinking no-built-ins",
  "skills no-built-ins thinking",
  "no-built-ins thinking skills",
  "no-built-ins skills thinking",
]);
assert.equal(allCalmArgumentCompletions?.length, 65);
assert.equal(new Set(allCalmArgumentCompletions).size, 65);
assert.deepEqual(
  getCalmArgumentCompletions("thi")?.map((item) => item.value),
  [
    "thinking",
    "thinking skills",
    "thinking no-built-ins",
    "thinking skills no-built-ins",
    "thinking no-built-ins skills",
    "thinking on",
    "thinking on skills",
    "thinking skills on",
    "thinking on no-built-ins",
    "thinking no-built-ins on",
    "thinking on skills no-built-ins",
    "thinking on no-built-ins skills",
    "thinking skills on no-built-ins",
    "thinking skills no-built-ins on",
    "thinking no-built-ins on skills",
    "thinking no-built-ins skills on",
  ],
);
assert.deepEqual(
  getCalmArgumentCompletions("thinking ")?.map((item) => item.value),
  [
    "thinking skills",
    "thinking no-built-ins",
    "thinking skills no-built-ins",
    "thinking no-built-ins skills",
    "thinking on",
    "thinking on skills",
    "thinking skills on",
    "thinking on no-built-ins",
    "thinking no-built-ins on",
    "thinking on skills no-built-ins",
    "thinking on no-built-ins skills",
    "thinking skills on no-built-ins",
    "thinking skills no-built-ins on",
    "thinking no-built-ins on skills",
    "thinking no-built-ins skills on",
  ],
);
assert.deepEqual(
  getCalmArgumentCompletions("no-built-ins ")?.map((item) => item.value),
  [
    "no-built-ins thinking",
    "no-built-ins skills",
    "no-built-ins thinking skills",
    "no-built-ins skills thinking",
    "no-built-ins on",
    "no-built-ins on thinking",
    "no-built-ins thinking on",
    "no-built-ins on skills",
    "no-built-ins skills on",
    "no-built-ins on thinking skills",
    "no-built-ins on skills thinking",
    "no-built-ins thinking on skills",
    "no-built-ins thinking skills on",
    "no-built-ins skills on thinking",
    "no-built-ins skills thinking on",
  ],
);
assert.deepEqual(
  getCalmArgumentCompletions("skills ")?.map((item) => item.value),
  [
    "skills no-built-ins",
    "skills thinking",
    "skills thinking no-built-ins",
    "skills no-built-ins thinking",
    "skills on",
    "skills on thinking",
    "skills thinking on",
    "skills on no-built-ins",
    "skills no-built-ins on",
    "skills on thinking no-built-ins",
    "skills on no-built-ins thinking",
    "skills thinking on no-built-ins",
    "skills thinking no-built-ins on",
    "skills no-built-ins on thinking",
    "skills no-built-ins thinking on",
  ],
);
assert.deepEqual(
  getCalmArgumentCompletions("on ")?.map((item) => item.value),
  [
    "on thinking",
    "on skills",
    "on no-built-ins",
    "on thinking skills",
    "on skills thinking",
    "on thinking no-built-ins",
    "on no-built-ins thinking",
    "on skills no-built-ins",
    "on no-built-ins skills",
    "on thinking skills no-built-ins",
    "on thinking no-built-ins skills",
    "on skills thinking no-built-ins",
    "on skills no-built-ins thinking",
    "on no-built-ins thinking skills",
    "on no-built-ins skills thinking",
  ],
);
assert.deepEqual(
  getCalmArgumentCompletions("thinking o")?.map((item) => item.value),
  [
    "thinking on",
    "thinking on skills",
    "thinking on no-built-ins",
    "thinking on skills no-built-ins",
    "thinking on no-built-ins skills",
  ],
);
assert.equal(getCalmArgumentCompletions("off "), null);
assert.equal(getCalmArgumentCompletions("on off"), null);
assert.equal(getCalmArgumentCompletions("thinking thinking"), null);
assert.equal(getCalmArgumentCompletions("unknown"), null);

// --- command transitions ---
assert.deepEqual(
  getCalmPreferenceForCommand("no-built-ins", {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: true,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("no-built-ins skills", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  {
    active: true,
    thinking: false,
    skills: true,
    noBuiltIns: true,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("skills no-built-ins", {
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: false,
  }),
  {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("no-built-ins thinking", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  {
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: true,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking no-built-ins", {
    active: true,
    thinking: false,
    skills: true,
    noBuiltIns: false,
  }),
  {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("no-built-ins", {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: true,
  }),
  {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  },
);
assert.deepEqual(
  getCalmPreferenceForCommand("on", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  { active: true, thinking: false, skills: false, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("on thinking", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  { active: true, thinking: true, skills: false, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking on", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  { active: true, thinking: true, skills: false, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("on skills no-built-ins", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  { active: true, thinking: false, skills: true, noBuiltIns: true },
);
assert.deepEqual(
  getCalmPreferenceForCommand("no-built-ins skills on", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: true,
  }),
  { active: true, thinking: false, skills: true, noBuiltIns: true },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking", {
    active: true,
    thinking: false,
    skills: true,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("skills", {
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: false, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("skills", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: false, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking skills", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("skills thinking", {
    active: false,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking skills", {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking skills", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: false,
  }),
  { active: true, thinking: false, skills: false, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking skills", {
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: false,
  }),
  { active: true, thinking: false, skills: true, noBuiltIns: false },
);
assert.deepEqual(
  getCalmPreferenceForCommand("thinking skills", {
    active: true,
    thinking: false,
    skills: true,
    noBuiltIns: false,
  }),
  { active: true, thinking: true, skills: false, noBuiltIns: false },
);
for (const argument of [
  "thinking skills no-built-ins",
  "thinking no-built-ins skills",
  "skills thinking no-built-ins",
  "skills no-built-ins thinking",
  "no-built-ins thinking skills",
  "no-built-ins skills thinking",
]) {
  assert.deepEqual(
    getCalmPreferenceForCommand(argument, {
      active: true,
      thinking: false,
      skills: true,
      noBuiltIns: false,
    }),
    { active: true, thinking: true, skills: false, noBuiltIns: true },
  );
}

const unchangedPreference = {
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: true,
};
for (const argument of [
  "on off",
  "off on",
  "off thinking",
  "thinking off",
  "off skills",
  "off no-built-ins",
  "thinking thinking",
  "skills skills",
  "no-built-ins no-built-ins",
  "unknown",
]) {
  assert.equal(
    getCalmPreferenceForCommand(argument, unchangedPreference),
    undefined,
  );
  assert.deepEqual(unchangedPreference, {
    active: true,
    thinking: true,
    skills: false,
    noBuiltIns: true,
  });
}

assert.deepEqual(
  getCalmPreferenceForCommand("off", {
    active: true,
    thinking: true,
    skills: true,
    noBuiltIns: false,
  }),
  { active: false, thinking: false, skills: false, noBuiltIns: false },
);
assert.equal(
  getCalmPreferenceForCommand("unknown", {
    active: true,
    thinking: false,
    skills: false,
    noBuiltIns: false,
  }),
  undefined,
);

// --- visibility policy ---
setCalmStockExportRendering(false);
applyCalmPreference({
  active: false,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});
assert.equal(calmPresentationIsActive(), false);
assert.equal(calmPresentationHides("assistant-tool-call"), false);
assert.equal(calmPresentationHides("assistant-thinking"), false);

applyCalmPreference({
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});
assert.equal(calmPresentationIsActive(), true);
assert.equal(calmThinkingIsVisible(), false);
assert.equal(calmPresentationHides("assistant-tool-call"), true);
assert.equal(calmPresentationHides("tool-result"), true);
assert.equal(calmPresentationHides("assistant-thinking"), true);
assert.equal(calmPresentationHides("synthetic-user"), true);
assert.equal(calmPresentationHides("genuine-user-prompt"), false);
assert.equal(calmPresentationHides("genuine-agent-response"), false);
assert.equal(calmPresentationHides("working-status"), false);
assert.equal(calmSkillsAreVisible(), false);

// Skill visibility follows read calls targeting SKILL.md regardless of tool provider.
assert.equal(isSkillReadToolCall("read", { path: "skills/demo/SKILL.md" }), true);
assert.equal(
  isSkillReadToolCall("read", { path: "skills/demo/SKILL.md", raw: true }),
  true,
);
assert.equal(isSkillReadToolCall("read", { path: "/tmp/SKILL.md" }), true);
assert.equal(isSkillReadToolCall("read", { file_path: "skills/demo/SKILL.md" }), true);
assert.equal(isSkillReadToolCall("read", { path: "skills/demo/skill.md" }), false);
assert.equal(isSkillReadToolCall("read", { path: "skills/demo/SKILL.MD" }), false);
assert.equal(isSkillReadToolCall("bash", { path: "skills/demo/SKILL.md" }), false);
assert.equal(isSkillReadToolCall("read", { path: "skills/demo/other.md" }), false);

// No-built-ins uses a fixed denylist and leaves unknown tool names visible.
assert.deepEqual([...CALM_NO_BUILT_INS_TOOL_NAMES], [
  "read",
  "bash",
  "powershell",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
]);
applyCalmPreference({
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: true,
});
for (const toolName of CALM_NO_BUILT_INS_TOOL_NAMES) {
  assert.equal(calmToolCallIsVisible(toolName, {}), false);
}
assert.equal(calmToolCallIsVisible("future-extension-tool", {}), true);
assert.equal(
  calmToolCallIsVisible("read", { path: "skills/demo/SKILL.md" }),
  false,
);
applyCalmPreference({
  active: true,
  thinking: false,
  skills: true,
  noBuiltIns: true,
});
assert.equal(
  calmToolCallIsVisible("read", { path: "skills/demo/SKILL.md" }),
  true,
);
assert.equal(calmToolCallIsVisible("bash", {}), false);
assert.equal(calmToolCallIsVisible("future-extension-tool", {}), true);

applyCalmPreference({
  active: true,
  thinking: false,
  skills: true,
  noBuiltIns: false,
});
assert.equal(calmSkillsAreVisible(), true);
assert.equal(calmToolCallIsVisible("read", { path: "skills/demo/SKILL.md" }), true);
assert.equal(calmToolCallIsVisible("read", { path: "skills/demo/other.md" }), false);
assert.equal(calmToolCallIsVisible("bash", { path: "skills/demo/SKILL.md" }), false);
assert.equal(calmToolCallIsVisible("future-extension-tool", {}), false);

// /calm thinking shows CoT while tools stay hidden
applyCalmPreference({
  active: true,
  thinking: true,
  skills: false,
  noBuiltIns: false,
});
assert.equal(calmThinkingIsVisible(), true);
assert.equal(calmPresentationHides("assistant-thinking"), false);
assert.equal(calmPresentationHides("assistant-tool-call"), true);
assert.equal(calmPresentationHides("working-status"), false);

// Export restores stock chrome
setCalmStockExportRendering(true);
assert.equal(calmPresentationHides("assistant-tool-call"), false);
assert.equal(calmPresentationHides("assistant-thinking"), false);
assert.equal(calmToolCallIsVisible("bash", { command: "pwd" }), true);
setCalmStockExportRendering(false);

// Default preference is on
assert.deepEqual(DEFAULT_CALM_PREFERENCE, {
  active: true,
  thinking: false,
  skills: false,
  noBuiltIns: false,
});

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
applyCalmPreference({
  active: true,
  thinking: false,
  skills: true,
  noBuiltIns: false,
});
PiCodingAgent.initTheme();
const toolRender = PiCodingAgent.ToolExecutionComponent.prototype.render;
assert.deepEqual(toolRender.call({}, 80), []);
const nativeReadDefinition = PiCodingAgent.createReadToolDefinition(process.cwd());
const skillTool = new PiCodingAgent.ToolExecutionComponent(
  "read",
  "skill-call",
  { path: "skills/demo/SKILL.md" },
  {},
  nativeReadDefinition,
  { requestRender() {} } as unknown as ConstructorParameters<
    typeof PiCodingAgent.ToolExecutionComponent
  >[5],
  process.cwd(),
);
assert.equal(skillTool.render(80).some((line) => line.includes("[skill]")), true);
const ordinaryReadTool = new PiCodingAgent.ToolExecutionComponent(
  "read",
  "ordinary-read-call",
  { path: "README.md" },
  {},
  PiCodingAgent.createReadToolDefinition(process.cwd()),
  { requestRender() {} } as unknown as ConstructorParameters<
    typeof PiCodingAgent.ToolExecutionComponent
  >[5],
  process.cwd(),
);
assert.deepEqual(ordinaryReadTool.render(80), []);
// Extension-provided read tools keep their own renderer and may show skill reads.
const customReadTool = new PiCodingAgent.ToolExecutionComponent(
  "read",
  "custom-read-call",
  { path: "skills/demo/SKILL.md" },
  {},
  {
    ...nativeReadDefinition,
    execute: async () => ({ content: [{ type: "text", text: "custom result" }] }),
  } as unknown as ConstructorParameters<
    typeof PiCodingAgent.ToolExecutionComponent
  >[4],
  { requestRender() {} } as unknown as ConstructorParameters<
    typeof PiCodingAgent.ToolExecutionComponent
  >[5],
  process.cwd(),
);
assert.equal(
  customReadTool.render(80).some((line) => line.includes("[skill]")),
  true,
);
skillTool.setExpanded(true);
assert.equal(skillTool.render(80).some((line) => line.includes("read")), true);
skillTool.updateResult({
  content: [{ type: "text", text: "skill result" }],
  isError: false,
});
assert.equal(skillTool.render(80).some((line) => line.includes("skill result")), true);
skillTool.updateResult({
  content: [{ type: "text", text: "skill error" }],
  isError: true,
});
assert.equal(skillTool.render(80).some((line) => line.includes("skill error")), true);

// Idempotent reinstall
installCalmAssistantLayout();
installCalmOperationalUserLayout();
installCalmToolExecutionLayout();
installCalmWorkingLock();

console.log("pi-calm self-check: ok");
