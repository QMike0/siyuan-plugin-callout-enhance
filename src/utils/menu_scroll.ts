/** Scroll a menu only when the item is outside the menu viewport. */
export function scrollMenuItemIntoViewIfNeeded(menu: HTMLElement, item: HTMLElement) {
    const menuRect = menu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const style = getComputedStyle(menu);
    const visibleTop = menuRect.top + (parseFloat(style.paddingTop) || 0);
    const visibleBottom = menuRect.bottom - (parseFloat(style.paddingBottom) || 0);

    if (itemRect.top < visibleTop) {
        menu.scrollTop -= visibleTop - itemRect.top;
    } else if (itemRect.bottom > visibleBottom) {
        menu.scrollTop += itemRect.bottom - visibleBottom;
    }
}

export function resetMenuScroll(menu: HTMLElement) {
    menu.scrollTop = 0;
}

export function focusMenuListItem(menu: HTMLElement, index: number) {
    const items = menu.querySelectorAll<HTMLButtonElement>(".b3-list-item");
    items.forEach((el) => el.classList.remove("b3-list-item--focus"));
    const active = items[index];
    if (!active) return null;
    active.classList.add("b3-list-item--focus");
    active.focus({ preventScroll: true });
    scrollMenuItemIntoViewIfNeeded(menu, active);
    return active;
}
