/**
 * Settings schema version chain.
 *
 * Released versions (git history):
 *   v2 — callouts with legacy `keyword` field
 *   v5 — label + keywords[], layout, appearance presets, debugLogEnabled
 *   v6 — calloutTombstone, pastLabels (formerly historicalLabels)
 *
 * v3/v4 were never shipped; configs reporting those versions are upgraded via v2→v5.
 */

import {
    CalloutTypeItem,
    DEFAULT_CALLOUT_TYPES,
    formatCalloutTitleFromLabel,
    normalizeCalloutKeywords,
    normalizeCalloutLabel,
    normalizePastLabels,
} from "./callout_types";
import { normalizeCalloutLayout } from "./callout_layout_vars";

/** Must stay in sync with `settings.ts` SETTINGS_SCHEMA_VERSION. */
export const SETTINGS_SCHEMA_VERSION = 6;

/** Lowest schema version this plugin has ever persisted. */
export const MIN_SETTINGS_SCHEMA_VERSION = 2;

const DEFAULT_APPEARANCE_PRESET_ID = "default";

type UnknownRecord = Record<string, unknown>;

type LegacyCalloutRaw = UnknownRecord & {
    keyword?: string;
    label?: string;
    keywords?: string[];
    historicalLabels?: string[];
    pastLabels?: string[];
};

export type MigratedSettingsPayload = {
    schemaVersion?: number;
    callouts?: unknown[];
    calloutTombstone?: string[];
    layout?: Record<string, string>;
    appearancePresets?: unknown[];
    activeAppearancePresetId?: string;
    debugLogEnabled?: boolean;
};

export type SettingsMigrationResult = {
    settings: MigratedSettingsPayload;
    migrated: boolean;
    fromVersion: number;
    toVersion: number;
};

function isRecord(value: unknown): value is UnknownRecord {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneRaw<T>(value: T): T {
    if (value === null || value === undefined) return value;
    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        return value;
    }
}

function coerceSchemaVersion(raw: UnknownRecord | null | undefined): number {
    if (!raw) return SETTINGS_SCHEMA_VERSION;

    const parsed = Number(raw.schemaVersion);
    if (Number.isFinite(parsed) && parsed >= 1) {
        return Math.floor(parsed);
    }

    if (Array.isArray(raw.callouts) && raw.callouts.length > 0) {
        return MIN_SETTINGS_SCHEMA_VERSION;
    }

    return SETTINGS_SCHEMA_VERSION;
}

function migrateLegacyCalloutFields(
    source: LegacyCalloutRaw,
    index: number,
    defaults: CalloutTypeItem[],
): LegacyCalloutRaw {
    if (Array.isArray(source.keywords)) {
        const next = { ...source };
        delete next.keyword;
        return next;
    }

    const oldSubtype = typeof source.keyword === "string" ? source.keyword.trim() : "";
    const oldDisplay = typeof source.label === "string" ? source.label.trim() : "";
    const defaultItem = defaults[index];
    const next: LegacyCalloutRaw = { ...source };
    delete next.keyword;

    if (oldSubtype) {
        const keywords = normalizeCalloutKeywords(
            oldDisplay && oldDisplay.toUpperCase() !== oldSubtype.toUpperCase() ? oldDisplay : "",
            oldDisplay || formatCalloutTitleFromLabel(oldSubtype) || oldSubtype,
        );
        next.label = oldSubtype || defaultItem?.label || "";
        next.keywords = keywords.length
            ? keywords
            : normalizeCalloutKeywords("", defaultItem?.keywords?.[0] || oldSubtype);
        return next;
    }

    next.label = oldDisplay || defaultItem?.label || "";
    next.keywords = normalizeCalloutKeywords(
        undefined,
        oldDisplay || defaultItem?.keywords?.[0] || "",
    );
    return next;
}

function migrateCalloutList(rawCallouts: unknown): LegacyCalloutRaw[] {
    const defaults = DEFAULT_CALLOUT_TYPES;
    const list = Array.isArray(rawCallouts) ? rawCallouts : [];
    return list.map((item, index) => {
        const source = isRecord(item) ? (item as LegacyCalloutRaw) : {};
        const migrated = migrateLegacyCalloutFields(source, index, defaults);
        const label = normalizeCalloutLabel(String(migrated.label || defaults[index]?.label || ""));
        const keywords = normalizeCalloutKeywords(
            migrated.keywords,
            defaults[index]?.keywords?.[0] || formatCalloutTitleFromLabel(label) || label,
        );
        const pastLabels = normalizePastLabels(
            Array.isArray(migrated.pastLabels)
                ? migrated.pastLabels
                : Array.isArray(migrated.historicalLabels)
                    ? migrated.historicalLabels
                    : [],
            label,
        );

        const next: LegacyCalloutRaw = {
            ...migrated,
            label,
            keywords,
            pastLabels,
        };
        delete next.historicalLabels;
        return next;
    });
}

