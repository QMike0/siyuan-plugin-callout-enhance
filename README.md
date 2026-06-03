# SiYuan Callout Enhance Plugin

[简体中文](https://github.com/QMike0/siyuan-plugin-callout-enhance/blob/main/README_zh_CN.md)

> [!important]
>
> In addition to the five native callout types in SiYuan, this plugin adds several new styles. Please note that when these new styles are converted back to official callouts (i.e., when this plugin is disabled), there will be display issues: they will become callout blocks with transparent backgrounds and missing icons. Use with caution if you mind this!

## Main Features

> For more details, please refer to [here](https://github.com/QMike0/siyuan-plugin-callout-enhance/tree/main/assets/TESTITEM.md).

### (1) Callout Appearance Enhancement

Default appearance:

![callout_type](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_type.png)

After nesting:

![callout_nesting](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/callout_nesting.png)

### (2) Quick Title Editing

![title_editing](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/title_editing.gif)

### (3) Quick Fold/Unfold

![fold&unfold](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/fold%26unfold.gif)

### (4) Completion Menu

- Type `[` or `【` at the beginning of the first line of a quote block to open the completion menu.
- Supports keyboard navigation or mouse click to select a type.
- Supports auto-completion. Note: you do not need to type `!` after `[` / `【`; just type letters to trigger completion.

![completion_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/completion_menu.gif)

### (5) Type Menu

- Click the icon to open the type menu.
- Supports keyboard navigation or mouse click to select a type.

![type_menu](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/type_menu.gif)

### (6) Settings: Callout Appearance Customization

- Customize callout appearance under **Settings → Appearance**, with preset save/load, preset management, and live preview.

- Example: GitHub-style callout appearance:

  ![PixPin_2026-06-02_00-02-02](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-02-02.gif)

### (7) Settings: Callout Type Management

- Under **Settings → Callout Types**, add, delete, disable, reorder, and edit callout types. Built-in SiYuan types (NOTE, TIP, etc.) cannot be deleted.

  ![PixPin_2026-06-02_00-53-281](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-53-281.gif)

- The callout style edit dialog supports custom label, keywords, main color, and icon, with live preview while editing.

  ![PixPin_2026-06-02_00-57-411](https://mikepicture.oss-cn-chengdu.aliyuncs.com/picture/PixPin_2026-06-02_00-57-411.gif)

### (8) Settings: Other

- **Settings → About → Clean up legacy data**: Before using this feature, understand the effects of the following operations under **Settings → Callout Types**:

  - **Rename label**: Callout blocks in your notes still keep the old `data-subtype`. The plugin automatically saves the pre-rename label as a *past label* so those blocks continue to match your styles.
  - **Delete callout type**: Matching blocks keep their original `data-subtype` and fall back to the default (NOTE) styling. The deleted type’s *label* and *past labels* are recorded in the *tombstone* list.

  **Clean up legacy data** migrates callout block `data-subtype` values in your notes to the new label or the NOTE label, so *past labels* and the *tombstone* can be cleared safely.

- **Settings → About → Debug log**: Show detailed plugin DEBUG logs in the SiYuan console.

## Changelog

See [CHANGELOG.md](https://cdn.jsdelivr.net/gh/QMike0/siyuan-plugin-callout-enhance@main/CHANGELOG.md)

## Development

Download the source code of this repository and package the plugin as follows:

1. Install Node.js and pnpm.
2. Run `pnpm i` in the current directory.
3. Run `pnpm run dev` for the development build.
4. Run `pnpm run build` to package `package.zip`.

## License

MIT License

## Acknowledgments

- Developed based on the [SiYuan plugin sample](https://github.com/siyuan-note/plugin-sample) template.
- Special thanks to [xqh042](https://github.com/wzj042) for the code snippets, which inspired this plugin.
- [obsidian-callout-manager](https://github.com/eth-p/obsidian-callout-manager): referenced for callout type management.
- [sy-bookmark-plus](https://github.com/frostime/sy-bookmark-plus): referenced for the icon picker UI.
- [syplugin-hierarchyNavigate](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate): referenced for draggable type list rows.

## Other

For simple usage, you can also base it on the code snippets [here](https://github.com/QMike0/Siyuan-ObsidianType-Callout) without adding this plugin.

**However, please note that this plugin has received many optimizations on top of those snippets. Unless there are special circumstances, the code snippets will not be updated in the future. Therefore, it is strongly recommended to use the plugin directly.**
