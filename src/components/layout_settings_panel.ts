import { Dialog, showMessage } from "siyuan";
import {
    areCalloutLayoutsEqual,
    CALLOUT_LAYOUT_FIELD_GROUPS,
    CALLOUT_LAYOUT_FIELDS,
    CalloutLayoutFieldDef,
    CalloutLayoutSettings,
    DEFAULT_CALLOUT_LAYOUT,
    inputValueToLayoutField,
    layoutFieldToInputValue,
    normalizeCalloutLayout,
} from "../utils/callout_layout_vars";
import { createPreviewHelpIcon, openConfirmDialog } from "./settings_ui";
import { CalloutTypeItem } from "../utils/callout_types";
import {
    CalloutAppearancePreset,
    getDefaultAppearancePresetLayout,
    isDefaultAppearancePreset,
} from "../utils/settings";
import { t, layoutFieldLabel, layoutGroupLabel, layoutOptionLabel } from "../utils/i18n";

export type LayoutSettingsPanelOptions = {
    host: HTMLElement;
    layout: CalloutLayoutSettings;
    presets: CalloutAppearancePreset[];
    activePresetId: string;
    previewItem: CalloutTypeItem;
    renderPreview: (item: CalloutTypeItem, previewState?: { folded: boolean }) => HTMLElement;
    onChange: (layout: CalloutLayoutSettings) => void;
    onPresetSelect: (presetId: string) => void;
    onPresetSave: (name: string) => void;
    onPresetUpdate: (presetId: string, name: string) => void;
    onPresetDelete: (presetId: string) => void;
    onPresetRevert: () => void;
    fieldsScrollTop?: number;
    onFieldsScroll?: (scrollTop: number) => void;
};

type AppearancePresetNameDialogOptions = {
    title: string;
    confirmLabel: string;
    initialName?: string;
    placeholder?: string;
    reservedNames?: string[];
    onConfirm: (name: string) => void;
};

function createPresetIconButton(label: string, symbol: string, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `b3-button callout-enhance-icon-button ${extraClass}`.trim();
    btn.type = "button";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `<svg class="b3-menu__icon" style="width:14px;height:14px;margin:0;"><use href="#${symbol}"></use></svg>`;
    return btn;
}

