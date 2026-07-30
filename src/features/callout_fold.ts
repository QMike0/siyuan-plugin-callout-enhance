/**
 * Fold/unfold logic for callout blocks.
 *
 * Height is animated on the callout shell with overflow:hidden. We deliberately
 * defer setting `fold="1"` until the collapse transition finishes: SiYuan's
 * folded-callout CSS (hide trailing `.callout-content` children, text-clamp,
 * etc.) would otherwise mutate body layout mid-animation.
 *
 * Because `fold` is deferred, click toggles must use the in-flight *logical*
 * target (see `isCalloutLogicallyFolded`), not only the DOM attribute — otherwise
 * rapid clicks during collapse keep requesting fold again and never unfold.
 */
import { isPublishService } from "../core/cl_api";
import { isCalloutScrollLimited } from "./callout_scroll_limit";
import { cleanCalloutOuterHTML } from "../utils/callout";
import { debugLog, errorLog } from "../utils/logger";

export type CalloutFoldPluginLike = {
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type") => Promise<boolean>;
};

type FoldAnimationState = {
    token: number;
    /** In-flight animation intent; null when idle (DOM `fold` is authoritative). */
    targetFold: boolean | null;
    /** Bumped per setFoldState so a superseded sync cannot persist / roll back stale HTML. */
    syncEpoch: number;
};

type ChildSpacing = {
    marginTop: string;
    marginBottom: string;
    maxHeight?: string;
    scrollTop?: number;
    preserveScrollViewport?: boolean;
};

export const FOLD_ANIMATING_CLASS = "callout-enhance-fold-animating";
/** Present while collapsing; drives fold-arrow rotation before `fold="1"` is set. */
export const FOLD_COLLAPSING_CLASS = "callout-enhance-fold-collapsing";

const foldAnimationStates = new WeakMap<HTMLElement, FoldAnimationState>();

function parseCssTimeToMs(value: string): number {
    const v = value.trim();
    if (!v) return 0;
    if (v.endsWith("ms")) return Number.parseFloat(v) || 0;
    if (v.endsWith("s")) return (Number.parseFloat(v) || 0) * 1000;
    return Number.parseFloat(v) || 0;
}

function readFoldAnimationDurationMs(block: HTMLElement): number {
    const style = window.getComputedStyle(block);
    const fromVar = parseCssTimeToMs(style.getPropertyValue("--callout-fold-duration"));
    return Math.max(0, fromVar);
}

function readFoldEasing(block: HTMLElement): string {
    const style = window.getComputedStyle(block);
    return style.getPropertyValue("--callout-fold-easing").trim() || "cubic-bezier(.25, .8, .25, 1)";
}

function getFoldAnimatedChildren(block: HTMLElement): HTMLElement[] {
    return Array.from(block.children).filter((child) => !child.classList.contains("callout-info")) as HTMLElement[];
}

function getAnimationState(block: HTMLElement): FoldAnimationState {
    const current = foldAnimationStates.get(block);
    if (current) return current;
    const next: FoldAnimationState = { token: 0, targetFold: null, syncEpoch: 0 };
    foldAnimationStates.set(block, next);
    return next;
}

/**
 * Foldedness for UI toggles. During a deferred-collapse animation `fold="1"` is
 * not written yet, so callers must not read only the DOM attribute.
 */
export function isCalloutLogicallyFolded(block: HTMLElement): boolean {
    const state = foldAnimationStates.get(block);
    if (state && state.targetFold !== null) return state.targetFold;
    return block.getAttribute("fold") === "1";
}

function readChildSpacing(block: HTMLElement, children: HTMLElement[]): ChildSpacing[] {
    return children.map((child) => {
        const style = window.getComputedStyle(child);
        const shouldPreserveScrollViewport = isCalloutScrollLimited(block) && child.classList.contains("callout-content");
        return {
            marginTop: style.marginTop,
            marginBottom: style.marginBottom,
            maxHeight: shouldPreserveScrollViewport ? `${child.getBoundingClientRect().height}px` : undefined,
            scrollTop: shouldPreserveScrollViewport ? child.scrollTop : undefined,
            preserveScrollViewport: shouldPreserveScrollViewport,
        };
    });
}

