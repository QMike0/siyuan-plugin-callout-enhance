/**
 * Title editing logic for callout blocks.
 *
 * This module contains both title text normalization helpers and the title
 * interaction handlers used by `index.ts`.
 */
import { showMessage, IOperation } from "siyuan";
import { closestTitleFromTarget, focusNewBlockEditableStart, getCalloutFromEventTarget, getSelectionCallout, placeCaretAtEnd } from "../utils/dom";
import { ensureEmptyBodyPlaceholderForCallout, createEmptyParagraphElement, getCalloutBodyContainer, hasCalloutBody, getCalloutBodyLineCount } from "../utils/callout";
import { normalizeCalloutTitleText } from "../utils/text";
import { createTransaction, getCurrentProtyle, getNewNodeId, getSiyuanLute, getFirstBlockInnerHTMLFromMd } from "../core/api";

function debugLog(plugin: any, ...args: any[]) {
    if (plugin?.DEBUG) {
        console.log("[CalloutEnhance]", ...args);
    }
}

function warnLog(...args: any[]) {
    console.warn(...args);
}

function errorLog(...args: any[]) {
    console.error(...args);
}

export function ensureCalloutTitleEditable(titleEl: HTMLElement | null) {
    if (!titleEl) return;
    titleEl.contentEditable = "true";
    titleEl.spellcheck = false;
}

export function normalizeCalloutTitlePlainTextFromMarkdown(markdown: string, protyle?: any | null) {
    const lute = getSiyuanLute(protyle);
    let text = markdown;

    if (lute && typeof lute.Md2BlockDOM === "function") {
        try {
            const normalizedInlineHTML = getFirstBlockInnerHTMLFromMd(lute, normalizeCalloutTitleText(markdown));
            if (normalizedInlineHTML) {
                const template = document.createElement("template");
                template.innerHTML = normalizedInlineHTML;
                text = template.content.textContent || "";
            }
        } catch {
            // Fall back to plain-text normalization below.
        }
    }

    return normalizeCalloutTitleText(text);
}

export function normalizeCalloutTitlePlainText(titleEl: HTMLElement | null, protyle?: any | null) {
    if (!titleEl) return "";
    const lute = getSiyuanLute(protyle);
    let markdown = "";

    if (lute && typeof lute.BlockDOM2StdMd === "function") {
        try {
            markdown = lute.BlockDOM2StdMd(titleEl.innerHTML);
        } catch {
            markdown = titleEl.textContent || "";
        }
    } else {
        markdown = titleEl.textContent || "";
    }

    return normalizeCalloutTitlePlainTextFromMarkdown(markdown, protyle);
}

export function cleanCalloutTitleEditable(titleEl: HTMLElement | null, protyle?: any | null) {
    if (!titleEl) return false;
    const normalized = normalizeCalloutTitlePlainText(titleEl, protyle);
    const currentText = titleEl.textContent || "";
    const hasRichContent = Array.from(titleEl.childNodes).some((node) => node.nodeType !== Node.TEXT_NODE);
    if (normalized === currentText && !hasRichContent) return false;
    titleEl.textContent = normalized;
    placeCaretAtEnd(titleEl);
    return true;
}

export function handleTitleFocusIn(plugin: any, e: FocusEvent) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    ensureCalloutTitleEditable(titleEl);
    const block = titleEl.closest(".callout") as HTMLElement | null;
    const protyle = getCurrentProtyle(plugin, block, titleEl);
    plugin.titleEditSnapshots.set(titleEl, normalizeCalloutTitlePlainText(titleEl, protyle));
    if (block) plugin.calloutHtmlSnapshots.set(block, block.outerHTML);
    titleEl.classList.add("is-title-editing");
}

export function handleTitleFocusOut(plugin: any, e: FocusEvent) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    const block = titleEl.closest(".callout") as HTMLElement | null;
    titleEl.classList.remove("is-title-editing");
    if (!block || block.dataset.deleting === "true") return;

    const pendingTimer = plugin.titleEditDebounceTimers.get(titleEl);
    if (pendingTimer) {
        clearTimeout(pendingTimer);
        plugin.titleEditDebounceTimers.delete(titleEl);
    }

    const protyle = getCurrentProtyle(plugin, block, titleEl);
    const previousTitle = plugin.titleEditSnapshots.get(titleEl) ?? "";
    const currentTitle = normalizeCalloutTitlePlainText(titleEl, protyle);
    const titleChanged = currentTitle !== previousTitle;

    cleanCalloutTitleEditable(titleEl, protyle);
    ensureEmptyBodyPlaceholderForCallout(block, getNewNodeId);

    const originalHtml = plugin.calloutHtmlSnapshots.get(block) || block.outerHTML;
    plugin.titleEditSnapshots.delete(titleEl);
    plugin.calloutHtmlSnapshots.delete(block);
    plugin.titleEditComposing.delete(titleEl);

    if (!titleChanged) return;
    requestAnimationFrame(() => plugin.syncBlock(block, originalHtml));
}

