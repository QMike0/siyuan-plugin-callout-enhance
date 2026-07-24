# SiYuan Note Callout Enhance Plugin

[简体中文](https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/README.zh-CN.md)

> [!important]
>
> In addition to supporting the five built-in callout types in SiYuan Note, this plugin also allows you to customize new styles. Please note that after converting back to the official callout format (i.e., when this plugin is disabled), these new custom styles may have display issues, appearing as callouts with transparent backgrounds and missing icons. Please use with caution if this concerns you!

## Key Features

> For more details, please refer to [this document](https://github.com/QMike0/siyuan-plugin-callout-enhance/tree/main/assets/TESTITEM_zh_CN.md).

### (1) Callout Appearance Optimization

Default Appearance:

![callout_types](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_types.png)

Nested Callouts:

![callout_nested](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_nested.png)

### (2) Callout Title Area

#### Quick Edit

![callout_title_edit](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_title_edit.gif)

#### Multi-line Display

![callout_title_multi-line](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_title_multi-line.png)

### (3) Callout Body Area

#### Quick Fold/Unfold

- Left-click the fold/unfold button to collapse or expand the body area.

![callout_fold&unfold](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_fold%26unfold.gif)

#### Maximum Height Limit

- <kbd>Ctrl</kbd> + Left-click the fold/unfold button to enable/disable the maximum height limit for the body area.

![callout_maximum_height](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_maximum_height.gif)

### (4) Completion Menu

- Type `[` at the beginning of the first line of a blockquote to summon the completion menu.
- Supports keyboard navigation or mouse clicks to select the desired type.
- Supports autocomplete. Note that you don't need to type `!` after `[`; simply type the letters directly to trigger the completion.

![callout_completion_menu](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_completion_menu.gif)

### (5) Type Menu

- Click the icon to summon the type menu.
- Supports keyboard navigation or mouse clicks to select types.

![callout_type_menu](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_type_menu.gif)

### (6) Settings: Custom Callout Appearance

- Customize the Callout appearance under "Settings - Appearance". It supports saving and managing appearance presets with real-time style previews.

- For example, creating a custom appearance styled after GitHub Callouts:

  ![callout_appearance_set](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_appearance_set.gif)

### (7) Settings: Callout Type Management

- Add, delete, disable, reorder, and edit Callout types under "Settings - Callout Type". Note that the five built-in Callout types in SiYuan Note (NOTE, TIP, etc.) cannot be deleted.

  ![callout_type_manage](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_type_manage.gif)

- The Callout style editing modal supports customizing labels, keywords, primary colors, and icons, offering real-time previews during the editing process.

  ![callout_type_edit](https://cdn.jsdelivr.net/gh/QMike0/pic_bed@main/img/callout_type_edit.gif)

### (8) Settings: Miscellaneous

- **"Settings - About - Clean History Data"**: Before explaining this feature, it is important to understand the impact of the following two operations in "Settings - Callout Type":

  - **Renaming a "Label"**: Callout blocks in your documents will still retain their old `data-subtype`. Therefore, the plugin automatically saves the pre-rename old *Label* as a *History Label* to ensure the correct style continues to match the corresponding Callout blocks.
  - **Deleting a Callout Type**: The corresponding Callout blocks in documents retain their original `data-subtype` but fall back to the default style (NOTE style). The *Labels* and *History Labels* of deleted Callout types are recorded into the *Tombstone*.

  The purpose of **Clean History Data** is to migrate the `data-subtype` of Callout blocks in your documents to the new Label or the NOTE Label, allowing you to safely clear the *History Labels* and *Tombstones*.

- **"Settings - About - Debug Logs"**: Displays detailed plugin DEBUG logs in the SiYuan Note console.

## Changelog

See [CHANGELOG.md](https://cdn.jsdelivr.net/gh/QMike0/siyuan-plugin-callout-enhance@main/CHANGELOG.md)

## Development

Download the source code of this repository and bundle the plugin using the following steps:

1. Install Node.js and pnpm.
2. Run `pnpm i` in the root directory.
3. Run `pnpm run dev` for development builds.
4. Run `pnpm run build` to package the plugin into `package.zip`.

## License

MIT License

## Acknowledgments

- Developed based on the [SiYuan plugin sample](https://github.com/siyuan-note/plugin-sample) template.
- Special thanks to [xqh042](https://github.com/wzj042) for providing the original code snippets that inspired this plugin.
- "[obsidian-callout-manager](https://github.com/eth-p/obsidian-callout-manager)": Referenced for its implementation of Callout type management.
- "[sy-bookmark-plus](https://github.com/frostime/sy-bookmark-plus)": Referenced for its implementation of the icon filtering interface.
- "[syplugin-hierarchyNavigate](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate)": Referenced for its implementation of dragging type items.

## Others

For simple usage, you can rely solely on the code snippets found [here](https://github.com/QMike0/Siyuan-ObsidianType-Callout) without installing this plugin.

**However, please note that this plugin has introduced extensive optimizations on top of those snippets. The standalone snippets will no longer be updated unless exceptional circumstances arise, so it is highly recommended to use the plugin directly!**