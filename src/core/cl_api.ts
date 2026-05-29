/**
 * Cleanup-oriented HTTP API wrappers (fetchSyncPost → /api/...).
 * Editor-local Protyle/transaction APIs stay in core/api.ts.
 */
import { fetchSyncPost, IWebSocketData } from "siyuan";
import { CalloutTypeItem, canonicalCalloutKey, getCalloutStyleSubtypes } from "../utils/callout_types";
import { warnLog } from "../utils/logger";

/** Matches siyuan_tmp/kernel/model/mount.go IsUserGuide */
export const USER_GUIDE_NOTEBOOK_IDS = new Set([
    "20210808180117-czj9bvb",
    "20210808180117-6v0mkxr",
    "20211226090932-5lcq56f",
    "20240530133126-axarxgx",
]);

export type ClApiNotebook = {
    id: string;
    name: string;
    closed: boolean;
};

export type ClApiSqlRow = Record<string, unknown>;

export type WaitNotebookIndexedOptions = {
    stableChecks?: number;
    intervalMs?: number;
    timeoutMs?: number;
    minCount?: number;
};

export class ClApiError extends Error {
    code: number;

    constructor(message: string, code = -1) {
        super(message);
        this.name = "ClApiError";
        this.code = code;
    }
}

type SiYuanWindow = Window & {
    siyuan?: {
        config?: {
            readonly?: boolean;
            editor?: { readOnly?: boolean };
        };
    };
};

function getSiyuanWindow() {
    return window as SiYuanWindow;
}

export function isWorkspaceReadOnly() {
    return !!getSiyuanWindow().siyuan?.config?.readonly;
}

/** Editor lock only; does not block cleanup HTTP APIs. */
export function isEditorReadOnly() {
    return !!getSiyuanWindow().siyuan?.config?.editor?.readOnly;
}

export function isUserGuideNotebook(notebookId: string) {
    return USER_GUIDE_NOTEBOOK_IDS.has(notebookId);
}

export async function requestClApi<T = unknown>(url: string, data: Record<string, unknown> = {}) {
    const response = await fetchSyncPost(url, data) as IWebSocketData;
    if (response.code !== 0) {
        throw new ClApiError(response.msg || `API failed: ${url}`, response.code);
    }
    return response.data as T;
}

export async function lsNotebooks() {
    const data = await requestClApi<{ notebooks?: ClApiNotebook[] }>("/api/notebook/lsNotebooks", {});
    return Array.isArray(data?.notebooks) ? data.notebooks : [];
}

export async function openNotebook(notebookId: string) {
    return requestClApi<{ box?: ClApiNotebook; existed?: boolean }>("/api/notebook/openNotebook", {
        notebook: notebookId,
    });
}

export async function closeNotebook(notebookId: string) {
    return requestClApi("/api/notebook/closeNotebook", { notebook: notebookId });
}

export async function querySQL(stmt: string) {
    const data = await requestClApi<ClApiSqlRow[]>("/api/query/sql", { stmt });
    return Array.isArray(data) ? data : [];
}

export async function getBlockDOM(blockId: string) {
    const data = await requestClApi<{ dom?: string }>("/api/block/getBlockDOM", { id: blockId });
    return typeof data?.dom === "string" ? data.dom : "";
}

export type BatchUpdateBlockArg = {
    id: string;
    data: string;
    dataType?: "dom" | "markdown";
};

export async function batchUpdateBlock(blocks: BatchUpdateBlockArg[]) {
    if (!blocks.length) return;
    return requestClApi("/api/block/batchUpdateBlock", {
        blocks: blocks.map((block) => ({
            id: block.id,
            data: block.data,
            dataType: block.dataType || "dom",
        })),
    });
}

export async function flushTransaction() {
    return requestClApi("/api/sqlite/flushTransaction", {});
}

function escapeSqlLiteral(value: string) {
    return value.replace(/'/g, "''");
}

function readSqlCount(rows: ClApiSqlRow[]) {
    if (!rows.length) return 0;
    const row = rows[0];
    const raw = row.c ?? row.count ?? row.COUNT ?? Object.values(row)[0];
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
}

/** Count callout blocks whose subtype matches any key (case-insensitive). */
export async function countCalloutsBySubtypes(subtypes: string[]) {
    const keys = [...new Set(
        subtypes.map((subtype) => canonicalCalloutKey(subtype)).filter(Boolean),
    )];
    if (!keys.length) return 0;

    const conditions = keys.map((key) => `upper(subtype) = '${escapeSqlLiteral(key)}'`);
    const stmt = `SELECT COUNT(*) AS c FROM blocks WHERE type = 'callout' AND (${conditions.join(" OR ")})`;
    try {
        const rows = await querySQL(stmt);
        return readSqlCount(rows);
    } catch (error) {
        warnLog("[cl_api] countCalloutsBySubtypes failed", { stmt, error });
        return 0;
    }
}

export function countCalloutsForTypeItem(item: Pick<CalloutTypeItem, "label" | "pastLabels">) {
    return countCalloutsBySubtypes(getCalloutStyleSubtypes(item));
}


export async function getNotebookBlockCount(boxId: string) {
    const stmt = `SELECT COUNT(*) AS c FROM blocks WHERE box = '${escapeSqlLiteral(boxId)}'`;
    try {
        const rows = await querySQL(stmt);
        return readSqlCount(rows);
    } catch {
        return 0;
    }
}

/**
 * Poll until block count for a notebook stabilizes (openNotebook triggers async Index).
 */
export async function waitNotebookIndexed(boxId: string, options: WaitNotebookIndexedOptions = {}) {
    const stableChecks = options.stableChecks ?? 3;
    const intervalMs = options.intervalMs ?? 500;
    const timeoutMs = options.timeoutMs ?? 120_000;
    const minCount = options.minCount ?? 0;

    const started = Date.now();
    let lastCount = -1;
    let stable = 0;

    while (Date.now() - started < timeoutMs) {
        const count = await getNotebookBlockCount(boxId);
        if (count === lastCount) {
            stable += 1;
        } else {
            stable = 1;
            lastCount = count;
        }
        if (stable >= stableChecks && count >= minCount) {
            return { ready: true, count, timedOut: false };
        }
        await sleep(intervalMs);
    }

    const count = await getNotebookBlockCount(boxId);
    return { ready: false, count, timedOut: true };
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

export function assertCleanupWritable() {
    if (isWorkspaceReadOnly()) {
        throw new ClApiError(
            "Workspace is read-only. Cleanup and block updates require a writable session.",
            -1,
        );
    }
}