export function handleTitleInput(plugin: any, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    if (plugin.titleEditComposing.has(titleEl)) return;

    const block = titleEl.closest(".callout") as HTMLElement | null;
    if (!block || block.dataset.deleting === "true") return;

    ensureEmptyBodyPlaceholderForCallout(block, getNewNodeId);

    const oldTimer = plugin.titleEditDebounceTimers.get(titleEl);
    if (oldTimer) clearTimeout(oldTimer);

    const newTimer = setTimeout(() => {
        plugin.titleEditDebounceTimers.delete(titleEl);
        const protyle = getCurrentProtyle(plugin, block, titleEl);
        const previousTitle = plugin.titleEditSnapshots.get(titleEl) ?? "";
        const currentTitle = normalizeCalloutTitlePlainText(titleEl, protyle);
        const originalHtml = plugin.calloutHtmlSnapshots.get(block) || block.outerHTML;

        if (currentTitle !== previousTitle) {
            plugin.titleEditSnapshots.set(titleEl, currentTitle);
            cleanCalloutTitleEditable(titleEl, protyle);
            ensureEmptyBodyPlaceholderForCallout(block, getNewNodeId);
            plugin.calloutHtmlSnapshots.set(block, block.outerHTML);
            debugLog(plugin, "[TitleInput] Auto-saving title change via debounce");
            plugin.syncBlock(block, originalHtml);
        }
    }, 100);

    plugin.titleEditDebounceTimers.set(titleEl, newTimer);
}

export function handleTitleCompositionStart(plugin: any, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    plugin.titleEditComposing.add(titleEl);
}

export function handleTitleCompositionEnd(plugin: any, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    plugin.titleEditComposing.delete(titleEl);
    handleTitleInput(plugin, e);
}

export function handleTitleKeydown(plugin: any, e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const block = (titleEl.closest('.callout[data-type="NodeCallout"]') || titleEl.closest(".callout")) as HTMLElement | null;
    if (!block) {
        errorLog("[ERROR] TitleEnter failed: Callout block not found from title element");
        return;
    }
    if (block.dataset.deleting === "true") return;

    (async () => {
        const blockId = block.dataset.nodeId || "";
        if (plugin.titleEnterInFlight.has(blockId)) return;
        const protyle = getCurrentProtyle(plugin, block, titleEl);
        if (!blockId || !protyle) {
            errorLog("[ERROR] TitleEnter failed: Missing blockId or protyle context");
            showMessage("标题回车失败：未找到编辑器上下文");
            return;
        }

        try {
            debugLog(plugin, "[TitleEnter] Creating new block after", blockId);
            plugin.titleEnterInFlight.add(blockId);
            if (block.getAttribute("fold") === "1") {
                await plugin.setFoldState(block, false);
            }

            const newBlockId = getNewNodeId();
            if (!newBlockId) {
                showMessage("标题回车失败：无法生成合法块 ID");
                return;
            }
            const newBlock = createEmptyParagraphElement(getNewNodeId, newBlockId);
            const content = getCalloutBodyContainer(block);
            const firstBodyBlock = Array.from(content.children).find((child) => {
                const el = child as HTMLElement;
                return !el.classList.contains("protyle-attr") && !el.classList.contains("callout-title") && !el.classList.contains("callout-info");
            }) as HTMLElement | undefined;
            if (firstBodyBlock) firstBodyBlock.insertAdjacentElement("beforebegin", newBlock);
            else content.insertAdjacentElement("afterbegin", newBlock);

            focusNewBlockEditableStart(newBlock);

            const transactionHTML = newBlock.outerHTML;
            const doOperations: IOperation[] = [{ action: "insert", id: newBlockId, parentID: blockId, previousID: "", data: transactionHTML }];
            const undoOperations: IOperation[] = [{ action: "delete", id: newBlockId }];
            const ok = createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                warnLog("[WARN] Transaction API unavailable during title enter insert", { blockId, newBlockId });
                newBlock.remove();
                errorLog("[ERROR] TitleEnter transaction failed for block", blockId, "- new block:", newBlockId);
                showMessage("无法调用思源事务接口，标题回车插入失败");
                return;
            }
        } catch (err) {
            errorLog("[ERROR] TitleEnter exception for block", blockId, ":", err);
        } finally {
            plugin.titleEnterInFlight.delete(blockId);
        }
    })();
}

export function guardTitleEvents(plugin: any, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    if (e.type === "keydown" && (e as KeyboardEvent).key === "Enter") return;
    if (e instanceof KeyboardEvent && plugin.isUndoRedoShortcut(e)) return;

    if (e.type === "beforeinput" || e.type === "paste") {
        const block = titleEl.closest(".callout") as HTMLElement | null;
        if (block && block.dataset.deleting !== "true") {
            const inputType = (e as InputEvent).inputType || "";
            if (e.type === "paste" || inputType.startsWith("insertFromPaste")) {
                ensureEmptyBodyPlaceholderForCallout(block, getNewNodeId);
                const plainText = e instanceof ClipboardEvent ? e.clipboardData?.getData("text/plain") || "" : (e as InputEvent).data || "";
                const protyle = getCurrentProtyle(plugin, block, titleEl);
                const normalized = normalizeCalloutTitleText(plainText);
                const titleText = normalizeCalloutTitlePlainTextFromMarkdown(normalized, protyle);
                if (titleText) {
                    e.preventDefault();
                    const selection = window.getSelection();
                    if (selection?.rangeCount) {
                        const range = selection.getRangeAt(0);
                        if (titleEl.contains(range.commonAncestorContainer)) {
                            range.deleteContents();
                            const textNode = document.createTextNode(titleText);
                            range.insertNode(textNode);
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }
                }
            }
        }
    }

    e.stopPropagation();
    e.stopImmediatePropagation();
}
