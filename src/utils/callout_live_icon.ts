/**
 * Icon-pack load watching + cleanup of legacy live-icon DOM.
 *
 * Editor callout icons are CSS ::before masks/images. Rebake after SiYuan's
 * icon scripts settle, and whenever appearance / icon pack changes
 * (`setAppearance` → `loadAssets`).
 */

export const LIVE_ICON_CLASS = "callout-enhance-live-icon";
export const LIVE_ICON_HOST_CLASS = "callout-enhance-live-icon-host";

const ICON_SCRIPT_IDS = new Set(["iconDefaultScript", "iconScript"]);
const ICON_SCRIPT_SRC_RE = /\/appearance\/icons\//i;

/** Strip live-icon runtime nodes/classes from a callout (clone or live element). */
export function stripCalloutLiveIconRuntime(callout: Element) {
    callout.classList.remove(LIVE_ICON_CLASS);
    callout.querySelectorAll(`.${LIVE_ICON_HOST_CLASS}`).forEach((el) => el.remove());
}

/** Remove leftover live-icon hosts from the editor (polluted docs / previous plugin builds). */
export function removeAllCalloutLiveIconHosts(root: ParentNode = document) {
    if (typeof document === "undefined") return;
    root.querySelectorAll(`.${LIVE_ICON_HOST_CLASS}`).forEach((el) => el.remove());
    root.querySelectorAll(`.${LIVE_ICON_CLASS}`).forEach((el) => {
        el.classList.remove(LIVE_ICON_CLASS);
    });
}

function isHtmlScript(node: Node): node is HTMLScriptElement {
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "SCRIPT";
}

/** SiYuan `addScript` appends the tag without `id`; id is assigned in `onload`. */
function isSiYuanIconPackScript(el: HTMLScriptElement): boolean {
    const id = el.id || "";
    if (ICON_SCRIPT_IDS.has(id)) return true;
    const src = el.getAttribute("src") || el.src || "";
    return ICON_SCRIPT_SRC_RE.test(src);
}

/**
 * Schedule several rebakes so we catch SiYuan's async `loadAssets` chain
 * (default pack may already be present → no reload; third-party add/remove is async).
 */
export function scheduleIconPackStyleRefresh(onReady: () => void, delaysMs: number[] = [0, 80, 200, 450, 900, 1600]): () => void {
    if (typeof window === "undefined") {
        onReady();
        return () => {};
    }
    const timers = delaysMs.map((ms) => window.setTimeout(onReady, ms));
    return () => timers.forEach((id) => clearTimeout(id));
}

/**
 * Watch SiYuan icon script tags / removals. When packs finish loading or a
 * third-party script is removed (switch back to built-in), rebake CSS snapshots.
 */
export function watchSiYuanIconScripts(onIconsReady: () => void): () => void {
    if (typeof document === "undefined") return () => {};

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const watched = new WeakSet<HTMLScriptElement>();
    const loadHandlers = new Map<HTMLScriptElement, () => void>();

    const notify = () => {
        if (cancelled) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            if (!cancelled) onIconsReady();
        }, 60);
    };

    const unbindScript = (el: HTMLScriptElement) => {
        const handler = loadHandlers.get(el);
        if (!handler) return;
        el.removeEventListener("load", handler);
        el.removeEventListener("error", handler);
        loadHandlers.delete(el);
    };

    const bindScript = (el: HTMLScriptElement | null) => {
        if (!el || !isSiYuanIconPackScript(el)) return;
        if (watched.has(el)) return;
        watched.add(el);
        const handler = () => notify();
        loadHandlers.set(el, handler);
        el.addEventListener("load", handler);
        el.addEventListener("error", handler);
        // Cached / already-present scripts often skip a new `load` event.
        notify();
    };

    const bindCurrent = () => {
        document.querySelectorAll("script").forEach((node) => {
            bindScript(node as HTMLScriptElement);
        });
    };

    bindCurrent();

    const observer = new MutationObserver((mutations) => {
        let touched = false;
        for (const mutation of mutations) {
            if (mutation.type === "attributes" && isHtmlScript(mutation.target)) {
                const el = mutation.target;
                if (isSiYuanIconPackScript(el)) {
                    bindScript(el);
                    touched = true;
                }
                continue;
            }
            mutation.addedNodes.forEach((node) => {
                if (!isHtmlScript(node)) return;
                // Match by src even before SiYuan assigns id in onload.
                if (isSiYuanIconPackScript(node) || ICON_SCRIPT_SRC_RE.test(node.getAttribute("src") || node.src || "")) {
                    bindScript(node);
                    touched = true;
                }
            });
            mutation.removedNodes.forEach((node) => {
                if (!isHtmlScript(node)) return;
                if (ICON_SCRIPT_IDS.has(node.id) || ICON_SCRIPT_SRC_RE.test(node.getAttribute("src") || node.src || "")) {
                    unbindScript(node);
                    touched = true;
                }
            });
        }
        if (touched) {
            bindCurrent();
            notify();
        }
    });
    observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["id", "src"],
    });

    // Cold-start fallback: nested addScript(default → third) after plugin onload.
    const startupTimers = [0, 100, 300, 800, 1600, 3200].map((ms) => window.setTimeout(notify, ms));

    return () => {
        cancelled = true;
        observer.disconnect();
        if (debounceTimer) clearTimeout(debounceTimer);
        startupTimers.forEach((id) => clearTimeout(id));
        loadHandlers.forEach((_, el) => unbindScript(el));
    };
}

type AppearanceWsDetail = {
    cmd?: string;
    data?: { icon?: string; iconVer?: string };
};

/**
 * Listen for SiYuan appearance updates (settings → 外观 → 图标).
 * `ws-main` / `setAppearance` is emitted before `loadAssets` finishes, so we
 * schedule staggered rebakes in addition to script-tag watching.
 *
 * Only icon / iconVer changes trigger rebake (theme-only appearance updates are ignored).
 */
export function watchSiYuanAppearanceForIconPack(
    eventBus: {
        on: (type: "ws-main", listener: (event: CustomEvent<AppearanceWsDetail>) => void) => void;
        off: (type: "ws-main", listener: (event: CustomEvent<AppearanceWsDetail>) => void) => void;
    },
    onAppearanceIconChange: () => void,
): () => void {
    let cancelScheduled: (() => void) | null = null;

    const handler = (event: CustomEvent<AppearanceWsDetail>) => {
        const detail = event?.detail;
        if (detail?.cmd !== "setAppearance") return;

        const next = detail.data;
        const prev = (window as any)?.siyuan?.config?.appearance as
            | { icon?: string; iconVer?: string }
            | undefined;
        // ws-main runs before onSetAppearance assigns config; compare payload vs current.
        if (
            next &&
            prev &&
            next.icon === prev.icon &&
            String(next.iconVer ?? "") === String(prev.iconVer ?? "")
        ) {
            return;
        }

        cancelScheduled?.();
        cancelScheduled = scheduleIconPackStyleRefresh(onAppearanceIconChange);
    };

    eventBus.on("ws-main", handler);
    return () => {
        eventBus.off("ws-main", handler);
        cancelScheduled?.();
        cancelScheduled = null;
    };
}
