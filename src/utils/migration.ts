import {
    assertCleanupWritable,
    batchUpdateBlock,
    closeNotebook,
    countCalloutsBySubtypes,
    flushTransaction,
    getBlockDOM,
    isUserGuideNotebook,
    lsNotebooks,
    openNotebook,
    querySQL,
    waitNotebookIndexed,
} from "../core/cl_api";
import {
    canonicalCalloutKey,
    equalsCalloutKeyCI,
    normalizeCalloutLabel,
    removePastLabelCI,
} from "./callout_types";
import { removeCalloutTombstoneKeys } from "./callout_type_crud";
import {
    CalloutEnhanceSettings,
    normalizeCalloutSettings,
    resolveCalloutTypeBySubtype,
} from "./settings";
import { t } from "./i18n";

const BATCH_SIZE = 50;
const FLUSH_DELAY_MS = 50;
const NOTE_LABEL = "NOTE";

export type CleanupProgress = {
    phase: "snapshot" | "prepare" | "open" | "index" | "migrate-a" | "migrate-b" | "close" | "save" | "done";
    message: string;
    /** 0–100 when determinate */
    percent?: number;
    indeterminate?: boolean;
};

export type CleanupError = {
    id: string;
    reason: string;
    phase?: "a" | "b" | "index";
    fromLabel?: string;
    toLabel?: string;
};

export type CleanupResult = {
    processed: number;
    succeeded: number;
    failed: number;
    aborted: boolean;
    /** True when any temporarily opened notebook failed to finish indexing in time. */
    indexTimedOut: boolean;
    /** True when no past labels or tombstones remain after this run. */
    metadataCleared: boolean;
    /** True when some legacy entries were removed but others remain. */
    metadataPartiallyCleared: boolean;
    errors: CleanupError[];
};

export type ClearLegacyCalloutMetadataOptions = {
    getSettings: () => CalloutEnhanceSettings;
    saveSettings: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
    onStylesUpdate?: () => void;
};

export async function clearLegacyCalloutMetadata(options: ClearLegacyCalloutMetadataOptions) {
    const { getSettings, saveSettings, onStylesUpdate } = options;
    const latest = normalizeCalloutSettings(getSettings());
    await saveSettings({
        callouts: latest.callouts.map((item) => ({
            ...item,
            pastLabels: [],
        })),
        calloutTombstone: [],
    });
    onStylesUpdate?.();
}

export type RunCleanupOptions = {
    settings: CalloutEnhanceSettings;
    getSettings: () => CalloutEnhanceSettings;
    saveSettings: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
    signal: AbortSignal;
    onProgress: (progress: CleanupProgress) => void;
    onStylesUpdate?: () => void;
    /** When true, clear all pastLabels/tombstone even if some blocks failed or indexing timed out. */
    forceClearMetadata?: boolean;
    /** Shifts cleanup phase percents (e.g. 8 when a snapshot phase occupies 0–8). */
    progressOffset?: number;
    /** Migrate-a/b end percent before close/save (default 98). */
    migrateEndPercent?: number;
};

const CLEANUP_MIGRATE_END_DEFAULT = 98;
const CLEANUP_CLOSE_END = 100;

function resolveCleanupProgressScale(options: RunCleanupOptions) {
    const offset = Math.max(0, options.progressOffset ?? 0);
    const migrateEnd = options.migrateEndPercent ?? CLEANUP_MIGRATE_END_DEFAULT;
    return {
        offset,
        prepareStart: offset,
        prepareEnd: offset + 5,
        openStart: offset + 5,
        openEnd: offset + 15,
        indexStart: offset + 15,
        indexEnd: offset + 25,
        migrateStart: offset + 25,
        migrateEnd,
        closeStart: migrateEnd,
        closeEnd: CLEANUP_CLOSE_END,
    };
}

type SubtypeMigration = {
    phase: "a" | "b";
    fromKey: string;
    fromLabel: string;
    toLabel: string;
};

type MappingMigrationOutcome = {
    success: boolean;
};