/** v2 (and skipped v3/v4) → v5: label/keywords split, layout, appearance presets. */
export function migrateSettingsV2ToV5(raw: UnknownRecord): UnknownRecord {
    const layout = isRecord(raw.layout) ? raw.layout : normalizeCalloutLayout();
    return {
        ...raw,
        schemaVersion: 5,
        callouts: migrateCalloutList(raw.callouts),
        layout,
        appearancePresets: Array.isArray(raw.appearancePresets) ? raw.appearancePresets : [],
        activeAppearancePresetId: typeof raw.activeAppearancePresetId === "string"
            ? raw.activeAppearancePresetId
            : DEFAULT_APPEARANCE_PRESET_ID,
        debugLogEnabled: typeof raw.debugLogEnabled === "boolean" ? raw.debugLogEnabled : false,
    };
}

/** v5 → v6: tombstone list; ensure pastLabels on each callout type. */
export function migrateSettingsV5ToV6(raw: UnknownRecord): UnknownRecord {
    return {
        ...raw,
        schemaVersion: 6,
        calloutTombstone: Array.isArray(raw.calloutTombstone) ? raw.calloutTombstone : [],
        callouts: migrateCalloutList(raw.callouts),
    };
}

/** v6 configs saved while the field was still named `historicalLabels`. */
export function patchV6HistoricalLabels(raw: UnknownRecord): { raw: UnknownRecord; patched: boolean } {
    if (!Array.isArray(raw.callouts)) {
        return { raw, patched: false };
    }

    let patched = false;
    const callouts = raw.callouts.map((item) => {
        if (!isRecord(item) || !("historicalLabels" in item)) return item;
        patched = true;
        const legacy = item as LegacyCalloutRaw;
        const label = normalizeCalloutLabel(String(legacy.label || ""));
        const pastLabels = normalizePastLabels(
            Array.isArray(legacy.pastLabels) && legacy.pastLabels.length
                ? legacy.pastLabels
                : legacy.historicalLabels,
            label,
        );
        const next: LegacyCalloutRaw = { ...legacy, pastLabels };
        delete next.historicalLabels;
        return next;
    });

    return patched ? { raw: { ...raw, callouts }, patched: true } : { raw, patched: false };
}

/**
 * Upgrade raw persisted settings through the version chain up to SETTINGS_SCHEMA_VERSION.
 * Does not normalize defaults — call `normalizeCalloutSettings` afterward.
 */
export function migrateCalloutSettings(raw?: unknown): SettingsMigrationResult {
    if (!isRecord(raw)) {
        return {
            settings: {},
            migrated: false,
            fromVersion: SETTINGS_SCHEMA_VERSION,
            toVersion: SETTINGS_SCHEMA_VERSION,
        };
    }

    const fromVersion = coerceSchemaVersion(raw);
    let working = cloneRaw(raw);
    let migrated = false;

    if (fromVersion > SETTINGS_SCHEMA_VERSION) {
        working.schemaVersion = SETTINGS_SCHEMA_VERSION;
        migrated = true;
    }

    let version = Math.min(fromVersion, SETTINGS_SCHEMA_VERSION);

    if (version < 5) {
        working = migrateSettingsV2ToV5(working);
        version = 5;
        migrated = true;
    }

    if (version < 6) {
        working = migrateSettingsV5ToV6(working);
        version = 6;
        migrated = true;
    }

    const historicalPatch = patchV6HistoricalLabels(working);
    working = historicalPatch.raw;
    if (historicalPatch.patched) migrated = true;

    if (working.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
        working.schemaVersion = SETTINGS_SCHEMA_VERSION;
        migrated = true;
    }

    return {
        settings: working as MigratedSettingsPayload,
        migrated,
        fromVersion,
        toVersion: SETTINGS_SCHEMA_VERSION,
    };
}

export function getDetectedSchemaVersion(raw?: unknown): number {
    if (!isRecord(raw)) return SETTINGS_SCHEMA_VERSION;
    return coerceSchemaVersion(raw);
}
