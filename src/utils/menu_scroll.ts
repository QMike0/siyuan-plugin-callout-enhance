/** Inner scroll container; outer shell padding stays fixed while items scroll. */
export const CALLOUT_MENU_VIEWPORT_CLASS = "callout-enhance-callout-menu__viewport";

export function ensureCalloutMenuViewport(menu: HTMLElement): HTMLElement {
    let viewport = menu.querySelector<HTMLElement>(`.${CALLOUT_MENU_VIEWPORT_CLASS}`);
    if (!viewport) {
        viewport = document.createElement("div");
        viewport.className = CALLOUT_MENU_VIEWPORT_CLASS;
        while (menu.firstChild) {
            viewport.appendChild(menu.firstChild);
        }
        menu.appendChild(viewport);
    }
    return viewport;
}

export function getCalloutMenuScrollElement(menu: HTMLElement): HTMLElement {
    return menu.querySelector<HTMLElement>(`.${CALLOUT_MENU_VIEWPORT_CLASS}`) ?? menu;
}

/** Scroll the viewport only when the item is outside the visible area. */
export function scrollMenuItemIntoViewIfNeeded(menu: HTMLElement, item: HTMLElement) {
    const scrollEl = getCalloutMenuScrollElement(menu);
    const scrollRect = scrollEl.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const itemTop = itemRect.top - scrollRect.top + scrollEl.scrollTop;
    const itemBottom = itemTop + itemRect.height;

    const viewTop = scrollEl.scrollTop;
    const viewBottom = viewTop + scrollEl.clientHeight;

    if (itemTop < viewTop) {
        scrollEl.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
        scrollEl.scrollTop = itemBottom - scrollEl.clientHeight;
    }
}

export function resetMenuScroll(menu: HTMLElement) {
    getCalloutMenuScrollElement(menu).scrollTop = 0;
}

export function focusMenuListItem(menu: HTMLElement, index: number) {
    const scrollEl = getCalloutMenuScrollElement(menu);
    const items = scrollEl.querySelectorAll<HTMLButtonElement>(".b3-list-item");
    items.forEach((el) => el.classList.remove("b3-list-item--focus"));
    const active = items[index];
    if (!active) return null;
    active.classList.add("b3-list-item--focus");
    active.focus({ preventScroll: true });
    scrollMenuItemIntoViewIfNeeded(menu, active);
    return active;
}
