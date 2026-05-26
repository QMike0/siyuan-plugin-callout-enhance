/**
 * SiYuan runtime/API adapters.
 *
 * Centralizes editor/protyle access so feature modules match the classic
 * plugin-sample pattern (protyle.getInstance().transaction).
 */
import { getAllEditor, IOperation } from "siyuan";
import { warnLog } from "../utils/logger";

export type PluginWithGetEditor = object & {
    getEditor?: () => { protyle?: ProtyleLike | null } | null;
};

export type LuteLike = {
    NewNodeID?: () => string;
    Md2BlockDOM?: (markdown: string) => string;
    BlockDOM2StdMd?: (html: string) => string;
};

export type ProtyleLike = {
    lute?: LuteLike | null;
    element?: HTMLElement;
    wysiwyg?: { element?: HTMLElement };
    getInstance?: () => { transaction?: (doOperations: IOperation[], undoOperations?: IOperation[]) => void } | null;
    transaction?: (doOperations: IOperation[], undoOperations?: IOperation[]) => void;
};

function describeSourceNode(source: Node | HTMLElement | null) {
    if (!source) return { nodeType: "none" };
    const element = source.nodeType === Node.TEXT_NODE ? source.parentElement : source as HTMLElement;
    return {
        nodeType: source.nodeType,
        tagName: element?.tagName || "",
        className: element?.className || "",
        nodeId: element?.dataset?.nodeId || "",
        closestNodeId: element?.closest?.("[data-node-id]")?.getAttribute("data-node-id") || "",
        hasClosestProtyle: !!element?.closest?.(".protyle"),
    };
}

function isSourceInsideProtyle(protyle: ProtyleLike | null | undefined, source: Node | null) {
    if (!protyle || !source) return false;
    const protyleEl = protyle.element;
    const wysiwygEl = protyle.wysiwyg?.element;
    return !!((protyleEl && protyleEl.contains(source)) || (wysiwygEl && wysiwygEl.contains(source)));
}

export function getNewNodeId() {
    const lute = (window as Window & { Lute?: LuteLike }).Lute;
    if (typeof lute?.NewNodeID === "function") {
        return lute.NewNodeID();
    }
    return "";
}

export function getSiyuanLute(protyle?: ProtyleLike | null) {
    return protyle?.lute || (window as Window & { Lute?: LuteLike })?.Lute || null;
}

export function getFirstBlockInnerHTMLFromMd(lute: LuteLike | null | undefined, markdown: string) {
    if (!lute || typeof lute.Md2BlockDOM !== "function") return "";
    const template = document.createElement("template");
    template.innerHTML = lute.Md2BlockDOM(markdown);
    return template.content.firstElementChild?.firstElementChild?.innerHTML || "";
}

export function getEditorInstance(plugin: PluginWithGetEditor): { protyle?: ProtyleLike | null } | null {
    try {
        const editor = plugin?.getEditor?.();
        return editor || null;
    } catch {
        return null;
    }
}

export function getCurrentProtyle(
    plugin: PluginWithGetEditor,
    block?: HTMLElement | null,
    sourceNode?: Node | null,
): ProtyleLike | null {
    const source = sourceNode || block || null;
    try {
        const editors = getAllEditor?.() || [];

        if (source) {
            for (const item of editors) {
                const protyle = item?.protyle;
                if (protyle?.getInstance && isSourceInsideProtyle(protyle, source)) {
                    return protyle;
                }
            }

            const sourceEl = (source.nodeType === Node.TEXT_NODE ? source.parentElement : source as HTMLElement) as HTMLElement | null;
            const closestProtyle = sourceEl?.closest?.(".protyle") as (HTMLElement & { protyle?: ProtyleLike }) | null;
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
        // fall through
    }

    const editor = getEditorInstance(plugin);
    if (!block && editor?.protyle?.getInstance) {
        if (source && !isSourceInsideProtyle(editor.protyle, source)) {
            warnLog("[WARN] Falling back to current editor protyle for a source outside that protyle", describeSourceNode(source));
        }
        return editor.protyle;
    }
    if (source) {
        warnLog("[WARN] Unable to resolve current protyle for source", describeSourceNode(source));
    }
    return null;
}

/** Classic plugin-sample transaction path via protyle.getInstance().transaction */
export function createTransaction(
    protyle: ProtyleLike | null | undefined,
    doOperations: IOperation[],
    undoOperations?: IOperation[],
): boolean {
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
