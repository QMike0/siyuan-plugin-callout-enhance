/**
 * SiYuan runtime/API adapters.
 *
 * This module centralizes access to editor/protyle/runtime APIs so higher-level
 * feature logic can stay stable when host API details evolve.
 */
import { getAllEditor, IOperation } from "siyuan";

export function getNewNodeId() {
    const lute = (window as any).Lute;
    if (typeof lute?.NewNodeID === "function") {
        return lute.NewNodeID();
    }
    // Transaction insert requires a valid SiYuan node id. Random fallback ids may be rejected by kernel.
    return "";
}

export function getSiyuanLute(protyle?: any | null) {
    return protyle?.lute || (window as any)?.Lute || null;
}

export function getFirstBlockInnerHTMLFromMd(lute: any, markdown: string) {
    if (!lute || typeof lute.Md2BlockDOM !== "function") return "";
    const template = document.createElement("template");
    template.innerHTML = lute.Md2BlockDOM(markdown);
    return template.content.firstElementChild?.firstElementChild?.innerHTML || "";
}

export function getEditorInstance(plugin: any): any | null {
    try {
        const editor = plugin?.getEditor?.();
        return editor || null;
    } catch {
        return null;
    }
}

export function getCurrentProtyle(plugin: any, block?: HTMLElement | null, sourceNode?: Node | null): any | null {
    try {
        const editors = getAllEditor?.() || [];
        const source = sourceNode || block || null;

        // Prefer resolving by the actual event/source node to avoid using a stale or inactive editor instance.
        if (source) {
            for (const item of editors) {
                const protyle = item?.protyle;
                const protyleEl = protyle?.element as HTMLElement | undefined;
                const wysiwygEl = protyle?.wysiwyg?.element as HTMLElement | undefined;
                if (protyle?.getInstance && ((protyleEl && protyleEl.contains(source)) || (wysiwygEl && wysiwygEl.contains(source)))) {
                    return protyle;
                }
            }
        }

        // If DOM has nearest protyle container, map it back to the editor list.
        if (source) {
            const sourceEl = (source.nodeType === Node.TEXT_NODE ? source.parentElement : source as HTMLElement) as HTMLElement | null;
            const closestProtyle = sourceEl?.closest?.(".protyle") as any;
            if (closestProtyle?.protyle?.getInstance) {
                return closestProtyle.protyle;
            }
            if (closestProtyle) {
                for (const item of editors) {
                    const protyle = item?.protyle;
                    if (protyle?.getInstance && protyle.element === closestProtyle) {
                        return protyle;
                    }
                }
            }
        }
    } catch {
        // Ignore and fall back to current editor.
    }

    const editor = getEditorInstance(plugin);
    if (!block && editor?.protyle?.getInstance) return editor.protyle;
    return null;
}

export function createTransaction(protyle: any, doOperations: IOperation[], undoOperations?: IOperation[]) {
    const instance = protyle?.getInstance?.();
    if (instance?.transaction) {
        instance.transaction(doOperations, undoOperations);
        return true;
    }
    if (typeof protyle?.transaction === "function") {
        protyle.transaction(doOperations, undoOperations);
        return true;
    }
    return false;
}