function getFoldCollapsedTargetHeight(block: HTMLElement): number {
    const title = block.querySelector(".callout-info") as HTMLElement | null;
    if (!title) return block.getBoundingClientRect().height;

    const blockStyle = window.getComputedStyle(block);
    const titleStyle = window.getComputedStyle(title);
    const paddingTop = Number.parseFloat(blockStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(blockStyle.paddingBottom) || 0;
    const titleHeight = title.getBoundingClientRect().height;
    const titleMarginTop = Number.parseFloat(titleStyle.marginTop) || 0;
    const titleMarginBottom = Number.parseFloat(titleStyle.marginBottom) || 0;
    return paddingTop + titleMarginTop + titleHeight + titleMarginBottom + paddingBottom;
}

function keepChildrenVisible(children: HTMLElement[], spacing: ChildSpacing[]) {
    for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        child.style.setProperty("max-height", spacing[i]?.maxHeight || "none", "important");
        child.style.setProperty("margin-top", spacing[i]?.marginTop || "0px", "important");
        child.style.setProperty("margin-bottom", spacing[i]?.marginBottom || "0px", "important");
        if (spacing[i]?.preserveScrollViewport) {
            child.style.setProperty("overflow-y", "auto", "important");
            child.style.setProperty("overflow-x", "hidden", "important");
        }
        if (spacing[i]?.scrollTop != null) {
            child.scrollTop = spacing[i].scrollTop;
        }
    }
}

function preventFlexShrink(block: HTMLElement, children: HTMLElement[]) {
    const title = block.querySelector(".callout-info") as HTMLElement | null;
    title?.style.setProperty("flex-shrink", "0", "important");
    for (const child of children) {
        child.style.setProperty("flex-shrink", "0", "important");
    }
}

function removeEmptyStyleAttribute(element: HTMLElement) {
    if (element.style.length === 0) element.removeAttribute("style");
}

function clearChildOverrides(children: HTMLElement[]) {
    for (const child of children) {
        child.style.removeProperty("max-height");
        child.style.removeProperty("margin-top");
        child.style.removeProperty("margin-bottom");
        child.style.removeProperty("overflow-y");
        child.style.removeProperty("overflow-x");
        child.style.removeProperty("flex-shrink");
        removeEmptyStyleAttribute(child);
    }
}

function clearAnimationOverrides(block: HTMLElement, children: HTMLElement[]) {
    const title = block.querySelector(".callout-info") as HTMLElement | null;
    title?.style.removeProperty("flex-shrink");
    if (title) removeEmptyStyleAttribute(title);
    clearChildOverrides(children);
    block.classList.remove(FOLD_ANIMATING_CLASS, FOLD_COLLAPSING_CLASS);
    block.style.removeProperty("height");
    block.style.removeProperty("overflow");
    block.style.removeProperty("transition");
    block.style.removeProperty("will-change");
    removeEmptyStyleAttribute(block);
}

/**
 * Settle in-flight animations before plugin unload/hot reload, and recover any
 * stale runtime classes left by an interrupted previous instance.
 *
 * Invalidate tokens/epochs first so pending async continuations cannot persist
 * stale fold state after this cleanup.
 */
export function settleAllCalloutFoldAnimations(root: ParentNode = document) {
    if (typeof document === "undefined") return;
    root.querySelectorAll<HTMLElement>(`.${FOLD_ANIMATING_CLASS}`).forEach((block) => {
        const state = foldAnimationStates.get(block);
        if (state) {
            state.token += 1;
            state.syncEpoch += 1;
        }
        const targetFold = state?.targetFold
            ?? block.classList.contains(FOLD_COLLAPSING_CLASS);
        applyFoldAttribute(block, targetFold);
        clearAnimationOverrides(block, getFoldAnimatedChildren(block));
        if (state) state.targetFold = null;
    });
}

function setBlockHeightWithoutTransition(block: HTMLElement, height: number) {
    block.style.setProperty("transition", "none", "important");
    block.style.setProperty("height", `${height}px`, "important");
    block.style.setProperty("overflow", "hidden", "important");
    block.style.setProperty("will-change", "height");
}

function animateBlockHeight(block: HTMLElement, height: number, durationMs: number, easing: string) {
    block.style.setProperty("transition", `height ${durationMs}ms ${easing}`, "important");
    block.style.setProperty("height", `${height}px`, "important");
}

function forceReflow(block: HTMLElement) {
    block.getBoundingClientRect();
}

