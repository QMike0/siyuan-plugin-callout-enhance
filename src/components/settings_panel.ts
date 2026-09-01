import { Dialog, showMessage } from "siyuan";
import {
    CalloutEnhanceSettings,
    CalloutAppearancePreset,
    DEFAULT_APPEARANCE_PRESET_ID,
    DEFAULT_APPEARANCE_PRESET_NAME,
    getDefaultAppearancePresetLayout,
    isDefaultAppearancePreset,
    makeAppearancePresetId,
    normalizeCalloutSettings,
} from "../utils/settings";
import {
    calloutTypesStateFromSettings,
    createCalloutTypeDraft,
    deleteCalloutTypeAtIndex,
    finalizeCalloutTypeSave,
    getCalloutTypeKey,
    normalizeCalloutTypesSlice,
    reclaimTombstoneLabel,
    reorderCalloutTypes,
    setCalloutTypeEnabled,
    updateCalloutTypeAtIndex,
} from "../utils/callout_type_crud";
import { formatLabelOccupancyError, validateLabelOccupancy } from "../utils/callout_resolver";
import { applyPreviewCalloutInlineStyle, BUILTIN_LABEL_COLOR_VAR } from "../utils/callout_dynamic_styles";
import { CalloutTypeItem, calloutMatchesListSearch, formatCalloutKeywordsForInput, getCalloutPreviewTitle, getEditorCalloutIconMask, getEditorCalloutIconPaint, isProtectedCalloutType, normalizeCalloutLabel, parseCalloutKeywordsInput, renderCalloutIconSpan, resolveCalloutIconMask } from "../utils/callout_types";
import { CALLOUT_LAYOUT_CSS_VARS, CALLOUT_TITLE_COMPUTED_PROPS, CalloutLayoutSettings, areCalloutLayoutsEqual, normalizeCalloutLayout } from "../utils/callout_layout_vars";
import { openIconPicker } from "./icon_picker";
import { isCalloutLogicallyFolded, setPreviewFoldState } from "../features/callout_fold";
import { getCalloutHeaderHitAreas, isFoldButtonHit } from "../utils/callout_header_hit";
import { renderLayoutSettingsPanel } from "./layout_settings_panel";
import { renderAboutSettingsPanel } from "./about_settings_panel";
import {
    createHelpIcon,
    createPreviewHelpIcon,
    decoratePluginDialog,
    formatCleanupForceClearMessage,
    formatDeleteCalloutTypeMessage,
    formatTombstoneReclaimConfirmMessage,
    openCleanupProgressDialog,
    openCleanupStartConfirmDialog,
    openConfirmDialog,
    openSnapshotFailedContinueDialog,
    type CleanupStartMode,
    type CleanupProgressDialogHandle,
} from "./settings_ui";
import { dialogWidth, isMobileUi } from "../utils/env";
import { ClApiError, CLEANUP_SNAPSHOT_PROGRESS_END, createRepoSnapshot, type CalloutBlockCountResult } from "../core/cl_api";
import type { CleanupProgress, CleanupResult } from "../utils/migration";
import { Plugin } from "siyuan";
import { t } from "../utils/i18n";

export type SettingsEditorPluginLike = Plugin & {
    settings: CalloutEnhanceSettings;
    resolvedCalloutTypes: CalloutTypeItem[];
    setSettings: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
    previewCalloutLayout: (layout: Partial<CalloutLayoutSettings>) => void;
    clearAppearancePreview: () => void;
    reloadAppearanceFromDisk: () => Promise<void>;
    restoreAppearanceState: (settings: Pick<CalloutEnhanceSettings, "layout" | "appearancePresets" | "activeAppearancePresetId">) => void;
    countCalloutsForTypeItem?: (item: Pick<CalloutTypeItem, "label" | "pastLabels">) => Promise<CalloutBlockCountResult>;
    isWorkspaceReadOnly?: () => boolean;
    isEditorReadOnly?: () => boolean;
    abortCalloutCleanup?: () => void;
    runCalloutCleanup?: (options: {
        signal?: AbortSignal;
        abortController?: AbortController;
        onProgress: (progress: CleanupProgress) => void;
        getSettings?: () => CalloutEnhanceSettings;
        saveSettings?: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
        forceClearMetadata?: boolean;
        progressOffset?: number;
        migrateEndPercent?: number;
    }) => Promise<CleanupResult>;
    clearLegacyCalloutMetadata?: (options?: {
        getSettings?: () => CalloutEnhanceSettings;
        saveSettings?: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
    }) => Promise<void>;
};

type DraftItem = CalloutTypeItem;
type DetailView = "list" | "layout" | "about";
type PreviewIconSource = "editor" | "draft";

type PreviewOptions = {
    interactive?: boolean;
    iconSource?: PreviewIconSource;
    className?: string;
    inheritEditorStyle?: boolean;
    /** Appearance 面板：展开态预览（含正文，不可交互） */
    expanded?: boolean;
    /** Appearance 面板：可折叠/展开预览（仅折叠交互） */
    foldable?: boolean;
    bodyText?: string;
    initialFolded?: boolean;
};

const PREVIEW_STYLE_TOKENS = [...CALLOUT_LAYOUT_CSS_VARS];
const PREVIEW_BLOCK_STYLE_PROPS = [
    "font-size",
    "line-height",
    "letter-spacing",
    "font-family",
];
const PREVIEW_TITLE_STYLE_PROPS = [...CALLOUT_TITLE_COMPUTED_PROPS];

type AppearanceCloseConfirmMode = "update" | "save-new";

type AppearanceCloseConfirmOptions = {
    mode: AppearanceCloseConfirmMode;
    presetName: string;
    onSave: (newPresetName?: string) => void | Promise<void | boolean>;
    onDiscard: () => void | Promise<void>;
    onCancel: () => void;
};

function openAppearanceUnsavedConfirm(options: AppearanceCloseConfirmOptions) {
    const { mode, presetName, onSave, onDiscard, onCancel } = options;
    const isSaveNew = mode === "save-new";

    let resolved = false;
    const finish = (action: "save" | "discard" | "cancel", newPresetName?: string) => {
        if (resolved) return;
        resolved = true;
        if (action === "save") {
            void Promise.resolve(onSave(newPresetName)).then((result) => {
                if (result === false) {
                    resolved = false;
                    return;
                }
                confirmDialog.destroy();
            });
            return;
        }
        if (action === "discard") {
            void Promise.resolve(onDiscard()).then(() => confirmDialog.destroy());
            return;
        }
        onCancel();
        confirmDialog.destroy();
    };

    const confirmDialog = new Dialog({
        title: isSaveNew ? t("saveNewPreset") : t("unsavedAppearanceChanges"),
        width: dialogWidth("420px", "88vw"),
        content: `<div class="callout-enhance-appearance-close-body"></div>`,
        destroyCallback: () => {
            if (!resolved) {
                resolved = true;
                onCancel();
            }
        },
    });
    decoratePluginDialog(confirmDialog);

    const body = confirmDialog.element.querySelector(".callout-enhance-appearance-close-body") as HTMLElement | null;
    if (!body) return confirmDialog;

    const message = document.createElement("div");
    message.className = "b3-label__text callout-enhance-appearance-close-body__message";
    if (isSaveNew) {
        message.textContent = t("enterPresetName");
    } else {
        message.textContent = t("saveAppearanceTo", { name: presetName });
    }

    let nameInput: HTMLInputElement | null = null;
    if (isSaveNew) {
        nameInput = document.createElement("input");
        nameInput.className = "b3-text-field fn__block callout-enhance-appearance-close-body__input";
        nameInput.type = "text";
        nameInput.placeholder = t("configurationNamePlaceholder");
        nameInput.maxLength = 64;
    }

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-appearance-close-body__actions callout-enhance-dialog-footer";

    const saveBtn = document.createElement("button");
    saveBtn.className = "b3-button b3-button--text";
    saveBtn.type = "button";
    saveBtn.textContent = t("save");
    saveBtn.disabled = isSaveNew;
    saveBtn.addEventListener("click", () => {
        if (isSaveNew) {
            const name = nameInput?.value.trim() || "";
            if (!name) return;
            finish("save", name);
            return;
        }
        finish("save");
    });

    const discardBtn = document.createElement("button");
    discardBtn.className = "b3-button b3-button--outline";
    discardBtn.type = "button";
    discardBtn.textContent = t("dontSave");
    discardBtn.addEventListener("click", () => finish("discard"));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "b3-button b3-button--cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = t("cancel");
    cancelBtn.addEventListener("click", () => finish("cancel"));

    footer.append(saveBtn, discardBtn, cancelBtn);

    if (nameInput) {
        nameInput.addEventListener("input", () => {
            saveBtn.disabled = !nameInput?.value.trim();
        });
        nameInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && nameInput?.value.trim()) {
                event.preventDefault();
                finish("save", nameInput.value.trim());
            }
        });
        body.append(message, nameInput, footer);
        nameInput.focus();
    } else {
        body.append(message, footer);
    }

    return confirmDialog;
}

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

