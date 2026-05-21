import pluginMeta from "../../plugin.json";

export type AboutSettingsPanelOptions = {
    host: HTMLElement;
    debugLogEnabled: boolean;
    onDebugLogChange: (enabled: boolean) => void;
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
    const { host, debugLogEnabled, onDebugLogChange } = options;
    host.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "callout-enhance-about";

    const heading = document.createElement("div");
    heading.className = "b3-label__text callout-enhance-about__heading";
    heading.textContent = "About this plugin";

    const info = document.createElement("div");
    info.className = "callout-enhance-about__info";

    info.append(
        createAboutInlineRow("Version", pluginMeta.version),
        createAboutInlineRow("Author", pluginMeta.author || "—"),
        createAboutInlineRow("Repository", createAboutLink(pluginMeta.url, pluginMeta.url)),
        createAboutInlineRow("License", createAboutLink(LICENSE_URL, LICENSE_NAME)),
    );

    const debugRow = document.createElement("div");
    debugRow.className = "callout-enhance-about__row callout-enhance-about__row--switch";

    const debugLabelWrap = document.createElement("div");
    debugLabelWrap.className = "callout-enhance-about__switch-label";

    const debugLabel = document.createElement("div");
    debugLabel.className = "b3-label__text";
    debugLabel.textContent = "Debug logging";

    const debugHint = document.createElement("div");
    debugHint.className = "callout-enhance-about__hint b3-label__text";
    debugHint.textContent = "Output detailed plugin logs to the browser console (DevTools).";

    debugLabelWrap.append(debugLabel, debugHint);

    const debugSwitch = document.createElement("input");
    debugSwitch.type = "checkbox";
    debugSwitch.className = "b3-switch fn__flex-center";
    debugSwitch.checked = debugLogEnabled;
    debugSwitch.addEventListener("change", () => {
        onDebugLogChange(debugSwitch.checked);
    });

    debugRow.append(debugLabelWrap, debugSwitch);

    wrapper.append(heading, info, debugRow);
    host.appendChild(wrapper);
}
