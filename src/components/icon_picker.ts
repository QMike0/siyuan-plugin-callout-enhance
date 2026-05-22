import {
    hasSymbol,
    listAllSymbolEntries,
    parseIconRef,
    renderSymbolUseHtml,
    searchSymbolEntries,
    stringifyIconRef,
    SymbolEntry,
} from "../utils/icons";

/**
 * Icon picker popover (anchored panel).
 *
 * Unlike a nested Dialog overlay, this panel is positioned below the trigger
 * button — similar to the native `<input type="color">` popover. A single
 * scroll area is used inside the panel. Clicking outside confirms the current
 * selection and closes the panel.
 */

type GroupTab = "all" | "plugin" | "host";

export type IconPickerResult =
    | { type: "symbol"; id: string }
    | { type: "reset" };

export type IconPickerOptions = {
    /** Button (or element) the popover anchors to. */
    anchor: HTMLElement;
    /** Currently stored icon ref string (e.g. "symbol:iconCalloutInfo"). */
    current?: string;
    fallbackLabel?: string;
    onPick: (value: string, result: IconPickerResult) => void;
};

const TAB_LABELS: Record<GroupTab, string> = {
    all: "All",
    plugin: "Plugin",
    host: "SiYuan",
};

const CELL_SIZE_PX = 36;
const ICON_SIZE_PX = 20;
const POPOVER_WIDTH_PX = 360;
const POPOVER_MAX_HEIGHT_PX = 420;

let activeCleanup: (() => void) | null = null;

export function closeIconPicker() {
    activeCleanup?.();
    activeCleanup = null;
}

