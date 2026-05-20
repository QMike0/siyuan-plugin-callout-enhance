import { confirm, Dialog, showMessage } from "siyuan";
import { CalloutEnhanceSettings, normalizeCalloutSettings } from "../utils/settings";
import { CalloutTypeItem, getEditorCalloutIconMask, renderCalloutIconSpan, resolveCalloutIconMask } from "../utils/callout_types";
import { openIconPicker } from "./icon_picker";
import { Plugin } from "siyuan";

export type SettingsEditorPluginLike = Plugin & {
    settings: CalloutEnhanceSettings;
    resolvedCalloutTypes: CalloutTypeItem[];
    setSettings: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
};

type DraftItem = CalloutTypeItem;
type DetailView = "list" | "edit";
type PreviewIconSource = "editor" | "draft";

type PreviewOptions = {
    interactive?: boolean;
    iconSource?: PreviewIconSource;
    className?: string;
    inheritEditorStyle?: boolean;
};

const PROTECTED_CALLOUT_KEYWORDS = new Set(["NOTE", "IMPORTANT", "TIP", "WARNING", "CAUTION"]);

const PREVIEW_STYLE_TOKENS = [
    "--callout-shell-padding-top",
    "--callout-shell-padding-right",
    "--callout-shell-padding-bottom",
    "--callout-shell-padding-left",
    "--callout-header-width-offset",
    "--callout-header-height",
    "--callout-header-y-adjust",
    "--callout-icon-size",
    "--callout-icon-left",
    "--callout-icon-title-gap",
    "--callout-fold-hit-width",
    "--callout-border-radius",
    "--callout-bg-mix",
    "--callout-text-mix",
];
const PREVIEW_BLOCK_STYLE_PROPS = [
    "font-size",
    "line-height",
    "letter-spacing",
    "font-family",
];
const PREVIEW_TITLE_STYLE_PROPS = [
    "font-size",
    "line-height",
    "font-weight",
    "letter-spacing",
];


function createIconButton(label: string, icon: string, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `b3-button callout-enhance-icon-button ${extraClass}`.trim();
    btn.type = "button";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.width = "28px";
    btn.style.height = "28px";
    btn.style.minWidth = "28px";
    btn.style.padding = "0";
    btn.style.border = "none";
    btn.style.background = "transparent";
    btn.style.boxShadow = "none";
    btn.innerHTML = icon;
    return btn;
}

