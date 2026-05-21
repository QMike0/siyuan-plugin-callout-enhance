import {
    CalloutTypeItem,
    DEFAULT_CALLOUT_TYPES,
    formatCalloutTitleFromLabel,
    normalizeCalloutKeywords,
    normalizeCalloutLabel,
} from "./callout_types";
import { CalloutLayoutSettings, normalizeCalloutLayout } from "./callout_layout_vars";

export type CalloutTypeSettings = CalloutTypeItem;

export type CalloutAppearancePreset = {
    id: string;
    name: string;
    layout: CalloutLayoutSettings;
};

export type CalloutEnhanceSettings = {
    schemaVersion: number;
    callouts: CalloutTypeSettings[];
    layout?: CalloutLayoutSettings;
    appearancePresets?: CalloutAppearancePreset[];
    activeAppearancePresetId?: string;
    debugLogEnabled?: boolean;
};

export const SETTINGS_SCHEMA_VERSION = 5;
export const DEFAULT_APPEARANCE_PRESET_ID = "default";
export const DEFAULT_APPEARANCE_PRESET_NAME = "Default";

function getBuiltinDefaultAppearanceLayout(): CalloutLayoutSettings {
    return normalizeCalloutLayout();
}

function fixDefaultAppearancePreset(preset: CalloutAppearancePreset): CalloutAppearancePreset {
    if (preset.id !== DEFAULT_APPEARANCE_PRESET_ID) return preset;
    return {
        id: DEFAULT_APPEARANCE_PRESET_ID,
        name: DEFAULT_APPEARANCE_PRESET_NAME,
        layout: getBuiltinDefaultAppearanceLayout(),
    };
}

function ensureDefaultAppearancePreset(presets: CalloutAppearancePreset[]): CalloutAppearancePreset[] {
    const others = presets
        .filter((item) => item.id !== DEFAULT_APPEARANCE_PRESET_ID)
        .map((item) => ({
            ...item,
            layout: normalizeCalloutLayout(item.layout),
        }));
    return [fixDefaultAppearancePreset({
        id: DEFAULT_APPEARANCE_PRESET_ID,
        name: DEFAULT_APPEARANCE_PRESET_NAME,
        layout: getBuiltinDefaultAppearanceLayout(),
    }), ...others];
}

function normalizeColor(color: string) {
    return (color || "").trim();
}

function makeId(label: string, fallbackIndex: number) {
    const raw = normalizeCalloutLabel(label);
    if (raw) return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    return `callout-${fallbackIndex + 1}`;
}

function makePresetId(name: string, existingIds: string[]) {
    const base = (name || "preset").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "preset";
    let id = base;
    let index = 1;
    while (existingIds.includes(id)) {
        id = `${base}-${index++}`;
    }
    return id;
}

type LegacyCalloutTypeRaw = Partial<CalloutTypeSettings> & {
    /** Pre-v5 subtype field; migrated into `label`. */
    keyword?: string;
};

function migrateLegacyCalloutFields(
    source: LegacyCalloutTypeRaw,
    index: number,
    defaults: CalloutTypeSettings[],
): Partial<CalloutTypeSettings> {
    if (Array.isArray(source.keywords)) {
        const { keyword: _legacyKeyword, ...rest } = source;
        return rest;
    }

    const oldSubtype = typeof source.keyword === "string" ? source.keyword.trim() : "";
    const oldDisplay = typeof source.label === "string" ? source.label.trim() : "";
    const defaultItem = defaults[index];

    if (oldSubtype) {
        const keywords = normalizeCalloutKeywords(
            oldDisplay && oldDisplay.toUpperCase() !== oldSubtype.toUpperCase() ? oldDisplay : "",
            oldDisplay || formatCalloutTitleFromLabel(oldSubtype) || oldSubtype,
        );
        const { keyword: _legacyKeyword, ...rest } = source;
        return {
            ...rest,
            label: oldSubtype || defaultItem?.label || "",
            keywords: keywords.length ? keywords : normalizeCalloutKeywords("", defaultItem?.keywords?.[0] || oldSubtype),
        };
    }

    return {
        ...source,
        label: oldDisplay || defaultItem?.label || "",
        keywords: normalizeCalloutKeywords(undefined, oldDisplay || defaultItem?.keywords?.[0] || ""),
    };
}

