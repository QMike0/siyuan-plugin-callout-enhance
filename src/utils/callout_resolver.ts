/**
 * Resolver: normalized settings → runtime views for menus, styles, and subtype lookup.
 */

import {
    CalloutTypeItem,
    canonicalCalloutKey,
    equalsCalloutKeyCI,
    formatCalloutTitleFromLabel,
} from "./callout_types";
import { CalloutEnhanceSettings, normalizeCalloutSettings } from "./settings";
import { t } from "./i18n";

export type CalloutOccupancySource = "label" | "past" | "tombstone";

export type CalloutOccupancyEntry = {
    source: CalloutOccupancySource;
    calloutId?: string;
};

export type CalloutLabelOccupancyConflict = {
    key: string;
    source: CalloutOccupancySource;
    calloutId?: string;
    existingLabel: string;
    ownerLabel?: string;
};

/** All configured callout types (including disabled) for rendering existing blocks. */
export function getAllResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    return normalizeCalloutSettings(settings).callouts;
}

/** Enabled callout types only — for type menu, completion menu, and new insertions. */
export function getResolvedCalloutTypes(settings?: Partial<CalloutEnhanceSettings> | null): CalloutTypeItem[] {
    return getAllResolvedCalloutTypes(settings).filter((item) => item.enabled);
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
        if (item.pastLabels.some((pastLabel) => canonicalCalloutKey(pastLabel) === key)) {
            return item;
        }
    }
    return undefined;
}

export function buildOccupancyMap(settings?: Partial<CalloutEnhanceSettings> | null) {
    const normalized = normalizeCalloutSettings(settings);
    const map = new Map<string, CalloutOccupancyEntry>();

    for (const item of normalized.callouts) {
        const labelKey = canonicalCalloutKey(item.label);
        if (labelKey) {
            map.set(labelKey, { source: "label", calloutId: item.id });
        }
        for (const pastLabel of item.pastLabels) {
            const pastKey = canonicalCalloutKey(pastLabel);
            if (!pastKey || map.has(pastKey)) continue;
            map.set(pastKey, { source: "past", calloutId: item.id });
        }
    }

    for (const tombstoneLabel of normalized.calloutTombstone || []) {
        const tombstoneKey = canonicalCalloutKey(tombstoneLabel);
        if (!tombstoneKey || map.has(tombstoneKey)) continue;
        map.set(tombstoneKey, { source: "tombstone" });
    }

    return map;
}

function formatOccupancyConflictMessage(conflict: CalloutLabelOccupancyConflict, enteredLabel: string) {
    const entered = (enteredLabel || "").trim();
    if (conflict.source === "tombstone") {
        return t("occupancyTombstone", { entered });
    }
    if (conflict.source === "past") {
        const owner = conflict.ownerLabel?.trim();
        const ownerName = owner
            ? (formatCalloutTitleFromLabel(owner) || owner)
            : t("anotherType");
        return t("occupancyPast", { entered, ownerName, existingLabel: conflict.existingLabel });
    }
    const owner = conflict.ownerLabel?.trim() || conflict.existingLabel;
    return t("occupancyLabel", { entered, owner: formatCalloutTitleFromLabel(owner) || owner });
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
    } else if (entry.source === "past" && owner) {
        existingLabel = owner.pastLabels.find((item) => equalsCalloutKeyCI(item, label)) || label;
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