function createSvgIcon(path: string) {
    return `<svg class="b3-menu__icon" style="width:14px;height:14px;margin:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function createSiyuanSymbolIcon(symbol: string) {
    return `<svg class="b3-menu__icon" style="width:14px;height:14px;margin:0;"><use href="#${symbol}"></use></svg>`;
}

const ICON_ADD = createSvgIcon(`<path d="M12 5v14"></path><path d="M5 12h14"></path>`);
const ICON_EDIT = createSiyuanSymbolIcon("iconEdit");
const ICON_DELETE = createSiyuanSymbolIcon("iconTrashcan");
const ICON_UNDO = createSiyuanSymbolIcon("iconUndo");
const ICON_BACK = createSvgIcon(`<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>`);

const LABEL_COLOR_VAR: Record<string, string> = {
    info: "--callout-color-info",
    note: "--callout-color-default",
    tip: "--callout-color-tip",
    quote: "--callout-color-quote",
    question: "--callout-color-question",
    important: "--callout-color-important",
    warning: "--callout-color-warning",
    caution: "--callout-color-caution",
};

const LABEL_ICON_VAR: Record<string, string> = {
    info: "--callout-icon-mask-info",
    note: "--callout-icon-mask-note",
    tip: "--callout-icon-mask-tip",
    quote: "--callout-icon-mask-quote",
    question: "--callout-icon-mask-question",
    important: "--callout-icon-mask-important",
    warning: "--callout-icon-mask-warning",
    caution: "--callout-icon-mask-caution",
};

let calloutCssVarProbe: HTMLElement | null = null;

function getCalloutCssVar(name: string) {
    if (!calloutCssVarProbe) {
        calloutCssVarProbe = document.createElement("div");
        calloutCssVarProbe.className = "callout";
        calloutCssVarProbe.dataset.type = "NodeCallout";
        calloutCssVarProbe.style.position = "absolute";
        calloutCssVarProbe.style.visibility = "hidden";
        calloutCssVarProbe.style.pointerEvents = "none";
        calloutCssVarProbe.style.left = "-99999px";
        calloutCssVarProbe.style.top = "-99999px";
        document.body.appendChild(calloutCssVarProbe);
    }
    return getComputedStyle(calloutCssVarProbe).getPropertyValue(name).trim();
}

function getDefaultColorForLabel(label: string) {
    const key = (label || "").trim().toLowerCase();
    const varName = LABEL_COLOR_VAR[key] || "--callout-color-default";
    return colorToHex(getCalloutCssVar(varName));
}

function getDefaultIconForLabel(label: string) {
    const key = (label || "").trim().toLowerCase();
    const varName = LABEL_ICON_VAR[key] || "--callout-icon-mask-default";
    return getCalloutCssVar(varName);
}

function createEditResetButton(onClick: () => void) {
    const btn = createIconButton("Reset to default", ICON_UNDO, "callout-enhance-edit-reset-btn");
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function isProtectedCalloutType(item: Pick<CalloutTypeItem, "keyword">) {
    return PROTECTED_CALLOUT_KEYWORDS.has((item.keyword || "").trim().toUpperCase());
}

function confirmDeleteCalloutType(item: DraftItem, onConfirm: () => void) {
    confirm(
        "Delete callout type",
        `Delete "${item.label || item.keyword}"? This action cannot be undone.`,
        onConfirm,
    );
}

function createTextInput(value: string) {
    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.value = value;
    return input;
}

function normalizeColorValue(value: string) {
    return colorToHex(value);
}

function colorToHex(value: string, fallback = "#00bfbc") {
    const trimmed = (value || "").trim();
    const hex = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (hex) return `#${hex[1]}`;
    const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
        const r = Number(rgb[1]);
        const g = Number(rgb[2]);
        const b = Number(rgb[3]);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    return fallback;
}

function createColorInput(value: string, keyword = "") {
    const wrapper = document.createElement("div");
    wrapper.className = "fn__flex callout-enhance-color-field";
    wrapper.style.gap = "8px";
    wrapper.style.alignItems = "center";

    const resolved = value?.trim()
        ? colorToHex(value)
        : colorToHex(getComputedCalloutColor(keyword));

    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "callout-enhance-color-picker";
    picker.value = resolved;

    const text = createTextInput(resolved);
    text.placeholder = "#RRGGBB";
    text.style.flex = "1";
    text.style.minWidth = "0";

    const syncFromPicker = () => {
        text.value = picker.value;
        text.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const syncFromText = () => {
        const normalized = colorToHex(text.value, picker.value);
        picker.value = normalized;
        if (text.value.trim() && text.value !== normalized) {
            text.value = normalized;
        }
    };

    picker.addEventListener("input", syncFromPicker);
    text.addEventListener("input", syncFromText);

    wrapper.append(picker, text);
    return { wrapper, picker, text };
}

function getComputedCalloutColor(keyword: string) {
    const subtype = (keyword || "").trim().toUpperCase();
    const probe = document.createElement("div");
    probe.className = "callout";
    probe.dataset.type = "NodeCallout";
    probe.dataset.subtype = subtype;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.left = "-99999px";
    probe.style.top = "-99999px";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    const color = computed.getPropertyValue("--local-color").trim() || computed.backgroundColor || "#00bfbc";
    probe.remove();
    return color;
}

function createCheckInput(checked: boolean) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    return input;
}

function createIconPickerButton(item: Pick<DraftItem, "icon" | "keyword">, preferEditorIcon = true) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "callout-enhance-icon-picker-btn";
    btn.title = "Choose icon";
    btn.setAttribute("aria-label", "Choose icon");
    btn.appendChild(renderCalloutIconSpan(
        item.icon || item.keyword,
        "callout-enhance-edit-dialog-icon",
        item.keyword,
        {
            preferEditorIcon: preferEditorIcon && !item.icon?.trim(),
            subtype: item.keyword,
            size: "var(--callout-enhance-edit-icon-size)",
        },
    ));
    return btn;
}

