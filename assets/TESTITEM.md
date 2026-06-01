> *Please pay special attention to behavior in nested blocks. The state where the callout body is empty and contains only one empty line is referred to as an "empty callout".*

## 1. Title editing area
- Single-click in the title area: the cursor is placed correctly, and the type menu or fold/unfold button is not triggered accidentally.
- Pressing Enter in the title area:
  - When the callout is expanded: a new block is created on the first line of the body area.
  - When the callout is folded: a new block is created below the callout block without expanding the callout.
- Text input in the title area:
  - Input works correctly with Chinese IME.
  - The title text is saved correctly after the title area loses focus.
  - Toolbar is not triggered by shortcut keys.
  - Ctrl+A selects only the title area instead of the entire callout block.
  - The title area keeps plain text only and does not preserve rich-text formatting.
- Pasting into the title area:
  - Pasting plain text works correctly.
  - Pasting formatted text is correctly converted to plain text.
  - Pasting does not break the callout title structure.
- Undo/redo:
  - Title text input supports undo/redo.
  - Title text paste supports undo/redo.
  - New blocks created by pressing Enter in the title area support undo/redo.
- Persistence:
  - The modified title is still kept after reloading the page or closing and reopening the tab.
- Empty callout behavior:
  - Editing/pasting in the title area does not make the callout body disappear.

## 2. Fold/unfold functionality
- Normal folding:
  - Clicking the button smoothly folds the body area.
  - The arrow rotates in sync.
  - The body area does not suddenly disappear, flash back, or leave blank residue.
  - The position of the icon/title/button after folding is correct.
- Normal unfolding:
  - Clicking the button smoothly unfolds the body area.
  - The arrow rotates in sync.
  - The body area does not suddenly appear or flash back.
  - After unfolding completes, newly added body lines continue to increase the callout height.
- Reverse click during animation:
  - If folding is not finished and the user switches to unfolding, the callout unfolds smoothly from the current height.
  - If unfolding is not finished and the user switches to folding, the callout folds smoothly from the current height.
  - The button state and body state do not become inconsistent.
  - The body height is not stuck at a fixed value.
- Rapid repeated clicks on the fold/unfold button:
  - After multiple rapid clicks, the final state matches the last click.
  - The fold/unfold animation matches the last click.
  - The body height is not stuck at a fixed value.
- Undo/redo:
  - Folding/unfolding state supports undo/redo.
- Persistence:
  - The fold/unfold state is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.
  - Closing or reloading the page during animation should not cause the fold state to become stuck or abnormal on the next open.
  - Temporarily increasing `--callout-fold-duration` (for example, to 1000ms) and retesting should not expose blank areas, flashes, rebound, clipping, or desynchronization issues.

## 3. Body input and editing
- Normal body input:
  - New body blocks can still be entered normally.
  - The callout height changes together with body content while typing.
  - In the unfolded state, the bottom content is not clipped.
- Pressing Enter in the body area:
  - Pressing Enter in the body creates new blocks normally.
  - Pressing Enter on an empty non-tail line can create a new block and supports undo/redo.
- Arrow keys at the body boundary:
  - When the cursor is at the far left of the body, pressing ArrowLeft returns to the title.
  - The cursor does not get lost or stuck.
- Undo/redo:
  - Changes in the body area support undo/redo.
- Persistence:
  - The modified body is still kept after reloading the page or closing and reopening the tab.
- Empty callout behavior:
  - Pressing Enter can delete an empty callout and supports undo/redo; pay special attention to empty callouts inside nested blocks.

## 4. Type menu functionality
- Opening the type menu:
  - Clicking the icon opens the menu.
  - The menu is displayed as completely as possible.
  - The menu closes automatically when it loses focus.
- Selecting a type with the mouse:
  - Clicking a menu item switches the type.
  - The icon / background color / title color change accordingly.
  - The body content is not affected.
- Selecting a type with the keyboard:
  - ArrowUp / ArrowDown switch menu items.
  - Home / End jump to the first / last item.
  - Enter / Tab confirm the selected type.
  - Escape closes the menu.
- Enabled/disabled types:
  - Types disabled under **Settings → Callout Types** do not appear in the type menu.
  - Existing callout blocks of a disabled type keep their styling.
- Undo/redo:
  - Switching the callout type supports undo/redo.
- Persistence:
  - The changed callout type is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.

