/**
 * Completion menu logic for callout blocks.
 *
 * This module contains the completion trigger detection, menu rendering,
 * keyboard navigation, and completion transform handling for quote blocks.
 */
import { showMessage } from "siyuan";
import { getBlockquoteElement, getSelectionCallout } from "../utils/dom";
import { getCalloutBodyContainer } from "../utils/callout";
import { getNewNodeId } from "../core/api";
import { CALLOUT_TYPES } from "../utils/callout_types";
import { errorLog } from "../utils/logger";

export type CompletionSession = {
    active: boolean;
    quote: HTMLElement | null;
    start: number;
};

const TRIGGER_PATTERN = /[\[【［]([a-zA-Z]*)$/i;
const SESSION_TRIGGER_PATTERN = /^[\[【［]([a-zA-Z]*)$/i;

function isTriggerChar(ch: string) {
    return ch === "[" || ch === "【" || ch === "［";
}

function getQuoteContentLineElement(quoteEl: HTMLElement | null, sourceNode: Node | null): HTMLElement | null {
    if (!quoteEl || !sourceNode) return null;
    const sourceEl = sourceNode.nodeType === Node.TEXT_NODE ? sourceNode.parentElement : (sourceNode as HTMLElement);
    let current: HTMLElement | null = sourceEl;
    while (current && current.parentElement && current.parentElement !== quoteEl) {
        current = current.parentElement;
    }
    return current && current.parentElement === quoteEl ? current : null;
}

function isTriggerAtLogicalLineStart(lineEl: HTMLElement | null, focusNode: Text, triggerOffset: number): boolean {
    if (!lineEl || !focusNode) return false;
    try {
        if (!lineEl.contains(focusNode)) return false;
        const range = document.createRange();
        range.setStart(lineEl, 0);
        range.setEnd(focusNode, triggerOffset);
        const before = range.toString().replace(/[\u200B\u00A0]/g, "").trim();
        return before.length === 0;
    } catch {
        return false;
    }
}

function applyCompletionTransform(selectedType: string): boolean {
    try {
        const selection = window.getSelection();
        if (!selection) return false;
        const textNode = selection?.rangeCount ? (selection.getRangeAt(0).startContainer as Text) : null;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return false;

        const content = textNode.textContent || "";
        const match = content.match(TRIGGER_PATTERN);
        const startOffset = match ? content.lastIndexOf(match[0]) : -1;
        if (startOffset < 0) return false;

        const quoteEl = getBlockquoteElement(textNode);
        const lineEl = getQuoteContentLineElement(quoteEl, textNode);
        if (!isTriggerAtLogicalLineStart(lineEl, textNode, startOffset)) return false;

        const replacement = `[!${selectedType}]\n`;
        const workRange = document.createRange();
        workRange.setStart(textNode, startOffset);
        workRange.setEnd(textNode, content.length);
        workRange.deleteContents();

        const newNode = document.createTextNode(replacement);
        workRange.insertNode(newNode);

        const afterRange = document.createRange();
        afterRange.setStartAfter(newNode);
        afterRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(afterRange);

        const enterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            keyCode: 13,
            code: "Enter",
            which: 13,
            bubbles: true,
            cancelable: true,
        });
        const parentEl = newNode.parentElement || textNode.parentElement;
        if (parentEl && parentEl.dispatchEvent) {
            parentEl.dispatchEvent(enterEvent);
        } else {
            document.dispatchEvent(enterEvent);
        }
        return true;
    } catch (err) {
        console.error("[ERROR] Completion transform failed:", err);
        return false;
    }
}

export function ensureCompletionMenu(plugin: any) {
    if (plugin.completionMenuElement) return;
    plugin.completionMenuElement = document.createElement("div");
    plugin.completionMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none";
    plugin.completionMenuElement.style.cssText = "position:fixed; z-index:9999; min-width:160px; padding:6px; box-shadow: var(--b3-dialog-shadow);";
    document.body.appendChild(plugin.completionMenuElement);
}

export function hideCompletionMenu(plugin: any) {
    plugin.completionVisible = false;
    plugin.completionIndex = -1;
    plugin.completionSession.active = false;
    plugin.completionSession.quote = null;
    plugin.completionSession.start = -1;
    if (plugin.completionMenuElement) {
        plugin.completionMenuElement.classList.add("fn__none");
    }
}

