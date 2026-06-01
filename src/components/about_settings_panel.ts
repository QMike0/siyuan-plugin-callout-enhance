import pluginMeta from "../../plugin.json";
import { t } from "../utils/i18n";

export type AboutSettingsPanelOptions = {
    host: HTMLElement;
    debugLogEnabled: boolean;
    onDebugLogChange: (enabled: boolean) => void;
    cleanupRunning?: boolean;
    onCleanupClick?: () => void;
};

const LICENSE_NAME = "MIT License";
const LICENSE_URL = "https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/LICENSE";

function createAboutInlineRow(label: string, value: string | HTMLElement) {
    const row = document.createElement("div");
    row.className = "callout-enhance-about__inline-row";

    const labelEl = document.createElement("span");
    labelEl.className = "callout-enhance-about__inline-label";
    labelEl.textContent = `${label}: `;

    if (typeof value === "string") {
        const valueEl = document.createElement("span");
        valueEl.className = "callout-enhance-about__inline-value";
        valueEl.textContent = value;
        row.append(labelEl, valueEl);
        return row;
    }

    row.append(labelEl, value);
    return row;
}

function createAboutLink(href: string, text: string) {
    const link = document.createElement("a");
    link.className = "callout-enhance-about__link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text;
    return link;
}

export function renderAboutSettingsPanel(options: AboutSettingsPanelOptions) {
    const { host, debugLogEnabled, onDebugLogChange, cleanupRunning = false, onCleanupClick } = options;
    host.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "callout-enhance-about";

    const heading = document.createElement("div");
    heading.className = "b3-label__text callout-enhance-about__heading";
    heading.textContent = t("aboutHeading");

    const info = document.createElement("div");
    info.className = "callout-enhance-about__info";

    info.append(
        createAboutInlineRow(t("aboutVersion"), pluginMeta.version),
        createAboutInlineRow(t("aboutAuthor"), pluginMeta.author || "—"),
        createAboutInlineRow(t("aboutRepository"), createAboutLink(pluginMeta.url, pluginMeta.url)),
        createAboutInlineRow(t("aboutLicense"), createAboutLink(LICENSE_URL, LICENSE_NAME)),
    );

    const cleanupRow = document.createElement("div");
    cleanupRow.className = "callout-enhance-about__row callout-enhance-about__row--cleanup";

    const cleanupLabelWrap = document.createElement("div");
    cleanupLabelWrap.className = "callout-enhance-about__switch-label";

    const cleanupLabel = document.createElement("div");
    cleanupLabel.className = "b3-label__text";
    cleanupLabel.textContent = t("aboutCleanupLabel");

    const cleanupHint = document.createElement("div");
    cleanupHint.className = "callout-enhance-about__hint b3-label__text";
    cleanupHint.textContent = t("aboutCleanupHint");

    cleanupLabelWrap.append(cleanupLabel, cleanupHint);

    const cleanupBtn = document.createElement("button");
    cleanupBtn.type = "button";
    cleanupBtn.className = "b3-button b3-button--outline callout-enhance-about__cleanup-btn";
    cleanupBtn.innerHTML = `<svg class="b3-menu__icon callout-enhance-about__cleanup-btn-icon" style="width:14px;height:14px;margin:0;"><use href="#iconTrashcan"></use></svg>`;
    cleanupBtn.append(document.createTextNode(t("aboutCleanupPurge")));
    cleanupBtn.disabled = cleanupRunning || !onCleanupClick;
    if (onCleanupClick) {
        cleanupBtn.addEventListener("click", () => onCleanupClick());
    }

    cleanupRow.append(cleanupLabelWrap, cleanupBtn);

    const debugRow = document.createElement("div");
    debugRow.className = "callout-enhance-about__row callout-enhance-about__row--switch";

    const debugLabelWrap = document.createElement("div");
    debugLabelWrap.className = "callout-enhance-about__switch-label";

    const debugLabel = document.createElement("div");
    debugLabel.className = "b3-label__text";
    debugLabel.textContent = t("aboutDebugLabel");

    const debugHint = document.createElement("div");
    debugHint.className = "callout-enhance-about__hint b3-label__text";
    debugHint.textContent = t("aboutDebugHint");

    debugLabelWrap.append(debugLabel, debugHint);

    const debugSwitch = document.createElement("input");
    debugSwitch.type = "checkbox";
    debugSwitch.className = "b3-switch fn__flex-center";
    debugSwitch.checked = debugLogEnabled;
    debugSwitch.addEventListener("change", () => {
        onDebugLogChange(debugSwitch.checked);
    });

    debugRow.append(debugLabelWrap, debugSwitch);

    wrapper.append(heading, info, cleanupRow, debugRow);
    host.appendChild(wrapper);
}