## 5. Completion menu functionality
- Opening the completion menu:
  - The menu appears only when typing a bracket at the beginning of the first line of a quote block.
  - Both Chinese and English brackets are supported.
  - The menu closes automatically when it loses focus.
- Auto-completion:
  - Typing one or more letters after the bracket filters callout types by label and keywords.
  - You do not need to type `!` after `[` / `【`; typing letters directly triggers completion.
- Selecting a type with the mouse:
  - Click a menu item to select the type and automatically convert the quote block into a callout.
  - The icon / background color / title color change accordingly.
  - The body content is not affected.
- Selecting a type with the keyboard:
  - ArrowUp / ArrowDown switch menu items.
  - Home / End jump to the first / last item.
  - Enter / Tab confirm the selected type and automatically convert the quote block to a callout.
  - Escape closes the menu.
- Enabled/disabled types:
  - Types disabled under **Settings → Callout Types** do not appear in the completion menu.
  - Past label names do not appear in the completion menu.
- Undo/redo:
  - Converting a quoted block can be undone.
  - Redo from a quoted block back to a callout block is also supported.
- Persistence:
  - The selected callout type is still kept after reloading the page or closing and reopening the tab.
- Other:
  - No temporary styles or temporary attributes are written into the document.

## 6. Layout compatibility
- Callout in a normal paragraph:
  - The callout width is correct.
  - The border and title frame are positioned correctly.
- Callout inside a list item:
  - The callout width is correct inside the list.
  - Folding/unfolding works correctly.
  - The border and title frame are positioned correctly.
- Callout inside a horizontal super block:
  - It is not stretched or centered in the horizontal layout.
  - The width and height are as expected after folding/unfolding.
- Nested callout / nested body blocks:
  - Folding is stable when blocks are nested inside a callout.
  - The callout can be unfolded normally after folding.

## 7. Image / PDF / HTML export
- Exported HTML / PDF / images keep the customized callout styles.
- The fold/unfold button does not appear in the exported result.
- The fold/unfold button does not appear in the export preview.
- The callout appearance in PDF / image preview matches the final PDF / image output.

## 8. Switching between the plugin and native callout
- The plugin switch can control switching between native callout and plugin callout.
- Native callout and plugin callout can correctly recognize each other’s fold/unfold state.
- Native callout and plugin callout can correctly recognize each other’s type (excluding custom types).

## 9. Settings: Callout appearance customization
- Opening settings:
  - The left nav switches between **Appearance**, **Callout Types**, and **About**.
  - The Appearance page includes presets, live preview, and grouped layout fields.
- Appearance presets:
  - Switch between the built-in Default preset and user-saved presets from the dropdown.
  - **Save as new preset** saves the current layout; the name must be non-empty, unique, and cannot use the reserved name Default.
  - For a non-Default preset, **Update preset** overwrites the saved layout.
  - **Delete preset** removes a non-Default preset after confirmation.
  - **Revert to saved preset** is available when the layout has unsaved changes and restores the saved preset content.
  - The Default preset cannot be updated or deleted.
- Reset defaults:
  - **Reset defaults** restores the built-in default layout and refreshes fields and preview.
- Layout fields:
  - Shell, title, body, icon, and fold/unfold groups are adjustable.
  - Changing sliders, selects, or inputs updates the preview callout in real time.
  - While settings are open, callouts in the editor should reflect appearance changes in real time.
- Preview area:
  - Click the fold/unfold button to preview folded and expanded styles.
  - The preview help note explains that only the default theme is shown; check other themes in the editor.
- Closing settings with unsaved appearance changes:
  - Closing the settings dialog or clicking the scrim with unsaved layout changes should prompt Save / Don’t save / Cancel.
  - When Default is active and changed, saving should ask for a new preset name.
  - **Don’t save** closes settings and the editor appearance should revert to the last saved state.
  - **Cancel** keeps the settings dialog open.
- Nav switching:
  - Switching to **Callout Types** or **About** while appearance has unsaved changes should keep the in-memory layout draft; the save prompt appears only when closing settings.

## 10. Settings: Callout type management
- Type list:
  - Each row shows a preview strip, enable toggle, edit, and delete actions.
  - Search filters by label, keywords, and past labels.
  - Drag reorder is disabled while search is active; clearing search restores drag reorder, and order auto-saves on drop.
  - Empty list and no-search-match states show the correct messages.
