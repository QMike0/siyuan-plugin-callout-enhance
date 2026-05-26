import { Plugin, IOperation, showMessage } from "siyuan";
import "./index.scss";
import { closestTitleFromTarget, focusNewBlockEditableStart, getCalloutFromEventTarget, getSelectionCallout, placeCaretAtEnd } from "./utils/dom";
import { getCalloutBodyContainer, getCalloutBodyLineCount, hasCalloutBody, isCalloutSettingsPreview } from "./utils/callout";
import { getParentBlockLikeSiyuan } from "./utils/getBlock";
import { createTransaction, getCurrentProtyle } from "./core/api";
import { deleteCallout } from "./features/callout_delete";
import { setFoldState } from "./features/callout_fold";
import { ensureCalloutTitleEditable, guardTitleEvents, handleTitleCompositionEnd, handleTitleCompositionStart, handleTitleFocusIn, handleTitleFocusOut, handleTitleInput, handleTitleKeydown, hideProtyleToolbarForTitle, preventTitleToolbarRender, preventTitleToolbarShortcut, selectCalloutTitleText } from "./features/title_edit";
import { CompletionSession, handleCompletionCompositionEnd, handleCompletionCompositionStart, handleCompletionInput, handleCompletionKeydown, handleCompletionMousedown, handleSelectionChange, hideCompletionMenu } from "./features/completion_menu";
import { CalloutTypeItem, resolveCalloutIconMask } from "./utils/callout_types";
import { CalloutEnhanceSettings, createDefaultCalloutSettings, getAllResolvedCalloutTypes, getResolvedCalloutTypes, isDefaultAppearancePreset, normalizeCalloutSettings } from "./utils/settings";
import { buildCalloutLayoutStylesheet, CalloutLayoutSettings, normalizeCalloutLayout } from "./utils/callout_layout_vars";
import { handleCalloutTypeKeydown, hideCalloutTypeMenu, showCalloutTypeMenu } from "./features/type_menu";
import { debugLog, errorLog, setDebugEnabled, warnLog } from "./utils/logger";
import { openSettingsDialog } from "./components/settings_panel";
import { registerPluginIcons } from "./utils/icons";
const STARTUP_FLAG = "__calloutEnhancePluginInitialized";
const STORAGE_NAME = "callout-enhance-settings";
const DYNAMIC_STYLE_ID = "callout-enhance-dynamic-styles";

function escapeCssString(value: string) {
    return (value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n|\r|\f/g, "");
}

