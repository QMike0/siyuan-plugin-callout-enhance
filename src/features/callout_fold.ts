/**
 * Fold/unfold logic for callout blocks.
 */
import { debugLog, errorLog } from "../utils/logger";

export type CalloutFoldPluginLike = {
    syncBlock: (blockElement: HTMLElement, originalHtml?: string, reason?: "title" | "fold" | "type") => Promise<boolean>;
};

export async function setFoldState(plugin: CalloutFoldPluginLike, block: HTMLElement | null, fold: boolean) {
    if (!block || !block.dataset.nodeId) return false;
    const blockId = block.dataset.nodeId;
    try {
        const previousFold = block.getAttribute("fold");
        const originalHtml = block.outerHTML;
        if (fold) block.setAttribute("fold", "1");
        else block.removeAttribute("fold");

        debugLog(`[${fold ? "Fold" : "Unfold"}] Callout block`, blockId);

        const ok = await plugin.syncBlock(block, originalHtml, "fold");
        if (ok) return true;

        if (previousFold === null) block.removeAttribute("fold");
        else block.setAttribute("fold", previousFold);
        return false;
    } catch (err) {
        const action = fold ? "Fold" : "Unfold";
        errorLog(`[ERROR] ${action} failed for block ${blockId}:`, err);
        return false;
    }
}