function getDefaultColorForCalloutLabel(label: string) {
    const key = (label || "").trim().toLowerCase();
    const varName = BUILTIN_LABEL_COLOR_VAR[key] || "--callout-color-default";
    return colorToHex(getCalloutCssVar(varName));
}

function getDefaultIconForCalloutLabel(label: string) {
    return resolveCalloutIconMask(label, label);
}

function getNewCalloutDefaultColor() {
    return colorToHex(getCalloutCssVar("--callout-color-default"));
}

function isKeywordsInputEmpty(input: HTMLInputElement) {
    return readKeywordsInput(input).length === 0;
}

function syncLabelToKeywordsIfEmpty(labelInput: HTMLInputElement, keywordsInput: HTMLInputElement) {
    const label = labelInput.value.trim();
    if (!label || !isKeywordsInputEmpty(keywordsInput)) return;
    keywordsInput.value = label;
    keywordsInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncKeywordsToLabelIfEmpty(labelInput: HTMLInputElement, keywordsInput: HTMLInputElement) {
    if (labelInput.value.trim()) return;
    const keywords = readKeywordsInput(keywordsInput);
    if (!keywords.length) return;
    labelInput.value = keywords[0];
    labelInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyCrossFieldFill(labelInput: HTMLInputElement, keywordsInput: HTMLInputElement) {
    syncLabelToKeywordsIfEmpty(labelInput, keywordsInput);
    syncKeywordsToLabelIfEmpty(labelInput, keywordsInput);
}

function createLabelEditControl(input: HTMLInputElement) {
    const wrapper = document.createElement("div");
    wrapper.className = "callout-enhance-edit-row__field";

    const errorEl = document.createElement("div");
    errorEl.className = "callout-enhance-edit-row__error fn__none";
    errorEl.setAttribute("role", "alert");

    wrapper.append(input, errorEl);

    return {
        wrapper,
        showError: (message: string) => {
            errorEl.textContent = message;
            errorEl.classList.remove("fn__none");
            input.classList.add("callout-enhance-edit-row__input--error");
        },
        clearError: () => {
            errorEl.textContent = "";
            errorEl.classList.add("fn__none");
            input.classList.remove("callout-enhance-edit-row__input--error");
        },
    };
}

function createEditResetButton(onClick: () => void) {
    const btn = createIconButton(t("resetToDefault"), ICON_UNDO, "callout-enhance-edit-reset-btn");
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function createPastLabelsField(labels: string[]) {
    const wrapper = document.createElement("div");
    wrapper.className = "callout-enhance-past-labels";
    if (!labels.length) {
        const empty = document.createElement("div");
        empty.className = "callout-enhance-past-labels__empty b3-label__text";
        empty.textContent = "—";
        wrapper.append(empty);
        return wrapper;
    }
    for (const label of labels) {
        const token = document.createElement("span");
        token.className = "callout-enhance-past-labels__token";
        token.textContent = label;
        wrapper.append(token);
    }
    return wrapper;
}

async function confirmDeleteCalloutType(
    item: DraftItem,
    plugin: SettingsEditorPluginLike,
    onConfirm: () => void,
) {
    const countResult = await plugin.countCalloutsForTypeItem?.(item) ?? { ok: true as const, count: 0 };
    openConfirmDialog({
        title: t("deleteCalloutType"),
        message: formatDeleteCalloutTypeMessage({
            title: getCalloutPreviewTitle(item),
            countKnown: countResult.ok,
            count: countResult.ok ? countResult.count : 0,
        }),
        confirmLabel: t("delete"),
        onConfirm: () => {
            onConfirm();
        },
    });
}

function createTextInput(value: string) {
    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.value = value;
    return input;
}

function createKeywordsInput(keywords: string[]) {
    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.value = formatCalloutKeywordsForInput(keywords);
    input.placeholder = t("keywordsPlaceholder");
    return input;
}

function readKeywordsInput(input: HTMLInputElement) {
    return parseCalloutKeywordsInput(input.value);
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

function createColorInput(value: string, label = "") {
    const wrapper = document.createElement("div");
    wrapper.className = "fn__flex callout-enhance-color-field";
    wrapper.style.gap = "8px";
    wrapper.style.alignItems = "center";

    const resolved = value?.trim()
        ? colorToHex(value)
        : colorToHex(getComputedCalloutColor(label));

    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "callout-enhance-color-picker";
    picker.value = resolved;

    const text = createTextInput(resolved);
    text.placeholder = t("colorPlaceholder");
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

function getComputedCalloutColor(label: string) {
    const subtype = (label || "").trim().toUpperCase();
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

function createIconPickerButton(item: Pick<DraftItem, "icon" | "label">, preferEditorIcon = true) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "callout-enhance-icon-picker-btn";
    btn.title = t("iconPickerTitle");
    btn.setAttribute("aria-label", t("iconPickerTitle"));
    btn.appendChild(renderCalloutIconSpan(
        item.icon || item.label,
        "callout-enhance-edit-dialog-icon",
        item.label,
        {
            preferEditorIcon: preferEditorIcon && !item.icon?.trim(),
            subtype: item.label,
            size: "var(--callout-enhance-edit-icon-size)",
        },
    ));
    return btn;
}

function updateIconPickerButton(btn: HTMLButtonElement, icon: string, label: string, preferEditorIcon = true) {
    btn.replaceChildren(renderCalloutIconSpan(
        icon || label,
        "callout-enhance-edit-dialog-icon",
        label,
        {
            preferEditorIcon: preferEditorIcon && !icon?.trim(),
            subtype: label,
            size: "var(--callout-enhance-edit-icon-size)",
        },
    ));
}

function createEditRow(label: string, control: HTMLElement, stretchControl = true, helpTooltip = "") {
    const row = document.createElement("div");
    row.className = "callout-enhance-edit-row";

    const labelCol = document.createElement("div");
    labelCol.className = "callout-enhance-edit-row__label-col";

    const labelHeader = document.createElement("div");
    labelHeader.className = "callout-enhance-edit-row__label-header";

    const labelEl = document.createElement("div");
    labelEl.className = "b3-label__text callout-enhance-edit-row__label";
    labelEl.textContent = label;
    labelHeader.append(labelEl);

    if (helpTooltip) {
        labelHeader.append(createHelpIcon(helpTooltip));
    }

    labelCol.append(labelHeader);

    if (stretchControl) {
        control.classList.add("callout-enhance-edit-row__control");
    }

    row.append(labelCol, control);
    return row;
}

type EditDialogSettingsContext = {
    getTombstone: () => string[];
    setTombstone: (next: string[]) => void;
    countCalloutsForTypeItem?: SettingsEditorPluginLike["countCalloutsForTypeItem"];
};

type EditDialogOptions = {
    isNew?: boolean;
    onDiscardNew?: () => void;
    existingCallouts?: DraftItem[];
    settingsContext?: EditDialogSettingsContext;
};

function openEditDialog(item: DraftItem, onSave: (next: DraftItem) => void, options: EditDialogOptions = {}) {
    let committed = false;
    const dialogTitle = options.isNew || !item.label.trim()
        ? t("newCalloutType")
        : t("editCalloutType", { title: getCalloutPreviewTitle(item) });
    const dialog = new Dialog({
        title: dialogTitle,
        width: dialogWidth("560px"),
        content: `<div class="callout-enhance-edit-body"></div>`,
        destroyCallback: () => {
            if (committed) return;
            if (options.isNew) options.onDiscardNew?.();
        },
    });
    decoratePluginDialog(dialog);

    const body = dialog.element.querySelector(".callout-enhance-edit-body") as HTMLElement | null;
    if (!body) return dialog;

    const settingsPanel = document.createElement("div");
    settingsPanel.className = "fn__flex-column callout-enhance-edit-settings";
    settingsPanel.style.gap = "12px";
    settingsPanel.style.padding = "2px 2px 0 2px";

    const labelLocked = !options.isNew && isProtectedCalloutType(item);
    const labelInput = createTextInput(item.label);
    labelInput.placeholder = t("labelPlaceholder");
    if (labelLocked) {
        labelInput.title = t("labelProtectedTitle");
    }
    if (labelLocked) {
        labelInput.readOnly = true;
        labelInput.classList.add("callout-enhance-edit-row__input--protected");
    }
    const labelField = createLabelEditControl(labelInput);
    const keywordsInput = createKeywordsInput(item.keywords);
    const colorField = createColorInput(item.color, item.label);
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
        const hex = getDefaultColorForCalloutLabel(labelInput.value);
        colorPicker.value = hex;
        colorInput.value = hex;
        colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    }));

    iconControl.append(createEditResetButton(() => {
        iconValueInput.value = getDefaultIconForCalloutLabel(labelInput.value);
        iconValueInput.dispatchEvent(new Event("input", { bubbles: true }));
    }));

    settingsPanel.append(
        createEditRow(t("label"), labelField.wrapper, true, t("helpLabel")),
        createEditRow(t("keywords"), keywordsInput, true, t("helpKeywords")),
    );
    if (!isProtectedCalloutType(item)) {
        settingsPanel.append(
            createEditRow(
                t("pastLabel"),
                createPastLabelsField(item.pastLabels || []),
                true,
                t("helpPastLabel"),
            ),
        );
    }
    settingsPanel.append(
        createEditRow(t("mainColor"), colorField.wrapper),
        createEditRow(t("icon"), iconControl, false),
    );

    const previewPanel = document.createElement("div");
    previewPanel.className = "callout-enhance-edit-preview";

    const previewLabelRow = document.createElement("div");
    previewLabelRow.className = "fn__flex callout-enhance-preview-label-row callout-enhance-edit-preview__label-row";
    const previewTitle = document.createElement("div");
    previewTitle.className = "b3-label__text";
    previewTitle.textContent = t("preview");
    previewLabelRow.append(previewTitle, createPreviewHelpIcon());

    const previewHint = document.createElement("div");
    previewHint.className = "callout-enhance-edit-preview-hint b3-label__text";
    previewHint.textContent = t("previewHint");

    const previewHost = document.createElement("div");
    previewHost.className = "callout-enhance-edit-preview__host";

    const readPreviewFolded = () => {
        const current = previewHost.querySelector('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        return current?.getAttribute("fold") === "1";
    };

    const updatePreview = () => {
        const folded = readPreviewFolded();
        previewHost.innerHTML = "";
        const nextItem: DraftItem = {
            ...item,
            label: labelInput.value,
            keywords: readKeywordsInput(keywordsInput),
            icon: iconValueInput.value,
            color: colorInput.value,
        };
        const preview = createPreviewItem(nextItem, {
            iconSource: "draft",
            foldable: true,
            bodyText: t("previewBodyHello"),
            initialFolded: folded,
        });
        previewHost.appendChild(preview);
        const labelVal = labelInput.value.trim();
        const iconVal = iconValueInput.value.trim();
        const previewIcon = iconVal || (labelVal || getDefaultIconForCalloutLabel(""));
        updateIconPickerButton(
            iconPreview,
            previewIcon,
            labelVal,
            !iconVal,
        );
    };

    if (!labelLocked) {
        labelInput.addEventListener("blur", () => syncLabelToKeywordsIfEmpty(labelInput, keywordsInput));
        labelInput.addEventListener("input", () => labelField.clearError());
    }
    keywordsInput.addEventListener("blur", () => syncKeywordsToLabelIfEmpty(labelInput, keywordsInput));
    [labelInput, keywordsInput, colorInput, iconValueInput].forEach((input) => input.addEventListener("input", updatePreview));
    iconPreview.addEventListener("click", (e) => {
        e.stopPropagation();
        openIconPicker({
            anchor: iconPreview,
            current: iconValueInput.value,
            fallbackLabel: labelInput.value,
            onPick: (value) => {
                iconValueInput.value = value;
                iconValueInput.dispatchEvent(new Event("input", { bubbles: true }));
            },
        });
    });

    previewPanel.append(previewLabelRow, previewHint, previewHost);

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-edit-footer";

    const cancel = document.createElement("button");
    cancel.className = "b3-button b3-button--cancel";
    cancel.type = "button";
    cancel.textContent = t("cancel");
    cancel.addEventListener("click", () => {
        committed = true;
        if (options.isNew) options.onDiscardNew?.();
        dialog.destroy();
    });

    const confirm = document.createElement("button");
    confirm.className = "b3-button b3-button--text";
    confirm.type = "button";
    confirm.textContent = t("confirm");
    const buildOccupancySettings = (tombstone: string[]): Partial<CalloutEnhanceSettings> => ({
        callouts: options.existingCallouts ?? [],
        calloutTombstone: tombstone,
    });

    const commitSave = (tombstone?: string[]) => {
        if (tombstone !== undefined) {
            options.settingsContext?.setTombstone(tombstone);
        }
        committed = true;
        onSave(finalizeCalloutTypeSave(
            item,
            {
                keywords: readKeywordsInput(keywordsInput),
                icon: iconValueInput.value,
                color: colorInput.value,
            },
            savedLabelForCommit(),
            labelLocked,
        ));
        dialog.destroy();
        showMessage(t("settingsSaved"));
    };

    const savedLabelForCommit = () => (labelLocked ? item.label : labelInput.value);

    const promptTombstoneReclaim = async (savedLabel: string) => {
        const reclaimedLabel = normalizeCalloutLabel(savedLabel);
        const countResult = await options.settingsContext?.countCalloutsForTypeItem?.({
            label: reclaimedLabel,
            pastLabels: [],
        }) ?? { ok: true as const, count: 0 };
        const newTypeTitle = getCalloutPreviewTitle({
            ...item,
            label: reclaimedLabel,
        });
        openConfirmDialog({
            title: t("reclaimDeletedLabel"),
            message: formatTombstoneReclaimConfirmMessage({
                reclaimedLabel,
                newTypeTitle,
                countKnown: countResult.ok,
                count: countResult.ok ? countResult.count : 0,
            }),
            confirmLabel: t("saveAndApplyStyle"),
            cancelLabel: t("backToEdit"),
            width: dialogWidth("440px"),
            onConfirm: () => {
                const currentTombstone = options.settingsContext?.getTombstone() ?? [];
                commitSave(reclaimTombstoneLabel(currentTombstone, reclaimedLabel));
            },
        });
    };

    confirm.addEventListener("click", () => {
        const savedLabel = savedLabelForCommit();
        if (!labelLocked) {
            applyCrossFieldFill(labelInput, keywordsInput);
        }
        if (!savedLabel.trim()) {
            labelField.showError(t("labelRequiredError"));
            if (!labelLocked) labelInput.focus();
            return;
        }
        if (!labelLocked) {
            const tombstone = options.settingsContext?.getTombstone() ?? [];
            const conflict = validateLabelOccupancy(
                savedLabel,
                item.id,
                buildOccupancySettings(tombstone),
            );
            if (conflict) {
                if (conflict.source === "tombstone") {
                    void promptTombstoneReclaim(savedLabel);
                    return;
                }
                labelField.showError(formatLabelOccupancyError(conflict, savedLabel));
                labelInput.focus();
                labelInput.select();
                return;
            }
        }
        labelField.clearError();
        commitSave();
    });

    footer.append(confirm, cancel);
    body.append(settingsPanel, previewPanel, footer);
    updatePreview();
    return dialog;
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
    probe.dataset.subtype = (item.label || item.id || "default").trim().toUpperCase();
    probe.setAttribute("fold", "1");

    const info = document.createElement("div");
    info.className = "callout-info";
    const title = document.createElement("div");
    title.className = "callout-title";
    title.textContent = getCalloutPreviewTitle(item);
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
        const normalizeCssToken = (value: string) => value.replace(/\s+/g, " ").trim();
        const probeSurfaceBackground = normalizeCssToken(computed.getPropertyValue("--callout-surface-background"));
        const probeHeaderBackground = normalizeCssToken(computed.getPropertyValue("--callout-header-background"));
        const probeBodyBackground = normalizeCssToken(computed.getPropertyValue("--callout-body-background"));
        PREVIEW_STYLE_TOKENS.forEach((token) => {
            const value = computed.getPropertyValue(token).trim();
            if (value) preview.style.setProperty(token, value);
        });
        if (probeSurfaceBackground && probeHeaderBackground === probeSurfaceBackground) {
            preview.style.setProperty("--callout-header-background", "var(--callout-surface-background)");
        }
        if (probeSurfaceBackground && probeBodyBackground === probeSurfaceBackground) {
            preview.style.setProperty("--callout-body-background", "var(--callout-surface-background)");
        }

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

function createPreviewBodyParagraph(text: string) {
    const paragraph = document.createElement("div");
    paragraph.dataset.type = "NodeParagraph";
    paragraph.className = "p";
    const content = document.createElement("div");
    content.textContent = text;
    paragraph.append(content);
    return paragraph;
}

function wireFoldableAppearancePreview(preview: HTMLElement) {
    preview.addEventListener("click", (event) => {
        const rect = preview.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const hit = getCalloutHeaderHitAreas(preview);
        if (!isFoldButtonHit(hit, clickX, clickY)) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Use logical fold (in-flight target) so rapid clicks reverse mid-animation
        // the same way as the editor — do not gate on a folding lock.
        const isFolded = isCalloutLogicallyFolded(preview);
        void setPreviewFoldState(preview, !isFolded);
    }, true);
}

function createPreviewItem(item: DraftItem, options: PreviewOptions = {}) {
    const isFoldable = !!options.foldable;
    const showBody = isFoldable || !!options.expanded;

    const host = document.createElement("div");
    host.className = [
        "protyle-wysiwyg",
        "callout-enhance-preview-host",
        options.interactive ? "callout-enhance-preview-host--interactive" : "",
        options.expanded ? "callout-enhance-preview-host--expanded" : "",
        isFoldable ? "callout-enhance-preview-host--foldable" : "",
    ].filter(Boolean).join(" ");

    const preview = document.createElement("div");
    preview.className = [
        "callout",
        "callout-enhance-setting-preview",
        options.expanded ? "callout-enhance-setting-preview--expanded" : "",
        isFoldable ? "callout-enhance-setting-preview--foldable" : "",
        options.className || "",
    ].filter(Boolean).join(" ");
    preview.dataset.type = "NodeCallout";
    preview.dataset.nodeId = `callout-enhance-preview-${item.id || item.label || "item"}`;
    preview.dataset.subtype = (item.label || item.id || "default").trim().toUpperCase();
    if (!showBody || options.initialFolded) {
        preview.setAttribute("fold", "1");
    }

    applyPreviewCalloutInlineStyle(preview, item, {
        source: options.iconSource || "editor",
        editorPaintResolver: getEditorCalloutIconPaint,
        editorMaskResolver: getEditorCalloutIconMask,
    });

    const info = document.createElement("div");
    info.className = "callout-info";

    const title = document.createElement("div");
    title.className = "callout-title";
    title.textContent = getCalloutPreviewTitle(item);

    info.append(title);
    preview.append(info);

    if (showBody) {
        preview.append(createPreviewBodyParagraph(options.bodyText ?? "Hello world!"));
    }

    if (isFoldable) {
        wireFoldableAppearancePreview(preview);
    }

    // Keep preview typography/layout in sync with actual editor callout.
    if (options.inheritEditorStyle !== false) {
        applyEditorCalloutStyleTokens(preview, item);
    }
    host.append(preview);
    return host;
}

export function openSettingsDialog(plugin: SettingsEditorPluginLike) {
    void openSettingsDialogAsync(plugin);
}

async function openSettingsDialogAsync(plugin: SettingsEditorPluginLike) {
    await plugin.reloadAppearanceFromDisk();
    const persistedSettings = normalizeCalloutSettings(plugin.settings);

    const dialog = new Dialog({
        title: t("settingsTitle"),
        width: isMobileUi() ? "92vw" : "980px",
        height: isMobileUi() ? "90vh" : "76vh",
        disableClose: true,
        content: `
            <div class="fn__flex callout-enhance-settings-shell">
                <div class="callout-enhance-nav"></div>
                <div class="callout-enhance-detail"></div>
            </div>
        `,
        destroyCallback: () => {
            if (cleanupRunning) {
                stopRunningCleanup();
            } else {
                plugin.abortCalloutCleanup?.();
            }
            finalizeAppearanceOnClose();
        },
    });

    decoratePluginDialog(dialog, "callout-enhance-settings-dialog");

    dialog.element.querySelector(".b3-dialog__scrim")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void requestCloseSettings();
    });
    dialog.element.querySelector(".b3-dialog__close")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void requestCloseSettings();
    });

    const nav = dialog.element.querySelector(".callout-enhance-nav") as HTMLElement | null;
    const detail = dialog.element.querySelector(".callout-enhance-detail") as HTMLElement | null;
    if (!nav || !detail) return dialog;

    const initialTypesState = calloutTypesStateFromSettings(persistedSettings);
    let draft: DraftItem[] = initialTypesState.callouts;
    let tombstoneDraft = initialTypesState.calloutTombstone;
    let cleanupRunning = false;
    const editDialogSettingsContext: EditDialogSettingsContext = {
        getTombstone: () => tombstoneDraft,
        setTombstone: (next) => {
            tombstoneDraft = next;
        },
        countCalloutsForTypeItem: plugin.countCalloutsForTypeItem,
    };
    let selectedIndex = 0;
    let mode: DetailView = "layout";
    const DRAG_SCROLL_EDGE = 40;
    const DRAG_SCROLL_MIN_STEP = 0.5;
    const DRAG_SCROLL_MAX_STEP = 8;

    let draggingIndex = -1;
    let draggingKey = "";
    let dragChanged = false;
    let listSearchQuery = "";
    let calloutListScrollTop = 0;
    let scrollListToBottomOnRender = false;
    let dragScrollSpeed = 0;
    let dragScrollRafId = 0;

    const stopDragAutoScroll = () => {
        dragScrollSpeed = 0;
        if (dragScrollRafId) {
            cancelAnimationFrame(dragScrollRafId);
            dragScrollRafId = 0;
        }
    };

    const getDragScrollSpeed = (clientY: number, rect: DOMRect) => {
        const topEdge = rect.top + DRAG_SCROLL_EDGE;
        const bottomEdge = rect.bottom - DRAG_SCROLL_EDGE;
        const stepRange = DRAG_SCROLL_MAX_STEP - DRAG_SCROLL_MIN_STEP;

        if (clientY < topEdge) {
            const depth = topEdge - clientY;
            const ratio = Math.min(1, depth / DRAG_SCROLL_EDGE);
            const step = DRAG_SCROLL_MIN_STEP + stepRange * ratio * ratio;
            return -step;
        }
        if (clientY > bottomEdge) {
            const depth = clientY - bottomEdge;
            const ratio = Math.min(1, depth / DRAG_SCROLL_EDGE);
            const step = DRAG_SCROLL_MIN_STEP + stepRange * ratio * ratio;
            return step;
        }
        return 0;
    };

    const tickDragAutoScroll = () => {
        if (dragScrollSpeed === 0 || draggingIndex < 0) {
            dragScrollRafId = 0;
            return;
        }
        const body = detail.querySelector(".callout-enhance-list-body") as HTMLElement | null;
        if (body) {
            body.scrollTop += dragScrollSpeed;
            calloutListScrollTop = body.scrollTop;
        }
        dragScrollRafId = requestAnimationFrame(tickDragAutoScroll);
    };

    const updateDragAutoScroll = (clientY: number) => {
        if (draggingIndex < 0) {
            stopDragAutoScroll();
            return;
        }
        const body = detail.querySelector(".callout-enhance-list-body") as HTMLElement | null;
        if (!body) {
            stopDragAutoScroll();
            return;
        }
        dragScrollSpeed = getDragScrollSpeed(clientY, body.getBoundingClientRect());
        if (dragScrollSpeed !== 0 && !dragScrollRafId) {
            dragScrollRafId = requestAnimationFrame(tickDragAutoScroll);
        } else if (dragScrollSpeed === 0 && dragScrollRafId) {
            cancelAnimationFrame(dragScrollRafId);
            dragScrollRafId = 0;
        }
    };
    let appearanceFieldsScrollTop = 0;
    let layoutDraft = normalizeCalloutLayout(persistedSettings.layout);
    let appearancePresetsDraft: CalloutAppearancePreset[] = (persistedSettings.appearancePresets || [])
        .map((item) => ({ ...item, layout: normalizeCalloutLayout(item.layout) }));
    let activeAppearancePresetId = persistedSettings.activeAppearancePresetId || appearancePresetsDraft[0]?.id || "default";
    let appearanceCloseHandled = false;
    let appearanceClosePromptOpen = false;

    const cloneAppearancePresets = (presets: CalloutAppearancePreset[]) => presets.map((preset) => ({
        ...preset,
        layout: normalizeCalloutLayout(preset.layout),
    }));

    let appearancePersistedSnapshot = {
        layout: normalizeCalloutLayout(layoutDraft),
        appearancePresets: cloneAppearancePresets(appearancePresetsDraft),
        activeAppearancePresetId,
    };

    const previewLayout = (layout: CalloutLayoutSettings) => {
        layoutDraft = normalizeCalloutLayout(layout);
        plugin.previewCalloutLayout(layoutDraft);
    };

    const getActiveAppearancePreset = () => appearancePresetsDraft.find((item) => item.id === activeAppearancePresetId);

    const getActivePresetSavedLayout = () => {
        const preset = getActiveAppearancePreset();
        if (!preset) return normalizeCalloutLayout();
        return isDefaultAppearancePreset(preset.id)
            ? getDefaultAppearancePresetLayout()
            : normalizeCalloutLayout(preset.layout);
    };

    const isAppearanceLayoutDirty = () => !areCalloutLayoutsEqual(layoutDraft, getActivePresetSavedLayout());

    const syncAppearancePersistedSnapshot = () => {
        appearancePersistedSnapshot = {
            layout: normalizeCalloutLayout(layoutDraft),
            appearancePresets: cloneAppearancePresets(appearancePresetsDraft),
            activeAppearancePresetId,
        };
    };

    const commitAppearanceState = async (saveLayoutToPreset: boolean) => {
        if (saveLayoutToPreset) {
            const preset = getActiveAppearancePreset();
            if (preset && !isDefaultAppearancePreset(preset.id)) {
                preset.layout = normalizeCalloutLayout(layoutDraft);
            }
        } else {
            layoutDraft = getActivePresetSavedLayout();
        }

        await plugin.setSettings({
            layout: layoutDraft,
            appearancePresets: appearancePresetsDraft,
            activeAppearancePresetId,
        });
        syncAppearancePersistedSnapshot();
        plugin.clearAppearancePreview();
    };

    const restoreAppearancePersisted = () => {
        layoutDraft = normalizeCalloutLayout(appearancePersistedSnapshot.layout);
        appearancePresetsDraft = cloneAppearancePresets(appearancePersistedSnapshot.appearancePresets);
        activeAppearancePresetId = appearancePersistedSnapshot.activeAppearancePresetId;
        plugin.restoreAppearanceState({
            layout: layoutDraft,
            appearancePresets: appearancePresetsDraft,
            activeAppearancePresetId,
        });
    };

    const finalizeAppearanceOnClose = () => {
        if (appearanceCloseHandled) return;
        appearanceCloseHandled = true;
        restoreAppearancePersisted();
    };

    const closeSettingsDialog = async (afterAppearanceCommit?: () => Promise<void>) => {
        appearanceCloseHandled = true;
        dialog.destroy();
        await afterAppearanceCommit?.();
    };

    const commitNewPresetAndClose = async (
        name: string,
        afterAppearanceCommit?: () => Promise<void>,
    ) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        if (trimmed.toLowerCase() === DEFAULT_APPEARANCE_PRESET_NAME.toLowerCase()) {
            showMessage(t("presetNameReserved", { name: t("defaultPresetName") }));
            return false;
        }
        if (appearancePresetsDraft.some((item) => item.name === trimmed)) {
            showMessage(t("configurationNameExists"));
            return false;
        }

        const id = makeAppearancePresetId(trimmed, appearancePresetsDraft.map((item) => item.id));
        appearancePresetsDraft.push({
            id,
            name: trimmed,
            layout: normalizeCalloutLayout(layoutDraft),
        });
        activeAppearancePresetId = id;

        await plugin.setSettings({
            layout: layoutDraft,
            appearancePresets: appearancePresetsDraft,
            activeAppearancePresetId,
        });
        syncAppearancePersistedSnapshot();
        plugin.clearAppearancePreview();
        await closeSettingsDialog(afterAppearanceCommit);
        return true;
    };

    const requestCloseSettings = async (afterAppearanceCommit?: () => Promise<void>) => {
        if (appearanceClosePromptOpen) return false;

        if (!(await confirmAndAbortRunningCleanupForClose())) {
            return false;
        }

        const preset = getActiveAppearancePreset();
        const presetName = preset
            ? (isDefaultAppearancePreset(preset.id) ? t("defaultPresetName") : preset.name)
            : t("defaultPresetName");
        const isDefaultPreset = isDefaultAppearancePreset(activeAppearancePresetId);

        const commitAndClose = async (saveLayoutToPreset: boolean) => {
            await commitAppearanceState(saveLayoutToPreset);
            await closeSettingsDialog(afterAppearanceCommit);
        };

        if (!isAppearanceLayoutDirty()) {
            await commitAndClose(false);
            return true;
        }

        appearanceClosePromptOpen = true;
        return await new Promise<boolean>((resolve) => {
            openAppearanceUnsavedConfirm({
                mode: isDefaultPreset ? "save-new" : "update",
                presetName,
                onSave: async (newPresetName) => {
                    if (isDefaultPreset) {
                        const saved = await commitNewPresetAndClose(newPresetName || "", afterAppearanceCommit);
                        appearanceClosePromptOpen = false;
                        if (!saved) return false;
                        resolve(true);
                        return true;
                    }
                    appearanceClosePromptOpen = false;
                    await commitAndClose(true);
                    resolve(true);
                },
                onDiscard: async () => {
                    appearanceClosePromptOpen = false;
                    await commitAndClose(false);
                    resolve(true);
                },
                onCancel: () => {
                    appearanceClosePromptOpen = false;
                    resolve(false);
                },
            });
        });
    };

    const persistAppearance = async () => {
        const next = normalizeCalloutSettings({
            schemaVersion: plugin.settings.schemaVersion,
            callouts: plugin.settings.callouts,
            layout: layoutDraft,
            appearancePresets: appearancePresetsDraft,
            activeAppearancePresetId,
        });
        await plugin.setSettings({
            layout: next.layout,
            appearancePresets: next.appearancePresets,
            activeAppearancePresetId: next.activeAppearancePresetId,
        });
        layoutDraft = normalizeCalloutLayout(next.layout);
        appearancePresetsDraft = cloneAppearancePresets(next.appearancePresets || appearancePresetsDraft);
        activeAppearancePresetId = next.activeAppearancePresetId || activeAppearancePresetId;
        syncAppearancePersistedSnapshot();
        plugin.clearAppearancePreview();
    };

    const persistCalloutsOnly = async () => {
        if (cleanupRunning) return;
        const normalized = normalizeCalloutTypesSlice(
            { callouts: draft, calloutTombstone: tombstoneDraft },
            {
                schemaVersion: plugin.settings.schemaVersion,
                layout: layoutDraft,
                appearancePresets: appearancePresetsDraft,
                activeAppearancePresetId,
            },
        );
        tombstoneDraft = normalized.calloutTombstone;
        await plugin.setSettings({
            callouts: normalized.callouts,
            calloutTombstone: normalized.calloutTombstone,
        });
    };

    const getItemKey = getCalloutTypeKey;

    const matchesListSearch = (item: DraftItem, query: string) => calloutMatchesListSearch(item, query);

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

    const renderLayout = () => {
        renderLayoutSettingsPanel({
            host: detail,
            layout: layoutDraft,
            presets: appearancePresetsDraft,
            activePresetId: activeAppearancePresetId,
            previewItem: getLayoutPreviewItem(),
            renderPreview: (item, previewState) => createPreviewItem(item, {
                iconSource: "draft",
                foldable: true,
                bodyText: t("previewBodyHello"),
                initialFolded: previewState?.folded,
            }),
            onChange: (next) => {
                previewLayout(next);
            },
            fieldsScrollTop: appearanceFieldsScrollTop,
            onFieldsScroll: (scrollTop) => {
                appearanceFieldsScrollTop = scrollTop;
            },
            onPresetSelect: (presetId) => {
                const preset = appearancePresetsDraft.find((item) => item.id === presetId);
                if (!preset) return;
                activeAppearancePresetId = presetId;
                previewLayout(isDefaultAppearancePreset(presetId)
                    ? getDefaultAppearancePresetLayout()
                    : preset.layout);
                renderLayout();
            },
            onPresetSave: (name) => {
                if (name.trim().toLowerCase() === DEFAULT_APPEARANCE_PRESET_NAME.toLowerCase()) {
                    showMessage(t("presetNameReserved", { name: t("defaultPresetName") }));
                    return;
                }
                const existing = appearancePresetsDraft.find((item) => item.name === name);
                if (existing) {
                    if (isDefaultAppearancePreset(existing.id)) return;
                    existing.layout = normalizeCalloutLayout(layoutDraft);
                    activeAppearancePresetId = existing.id;
                } else {
                    const id = makeAppearancePresetId(name, appearancePresetsDraft.map((item) => item.id));
                    appearancePresetsDraft.push({
                        id,
                        name,
                        layout: normalizeCalloutLayout(layoutDraft),
                    });
                    activeAppearancePresetId = id;
                }
                renderLayout();
                void persistAppearance();
            },
            onPresetUpdate: (presetId, name) => {
                if (isDefaultAppearancePreset(presetId)) return;
                if (name.trim().toLowerCase() === DEFAULT_APPEARANCE_PRESET_NAME.toLowerCase()) {
                    showMessage(t("presetNameReserved", { name: t("defaultPresetName") }));
                    return;
                }
                const preset = appearancePresetsDraft.find((item) => item.id === presetId);
                if (!preset) return;
                const nameTaken = appearancePresetsDraft.find((item) => item.name === name && item.id !== presetId);
                if (nameTaken) {
                    showMessage(t("configurationNameExists"));
                    return;
                }
                preset.name = name.trim();
                preset.layout = normalizeCalloutLayout(layoutDraft);
                activeAppearancePresetId = preset.id;
                renderLayout();
                void persistAppearance();
            },
            onPresetDelete: (presetId) => {
                if (isDefaultAppearancePreset(presetId)) return;
                appearancePresetsDraft = appearancePresetsDraft.filter((item) => item.id !== presetId);
                activeAppearancePresetId = DEFAULT_APPEARANCE_PRESET_ID;
                previewLayout(getDefaultAppearancePresetLayout());
                renderLayout();
                void persistAppearance();
            },
            onPresetRevert: () => {
                previewLayout(getActivePresetSavedLayout());
                renderLayout();
            },
        });
    };

    const getLayoutPreviewItem = (): DraftItem => {
        const noteItem = draft.find((item) => (item.label || "").trim().toUpperCase() === "NOTE");
        if (noteItem) return noteItem;
        return {
            id: "note",
            label: "NOTE",
            keywords: ["Note"],
            pastLabels: [],
            icon: "",
            color: "",
            order: 0,
            enabled: true,
        };
    };

    const renderNav = () => {
        nav.innerHTML = "";
        nav.setAttribute("role", "tablist");
        nav.setAttribute("aria-label", t("settingsTitle"));

        const createNavItem = (label: string, iconId: string, active: boolean, onClick: () => void) => {
            const item = document.createElement("div");
            item.className = `callout-enhance-nav-item${active ? " callout-enhance-nav-item--active" : ""}`;
            item.title = label;
            item.setAttribute("aria-label", label);
            item.setAttribute("role", "tab");
            item.setAttribute("aria-selected", active ? "true" : "false");
            if (isMobileUi()) item.classList.add("ariaLabel");
            item.innerHTML = `<svg class="callout-enhance-nav-item__icon"><use href="#${iconId}"></use></svg><span class="callout-enhance-nav-item__text b3-label__text">${label}</span>`;
            item.addEventListener("click", onClick);
            nav.appendChild(item);
        };

        createNavItem(t("navAppearance"), "iconTheme", mode === "layout", () => {
            mode = "layout";
            render();
        });
        createNavItem(t("navCalloutTypes"), "iconCallout", mode === "list", () => {
            mode = "list";
            render();
        });
        createNavItem(t("navAbout"), "iconInfo", mode === "about", () => {
            mode = "about";
            render();
        });
    };

    const moveItem = (from: number, to: number) => {
        if (cleanupRunning) return;
        const next = reorderCalloutTypes(draft, from, to);
        if (!next) return;
        draft = next;
        selectedIndex = to;
        renderList(true);
        void persistCalloutsOnly();
    };

    const moveItemDuringDrag = (from: number, to: number) => {
        if (cleanupRunning) return;
        const next = reorderCalloutTypes(draft, from, to);
        if (!next) return;
        const selectedKey = getItemKey(draft[selectedIndex]);
        const previousRects = getListItemRects();
        draft = next;
        draggingIndex = to;
        draggingKey = getItemKey(draft[to]);
        dragChanged = true;
        selectedIndex = Math.max(0, draft.findIndex((item) => getItemKey(item) === selectedKey));
        renderList(true);
        animateListFrom(previousRects);
    };

    const finishDrag = () => {
        stopDragAutoScroll();
        if (dragChanged) void persistCalloutsOnly();
        draggingIndex = -1;
        draggingKey = "";
        dragChanged = false;
        renderList(true);
    };

    const captureListScrollTop = () => {
        const existingListBody = detail.querySelector(".callout-enhance-list-body") as HTMLElement | null;
        if (existingListBody) {
            calloutListScrollTop = existingListBody.scrollTop;
        }
    };

    const getListBodyMaxScrollTop = (listBody: HTMLElement) => (
        Math.max(0, listBody.scrollHeight - listBody.clientHeight)
    );

    const applyListScrollAfterRender = (listBody: HTMLElement, savedListScrollTop: number) => {
        const targetScrollTop = scrollListToBottomOnRender
            ? getListBodyMaxScrollTop(listBody)
            : savedListScrollTop;
        scrollListToBottomOnRender = false;
        listBody.scrollTop = targetScrollTop;
        calloutListScrollTop = targetScrollTop;
        listBody.onscroll = () => {
            calloutListScrollTop = listBody.scrollTop;
        };
        requestAnimationFrame(() => {
            listBody.scrollTop = targetScrollTop;
            calloutListScrollTop = targetScrollTop;
        });
    };

    const lockCalloutTypeControl = (element: HTMLElement, locked: boolean) => {
        if (locked) {
            element.setAttribute("disabled", "");
            element.classList.add("callout-enhance-control--cleanup-locked");
            element.setAttribute("aria-disabled", "true");
        } else {
            element.removeAttribute("disabled");
            element.classList.remove("callout-enhance-control--cleanup-locked");
            element.removeAttribute("aria-disabled");
        }
    };

    const renderList = (itemsOnly = false) => {
        const typesEditLocked = cleanupRunning;
        if (!itemsOnly) {
            captureListScrollTop();
            detail.innerHTML = "";

            const topBar = document.createElement("div");
            topBar.className = `fn__flex callout-enhance-list-topbar${typesEditLocked ? " callout-enhance-list-topbar--cleanup-locked" : ""}`;

            const topActions = document.createElement("div");
            topActions.className = "fn__flex callout-enhance-list-top-actions";

            const searchInput = createTextInput(listSearchQuery);
            searchInput.className = "b3-text-field callout-enhance-list-search";
            searchInput.placeholder = t("searchCalloutTypesPlaceholder");
            searchInput.readOnly = typesEditLocked;
            lockCalloutTypeControl(searchInput, typesEditLocked);
            searchInput.addEventListener("input", () => {
                if (typesEditLocked) return;
                listSearchQuery = searchInput.value;
                renderList(true);
            });

            if (typesEditLocked) {
                const lockHint = document.createElement("div");
                lockHint.className = "b3-form__desc callout-enhance-list-cleanup-lock-hint";
                lockHint.textContent = t("cleanupTypesLockedHint");
                topBar.appendChild(lockHint);
            }

            const addBtn = createIconButton(t("addCalloutType"), ICON_ADD);
            lockCalloutTypeControl(addBtn, typesEditLocked);
            addBtn.addEventListener("click", () => {
                if (cleanupRunning) return;
                const created = createCalloutTypeDraft(draft, {
                    color: getNewCalloutDefaultColor(),
                });
                draft = created.callouts;
                selectedIndex = created.index;
                render();
                openEditDialog(draft[selectedIndex], (next) => {
                    const updated = updateCalloutTypeAtIndex(draft, selectedIndex, { ...next, order: selectedIndex });
                    if (updated) draft = updated;
                    scrollListToBottomOnRender = true;
                    renderList(true);
                    void persistCalloutsOnly();
                }, {
                    isNew: true,
                    existingCallouts: draft,
                    settingsContext: editDialogSettingsContext,
                    onDiscardNew: () => {
                        draft.splice(selectedIndex, 1);
                        selectedIndex = Math.max(0, Math.min(selectedIndex, draft.length - 1));
                        render();
                    },
                });
            });

            topActions.append(searchInput, addBtn);
            topBar.append(topActions);
            detail.appendChild(topBar);

            const listBody = document.createElement("div");
            listBody.className = `callout-enhance-list-body${typesEditLocked ? " callout-enhance-list-body--cleanup-locked" : ""}`;
            listBody.addEventListener("dragover", (e) => {
                if (cleanupRunning || draggingIndex < 0) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                updateDragAutoScroll(e.clientY);
            });
            detail.appendChild(listBody);
        }

        const listBody = detail.querySelector(".callout-enhance-list-body") as HTMLElement | null;
        if (!listBody) return;

        listBody.classList.toggle("callout-enhance-list-body--cleanup-locked", typesEditLocked);
        const topBar = detail.querySelector(".callout-enhance-list-topbar");
        topBar?.classList.toggle("callout-enhance-list-topbar--cleanup-locked", typesEditLocked);

        const savedListScrollTop = itemsOnly ? listBody.scrollTop : calloutListScrollTop;
        calloutListScrollTop = savedListScrollTop;
        listBody.innerHTML = "";

        const filteredEntries = getFilteredDraftEntries();
        const searchActive = listSearchQuery.trim().length > 0;

        filteredEntries.forEach(({ item, index }) => {
            const row = document.createElement("div");
            row.className = "callout-enhance-setting-item";
            row.dataset.index = String(index);
            row.dataset.key = getItemKey(item);
            row.draggable = !searchActive && !typesEditLocked;
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
            enabled.title = t("enabled");
            enabled.style.margin = "0";
            enabled.addEventListener("click", (e) => e.stopPropagation());
            lockCalloutTypeControl(enabled, typesEditLocked);
            enabled.addEventListener("change", () => {
                if (cleanupRunning) return;
                const next = setCalloutTypeEnabled(draft, index, enabled.checked);
                if (next) draft = next;
                selectedIndex = index;
                void persistCalloutsOnly();
            });

            const editBtn = createIconButton(t("edit"), ICON_EDIT, "callout-enhance-icon-button--edit");
            lockCalloutTypeControl(editBtn, typesEditLocked);
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (cleanupRunning) return;
                captureListScrollTop();
                openEditDialog(draft[index], (next) => {
                    const updated = updateCalloutTypeAtIndex(draft, index, { ...next, order: index });
                    if (updated) draft = updated;
                    selectedIndex = index;
                    renderList(true);
                    void persistCalloutsOnly();
                }, {
                    existingCallouts: draft,
                    settingsContext: editDialogSettingsContext,
                });
            });

            const deleteBtn = createIconButton(t("delete"), ICON_DELETE, "callout-enhance-icon-button--delete");
            const protectedType = isProtectedCalloutType(item);
            deleteBtn.disabled = protectedType || typesEditLocked;
            lockCalloutTypeControl(deleteBtn, protectedType ? false : typesEditLocked);
            if (protectedType) {
                deleteBtn.classList.add("callout-enhance-icon-button--disabled");
                deleteBtn.title = t("builtinCannotDelete");
                deleteBtn.setAttribute("aria-label", t("builtinCannotDelete"));
            }
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (cleanupRunning || protectedType) return;
                void confirmDeleteCalloutType(
                    item,
                    plugin,
                    () => {
                        const result = deleteCalloutTypeAtIndex(
                            { callouts: draft, calloutTombstone: tombstoneDraft },
                            index,
                        );
                        if (!result) return;
                        draft = result.callouts;
                        tombstoneDraft = result.calloutTombstone;
                        selectedIndex = Math.max(0, Math.min(selectedIndex, draft.length - 1));
                        render();
                        void persistCalloutsOnly();
                    },
                );
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
                if (cleanupRunning || searchActive) {
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
                updateDragAutoScroll(e.clientY);
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
            empty.textContent = t("noCalloutTypes");
            listBody.appendChild(empty);
        } else if (filteredEntries.length === 0) {
            const empty = document.createElement("div");
            empty.className = "b3-form__desc callout-enhance-list-empty";
            empty.textContent = t("noMatchingCalloutTypes");
            listBody.appendChild(empty);
        }
        applyListScrollAfterRender(listBody, savedListScrollTop);
    };

    let cleanupSession: {
        controller: AbortController;
        closeProgress: () => void;
    } | null = null;

    const finishCleanupRunning = () => {
        if (!cleanupRunning) return;
        cleanupRunning = false;
        cleanupSession = null;
        if (mode === "about") renderAbout();
        else if (mode === "list") renderList();
    };

    const stopRunningCleanup = () => {
        cleanupSession?.controller.abort();
        cleanupSession?.closeProgress();
        plugin.abortCalloutCleanup?.();
        finishCleanupRunning();
    };

    const waitCleanupNotRunning = async (timeoutMs = 8000) => {
        const deadline = Date.now() + timeoutMs;
        while (cleanupRunning) {
            if (Date.now() >= deadline) {
                finishCleanupRunning();
                return;
            }
            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 50);
            });
        }
    };

    const confirmAndAbortRunningCleanup = (options: {
        title: string;
        message: string;
        confirmLabel: string;
        cancelLabel?: string;
    }): Promise<boolean> => {
        if (!cleanupRunning) {
            return Promise.resolve(true);
        }
        return new Promise<boolean>((resolve) => {
            openConfirmDialog({
                title: options.title,
                message: options.message,
                confirmLabel: options.confirmLabel,
                cancelLabel: options.cancelLabel ?? t("continue"),
                width: dialogWidth("420px"),
                disableClose: true,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            });
        }).then(async (confirmed) => {
            if (!confirmed) return false;
            stopRunningCleanup();
            await waitCleanupNotRunning();
            return true;
        });
    };

    const confirmAndAbortRunningCleanupForClose = () => confirmAndAbortRunningCleanup({
        title: t("cleanupCloseTitle"),
        message: t("cleanupCloseDuring"),
        confirmLabel: t("cleanupStopClose"),
        cancelLabel: t("stay"),
    });

    const formatCleanupSnapshotMemoTime = () => {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };

    const runCleanupFlow = async (startMode: CleanupStartMode) => {
        if (cleanupRunning || !plugin.runCalloutCleanup) return;
        if (plugin.isWorkspaceReadOnly?.()) {
            showMessage(t("workspaceReadOnlyCleanup"));
            return;
        }

        cleanupRunning = true;
        render();

        const progressOffset = startMode === "snapshot-then-cleanup" ? CLEANUP_SNAPSHOT_PROGRESS_END : 0;
        const controller = new AbortController();
        let inSnapshotPhase = false;

        const getCleanupSettings = () => normalizeCalloutSettings({
            ...plugin.settings,
            callouts: draft,
            calloutTombstone: tombstoneDraft,
        });
        const syncDraftFromPluginSettings = () => {
            const synced = calloutTypesStateFromSettings(plugin.settings);
            draft = synced.callouts;
            tombstoneDraft = synced.calloutTombstone;
        };

        const handleProgressFinishedClose = (result: CleanupResult) => {
            if (result.aborted || result.metadataCleared || !plugin.clearLegacyCalloutMetadata) return;
            openConfirmDialog({
                title: t("cleanupForceClearTitle"),
                message: formatCleanupForceClearMessage(result),
                confirmLabel: t("cleanupForceClearMetadata"),
                cancelLabel: t("close"),
                width: dialogWidth("440px"),
                onConfirm: () => {
                    void plugin.clearLegacyCalloutMetadata?.({
                        getSettings: getCleanupSettings,
                        saveSettings: async (partial) => {
                            await plugin.setSettings(partial);
                            syncDraftFromPluginSettings();
                        },
                    }).then(() => {
                        if (mode === "list") renderList(true);
                        showMessage(t("cleanupMetadataForceCleared"));
                    });
                },
            });
        };

        const requestAbortDuringMigrate = () => {
            void confirmAndAbortRunningCleanup({
                title: t("cleanupStopTitle"),
                message: t("cleanupStopConfirm"),
                confirmLabel: t("cleanupStop"),
                cancelLabel: t("continue"),
            });
        };

        const createProgressDialog = (): CleanupProgressDialogHandle => openCleanupProgressDialog({
            signal: controller.signal,
            onCancel: () => {
                if (inSnapshotPhase) {
                    stopRunningCleanup();
                    return;
                }
                requestAbortDuringMigrate();
            },
            onFinishedClose: handleProgressFinishedClose,
        });

        let progressDialog = createProgressDialog();
        cleanupSession = {
            controller,
            closeProgress: () => progressDialog.close(),
        };

        type SnapshotAttemptOutcome = "ok" | "skip" | "aborted" | "declined";

        const attemptSnapshot = async (): Promise<SnapshotAttemptOutcome> => {
            if (controller.signal.aborted) return "aborted";
            inSnapshotPhase = true;
            progressDialog.update({
                phase: "snapshot",
                message: t("cleanupSnapshotCreating"),
                percent: 0,
                indeterminate: true,
            });
            try {
                await createRepoSnapshot(t("cleanupSnapshotMemo", {
                    time: formatCleanupSnapshotMemoTime(),
                }));
                inSnapshotPhase = false;
                if (controller.signal.aborted) return "aborted";
                progressDialog.update({
                    phase: "snapshot",
                    message: t("cleanupSnapshotCreated"),
                    percent: CLEANUP_SNAPSHOT_PROGRESS_END,
                    indeterminate: false,
                });
                showMessage(t("cleanupSnapshotSuccessHint"));
                return "ok";
            } catch (error) {
                inSnapshotPhase = false;
                if (controller.signal.aborted) return "aborted";
                const reason = error instanceof ClApiError
                    ? error.message
                    : t("cleanupSnapshotFailedGeneric");
                progressDialog.close();
                return await new Promise<SnapshotAttemptOutcome>((resolve) => {
                    openSnapshotFailedContinueDialog({
                        reason,
                        onContinue: () => resolve("skip"),
                        onCancel: () => resolve("declined"),
                    });
                });
            }
        };

        try {
            if (startMode === "snapshot-then-cleanup") {
                const snapshotOutcome = await attemptSnapshot();
                if (snapshotOutcome === "aborted" || snapshotOutcome === "declined") {
                    progressDialog.close();
                    return;
                }
                if (snapshotOutcome === "skip") {
                    progressDialog = createProgressDialog();
                    cleanupSession = {
                        controller,
                        closeProgress: () => progressDialog.close(),
                    };
                }
            }

            if (controller.signal.aborted) {
                progressDialog.close();
                return;
            }

            try {
                const result = await plugin.runCalloutCleanup({
                    signal: controller.signal,
                    abortController: controller,
                    onProgress: (progress) => {
                        if (controller.signal.aborted) return;
                        progressDialog.update(progress);
                    },
                    getSettings: getCleanupSettings,
                    saveSettings: async (partial) => {
                        await plugin.setSettings(partial);
                        syncDraftFromPluginSettings();
                    },
                    progressOffset,
                    migrateEndPercent: 98,
                });
                progressDialog.showResult(result);
                syncDraftFromPluginSettings();
                if (mode === "list") renderList(true);
            } catch (error) {
                if (!controller.signal.aborted) {
                    const message = error instanceof ClApiError
                        ? error.message
                        : t("cleanupFailedConsole");
                    showMessage(message);
                }
                progressDialog.close();
            }
        } finally {
            finishCleanupRunning();
        }
    };

    const requestCleanup = () => {
        if (cleanupRunning) return;
        if (plugin.isWorkspaceReadOnly?.()) {
            showMessage(t("workspaceReadOnlyCleanup"));
            return;
        }
        const editorNote = plugin.isEditorReadOnly?.()
            ? t("cleanupEditorLockNote")
            : "";
        openCleanupStartConfirmDialog({
            title: t("cleanupTitle"),
            message: `${t("cleanupConfirm")}${editorNote}`,
            width: dialogWidth("480px"),
            onSnapshotThenCleanup: () => {
                void runCleanupFlow("snapshot-then-cleanup");
            },
            onCleanupOnly: () => {
                void runCleanupFlow("cleanup-only");
            },
        });
    };

    const renderAbout = () => {
        detail.innerHTML = "";
        renderAboutSettingsPanel({
            host: detail,
            debugLogEnabled: !!plugin.settings.debugLogEnabled,
            onDebugLogChange: (enabled) => {
                void plugin.setSettings({ debugLogEnabled: enabled });
            },
            cleanupRunning,
            onCleanupClick: requestCleanup,
        });
    };

    const render = () => {
        renderNav();
        detail.classList.toggle("callout-enhance-detail--layout", mode === "layout");
        detail.classList.toggle("callout-enhance-detail--list", mode === "list");
        if (mode === "layout") renderLayout();
        else if (mode === "list") renderList();
        else if (mode === "about") renderAbout();
    };

    render();

    return dialog;
}
