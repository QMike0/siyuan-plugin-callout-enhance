/**
 * CRUD operations for callout type entries and their tombstone list.
 * Pure functions: input state → output state (no I/O).
 */

import {
    appendPastLabel,
    CalloutTypeItem,
    canonicalCalloutKey,
    dedupeCalloutKeysCI,
    equalsCalloutKeyCI,
    normalizeCalloutLabel,
    normalizePastLabels,
    removePastLabelCI,
} from "./callout_types";
import { CalloutEnhanceSettings, normalizeCalloutSettings } from "./settings";

export type CalloutTypesState = {
    callouts: CalloutTypeItem[];
    calloutTombstone: string[];
};

export function getCalloutTypeKey(item: Pick<CalloutTypeItem, "id" | "label" | "keywords">) {
    return item.id || item.label || item.keywords?.[0] || "";
}

export function reindexCalloutOrders(callouts: CalloutTypeItem[]): CalloutTypeItem[] {
    return callouts.map((item, index) => ({ ...item, order: index }));
}

export function reorderCalloutTypes(
    callouts: CalloutTypeItem[],
    from: number,
    to: number,
): CalloutTypeItem[] | null {
    if (from === to || from < 0 || to < 0 || from >= callouts.length || to >= callouts.length) {
        return null;
    }
    const next = [...callouts];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    return reindexCalloutOrders(next);
}

export function setCalloutTypeEnabled(
    callouts: CalloutTypeItem[],
    index: number,
    enabled: boolean,
): CalloutTypeItem[] | null {
    if (index < 0 || index >= callouts.length) return null;
    const next = [...callouts];
    next[index] = { ...next[index], enabled, order: index };
    return next;
}

export function createCalloutTypeDraft(
    callouts: CalloutTypeItem[],
    overrides: Partial<CalloutTypeItem> = {},
): { callouts: CalloutTypeItem[]; index: number; item: CalloutTypeItem } {
    const item: CalloutTypeItem = {
        id: `callout-${Date.now()}`,
        label: "",
        keywords: [],
        pastLabels: [],
        icon: "",
        color: "",
        enabled: true,
        order: callouts.length,
        ...overrides,
    };
    const next = reindexCalloutOrders([...callouts, item]);
    return { callouts: next, index: next.length - 1, item: next[next.length - 1] };
}

export function updateCalloutTypeAtIndex(
    callouts: CalloutTypeItem[],
    index: number,
    item: CalloutTypeItem,
): CalloutTypeItem[] | null {
    if (index < 0 || index >= callouts.length) return null;
    const next = [...callouts];
    next[index] = { ...item, order: index };
    return next;
}

/** Labels to record in the tombstone when a type is deleted (not keywords). */
export function collectTombstoneLabelsFromType(
    item: Pick<CalloutTypeItem, "label" | "pastLabels">,
): string[] {
    return dedupeCalloutKeysCI([
        item.label,
        ...(item.pastLabels || []),
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

/** Apply label rename rules on confirm (past label append/remove; built-in unchanged). */
export function applyCalloutLabelConfirm(
    item: CalloutTypeItem,
    savedLabelRaw: string,
    labelLocked: boolean,
): CalloutTypeItem {
    const savedLabel = normalizeCalloutLabel(savedLabelRaw);
    const oldLabel = item.label;
    let pastLabels = [...(item.pastLabels || [])];

    if (!labelLocked && oldLabel && !equalsCalloutKeyCI(oldLabel, savedLabel)) {
        pastLabels = appendPastLabel(pastLabels, oldLabel);
    }
    pastLabels = removePastLabelCI(pastLabels, savedLabel);
    pastLabels = normalizePastLabels(pastLabels, savedLabel);

    return {
        ...item,
        label: savedLabel,
        pastLabels: labelLocked ? [] : pastLabels,
    };
}

export type FinalizeCalloutTypeSavePatch = Partial<Pick<CalloutTypeItem, "keywords" | "icon" | "color">>;

export function finalizeCalloutTypeSave(
    item: CalloutTypeItem,
    patch: FinalizeCalloutTypeSavePatch,
    savedLabelRaw: string,
    labelLocked: boolean,
): CalloutTypeItem {
    const withLabel = applyCalloutLabelConfirm(item, savedLabelRaw, labelLocked);
    return {
        ...withLabel,
        keywords: patch.keywords ?? withLabel.keywords,
        icon: patch.icon ?? withLabel.icon,
        color: patch.color ?? withLabel.color,
    };
}

export function deleteCalloutTypeAtIndex(
    state: CalloutTypesState,
    index: number,
): CalloutTypesState | null {
    if (index < 0 || index >= state.callouts.length) return null;
    const item = state.callouts[index];
    return {
        callouts: reindexCalloutOrders(state.callouts.filter((_, i) => i !== index)),
        calloutTombstone: mergeCalloutTombstone(
            state.calloutTombstone,
            collectTombstoneLabelsFromType(item),
        ),
    };
}

export function reclaimTombstoneLabel(tombstone: string[], label: string): string[] {
    return removeCalloutTombstoneKeys(tombstone, [label]);
}

/** Normalize callouts + tombstone against full settings context (same as settings-panel persist). */
export function normalizeCalloutTypesSlice(
    state: CalloutTypesState,
    settingsContext: Partial<CalloutEnhanceSettings>,
): CalloutTypesState {
    const next = normalizeCalloutSettings({
        ...settingsContext,
        callouts: state.callouts,
        calloutTombstone: state.calloutTombstone,
    });
    return {
        callouts: next.callouts,
        calloutTombstone: [...(next.calloutTombstone || [])],
    };
}

export function calloutTypesStateFromSettings(settings: Partial<CalloutEnhanceSettings>): CalloutTypesState {
    const normalized = normalizeCalloutSettings(settings);
    return {
        callouts: normalized.callouts.map((item) => ({ ...item })),
        calloutTombstone: [...(normalized.calloutTombstone || [])],
    };
}