function updateIconPickerButton(btn: HTMLButtonElement, icon: string, keyword: string, preferEditorIcon = true) {
    btn.replaceChildren(renderCalloutIconSpan(
        icon || keyword,
        "callout-enhance-edit-dialog-icon",
        keyword,
        {
            preferEditorIcon: preferEditorIcon && !icon?.trim(),
            subtype: keyword,
            size: "var(--callout-enhance-edit-icon-size)",
        },
    ));
}

function createField(label: string, control: HTMLElement) {
    const wrapper = document.createElement("label");
    wrapper.className = "fn__flex-column";
    wrapper.style.gap = "4px";

    const title = document.createElement("div");
    title.className = "b3-label__text";
    title.style.fontSize = "12px";
    title.style.opacity = "0.8";
    title.textContent = label;

    wrapper.append(title, control);
    return wrapper;
}

function createEditRow(label: string, control: HTMLElement, stretchControl = true) {
    const row = document.createElement("div");
    row.className = "callout-enhance-edit-row";

    const labelEl = document.createElement("div");
    labelEl.className = "b3-label__text callout-enhance-edit-row__label";
    labelEl.textContent = label;

    if (stretchControl) {
        control.classList.add("callout-enhance-edit-row__control");
    }

    row.append(labelEl, control);
    return row;
}

function openEditDialog(item: DraftItem, onSave: (next: DraftItem) => void) {
    const dialog = new Dialog({
        title: `Edit ${item.label || item.keyword}`,
        width: window.innerWidth < 768 ? "92vw" : "560px",
        content: `<div class="callout-enhance-edit-body"></div>`,
    });

    const body = dialog.element.querySelector(".callout-enhance-edit-body") as HTMLElement | null;
    if (!body) return dialog;

    const settingsPanel = document.createElement("div");
    settingsPanel.className = "fn__flex-column";
    settingsPanel.style.gap = "12px";
    settingsPanel.style.padding = "2px 2px 0 2px";

    const labelInput = createTextInput(item.label);
    const keywordInput = createTextInput(item.keyword);
    const colorField = createColorInput(item.color, item.keyword);
    const colorInput = colorField.text;
    const colorPicker = colorField.picker;
    const iconValueInput = createTextInput(item.icon);

    const iconPreview = createIconPickerButton(item);
    iconValueInput.classList.add("fn__none");
    const iconControl = document.createElement("div");
    iconControl.className = "fn__flex callout-enhance-icon-field";
    iconControl.style.alignItems = "center";
    iconControl.style.gap = "8px";
    iconControl.append(iconPreview, iconValueInput);

    colorField.wrapper.append(createEditResetButton(() => {
        const hex = getDefaultColorForLabel(labelInput.value);
        colorPicker.value = hex;
        colorInput.value = hex;
        colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    }));

    iconControl.append(createEditResetButton(() => {
        iconValueInput.value = getDefaultIconForLabel(labelInput.value);
        iconValueInput.dispatchEvent(new Event("input", { bubbles: true }));
    }));

    settingsPanel.append(
        createEditRow("Label", labelInput),
        createEditRow("Keyword", keywordInput),
        createEditRow("Main color", colorField.wrapper),
        createEditRow("Icon", iconControl, false),
    );

    const previewPanel = document.createElement("div");
    previewPanel.className = "callout-enhance-edit-preview";

    const previewTitle = document.createElement("div");
    previewTitle.className = "b3-label__text";
    previewTitle.style.fontSize = "12px";
    previewTitle.style.opacity = "0.8";
    previewTitle.textContent = "Preview";

    const previewHost = document.createElement("div");
    previewHost.className = "callout-enhance-edit-preview__host";

    const updatePreview = () => {
        previewHost.innerHTML = "";
        const nextItem: DraftItem = {
            ...item,
            label: labelInput.value,
            keyword: keywordInput.value,
            icon: iconValueInput.value,
            color: colorInput.value,
        };
        const preview = createPreviewItem(nextItem, { iconSource: "draft" });
        previewHost.appendChild(preview);
        updateIconPickerButton(
            iconPreview,
            nextItem.icon || nextItem.keyword,
            nextItem.keyword,
            !nextItem.icon?.trim(),
        );
    };

    [labelInput, keywordInput, colorInput, iconValueInput].forEach((input) => input.addEventListener("input", updatePreview));
    iconPreview.addEventListener("click", (e) => {
        e.stopPropagation();
        openIconPicker({
            anchor: iconPreview,
            current: iconValueInput.value,
            fallbackKeyword: keywordInput.value,
            onPick: (value) => {
                iconValueInput.value = value;
                iconValueInput.dispatchEvent(new Event("input", { bubbles: true }));
            },
        });
    });

    previewPanel.append(previewTitle, previewHost);

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-edit-footer";

    const cancel = document.createElement("button");
    cancel.className = "b3-button b3-button--cancel";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.minWidth = "76px";
    cancel.addEventListener("click", () => dialog.destroy());

    const confirm = document.createElement("button");
    confirm.className = "b3-button b3-button--text";
    confirm.type = "button";
    confirm.textContent = "Confirm";
    confirm.style.minWidth = "76px";
    confirm.addEventListener("click", () => {
        onSave({
            ...item,
            label: labelInput.value,
            keyword: keywordInput.value,
            icon: iconValueInput.value,
            color: colorInput.value,
        });
        dialog.destroy();
        showMessage("Settings saved");
    });

    footer.append(cancel, confirm);
    body.append(settingsPanel, previewPanel, footer);
    updatePreview();
    return dialog;
}

