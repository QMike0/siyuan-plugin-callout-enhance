export function getParentBlockLikeSiyuan(element: Element) {
    if (element.parentElement?.classList.contains("callout-content")) {
        return element.parentElement.parentElement as HTMLElement | null;
    }
    return element.parentElement as HTMLElement | null;
}
