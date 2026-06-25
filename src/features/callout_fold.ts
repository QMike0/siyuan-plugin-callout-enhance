/**
 * Fold/unfold logic for callout blocks.
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
};

type ChildSpacing = {
    marginTop: string;
    marginBottom: string;
    maxHeight?: string;
    scrollTop?: number;
};

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
    const next = { token: 0 };
    foldAnimationStates.set(block, next);
    return next;
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
        // Inline max-height beats fold="1" static CSS so outer height animation can clip body content.
        child.style.setProperty("max-height", spacing[i]?.maxHeight || "none", "important");
        child.style.setProperty("margin-top", spacing[i]?.marginTop || "0px", "important");
        child.style.setProperty("margin-bottom", spacing[i]?.marginBottom || "0px", "important");
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

function clearChildOverrides(children: HTMLElement[]) {
    for (const child of children) {
        child.style.removeProperty("max-height");
        child.style.removeProperty("margin-top");
        child.style.removeProperty("margin-bottom");
        child.style.removeProperty("flex-shrink");
    }
}

function clearAnimationOverrides(block: HTMLElement, children: HTMLElement[]) {
    const title = block.querySelector(".callout-info") as HTMLElement | null;
    title?.style.removeProperty("flex-shrink");
    clearChildOverrides(children);
    block.style.removeProperty("height");
    block.style.removeProperty("overflow");
    block.style.removeProperty("transition");
    block.style.removeProperty("will-change");
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

async function animateBodyHeight(block: HTMLElement, fold: boolean): Promise<boolean> {
    const state = getAnimationState(block);
    const token = state.token + 1;
    state.token = token;

    const children = getFoldAnimatedChildren(block);
    const durationMs = readFoldAnimationDurationMs(block);
    const easing = readFoldEasing(block);
    const currentHeight = block.getBoundingClientRect().height;

    if (children.length === 0) {
        if (fold) block.setAttribute("fold", "1");
        else block.removeAttribute("fold");
        return true;
    }

    setBlockHeightWithoutTransition(block, currentHeight);
    preventFlexShrink(block, children);

    if (fold) {
        const spacing = readChildSpacing(block, children);
        keepChildrenVisible(children, spacing);
        forceReflow(block);

        block.setAttribute("fold", "1");
        preventFlexShrink(block, children);
        keepChildrenVisible(children, spacing);
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
    if (completed) clearAnimationOverrides(block, children);
    return completed;
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
    try {
        const previousFold = block.getAttribute("fold");
        const originalHtml = cleanCalloutOuterHTML(block);

        debugLog(`[${fold ? "Fold" : "Unfold"}] Callout block`, blockId);

        const completed = await animateBodyHeight(block, fold);
        if (!completed || !block.isConnected) return true;

        const ok = await plugin.syncBlock(block, originalHtml, "fold");
        if (ok) return true;

        if (previousFold === null) block.removeAttribute("fold");
        else block.setAttribute("fold", previousFold);
        clearAnimationOverrides(block, getFoldAnimatedChildren(block));
        return false;
    } catch (err) {
        const action = fold ? "Fold" : "Unfold";
        errorLog(`[ERROR] ${action} failed for block ${blockId}:`, err);
        return false;
    }
}