function normalizeType(
    item: LegacyCalloutTypeRaw | null | undefined,
    index: number,
    defaults: CalloutTypeSettings[],
): CalloutTypeSettings {
    const source = migrateLegacyCalloutFields(item ?? {}, index, defaults);
    const defaultItem = defaults[index];
    const label = normalizeCalloutLabel(source.label || defaultItem?.label || "");
    const keywords = normalizeCalloutKeywords(
        source.keywords,
        defaultItem?.keywords?.[0] || formatCalloutTitleFromLabel(label) || label,
    );
    const icon = (source.icon || defaultItem?.icon || "").trim();
    const color = normalizeColor(source.color || defaultItem?.color || "");
    return {
        id: (source.id || makeId(label, index)).trim(),
        label,
        keywords,
        icon,
        color,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
        enabled: source.enabled !== false,
    };
}

function normalizeAppearancePresets(
    raw: CalloutAppearancePreset[] | undefined,
): CalloutAppearancePreset[] {
    const rawList = Array.isArray(raw) ? raw : [];
    const usedIds: string[] = [DEFAULT_APPEARANCE_PRESET_ID];
    const presets: CalloutAppearancePreset[] = rawList
        .filter((item) => item?.id !== DEFAULT_APPEARANCE_PRESET_ID)
        .map((item, index) => {
            const name = (item?.name || "").trim() || `Preset ${index + 1}`;
            const id = (item?.id || "").trim() || makePresetId(name, usedIds);
            usedIds.push(id);
            return {
                id,
                name,
                layout: normalizeCalloutLayout(item?.layout),
            };
        })
        .filter((item) => item.name);

    return ensureDefaultAppearancePreset(presets);
}

export function createDefaultCalloutSettings(): CalloutEnhanceSettings {
    const layout = normalizeCalloutLayout();
    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        callouts: DEFAULT_CALLOUT_TYPES.map((item, index) => ({
            ...item,
            id: makeId(item.label, index),
            order: index,
        })),
        layout,
        appearancePresets: ensureDefaultAppearancePreset([]),
        activeAppearancePresetId: DEFAULT_APPEARANCE_PRESET_ID,
        debugLogEnabled: false,
    };
}

export function normalizeCalloutSettings(raw?: Partial<CalloutEnhanceSettings> | null): CalloutEnhanceSettings {
    const defaults = createDefaultCalloutSettings();
    const rawList = Array.isArray(raw?.callouts) ? raw.callouts : [];
    const callouts = rawList.length > 0 ? rawList : defaults.callouts;

    const normalized = callouts.map((item, index) => normalizeType(item, index, defaults.callouts));

    normalized.sort((a, b) => a.order - b.order);
    normalized.forEach((item, index) => {
        item.order = index;
        if (!item.id) item.id = makeId(item.label || item.keywords[0] || "", index);
        // Label is the canonical tag; only fall back to a sole keyword when label is missing.
        if (!item.label && item.keywords.length === 1) {
            item.label = item.keywords[0];
        }
        if (!item.keywords.length) {
            item.keywords = normalizeCalloutKeywords("", formatCalloutTitleFromLabel(item.label) || item.label);
        }
    });

    const layoutFromRaw = raw?.layout ? normalizeCalloutLayout(raw.layout) : null;
    const presets = normalizeAppearancePresets(raw?.appearancePresets);
    const requestedActiveId = (raw?.activeAppearancePresetId || "").trim();
    const activeAppearancePresetId = presets.some((item) => item.id === requestedActiveId)
        ? requestedActiveId
        : DEFAULT_APPEARANCE_PRESET_ID;

    const activePreset = presets.find((item) => item.id === activeAppearancePresetId);
    const layout = layoutFromRaw || normalizeCalloutLayout(activePreset?.layout);

    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        callouts: normalized,
        layout,
        appearancePresets: presets.map((preset) => {
            if (preset.id === DEFAULT_APPEARANCE_PRESET_ID) {
                return fixDefaultAppearancePreset(preset);
            }
            if (preset.id === activeAppearancePresetId) {
                return { ...preset, layout };
            }
            return preset;
        }),
        activeAppearancePresetId,
        debugLogEnabled: typeof raw?.debugLogEnabled === "boolean"
            ? raw.debugLogEnabled
            : defaults.debugLogEnabled,
    };
}

export function getResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    const normalized = normalizeCalloutSettings(settings);
    return normalized.callouts.filter((item) => item.enabled);
}

export function getDefaultCalloutSettings() {
    return createDefaultCalloutSettings();
}

export function makeAppearancePresetId(name: string, existingIds: string[]) {
    return makePresetId(name, existingIds);
}

export function isDefaultAppearancePreset(presetId: string) {
    return presetId === DEFAULT_APPEARANCE_PRESET_ID;
}

export function getDefaultAppearancePresetLayout() {
    return getBuiltinDefaultAppearanceLayout();
}