- Creating a type:
  - The add button opens the edit dialog; canceling without confirm should not leave an empty row.
  - Label is required to save.
  - Label must not duplicate another type’s label or past label (case-insensitive).
  - Label must not conflict with a tombstone entry; a conflict should prompt cleanup or a different name.
  - Label and keywords can cross-fill when one field is empty on blur.
- Edit dialog:
  - Edit label, keywords, main color, and icon; non-built-in types show past labels (read-only).
  - Built-in types NOTE / IMPORTANT / TIP / WARNING / CAUTION have read-only labels and cannot be deleted.
  - Main color and icon support **Reset to default**.
  - The preview updates live and supports fold/unfold preview.
  - Confirm saves and updates the list with a “Settings saved” message; cancel discards changes.
- Icon picker:
  - Click the icon button to open the popover and search by name.
  - **All / Plugin / SiYuan** tabs work.
  - Picking an icon updates the preview and edit field.
  - Missing icons show a warning with **Use default**.
- Enable toggle:
  - Disabled types are hidden from the type and completion menus; existing callout blocks keep their styling.
  - Changes save immediately.
- Deleting a type:
  - Built-in types cannot be deleted.
  - Custom types show an affected-block count (open/indexed notebooks) or an unknown-count message before confirm.
  - After confirm, the type is removed; blocks fall back to NOTE styling while keeping the same subtype in the document.
- Tombstone reclaim:
  - Saving a label that matches a tombstone entry should open the reclaim confirm dialog.
  - **Save and apply style** applies the new type styling and updates tombstone records.
  - **Back to edit** returns to the dialog without saving.
- Persistence:
  - List changes (order, enable, edit, delete) remain after closing settings.
  - Settings survive restarting SiYuan.

## 11. Type rename / delete / legacy cleanup
- Rename (before cleanup):
  - After changing the label in settings, past labels appear in the list; blocks with the old subtype still use plugin styling.
  - The completion menu does not list past label names; the type menu writes the current label.
- Delete:
  - The confirm dialog shows an “at least N blocks” count (open/indexed notebooks).
  - After confirm, the type is removed; blocks fall back to the default SiYuan callout style with the same subtype.
  - Creating the same label again triggers the tombstone prompt with **Save and apply style**.
- Cleanup (**About → Clean up legacy data**):
  - The start prompt warns about temporarily opening closed notebooks and indexing; read-only workspace should be rejected.
  - The progress dialog shows Phase A (past-label merge) and Phase B (tombstone orphans merged to NOTE).
  - Phase A: merge past-label subtypes and `[!LABEL]` to each type’s current label.
  - Phase B: merge tombstone orphans to NOTE.
  - Past labels and tombstone are cleared when done; cancel or closing settings should abort.
  - Unsaved Callout Types edits in the settings dialog should be included in cleanup.
  - Editor lock should not block cleanup.
- Closed notebooks:
  - If legacy blocks exist only in closed notebooks, cleanup should open them temporarily and close them afterward.
- Aborting cleanup:
  - **Stop cleanup** or closing settings during cleanup should show a confirm dialog.
  - Updated blocks keep their changes; past labels and tombstone are cleared only after successful completion.
  - Temporarily opened notebooks should be closed before cleanup fully stops.
- Cleanup failure / partial failure:
  - Failures are visible in the console; past labels and tombstone should be retained or partially retained depending on the outcome.
  - When block updates fail or notebook indexing times out, **Force clear legacy records** may appear; confirming clears metadata and blocks that failed to migrate can no longer be tracked via past labels or tombstone.

## 12. Settings: About
- About info:
  - Version, author, repository link, and license link are shown; links open correctly.
- Debug log:
  - The debug log toggle saves immediately.
  - When enabled, detailed plugin DEBUG logs appear in the SiYuan console (F12); when disabled, they stop.

## 13. Stability and pollution checks
- After folding/unfolding, switching types, and editing the title, check whether any temporary styles remain in the DOM.
- The following should not remain:
  - `height`
  - `overflow`
  - `transition`
  - `will-change`
  - `max-height`
  - `margin-top`
  - `margin-bottom`
  - `flex-shrink`
- Reloading the page during animation should not cause abnormal states.
- After reloading, the callout type, title, and fold/unfold state should remain consistent with the state before reload.
