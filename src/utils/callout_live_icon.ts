/**
 * Live callout icons via `<svg><use href="#symbolId">` (same model as SiYuan toolbar buttons).
 *
 * Symbol icons must not be baked into CSS mask data-URLs: third-party packs load
 * asynchronously after litheness, and snapshots would freeze the default shapes.
 */

import { parseIconRef, createSymbolUseElement, getSymbolRenderMeta } from "./icons";
import { CalloutEnhanceSettings } from "./settings";
import { resolveCalloutTypeBySubtype } from "./callout_resolver";

export const LIVE_ICON_CLASS = "callout-enhance-live-icon";
export const LIVE_ICON_HOST_CLASS = "callout-enhance-live-icon-host";

/** True when the configured icon should be rendered as a live sprite reference. */
export function getLiveSymbolIdFromIcon(icon: string | null | undefined): string | null {
    const ref = parseIconRef(icon);
    if (ref.kind !== "symbol" || !ref.id) return null;
    return ref.id;
}

export function resolveLiveSymbolIdForCallout(
    block: HTMLElement,
    settings: Partial<CalloutEnhanceSettings> | null | undefined,
): string | null {
    const subtype = (block.dataset.subtype || "").trim();
    if (!subtype) return null;
    const item = resolveCalloutTypeBySubtype(settings, subtype);
    if (!item) return null;
    return getLiveSymbolIdFromIcon(item.icon);
}

function getLiveIconHost(block: HTMLElement): HTMLElement | null {
    return block.querySelector(`:scope > .${LIVE_ICON_HOST_CLASS}`);
}

function paintKeyForSymbol(symbolId: string) {
    return getSymbolRenderMeta(symbolId).paint;
}

/**
 * Ensure the callout either has a live `<use>` icon host, or falls back to CSS ::before masks.
 */
export function syncCalloutLiveIcon(
    block: HTMLElement,
    settings: Partial<CalloutEnhanceSettings> | null | undefined,
) {
    if (typeof document === "undefined") return;
    if (!block?.classList?.contains("callout")) return;
    // Settings previews manage their own host via syncPreviewLiveIcon (draft icons).
    if (block.classList.contains("callout-enhance-setting-preview")) return;

    const symbolId = resolveLiveSymbolIdForCallout(block, settings);
    let host = getLiveIconHost(block);

    if (!symbolId) {
        block.classList.remove(LIVE_ICON_CLASS);
        host?.remove();
        return;
    }

    block.classList.add(LIVE_ICON_CLASS);
    if (!host) {
        host = document.createElement("span");
        host.className = LIVE_ICON_HOST_CLASS;
        host.setAttribute("aria-hidden", "true");
        block.insertBefore(host, block.firstChild);
    }

    const nextPaint = paintKeyForSymbol(symbolId);
    if (host.dataset.symbolId === symbolId && host.dataset.paint === nextPaint && host.querySelector("svg")) {
        return;
    }

    host.dataset.symbolId = symbolId;
    host.dataset.paint = nextPaint;
    host.replaceChildren(createSymbolUseElement(symbolId, "100%", "callout-enhance-live-icon-svg"));
}

export function syncAllCalloutLiveIcons(settings: Partial<CalloutEnhanceSettings> | null | undefined) {
    if (typeof document === "undefined") return;
    document.querySelectorAll('.callout[data-type="NodeCallout"]').forEach((node) => {
        const block = node as HTMLElement;
        // Settings previews are synced by the panel when built; still safe to update.
        syncCalloutLiveIcon(block, settings);
    });
}

/** Strip live-icon runtime nodes/classes from a callout clone before persistence / undo HTML. */
export function stripCalloutLiveIconRuntime(callout: Element) {
    callout.classList.remove(LIVE_ICON_CLASS);
    callout.querySelectorAll(`.${LIVE_ICON_HOST_CLASS}`).forEach((el) => el.remove());
}

/**
 * Watch SiYuan icon script tags. When the third-party pack finishes loading,
 * refresh paint mode on live icons (litheness → colorful etc.).
 */
export function watchSiYuanIconScripts(onIconsReady: () => void): () => void {
    if (typeof document === "undefined") return () => {};

    let cancelled = false;
    const notify = () => {
        if (cancelled) return;
        onIconsReady();
    };

    const bindScript = (el: HTMLScriptElement | null) => {
        if (!el) return;
        if ((el as any).dataset.calloutEnhanceIconWatch === "1") return;
        (el as any).dataset.calloutEnhanceIconWatch = "1";
        if ((el as HTMLScriptElement).dataset.loaded === "true" || (el as any).complete) {
            // addScript may mark loaded; still schedule after current pack chain.
            queueMicrotask(notify);
        }
        el.addEventListener("load", notify);
        el.addEventListener("error", notify);
    };

    bindScript(document.getElementById("iconDefaultScript") as HTMLScriptElement | null);
    bindScript(document.getElementById("iconScript") as HTMLScriptElement | null);

    const observer = new MutationObserver(() => {
        bindScript(document.getElementById("iconDefaultScript") as HTMLScriptElement | null);
        bindScript(document.getElementById("iconScript") as HTMLScriptElement | null);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Fallback: third-party pack is nested after default; poll briefly after startup.
    const timers = [0, 100, 300, 800, 1600, 3200].map((ms) =>
        window.setTimeout(notify, ms),
    );

    return () => {
        cancelled = true;
        observer.disconnect();
        timers.forEach((id) => clearTimeout(id));
    };
}

/** Preview helper: attach live icon host for symbol:* draft/editor icons. */
export function syncPreviewLiveIcon(
    preview: HTMLElement,
    icon: string | null | undefined,
) {
    const symbolId = getLiveSymbolIdFromIcon(icon);
    let host = getLiveIconHost(preview);
    if (!symbolId) {
        preview.classList.remove(LIVE_ICON_CLASS);
        host?.remove();
        return false;
    }
    preview.classList.add(LIVE_ICON_CLASS);
    if (!host) {
        host = document.createElement("span");
        host.className = LIVE_ICON_HOST_CLASS;
        host.setAttribute("aria-hidden", "true");
        preview.insertBefore(host, preview.firstChild);
    }
    const nextPaint = paintKeyForSymbol(symbolId);
    if (host.dataset.symbolId !== symbolId || host.dataset.paint !== nextPaint || !host.querySelector("svg")) {
        host.dataset.symbolId = symbolId;
        host.dataset.paint = nextPaint;
        host.replaceChildren(createSymbolUseElement(symbolId, "100%", "callout-enhance-live-icon-svg"));
    }
    return true;
}
