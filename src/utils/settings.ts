import {
    CalloutTypeItem,
    dedupeCalloutKeysCI,
    DEFAULT_CALLOUT_TYPES,
    formatCalloutTitleFromLabel,
    isProtectedCalloutType,
    normalizeCalloutKeywords,
    normalizeCalloutLabel,
    normalizePastLabels,
} from "./callout_types";
import { CalloutLayoutSettings, normalizeCalloutLayout } from "./callout_layout_vars";
import {
    migrateCalloutSettings,
    SETTINGS_SCHEMA_VERSION,
    type SettingsMigrationResult,
} from "./settings_schema_migration";

export { SETTINGS_SCHEMA_VERSION, migrateCalloutSettings, type SettingsMigrationResult };
export { getDetectedSchemaVersion, MIN_SETTINGS_SCHEMA_VERSION } from "./settings_schema_migration";

export type CalloutTypeSettings = CalloutTypeItem;

export type CalloutAppearancePreset = {
    id: string;
    name: string;
    layout: CalloutLayoutSettings;
};

export type CalloutEnhanceSettings = {
    schemaVersion: number;
    callouts: CalloutTypeSettings[];
    /** Labels from deleted types (and their past labels); blocks keep old data-subtype. */
    calloutTombstone?: string[];
    layout?: CalloutLayoutSettings;
    appearancePresets?: CalloutAppearancePreset[];
    activeAppearancePresetId?: string;
    debugLogEnabled?: boolean;
};

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

function normalizeType(
    item: Partial<CalloutTypeSettings> | null | undefined,
    index: number,
    defaults: CalloutTypeSettings[],
): CalloutTypeSettings {
    const source = item ?? {};
    const defaultItem = defaults[index];
    const label = normalizeCalloutLabel(source.label || defaultItem?.label || "");
    const keywords = normalizeCalloutKeywords(
        source.keywords,
        defaultItem?.keywords?.[0] || formatCalloutTitleFromLabel(label) || label,
    );
    const icon = (source.icon || defaultItem?.icon || "").trim();
    const color = normalizeColor(source.color || defaultItem?.color || "");
    const draft: CalloutTypeSettings = {
        id: (source.id || makeId(label, index)).trim(),
        label,
        keywords,
        pastLabels: normalizePastLabels(source.pastLabels, label),
        icon,
        color,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
        enabled: source.enabled !== false,
    };
    if (isProtectedCalloutType(draft)) {
        draft.pastLabels = [];
    }
    return draft;
}

function normalizeCalloutTombstone(raw: string[] | undefined) {
    return dedupeCalloutKeysCI(Array.isArray(raw) ? raw : []);
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
        calloutTombstone: [],
        debugLogEnabled: false,
    };
}

export function normalizeCalloutSettings(raw?: Partial<CalloutEnhanceSettings> | null): CalloutEnhanceSettings {
    return prepareCalloutSettings(raw).settings;
}

export function prepareCalloutSettings(raw?: unknown): {
    settings: CalloutEnhanceSettings;
    migrated: boolean;
    fromVersion: number;
} {
    const migration = migrateCalloutSettings(raw);
    return {
        settings: normalizeCalloutSettingsCore(migration.settings as Partial<CalloutEnhanceSettings>),
        migrated: migration.migrated,
        fromVersion: migration.fromVersion,
    };
}

function normalizeCalloutSettingsCore(raw?: Partial<CalloutEnhanceSettings> | null): CalloutEnhanceSettings {
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
        calloutTombstone: normalizeCalloutTombstone(raw?.calloutTombstone),
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

export {
    buildOccupancyMap,
    formatLabelOccupancyError,
    getAllResolvedCalloutTypes,
    getResolvedCalloutTypes,
    resolveCalloutTypeBySubtype,
    validateLabelOccupancy,
    type CalloutLabelOccupancyConflict,
    type CalloutOccupancyEntry,
    type CalloutOccupancySource,
} from "./callout_resolver";

export {
    applyCalloutLabelConfirm,
    collectTombstoneLabelsFromType,
    createCalloutTypeDraft,
    deleteCalloutTypeAtIndex,
    finalizeCalloutTypeSave,
    getCalloutTypeKey,
    mergeCalloutTombstone,
    normalizeCalloutTypesSlice,
    reclaimTombstoneLabel,
    removeCalloutTombstoneKeys,
    reindexCalloutOrders,
    reorderCalloutTypes,
    setCalloutTypeEnabled,
    updateCalloutTypeAtIndex,
    calloutTypesStateFromSettings,
    type CalloutTypesState,
    type FinalizeCalloutTypeSavePatch,
} from "./callout_type_crud";
