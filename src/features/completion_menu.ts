/**
 * Completion menu logic for callout blocks.
 *
 * This module contains the completion trigger detection, menu rendering,
 * keyboard navigation, and completion transform handling for quote blocks.
 */
import { showMessage } from "siyuan";
import { getBlockquoteElement } from "../utils/dom";
import { PluginWithGetEditor } from "../core/api";
import { CalloutTypeItem, calloutMatchesFilter } from "../utils/callout_types";
import { renderCalloutMenuItem } from "../utils/menu_render";
import { focusMenuListItem, resetMenuScroll } from "../utils/menu_scroll";
import { errorLog } from "../utils/logger";

interface CompletionTypeProvider {
    getCalloutTypes?: () => CalloutTypeItem[];
}

export type CompletionSession = {
    active: boolean;
    quote: HTMLElement | null;
    start: number;
};

export type CompletionMenuPluginLike = PluginWithGetEditor & CompletionTypeProvider & {
    isComposing: boolean;
    completionMenuElement: HTMLDivElement | null;
    completionFiltered: CalloutTypeItem[];
    completionIndex: number;
    completionVisible: boolean;
    completionSession: CompletionSession;
};

/** Filter text after `[` while completion is open: unicode letters/digits plus common label chars. */
const COMPLETION_FILTER_CHARS = "\\p{L}\\p{N}_-";
const TRIGGER_PATTERN = new RegExp(`[\\[【［]([${COMPLETION_FILTER_CHARS}]*)$`, "u");
const SESSION_TRIGGER_PATTERN = new RegExp(`^[\\[【［]([${COMPLETION_FILTER_CHARS}]*)$`, "u");

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
        errorLog("[ERROR] Completion transform failed:", err);
        return false;
    }
}

export function ensureCompletionMenu(plugin: CompletionMenuPluginLike) {
    if (plugin.completionMenuElement) return;
    plugin.completionMenuElement = document.createElement("div");
    plugin.completionMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none callout-enhance-callout-menu";
    document.body.appendChild(plugin.completionMenuElement);
}

export function hideCompletionMenu(plugin: CompletionMenuPluginLike) {
    plugin.completionVisible = false;
    plugin.completionIndex = -1;
    plugin.completionSession.active = false;
    plugin.completionSession.quote = null;
    plugin.completionSession.start = -1;
    if (plugin.completionMenuElement) {
        plugin.completionMenuElement.style.visibility = "";
        plugin.completionMenuElement.classList.add("fn__none");
    }
}

function renderCompletionMenu(plugin: CompletionMenuPluginLike, resetScroll = false) {
    if (!plugin.completionMenuElement) return;
    plugin.completionMenuElement.innerHTML = "";
    plugin.completionFiltered.forEach((item, i) => {
        const btn = renderCalloutMenuItem(item, {
            focused: i === plugin.completionIndex,
            activateEvent: "mousedown",
            onActivate: () => {
                applyCompletion(plugin, i);
            },
        });
        plugin.completionMenuElement!.appendChild(btn);
    });
    if (plugin.completionIndex === -1) plugin.completionIndex = 0;
    if (resetScroll) resetMenuScroll(plugin.completionMenuElement);
}

function focusCompletionMenuItem(plugin: CompletionMenuPluginLike, index: number) {
    if (!plugin.completionMenuElement || plugin.completionFiltered.length === 0) return;
    const normalizedIndex = (index + plugin.completionFiltered.length) % plugin.completionFiltered.length;
    plugin.completionIndex = normalizedIndex;
    const items = plugin.completionMenuElement.querySelectorAll(".b3-list-item");
    if (items.length !== plugin.completionFiltered.length) {
        renderCompletionMenu(plugin);
    }
    focusMenuListItem(plugin.completionMenuElement, normalizedIndex);
}

function updateCompletionMenuPosition(plugin: CompletionMenuPluginLike, rect: DOMRect) {
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

export function showCompletionMenu(plugin: CompletionMenuPluginLike, filterText: string, rect: DOMRect) {
    ensureCompletionMenu(plugin);
    if (!plugin.completionMenuElement) return;
    const types = plugin.getCalloutTypes?.() ?? [];
    plugin.completionFiltered = types.filter((t) => calloutMatchesFilter(t, filterText));
    if (plugin.completionFiltered.length === 0) {
        hideCompletionMenu(plugin);
        return;
    }
    plugin.completionVisible = true;
    plugin.completionIndex = 0;
    renderCompletionMenu(plugin, true);
    plugin.completionMenuElement.style.visibility = "hidden";
    plugin.completionMenuElement.classList.remove("fn__none");
    updateCompletionMenuPosition(plugin, rect);
    focusCompletionMenuItem(plugin, plugin.completionIndex);
    plugin.completionMenuElement.style.visibility = "";
}

export function applyCompletion(plugin: CompletionMenuPluginLike, index = plugin.completionIndex) {
    const selected = plugin.completionFiltered[index];
    if (!selected) return;
    hideCompletionMenu(plugin);
    const ok = applyCompletionTransform(selected.label);
    if (!ok) showMessage("callout completion transform failed");
}

function isFirstLineOfQuote(quoteEl: HTMLElement | null, sourceNode: Node | null): boolean {
    if (!quoteEl || !sourceNode) return false;
    const line = getQuoteContentLineElement(quoteEl, sourceNode);
    if (!line) return false;
    const firstLine = Array.from(quoteEl.children).find((child) => !((child as HTMLElement).classList?.contains("protyle-attr"))) as HTMLElement | undefined;
    return !!firstLine && line === firstLine;
}

export function handleCompletionInput(plugin: CompletionMenuPluginLike, e: InputEvent) {
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

export function handleCompletionCompositionStart(plugin: CompletionMenuPluginLike) {
    plugin.isComposing = true;
}

export function handleCompletionCompositionEnd(plugin: CompletionMenuPluginLike) {
    plugin.isComposing = false;
    setTimeout(() => handleCompletionInput(plugin, undefined as any), 10);
}

export function handleCompletionKeydown(plugin: CompletionMenuPluginLike, e: KeyboardEvent) {
    if (!plugin.completionVisible || !plugin.completionMenuElement) return;
    if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        focusCompletionMenuItem(plugin, plugin.completionIndex - 1);
    } else if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        focusCompletionMenuItem(plugin, plugin.completionIndex + 1);
    } else if (e.key === "Home") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        focusCompletionMenuItem(plugin, 0);
    } else if (e.key === "End") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        focusCompletionMenuItem(plugin, plugin.completionFiltered.length - 1);
    } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        applyCompletion(plugin);
    } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        hideCompletionMenu(plugin);
    }
}

export function handleCompletionMousedown(plugin: CompletionMenuPluginLike, e: MouseEvent) {
    if (plugin.completionMenuElement && !plugin.completionMenuElement.contains(e.target as Node)) {
        hideCompletionMenu(plugin);
    }
}

export function handleSelectionChange(plugin: CompletionMenuPluginLike) {
    if (!plugin.completionSession.active) return;
    const sel = window.getSelection();
    const focusNode = sel?.focusNode || null;
    const quote = focusNode ? getBlockquoteElement(focusNode) : null;
    if (!sel || !sel.rangeCount || !quote || quote !== plugin.completionSession.quote) {
        hideCompletionMenu(plugin);
    }
}
