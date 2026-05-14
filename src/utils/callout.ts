/**
 * Callout structure helpers.
 *
 * This module contains utilities for creating placeholder paragraph blocks,
 * checking whether a callout body has meaningful content, and ensuring
 * a minimal editable body exists when needed.
 */
import { focusNewBlockEditableStart } from "./dom";

export function createEmptyParagraphElement(getNewNodeId: () => string, id?: string) {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", id || getNewNodeId());
    element.setAttribute("data-type", "NodeParagraph");
    element.classList.add("p");
    const spellcheck = (window as any)?.siyuan?.config?.editor?.spellcheck ? "true" : "false";
    element.innerHTML = `<div contenteditable="true" spellcheck="${spellcheck}"></div><div class="protyle-attr" contenteditable="false">${"\u200B"}</div>`;
    return element;
}

export function createEmptyParagraphAndFocus(getNewNodeId: () => string, id?: string) {
    const block = createEmptyParagraphElement(getNewNodeId, id);
    focusNewBlockEditableStart(block);
    return block;
}

export function hasCalloutBody(block: HTMLElement | null) {
    function isMeaningfulNode(node: Node): boolean {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent || "").replace(/[\u200B\u00A0]/g, "").trim().length > 0;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node as HTMLElement;
        const tagName = el.tagName?.toUpperCase?.() || "";
        if (tagName === "BR") return false;
        if (el.classList?.contains("protyle-attr")) return false;
        if (el.matches?.("img,video,audio,iframe,svg,canvas,table,hr,math,pre,code,input,button,select,textarea,embed,object")) {
            return true;
        }
        return Array.from(el.childNodes).some(isMeaningfulNode);
    }

    if (!block) return false;
    return Array.from(block.children).some((child) => {
        if ((child as HTMLElement).classList?.contains("callout-title")) return false;
        if ((child as HTMLElement).classList?.contains("callout-info")) return false;
        if ((child as HTMLElement).classList?.contains("protyle-attr")) return false;
        return isMeaningfulNode(child);
    });
}

export function getCalloutBodyLineCount(block: HTMLElement | null) {
    if (!block) return 0;
    const content = (block.querySelector?.(".callout-content") as HTMLElement | null) || block;
    return Array.from(content.children).filter((child) => {
        if ((child as HTMLElement).classList?.contains("protyle-attr")) return false;
        return true;
    }).length;
}

export function getCalloutBodyContainer(block: HTMLElement) {
    return (block.querySelector?.(".callout-content") as HTMLElement | null) || block;
}

export function ensureEmptyBodyPlaceholderForCallout(block: HTMLElement, getNewNodeId: () => string) {
    if (!block.classList.contains("callout")) return;
    const content = getCalloutBodyContainer(block);
    if (!content) return;

    const bodyChildren = Array.from(content.children).filter((child) => {
        const el = child as HTMLElement;
        return !el.classList.contains("protyle-attr") &&
            !el.classList.contains("callout-title") &&
            !el.classList.contains("callout-info");
    }) as HTMLElement[];

    if (bodyChildren.length > 0) return;

    const newBodyBlock = createEmptyParagraphElement(getNewNodeId);
    content.insertAdjacentElement("afterbegin", newBodyBlock);
}
