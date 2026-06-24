/**
 * Delete logic for callout blocks.
 */
import { IOperation } from "siyuan";
import { createTransaction, getCurrentProtyle, PluginWithGetEditor } from "../core/api";
import { cleanCalloutOuterHTML } from "../utils/callout";
import { errorLog, warnLog } from "../utils/logger";

export type CalloutDeletePluginLike = PluginWithGetEditor;

export function getCalloutParentAndPrevious(block: HTMLElement) {
    const parent = block.parentElement as HTMLElement | null;
    const previous = block.previousElementSibling as HTMLElement | null;
    const parentID = parent?.dataset?.nodeId || "";
    const previousID = previous?.dataset?.nodeId || "";
    return { parentID, previousID };
}

export async function deleteCallout(plugin: CalloutDeletePluginLike, block: HTMLElement) {
    if (!block || !block.dataset.nodeId) return false;
    const blockId = block.dataset.nodeId;
    if (block.dataset.deleting === "true") return false;
    const protyle = getCurrentProtyle(plugin, block);
    if (!protyle) return false;

    try {
        const blockHTML = cleanCalloutOuterHTML(block);
        block.dataset.deleting = "true";
        const { parentID, previousID } = getCalloutParentAndPrevious(block);
        const doOperations: IOperation[] = [{ action: "delete", id: blockId }];
        const undoOperations: IOperation[] = [{
            action: "insert",
            id: blockId,
            parentID,
            previousID,
            data: blockHTML,
        }];
        const ok = createTransaction(protyle, doOperations, undoOperations);
        if (!ok) {
            warnLog("[WARN] Transaction API unavailable during callout delete", { blockId });
            errorLog("[ERROR] Delete transaction failed for block", blockId);
            delete block.dataset.deleting;
            return false;
        }
        return true;
    } catch (err) {
        errorLog("[ERROR] Delete failed for block", blockId, ":", err);
        delete block.dataset.deleting;
        return false;
    }
}
