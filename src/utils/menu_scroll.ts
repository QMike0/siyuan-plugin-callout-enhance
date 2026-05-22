/** Scroll a menu only when the item is outside the menu viewport. */
export function scrollMenuItemIntoViewIfNeeded(menu: HTMLElement, item: HTMLElement) {
    const menuRect = menu.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    if (itemRect.top < menuRect.top) {
        menu.scrollTop -= menuRect.top - itemRect.top;
    } else if (itemRect.bottom > menuRect.bottom) {
        menu.scrollTop += itemRect.bottom - menuRect.bottom;
    }
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
