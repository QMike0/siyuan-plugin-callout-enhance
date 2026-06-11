import { CalloutTypeItem, getCalloutPreviewTitle, renderCalloutIconSpan } from "./callout_types";

export type RenderCalloutMenuItemOptions = {
    focused: boolean;
    /** Type menu: mark the callout block's current subtype (SiYuan iconSelect). */
    selected?: boolean;
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
    const { focused, selected = false, onActivate, activateEvent = "click" } = options;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.tabIndex = -1;
    btn.className = `b3-list-item b3-list-item--two ${focused ? "b3-list-item--focus" : ""}`;

    const first = document.createElement("div");
    first.className = "b3-list-item__first";

    const iconEl = renderCalloutIconSpan(item.icon || item.label, "b3-list-item__graphic callout-enhance-menu-icon", item.label, {
        preferEditorIcon: true,
        subtype: item.label,
        size: "var(--callout-menu-item-icon-size)",
    });

    const text = document.createElement("span");
    text.className = "b3-list-item__text";
    text.textContent = getCalloutPreviewTitle(item);

    first.append(iconEl, text);
    if (selected) {
        const checked = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        checked.setAttribute("class", "callout-enhance-menu-checked");
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#iconSelect");
        checked.appendChild(use);
        first.appendChild(checked);
    }
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
