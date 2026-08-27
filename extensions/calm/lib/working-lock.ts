/**
 * Keep Pi's native Working... activity row always visible.
 *
 * Calm treats Working... as non-optional chrome. Extensions (or settings flows)
 * that call setWorkingVisible(false) are forced back to true so the indicator
 * cannot be dismissed while this adapter is installed.
 */
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";

type InteractiveModeWorking = {
  setWorkingVisible(visible: boolean): void;
};

type CalmWorkingLockPatch = {
  forceVisible: () => boolean;
};

const CALM_WORKING_LOCK_PATCH = Symbol.for(
  "pi-calm:working-lock:pi-0.81.1",
);

export function installCalmWorkingLock(): void {
  const registry = globalThis as typeof globalThis & {
    [key: symbol]: CalmWorkingLockPatch | undefined;
  };
  // Always force Working... on — not gated on calm active/inactive.
  const forceVisible = (): boolean => true;
  const installed = registry[CALM_WORKING_LOCK_PATCH];
  if (installed) {
    installed.forceVisible = forceVisible;
    return;
  }

  const patch: CalmWorkingLockPatch = { forceVisible };
  const InteractiveMode = PiCodingAgent.InteractiveMode;
  if (typeof InteractiveMode !== "function") {
    throw new Error("pi-calm requires Pi InteractiveMode");
  }

  const prototype =
    InteractiveMode.prototype as unknown as InteractiveModeWorking;
  const originalSetWorkingVisible = prototype.setWorkingVisible;
  if (typeof originalSetWorkingVisible !== "function") {
    throw new Error("pi-calm requires Pi InteractiveMode.setWorkingVisible");
  }

  prototype.setWorkingVisible = function (
    this: InteractiveModeWorking,
    _visible: boolean,
  ): void {
    originalSetWorkingVisible.call(this, patch.forceVisible() ? true : _visible);
  };

  registry[CALM_WORKING_LOCK_PATCH] = patch;
}
