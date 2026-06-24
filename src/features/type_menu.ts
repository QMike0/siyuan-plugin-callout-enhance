/**
 * Callout type menu logic.
 *
 * This module owns the callout type selector menu UI, keyboard navigation,
 * and subtype application flow. The plugin instance keeps the menu state so
 * index.ts can remain the lifecycle/event orchestration layer.
 */
import { cloneEditorRange, restoreEditorRange } from "../utils/dom";
import { showMessage } from "siyuan";
import { PluginWithGetEditor } from "../core/api";
import { CalloutTypeItem, equalsCalloutKeyCI } from "../utils/callout_types";
import { renderCalloutMenuItem } from "../utils/menu_render";
import { attachCalloutMenuToHost } from "../utils/menu_host";
import { ensureCalloutMenuViewport, focusMenuListItem, resetMenuScroll } from "../utils/menu_scroll";
import { isPublishService } from "../core/cl_api";
import { debugLog } from "../utils/logger";
import { t } from "../utils/i18n";

export type TypeMenuPluginLike = PluginWithGetEditor & {
    calloutTypeMenuElement: HTMLDivElement | null;
    calloutTypeMenuActiveBlock: HTMLElement | null;
    calloutTypeMenuIndex: number;
    calloutTypeMenuSavedRange: Range | null;
    getCalloutTypes?: () => CalloutTypeItem[];
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type") => Promise<boolean>;
};