function safeCssValue(value: string) {
    const trimmed = (value || "").trim();
    if (/^url\(/i.test(trimmed)) {
        return trimmed.replace(/[{}\n\r\f]/g, "");
    }
    return trimmed.replace(/[;{}\n\r\f]/g, "");
}

export default class CalloutEnhancePlugin extends Plugin {
    declare data: {
        settings?: CalloutEnhanceSettings;
    };

    private cleanupHandlers: Array<() => void> = [];
    settings: CalloutEnhanceSettings = createDefaultCalloutSettings();
    resolvedCalloutTypes: CalloutTypeItem[] = getResolvedCalloutTypes(this.settings);
    private appearancePreviewLayout: CalloutLayoutSettings | null = null;

    private getCalloutHeaderHitAreas(callout: HTMLElement) {
        const styles = getComputedStyle(callout);
        const iconLeft = parseFloat(styles.getPropertyValue("--callout-icon-left")) || 20;
        const headerXShift = parseFloat(styles.getPropertyValue("--callout-header-width-offset"))
            || parseFloat(styles.getPropertyValue("--callout-header-x-shift"))
            || 0;
        const iconSize = parseFloat(styles.getPropertyValue("--callout-icon-size")) || 16;
        const titleRowHeight = parseFloat(styles.getPropertyValue("--callout-header-height"))
            || parseFloat(styles.getPropertyValue("--callout-title-row-height"))
            || 28;
        const shellPaddingTop = parseFloat(styles.getPropertyValue("--callout-shell-padding-top")) || 10;

        const iconCenterX = iconLeft + headerXShift + iconSize / 2;
        const typeMenuHalfWidth = Math.max(12, iconSize * 0.7);
        const typeMenuLeft = Math.max(0, iconCenterX - typeMenuHalfWidth);
        const typeMenuRight = iconCenterX + typeMenuHalfWidth;
        const headerHeight = shellPaddingTop + titleRowHeight + 8;

        const foldVisible = styles.getPropertyValue("--callout-fold-after-display").trim() !== "none";
        const foldHitWidth = foldVisible
            ? (parseFloat(styles.getPropertyValue("--callout-fold-hit-width")) || 40)
            : 0;

        return {
            typeMenuLeft,
            typeMenuRight,
            headerHeight,
            foldButtonWidth: foldHitWidth,
        };
    }
    private observer: MutationObserver | null = null;
    isComposing = false;
    private titleBoundEls = new WeakSet<HTMLElement>();
    titleEnterInFlight = new Set<string>();
    titleEditSnapshots = new WeakMap<HTMLElement, string>();
    calloutHtmlSnapshots = new WeakMap<HTMLElement, string>();
    titleEditDebounceTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    titleEditComposing = new Set<HTMLElement>();

    calloutTypeMenuElement: HTMLDivElement | null = null;
    calloutTypeMenuActiveBlock: HTMLElement | null = null;
    calloutTypeMenuIndex = -1;

    completionMenuElement: HTMLDivElement | null = null;
    completionFiltered: CalloutTypeItem[] = [];
    completionIndex = -1;
    completionVisible = false;
    completionSession: CompletionSession = {
        active: false,
        quote: null,
        start: -1,
    };

    private listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        target.addEventListener(type, handler, options as any);
        this.cleanupHandlers.push(() => target.removeEventListener(type, handler, options as any));
    }


    isUndoRedoShortcut(e: KeyboardEvent) {
        const key = (e.key || "").toLowerCase();
        const withModifier = e.ctrlKey || e.metaKey;
        if (!withModifier) return false;
        return key === "z" || key === "y";
    }

    private initCallout(block: HTMLElement) {
        if (isCalloutSettingsPreview(block)) {
            block.dataset.enhanced = "true";
            return;
        }
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

    getCalloutTypes() {
        return this.resolvedCalloutTypes;
    }

    private getEffectiveCalloutLayout() {
        return normalizeCalloutLayout(this.appearancePreviewLayout || this.settings.layout);
    }

    private updateDynamicCalloutStyles() {
        let style = document.getElementById(DYNAMIC_STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.id = DYNAMIC_STYLE_ID;
            document.head.appendChild(style);
        }

        const rules: string[] = [];
        const layoutCss = buildCalloutLayoutStylesheet(this.getEffectiveCalloutLayout());
        if (layoutCss) rules.push(layoutCss);

        getAllResolvedCalloutTypes(this.settings).forEach((item) => {
            const subtype = (item.label || item.id || "").trim();
            if (!subtype) return;

            const selector = `.callout[data-type="NodeCallout"][data-subtype="${escapeCssString(subtype)}" i]`;
            const declarations: string[] = [];
            const color = safeCssValue(item.color);
            if (color && (!window.CSS?.supports || CSS.supports("color", color))) {
                declarations.push(`--local-color:${color}`);
            }

            const mask = safeCssValue(resolveCalloutIconMask(item.icon || item.label, item.label));
            if (declarations.length > 0) {
                rules.push(`${selector}{${declarations.join(";")}}`);
            }
            rules.push(`${selector}::before{-webkit-mask:${mask} center / cover no-repeat;mask:${mask} center / cover no-repeat}`);
        });

        style.textContent = rules.join("\n");
    }

    previewCalloutLayout(layout: Partial<CalloutLayoutSettings>) {
        this.appearancePreviewLayout = normalizeCalloutLayout({
            ...normalizeCalloutLayout(this.settings.layout),
            ...layout,
        });
        this.updateDynamicCalloutStyles();
    }

    clearAppearancePreview() {
        this.appearancePreviewLayout = null;
        this.updateDynamicCalloutStyles();
    }

    async reloadAppearanceFromDisk() {
        const saved = (await this.loadData(STORAGE_NAME)) as Partial<CalloutEnhanceSettings> | null;
        const normalized = normalizeCalloutSettings(saved);
        this.restoreAppearanceState({
            layout: normalized.layout,
            appearancePresets: normalized.appearancePresets,
            activeAppearancePresetId: normalized.activeAppearancePresetId,
        });
        this.clearAppearancePreview();
    }

    applyCalloutLayout(layout: Partial<CalloutLayoutSettings>) {
        this.clearAppearancePreview();
        this.settings = normalizeCalloutSettings({
            ...this.settings,
            layout: {
                ...normalizeCalloutLayout(this.settings.layout),
                ...layout,
            },
            appearancePresets: this.settings.appearancePresets?.map((preset) => (
                preset.id === this.settings.activeAppearancePresetId && !isDefaultAppearancePreset(preset.id)
                    ? { ...preset, layout: normalizeCalloutLayout({ ...preset.layout, ...layout }) }
                    : preset
            )),
        });
        this.updateDynamicCalloutStyles();
    }

    restoreAppearanceState(settings: Pick<CalloutEnhanceSettings, "layout" | "appearancePresets" | "activeAppearancePresetId">) {
        this.clearAppearancePreview();
        this.settings = normalizeCalloutSettings({
            ...this.settings,
            layout: settings.layout,
            appearancePresets: settings.appearancePresets,
            activeAppearancePresetId: settings.activeAppearancePresetId,
        });
        this.updateDynamicCalloutStyles();
    }

    async setSettings(settings: Partial<CalloutEnhanceSettings>) {
        this.settings = normalizeCalloutSettings({
            ...this.settings,
            ...settings,
            callouts: settings.callouts ? settings.callouts : this.settings.callouts,
            layout: settings.layout
                ? { ...normalizeCalloutLayout(this.settings.layout), ...settings.layout }
                : this.settings.layout,
            appearancePresets: settings.appearancePresets ?? this.settings.appearancePresets,
            activeAppearancePresetId: settings.activeAppearancePresetId ?? this.settings.activeAppearancePresetId,
        });
        this.resolvedCalloutTypes = getResolvedCalloutTypes(this.settings);
        this.updateDynamicCalloutStyles();
        if (settings.debugLogEnabled !== undefined) {
            setDebugEnabled(!!this.settings.debugLogEnabled);
        }
        await this.persistSettings();
    }

    private async loadSettings() {
        const saved = (await this.loadData(STORAGE_NAME)) as Partial<CalloutEnhanceSettings> | null;
        this.settings = normalizeCalloutSettings(saved);
        this.resolvedCalloutTypes = getResolvedCalloutTypes(this.settings);
        setDebugEnabled(!!this.settings.debugLogEnabled);
        this.updateDynamicCalloutStyles();
    }

    private async persistSettings() {
        await this.saveData(STORAGE_NAME, this.settings);
    }

    async syncBlock(blockElement: HTMLElement, originalHtml?: string, reason: "title" | "fold" | "type" = "title") {
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
                debugLog(`[Block/${reason}] No changes for block`, blockId);
                return true;
            }

            debugLog(`[Block/${reason}] Saving block`, blockId);
            
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
                warnLog(`[WARN] Transaction API unavailable during block save (${reason})`, { blockId });
                errorLog(`[ERROR] Block save transaction failed (${reason}) for block`, blockId);
                showMessage("无法调用思源事务接口，块修改未保存");
                return false;
            }
            return true;
        } catch (err) {
            errorLog("[ERROR] Title save exception for block", blockId, ":", err);
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

    // 模拟的是思源笔记源码app/src/protyle/wysiwyg/getBlock.ts的getParentBlock函数
    private moveEmptyCalloutBodyBlockAfterCallout = async (callout: HTMLElement, sourceTarget: EventTarget | null) => {
        const blockId = callout.dataset.nodeId || "";
        const content = getCalloutBodyContainer(callout);
        const bodyBlock = Array.from(content.children).find((child) => {
            const el = child as HTMLElement;
            return !el.classList.contains("protyle-attr") && !el.classList.contains("callout-title") && !el.classList.contains("callout-info") && !!el.getAttribute("data-node-id");
        }) as HTMLElement | undefined;
        const bodyBlockId = bodyBlock?.dataset.nodeId || "";
        const protyle = getCurrentProtyle(this, callout, sourceTarget instanceof Node ? sourceTarget : callout);

        if (!blockId || !bodyBlock || !bodyBlockId || !protyle) {
            warnLog("[WARN] Empty callout enter failed: missing context", { blockId, bodyBlockId });
            return false;
        }

        const originalCalloutHtml = callout.outerHTML;
        const originalBodyBlockHtml = bodyBlock.outerHTML;
        const parentBlockElement = getParentBlockLikeSiyuan(bodyBlock);
        const previousSibling = callout.previousElementSibling as HTMLElement | null;
        const previousID = previousSibling?.getAttribute("data-node-id") || "";
        const parentID = getParentBlockLikeSiyuan(callout)?.getAttribute("data-node-id") || (protyle as any).block?.parentID || "";
        if (!parentBlockElement || parentBlockElement !== callout || !parentID) {
            warnLog("[WARN] Empty callout enter failed: invalid parent context", { blockId, bodyBlockId, parentID });
            return false;
        }

        bodyBlock.remove();
        callout.replaceWith(bodyBlock);
        focusNewBlockEditableStart(bodyBlock);

        const doOperations: IOperation[] = [
            { action: "delete", id: blockId },
            { action: "insert", id: bodyBlockId, previousID, parentID, data: originalBodyBlockHtml },
        ];
        const undoOperations: IOperation[] = [
            { action: "delete", id: bodyBlockId },
            { action: "insert", id: blockId, previousID, parentID, data: originalCalloutHtml },
        ];
        const ok = createTransaction(protyle, doOperations, undoOperations);
        if (!ok) {
            bodyBlock.remove();
            if (callout.isConnected) {
                content.insertAdjacentElement("afterbegin", bodyBlock);
            } else {
                const wrapper = document.createElement("div");
                wrapper.innerHTML = originalCalloutHtml;
                const restoredCallout = wrapper.firstElementChild as HTMLElement | null;
                if (restoredCallout) bodyBlock.replaceWith(restoredCallout);
            }
            warnLog("[WARN] Transaction API unavailable during empty callout enter", { blockId, bodyBlockId });
            showMessage("无法调用思源事务接口，空 callout 回车处理失败");
            return false;
        }
        return true;
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

        const moved = await this.moveEmptyCalloutBodyBlockAfterCallout(callout, e.target);
        if (!moved) {
            await deleteCallout(this, callout);
        }
    };

    private handleGlobalPointerDown = (e: PointerEvent) => {
        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout || isCalloutSettingsPreview(callout)) return;
        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const hit = this.getCalloutHeaderHitAreas(callout);
        if ((clickX >= hit.typeMenuLeft && clickX <= hit.typeMenuRight && clickY <= hit.headerHeight) || (clickX >= rect.width - hit.foldButtonWidth && clickY <= hit.headerHeight)) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    private handleGlobalClick = (e: MouseEvent) => {
        if (this.calloutTypeMenuElement && !this.calloutTypeMenuElement.contains(e.target as Node)) {
            hideCalloutTypeMenu(this);
        }
        if (this.completionMenuElement && !this.completionMenuElement.contains(e.target as Node)) {
            hideCompletionMenu(this);
        }

        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout || isCalloutSettingsPreview(callout)) return;

        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const blockId = callout.dataset.nodeId;

        const hit = this.getCalloutHeaderHitAreas(callout);

        if (clickX >= hit.typeMenuLeft && clickX <= hit.typeMenuRight && clickY <= hit.headerHeight) {
            e.preventDefault();
            e.stopPropagation();
            showCalloutTypeMenu(this, callout, e.clientX, e.clientY);
            return;
        }

        if (clickX >= rect.width - hit.foldButtonWidth && clickY <= hit.headerHeight && blockId) {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyFolded = callout.getAttribute("fold") === "1";
            const nextFold = !isCurrentlyFolded;
            setFoldState(this, callout, nextFold);
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
        if (calloutTypeMenuOpen && ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Tab", "Escape"].indexOf(e.key) !== -1) {
            handleCalloutTypeKeydown(this, e);
            return;
        }

        if (this.completionVisible && this.completionMenuElement && ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Tab", "Escape"].indexOf(e.key) !== -1) {
            handleCompletionKeydown(this, e);
            return;
        }

        const titleEl = closestTitleFromTarget(e.target);
        if (titleEl) {
            if (e.key === "Enter") {
                handleTitleKeydown(this, e);
                return;
            }
            if (selectCalloutTitleText(e)) return;
            if (this.isUndoRedoShortcut(e)) return;
            if (preventTitleToolbarShortcut(e, this)) return;
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



    async onload() {
        if ((window as any)[STARTUP_FLAG]) return;
        (window as any)[STARTUP_FLAG] = true;

        registerPluginIcons(this);

        await this.loadSettings();
        this.data = { settings: this.settings };
        (window as any).__calloutEnhancePlugin = this;
        this.openSetting = this.openSetting.bind(this);

        this.listen(document, "focusin", (e) => handleTitleFocusIn(this, e as FocusEvent), true);
        this.listen(document, "focusout", (e) => handleTitleFocusOut(this, e as FocusEvent), true);
        this.listen(document, "keydown", this.handleGlobalKeydown, true);
        this.listen(document, "keyup", (e) => preventTitleToolbarRender(e, this), true);
        this.listen(document, "mouseup", (e) => preventTitleToolbarRender(e, this), true);
        this.listen(document, "selectionchange", () => hideProtyleToolbarForTitle(document.activeElement, this), true);
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

    openSetting() {
        openSettingsDialog(this);
    }

    async onunload() {
        this.clearAppearancePreview();
        this.cleanupHandlers.forEach((fn) => fn());
        this.cleanupHandlers = [];
        this.observer?.disconnect();
        this.observer = null;
        // 清除所有防抖 timer
        this.titleEditDebounceTimers.forEach((timer) => clearTimeout(timer));
        this.titleEditDebounceTimers.clear();
        this.titleEditComposing.clear();
        hideCalloutTypeMenu(this);
        hideCompletionMenu(this);
        this.calloutTypeMenuElement?.remove();
        this.calloutTypeMenuElement = null;
        this.completionMenuElement?.remove();
        this.completionMenuElement = null;
        document.getElementById(DYNAMIC_STYLE_ID)?.remove();
        delete (window as any)[STARTUP_FLAG];
    }
}
