/**
 * Persistent max-height toggle for callout body scrolling.
 */
import { isPublishService } from "../core/cl_api";
import { cleanCalloutOuterHTML } from "../utils/callout";
import { debugLog, errorLog } from "../utils/logger";

export const CALLOUT_SCROLL_LIMIT_ATTRIBUTE = "custom-callout-scroll-limit";
const LEGACY_CALLOUT_SCROLL_LIMIT_CLASS = "callout-enhance-scroll-limited";

export type CalloutScrollLimitPluginLike = {
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type" | "scroll") => Promise<boolean>;
};

export function isCalloutScrollLimited(block: HTMLElement | null | undefined) {
    return block?.getAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE) === "1" ||
        !!block?.classList?.contains(LEGACY_CALLOUT_SCROLL_LIMIT_CLASS);
}

export async function toggleCalloutScrollLimit(plugin: CalloutScrollLimitPluginLike, block: HTMLElement | null) {
    if (isPublishService()) return false;
    if (!block || !block.dataset.nodeId) return false;

    const blockId = block.dataset.nodeId;
    const wasLimited = isCalloutScrollLimited(block);
    const previousAttribute = block.getAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE);
    const hadLegacyClass = block.classList.contains(LEGACY_CALLOUT_SCROLL_LIMIT_CLASS);
    const originalHtml = cleanCalloutOuterHTML(block);

    try {
        block.classList.remove(LEGACY_CALLOUT_SCROLL_LIMIT_CLASS);
        if (wasLimited) block.removeAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE);
        else block.setAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE, "1");
        debugLog(`[ScrollLimit] ${wasLimited ? "Disable" : "Enable"} callout body limit`, blockId);

        const ok = await plugin.syncBlock(block, originalHtml, "scroll");
        if (ok) return true;

        if (previousAttribute === null) block.removeAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE);
        else block.setAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE, previousAttribute);
        block.classList.toggle(LEGACY_CALLOUT_SCROLL_LIMIT_CLASS, hadLegacyClass);
        return false;
    } catch (err) {
        if (previousAttribute === null) block.removeAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE);
        else block.setAttribute(CALLOUT_SCROLL_LIMIT_ATTRIBUTE, previousAttribute);
        block.classList.toggle(LEGACY_CALLOUT_SCROLL_LIMIT_CLASS, hadLegacyClass);
        errorLog(`[ERROR] Scroll limit toggle failed for block ${blockId}:`, err);
        return false;
    }
}
