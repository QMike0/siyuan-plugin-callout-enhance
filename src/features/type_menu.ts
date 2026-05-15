/**
 * Callout type menu logic.
 *
 * This module owns the callout type selector menu UI, keyboard navigation,
 * and subtype application flow. The plugin instance keeps the menu state so
 * index.ts can remain the lifecycle/event orchestration layer.
 */
import { showMessage } from "siyuan";
import { CALLOUT_TYPES } from "../utils/callout_types";
import { debugLog } from "../utils/logger";

export function ensureCalloutTypeMenu(plugin: any) {
    if (plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuElement = document.createElement("div");
    plugin.calloutTypeMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none";
    plugin.calloutTypeMenuElement.tabIndex = -1;
    plugin.calloutTypeMenuElement.style.cssText = "position:fixed; z-index:9999; min-width:160px; padding:6px; box-shadow: var(--b3-dialog-shadow);";
    document.body.appendChild(plugin.calloutTypeMenuElement);
}

export function hideCalloutTypeMenu(plugin: any) {
    if (plugin.calloutTypeMenuElement) {
        plugin.calloutTypeMenuElement.classList.add("fn__none");
    }
    plugin.calloutTypeMenuActiveBlock = null;
    plugin.calloutTypeMenuIndex = -1;
}

function renderCalloutTypeMenu(plugin: any) {
    if (!plugin.calloutTypeMenuElement) return;
    plugin.calloutTypeMenuElement.innerHTML = "";
    CALLOUT_TYPES.forEach((item, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.tabIndex = -1;
        btn.className = `b3-list-item b3-list-item--two ${index === plugin.calloutTypeMenuIndex ? "b3-list-item--focus" : ""}`;
        btn.innerHTML = `
          <div class="b3-list-item__first" style="display:flex; align-items:center; gap:4px;">
            <span class="b3-list-item__graphic" style="width:20px; flex-shrink:0; text-align:center; font-size:16px; border:none; background:transparent;">${item.icon}</span>
            <span class="b3-list-item__text" style="font-size:15px;">${item.label}</span>
          </div>`;
        btn.onclick = async (e) => {
            e.stopPropagation();
            plugin.calloutTypeMenuIndex = index;
            await applyCalloutType(plugin, item.type);
        };
        plugin.calloutTypeMenuElement!.appendChild(btn);
    });
}

function focusCalloutTypeMenuItem(plugin: any, index: number) {
    if (!plugin.calloutTypeMenuElement || CALLOUT_TYPES.length === 0) return;
    const normalizedIndex = (index + CALLOUT_TYPES.length) % CALLOUT_TYPES.length;
    plugin.calloutTypeMenuIndex = normalizedIndex;
    renderCalloutTypeMenu(plugin);
    const activeButton = plugin.calloutTypeMenuElement.querySelector(".b3-list-item--focus") as HTMLButtonElement | null;
    activeButton?.focus();
    activeButton?.scrollIntoView({ block: "nearest" });
}

export function showCalloutTypeMenu(plugin: any, block: HTMLElement, x: number, y: number) {
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

export async function applyCalloutType(plugin: any, newType: string) {
    const block = plugin.calloutTypeMenuActiveBlock;
    if (!block) return;
    const blockId = block.dataset.nodeId;
    if (!blockId) return;

    const nextSubtype = newType.toUpperCase();
    const previousSubtype = block.getAttribute("data-subtype") || "";
    const originalHtml = block.outerHTML;
    debugLog(plugin, "[Type] Changing from", previousSubtype || "(default)", "to", nextSubtype);
    block.dataset.subtype = nextSubtype;

    const ok = await plugin.syncBlock(block, originalHtml);
    if (ok) {
        debugLog(plugin, "[Type] Success: changed to", nextSubtype);
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

export function handleCalloutTypeKeydown(plugin: any, e: KeyboardEvent) {
    if (!plugin.calloutTypeMenuElement || plugin.calloutTypeMenuElement.classList.contains("fn__none")) return;
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
        focusCalloutTypeMenuItem(plugin, CALLOUT_TYPES.length - 1);
    } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void applyCalloutType(plugin, CALLOUT_TYPES[plugin.calloutTypeMenuIndex >= 0 ? plugin.calloutTypeMenuIndex : 0].type);
    } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideCalloutTypeMenu(plugin);
    }
}
