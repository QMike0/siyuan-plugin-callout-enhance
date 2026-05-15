import { Plugin, IOperation, showMessage } from "siyuan";
import "./index.scss";
import { closestTitleFromTarget, getCalloutFromEventTarget, getSelectionCallout, placeCaretAtEnd } from "./utils/dom";
import { getCalloutBodyContainer, getCalloutBodyLineCount, hasCalloutBody } from "./utils/callout";
import { createTransaction, getCurrentProtyle, getNewNodeId } from "./core/api";
import { cleanCalloutTitleEditable, ensureCalloutTitleEditable, normalizeCalloutTitlePlainText, normalizeCalloutTitlePlainTextFromMarkdown, guardTitleEvents, handleTitleCompositionEnd, handleTitleCompositionStart, handleTitleFocusIn, handleTitleFocusOut, handleTitleInput, handleTitleKeydown } from "./features/title_edit";
import { CALLOUT_TYPES, handleCompletionCompositionEnd, handleCompletionCompositionStart, handleCompletionInput, handleCompletionKeydown, handleCompletionMousedown, handleSelectionChange, hideCompletionMenu, CompletionSession } from "./features/completion_menu";

const DEBUG = true;
const STARTUP_FLAG = "__calloutEnhancePluginInitialized";

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


export default class CalloutEnhancePlugin extends Plugin {
    private cleanupHandlers: Array<() => void> = [];
    private observer: MutationObserver | null = null;
    private isComposing = false;
    private titleBoundEls = new WeakSet<HTMLElement>();
    private titleEnterInFlight = new Set<string>();
    private titleEditSnapshots = new WeakMap<HTMLElement, string>();
    private calloutHtmlSnapshots = new WeakMap<HTMLElement, string>();
    private titleEditDebounceTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    private titleEditComposing = new Set<HTMLElement>();

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


    private isUndoRedoShortcut(e: KeyboardEvent) {
        const key = (e.key || "").toLowerCase();
        const withModifier = e.ctrlKey || e.metaKey;
        if (!withModifier) return false;
        return key === "z" || key === "y";
    }

    private getCalloutParentAndPrevious(block: HTMLElement) {
        const parent = block.parentElement as HTMLElement | null;
        const previous = block.previousElementSibling as HTMLElement | null;
        const parentID = parent?.dataset?.nodeId || "";
        const previousID = previous?.dataset?.nodeId || "";
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
        
        const protyle = getCurrentProtyle(this,blockElement);
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
            
            const ok = createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                warn("[WARN] Transaction API unavailable during title save", { blockId });
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
        const protyle = getCurrentProtyle(this,block);
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
            const ok = createTransaction(protyle, doOperations, undoOperations);
            if (!ok) {
                warn("[WARN] Transaction API unavailable during callout delete", { blockId });
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




    private handleBodyArrowLeft = (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft") return;
        if (closestTitleFromTarget(e.target)) return;

        const currentCallout = getSelectionCallout();
        if (!currentCallout) return;

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const content = getCalloutBodyContainer(currentCallout);
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
            hideCompletionMenu(this);
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
            handleCompletionKeydown(this, e);
            return;
        }

        const titleEl = closestTitleFromTarget(e.target);
        if (titleEl) {
            if (e.key === "Enter") {
                handleTitleKeydown(this, e);
                return;
            }
            if (this.isUndoRedoShortcut(e)) return;
            guardTitleEvents(this, e);
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



    onload() {
        if ((window as any)[STARTUP_FLAG]) return;
        (window as any)[STARTUP_FLAG] = true;

        this.listen(document, "focusin", (e) => handleTitleFocusIn(this, e as FocusEvent), true);
        this.listen(document, "focusout", (e) => handleTitleFocusOut(this, e as FocusEvent), true);
        this.listen(document, "keydown", this.handleGlobalKeydown, true);
        this.listen(document, "beforeinput", (e) => guardTitleEvents(this, e), true);
        this.listen(document, "paste", (e) => guardTitleEvents(this, e), true);
        // 标题 input 事件：防抖后自动保存（在 guardTitleEvents 之前执行）
        this.listen(document, "input", (e) => handleTitleInput(this, e as Event), true);
        this.listen(document, "input", (e) => guardTitleEvents(this, e), true);
        // 标题 composition 事件：跟踪 IME 输入状态
        this.listen(document, "compositionstart", (e) => handleTitleCompositionStart(this, e as Event), true);
        this.listen(document, "compositionstart", (e) => guardTitleEvents(this, e), true);
        this.listen(document, "compositionupdate", (e) => guardTitleEvents(this, e), true);
        this.listen(document, "compositionend", (e) => handleTitleCompositionEnd(this, e as Event), true);
        this.listen(document, "compositionend", (e) => guardTitleEvents(this, e), true);
        this.listen(document, "pointerdown", this.handleGlobalPointerDown, true);

        this.listen(document.body, "click", this.handleGlobalClick, true);
        this.listen(document.body, "input", (e) => handleCompletionInput(this, e as InputEvent), true);
        this.listen(document.body, "compositionstart", () => handleCompletionCompositionStart(this), true);
        this.listen(document.body, "compositionend", () => handleCompletionCompositionEnd(this), true);
        this.listen(document.body, "mousedown", (e) => handleCompletionMousedown(this, e as MouseEvent), true);
        this.listen(document, "selectionchange", () => handleSelectionChange(this), true);

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
        // 清除所有防抖 timer
        this.titleEditDebounceTimers.forEach((timer) => clearTimeout(timer));
        this.titleEditDebounceTimers.clear();
        this.titleEditComposing.clear();
        this.hideCalloutTypeMenu();
        hideCompletionMenu(this);
        this.calloutTypeMenuElement?.remove();
        this.calloutTypeMenuElement = null;
        this.completionMenuElement?.remove();
        this.completionMenuElement = null;
        delete (window as any)[STARTUP_FLAG];
    }
}
