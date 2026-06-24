export function getParentBlockLikeSiyuan(element: Element) {
    if (element.parentElement?.classList.contains("callout-content")) {
        return element.parentElement.parentElement as HTMLElement | null;
    }
    return element.parentElement as HTMLElement | null;
}

export function hasClosestBlock(element: Node): HTMLElement | false {
    let current: Node | null = element;
    while (current) {
        if (current instanceof Element) {
            const dataType = current.getAttribute("data-type");
            if (current.getAttribute("data-node-id") && dataType?.startsWith("Node") && current.tagName !== "BUTTON") {
                return current as HTMLElement;
            }
        }
        current = current.parentNode;
    }
    return false;
}

export function getFirstBlock(element: Element): Element {
    let firstElement: Element | undefined;
    Array.from(element.querySelectorAll("[data-node-id]")).find((item) => {
        if (!item.classList.contains("li") && !item.classList.contains("sb")) {
            firstElement = item;
            return true;
        }
    });
    return firstElement || element;
}

export function getContenteditableElement(element: Element): Element | undefined {
    if (!element) {
        return element;
    }
    if (element.classList.contains("protyle-title__input")) {
        return element;
    }
    let blockElement: Element = element;
    if (!blockElement.getAttribute("data-node-id")) {
        blockElement = element.querySelector("[data-node-id]") as Element;
    }
    if (!blockElement) {
        const tempBlockElement = hasClosestBlock(element);
        if (tempBlockElement && element === getContenteditableElement(tempBlockElement)) {
            return element;
        }
        return undefined;
    }
    const type = blockElement.getAttribute("data-type");
    if (type === "NodeParagraph" || type === "NodeHeading") {
        return blockElement.firstElementChild as Element;
    }
    if (type === "NodeTable") {
        return blockElement.querySelector("table") as Element;
    }
    if (type === "NodeCodeBlock" && blockElement.classList.contains("code-block")) {
        return blockElement.querySelector(".hljs")?.lastElementChild as Element;
    }
    if (blockElement.getAttribute("data-node-id")) {
        const nested = blockElement.querySelector("[data-node-id]");
        return nested ? getContenteditableElement(nested) : undefined;
    }
    return undefined;
}

export function getSelectionOffset(selectElement: Node, editorElement?: Element, range?: Range) {
    const position = { end: 0, start: 0 };
    if (!range) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            return position;
        }
        range = sel.getRangeAt(0);
    }
    if (editorElement) {
        const container = range.commonAncestorContainer;
        if (!editorElement.isEqualNode(container) && !editorElement.contains(container)) {
            return position;
        }
    }
    const preSelectionRange = range.cloneRange();
    if (selectElement.childNodes[0]?.childNodes[0]) {
        preSelectionRange.setStart(selectElement.childNodes[0].childNodes[0], 0);
    } else {
        preSelectionRange.selectNodeContents(selectElement);
    }
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    position.start = preSelectionRange.toString().length + preSelectionRange.cloneContents().querySelectorAll("br").length;
    position.end = position.start + range.toString().length + range.cloneContents().querySelectorAll("br").length;
    return position;
}

export function getCalloutBodyFirstTopBlock(content: HTMLElement): HTMLElement | null {
    const block = Array.from(content.children).find((child) => {
        const el = child as HTMLElement;
        return !el.classList.contains("protyle-attr") &&
            !el.classList.contains("callout-title") &&
            !el.classList.contains("callout-info");
    }) as HTMLElement | undefined;
    return block || null;
}

export function shouldFocusCalloutTitleOnBodyArrowLeft(content: HTMLElement, range: Range): boolean {
    const firstTopBlock = getCalloutBodyFirstTopBlock(content);
    if (!firstTopBlock) {
        return false;
    }

    const firstBlock = getFirstBlock(firstTopBlock);
    const currentBlock = hasClosestBlock(range.startContainer);
    if (!currentBlock || currentBlock !== firstBlock) {
        return false;
    }

    const firstEditElement = getContenteditableElement(firstBlock);
    if (!firstEditElement) {
        return false;
    }

    return getSelectionOffset(firstEditElement, undefined, range).start === 0;
}