function getPreviewIconMask(item: DraftItem, source: PreviewIconSource) {
    if (source === "draft" && item.icon?.trim()) {
        return resolveCalloutIconMask(item.icon, item.keyword);
    }
    return getEditorCalloutIconMask(item.keyword, item.icon);
}

function createEditorCalloutStyleProbe(item: DraftItem) {
    const host = document.createElement("div");
    host.className = "protyle-wysiwyg";
    host.style.position = "absolute";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";
    host.style.left = "-99999px";
    host.style.top = "-99999px";

    const probe = document.createElement("div");
    probe.className = "callout";
    probe.dataset.type = "NodeCallout";
    probe.dataset.nodeId = "callout-enhance-preview-probe";
    probe.dataset.subtype = (item.keyword || item.id || "default").trim().toUpperCase();
    probe.setAttribute("fold", "1");

    const info = document.createElement("div");
    info.className = "callout-info";
    const title = document.createElement("div");
    title.className = "callout-title";
    title.textContent = item.label || item.keyword;
    info.append(title);
    probe.append(info);

    host.appendChild(probe);
    document.body.appendChild(host);
    return { probe, cleanup: () => host.remove() };
}

function applyEditorCalloutStyleTokens(preview: HTMLElement, item: DraftItem) {
    const { probe, cleanup } = createEditorCalloutStyleProbe(item);
    try {
        const computed = getComputedStyle(probe);
        PREVIEW_STYLE_TOKENS.forEach((token) => {
            const value = computed.getPropertyValue(token).trim();
            if (value) preview.style.setProperty(token, value);
        });

        PREVIEW_BLOCK_STYLE_PROPS.forEach((prop) => {
            const value = computed.getPropertyValue(prop).trim();
            if (value) preview.style.setProperty(prop, value);
        });

        const previewTitle = preview.querySelector(".callout-title") as HTMLElement | null;
        const probeTitle = probe.querySelector(".callout-title") as HTMLElement | null;
        if (previewTitle && probeTitle) {
            const titleComputed = getComputedStyle(probeTitle);
            PREVIEW_TITLE_STYLE_PROPS.forEach((prop) => {
                const value = titleComputed.getPropertyValue(prop).trim();
                if (value) previewTitle.style.setProperty(prop, value);
            });
        }
    } finally {
        cleanup();
    }
}

function createPreviewItem(item: DraftItem, options: PreviewOptions = {}) {
    const host = document.createElement("div");
    host.className = [
        "protyle-wysiwyg",
        "callout-enhance-preview-host",
        options.interactive ? "callout-enhance-preview-host--interactive" : "",
    ].filter(Boolean).join(" ");

    const preview = document.createElement("div");
    preview.className = [
        "callout",
        "callout-enhance-setting-preview",
        options.className || "",
    ].filter(Boolean).join(" ");
    preview.dataset.type = "NodeCallout";
    preview.dataset.nodeId = `callout-enhance-preview-${item.id || item.keyword || "item"}`;
    preview.dataset.subtype = (item.keyword || item.id || "default").trim().toUpperCase();
    preview.setAttribute("fold", "1");

    if (item.color?.trim()) {
        preview.style.setProperty("--local-color", item.color.trim());
    }
    preview.style.setProperty(
        "--callout-enhance-preview-icon-mask",
        getPreviewIconMask(item, options.iconSource || "editor"),
    );

    const info = document.createElement("div");
    info.className = "callout-info";

    const title = document.createElement("div");
    title.className = "callout-title";
    title.textContent = item.label || item.keyword;

    info.append(title);
    preview.append(info);

    // Keep preview typography/layout in sync with actual editor callout.
    if (options.inheritEditorStyle !== false) {
        applyEditorCalloutStyleTokens(preview, item);
    }
    host.append(preview);
    return host;
}

