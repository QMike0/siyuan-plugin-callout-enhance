import { Plugin, IOperation, showMessage } from "siyuan";
import "./index.scss";
import { closestTitleFromTarget, focusNewBlockEditableStart, getCalloutFromEventTarget, getSelectionCallout, placeCaretAtEnd } from "./utils/dom";
import { getCalloutBodyContainer, getCalloutBodyLineCount, hasCalloutBody, isCalloutSettingsPreview } from "./utils/callout";
import { getParentBlockLikeSiyuan } from "./utils/getBlock";
import { createTransaction, getCurrentProtyle } from "./core/api";
import {
    countCalloutsBySubtypes,
    countCalloutsForTypeItem,
    type CalloutBlockCountResult,
    isEditorReadOnly,
    isPublishService,
    isWorkspaceReadOnly,
} from "./core/cl_api";
import { deleteCallout } from "./features/callout_delete";
import { setFoldState } from "./features/callout_fold";
import { ensureCalloutTitleEditable, guardTitleEvents, handleTitleCompositionEnd, handleTitleCompositionStart, handleTitleFocusIn, handleTitleFocusOut, handleTitleInput, handleTitleKeydown, hideProtyleToolbarForTitle, preventTitleToolbarRender, preventTitleToolbarShortcut, selectCalloutTitleText } from "./features/title_edit";
import { CompletionSession, handleCompletionCompositionEnd, handleCompletionCompositionStart, handleCompletionInput, handleCompletionKeydown, handleCompletionMousedown, handleSelectionChange, hideCompletionMenu } from "./features/completion_menu";
import { CalloutTypeItem } from "./utils/callout_types";
import { CalloutEnhanceSettings, createDefaultCalloutSettings, getResolvedCalloutTypes, isDefaultAppearancePreset, normalizeCalloutSettings, prepareCalloutSettings, SETTINGS_SCHEMA_VERSION } from "./utils/settings";
import { getCalloutHeaderHitAreas } from "./utils/callout_header_hit";
import { CalloutLayoutSettings, normalizeCalloutLayout } from "./utils/callout_layout_vars";
import {
    applyCalloutDynamicStylesheet,
    buildCalloutDynamicStylesheet,
    DYNAMIC_STYLE_ID,
    removeCalloutDynamicStylesheet,
    removeCalloutExportStylesheet,
    syncCalloutExportStylesheet,
} from "./utils/callout_dynamic_styles";
import { handleCalloutTypeKeydown, hideCalloutTypeMenu, showCalloutTypeMenu } from "./features/type_menu";
import { debugLog, errorLog, setDebugEnabled, warnLog } from "./utils/logger";
import { openSettingsDialog } from "./components/settings_panel";
import { runCleanup, clearLegacyCalloutMetadata, type CleanupResult, type RunCleanupOptions } from "./utils/migration";
import { registerPluginIcons } from "./utils/icons";
import { setPluginI18n, t } from "./utils/i18n";

const STARTUP_FLAG = "__calloutEnhancePluginInitialized";
const PUBLISH_BODY_CLASS = "callout-enhance-publish-service";
const STORAGE_NAME = "callout-enhance-settings";

export default class CalloutEnhancePlugin extends Plugin {
    declare data: {
        settings?: CalloutEnhanceSettings;
    };

