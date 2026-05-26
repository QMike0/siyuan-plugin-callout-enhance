import { CalloutTypeItem, getCalloutPreviewTitle, renderCalloutIconSpan } from "./callout_types";

export type RenderCalloutMenuItemOptions = {
    focused: boolean;
    /**
     * "mousedown" — completion menu: preventDefault keeps editor focus before apply.
     * "click" (default) — type menu.
     */
    activateEvent?: "click" | "mousedown";
    onActivate: (event: MouseEvent) => void;
};

/**
 * Build one callout menu row (icon + title) shared by type menu and completion menu.
 */
export function renderCalloutMenuItem(item: CalloutTypeItem, options: RenderCalloutMenuItemOptions): HTMLButtonElement {
    const { focused, onActivate, activateEvent = "click" } = options;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.tabIndex = -1;
    btn.className = `b3-list-item b3-list-item--two ${focused ? "b3-list-item--focus" : ""}`;

    const first = document.createElement("div");
    first.className = "b3-list-item__first";
    first.style.display = "flex";
    first.style.alignItems = "center";
    first.style.gap = "4px";

    const iconEl = renderCalloutIconSpan(item.icon || item.label, "b3-list-item__graphic callout-enhance-menu-icon", item.label, {
        preferEditorIcon: true,
        subtype: item.label,
        size: "var(--callout-enhance-menu-icon-size)",
    });
    iconEl.style.display = "inline-flex";
    iconEl.style.alignItems = "center";
    iconEl.style.justifyContent = "center";

    const text = document.createElement("span");
    text.className = "b3-list-item__text";
    text.style.fontSize = "15px";
    text.textContent = getCalloutPreviewTitle(item);

    first.append(iconEl, text);
    btn.appendChild(first);

    const handleActivate = (e: MouseEvent) => {
        if (activateEvent === "mousedown") {
            e.preventDefault();
        }
        e.stopPropagation();
        onActivate(e);
    };

    if (activateEvent === "mousedown") {
        btn.onmousedown = handleActivate;
    } else {
        btn.onclick = handleActivate;
    }

    return btn;
}
