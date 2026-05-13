import { Plugin, IOperation, showMessage, getAllEditor } from "siyuan";
import "./index.scss";

type CalloutTypeItem = {
    type: string;
    label: string;
    icon: string;
};

type CompletionSession = {
    active: boolean;
    quote: HTMLElement | null;
    start: number;
};

const DEBUG = true;
const STARTUP_FLAG = "__calloutEnhancePluginInitialized";
const CALLOUT_TYPES: CalloutTypeItem[] = [
    { type: "Info", label: "Info", icon: "ℹ️" },
    { type: "NOTE", label: "Note", icon: "🖊️" },
    { type: "IMPORTANT", label: "Important", icon: "✨" },
    { type: "Quote", label: "Quote", icon: "❞" },
    { type: "TIP", label: "Tip", icon: "💡" },
    { type: "WARNING", label: "Warning", icon: "⚠️" },
    { type: "CAUTION", label: "Caution", icon: "🚨" },
    { type: "Question", label: "Question", icon: "❓" },
];

const TRIGGER_PATTERN = /[\[【［]([a-zA-Z]*)$/i;
const SESSION_TRIGGER_PATTERN = /^[\[【［]([a-zA-Z]*)$/i;

function isTriggerChar(ch: string) {
    return ch === "[" || ch === "【" || ch === "［";
}

function log(...args: any[]) {
    if (DEBUG) {
        console.log("[CalloutEnhance]", ...args);
    }
}

function warn(...args: any[]) {
    console.warn(...args);
}

function error(...args: any[]) {
    console.error(...args);
}

function getNewNodeId() {
    const lute = (window as any).Lute;
    if (typeof lute?.NewNodeID === "function") {
        return lute.NewNodeID();
    }
    // Transaction insert requires a valid SiYuan node id. Random fallback ids may be rejected by kernel.
    return "";
}

function createEmptyParagraphElement(id?: string) {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", id || getNewNodeId());
    element.setAttribute("data-type", "NodeParagraph");
    element.classList.add("p");
    const spellcheck = (window as any)?.siyuan?.config?.editor?.spellcheck ? "true" : "false";
    element.innerHTML = `<div contenteditable="true" spellcheck="${spellcheck}"></div><div class="protyle-attr" contenteditable="false">${"\u200B"}</div>`;
    return element;
}

function focusNewBlockEditableStart(newBlock: HTMLElement) {
    const editable = newBlock.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!editable) return;
    editable.focus();
    const range = document.createRange();
    range.setStart(editable, 0);
    range.collapse(true);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function placeCaretAtEnd(el: HTMLElement | null) {
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function ensureCalloutTitleEditable(titleEl: HTMLElement | null) {
    if (!titleEl) return;
    titleEl.contentEditable = "true";
    titleEl.spellcheck = false;
}

function closestTitleFromTarget(target: EventTarget | null) {
    if (!target) return null;
    const element = target instanceof Node && target.nodeType === Node.TEXT_NODE ? target.parentElement : target as Element;
    return element?.closest?.(".callout-title") as HTMLElement | null;
}

function getCalloutFromEventTarget(target: EventTarget | null) {
    if (!target) return null;
    const element = target instanceof Node && target.nodeType === Node.TEXT_NODE ? target.parentElement : target as Element;
    return element?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
}

function hasCalloutBody(block: HTMLElement | null) {
    function isMeaningfulNode(node: Node): boolean {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent || "").replace(/[\u200B\u00A0]/g, "").trim().length > 0;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const el = node as HTMLElement;
        const tagName = el.tagName?.toUpperCase?.() || "";
        if (tagName === "BR") return false;
        if (el.classList?.contains("protyle-attr")) return false;
        if (el.matches?.("img,video,audio,iframe,svg,canvas,table,hr,math,pre,code,input,button,select,textarea,embed,object")) {
            return true;
        }
        return Array.from(el.childNodes).some(isMeaningfulNode);
    }

    if (!block) return false;
    return Array.from(block.children).some((child) => {
        if ((child as HTMLElement).classList?.contains("callout-title")) return false;
        if ((child as HTMLElement).classList?.contains("callout-info")) return false;
        if ((child as HTMLElement).classList?.contains("protyle-attr")) return false;
        return isMeaningfulNode(child);
    });
}

function getCalloutBodyLineCount(block: HTMLElement | null) {
    if (!block) return 0;
    const content = (block.querySelector?.(".callout-content") as HTMLElement | null) || block;
    return Array.from(content.children).filter((child) => {
        if ((child as HTMLElement).classList?.contains("protyle-attr")) return false;
        return true;
    }).length;
}

function getSelectionCallout() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const node = sel.focusNode || sel.anchorNode;
    const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
}

function getBlockquoteElement(node: Node | null) {
    if (!node) return null;
    let current: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
    while (current && current !== document.body) {
        if (current.classList && current.classList.contains("bq")) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

/** 光标所在、作为 `.bq` 直接子节点的首行内容块（思源中通常为一段） */
function getQuoteContentLineElement(quoteEl: HTMLElement | null, sourceNode: Node | null): HTMLElement | null {
    if (!quoteEl || !sourceNode) return null;
    const sourceEl = sourceNode.nodeType === Node.TEXT_NODE ? sourceNode.parentElement : (sourceNode as HTMLElement);
    let current: HTMLElement | null = sourceEl;
    while (current && current.parentElement && current.parentElement !== quoteEl) {
        current = current.parentElement;
    }
    return current && current.parentElement === quoteEl ? current : null;
}

/** 从首行块 DOM 起点到触发符之间无可见内容（仅空白 / ZWSP / nbsp），即触发符在该行逻辑开头 */
function isTriggerAtLogicalLineStart(lineEl: HTMLElement | null, focusNode: Text, triggerOffset: number): boolean {
    if (!lineEl || !focusNode) return false;
    try {
        if (!lineEl.contains(focusNode)) return false;
        const range = document.createRange();
        range.setStart(lineEl, 0);
        range.setEnd(focusNode, triggerOffset);
        const before = range.toString().replace(/[\u200B\u00A0]/g, "").trim();
        return before.length === 0;
    } catch {
        return false;
    }
}

function applyCompletionTransform(selectedType: string): boolean {
    try {
        const selection = window.getSelection();
        if (!selection) return false;
        const textNode = selection?.rangeCount ? (selection.getRangeAt(0).startContainer as Text) : null;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return false;

        const content = textNode.textContent || "";
        const match = content.match(TRIGGER_PATTERN);
        const startOffset = match ? content.lastIndexOf(match[0]) : -1;
        if (startOffset < 0) return false;

        const quoteEl = getBlockquoteElement(textNode);
        const lineEl = getQuoteContentLineElement(quoteEl, textNode);
        if (!isTriggerAtLogicalLineStart(lineEl, textNode, startOffset)) return false;

        const replacement = `[!${selectedType}]\n`;
        const workRange = document.createRange();
        workRange.setStart(textNode, startOffset);
        workRange.setEnd(textNode, content.length);
        workRange.deleteContents();

        const newNode = document.createTextNode(replacement);
        workRange.insertNode(newNode);

        const afterRange = document.createRange();
        afterRange.setStartAfter(newNode);
        afterRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(afterRange);

        const enterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            keyCode: 13,
            code: "Enter",
            which: 13,
            bubbles: true,
            cancelable: true,
        });
        const parentEl = newNode.parentElement || textNode.parentElement;
        if (parentEl && parentEl.dispatchEvent) {
            parentEl.dispatchEvent(enterEvent);
        } else {
            document.dispatchEvent(enterEvent);
        }
        return true;
    } catch (err) {
        error("[ERROR] Completion transform failed:", err);
        return false;
    }
}

export default class CalloutEnhancePlugin extends Plugin {
    private cleanupHandlers: Array<() => void> = [];
    private observer: MutationObserver | null = null;
    private isComposing = false;
    private titleBoundEls = new WeakSet<HTMLElement>();
    private titleEnterInFlight = new Set<string>();
    private titleEditSnapshots = new WeakMap<HTMLElement, string>();
    private calloutHtmlSnapshots = new WeakMap<HTMLElement, string>();

    private calloutTypeMenuElement: HTMLDivElement | null = null;
    private calloutTypeMenuActiveBlock: HTMLElement | null = null;
    private calloutTypeMenuIndex = -1;

    private completionMenuElement: HTMLDivElement | null = null;
    private completionFiltered: CalloutTypeItem[] = [];
    private completionIndex = -1;
    private completionVisible = false;
    private completionSession: CompletionSession = {
        active: false,
        quote: null,
        start: -1,
    };

    private listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        target.addEventListener(type, handler, options as any);
        this.cleanupHandlers.push(() => target.removeEventListener(type, handler, options as any));
    }

    private getEditorInstance(): any | null {
        try {
            const editor = (this as any).getEditor?.();
            return editor || null;
        } catch {
            return null;
        }
    }

    private getCurrentProtyle(block?: HTMLElement | null, sourceNode?: Node | null): any | null {
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

        const editor = this.getEditorInstance();
        if (!block && editor?.protyle?.getInstance) return editor.protyle;
        return null;
    }

    private createTransaction(protyle: any, doOperations: IOperation[], undoOperations?: IOperation[]) {
        const instance = protyle?.getInstance?.();
        if (instance?.transaction) {
            instance.transaction(doOperations, undoOperations);
            return true;
        }
        if (typeof protyle?.transaction === "function") {
            protyle.transaction(doOperations, undoOperations);
            return true;
        }
        warn("[WARN] Transaction API unavailable - protyle may not support transactions");
        return false;
    }

    private isUndoRedoShortcut(e: KeyboardEvent) {
        const key = (e.key || "").toLowerCase();
        const withModifier = e.ctrlKey || e.metaKey;
        if (!withModifier) return false;
        return key === "z" || key === "y";
    }

    private getCalloutBodyContainer(block: HTMLElement) {
        return (block.querySelector?.(".callout-content") as HTMLElement | null) || block;
    }

    private getCalloutParentAndPrevious(block: HTMLElement) {
        const parent = block.parentElement;
        const parentID = parent?.dataset?.nodeId || "";
        const previousID = block.previousElementSibling?.dataset?.nodeId || "";
        return { parentID, previousID };
    }

    private ensureCalloutTypeMenu() {
        if (this.calloutTypeMenuElement) return;
        this.calloutTypeMenuElement = document.createElement("div");
        this.calloutTypeMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none";
        this.calloutTypeMenuElement.tabIndex = -1;
        this.calloutTypeMenuElement.style.cssText = "position:fixed; z-index:9999; min-width:160px; padding:6px; box-shadow: var(--b3-dialog-shadow);";
        document.body.appendChild(this.calloutTypeMenuElement);
    }

    private hideCalloutTypeMenu() {
        if (this.calloutTypeMenuElement) {
            this.calloutTypeMenuElement.classList.add("fn__none");
        }
        this.calloutTypeMenuActiveBlock = null;
        this.calloutTypeMenuIndex = -1;
    }

    private renderCalloutTypeMenu() {
        if (!this.calloutTypeMenuElement) return;
        this.calloutTypeMenuElement.innerHTML = "";
        CALLOUT_TYPES.forEach((item, index) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.tabIndex = -1;
            btn.className = `b3-list-item b3-list-item--two ${index === this.calloutTypeMenuIndex ? "b3-list-item--focus" : ""}`;
            btn.innerHTML = `
          <div class="b3-list-item__first" style="display:flex; align-items:center; gap:4px;">
            <span class="b3-list-item__graphic" style="width:20px; flex-shrink:0; text-align:center; font-size:16px; border:none; background:transparent;">${item.icon}</span>
            <span class="b3-list-item__text" style="font-size:15px;">${item.label}</span>
          </div>`;
            btn.onclick = async (e) => {
                e.stopPropagation();
                this.calloutTypeMenuIndex = index;
                await this.applyCalloutType(item.type);
            };
            this.calloutTypeMenuElement!.appendChild(btn);
        });
    }

    private focusCalloutTypeMenuItem(index: number) {
        if (!this.calloutTypeMenuElement || CALLOUT_TYPES.length === 0) return;
        const normalizedIndex = (index + CALLOUT_TYPES.length) % CALLOUT_TYPES.length;
        this.calloutTypeMenuIndex = normalizedIndex;
        this.renderCalloutTypeMenu();
        const activeButton = this.calloutTypeMenuElement.querySelector(".b3-list-item--focus") as HTMLButtonElement | null;
        activeButton?.focus();
        activeButton?.scrollIntoView({ block: "nearest" });
    }

    private showCalloutTypeMenu(block: HTMLElement, x: number, y: number) {
        this.ensureCalloutTypeMenu();
        if (!this.calloutTypeMenuElement) return;
        this.calloutTypeMenuActiveBlock = block;
        this.calloutTypeMenuIndex = 0;
        this.renderCalloutTypeMenu();
        this.calloutTypeMenuElement.classList.remove("fn__none");
        setTimeout(() => {
            if (!this.calloutTypeMenuElement) return;
            const menuWidth = this.calloutTypeMenuElement.offsetWidth || 200;
            const menuHeight = this.calloutTypeMenuElement.offsetHeight || 300;
            const padding = 8;
            let top = y;
            let left = x;
            if (top + menuHeight + padding > window.innerHeight) {
                top = Math.max(padding, window.innerHeight - menuHeight - padding);
            }
            if (top < padding) top = padding;
            if (left + menuWidth + padding > window.innerWidth) {
                left = Math.max(padding, window.innerWidth - menuWidth - padding);
            }
            if (left < padding) left = padding;
            this.calloutTypeMenuElement.style.top = `${top}px`;
            this.calloutTypeMenuElement.style.left = `${left}px`;
            this.focusCalloutTypeMenuItem(0);
        }, 0);
    }

    private async applyCalloutType(newType: string) {
        const block = this.calloutTypeMenuActiveBlock;
        if (!block) return;
        const blockId = block.dataset.nodeId;
        if (!blockId) return;

        const nextSubtype = newType.toUpperCase();
        const previousSubtype = block.getAttribute("data-subtype") || "";
        const originalHtml = block.outerHTML;
        if (DEBUG) log("[Type] Changing from", previousSubtype || "(default)", "to", nextSubtype);
        block.dataset.subtype = nextSubtype;

        const ok = await this.syncBlock(block, originalHtml);
        if (ok) {
            if (DEBUG) log("[Type] Success: changed to", nextSubtype);
            this.hideCalloutTypeMenu();
            return;
        }

        if (previousSubtype) {
            block.dataset.subtype = previousSubtype;
        } else {
            delete block.dataset.subtype;
        }
        log("[Type] Rollback: reverted to", previousSubtype || "(default)");
        showMessage("callout subtype save failed");
    }

    private handleCalloutTypeKeydown = (e: KeyboardEvent) => {
        if (!this.calloutTypeMenuElement || this.calloutTypeMenuElement.classList.contains("fn__none")) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusCalloutTypeMenuItem(this.calloutTypeMenuIndex + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusCalloutTypeMenuItem(this.calloutTypeMenuIndex - 1);
        } else if (e.key === "Home") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusCalloutTypeMenuItem(0);
        } else if (e.key === "End") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.focusCalloutTypeMenuItem(CALLOUT_TYPES.length - 1);
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            void this.applyCalloutType(CALLOUT_TYPES[this.calloutTypeMenuIndex >= 0 ? this.calloutTypeMenuIndex : 0].type);
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.hideCalloutTypeMenu();
        }
    };

    private ensureCompletionMenu() {
        if (this.completionMenuElement) return;
        this.completionMenuElement = document.createElement("div");
        this.completionMenuElement.className = "protyle-hint b3-list b3-list--background hint--menu fn__none";
        this.completionMenuElement.style.cssText = "position:fixed; z-index:9999; min-width:160px; padding:6px; box-shadow: var(--b3-dialog-shadow);";
        document.body.appendChild(this.completionMenuElement);
    }

    private hideCompletionMenu() {
        this.completionVisible = false;
        this.completionIndex = -1;
        this.completionSession.active = false;
        this.completionSession.quote = null;
        this.completionSession.start = -1;
        if (this.completionMenuElement) {
            this.completionMenuElement.classList.add("fn__none");
        }
    }

    private isFirstLineOfQuote(quoteEl: HTMLElement | null, sourceNode: Node | null): boolean {
        if (!quoteEl || !sourceNode) return false;
        const line = getQuoteContentLineElement(quoteEl, sourceNode);
        if (!line) return false;
        const firstLine = Array.from(quoteEl.children).find((child) => !((child as HTMLElement).classList?.contains("protyle-attr"))) as HTMLElement | undefined;
        return !!firstLine && line === firstLine;
    }

    private renderCompletionMenu() {
        if (!this.completionMenuElement) return;
        this.completionMenuElement.innerHTML = "";
        this.completionFiltered.forEach((item, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.tabIndex = -1;
            btn.className = `b3-list-item b3-list-item--two ${i === this.completionIndex ? "b3-list-item--focus" : ""}`;
            btn.innerHTML = `
                <div class="b3-list-item__first" style="display:flex; align-items:center; gap:4px;">
                    <span class="b3-list-item__graphic" style="width:20px; flex-shrink:0; text-align:center; font-size:16px; border:none; background:transparent;">${item.icon}</span>
                    <span class="b3-list-item__text" style="font-size:15px;">${item.label}</span>
                </div>`;
            btn.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.applyCompletion(i);
            };
            this.completionMenuElement!.appendChild(btn);
        });
        this.completionMenuElement.classList.remove("fn__none");
        if (this.completionIndex === -1) this.completionIndex = 0;
        const activeButton = this.completionMenuElement.querySelector(".b3-list-item--focus") as HTMLButtonElement | null;
        activeButton?.scrollIntoView({ block: "nearest" });
    }

    private updateCompletionMenuPosition(rect: DOMRect) {
        if (!this.completionMenuElement) return;
        const menuWidth = this.completionMenuElement.offsetWidth || 200;
        const menuHeight = this.completionMenuElement.offsetHeight || 300;
        const padding = 8;
        let top = rect.bottom + padding;
        let left = rect.left;
        if (top + menuHeight + padding > window.innerHeight) {
            top = rect.top - menuHeight - padding;
        }
        if (top < padding) top = padding;
        if (left + menuWidth + padding > window.innerWidth) {
            left = Math.max(padding, window.innerWidth - menuWidth - padding);
        }
        if (left < padding) left = padding;
        this.completionMenuElement.style.top = `${top}px`;
        this.completionMenuElement.style.left = `${left}px`;
    }

    private showCompletionMenu(filterText: string, rect: DOMRect, block: HTMLElement) {
        this.ensureCompletionMenu();
        if (!this.completionMenuElement) return;
        this.completionFiltered = CALLOUT_TYPES.filter((t) =>
            t.type.toLowerCase().includes(filterText.toLowerCase()) ||
            t.label.toLowerCase().includes(filterText.toLowerCase())
        );
        if (this.completionFiltered.length === 0) {
            this.hideCompletionMenu();
            return;
        }
        this.completionVisible = true;
        this.completionIndex = 0;
        this.renderCompletionMenu();
        this.updateCompletionMenuPosition(rect);
    }

    private applyCompletion(index = this.completionIndex) {
        const selected = this.completionFiltered[index];
        if (!selected) return;
        this.hideCompletionMenu();
        const ok = applyCompletionTransform(selected.type);
        if (!ok) {
            showMessage("callout completion transform failed");
        }
    }

    private initCallout(block: HTMLElement) {
        if (block.dataset?.nodeId) {
            delete block.dataset.deleting;
        }
        const titleEl = block.querySelector(".callout-title") as HTMLElement | null;
        if (!titleEl) {
            block.dataset.enhanced = "true";
            return;
        }
        if (!this.titleBoundEls.has(titleEl)) {
            ensureCalloutTitleEditable(titleEl);
            this.titleBoundEls.add(titleEl);
        }
        block.dataset.enhanced = "true";
    }

    private scanAllCallouts() {
        document.querySelectorAll('.callout[data-type="NodeCallout"]').forEach((node) => {
            this.initCallout(node as HTMLElement);
        });
    }

    private async setFoldState(block: HTMLElement | null, fold: boolean) {
        if (!block || !block.dataset.nodeId) return false;
        const blockId = block.dataset.nodeId;
        try {
            const previousFold = block.getAttribute("fold");
            const originalHtml = block.outerHTML;
            if (fold) block.setAttribute("fold", "1");
            else block.removeAttribute("fold");
            
            if (DEBUG) log(`[${fold ? "Fold" : "Unfold"}] Callout block`, blockId);

            const ok = await this.syncBlock(block, originalHtml);
            if (ok) {
                return true;
            }

            // 事务失败时恢复 DOM，避免 UI 状态与内核状态不一致
            if (previousFold === null) {
                block.removeAttribute("fold");
            } else {
                block.setAttribute("fold", previousFold);
            }
            return false;
        } catch (err) {
            const action = fold ? "Fold" : "Unfold";
            error(`[ERROR] ${action} failed for block ${blockId}:`, err);
            return false;
        }
    }

    private async syncBlock(blockElement: HTMLElement, originalHtml?: string) {
        if (!blockElement || !blockElement.dataset.nodeId) return false;
        if (blockElement.dataset.deleting === "true") return false;
        const blockId = blockElement.dataset.nodeId;
        
        const protyle = this.getCurrentProtyle(blockElement);
        if (!protyle) return false;

        try {
            // 保存原始 HTML 用于 undo
            const previousHtml = originalHtml || blockElement.outerHTML;
            
            // 克隆块并清理临时属性和元素
            const clone = blockElement.cloneNode(true) as HTMLElement;
            const titleInClone = clone.querySelector(".callout-title") as HTMLElement | null;
            if (titleInClone) {
                titleInClone.classList.remove("is-title-editing");
                titleInClone.removeAttribute("contenteditable");
                titleInClone.removeAttribute("data-callout-title-bound");
                titleInClone.removeAttribute("data-callout-title-snapshot");
                titleInClone.spellcheck = false;
            }
            clone.classList.remove("protyle-shown");
            clone.removeAttribute("data-enhanced");
            clone.removeAttribute("data-callout-html-snapshot");

            // 清理临时属性的快照字段
            clone.removeAttribute("data-callout-title-html-snapshot");
            
            const newHtml = clone.outerHTML;
            
            // 只在内容真正改变时才发送事务
            if (newHtml === previousHtml) {
                if (DEBUG) log("[Title] No changes for block", blockId);
                return true;
            }

            if (DEBUG) log("[Title] Saving block", blockId);
            
            const doOperations: IOperation[] = [{
                action: "update",
                id: blockId,
                data: newHtml,
            }];
            
            const undoOperations: IOperation[] = [{
                action: "update",
                id: blockId,
                data: previousHtml,
            }];
            
            const ok = this.createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                error("[ERROR] Title save transaction failed for block", blockId);
                showMessage("无法调用思源事务接口，标题修改未保存");
                return false;
            }
            return true;
        } catch (err) {
            error("[ERROR] Title save exception for block", blockId, ":", err);
            return false;
        }
    }

    private async deleteCallout(block: HTMLElement) {
        if (!block || !block.dataset.nodeId) return false;
        const blockId = block.dataset.nodeId;
        if (block.dataset.deleting === "true") return false;
        const protyle = this.getCurrentProtyle(block);
        if (!protyle) return false;

        try {
            block.dataset.deleting = "true";
            const blockHTML = block.outerHTML;
            const { parentID, previousID } = this.getCalloutParentAndPrevious(block);
            const doOperations: IOperation[] = [{ action: "delete", id: blockId }];
            const undoOperations: IOperation[] = [{
                action: "insert",
                id: blockId,
                parentID,
                previousID,
                data: blockHTML,
            }];
            const ok = this.createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                error("[ERROR] Delete transaction failed for block", blockId);
                delete block.dataset.deleting;
                return false;
            }
            return true;
        } catch (err) {
            error("[ERROR] Delete failed for block", blockId, ":", err);
            delete block.dataset.deleting;
            return false;
        }
    }

    private handleTitleFocusIn = (e: FocusEvent) => {
        const titleEl = closestTitleFromTarget(e.target);
        if (!titleEl) return;
        ensureCalloutTitleEditable(titleEl);
        this.titleEditSnapshots.set(titleEl, titleEl.textContent || "");
        const block = titleEl.closest(".callout") as HTMLElement | null;
        if (block) {
            // 保存完整的块 HTML 作为快照，用于 undo
            this.calloutHtmlSnapshots.set(block, block.outerHTML);
        }
        titleEl.classList.add("is-title-editing");
    };

    private handleTitleFocusOut = (e: FocusEvent) => {
        const titleEl = closestTitleFromTarget(e.target);
        if (!titleEl) return;
        const block = titleEl.closest(".callout") as HTMLElement | null;
        titleEl.classList.remove("is-title-editing");
        if (!block) return;
        if (block.dataset.deleting === "true") return;
        const previousTitle = this.titleEditSnapshots.get(titleEl) ?? "";
        const currentTitle = titleEl.textContent || "";
        const originalHtml = this.calloutHtmlSnapshots.get(block) || block.outerHTML;
        this.titleEditSnapshots.delete(titleEl);
        this.calloutHtmlSnapshots.delete(block);
        if (currentTitle === previousTitle) return;
        requestAnimationFrame(() => this.syncBlock(block, originalHtml));
    };

    private handleTitleKeydown = (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        const titleEl = closestTitleFromTarget(e.target);
        if (!titleEl) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Some themes/versions render callout title under `.callout` without a strict data-type selector.
        const block = (titleEl.closest('.callout[data-type="NodeCallout"]') || titleEl.closest(".callout")) as HTMLElement | null;
        if (!block) {
            error("[ERROR] TitleEnter failed: Callout block not found from title element");
            return;
        }
        if (block.dataset.deleting === "true") return;

        (async () => {
            const blockId = block.dataset.nodeId || "";
            if (this.titleEnterInFlight.has(blockId)) return;
            const protyle = this.getCurrentProtyle(block, titleEl);
            if (!blockId || !protyle) {
                error("[ERROR] TitleEnter failed: Missing blockId or protyle context");
                showMessage("标题回车失败：未找到编辑器上下文");
                return;
            }

            try {
                if (DEBUG) log("[TitleEnter] Creating new block after", blockId);
                this.titleEnterInFlight.add(blockId);
                if (block.getAttribute("fold") === "1") {
                            await this.setFoldState(block, false);
                }

                const newBlockId = getNewNodeId();
                if (!newBlockId) {
                    showMessage("标题回车失败：无法生成合法块 ID");
                    return;
                }
                const newBlock = createEmptyParagraphElement(newBlockId);
                const content = this.getCalloutBodyContainer(block);
                const firstBodyBlock = Array.from(content.children).find((child) => {
                    const el = child as HTMLElement;
                    return !el.classList.contains("protyle-attr") &&
                        !el.classList.contains("callout-title") &&
                        !el.classList.contains("callout-info");
                }) as HTMLElement | undefined;
                if (firstBodyBlock) {
                    firstBodyBlock.insertAdjacentElement("beforebegin", newBlock);
                } else {
                    content.insertAdjacentElement("afterbegin", newBlock);
                }

                focusNewBlockEditableStart(newBlock);

                const transactionHTML = newBlock.outerHTML;
                const doOperations: IOperation[] = [{
                    action: "insert",
                    id: newBlockId,
                    parentID: blockId,
                    previousID: "",
                    data: transactionHTML,
                }];
                const undoOperations: IOperation[] = [{
                    action: "delete",
                    id: newBlockId,
                }];
                const ok = this.createTransaction(protyle, doOperations, undoOperations);
                if (!ok) {
                    newBlock.remove();
                    error("[ERROR] TitleEnter transaction failed for block", blockId, "- new block:", newBlockId);
                    showMessage("无法调用思源事务接口，标题回车插入失败");
                    return;
                }
            } catch (err) {
                error("[ERROR] TitleEnter exception for block", blockId, ":", err);
            } finally {
                this.titleEnterInFlight.delete(blockId);
            }
        })();
    };

    private handleBodyArrowLeft = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft") return;
        if (closestTitleFromTarget(e.target)) return;

        const currentCallout = getSelectionCallout();
        if (!currentCallout) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const content = this.getCalloutBodyContainer(currentCallout);
        if (!content) return;

        let node: Node | null = range.startContainer;
        while (node && node.parentNode !== content) {
            node = node.parentNode;
        }
        if (!node) return;
        if (node !== content.firstChild || range.startOffset !== 0) return;

        const title = currentCallout.querySelector(".callout-title") as HTMLElement | null;
        if (!title) return;

        ensureCalloutTitleEditable(title);
        title.focus();
        placeCaretAtEnd(title);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    private guardTitleEvents = (e: Event) => {
        const titleEl = closestTitleFromTarget(e.target);
        if (!titleEl) return;
        if (e.type === "keydown" && (e as KeyboardEvent).key === "Enter") return;
        if (e instanceof KeyboardEvent && this.isUndoRedoShortcut(e)) return;
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    private triggerBackspaceForEmptyCallout = (block: HTMLElement, sourceTarget: EventTarget | null) => {
        if (!block) return false;

        const sourceEl = sourceTarget instanceof Node && sourceTarget.nodeType === Node.TEXT_NODE 
            ? sourceTarget.parentElement 
            : sourceTarget as HTMLElement | null;
        const activeEl = document.activeElement as HTMLElement | null;
        const activeEditable = activeEl?.isContentEditable ? activeEl : null;
        const sourceEditable = sourceEl?.closest?.('[contenteditable="true"]') as HTMLElement | null;
        const target = sourceEditable || activeEditable || block.querySelector('[contenteditable="true"]');
        if (!target) return false;

        const keydownEvent = new KeyboardEvent("keydown", {
            key: "Backspace",
            code: "Backspace",
            keyCode: 8,
            which: 8,
            bubbles: true,
            cancelable: true,
        });
        target.dispatchEvent(keydownEvent);

        const keyupEvent = new KeyboardEvent("keyup", {
            key: "Backspace",
            code: "Backspace",
            keyCode: 8,
            which: 8,
            bubbles: true,
            cancelable: true,
        });
        target.dispatchEvent(keyupEvent);

        return true;
    };

    private waitForNativeEmptyCalloutHandling = async (block: HTMLElement) => {
        // 等待思源编辑器的原生处理（模拟 Backspace 后）
        // 延迟一段时间以让编辑器更新，然后检查 callout 是否仍在 DOM 中
        return new Promise<boolean>((resolve) => {
            setTimeout(() => {
                const stillExists = document.body.contains(block);
                resolve(!stillExists);
            }, 200);
        });
    };

    private guardEmptyCalloutEnter = async (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        if (closestTitleFromTarget(e.target)) return;

        const callout = getCalloutFromEventTarget(e.target) || getSelectionCallout();
        if (!callout) return;
        if (callout.dataset.deleting === "true") return;
        if (getCalloutBodyLineCount(callout) > 1) return;
        if (hasCalloutBody(callout)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 先尝试模拟 Backspace 触发思源原生处理
        const dispatched = this.triggerBackspaceForEmptyCallout(callout, e.target);
        const nativeHandled = dispatched
            ? await this.waitForNativeEmptyCalloutHandling(callout)
            : false;
        
        // 如果原生处理未成功删除 callout，则使用事务 API 删除
        if (!nativeHandled && document.body.contains(callout)) {
            await this.deleteCallout(callout);
        }
    };

    private handleGlobalPointerDown = (e: PointerEvent) => {
        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout) return;
        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        if ((clickX >= 0 && clickX <= 40 && clickY <= 45) || (clickX >= rect.width - 40 && clickY <= 45)) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    private handleGlobalClick = (e: MouseEvent) => {
        if (this.calloutTypeMenuElement && !this.calloutTypeMenuElement.contains(e.target as Node)) {
            this.hideCalloutTypeMenu();
        }
        if (this.completionMenuElement && !this.completionMenuElement.contains(e.target as Node)) {
            this.hideCompletionMenu();
        }

        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout) return;

        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const blockId = callout.dataset.nodeId;

        if (clickX >= 0 && clickX <= 40 && clickY <= 45) {
            e.preventDefault();
            e.stopPropagation();
            this.showCalloutTypeMenu(callout, e.clientX, e.clientY);
            return;
        }

        if (clickX >= rect.width - 40 && clickY <= 45 && blockId) {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyFolded = callout.getAttribute("fold") === "1";
            const nextFold = !isCurrentlyFolded;
            this.setFoldState(callout, nextFold);
            return;
        }

        const titleEl = (e.target as HTMLElement | null)?.closest?.(".callout-title") as HTMLElement | null;
        if (titleEl) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            ensureCalloutTitleEditable(titleEl);
            if (document.activeElement !== titleEl) {
                titleEl.focus();
                placeCaretAtEnd(titleEl);
            }
        }
    };

    private handleGlobalKeydown = async (e: KeyboardEvent) => {
        const calloutTypeMenuOpen = !!this.calloutTypeMenuElement && !this.calloutTypeMenuElement.classList.contains("fn__none");
        if (calloutTypeMenuOpen && ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Tab", "Escape"].includes(e.key)) {
            this.handleCalloutTypeKeydown(e);
            return;
        }

        if (this.completionVisible && this.completionMenuElement && ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Tab", "Escape"].includes(e.key)) {
            this.handleCompletionKeydown(e);
            return;
        }

        const titleEl = closestTitleFromTarget(e.target);
        if (titleEl) {
            if (e.key === "Enter") {
                this.handleTitleKeydown(e);
                return;
            }
            if (this.isUndoRedoShortcut(e)) return;
            this.guardTitleEvents(e);
            return;
        }

        if (e.key === "ArrowLeft") {
            this.handleBodyArrowLeft(e);
            return;
        }

        if (e.key === "Enter") {
            await this.guardEmptyCalloutEnter(e);
        }
    };

    private handleCompletionInput = (e: InputEvent) => {
        if (this.isComposing) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
            this.hideCompletionMenu();
            return;
        }
        const focusNode = sel.focusNode;
        if (focusNode?.nodeType !== Node.TEXT_NODE) {
            this.hideCompletionMenu();
            return;
        }
        const focusText = focusNode as Text;

        const quoteEl = getBlockquoteElement(focusText);
        if (!quoteEl) {
            this.hideCompletionMenu();
            return;
        }

        const cursorOffset = sel.focusOffset;
        const text = focusText.textContent || "";
        const textBeforeCursor = text.substring(0, cursorOffset);

        if (this.completionSession.active) {
            if (cursorOffset < this.completionSession.start) {
                this.hideCompletionMenu();
                return;
            }

            if (!this.isFirstLineOfQuote(quoteEl, focusText)) {
                if (this.completionVisible) this.hideCompletionMenu();
                return;
            }

            const lineEl = getQuoteContentLineElement(quoteEl, focusText);
            if (!isTriggerAtLogicalLineStart(lineEl, focusText, this.completionSession.start)) {
                this.hideCompletionMenu();
                return;
            }

            const segment = text.slice(this.completionSession.start, cursorOffset);
            const sessionMatch = segment.match(SESSION_TRIGGER_PATTERN);
            if (!sessionMatch) {
                this.hideCompletionMenu();
                return;
            }

            const rect = sel.getRangeAt(0).getBoundingClientRect();
            const block = (focusText.parentElement?.closest?.("[data-node-id]") as HTMLElement | null) || focusText.parentElement as HTMLElement;
            this.showCompletionMenu(sessionMatch[1], rect, block || focusText.parentElement as HTMLElement);
            return;
        }

        const insertedText = e?.data || "";
        const lastChar = textBeforeCursor.slice(-1);
        const isInsertInput = typeof e?.inputType === "string" && e.inputType.startsWith("insert");
        
        // 支持中文输入法：当 compositionend 后调用时 e 为 undefined，此时需要检查 lastChar 是否为触发字符
        const isTriggerInput = !e 
            ? isTriggerChar(lastChar)  // compositionend 触发：仅检查最后字符
            : isInsertInput && (
                isTriggerChar(insertedText) ||
                (isTriggerChar(lastChar) && (!insertedText || insertedText === lastChar))
            );
        
        if (!isTriggerInput) {
            if (this.completionVisible) this.hideCompletionMenu();
            return;
        }

        if (!this.isFirstLineOfQuote(quoteEl, focusText)) {
            if (this.completionVisible) this.hideCompletionMenu();
            return;
        }

        const match = textBeforeCursor.match(TRIGGER_PATTERN);
        if (match) {
            const triggerStart = textBeforeCursor.lastIndexOf(match[0]);
            const lineEl = getQuoteContentLineElement(quoteEl, focusText);
            if (!isTriggerAtLogicalLineStart(lineEl, focusText, triggerStart)) {
                if (this.completionVisible) this.hideCompletionMenu();
                return;
            }

            this.completionSession.active = true;
            this.completionSession.quote = quoteEl;
            this.completionSession.start = triggerStart;
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            const block = (focusText.parentElement?.closest?.("[data-node-id]") as HTMLElement | null) || focusText.parentElement as HTMLElement;
            this.showCompletionMenu(match[1], rect, block || focusText.parentElement as HTMLElement);
        } else {
            if (this.completionVisible) this.hideCompletionMenu();
        }
    };

    private handleCompletionCompositionStart = () => {
        this.isComposing = true;
    };

    private handleCompletionCompositionEnd = () => {
        this.isComposing = false;
        setTimeout(() => this.handleCompletionInput(undefined as any), 10);
    };

    private handleCompletionKeydown = (e: KeyboardEvent) => {
        if (!this.completionVisible || !this.completionMenuElement) return;
        if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.completionIndex = (this.completionIndex - 1 + this.completionFiltered.length) % this.completionFiltered.length;
            this.renderCompletionMenu();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.completionIndex = (this.completionIndex + 1) % this.completionFiltered.length;
            this.renderCompletionMenu();
        } else if (e.key === "Home") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.completionIndex = 0;
            this.renderCompletionMenu();
        } else if (e.key === "End") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.completionIndex = this.completionFiltered.length - 1;
            this.renderCompletionMenu();
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.applyCompletion();
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.hideCompletionMenu();
        }
    };

    private handleCompletionMousedown = (e: MouseEvent) => {
        if (this.completionMenuElement && !this.completionMenuElement.contains(e.target as Node)) {
            this.hideCompletionMenu();
        }
    };

    private handleSelectionChange = () => {
        if (!this.completionSession.active) return;
        const sel = window.getSelection();
        const focusNode = sel?.focusNode || null;
        const quote = focusNode ? getBlockquoteElement(focusNode) : null;
        if (!sel || !sel.rangeCount || !quote || quote !== this.completionSession.quote) {
            this.hideCompletionMenu();
        }
    };

    onload() {
        if ((window as any)[STARTUP_FLAG]) return;
        (window as any)[STARTUP_FLAG] = true;

        this.listen(document, "focusin", this.handleTitleFocusIn, true);
        this.listen(document, "focusout", this.handleTitleFocusOut, true);
        this.listen(document, "keydown", this.handleGlobalKeydown, true);
        this.listen(document, "beforeinput", this.guardTitleEvents, true);
        this.listen(document, "input", this.guardTitleEvents, true);
        this.listen(document, "compositionstart", this.guardTitleEvents, true);
        this.listen(document, "compositionupdate", this.guardTitleEvents, true);
        this.listen(document, "compositionend", this.guardTitleEvents, true);
        this.listen(document, "pointerdown", this.handleGlobalPointerDown, true);

        this.listen(document.body, "click", this.handleGlobalClick, true);
        this.listen(document.body, "input", this.handleCompletionInput as EventListener, true);
        this.listen(document.body, "compositionstart", this.handleCompletionCompositionStart, true);
        this.listen(document.body, "compositionend", this.handleCompletionCompositionEnd, true);
        this.listen(document.body, "mousedown", this.handleCompletionMousedown, true);
        this.listen(document, "selectionchange", this.handleSelectionChange, true);

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if ((node as HTMLElement).classList.contains("callout")) {
                            this.initCallout(node as HTMLElement);
                        } else {
                            (node as HTMLElement).querySelectorAll?.(".callout").forEach((item) => this.initCallout(item as HTMLElement));
                        }
                    }
                });
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    onLayoutReady() {
        this.scanAllCallouts();
    }

    onunload() {
        this.cleanupHandlers.forEach((fn) => fn());
        this.cleanupHandlers = [];
        this.observer?.disconnect();
        this.observer = null;
        this.hideCalloutTypeMenu();
        this.hideCompletionMenu();
        this.calloutTypeMenuElement?.remove();
        this.calloutTypeMenuElement = null;
        this.completionMenuElement?.remove();
        this.completionMenuElement = null;
        delete (window as any)[STARTUP_FLAG];
    }
}