function renderCompletionMenu(plugin: any) {
    if (!plugin.completionMenuElement) return;
    plugin.completionMenuElement.innerHTML = "";
    plugin.completionFiltered.forEach((item: any, i: number) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.tabIndex = -1;
        btn.className = `b3-list-item b3-list-item--two ${i === plugin.completionIndex ? "b3-list-item--focus" : ""}`;
        btn.innerHTML = `
                <div class="b3-list-item__first" style="display:flex; align-items:center; gap:4px;">
                    <span class="b3-list-item__graphic" style="width:20px; flex-shrink:0; text-align:center; font-size:16px; border:none; background:transparent;">${item.icon}</span>
                    <span class="b3-list-item__text" style="font-size:15px;">${item.label}</span>
                </div>`;
        btn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            applyCompletion(plugin, i);
        };
        plugin.completionMenuElement!.appendChild(btn);
    });
    plugin.completionMenuElement.classList.remove("fn__none");
    if (plugin.completionIndex === -1) plugin.completionIndex = 0;
    const activeButton = plugin.completionMenuElement.querySelector(".b3-list-item--focus") as HTMLButtonElement | null;
    activeButton?.scrollIntoView({ block: "nearest" });
}

function updateCompletionMenuPosition(plugin: any, rect: DOMRect) {
    if (!plugin.completionMenuElement) return;
    const menuWidth = plugin.completionMenuElement.offsetWidth || 200;
    const menuHeight = plugin.completionMenuElement.offsetHeight || 300;
    const padding = 8;
    let top = rect.bottom + padding;
    let left = rect.left;
    if (top + menuHeight + padding > window.innerHeight) top = rect.top - menuHeight - padding;
    if (top < padding) top = padding;
    if (left + menuWidth + padding > window.innerWidth) left = Math.max(padding, window.innerWidth - menuWidth - padding);
    if (left < padding) left = padding;
    plugin.completionMenuElement.style.top = `${top}px`;
    plugin.completionMenuElement.style.left = `${left}px`;
}

export function showCompletionMenu(plugin: any, filterText: string, rect: DOMRect) {
    ensureCompletionMenu(plugin);
    if (!plugin.completionMenuElement) return;
    plugin.completionFiltered = CALLOUT_TYPES.filter((t) => t.type.toLowerCase().includes(filterText.toLowerCase()) || t.label.toLowerCase().includes(filterText.toLowerCase()));
    if (plugin.completionFiltered.length === 0) {
        hideCompletionMenu(plugin);
        return;
    }
    plugin.completionVisible = true;
    plugin.completionIndex = 0;
    renderCompletionMenu(plugin);
    updateCompletionMenuPosition(plugin, rect);
}

export function applyCompletion(plugin: any, index = plugin.completionIndex) {
    const selected = plugin.completionFiltered[index];
    if (!selected) return;
    hideCompletionMenu(plugin);
    const ok = applyCompletionTransform(selected.type);
    if (!ok) showMessage("callout completion transform failed");
}

function isFirstLineOfQuote(quoteEl: HTMLElement | null, sourceNode: Node | null): boolean {
    if (!quoteEl || !sourceNode) return false;
    const line = getQuoteContentLineElement(quoteEl, sourceNode);
    if (!line) return false;
    const firstLine = Array.from(quoteEl.children).find((child) => !((child as HTMLElement).classList?.contains("protyle-attr"))) as HTMLElement | undefined;
    return !!firstLine && line === firstLine;
}