function createPresetSvgIconButton(label: string, path: string, extraClass = "") {
    const btn = document.createElement("button");
    btn.className = `b3-button callout-enhance-icon-button ${extraClass}`.trim();
    btn.type = "button";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `<svg class="b3-menu__icon" style="width:14px;height:14px;margin:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    return btn;
}

function setPresetActionDisabled(button: HTMLButtonElement, disabled: boolean) {
    button.disabled = disabled;
    button.classList.toggle("callout-enhance-layout-settings__preset-action--disabled", disabled);
}

function openAppearancePresetNameDialog(options: AppearancePresetNameDialogOptions) {
    const {
        title,
        confirmLabel,
        initialName = "",
        placeholder = t("configurationNamePlaceholder"),
        onConfirm,
    } = options;

    const dialog = new Dialog({
        title,
        width: window.innerWidth < 768 ? "88vw" : "320px",
        content: "<div class=\"callout-enhance-preset-save-body\"></div>",
    });

    const body = dialog.element.querySelector(".callout-enhance-preset-save-body") as HTMLElement | null;
    if (!body) return dialog;

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.type = "text";
    input.placeholder = placeholder;
    input.maxLength = 64;
    input.value = initialName;

    const footer = document.createElement("div");
    footer.className = "b3-dialog__action callout-enhance-dialog-footer";

    const cancel = document.createElement("button");
    cancel.className = "b3-button b3-button--cancel";
    cancel.type = "button";
    cancel.textContent = t("cancel");
    cancel.addEventListener("click", () => dialog.destroy());

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "b3-button b3-button--text";
    confirmBtn.type = "button";
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener("click", () => {
        const name = input.value.trim();
        if (!name) {
            showMessage(t("configurationNameRequired"));
            input.focus();
            return;
        }
        onConfirm(name);
        dialog.destroy();
    });

    footer.append(confirmBtn, cancel);
    body.append(input, footer);
    input.focus();
    input.select();
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            confirmBtn.click();
        }
    });
    return dialog;
}

function openAppearancePresetSaveDialog(existingNames: string[], onSave: (name: string) => void) {
    openAppearancePresetNameDialog({
        title: t("layoutSaveConfiguration"),
        confirmLabel: t("save"),
        onConfirm: (name) => {
            onSave(name);
            showMessage(existingNames.includes(name) ? t("configurationUpdated") : t("configurationSaved"));
        },
    });
}

function openAppearancePresetUpdateDialog(presetName: string, onUpdate: (name: string) => void) {
    openAppearancePresetNameDialog({
        title: t("layoutUpdateConfiguration"),
        confirmLabel: t("update"),
        initialName: presetName,
        onConfirm: (name) => {
            onUpdate(name);
            showMessage(t("configurationUpdated"));
        },
    });
}

function fieldUsesSlider(field: CalloutLayoutFieldDef) {
    return field.kind !== "select"
        && field.kind !== "text"
        && field.min != null
        && field.max != null;
}

function formatSliderValueLabel(field: CalloutLayoutFieldDef, raw: string) {
    const resolved = inputValueToLayoutField(field, raw);
    if (field.kind === "opacity") return resolved;
    if (field.kind === "time") return `${raw} ms`;
    if (field.kind === "percent") return `${raw}%`;
    return resolved;
}

function createLayoutFieldInput(field: CalloutLayoutFieldDef, stored: string, onValue: (value: string) => void) {
    if (fieldUsesSlider(field)) {
        const wrap = document.createElement("div");
        wrap.className = "callout-enhance-layout-settings__slider-wrap";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "b3-slider fn__block callout-enhance-layout-settings__slider";
        slider.min = String(field.min);
        slider.max = String(field.max);
        slider.step = String(field.step ?? (field.kind === "opacity" ? 0.05 : 1));
        slider.value = layoutFieldToInputValue(field, stored);

        const valueLabel = document.createElement("span");
        valueLabel.className = "callout-enhance-layout-settings__slider-value";
        const syncValueLabel = () => {
            valueLabel.textContent = formatSliderValueLabel(field, slider.value);
        };

        const commit = () => {
            syncValueLabel();
            onValue(inputValueToLayoutField(field, slider.value));
        };
        slider.addEventListener("input", commit);
        slider.addEventListener("change", commit);
        syncValueLabel();
        wrap.append(slider, valueLabel);
        return wrap;
    }

    if (field.kind === "select" && field.options) {
        const select = document.createElement("select");
        select.className = "b3-select fn__block";
        field.options.forEach((opt) => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = layoutOptionLabel(opt.label);
            select.appendChild(option);
        });
        select.value = stored || field.defaultValue;
        select.addEventListener("change", () => onValue(select.value));
        return select;
    }

    if (field.kind === "text") {
        const input = document.createElement("input");
        input.className = "b3-text-field fn__block";
        input.type = "text";
        input.value = stored || field.defaultValue;
        input.addEventListener("change", () => onValue(input.value.trim() || field.defaultValue));
        input.addEventListener("input", () => onValue(input.value.trim() || field.defaultValue));
        return input;
    }

    const input = document.createElement("input");
    input.className = "b3-text-field fn__block";
    input.type = "number";
    input.step = String(field.step ?? (field.kind === "opacity" ? 0.05 : 1));
    if (field.min != null) input.min = String(field.min);
    if (field.max != null) input.max = String(field.max);
    input.value = layoutFieldToInputValue(field, stored);

    const commit = () => onValue(inputValueToLayoutField(field, input.value));
    input.addEventListener("change", commit);
    input.addEventListener("input", commit);
    return input;
}

export function renderLayoutSettingsPanel(options: LayoutSettingsPanelOptions) {
    const {
        host,
        previewItem,
        renderPreview,
        onChange,
        onPresetSelect,
        onPresetSave,
        onPresetUpdate,
        onPresetDelete,
        presets,
        activePresetId,
    } = options;
    let layout = normalizeCalloutLayout(options.layout);
    host.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "callout-enhance-layout-settings";

    const presetSection = document.createElement("div");
    presetSection.className = "callout-enhance-layout-settings__preset-section";

    const presetLabelRow = document.createElement("div");
    presetLabelRow.className = "fn__flex callout-enhance-layout-settings__preset-label-row";
    const presetLabel = document.createElement("div");
    presetLabel.className = "b3-label__text";
    presetLabel.textContent = t("layoutPreset");
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "b3-button b3-button--text callout-enhance-layout-settings__reset-btn";
    resetBtn.textContent = t("layoutResetDefaults");
    resetBtn.addEventListener("click", () => {
        layout = normalizeCalloutLayout();
        onChange(layout);
        renderLayoutSettingsPanel({ ...options, layout });
    });
    presetLabelRow.append(presetLabel, resetBtn);

    const presetBar = document.createElement("div");
    presetBar.className = "fn__flex callout-enhance-layout-settings__preset-bar";

    const presetSelect = document.createElement("select");
    presetSelect.className = "b3-select callout-enhance-layout-settings__preset-select";
    presets.forEach((preset) => {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = isDefaultAppearancePreset(preset.id) ? t("defaultPresetName") : preset.name;
        presetSelect.appendChild(option);
    });
    presetSelect.value = presets.some((item) => item.id === activePresetId)
        ? activePresetId
        : presets[0]?.id || "";
    presetSelect.addEventListener("change", () => {
        if (presetSelect.value) onPresetSelect(presetSelect.value);
    });

    const presetActions = document.createElement("div");
    presetActions.className = "callout-enhance-layout-settings__preset-actions";

    const savePresetBtn = createPresetSvgIconButton(
        t("saveNewPreset"),
        "<path d=\"M12 5v14\"></path><path d=\"M5 12h14\"></path>",
        "callout-enhance-layout-settings__preset-save",
    );
    savePresetBtn.addEventListener("click", () => {
        openAppearancePresetSaveDialog(
            presets
                .filter((item) => !isDefaultAppearancePreset(item.id))
                .map((item) => item.name),
            onPresetSave,
        );
    });

    const updatePresetBtn = createPresetIconButton(
        t("layoutUpdateConfiguration"),
        "iconRefresh",
        "callout-enhance-layout-settings__preset-update",
    );
    updatePresetBtn.addEventListener("click", () => {
        const preset = presets.find((item) => item.id === activePresetId);
        if (!preset || isDefaultAppearancePreset(preset.id) || updatePresetBtn.disabled) return;
        openAppearancePresetUpdateDialog(preset.name, (name) => onPresetUpdate(preset.id, name));
    });

    const deletePresetBtn = createPresetIconButton(
        t("delete"),
        "iconTrashcan",
        "callout-enhance-icon-button--delete callout-enhance-layout-settings__preset-delete",
    );
    deletePresetBtn.addEventListener("click", () => {
        const preset = presets.find((item) => item.id === activePresetId);
        if (!preset || isDefaultAppearancePreset(preset.id) || deletePresetBtn.disabled) return;
        openConfirmDialog({
            title: t("layoutDeleteConfiguration"),
            message: t("layoutDeletePresetMessage", {
                name: isDefaultAppearancePreset(preset.id) ? t("defaultPresetName") : preset.name,
            }),
            confirmLabel: t("delete"),
            width: window.innerWidth < 768 ? "88vw" : "360px",
            onConfirm: () => onPresetDelete(preset.id),
        });
    });

    const revertPresetBtn = createPresetIconButton(
        t("revertToSavedPreset"),
        "iconUndo",
        "callout-enhance-layout-settings__preset-revert",
    );
    revertPresetBtn.addEventListener("click", () => {
        if (revertPresetBtn.disabled) return;
        options.onPresetRevert();
    });

    presetActions.append(savePresetBtn, updatePresetBtn, revertPresetBtn, deletePresetBtn);

    const refreshPresetActionStates = () => {
        const isDefault = isDefaultAppearancePreset(activePresetId);
        const activePreset = presets.find((item) => item.id === activePresetId);
        const savedLayout = !activePreset
            ? normalizeCalloutLayout()
            : isDefault
                ? getDefaultAppearancePresetLayout()
                : activePreset.layout;
        const layoutMatchesPreset = areCalloutLayoutsEqual(layout, savedLayout);

        setPresetActionDisabled(updatePresetBtn, isDefault);
        setPresetActionDisabled(revertPresetBtn, layoutMatchesPreset);
        setPresetActionDisabled(deletePresetBtn, isDefault);
    };

    refreshPresetActionStates();
    presetBar.append(presetSelect, presetActions);
    presetSection.append(presetLabelRow, presetBar);

    const previewBlock = document.createElement("div");
    previewBlock.className = "callout-enhance-layout-settings__preview";
    const previewLabelRow = document.createElement("div");
    previewLabelRow.className = "fn__flex callout-enhance-layout-settings__preview-label-row";
    const previewLabel = document.createElement("div");
    previewLabel.className = "b3-label__text";
    previewLabel.textContent = t("layoutPreview");
    previewLabelRow.append(previewLabel, createPreviewHelpIcon());
    const previewHint = document.createElement("div");
    previewHint.className = "callout-enhance-layout-settings__preview-hint b3-label__text";
    previewHint.textContent = t("layoutPreviewHint");
    const previewHost = document.createElement("div");
    previewHost.className = "callout-enhance-layout-preview-host";

    const readPreviewFolded = () => {
        const current = previewHost.querySelector('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        return current?.getAttribute("fold") === "1";
    };

    const refreshPreview = (folded = readPreviewFolded()) => {
        previewHost.innerHTML = "";
        previewHost.appendChild(renderPreview(previewItem, { folded }));
    };

    refreshPreview(false);
    previewBlock.append(previewLabelRow, previewHint, previewHost);

    const sticky = document.createElement("div");
    sticky.className = "callout-enhance-layout-settings__sticky";
    sticky.append(presetSection, previewBlock);

    const fieldsScroll = document.createElement("div");
    fieldsScroll.className = "callout-enhance-layout-settings__fields-scroll";
    fieldsScroll.scrollTop = options.fieldsScrollTop || 0;
    fieldsScroll.addEventListener("scroll", () => {
        options.onFieldsScroll?.(fieldsScroll.scrollTop);
    });

    const fieldsHost = document.createElement("div");
    fieldsHost.className = "callout-enhance-layout-settings__fields";

    const applyField = (varName: string, value: string) => {
        layout = { ...layout, [varName]: value };
        onChange(layout);
        refreshPreview();
        refreshPresetActionStates();
    };

    CALLOUT_LAYOUT_FIELD_GROUPS.forEach((groupName) => {
        const groupFields = CALLOUT_LAYOUT_FIELDS.filter((field) => field.group === groupName);
        if (groupFields.length === 0) return;

        const section = document.createElement("section");
        section.className = "callout-enhance-layout-settings__group";

        const groupTitle = document.createElement("div");
        groupTitle.className = "b3-label__text callout-enhance-layout-settings__group-title";
        groupTitle.textContent = layoutGroupLabel(groupName);
        section.appendChild(groupTitle);

        const grid = document.createElement("div");
        grid.className = "callout-enhance-layout-settings__grid";

        groupFields.forEach((field) => {
            const row = document.createElement("label");
            row.className = "callout-enhance-layout-settings__field";

            const label = document.createElement("span");
            label.className = "callout-enhance-layout-settings__field-label";
            label.textContent = layoutFieldLabel(field.varName, field.label);

            const control = createLayoutFieldInput(
                field,
                layout[field.varName] || DEFAULT_CALLOUT_LAYOUT[field.varName] || field.defaultValue,
                (value) => applyField(field.varName, value),
            );

            if (field.unit && field.kind !== "select" && field.kind !== "text" && !fieldUsesSlider(field)) {
                const unit = document.createElement("span");
                unit.className = "callout-enhance-layout-settings__unit";
                unit.textContent = field.kind === "percent" ? "%" : field.kind === "time" ? "ms" : (field.unit || "");
                const controlWrap = document.createElement("div");
                controlWrap.className = "fn__flex callout-enhance-layout-settings__control-wrap";
                controlWrap.style.alignItems = "center";
                controlWrap.style.gap = "6px";
                controlWrap.append(control, unit);
                row.append(label, controlWrap);
            } else {
                row.append(label, control);
            }

            grid.appendChild(row);
        });

        section.appendChild(grid);
        fieldsHost.appendChild(section);
    });

    fieldsScroll.appendChild(fieldsHost);
    wrapper.append(sticky, fieldsScroll);
    host.appendChild(wrapper);
    requestAnimationFrame(() => {
        fieldsScroll.scrollTop = options.fieldsScrollTop || 0;
    });
}
