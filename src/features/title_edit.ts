/**
 * Title editing logic for callout blocks.
 *
 * This module contains both title text normalization helpers and the title
 * interaction handlers used by `index.ts`.
 */
import { showMessage, IOperation } from "siyuan";
import { closestTitleFromTarget, focusNewBlockEditableStart, placeCaretAtEnd } from "../utils/dom";
import { cleanCalloutOuterHTML, ensureEmptyBodyPlaceholderForCallout, createEmptyParagraphElement, getCalloutBodyContainer } from "../utils/callout";
import { normalizeCalloutTitleText } from "../utils/text";
import { createTransaction, getCurrentProtyle, getNewNodeId, getSiyuanLute, getFirstBlockInnerHTMLFromMd, PluginWithGetEditor } from "../core/api";
import { isPublishService } from "../core/cl_api";
import { debugLog, warnLog, errorLog } from "../utils/logger";
import { t } from "../utils/i18n";
import { isCalloutLogicallyFolded } from "./callout_fold";

export type TitleEditPluginLike = PluginWithGetEditor & {
    titleEditSnapshots: WeakMap<HTMLElement, string>;
    calloutHtmlSnapshots: WeakMap<HTMLElement, string>;
    titleEditDebounceTimers: Map<HTMLElement, ReturnType<typeof setTimeout>>;
    titleEditComposing: Set<HTMLElement>;
    titleEnterInFlight: Set<string>;
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type") => Promise<boolean>;
    isUndoRedoShortcut: (e: KeyboardEvent) => boolean;
};

export function ensureCalloutTitleEditable(titleEl: HTMLElement | null) {
    if (!titleEl) return;
    if (isPublishService()) {
        titleEl.contentEditable = "false";
        titleEl.removeAttribute("contenteditable");
        return;
    }
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

function isToolbarRelatedShortcut(e: KeyboardEvent) {
    const key = (e.key || "").toLowerCase();
    if (key === "process" || e.isComposing) return false;

    // Keep browser/system editing shortcuts and plugin-specific Enter handling available.
    if (["a", "c", "v", "x", "z", "y", "s"].indexOf(key) !== -1) return false;
    if (e.key === "Enter") return false;

    const withModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (!withModifier) return false;

    // SiYuan handles Protyle toolbar actions from protyle.options.toolbar hotkeys.
    // Defaults include Ctrl/Cmd+B/I/U/K/M/T/G/H/J/'/\\ and Alt+D, Alt+X, etc.; users may customize them.
    // In callout titles these actions only create temporary rich DOM and may show the floating toolbar,
    // so block all modified non-navigation keystrokes while the title is focused.
    return true;
}

export function hideProtyleToolbarForTitle(target?: EventTarget | null, plugin?: TitleEditPluginLike) {
    const titleEl = closestTitleFromTarget(target || document.activeElement);
    if (!titleEl) return false;

    const block = titleEl.closest(".callout") as HTMLElement | null;
    const protyle = getCurrentProtyle(plugin || null, block, titleEl) as any;
    const toolbarElement = protyle?.toolbar?.element as HTMLElement | undefined;
    if (toolbarElement) {
        toolbarElement.classList.add("fn__none");
    }

    document.querySelectorAll(".protyle-toolbar:not(.fn__none)").forEach((item) => {
        (item as HTMLElement).classList.add("fn__none");
    });

    return true;
}

export function selectCalloutTitleText(e: KeyboardEvent) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return false;
    const key = (e.key || "").toLowerCase();
    if (key !== "a" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.isComposing) return false;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
}

export function preventTitleToolbarShortcut(e: KeyboardEvent, plugin?: TitleEditPluginLike) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return false;
    if (!isToolbarRelatedShortcut(e)) return false;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    requestAnimationFrame(() => hideProtyleToolbarForTitle(titleEl, plugin));
    return true;
}

export function preventTitleToolbarRender(e: Event, plugin?: TitleEditPluginLike) {
    const titleEl = closestTitleFromTarget(e.target || document.activeElement);
    if (!titleEl) return false;

    hideProtyleToolbarForTitle(titleEl, plugin);
    requestAnimationFrame(() => hideProtyleToolbarForTitle(titleEl, plugin));
    setTimeout(() => hideProtyleToolbarForTitle(titleEl, plugin), 0);

    if (e.type === "keyup") {
        e.stopPropagation();
        e.stopImmediatePropagation();
    }

    return true;
}