export function ensureCalloutTypeMenu(plugin: TypeMenuPluginLike) {
    if (plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuElement = document.createElement("div");
    plugin.calloutTypeMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none callout-enhance-callout-menu";
    plugin.calloutTypeMenuElement.tabIndex = -1;
    ensureCalloutMenuViewport(plugin.calloutTypeMenuElement);
}

export function hideCalloutTypeMenu(plugin: TypeMenuPluginLike, options?: { restoreSelection?: boolean }) {
    if (options?.restoreSelection) {
        restoreEditorRange(plugin.calloutTypeMenuSavedRange);
    }
    plugin.calloutTypeMenuSavedRange = null;
    if (plugin.calloutTypeMenuElement) {
        resetMenuScroll(plugin.calloutTypeMenuElement);
        plugin.calloutTypeMenuElement.style.visibility = "";
        plugin.calloutTypeMenuElement.classList.add("fn__none");
    }
    plugin.calloutTypeMenuActiveBlock = null;
    plugin.calloutTypeMenuIndex = -1;
}

function isActiveCalloutType(item: CalloutTypeItem, block: HTMLElement | null) {
    if (!block) return false;
    const subtype = block.getAttribute("data-subtype") || "";
    if (!subtype) return false;
    if (equalsCalloutKeyCI(item.label, subtype)) return true;
    return (item.pastLabels || []).some((pastLabel) => equalsCalloutKeyCI(pastLabel, subtype));
}

function renderCalloutTypeMenu(plugin: TypeMenuPluginLike) {
    if (!plugin.calloutTypeMenuElement) return;
    const viewport = ensureCalloutMenuViewport(plugin.calloutTypeMenuElement);
    viewport.innerHTML = "";
    const calloutTypes = plugin.getCalloutTypes?.() ?? [];
    const activeBlock = plugin.calloutTypeMenuActiveBlock;
    calloutTypes.forEach((item, index) => {
        const btn = renderCalloutMenuItem(item, {
            focused: index === plugin.calloutTypeMenuIndex,
            selected: isActiveCalloutType(item, activeBlock),
            activateEvent: "click",
            onActivate: async () => {
                plugin.calloutTypeMenuIndex = index;
                await applyCalloutType(plugin, item.label);
            },
        });
        viewport.appendChild(btn);
    });
}

function focusCalloutTypeMenuItem(plugin: TypeMenuPluginLike, index: number) {
    const calloutTypes = plugin.getCalloutTypes?.() ?? [];
    if (!plugin.calloutTypeMenuElement || calloutTypes.length === 0) return;
    const normalizedIndex = (index + calloutTypes.length) % calloutTypes.length;
    plugin.calloutTypeMenuIndex = normalizedIndex;
    const items = plugin.calloutTypeMenuElement.querySelectorAll(".b3-list-item");
    if (items.length !== calloutTypes.length) {
        renderCalloutTypeMenu(plugin);
    }
    focusMenuListItem(plugin.calloutTypeMenuElement, normalizedIndex);
}

function positionCalloutTypeMenu(menu: HTMLElement, x: number, y: number) {
    const menuWidth = menu.offsetWidth || 200;
    const menuHeight = menu.offsetHeight || 300;
    const padding = 8;
    let top = y;
    let left = x;
    if (top + menuHeight + padding > window.innerHeight) {
        top = Math.max(padding, window.innerHeight - menuHeight - padding);
    }
    if (top < padding) top = padding;
    if (left + menuWidth + padding > window.innerWidth) {
        left = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (left < padding) left = padding;
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

export function showCalloutTypeMenu(plugin: TypeMenuPluginLike, block: HTMLElement, x: number, y: number) {
    if (isPublishService()) return;
    ensureCalloutTypeMenu(plugin);
    if (!plugin.calloutTypeMenuElement) return;
    attachCalloutMenuToHost(plugin.calloutTypeMenuElement, block);
    plugin.calloutTypeMenuActiveBlock = block;
    plugin.calloutTypeMenuIndex = 0;
    plugin.calloutTypeMenuSavedRange = cloneEditorRange();
    renderCalloutTypeMenu(plugin);
    plugin.calloutTypeMenuElement.style.visibility = "hidden";
    plugin.calloutTypeMenuElement.classList.remove("fn__none");
    resetMenuScroll(plugin.calloutTypeMenuElement);
    positionCalloutTypeMenu(plugin.calloutTypeMenuElement, x, y);
    focusCalloutTypeMenuItem(plugin, 0);
    plugin.calloutTypeMenuElement.style.visibility = "";
}

export async function applyCalloutType(plugin: TypeMenuPluginLike, newType: string) {
    if (isPublishService()) return;
    const block = plugin.calloutTypeMenuActiveBlock;
    if (!block) return;
    const blockId = block.dataset.nodeId;
    if (!blockId) return;

    const nextSubtype = newType.toUpperCase();
    const previousSubtype = block.getAttribute("data-subtype") || "";
    const originalHtml = block.outerHTML;
    debugLog(`[Type] Changing from ${previousSubtype || "(default)"} to ${nextSubtype}`);
    block.dataset.subtype = nextSubtype;

    const ok = await plugin.syncBlock(block, originalHtml, "type");
    if (ok) {
        debugLog(`[Type] Success: changed to ${nextSubtype}`);
        hideCalloutTypeMenu(plugin);
        return;
    }

    if (previousSubtype) {
        block.dataset.subtype = previousSubtype;
    } else {
        delete block.dataset.subtype;
    }
    debugLog(plugin, "[Type] Rollback: reverted to", previousSubtype || "(default)");
    showMessage(t("calloutSubtypeSaveFailed"));
}

export function handleCalloutTypeKeydown(plugin: TypeMenuPluginLike, e: KeyboardEvent) {
    if (!plugin.calloutTypeMenuElement || plugin.calloutTypeMenuElement.classList.contains("fn__none")) return;
    const calloutTypes = plugin.getCalloutTypes?.() ?? [];
    if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        focusCalloutTypeMenuItem(plugin, plugin.calloutTypeMenuIndex + 1);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        focusCalloutTypeMenuItem(plugin, plugin.calloutTypeMenuIndex - 1);
    } else if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        focusCalloutTypeMenuItem(plugin, 0);
    } else if (e.key === "End") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        focusCalloutTypeMenuItem(plugin, calloutTypes.length - 1);
    } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void applyCalloutType(plugin, calloutTypes[plugin.calloutTypeMenuIndex >= 0 ? plugin.calloutTypeMenuIndex : 0]?.label ?? "");
    } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideCalloutTypeMenu(plugin, { restoreSelection: true });
    }
}
