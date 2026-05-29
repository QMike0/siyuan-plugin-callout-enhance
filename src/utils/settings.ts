import {
    appendHistoricalLabel,
    CalloutTypeItem,
    canonicalCalloutKey,
    dedupeCalloutKeysCI,
    DEFAULT_CALLOUT_TYPES,
    equalsCalloutKeyCI,
    formatCalloutTitleFromLabel,
    isProtectedCalloutType,
    normalizeCalloutKeywords,
    normalizeCalloutLabel,
    normalizeHistoricalLabels,
    removeHistoricalLabelCI,
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
    /** Labels from deleted types (and their historical labels); blocks keep old data-subtype. */
    calloutTombstone?: string[];
    layout?: CalloutLayoutSettings;
    appearancePresets?: CalloutAppearancePreset[];
    activeAppearancePresetId?: string;
    debugLogEnabled?: boolean;
};

export const SETTINGS_SCHEMA_VERSION = 6;

export type CalloutOccupancySource = "label" | "historical" | "tombstone";

export type CalloutOccupancyEntry = {
    source: CalloutOccupancySource;
    calloutId?: string;
};

export type CalloutLabelOccupancyConflict = {
    key: string;
    source: CalloutOccupancySource;
    calloutId?: string;
    existingLabel: string;
    /** Current label of the conflicting callout type entry (when known). */
    ownerLabel?: string;
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
    const draft: CalloutTypeSettings = {
        id: (source.id || makeId(label, index)).trim(),
        label,
        keywords,
        historicalLabels: normalizeHistoricalLabels(source.historicalLabels, label),
        icon,
        color,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
        enabled: source.enabled !== false,
    };
    if (isProtectedCalloutType(draft)) {
        draft.historicalLabels = [];
    }
    return draft;
}

function normalizeCalloutTombstone(raw: string[] | undefined) {
    return dedupeCalloutKeysCI(Array.isArray(raw) ? raw : []);
}

export function buildOccupancyMap(settings?: Partial<CalloutEnhanceSettings> | null) {
    const normalized = normalizeCalloutSettings(settings);
    const map = new Map<string, CalloutOccupancyEntry>();

    for (const item of normalized.callouts) {
        const labelKey = canonicalCalloutKey(item.label);
        if (labelKey) {
            map.set(labelKey, { source: "label", calloutId: item.id });
        }
        for (const historical of item.historicalLabels) {
            const historicalKey = canonicalCalloutKey(historical);
            if (!historicalKey || map.has(historicalKey)) continue;
            map.set(historicalKey, { source: "historical", calloutId: item.id });
        }
    }

    for (const tombstoneLabel of normalized.calloutTombstone || []) {
        const tombstoneKey = canonicalCalloutKey(tombstoneLabel);
        if (!tombstoneKey || map.has(tombstoneKey)) continue;
        map.set(tombstoneKey, { source: "tombstone" });
    }

    return map;
}

export function resolveCalloutTypeBySubtype(
    settings: Partial<CalloutEnhanceSettings> | null | undefined,
    subtype: string,
): CalloutTypeItem | undefined {
    const key = canonicalCalloutKey(subtype);
    if (!key) return undefined;

    for (const item of getAllResolvedCalloutTypes(settings)) {
        if (canonicalCalloutKey(item.label) === key) return item;
    }
    for (const item of getAllResolvedCalloutTypes(settings)) {
        if (item.historicalLabels.some((historical) => canonicalCalloutKey(historical) === key)) {
            return item;
        }
    }
    return undefined;
}