function waitBlockTransitionEnd(block: HTMLElement, durationMs: number, state: FoldAnimationState, token: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (durationMs <= 0) {
            resolve(state.token === token);
            return;
        }

        let done = false;
        let fallback = 0;
        const cleanup = () => {
            block.removeEventListener("transitionend", onTransitionEnd, true);
            window.clearTimeout(fallback);
        };
        const finish = () => {
            if (done) return;
            done = true;
            cleanup();
            resolve(state.token === token);
        };
        const onTransitionEnd = (event: Event) => {
            const e = event as TransitionEvent;
            if (e.target === block && e.propertyName === "height") finish();
        };

        block.addEventListener("transitionend", onTransitionEnd, true);
        fallback = window.setTimeout(finish, durationMs + 80);
    });
}

function applyFoldAttribute(block: HTMLElement, fold: boolean) {
    if (fold) block.setAttribute("fold", "1");
    else block.removeAttribute("fold");
}

async function animateBodyHeight(block: HTMLElement, fold: boolean): Promise<boolean> {
    const state = getAnimationState(block);
    const token = state.token + 1;
    state.token = token;
    state.targetFold = fold;
    const initialFold = block.getAttribute("fold") === "1";

    const children = getFoldAnimatedChildren(block);
    const durationMs = readFoldAnimationDurationMs(block);
    const easing = readFoldEasing(block);
    const currentHeight = block.getBoundingClientRect().height;

    if (children.length === 0) {
        applyFoldAttribute(block, fold);
        if (state.token === token) state.targetFold = null;
        return state.token === token;
    }

    setBlockHeightWithoutTransition(block, currentHeight);
    preventFlexShrink(block, children);
    block.classList.add(FOLD_ANIMATING_CLASS);
    block.classList.toggle(FOLD_COLLAPSING_CLASS, fold);

    try {
        if (fold) {
            // Keep `fold` unset during the height transition so SiYuan's folded-callout
            // rules cannot hide/reflow body siblings mid-animation. Arrow uses
            // FOLD_COLLAPSING_CLASS until we commit fold="1" after the transition.
            const spacing = readChildSpacing(block, children);
            keepChildrenVisible(children, spacing);
            forceReflow(block);
            animateBlockHeight(block, getFoldCollapsedTargetHeight(block), durationMs, easing);
        } else {
            forceReflow(block);
            block.removeAttribute("fold");
            clearChildOverrides(children);
            preventFlexShrink(block, children);
            forceReflow(block);
            animateBlockHeight(block, block.scrollHeight, durationMs, easing);
        }

        const completed = await waitBlockTransitionEnd(block, durationMs, state, token);
        if (!completed) return false;

        applyFoldAttribute(block, fold);
        clearAnimationOverrides(block, children);
        if (state.token === token) state.targetFold = null;
        return true;
    } catch (err) {
        // Only the newest animation owns cleanup; a superseded one must not tear
        // down inline styles/classes installed by its successor.
        if (state.token === token) {
            applyFoldAttribute(block, initialFold);
            clearAnimationOverrides(block, children);
            state.targetFold = null;
        }
        throw err;
    }
}

export async function setPreviewFoldState(block: HTMLElement | null, fold: boolean) {
    if (!block) return false;
    try {
        return await animateBodyHeight(block, fold);
    } catch (err) {
        errorLog("[ERROR] Preview fold failed:", err);
        return false;
    }
}

export async function setFoldState(plugin: CalloutFoldPluginLike, block: HTMLElement | null, fold: boolean) {
    if (isPublishService()) return false;
    if (!block || !block.dataset.nodeId) return false;
    const blockId = block.dataset.nodeId;
    const state = getAnimationState(block);
    const epoch = state.syncEpoch + 1;
    state.syncEpoch = epoch;

    try {
        // Snapshot before this gesture mutates fold / animation classes.
        const previousFold = block.getAttribute("fold");
        const originalHtml = cleanCalloutOuterHTML(block);

        debugLog(`[${fold ? "Fold" : "Unfold"}] Callout block`, blockId);

        const completed = await animateBodyHeight(block, fold);
        if (!completed || !block.isConnected) return true;
        // A newer click started another fold cycle — do not persist this one.
        if (epoch !== state.syncEpoch) return true;

        const ok = await plugin.syncBlock(block, originalHtml, "fold");
        if (epoch !== state.syncEpoch) return true;
        if (ok) return true;

        if (previousFold === null) block.removeAttribute("fold");
        else block.setAttribute("fold", previousFold);
        clearAnimationOverrides(block, getFoldAnimatedChildren(block));
        state.targetFold = null;
        return false;
    } catch (err) {
        if (epoch === state.syncEpoch) state.targetFold = null;
        const action = fold ? "Fold" : "Unfold";
        errorLog(`[ERROR] ${action} failed for block ${blockId}:`, err);
        return false;
    }
}
