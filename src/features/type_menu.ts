/**
 * Callout type menu logic.
 *
 * This module owns the callout type selector menu UI, keyboard navigation,
 * and subtype application flow. The plugin instance keeps the menu state so
 * index.ts can remain the lifecycle/event orchestration layer.
 */
import { showMessage } from "siyuan";
import { PluginWithGetEditor } from "../core/api";
import { CalloutTypeItem, getCalloutPreviewTitle, renderCalloutIconSpan } from "../utils/callout_types";
import { debugLog } from "../utils/logger";

export type TypeMenuPluginLike = PluginWithGetEditor & {
    calloutTypeMenuElement: HTMLDivElement | null;
    calloutTypeMenuActiveBlock: HTMLElement | null;
    calloutTypeMenuIndex: number;
    getCalloutTypes?: () => CalloutTypeItem[];
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type") => Promise<boolean>;
};

export function ensureCalloutTypeMenu(plugin: TypeMenuPluginLike) {
    if (plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuElement = document.createElement("div");
    plugin.calloutTypeMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none";
    plugin.calloutTypeMenuElement.tabIndex = -1;
    plugin.calloutTypeMenuElement.style.cssText = "position:fixed; z-index:9999; min-width:160px; max-height:320px; overflow-y:auto; padding:6px; box-shadow: var(--b3-dialog-shadow);";
    document.body.appendChild(plugin.calloutTypeMenuElement);
}

export function hideCalloutTypeMenu(plugin: TypeMenuPluginLike) {
    if (plugin.calloutTypeMenuElement) {
        plugin.calloutTypeMenuElement.classList.add("fn__none");
    }
    plugin.calloutTypeMenuActiveBlock = null;
    plugin.calloutTypeMenuIndex = -1;
}

function renderCalloutTypeMenu(plugin: TypeMenuPluginLike) {
    if (!plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuElement.innerHTML = "";
    const calloutTypes = plugin.getCalloutTypes?.() ?? [];
    calloutTypes.forEach((item, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.tabIndex = -1;
        btn.className = `b3-list-item b3-list-item--two ${index === plugin.calloutTypeMenuIndex ? "b3-list-item--focus" : ""}`;
        const first = document.createElement("div");
        first.className = "b3-list-item__first";
        first.style.display = "flex";
        first.style.alignItems = "center";
        first.style.gap = "4px";
        const iconEl = renderCalloutIconSpan(item.icon || item.label, "b3-list-item__graphic callout-enhance-menu-icon", item.label, {
            preferEditorIcon: true,
            subtype: item.label,
            size: "var(--callout-enhance-menu-icon-size)",
        });
        iconEl.style.display = "inline-flex";
        iconEl.style.alignItems = "center";
        iconEl.style.justifyContent = "center";
        const text = document.createElement("span");
        text.className = "b3-list-item__text";
        text.style.fontSize = "15px";
        text.textContent = getCalloutPreviewTitle(item);
        first.append(iconEl, text);
        btn.appendChild(first);
        btn.onclick = async (e) => {
            e.stopPropagation();
            plugin.calloutTypeMenuIndex = index;
            await applyCalloutType(plugin, item.label);
        };
        plugin.calloutTypeMenuElement!.appendChild(btn);
    });
}

function focusCalloutTypeMenuItem(plugin: TypeMenuPluginLike, index: number) {
    const calloutTypes = plugin.getCalloutTypes?.() ?? [];
    if (!plugin.calloutTypeMenuElement || calloutTypes.length === 0) return;
    const normalizedIndex = (index + calloutTypes.length) % calloutTypes.length;
    plugin.calloutTypeMenuIndex = normalizedIndex;
    renderCalloutTypeMenu(plugin);
    const activeButton = plugin.calloutTypeMenuElement.querySelector(".b3-list-item--focus") as HTMLButtonElement | null;
    activeButton?.focus();
    activeButton?.scrollIntoView({ block: "nearest" });
}

export function showCalloutTypeMenu(plugin: TypeMenuPluginLike, block: HTMLElement, x: number, y: number) {
    ensureCalloutTypeMenu(plugin);
    if (!plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuActiveBlock = block;
    plugin.calloutTypeMenuIndex = 0;
    renderCalloutTypeMenu(plugin);
    plugin.calloutTypeMenuElement.classList.remove("fn__none");
    setTimeout(() => {
        if (!plugin.calloutTypeMenuElement) return;
        const menuWidth = plugin.calloutTypeMenuElement.offsetWidth || 200;
        const menuHeight = plugin.calloutTypeMenuElement.offsetHeight || 300;
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
        plugin.calloutTypeMenuElement.style.top = `${top}px`;
        plugin.calloutTypeMenuElement.style.left = `${left}px`;
        focusCalloutTypeMenuItem(plugin, 0);
    }, 0);
}

export async function applyCalloutType(plugin: TypeMenuPluginLike, newType: string) {
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
    showMessage("callout subtype save failed");
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
        hideCalloutTypeMenu(plugin);
    }
}