export function handleCompletionInput(plugin: any, e: InputEvent) {
    if (plugin.isComposing) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
        hideCompletionMenu(plugin);
        return;
    }
    const focusNode = sel.focusNode;
    if (focusNode?.nodeType !== Node.TEXT_NODE) {
        hideCompletionMenu(plugin);
        return;
    }
    const focusText = focusNode as Text;
    const quoteEl = getBlockquoteElement(focusText);
    if (!quoteEl) {
        hideCompletionMenu(plugin);
        return;
    }
    const cursorOffset = sel.focusOffset;
    const text = focusText.textContent || "";
    const textBeforeCursor = text.substring(0, cursorOffset);

    if (plugin.completionSession.active) {
        if (cursorOffset < plugin.completionSession.start) {
            hideCompletionMenu(plugin);
            return;
        }
        if (!isFirstLineOfQuote(quoteEl, focusText)) {
            if (plugin.completionVisible) hideCompletionMenu(plugin);
            return;
        }
        const lineEl = getQuoteContentLineElement(quoteEl, focusText);
        if (!isTriggerAtLogicalLineStart(lineEl, focusText, plugin.completionSession.start)) {
            hideCompletionMenu(plugin);
            return;
        }
        const segment = text.slice(plugin.completionSession.start, cursorOffset);
        const sessionMatch = segment.match(SESSION_TRIGGER_PATTERN);
        if (!sessionMatch) {
            hideCompletionMenu(plugin);
            return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        showCompletionMenu(plugin, sessionMatch[1], rect);
        return;
    }

    const insertedText = e?.data || "";
    const lastChar = textBeforeCursor.slice(-1);
    const isInsertInput = typeof e?.inputType === "string" && e.inputType.startsWith("insert");
    const isTriggerInput = !e ? isTriggerChar(lastChar) : isInsertInput && (isTriggerChar(insertedText) || (isTriggerChar(lastChar) && (!insertedText || insertedText === lastChar)));

    if (!isTriggerInput) {
        if (plugin.completionVisible) hideCompletionMenu(plugin);
        return;
    }
    if (!isFirstLineOfQuote(quoteEl, focusText)) {
        if (plugin.completionVisible) hideCompletionMenu(plugin);
        return;
    }
    const match = textBeforeCursor.match(TRIGGER_PATTERN);
    if (match) {
        const triggerStart = textBeforeCursor.lastIndexOf(match[0]);
        const lineEl = getQuoteContentLineElement(quoteEl, focusText);
        if (!isTriggerAtLogicalLineStart(lineEl, focusText, triggerStart)) {
            if (plugin.completionVisible) hideCompletionMenu(plugin);
            return;
        }
        plugin.completionSession.active = true;
        plugin.completionSession.quote = quoteEl;
        plugin.completionSession.start = triggerStart;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        showCompletionMenu(plugin, match[1], rect);
    } else {
        if (plugin.completionVisible) hideCompletionMenu(plugin);
    }
}

export function handleCompletionCompositionStart(plugin: any) {
    plugin.isComposing = true;
}

export function handleCompletionCompositionEnd(plugin: any) {
    plugin.isComposing = false;
    setTimeout(() => handleCompletionInput(plugin, undefined as any), 10);
}

export function handleCompletionKeydown(plugin: any, e: KeyboardEvent) {
    if (!plugin.completionVisible || !plugin.completionMenuElement) return;
    if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        plugin.completionIndex = (plugin.completionIndex - 1 + plugin.completionFiltered.length) % plugin.completionFiltered.length;
        renderCompletionMenu(plugin);
    } else if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        plugin.completionIndex = (plugin.completionIndex + 1) % plugin.completionFiltered.length;
        renderCompletionMenu(plugin);
    } else if (e.key === "Home") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        plugin.completionIndex = 0;
        renderCompletionMenu(plugin);
    } else if (e.key === "End") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        plugin.completionIndex = plugin.completionFiltered.length - 1;
        renderCompletionMenu(plugin);
    } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        applyCompletion(plugin);
    } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        hideCompletionMenu(plugin);
    }
}

export function handleCompletionMousedown(plugin: any, e: MouseEvent) {
    if (plugin.completionMenuElement && !plugin.completionMenuElement.contains(e.target as Node)) {
        hideCompletionMenu(plugin);
    }
}

export function handleSelectionChange(plugin: any) {
    if (!plugin.completionSession.active) return;
    const sel = window.getSelection();
    const focusNode = sel?.focusNode || null;
    const quote = focusNode ? getBlockquoteElement(focusNode) : null;
    if (!sel || !sel.rangeCount || !quote || quote !== plugin.completionSession.quote) {
        hideCompletionMenu(plugin);
    }
}
