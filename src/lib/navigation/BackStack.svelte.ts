/**
 * "One view back" steps of whatever is open: edit modes, inline editors, panels. Escape (the
 * `view.back` command) runs the newest step; with none left the window goes back or closes.
 * A step stays registered until its owner removes it, so a step may decline (e.g. the user keeps
 * editing after a "discard changes?" question) and still answer the next Escape.
 */
export interface BackStep {
  back: () => void;
  /** Asked before the whole view goes away (window closes); false keeps it open. */
  leave?: () => boolean | Promise<boolean>;
  /** Unsaved input right now (the browser warns before the tab closes). */
  unsaved?: () => boolean;
}

export class BackStack {
  /** Plain array: effects that push must not depend on it. */
  readonly #steps: BackStep[] = [];
  depth = $state(0);

  /** Adds a step; the returned function removes it again (idempotent). */
  push(step: BackStep | (() => void)): () => void {
    const entry = typeof step === 'function' ? { back: step } : { ...step };
    this.#steps.push(entry);
    this.depth = this.#steps.length;
    return () => {
      const index = this.#steps.indexOf(entry);
      if (index < 0) return;
      this.#steps.splice(index, 1);
      this.depth = this.#steps.length;
    };
  }

  /** Runs the newest step; false when there is none. */
  back(): boolean {
    const step = this.#steps.at(-1);
    step?.back();
    return !!step;
  }

  /** Whether everything open may go away; synchronous `true` when no step objects. */
  mayLeave(): boolean | Promise<boolean> {
    for (const step of [...this.#steps].reverse()) {
      const answer = step.leave?.() ?? true;
      if (answer !== true) return answer;
    }
    return true;
  }

  hasUnsaved(): boolean {
    return this.#steps.some((s) => s.unsaved?.());
  }

  /** While `active()` holds, Escape runs `back` (e.g. leave edit mode). Call during component initialisation. */
  while(active: () => boolean, back: () => void, leave?: () => boolean | Promise<boolean>, unsaved?: () => boolean): void {
    $effect(() => {
      if (active()) return this.push({ back, leave, unsaved });
    });
  }
}
