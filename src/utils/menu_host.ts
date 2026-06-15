/**
 * Attach callout menus to the active protyle container (like SiYuan's slash hint).
 *
 * SiYuan's `protyle.hint.element` is appended to `protyle.element` (see initUI.ts).
 * Block-ref float windows stay open while the pointer is over in-protyle UI; menus on
 * `document.body` are outside `.block__popover` and trigger `hidePopover` on mouseover.
 */

function nodeToElement(node: Node | null | undefined): HTMLElement | null {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement;
    return node.parentElement;
}

export function resolveCalloutMenuHost(source?: Node | HTMLElement | null): HTMLElement {
    if (typeof document === "undefined") {
        return document.body;
    }

    const candidates: Array<Node | HTMLElement | null | undefined> = [
        source,
        document.getSelection()?.focusNode ?? null,
    ];

    for (const candidate of candidates) {
        const element = nodeToElement(candidate as Node | null);
        const protyle = element?.closest?.(".protyle") as HTMLElement | null;
        if (protyle) return protyle;
    }

    return document.body;
}

/** Re-parent the menu under the protyle that owns the current editor context. */
export function attachCalloutMenuToHost(menu: HTMLElement, source?: Node | HTMLElement | null) {
    const host = resolveCalloutMenuHost(source);
    if (menu.parentElement !== host) {
        host.appendChild(menu);
    }
}