function escapeSqlLiteral(value: string) {
    return value.replace(/'/g, "''");
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function throwIfAborted(signal: AbortSignal) {
    if (signal.aborted) {
        throw new DOMException("Cleanup aborted", "AbortError");
    }
}

function mapProgress(
    onProgress: RunCleanupOptions["onProgress"],
    phase: CleanupProgress["phase"],
    startPercent: number,
    endPercent: number,
    ratio: number,
    message: string,
    indeterminate = false,
) {
    const span = endPercent - startPercent;
    const percent = indeterminate
        ? undefined
        : Math.min(endPercent, Math.max(startPercent, startPercent + span * Math.max(0, Math.min(1, ratio))));
    onProgress({
        phase,
        message,
        percent,
        indeterminate,
    });
}

function pushCleanupError(
    result: CleanupResult,
    entry: CleanupError,
) {
    result.errors.push(entry);
}

function pushMigrationError(
    result: CleanupResult,
    migration: SubtypeMigration,
    id: string,
    reason: string,
) {
    pushCleanupError(result, {
        id,
        reason,
        phase: migration.phase,
        fromLabel: migration.fromLabel,
        toLabel: migration.toLabel,
    });
}

function buildPhaseAMigrations(settings: CalloutEnhanceSettings): SubtypeMigration[] {
    const normalized = normalizeCalloutSettings(settings);
    const migrations: SubtypeMigration[] = [];
    const seen = new Set<string>();

    for (const item of normalized.callouts) {
        const toLabel = normalizeCalloutLabel(item.label);
        const toKey = canonicalCalloutKey(toLabel);
        if (!toKey) continue;

        for (const pastLabel of item.pastLabels || []) {
            const fromKey = canonicalCalloutKey(pastLabel);
            if (!fromKey || fromKey === toKey || seen.has(fromKey)) continue;
            seen.add(fromKey);
            migrations.push({
                phase: "a",
                fromKey,
                fromLabel: normalizeCalloutLabel(pastLabel),
                toLabel,
            });
        }
    }
    return migrations;
}

function buildPhaseBMigrations(settings: CalloutEnhanceSettings): SubtypeMigration[] {
    const normalized = normalizeCalloutSettings(settings);
    const migrations: SubtypeMigration[] = [];
    const seen = new Set<string>();
    const noteKey = canonicalCalloutKey(NOTE_LABEL);

    for (const tombstone of normalized.calloutTombstone || []) {
        const fromKey = canonicalCalloutKey(tombstone);
        if (!fromKey || fromKey === noteKey || seen.has(fromKey)) continue;
        if (resolveCalloutTypeBySubtype(normalized, tombstone)) continue;
        seen.add(fromKey);
        migrations.push({
            phase: "b",
            fromKey,
            fromLabel: normalizeCalloutLabel(tombstone),
            toLabel: NOTE_LABEL,
        });
    }
    return migrations;
}

function collectReclaimedTombstoneLabels(settings: CalloutEnhanceSettings): string[] {
    const normalized = normalizeCalloutSettings(settings);
    return (normalized.calloutTombstone || []).filter((label) =>
        resolveCalloutTypeBySubtype(normalized, label),
    );
}

function applyPartialLegacyMetadataClear(
    settings: CalloutEnhanceSettings,
    successfulMigrations: SubtypeMigration[],
    reclaimedTombstoneLabels: string[],
) {
    let callouts = settings.callouts.map((item) => ({
        ...item,
        pastLabels: [...(item.pastLabels || [])],
    }));
    let calloutTombstone = [...(settings.calloutTombstone || [])];

    for (const migration of successfulMigrations) {
        if (migration.phase === "a") {
            const targetKey = canonicalCalloutKey(migration.toLabel);
            callouts = callouts.map((item) => {
                if (canonicalCalloutKey(item.label) !== targetKey) return item;
                return {
                    ...item,
                    pastLabels: removePastLabelCI(item.pastLabels || [], migration.fromLabel),
                };
            });
        } else {
            calloutTombstone = removeCalloutTombstoneKeys(calloutTombstone, [migration.fromLabel]);
        }
    }

    for (const label of reclaimedTombstoneLabels) {
        calloutTombstone = removeCalloutTombstoneKeys(calloutTombstone, [label]);
    }

    return { callouts, calloutTombstone };
}

function hasLegacyMetadata(settings: Pick<CalloutEnhanceSettings, "callouts" | "calloutTombstone">) {
    if ((settings.calloutTombstone || []).length > 0) return true;
    return settings.callouts.some((item) => (item.pastLabels || []).length > 0);
}

async function listCalloutBlockIdsBySubtypeKey(subtypeKey: string, limit: number) {
    const stmt = `SELECT id FROM blocks WHERE type = 'callout' AND upper(subtype) = '${escapeSqlLiteral(subtypeKey)}' LIMIT ${limit}`;
    const rows = await querySQL(stmt);
    return rows
        .map((row) => String(row.id ?? ""))
        .filter((id) => !!id);
}

export type MigrateCalloutBlockDomResult = {
    changed: boolean;
    dom: string;
    /** DOM already matches target subtype and markers; SQL index may still list the old subtype. */
    alreadyAtTarget: boolean;
};

export function migrateCalloutBlockDom(
    domHtml: string,
    fromLabel: string,
    toLabel: string,
): MigrateCalloutBlockDomResult {
    const targetSubtype = normalizeCalloutLabel(toLabel).toUpperCase();
    const fromKey = canonicalCalloutKey(fromLabel);
    const targetKey = canonicalCalloutKey(targetSubtype);
    if (!targetKey) {
        return { changed: false, dom: domHtml, alreadyAtTarget: false };
    }

    const template = document.createElement("template");
    template.innerHTML = domHtml.trim();
    const root = template.content.firstElementChild as HTMLElement | null;
    if (!root) {
        return { changed: false, dom: domHtml, alreadyAtTarget: false };
    }

    const callout = root.dataset.type === "NodeCallout"
        ? root
        : root.querySelector<HTMLElement>('[data-type="NodeCallout"]');
    if (!callout) {
        return { changed: false, dom: domHtml, alreadyAtTarget: false };
    }

    let changed = false;
    const currentSubtype = callout.getAttribute("data-subtype") || "";
    if (!equalsCalloutKeyCI(currentSubtype, targetSubtype)) {
        callout.setAttribute("data-subtype", targetSubtype);
        changed = true;
    }

    if (fromKey && fromKey !== targetKey) {
        const markerPattern = new RegExp(`\\[!${escapeRegExp(fromLabel)}\\]`, "gi");
        const nextMarker = `[!${targetSubtype}]`;

        const replaceInElement = (element: HTMLElement) => {
            for (const node of Array.from(element.childNodes)) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || "";
                    markerPattern.lastIndex = 0;
                    if (!markerPattern.test(text)) continue;
                    markerPattern.lastIndex = 0;
                    const nextText = text.replace(markerPattern, nextMarker);
                    if (nextText !== text) {
                        node.textContent = nextText;
                        changed = true;
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    replaceInElement(node as HTMLElement);
                }
            }
        };
        replaceInElement(callout);
    }

    if (!changed) {
        const alreadyAtTarget = equalsCalloutKeyCI(
            callout.getAttribute("data-subtype") || "",
            targetSubtype,
        );
        return { changed: false, dom: domHtml, alreadyAtTarget };
    }
    return { changed: true, dom: root.outerHTML, alreadyAtTarget: false };
}

async function migrateSubtypeMapping(
    migration: SubtypeMigration,
    signal: AbortSignal,
    result: CleanupResult,
    onBatchProgress: (processedInMapping: number, mappingTotal: number) => void,
): Promise<MappingMigrationOutcome> {
    const countResult = await countCalloutsBySubtypes([migration.fromLabel]);
    const mappingTotal = countResult.ok ? countResult.count : 0;
    let mappingProcessed = 0;
    const mappingFailedIds = new Set<string>();
    /** Blocks whose DOM is already at target; re-index was attempted but SQL may still list the old subtype. */
    const sqlStaleResolvedIds = new Set<string>();

    const recordMappingFailure = (blockId: string, reason: string) => {
        if (mappingFailedIds.has(blockId)) return;
        mappingFailedIds.add(blockId);
        result.failed += 1;
        pushMigrationError(result, migration, blockId, reason);
    };

    while (true) {
        throwIfAborted(signal);
        const blockIds = await listCalloutBlockIdsBySubtypeKey(migration.fromKey, BATCH_SIZE);
        if (!blockIds.length) break;

        const updates: { id: string; data: string }[] = [];
        const reindexOnly: { id: string; data: string }[] = [];
        const stagnantIds: string[] = [];

        for (const blockId of blockIds) {
            throwIfAborted(signal);
            result.processed += 1;
            mappingProcessed += 1;
            try {
                const dom = await getBlockDOM(blockId);
                const { changed, dom: nextDom, alreadyAtTarget } = migrateCalloutBlockDom(
                    dom,
                    migration.fromLabel,
                    migration.toLabel,
                );
                if (changed) {
                    updates.push({ id: blockId, data: nextDom });
                    continue;
                }
                if (alreadyAtTarget) {
                    if (sqlStaleResolvedIds.has(blockId)) {
                        result.succeeded += 1;
                        continue;
                    }
                    reindexOnly.push({ id: blockId, data: nextDom });
                    continue;
                }
                stagnantIds.push(blockId);
            } catch (error) {
                recordMappingFailure(
                    blockId,
                    error instanceof Error ? error.message : String(error),
                );
            }
        }

        let madeProgress = false;
        if (updates.length) {
            try {
                await batchUpdateBlock(updates);
                await flushTransaction();
                await sleep(FLUSH_DELAY_MS);
                result.succeeded += updates.length;
                madeProgress = true;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                for (const block of updates) {
                    recordMappingFailure(block.id, reason);
                }
            }
        }

        if (reindexOnly.length) {
            try {
                await batchUpdateBlock(reindexOnly);
                await flushTransaction();
                await sleep(FLUSH_DELAY_MS);
                for (const block of reindexOnly) {
                    sqlStaleResolvedIds.add(block.id);
                    result.succeeded += 1;
                }
                madeProgress = true;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                for (const block of reindexOnly) {
                    recordMappingFailure(block.id, reason);
                }
            }
        }

        if (!madeProgress && stagnantIds.length) {
            const stagnantReason = t("migrateStagnantReason");
            for (const blockId of stagnantIds) {
                recordMappingFailure(blockId, stagnantReason);
            }
            break;
        }

        if (!madeProgress && stagnantIds.length === 0) {
            break;
        }

        onBatchProgress(Math.min(mappingProcessed, mappingTotal), Math.max(mappingTotal, 1));
    }

    return { success: mappingFailedIds.size === 0 };
}

export async function runCleanup(options: RunCleanupOptions): Promise<CleanupResult> {
    const {
        signal,
        onProgress,
        getSettings,
        saveSettings,
        onStylesUpdate,
        forceClearMetadata = false,
    } = options;
    const result: CleanupResult = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        aborted: false,
        indexTimedOut: false,
        metadataCleared: false,
        metadataPartiallyCleared: false,
        errors: [],
    };

    const openedForCleanup: string[] = [];
    let indexTimedOut = false;
    const successfulMigrations: SubtypeMigration[] = [];

    const scale = resolveCleanupProgressScale(options);

    try {
        assertCleanupWritable();
        throwIfAborted(signal);

        mapProgress(onProgress, "prepare", scale.prepareStart, scale.prepareEnd, 1, t("migratePreparing"));
        const notebooks = (await lsNotebooks()).filter((nb) => !isUserGuideNotebook(nb.id));
        const toOpen = notebooks.filter((nb) => nb.closed).map((nb) => nb.id);

        mapProgress(onProgress, "open", scale.openStart, scale.openEnd, 0, t("migrateOpening"));
        for (let i = 0; i < toOpen.length; i += 1) {
            throwIfAborted(signal);
            const notebookId = toOpen[i];
            const openResult = await openNotebook(notebookId);
            if (!openResult?.existed) {
                openedForCleanup.push(notebookId);
            }
            mapProgress(
                onProgress,
                "open",
                scale.openStart,
                scale.openEnd,
                (i + 1) / Math.max(toOpen.length, 1),
                t("migrateOpeningProgress", { current: i + 1, total: toOpen.length }),
            );
        }

        if (openedForCleanup.length) {
            for (let i = 0; i < openedForCleanup.length; i += 1) {
                throwIfAborted(signal);
                const notebookId = openedForCleanup[i];
                mapProgress(
                    onProgress,
                    "index",
                    scale.indexStart,
                    scale.indexEnd,
                    i / openedForCleanup.length,
                    t("migrateIndexing", { current: i + 1, total: openedForCleanup.length }),
                    true,
                );
                const indexed = await waitNotebookIndexed(notebookId);
                if (indexed.timedOut) {
                    indexTimedOut = true;
                    pushCleanupError(result, {
                        id: notebookId,
                        reason: t("migrateTimeoutReason"),
                        phase: "index",
                    });
                }
            }
        }
        mapProgress(onProgress, "index", scale.indexStart, scale.indexEnd, 1, t("migrateIndexingComplete"));

        const settings = normalizeCalloutSettings(getSettings());
        const phaseA = buildPhaseAMigrations(settings);
        const phaseB = buildPhaseBMigrations(settings);

        let totalBlocks = 0;
        for (const migration of [...phaseA, ...phaseB]) {
            const countResult = await countCalloutsBySubtypes([migration.fromLabel]);
            if (countResult.ok) {
                totalBlocks += countResult.count;
            }
        }
        const reportMigrationProgress = (
            migration: SubtypeMigration,
            processedInMapping: number,
            mappingTotal: number,
        ) => {
            const label = migration.phase === "a" ? t("migratePhaseA") : t("migratePhaseB");
            const migrateRatio = totalBlocks > 0
                ? Math.min(1, result.processed / totalBlocks)
                : 1;
            mapProgress(
                onProgress,
                migration.phase === "a" ? "migrate-a" : "migrate-b",
                scale.migrateStart,
                scale.migrateEnd,
                migrateRatio,
                t("migratePhase", {
                    phase: `${label}: ${migration.fromLabel} -> ${migration.toLabel}`,
                    current: Math.min(processedInMapping, mappingTotal),
                    total: mappingTotal,
                }),
            );
        };

        for (const migration of phaseA) {
            throwIfAborted(signal);
            const countResult = await countCalloutsBySubtypes([migration.fromLabel]);
            const mappingTotal = countResult.ok ? countResult.count : 0;
            const outcome = await migrateSubtypeMapping(migration, signal, result, (processedInMapping, perMappingTotal) => {
                reportMigrationProgress(migration, processedInMapping, perMappingTotal);
            });
            if (outcome.success) successfulMigrations.push(migration);
            reportMigrationProgress(migration, mappingTotal, mappingTotal || 1);
        }

        for (const migration of phaseB) {
            throwIfAborted(signal);
            const countResult = await countCalloutsBySubtypes([migration.fromLabel]);
            const mappingTotal = countResult.ok ? countResult.count : 0;
            const outcome = await migrateSubtypeMapping(migration, signal, result, (processedInMapping, perMappingTotal) => {
                reportMigrationProgress(migration, processedInMapping, perMappingTotal);
            });
            if (outcome.success) successfulMigrations.push(migration);
            reportMigrationProgress(migration, mappingTotal, mappingTotal || 1);
        }

        if (!phaseA.length && !phaseB.length) {
            mapProgress(onProgress, "migrate-a", scale.migrateStart, scale.migrateEnd, 1, t("migrateNoBlocks"));
        }

        mapProgress(onProgress, "close", scale.closeStart, scale.closeEnd, 0, t("migrateClosing"));
        for (let i = 0; i < openedForCleanup.length; i += 1) {
            throwIfAborted(signal);
            await closeNotebook(openedForCleanup[i]);
            mapProgress(
                onProgress,
                "close",
                scale.closeStart,
                scale.closeEnd,
                (i + 1) / Math.max(openedForCleanup.length, 1),
                t("migrateClosingProgress", { current: i + 1, total: openedForCleanup.length }),
            );
        }

        mapProgress(onProgress, "save", scale.closeStart, scale.closeEnd, 0.5, t("migrateSaving"));
        result.indexTimedOut = indexTimedOut;

        if (forceClearMetadata) {
            await clearLegacyCalloutMetadata({ getSettings, saveSettings, onStylesUpdate });
            result.metadataCleared = true;
        } else if (!indexTimedOut) {
            const latest = normalizeCalloutSettings(getSettings());
            const reclaimedTombstones = collectReclaimedTombstoneLabels(latest);
            const partial = applyPartialLegacyMetadataClear(
                latest,
                successfulMigrations,
                reclaimedTombstones,
            );
            const metadataChanged = successfulMigrations.length > 0 || reclaimedTombstones.length > 0;
            if (metadataChanged) {
                await saveSettings({
                    callouts: partial.callouts,
                    calloutTombstone: partial.calloutTombstone,
                });
                onStylesUpdate?.();
            }
            result.metadataCleared = !hasLegacyMetadata(partial);
            result.metadataPartiallyCleared = metadataChanged && !result.metadataCleared;
        }

        mapProgress(onProgress, "done", 100, 100, 1, t("migrateDone"));
        return result;
    } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            result.aborted = true;
            try {
                for (const notebookId of openedForCleanup) {
                    await closeNotebook(notebookId);
                }
            } catch {
                // ignore close errors on abort
            }
            return result;
        }
        throw error;
    }
}