export function handleTitleFocusIn(plugin: TitleEditPluginLike, e: FocusEvent) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    if (isPublishService()) return;
    ensureCalloutTitleEditable(titleEl);
    const block = titleEl.closest(".callout") as HTMLElement | null;
    const protyle = getCurrentProtyle(plugin, block, titleEl);
    plugin.titleEditSnapshots.set(titleEl, normalizeCalloutTitlePlainText(titleEl, protyle));
    if (block) plugin.calloutHtmlSnapshots.set(block, cleanCalloutOuterHTML(block));
    titleEl.classList.add("is-title-editing");
}

export function handleTitleFocusOut(plugin: TitleEditPluginLike, e: FocusEvent) {
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

    const originalHtml = plugin.calloutHtmlSnapshots.get(block) || cleanCalloutOuterHTML(block);
    plugin.titleEditSnapshots.delete(titleEl);
    plugin.calloutHtmlSnapshots.delete(block);
    plugin.titleEditComposing.delete(titleEl);

    if (!titleChanged) return;
    requestAnimationFrame(() => plugin.syncBlock(block, originalHtml, "title"));
}

export function handleTitleInput(plugin: TitleEditPluginLike, e: Event) {
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
        const originalHtml = plugin.calloutHtmlSnapshots.get(block) || cleanCalloutOuterHTML(block);

        if (currentTitle !== previousTitle) {
            plugin.titleEditSnapshots.set(titleEl, currentTitle);
            cleanCalloutTitleEditable(titleEl, protyle);
            ensureEmptyBodyPlaceholderForCallout(block, getNewNodeId);
            plugin.calloutHtmlSnapshots.set(block, cleanCalloutOuterHTML(block));
            debugLog("[TitleInput] Auto-saving title change via debounce");
            plugin.syncBlock(block, originalHtml, "title");
        }
    }, 100);

    plugin.titleEditDebounceTimers.set(titleEl, newTimer);
}

export function handleTitleCompositionStart(plugin: TitleEditPluginLike, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    plugin.titleEditComposing.add(titleEl);
}

export function handleTitleCompositionEnd(plugin: TitleEditPluginLike, e: Event) {
    const titleEl = closestTitleFromTarget(e.target);
    if (!titleEl) return;
    plugin.titleEditComposing.delete(titleEl);
    handleTitleInput(plugin, e);
}

export function handleTitleKeydown(plugin: TitleEditPluginLike, e: KeyboardEvent) {
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
            showMessage(t("titleEnterNoEditor"));
            return;
        }

        try {
            plugin.titleEnterInFlight.add(blockId);
            const isFolded = isCalloutLogicallyFolded(block);
            const newBlockId = getNewNodeId();
            if (!newBlockId) {
                showMessage(t("titleEnterInvalidBlockId"));
                return;
            }
            const newBlock = createEmptyParagraphElement(getNewNodeId, newBlockId);
            const transactionHTML = newBlock.outerHTML;
            let doOperations: IOperation[];

            if (isFolded) {
                debugLog("[TitleEnter] Creating new sibling block after folded callout", blockId);
                block.insertAdjacentElement("afterend", newBlock);
                focusNewBlockEditableStart(newBlock);
                doOperations = [{
                    action: "insert",
                    id: newBlockId,
                    parentID: block.parentElement?.closest?.("[data-node-id]")?.getAttribute("data-node-id") || (protyle as any).block?.parentID || (protyle as any).block?.rootID || "",
                    previousID: blockId,
                    data: transactionHTML,
                }];
            } else {
                debugLog("[TitleEnter] Creating new first child block in callout", blockId);
                const content = getCalloutBodyContainer(block);
                const firstBodyBlock = Array.from(content.children).find((child) => {
                    const el = child as HTMLElement;
                    return !el.classList.contains("protyle-attr") && !el.classList.contains("callout-title") && !el.classList.contains("callout-info");
                }) as HTMLElement | undefined;
                if (firstBodyBlock) firstBodyBlock.insertAdjacentElement("beforebegin", newBlock);
                else content.insertAdjacentElement("afterbegin", newBlock);

                focusNewBlockEditableStart(newBlock);
                doOperations = [{ action: "insert", id: newBlockId, parentID: blockId, previousID: "", data: transactionHTML }];
            }

            const undoOperations: IOperation[] = [{ action: "delete", id: newBlockId }];
            const ok = createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                warnLog("[WARN] Transaction API unavailable during title enter insert", { blockId, newBlockId });
                newBlock.remove();
                errorLog("[ERROR] TitleEnter transaction failed for block", blockId, "- new block:", newBlockId);
                showMessage(t("titleEnterTransactionFailed"));
                return;
            }
        } catch (err) {
            errorLog("[ERROR] TitleEnter exception for block", blockId, ":", err);
        } finally {
            plugin.titleEnterInFlight.delete(blockId);
        }
    })();
}

export function guardTitleEvents(plugin: TitleEditPluginLike, e: Event) {
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