export function openSettingsDialog(plugin: SettingsEditorPluginLike) {
    const dialog = new Dialog({
        title: "Callout Enhance Settings",
        width: window.innerWidth < 768 ? "92vw" : "980px",
        content: `
            <div class="fn__flex" style="gap:12px; min-height:60vh; padding:0 14px 0 10px; box-sizing:border-box;">
                <div class="callout-enhance-nav" style="width:220px; flex-shrink:0; border-right:1px solid var(--b3-border-color); padding-right:16px; overflow-y:auto; max-height:60vh; box-sizing:border-box;"></div>
                <div class="callout-enhance-detail" style="flex:1; overflow-y:auto; max-height:60vh; padding-left:12px; padding-right:10px; box-sizing:border-box;"></div>
            </div>
        `,
    });

    const nav = dialog.element.querySelector(".callout-enhance-nav") as HTMLElement | null;
    const detail = dialog.element.querySelector(".callout-enhance-detail") as HTMLElement | null;
    if (!nav || !detail) return dialog;

    let draft: DraftItem[] = normalizeCalloutSettings(plugin.settings).callouts.map((item) => ({ ...item }));
    let selectedIndex = 0;
    let mode: DetailView = "list";
    let draggingIndex = -1;
    let draggingKey = "";
    let dragChanged = false;
    let listSearchQuery = "";

    const getItemKey = (item: DraftItem) => item.id || item.keyword || item.label;

    const matchesListSearch = (item: DraftItem, query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (item.keyword || "").toLowerCase().includes(q)
            || (item.label || "").toLowerCase().includes(q);
    };

    const getFilteredDraftEntries = () => draft
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => matchesListSearch(item, listSearchQuery));

    const getListItemRects = () => {
        const rects = new Map<string, DOMRect>();
        detail.querySelectorAll<HTMLElement>(".callout-enhance-setting-item[data-key]").forEach((row) => {
            const key = row.dataset.key || "";
            if (key) rects.set(key, row.getBoundingClientRect());
        });
        return rects;
    };

    const animateListFrom = (previousRects: Map<string, DOMRect>) => {
        requestAnimationFrame(() => {
            detail.querySelectorAll<HTMLElement>(".callout-enhance-setting-item[data-key]").forEach((row) => {
                const key = row.dataset.key || "";
                const previous = previousRects.get(key);
                if (!previous) return;
                const next = row.getBoundingClientRect();
                const dx = previous.left - next.left;
                const dy = previous.top - next.top;
                if (!dx && !dy) return;
                row.style.transition = "none";
                row.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(() => {
                    row.style.transition = "transform 160ms cubic-bezier(.2, .8, .2, 1)";
                    row.style.transform = "";
                });
                row.addEventListener("transitionend", () => {
                    row.style.transition = "";
                    row.style.transform = "";
                }, { once: true });
            });
        });
    };

    const persist = async () => {
        const next = normalizeCalloutSettings({ schemaVersion: plugin.settings.schemaVersion, callouts: draft });
        await plugin.setSettings(next);
    };

    const renderNav = () => {
        nav.innerHTML = "";
        const section = document.createElement("div");
        section.className = `b3-list-item ${mode === "list" ? "b3-list-item--focus" : ""}`;
        section.style.cursor = "pointer";
        section.style.padding = "10px 12px";
        section.textContent = "Callout Types";
        section.addEventListener("click", () => {
            mode = "list";
            render();
        });
        nav.appendChild(section);
    };

    const moveItem = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= draft.length || to >= draft.length) return;
        const next = [...draft];
        const [picked] = next.splice(from, 1);
        next.splice(to, 0, picked);
        draft = next.map((item, index) => ({ ...item, order: index }));
        selectedIndex = to;
        render();
        void persist();
    };

    const moveItemDuringDrag = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= draft.length || to >= draft.length) return;
        const selectedKey = getItemKey(draft[selectedIndex]);
        const previousRects = getListItemRects();
        const next = [...draft];
        const [picked] = next.splice(from, 1);
        next.splice(to, 0, picked);
        draft = next.map((item, index) => ({ ...item, order: index }));
        draggingIndex = to;
        draggingKey = getItemKey(picked);
        dragChanged = true;
        selectedIndex = Math.max(0, draft.findIndex((item) => getItemKey(item) === selectedKey));
        render();
        animateListFrom(previousRects);
    };

    const finishDrag = () => {
        if (dragChanged) void persist();
        draggingIndex = -1;
        draggingKey = "";
        dragChanged = false;
        render();
    };

    const renderList = (itemsOnly = false) => {
        if (!itemsOnly) {
            detail.innerHTML = "";

            const topBar = document.createElement("div");
            topBar.className = "fn__flex callout-enhance-list-topbar";

            const topActions = document.createElement("div");
            topActions.className = "fn__flex callout-enhance-list-top-actions";

            const searchInput = createTextInput(listSearchQuery);
            searchInput.className = "b3-text-field callout-enhance-list-search";
            searchInput.placeholder = "Search keyword or label";
            searchInput.addEventListener("input", () => {
                listSearchQuery = searchInput.value;
                renderList(true);
            });

            const addBtn = createIconButton("Add", ICON_ADD);
            addBtn.addEventListener("click", () => {
                const newItem: DraftItem = {
                    id: `callout-${Date.now()}`,
                    keyword: "new",
                    label: "New Callout",
                    icon: "",
                    color: "",
                    enabled: true,
                    order: draft.length,
                };
                draft.push(newItem);
                selectedIndex = draft.length - 1;
                render();
                void persist();
                openEditDialog(draft[selectedIndex], (next) => {
                    draft[selectedIndex] = { ...next, order: selectedIndex };
                    render();
                    void persist();
                });
            });

            topActions.append(searchInput, addBtn);
            topBar.append(topActions);
            detail.appendChild(topBar);

            const listBody = document.createElement("div");
            listBody.className = "callout-enhance-list-body";
            detail.appendChild(listBody);
        }

        const listBody = detail.querySelector(".callout-enhance-list-body") as HTMLElement | null;
        if (!listBody) return;

        listBody.innerHTML = "";

        const filteredEntries = getFilteredDraftEntries();
        const searchActive = listSearchQuery.trim().length > 0;

        filteredEntries.forEach(({ item, index }) => {
            const row = document.createElement("div");
            row.className = "callout-enhance-setting-item";
            row.dataset.index = String(index);
            row.dataset.key = getItemKey(item);
            row.draggable = !searchActive;
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.gap = "var(--callout-enhance-setting-row-gap)";
            row.style.marginBottom = "var(--callout-enhance-setting-row-margin-bottom)";
            row.style.boxSizing = "border-box";

            const preview = createPreviewItem(item, { interactive: true, iconSource: "draft" });
            preview.addEventListener("click", () => {
                selectedIndex = index;
                render();
            });

            const actions = document.createElement("div");
            actions.className = "fn__flex callout-enhance-setting-actions";
            actions.style.alignItems = "center";
            actions.style.gap = "var(--callout-enhance-setting-action-gap)";
            actions.style.width = "auto";
            actions.style.minWidth = "0";
            actions.style.flexShrink = "0";
            actions.style.justifyContent = "flex-end";

            const enabled = createCheckInput(item.enabled);
            enabled.classList.add("callout-enhance-setting-enable");
            enabled.title = "Enabled";
            enabled.style.margin = "0";
            enabled.addEventListener("click", (e) => e.stopPropagation());
            enabled.addEventListener("change", () => {
                draft[index] = { ...draft[index], enabled: enabled.checked, order: index };
                selectedIndex = index;
                void persist();
            });

            const editBtn = createIconButton("Edit", ICON_EDIT, "callout-enhance-icon-button--edit");
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openEditDialog(draft[index], (next) => {
                    draft[index] = { ...next, order: index };
                    selectedIndex = index;
                    render();
                    void persist();
                });
            });

            const deleteBtn = createIconButton("Delete", ICON_DELETE, "callout-enhance-icon-button--delete");
            const protectedType = isProtectedCalloutType(item);
            deleteBtn.disabled = protectedType;
            if (protectedType) {
                deleteBtn.classList.add("callout-enhance-icon-button--disabled");
                deleteBtn.title = "Built-in SiYuan callout types cannot be deleted";
                deleteBtn.setAttribute("aria-label", "Built-in SiYuan callout types cannot be deleted");
            }
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (protectedType) return;
                confirmDeleteCalloutType(item, () => {
                    draft = draft.filter((_, i) => i !== index).map((x, i) => ({ ...x, order: i }));
                    selectedIndex = Math.max(0, Math.min(selectedIndex, draft.length - 1));
                    render();
                    void persist();
                });
            });

            const editDeleteGroup = document.createElement("div");
            editDeleteGroup.className = "fn__flex callout-enhance-setting-edit-delete";
            editDeleteGroup.style.alignItems = "center";
            editDeleteGroup.style.gap = "var(--callout-enhance-setting-edit-delete-gap)";
            editDeleteGroup.append(editBtn, deleteBtn);

            actions.append(editDeleteGroup, enabled);
            row.append(preview, actions);

            if (getItemKey(item) === draggingKey) {
                row.classList.add("callout-enhance-setting-item--dragging");
            }

            row.addEventListener("dragstart", (e) => {
                if (searchActive) {
                    e.preventDefault();
                    return;
                }
                draggingIndex = index;
                draggingKey = getItemKey(item);
                dragChanged = false;
                row.classList.add("callout-enhance-setting-item--dragging");
                e.dataTransfer?.setData("text/plain", draggingKey);
                if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
            });
            row.addEventListener("dragend", () => {
                if (draggingIndex >= 0 || draggingKey) finishDrag();
            });
            row.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                if (draggingIndex < 0) return;
                const rect = row.getBoundingClientRect();
                const afterMiddle = e.clientY > rect.top + rect.height / 2;
                let targetIndex = draggingIndex;
                if (draggingIndex < index && afterMiddle) {
                    targetIndex = index;
                } else if (draggingIndex > index && !afterMiddle) {
                    targetIndex = index;
                }
                if (targetIndex !== draggingIndex) {
                    moveItemDuringDrag(draggingIndex, targetIndex);
                }
            });
            row.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!dragChanged && draggingIndex >= 0) {
                    moveItem(draggingIndex, index);
                    draggingIndex = -1;
                    draggingKey = "";
                    dragChanged = false;
                    return;
                }
                if (draggingIndex >= 0 || draggingKey) finishDrag();
            });

            listBody.appendChild(row);
        });

        if (draft.length === 0) {
            const empty = document.createElement("div");
            empty.className = "b3-form__desc callout-enhance-list-empty";
            empty.textContent = "No callout types.";
            listBody.appendChild(empty);
        } else if (filteredEntries.length === 0) {
            const empty = document.createElement("div");
            empty.className = "b3-form__desc callout-enhance-list-empty";
            empty.textContent = "No matching callout types.";
            listBody.appendChild(empty);
        }
    };

    const renderDetail = () => {
        detail.innerHTML = "";
        const item = draft[selectedIndex];
        if (!item) {
            renderList();
            return;
        }

        const header = document.createElement("div");
        header.className = "fn__flex";
        header.style.alignItems = "center";
        header.style.justifyContent = "space-between";
        header.style.marginBottom = "12px";

        const left = document.createElement("div");
        left.className = "fn__flex";
        left.style.alignItems = "center";
        left.style.gap = "8px";
        left.innerHTML = `<span style="width:24px;text-align:center;font-size:18px;">${item.icon || "◻"}</span><strong>${item.label || item.keyword}</strong>`;

        const back = createIconButton("Back", ICON_BACK);
        back.addEventListener("click", () => {
            mode = "list";
            render();
        });

        header.append(left, back);

        const fields = document.createElement("div");
        fields.className = "fn__flex-column";
        fields.style.gap = "10px";

        const labelInput = createTextInput(item.label);
        const keywordInput = createTextInput(item.keyword);
        const colorField = createColorInput(item.color, item.keyword);
        const colorInput = colorField.text;
        const iconInput = createTextInput(item.icon);
        const iconControl = document.createElement("div");
        iconControl.className = "fn__flex";
        iconControl.style.alignItems = "center";
        iconControl.style.gap = "8px";
        const iconPreview = createIconPickerButton(item);
        iconInput.classList.add("fn__none");
        iconControl.append(iconPreview, iconInput);
        const enabledInput = createCheckInput(item.enabled);

        const update = () => {
            draft[selectedIndex] = {
                ...draft[selectedIndex],
                label: labelInput.value,
                keyword: keywordInput.value,
                icon: iconInput.value,
                color: colorInput.value,
                enabled: enabledInput.checked,
                order: selectedIndex,
            };
            void persist();
        };
        const updateIconPreview = () => {
            updateIconPickerButton(
                iconPreview,
                iconInput.value || keywordInput.value,
                keywordInput.value,
                !iconInput.value?.trim(),
            );
        };

        [labelInput, keywordInput, iconInput, colorInput].forEach((el) => el.addEventListener("input", update));
        [keywordInput, iconInput].forEach((el) => el.addEventListener("input", updateIconPreview));
        enabledInput.addEventListener("change", update);
        iconPreview.addEventListener("click", (e) => {
            e.stopPropagation();
            openIconPicker({
                anchor: iconPreview,
                current: iconInput.value,
                fallbackKeyword: keywordInput.value,
                onPick: (value) => {
                    iconInput.value = value;
                    iconInput.dispatchEvent(new Event("input", { bubbles: true }));
                },
            });
        });

        fields.append(
            createField("Label", labelInput),
            createField("Keyword", keywordInput),
            createField("Icon", iconControl),
            createField("Color", colorField.wrapper),
            createField("Enabled", enabledInput),
        );
        updateIconPreview();

        const actions = document.createElement("div");
        actions.className = "fn__flex";
        actions.style.gap = "8px";
        actions.style.marginTop = "12px";

        const deleteBtn = createIconButton("Delete", ICON_DELETE, "callout-enhance-icon-button--delete");
        const protectedType = isProtectedCalloutType(item);
        deleteBtn.disabled = protectedType;
        if (protectedType) {
            deleteBtn.classList.add("callout-enhance-icon-button--disabled");
            deleteBtn.title = "Built-in SiYuan callout types cannot be deleted";
            deleteBtn.setAttribute("aria-label", "Built-in SiYuan callout types cannot be deleted");
        }
        deleteBtn.addEventListener("click", () => {
            if (protectedType) return;
            confirmDeleteCalloutType(item, () => {
                draft = draft.filter((_, i) => i !== selectedIndex).map((x, i) => ({ ...x, order: i }));
                selectedIndex = Math.max(0, Math.min(selectedIndex, draft.length - 1));
                mode = "list";
                render();
                void persist();
            });
        });

        const editBtn = createIconButton("Open editor", ICON_EDIT, "callout-enhance-icon-button--edit");
        editBtn.addEventListener("click", () => {
            openEditDialog(item, (next) => {
                draft[selectedIndex] = { ...next, order: selectedIndex };
                render();
                void persist();
            });
        });

        actions.append(editBtn, deleteBtn);
        detail.append(header, fields, actions);
    };

    const render = () => {
        renderNav();
        if (mode === "list") renderList();
        else renderDetail();
    };

    render();

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action";

    const cancel = createIconButton("Cancel", "Cancel");
    cancel.className = "b3-button b3-button--cancel";
    cancel.textContent = "Cancel";
    cancel.style.width = "auto";
    cancel.style.padding = "0 12px";
    cancel.addEventListener("click", () => dialog.destroy());

    const save = createIconButton("Save", "Save");
    save.className = "b3-button b3-button--text";
    save.textContent = "Save";
    save.style.width = "auto";
    save.style.padding = "0 12px";
    save.addEventListener("click", async () => {
        try {
            await persist();
            dialog.destroy();
            showMessage("Settings saved");
        } catch {
            showMessage("Settings save failed");
        }
    });

    footer.append(cancel, save);
    dialog.element.appendChild(footer);
    return dialog;
}
