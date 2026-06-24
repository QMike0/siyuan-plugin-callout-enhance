/**
 * DOM utilities used by callout interactions.
 *
 * This module provides caret/selection helpers and element resolution helpers
 * for title/callout/blockquote related event targets.
 */
export function focusNewBlockEditableStart(newBlock: HTMLElement) {
    const editable = newBlock.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!editable) return;
    editable.focus();
    const range = document.createRange();
    range.setStart(editable, 0);
    range.collapse(true);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

export function placeCaretAtEnd(el: HTMLElement | null) {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

export function cloneEditorRange(): Range | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    return sel.getRangeAt(0).cloneRange();
}

/** Restore editor caret without moving DOM focus away from contenteditable (SiYuan focusByRange). */
export function restoreEditorRange(range: Range | null) {
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
}

export function closestTitleFromTarget(target: EventTarget | null) {
    if (!target) return null;
    const source = target instanceof Node && target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
    const element = source instanceof Element ? source : null;
    return element?.closest?.(".callout-title") as HTMLElement | null;
}

export function getCalloutFromEventTarget(target: EventTarget | null) {
    if (!target) return null;
    const source = target instanceof Node && target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
    const element = source instanceof Element ? source : null;
    return element?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
}

export function getSelectionCallout() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const node = sel.focusNode || sel.anchorNode;
    const source = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const element = source instanceof Element ? source : null;
    return element?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
}

export function getBlockquoteElement(node: Node | null) {
    if (!node) return null;
    let current: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
    while (current && current !== document.body) {
        if (current.classList && current.classList.contains("bq")) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}
