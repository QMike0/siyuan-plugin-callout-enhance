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
} from "./callout_types";
import {
    CalloutEnhanceSettings,
    normalizeCalloutSettings,
    resolveCalloutTypeBySubtype,
} from "./settings";

const BATCH_SIZE = 50;
const FLUSH_DELAY_MS = 50;
const NOTE_LABEL = "NOTE";

export type CleanupProgress = {
    phase: "prepare" | "open" | "index" | "migrate-a" | "migrate-b" | "close" | "save" | "done";
    message: string;
    /** 0–100 when determinate */
    percent?: number;
    indeterminate?: boolean;
};

export type CleanupResult = {
    processed: number;
    succeeded: number;
    failed: number;
    aborted: boolean;
    errors: { id: string; reason: string }[];
};

export type RunCleanupOptions = {
    settings: CalloutEnhanceSettings;
    getSettings: () => CalloutEnhanceSettings;
    saveSettings: (settings: Partial<CalloutEnhanceSettings>) => Promise<void>;
    signal: AbortSignal;
    onProgress: (progress: CleanupProgress) => void;
    onStylesUpdate?: () => void;
};

type SubtypeMigration = {
    phase: "a" | "b";
    fromKey: string;
    fromLabel: string;
    toLabel: string;
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

function buildPhaseAMigrations(settings: CalloutEnhanceSettings): SubtypeMigration[] {
    const normalized = normalizeCalloutSettings(settings);
    const migrations: SubtypeMigration[] = [];
    const seen = new Set<string>();

    for (const item of normalized.callouts) {
        const toLabel = normalizeCalloutLabel(item.label);
        const toKey = canonicalCalloutKey(toLabel);
        if (!toKey) continue;

        for (const historical of item.historicalLabels || []) {
            const fromKey = canonicalCalloutKey(historical);
            if (!fromKey || fromKey === toKey || seen.has(fromKey)) continue;
            seen.add(fromKey);
            migrations.push({
                phase: "a",
                fromKey,
                fromLabel: normalizeCalloutLabel(historical),
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

async function listCalloutBlockIdsBySubtypeKey(subtypeKey: string, limit: number) {
    const stmt = `SELECT id FROM blocks WHERE type = 'callout' AND upper(subtype) = '${escapeSqlLiteral(subtypeKey)}' LIMIT ${limit}`;
    const rows = await querySQL(stmt);
    return rows
        .map((row) => String(row.id ?? ""))
        .filter((id) => !!id);
}

export function migrateCalloutBlockDom(domHtml: string, fromLabel: string, toLabel: string) {
    const targetSubtype = normalizeCalloutLabel(toLabel).toUpperCase();
    const fromKey = canonicalCalloutKey(fromLabel);
    const targetKey = canonicalCalloutKey(targetSubtype);
    if (!targetKey) {
        return { changed: false, dom: domHtml };
    }

    const template = document.createElement("template");
    template.innerHTML = domHtml.trim();
    const root = template.content.firstElementChild as HTMLElement | null;
    if (!root) {
        return { changed: false, dom: domHtml };
    }

    const callout = root.dataset.type === "NodeCallout"
        ? root
        : root.querySelector<HTMLElement>('[data-type="NodeCallout"]');
    if (!callout) {
        return { changed: false, dom: domHtml };
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
        return { changed: false, dom: domHtml };
    }
    return { changed: true, dom: root.outerHTML };
}

async function migrateSubtypeMapping(
    migration: SubtypeMigration,
    signal: AbortSignal,
    result: CleanupResult,
    onBatchProgress: (processedInMapping: number, mappingTotal: number) => void,
) {
    const mappingTotal = await countCalloutsBySubtypes([migration.fromLabel]);
    let mappingProcessed = 0;

    while (true) {
        throwIfAborted(signal);
        const blockIds = await listCalloutBlockIdsBySubtypeKey(migration.fromKey, BATCH_SIZE);
        if (!blockIds.length) break;

        const updates: { id: string; data: string }[] = [];
        for (const blockId of blockIds) {
            throwIfAborted(signal);
            result.processed += 1;
            mappingProcessed += 1;
            try {
                const dom = await getBlockDOM(blockId);
                const { changed, dom: nextDom } = migrateCalloutBlockDom(
                    dom,
                    migration.fromLabel,
                    migration.toLabel,
                );
                if (!changed) continue;
                updates.push({ id: blockId, data: nextDom });
            } catch (error) {
                result.failed += 1;
                result.errors.push({
                    id: blockId,
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }

        if (updates.length) {
            try {
                await batchUpdateBlock(updates);
                await flushTransaction();
                await sleep(FLUSH_DELAY_MS);
                result.succeeded += updates.length;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                for (const block of updates) {
                    result.failed += 1;
                    result.errors.push({ id: block.id, reason });
                }
            }
        }

        onBatchProgress(Math.min(mappingProcessed, mappingTotal), Math.max(mappingTotal, 1));
    }
}

export async function runCleanup(options: RunCleanupOptions): Promise<CleanupResult> {
    const { signal, onProgress, getSettings, saveSettings, onStylesUpdate } = options;
    const result: CleanupResult = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        aborted: false,
        errors: [],
    };

    const openedForCleanup: string[] = [];

    try {
        assertCleanupWritable();
        throwIfAborted(signal);

        mapProgress(onProgress, "prepare", 0, 5, 1, "Preparing notebooks…");
        const notebooks = (await lsNotebooks()).filter((nb) => !isUserGuideNotebook(nb.id));
        const toOpen = notebooks.filter((nb) => nb.closed).map((nb) => nb.id);

        mapProgress(onProgress, "open", 5, 15, 0, "Opening closed notebooks…");
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
                5,
                15,
                (i + 1) / Math.max(toOpen.length, 1),
                `Opening notebooks (${i + 1}/${toOpen.length})…`,
            );
        }

        if (openedForCleanup.length) {
            for (let i = 0; i < openedForCleanup.length; i += 1) {
                throwIfAborted(signal);
                const notebookId = openedForCleanup[i];
                mapProgress(
                    onProgress,
                    "index",
                    15,
                    25,
                    i / openedForCleanup.length,
                    `Indexing notebook ${i + 1}/${openedForCleanup.length}…`,
                    true,
                );
                const indexed = await waitNotebookIndexed(notebookId);
                if (indexed.timedOut) {
                    result.errors.push({
                        id: notebookId,
                        reason: "Notebook indexing timed out; some blocks may be skipped",
                    });
                }
            }
        }
        mapProgress(onProgress, "index", 15, 25, 1, "Indexing complete");

        const settings = normalizeCalloutSettings(getSettings());
        const phaseA = buildPhaseAMigrations(settings);
        const phaseB = buildPhaseBMigrations(settings);

        let totalBlocks = 0;
        for (const migration of [...phaseA, ...phaseB]) {
            totalBlocks += await countCalloutsBySubtypes([migration.fromLabel]);
        }
        const reportMigrationProgress = (
            migration: SubtypeMigration,
            processedInMapping: number,
            mappingTotal: number,
        ) => {
            const label = migration.phase === "a" ? "Phase A" : "Phase B";
            const migrateRatio = totalBlocks > 0
                ? Math.min(1, result.processed / totalBlocks)
                : 1;
            mapProgress(
                onProgress,
                migration.phase === "a" ? "migrate-a" : "migrate-b",
                25,
                98,
                migrateRatio,
                `${label}: ${migration.fromLabel} → ${migration.toLabel} (${Math.min(processedInMapping, mappingTotal)}/${mappingTotal})`,
            );
        };

        for (const migration of phaseA) {
            throwIfAborted(signal);
            const mappingTotal = await countCalloutsBySubtypes([migration.fromLabel]);
            await migrateSubtypeMapping(migration, signal, result, (processedInMapping, perMappingTotal) => {
                reportMigrationProgress(migration, processedInMapping, perMappingTotal);
            });
            reportMigrationProgress(migration, mappingTotal, mappingTotal || 1);
        }

        for (const migration of phaseB) {
            throwIfAborted(signal);
            const mappingTotal = await countCalloutsBySubtypes([migration.fromLabel]);
            await migrateSubtypeMapping(migration, signal, result, (processedInMapping, perMappingTotal) => {
                reportMigrationProgress(migration, processedInMapping, perMappingTotal);
            });
            reportMigrationProgress(migration, mappingTotal, mappingTotal || 1);
        }

        if (!phaseA.length && !phaseB.length) {
            mapProgress(onProgress, "migrate-a", 25, 98, 1, "No legacy callout blocks to migrate");
        }

        mapProgress(onProgress, "close", 98, 100, 0, "Closing temporarily opened notebooks…");
        for (let i = 0; i < openedForCleanup.length; i += 1) {
            throwIfAborted(signal);
            await closeNotebook(openedForCleanup[i]);
            mapProgress(
                onProgress,
                "close",
                98,
                100,
                (i + 1) / Math.max(openedForCleanup.length, 1),
                `Closing notebooks (${i + 1}/${openedForCleanup.length})…`,
            );
        }

        mapProgress(onProgress, "save", 98, 100, 0.5, "Saving settings…");
        const latest = normalizeCalloutSettings(getSettings());
        await saveSettings({
            callouts: latest.callouts.map((item) => ({
                ...item,
                historicalLabels: [],
            })),
            calloutTombstone: [],
        });
        onStylesUpdate?.();

        mapProgress(onProgress, "done", 100, 100, 1, "Cleanup finished");
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