    private cleanupHandlers: Array<() => void> = [];
    private calloutCleanupAbort: AbortController | null = null;
    settings: CalloutEnhanceSettings = createDefaultCalloutSettings();
    resolvedCalloutTypes: CalloutTypeItem[] = getResolvedCalloutTypes(this.settings);
    private appearancePreviewLayout: CalloutLayoutSettings | null = null;

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
        if (isPublishService()) {
            ensureCalloutTitleEditable(titleEl);
            this.titleBoundEls.add(titleEl);
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

    /** SQL count of callout blocks matching subtypes (case-insensitive). */
    countCalloutsBySubtypes(subtypes: string[]): Promise<CalloutBlockCountResult> {
        return countCalloutsBySubtypes(subtypes);
    }

    /** Count blocks for one type's label + past labels. */
    countCalloutsForTypeItem(item: Pick<CalloutTypeItem, "label" | "pastLabels">): Promise<CalloutBlockCountResult> {
        return countCalloutsForTypeItem(item);
    }

    isWorkspaceReadOnly() {
        return isWorkspaceReadOnly();
    }

    isEditorReadOnly() {
        return isEditorReadOnly();
    }

    abortCalloutCleanup() {
        this.calloutCleanupAbort?.abort();
    }

    async runCalloutCleanup(
        options: Pick<RunCleanupOptions, "signal" | "onProgress" | "getSettings" | "saveSettings" | "forceClearMetadata" | "progressOffset" | "migrateEndPercent"> & {
            signal?: AbortSignal;
            /** When provided (with `signal`), `abortCalloutCleanup()` aborts this controller. */
            abortController?: AbortController;
        },
    ): Promise<CleanupResult> {
        const ownController = options.signal || options.abortController
            ? null
            : new AbortController();
        const controller = options.abortController ?? ownController;
        this.calloutCleanupAbort = controller;
        const signal = options.signal ?? controller!.signal;
        const getSettings = options.getSettings ?? (() => normalizeCalloutSettings(this.settings));
        const saveSettings = options.saveSettings ?? ((partial) => this.setSettings(partial));
        try {
            return await runCleanup({
                settings: getSettings(),
                getSettings,
                saveSettings,
                signal,
                onProgress: options.onProgress,
                onStylesUpdate: () => this.updateDynamicCalloutStyles(),
                forceClearMetadata: options.forceClearMetadata,
                progressOffset: options.progressOffset,
                migrateEndPercent: options.migrateEndPercent,
            });
        } finally {
            if (this.calloutCleanupAbort === controller) {
                this.calloutCleanupAbort = null;
            }
        }
    }

    async clearLegacyCalloutMetadata(
        options: Partial<Pick<RunCleanupOptions, "getSettings" | "saveSettings">> = {},
    ) {
        const getSettings = options.getSettings ?? (() => normalizeCalloutSettings(this.settings));
        const saveSettings = options.saveSettings ?? ((partial) => this.setSettings(partial));
        await clearLegacyCalloutMetadata({
            getSettings,
            saveSettings,
            onStylesUpdate: () => this.updateDynamicCalloutStyles(),
        });
    }

    private getEffectiveCalloutLayout() {
        return normalizeCalloutLayout(this.appearancePreviewLayout || this.settings.layout);
    }

    private updateDynamicCalloutStyles() {
        const css = buildCalloutDynamicStylesheet({
            settings: this.settings,
            layout: this.getEffectiveCalloutLayout(),
        });
        applyCalloutDynamicStylesheet(css, DYNAMIC_STYLE_ID);
        syncCalloutExportStylesheet(css);
    }

    /** Re-run after sprites/layout settle so `symbol:*` icons resolve reliably. */
    private refreshDynamicCalloutStylesAfterPaint() {
        if (typeof requestAnimationFrame === "undefined") {
            this.updateDynamicCalloutStyles();
            return;
        }
        requestAnimationFrame(() => this.updateDynamicCalloutStyles());
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
        const { settings, migrated, fromVersion } = prepareCalloutSettings(saved);
        this.settings = settings;
        this.resolvedCalloutTypes = getResolvedCalloutTypes(this.settings);
        setDebugEnabled(!!this.settings.debugLogEnabled);
        this.updateDynamicCalloutStyles();
        if (migrated) {
            debugLog(`[Settings] Migrated schema v${fromVersion} → v${SETTINGS_SCHEMA_VERSION}`);
            await this.persistSettings();
        }
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
                showMessage(t("transactionBlockSaveFailed"));
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
            showMessage(t("transactionEmptyCalloutEnterFailed"));
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

    /** Publish: block callout header interactions without registering editor edit handlers. */
    private handlePublishCalloutClickGuard = (e: MouseEvent) => {
        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout || isCalloutSettingsPreview(callout)) return;

        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const hit = getCalloutHeaderHitAreas(callout);
        const onTypeIcon = clickX >= hit.typeMenuLeft && clickX <= hit.typeMenuRight && clickY <= hit.headerHeight;
        const onFold = clickX >= rect.width - hit.foldButtonWidth && clickY <= hit.headerHeight;
        const onTitle = !!(e.target as HTMLElement | null)?.closest?.(".callout-title");

        if (onTypeIcon || onFold || onTitle) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };

    private handleGlobalPointerDown = (e: PointerEvent) => {
        if (isPublishService()) return;
        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout || isCalloutSettingsPreview(callout)) return;
        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const hit = getCalloutHeaderHitAreas(callout);
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

        if (isPublishService()) return;

        const callout = (e.target as HTMLElement | null)?.closest?.('.callout[data-type="NodeCallout"]') as HTMLElement | null;
        if (!callout || isCalloutSettingsPreview(callout)) return;

        const rect = callout.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const blockId = callout.dataset.nodeId;

        const hit = getCalloutHeaderHitAreas(callout);

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

        if (isPublishService()) return;

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
        setPluginI18n(this.i18n);

        if (isPublishService()) {
            document.body.classList.add(PUBLISH_BODY_CLASS);
        }

        registerPluginIcons(this);

        // Phase A: inject defaults before async settings load to reduce first-paint flash.
        this.updateDynamicCalloutStyles();

        await this.loadSettings();
        this.refreshDynamicCalloutStylesAfterPaint();
        this.data = { settings: this.settings };
        (window as any).__calloutEnhancePlugin = this;
        this.openSetting = this.openSetting.bind(this);

        if (isPublishService()) {
            this.listen(document, "click", this.handlePublishCalloutClickGuard, true);
        } else {
            this.listen(document, "focusin", (e) => handleTitleFocusIn(this, e as FocusEvent), true);
            this.listen(document, "focusout", (e) => handleTitleFocusOut(this, e as FocusEvent), true);
            this.listen(document, "keydown", this.handleGlobalKeydown, true);
            this.listen(document, "keyup", (e) => preventTitleToolbarRender(e, this), true);
            this.listen(document, "mouseup", (e) => preventTitleToolbarRender(e, this), true);
            this.listen(document, "selectionchange", () => hideProtyleToolbarForTitle(document.activeElement, this), true);
            this.listen(document, "beforeinput", (e) => guardTitleEvents(this, e), true);
            this.listen(document, "paste", (e) => guardTitleEvents(this, e), true);
            this.listen(document, "input", (e) => handleTitleInput(this, e as Event), true);
            this.listen(document, "input", (e) => guardTitleEvents(this, e), true);
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
            this.listen(document.body, "selectionchange", () => handleSelectionChange(this), true);
        }

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
        this.updateDynamicCalloutStyles();
    }

    openSetting() {
        openSettingsDialog(this);
    }

    /** Keep `callout-enhance-settings` on disk so reinstall restores types, pastLabels, tombstone, layout, etc. */
    async uninstall() {
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
        removeCalloutDynamicStylesheet(DYNAMIC_STYLE_ID);
        removeCalloutExportStylesheet();
        document.body.classList.remove(PUBLISH_BODY_CLASS);
        delete (window as any)[STARTUP_FLAG];
    }
}