export function openIconPicker(opts: IconPickerOptions) {
    closeIconPicker();

    const allEntries = listAllSymbolEntries();
    const currentRef = parseIconRef(opts.current);
    const currentSymbolId = currentRef.kind === "symbol" ? currentRef.id : "";
    const currentMissing = !!currentSymbolId && !hasSymbol(currentSymbolId);

    let activeTab: GroupTab = "all";
    let appliedQuery = "";
    let selectedId = currentSymbolId;
    let closed = false;

    const popover = document.createElement("div");
    popover.className = "callout-enhance-icon-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Choose icon");

    const searchRow = document.createElement("div");
    searchRow.className = "callout-enhance-icon-popover__search";

    const search = document.createElement("input");
    search.className = "b3-text-field";
    search.type = "text";
    search.placeholder = "Search by name or keyword...";
    search.autocomplete = "off";
    search.spellcheck = false;

    const searchBtn = document.createElement("button");
    searchBtn.className = "callout-enhance-icon-popover__search-btn";
    searchBtn.type = "button";
    searchBtn.title = "Search";
    searchBtn.setAttribute("aria-label", "Search");
    searchBtn.innerHTML = renderSymbolUseHtml("iconSearch", "16px");

    searchRow.append(search, searchBtn);

    const tabsRow = document.createElement("div");
    tabsRow.className = "callout-enhance-icon-popover__tabs callout-enhance-icon-picker-tabs";

    const tabButtons: Record<GroupTab, HTMLButtonElement> = {
        all: createTabButton("all"),
        plugin: createTabButton("plugin"),
        host: createTabButton("host"),
    };
    tabsRow.append(tabButtons.all, tabButtons.plugin, tabButtons.host);

    const countLabel = document.createElement("span");
    countLabel.className = "b3-label__text callout-enhance-icon-popover__count";
    tabsRow.append(countLabel);

    const missingHint = document.createElement("div");
    missingHint.className = "callout-enhance-icon-picker-missing";
    missingHint.style.display = currentMissing ? "flex" : "none";

    const missingText = document.createElement("span");
    missingText.textContent = currentMissing
        ? `Icon "${currentSymbolId}" is not available. It will use the default icon.`
        : "";

    const missingReset = document.createElement("button");
    missingReset.className = "b3-button b3-button--text";
    missingReset.type = "button";
    missingReset.textContent = "Use default";
    missingReset.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedId = "";
        confirmAndClose();
    });

    missingHint.append(missingText, missingReset);

    const grid = document.createElement("div");
    grid.className = "callout-enhance-icon-picker-grid callout-enhance-icon-popover__grid";

    popover.append(searchRow, tabsRow, missingHint, grid);
    document.body.appendChild(popover);
    positionPopover(popover, opts.anchor);

    function createTabButton(tab: GroupTab) {
        const btn = document.createElement("button");
        btn.className = "callout-enhance-icon-popover__tab";
        btn.type = "button";
        btn.textContent = TAB_LABELS[tab];
        btn.dataset.tab = tab;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            activeTab = tab;
            renderTabs();
            renderGrid();
        });
        return btn;
    }

    function renderTabs() {
        (Object.keys(tabButtons) as GroupTab[]).forEach((tab) => {
            tabButtons[tab].classList.toggle("is-active", tab === activeTab);
        });
    }

    function filteredEntries(): SymbolEntry[] {
        let scope = allEntries;
        if (activeTab !== "all") {
            scope = scope.filter((e) => e.source === activeTab);
        }
        return searchSymbolEntries(scope, appliedQuery);
    }

    function renderGrid() {
        grid.innerHTML = "";
        const list = filteredEntries();
        countLabel.textContent = `${list.length} icons`;
        if (list.length === 0) {
            const empty = document.createElement("div");
            empty.className = "b3-form__desc callout-enhance-icon-popover__empty";
            empty.textContent = "No matching icons.";
            grid.appendChild(empty);
            return;
        }

        const cellsHtml: string[] = [];
        list.forEach((entry) => {
            const selectedClass = entry.id === selectedId ? " is-selected" : "";
            const sourceAttr = entry.source === "plugin" ? "plugin" : "host";
            cellsHtml.push(
                `<button type="button" class="callout-enhance-icon-picker-cell${selectedClass}" data-symbol-id="${entry.id}" data-source="${sourceAttr}" title="${escapeHtml(entry.label)}\n${escapeHtml(entry.id)}" aria-label="${escapeHtml(entry.label)}">` +
                    renderSymbolUseHtml(entry.id, `${ICON_SIZE_PX}px`) +
                    `</button>`,
            );
        });
        grid.innerHTML = cellsHtml.join("");

        grid.querySelectorAll<HTMLButtonElement>(".callout-enhance-icon-picker-cell").forEach((cell) => {
            const id = cell.dataset.symbolId || "";
            const entry = list.find((e) => e.id === id);
            if (!entry) return;

            cell.addEventListener("click", (e) => {
                e.stopPropagation();
                selectedId = entry.id;
                renderGrid();
            });

            cell.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                selectedId = entry.id;
                confirmAndClose();
            });
        });
    }

    function runSearch() {
        appliedQuery = search.value.trim();
        renderGrid();
    }

    function confirmAndClose() {
        if (closed) return;
        closed = true;
        teardown();

        if (selectedId) {
            opts.onPick(stringifyIconRef({ kind: "symbol", id: selectedId }), { type: "symbol", id: selectedId });
            return;
        }
        if (opts.current?.trim()) {
            opts.onPick(opts.current.trim(), { type: "reset" });
            return;
        }
        opts.onPick("", { type: "reset" });
    }

    function teardown() {
        document.removeEventListener("mousedown", onDocMouseDown, true);
        window.removeEventListener("resize", onReposition, true);
        window.removeEventListener("scroll", onReposition, true);
        popover.remove();
        if (activeCleanup === cleanup) {
            activeCleanup = null;
        }
    }

    function cleanup() {
        if (closed) return;
        closed = true;
        teardown();
    }

    function onDocMouseDown(e: MouseEvent) {
        const target = e.target as Node | null;
        if (!target) return;
        if (popover.contains(target) || opts.anchor.contains(target)) return;
        confirmAndClose();
    }

    function onReposition() {
        positionPopover(popover, opts.anchor);
    }

    searchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        runSearch();
    });
    search.addEventListener("input", () => {
        runSearch();
    });
    search.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            runSearch();
        }
    });

    activeCleanup = cleanup;
    document.addEventListener("mousedown", onDocMouseDown, true);
    window.addEventListener("resize", onReposition, true);
    window.addEventListener("scroll", onReposition, true);

    renderTabs();
    renderGrid();

    requestAnimationFrame(() => {
        search.focus();
        if (selectedId) {
            grid.querySelector<HTMLElement>(".callout-enhance-icon-picker-cell.is-selected")?.scrollIntoView({ block: "nearest" });
        }
    });

    return { close: cleanup };
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const padding = 8;
    const maxHeight = Math.min(
        POPOVER_MAX_HEIGHT_PX,
        Math.max(160, window.innerHeight - rect.bottom - padding * 2),
    );

    popover.style.width = `${POPOVER_WIDTH_PX}px`;
    popover.style.maxHeight = `${maxHeight}px`;

    let left = rect.left;
    let top = rect.bottom + padding;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    requestAnimationFrame(() => {
        const popRect = popover.getBoundingClientRect();

        if (popRect.right > window.innerWidth - padding) {
            left = Math.max(padding, window.innerWidth - popRect.width - padding);
        }
        if (popRect.left < padding) {
            left = padding;
        }

        if (popRect.bottom > window.innerHeight - padding) {
            const above = rect.top - popRect.height - padding;
            top = above >= padding ? above : Math.max(padding, window.innerHeight - popRect.height - padding);
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