function formatOccupancyConflictMessage(conflict: CalloutLabelOccupancyConflict, enteredLabel: string) {
    const entered = normalizeCalloutLabel(enteredLabel);
    if (conflict.source === "tombstone") {
        return `Label "${entered}" was used by a deleted callout type. Run "Clean up legacy data" in About, or choose a different name.`;
    }
    if (conflict.source === "historical") {
        const owner = conflict.ownerLabel?.trim();
        const ownerName = owner
            ? (formatCalloutTitleFromLabel(owner) || owner)
            : "another type";
        return `Label "${entered}" conflicts with type "${ownerName}" (historical label "${conflict.existingLabel}").`;
    }
    const owner = conflict.ownerLabel?.trim() || conflict.existingLabel;
    return `Label "${entered}" already exists on type "${formatCalloutTitleFromLabel(owner) || owner}". Please choose a different name.`;
}

export function validateLabelOccupancy(
    label: string,
    selfId: string,
    settings?: Partial<CalloutEnhanceSettings> | null,
): CalloutLabelOccupancyConflict | null {
    const key = canonicalCalloutKey(label);
    if (!key) return null;

    const map = buildOccupancyMap(settings);
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.calloutId && entry.calloutId === selfId) return null;

    const normalized = normalizeCalloutSettings(settings);
    const owner = entry.calloutId
        ? normalized.callouts.find((item) => item.id === entry.calloutId)
        : undefined;
    let existingLabel = label;
    if (entry.source === "label" && owner) {
        existingLabel = owner.label || existingLabel;
    } else if (entry.source === "historical" && owner) {
        existingLabel = owner.historicalLabels.find((item) => equalsCalloutKeyCI(item, label)) || label;
    } else if (entry.source === "tombstone") {
        existingLabel = (normalized.calloutTombstone || []).find((item) => equalsCalloutKeyCI(item, label)) || label;
    }

    return {
        key,
        source: entry.source,
        calloutId: entry.calloutId,
        existingLabel,
        ownerLabel: owner?.label,
    };
}

export function formatLabelOccupancyError(conflict: CalloutLabelOccupancyConflict, enteredLabel: string) {
    return formatOccupancyConflictMessage(conflict, enteredLabel);
}

/** Labels to record in the tombstone when a type is deleted (not keywords). */
export function collectTombstoneLabelsFromType(
    item: Pick<CalloutTypeItem, "label" | "historicalLabels">,
): string[] {
    return dedupeCalloutKeysCI([
        item.label,
        ...(item.historicalLabels || []),
    ].filter(Boolean));
}

export function mergeCalloutTombstone(existing: string[] | undefined, labels: string[]): string[] {
    return dedupeCalloutKeysCI([...(existing || []), ...labels]);
}

export function removeCalloutTombstoneKeys(existing: string[] | undefined, labels: string[]): string[] {
    const removeKeys = new Set(
        labels.map((label) => canonicalCalloutKey(label)).filter(Boolean),
    );
    return (existing || []).filter((label) => !removeKeys.has(canonicalCalloutKey(label)));
}

/** Apply label rename rules on confirm (historical append/remove; built-in unchanged). */
export function applyCalloutLabelConfirm(
    item: CalloutTypeItem,
    savedLabelRaw: string,
    labelLocked: boolean,
): CalloutTypeItem {
    const savedLabel = normalizeCalloutLabel(savedLabelRaw);
    const oldLabel = item.label;
    let historical = [...(item.historicalLabels || [])];

    if (!labelLocked && oldLabel && !equalsCalloutKeyCI(oldLabel, savedLabel)) {
        historical = appendHistoricalLabel(historical, oldLabel);
    }
    historical = removeHistoricalLabelCI(historical, savedLabel);
    historical = normalizeHistoricalLabels(historical, savedLabel);

    return {
        ...item,
        label: savedLabel,
        historicalLabels: labelLocked ? [] : historical,
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
        calloutTombstone: [],
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

/** All configured callout types (including disabled) for rendering existing blocks. */
export function getAllResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    return normalizeCalloutSettings(settings).callouts;
}

/** Enabled callout types only — for type menu, completion menu, and new insertions. */
export function getResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    return getAllResolvedCalloutTypes(settings).filter((item) => item.enabled);
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
