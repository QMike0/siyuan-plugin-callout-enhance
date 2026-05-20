import { CalloutTypeItem, DEFAULT_CALLOUT_TYPES } from "./callout_types";

export type CalloutTypeSettings = CalloutTypeItem;

export type CalloutEnhanceSettings = {
    schemaVersion: number;
    callouts: CalloutTypeSettings[];
};

export const SETTINGS_SCHEMA_VERSION = 2;

function normalizeKeyword(keyword: string) {
    return (keyword || "").trim();
}

function normalizeColor(color: string) {
    return (color || "").trim();
}

function makeId(keyword: string, fallbackIndex: number) {
    const raw = normalizeKeyword(keyword);
    if (raw) return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    return `callout-${fallbackIndex + 1}`;
}

function normalizeType(item: Partial<CalloutTypeSettings> | null | undefined, index: number, defaults: CalloutTypeSettings[]): CalloutTypeSettings {
    const source = (item ?? {}) as Partial<CalloutTypeSettings>;
    const keyword = normalizeKeyword(source.keyword || defaults[index]?.keyword || "");
    const label = (source.label || keyword || defaults[index]?.label || "").trim();
    const icon = (source.icon || defaults[index]?.icon || "").trim();
    const color = normalizeColor(source.color || defaults[index]?.color || "");
    return {
        id: (source.id || makeId(keyword || label, index)).trim(),
        keyword,
        label,
        icon,
        color,
        order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
        enabled: source.enabled !== false,
    };
}

export function createDefaultCalloutSettings(): CalloutEnhanceSettings {
    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        callouts: DEFAULT_CALLOUT_TYPES.map((item, index) => ({
            ...item,
            id: makeId(item.keyword, index),
            order: index,
        })),
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
        if (!item.id) item.id = makeId(item.keyword || item.label, index);
        if (!item.keyword) item.keyword = item.label;
        if (!item.label) item.label = item.keyword;
    });

    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        callouts: normalized,
    };
}

export function getResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    const normalized = normalizeCalloutSettings(settings);
    return normalized.callouts.filter((item) => item.enabled);
}

export function getDefaultCalloutSettings() {
    return createDefaultCalloutSettings();
}
