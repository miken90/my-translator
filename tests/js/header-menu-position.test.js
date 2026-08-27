// @vitest-environment jsdom
//
// Bug 1: both header menus opened anchored to the bar's top-left corner
// instead of under their trigger — CSS only had `position: absolute` with
// no top/left/right, so the browser fell back to the flex-item static
// position (the .control-bar's top-left corner). Fixed by measuring the
// trigger and setting an explicit offset.
//
// Bug 2 (follow-up): the fix for bug 1 right-aligned via `right:Xpx;
// left:auto`, which does not reliably shrink-to-fit inside a *flex*
// containing block (.control-bar is display:flex) — the overflow menu
// rendered left-edge-aligned to its trigger and spilled rightward under
// Pill D instead of hugging the trigger's right edge. positionMenu() now
// always computes and sets an explicit `left` (never relies on `right` +
// `left:auto` resolution): right-align measures the menu's own rendered
// width and sets `left` so the menu's right edge lands on the trigger's
// right edge.
//
// jsdom has no real layout engine, so getBoundingClientRect() is stubbed
// per element with numbers taken directly from the app's actual CSS box
// model (control-h-sm=28px, cluster-pad=3px, cluster-gap=2px, pill
// border=1px, space-sm gap=8px, control-bar padding=4px each side,
// #overlay-view border=1px) at the two window widths the bug report and
// hard-acceptance criterion both call out: 600px (min) and 680px
// (default). This is a real check of positionMenu()'s branching/offset
// math against real geometry, not a placeholder.
import { describe, it, expect } from 'vitest';
import { positionMenu } from '../../src/js/header-menus.js';

function rect(left, width, bottom = 46) {
  return { left, right: left + width, width, bottom, top: bottom - 28, height: 28 };
}

// Fixed left-edge offsets of each pill's content inside .control-bar, per
// the CSS box model — independent of window width because only .ground
// (flex:1) grows/shrinks; everything to its left or right sits at a
// constant offset from its own end of the bar.
const PILL_A_LEFT = 4; // control-bar padding
const SPLIT_LEFT = PILL_A_LEFT + 28 /* pillA content */ + 2 + 2 /* pillA border+pad */ + 8 /* gap */
  + 1 + 3 /* pillB border+pad */ + 28 /* record btn */ + 2 /* gap */; // = 78
const OVERFLOW_RIGHT_GAP = 1 + 3 /* pillD/C border+pad mirrored */ + 6 /* pillC pad+border */
  + 8 /* gap C->D */ + 4 * 28 + 3 * 2 /* pillD 4 buttons + 3 gaps */ + 1 + 3; // right-side fixed width after overflow btn

// Approximate rendered widths (shrink-to-fit, content-driven) — the
// overflow menu's rows carry longer labels ("Copy transcript  Ctrl+C")
// than the source menu's ("System audio  Ctrl+1"), matching what the bug
// screenshot showed (~250px vs. a narrower source menu).
const SOURCE_MENU_WIDTH = 188;
const OVERFLOW_MENU_WIDTH = 251;

function controlBarRect(windowWidth) {
  const contentWidth = windowWidth - 2 /* overlay border */ - 8 /* control-bar padding */;
  return rect(0, contentWidth, 42);
}

function makeMenu(parent, width) {
  const menuEl = document.createElement('div');
  parent.appendChild(menuEl);
  Object.defineProperty(menuEl, 'offsetParent', { value: parent, configurable: true });
  // getBoundingClientRect is called once before left/right are finalized
  // (right after the left:0 reset) to measure shrink-to-fit width, and
  // width doesn't change based on the element's own left offset, so a
  // constant stub is faithful to real layout behavior here.
  menuEl.getBoundingClientRect = () => rect(0, width);
  return menuEl;
}

describe('positionMenu — trigger-relative anchoring (regression for top-left-pinned menus)', () => {
  for (const windowWidth of [600, 680]) {
    it(`left-aligns the source menu under the split-button at ${windowWidth}px`, () => {
      const parent = document.createElement('div');
      parent.getBoundingClientRect = () => controlBarRect(windowWidth);
      const menuEl = makeMenu(parent, SOURCE_MENU_WIDTH);

      const current = document.createElement('button');
      const chev = document.createElement('button');
      current.getBoundingClientRect = () => rect(SPLIT_LEFT, 28);
      chev.getBoundingClientRect = () => rect(SPLIT_LEFT + 28, 16);

      positionMenu(menuEl, [current, chev]);

      expect(menuEl.style.left).toBe(`${SPLIT_LEFT}px`);
      // Fully inside the bar: left edge + rendered width must not exceed content width.
      const barWidth = controlBarRect(windowWidth).width;
      expect(SPLIT_LEFT + SOURCE_MENU_WIDTH).toBeLessThanOrEqual(barWidth);
    });

    it(`right-aligns the overflow menu's RIGHT edge to the trigger's right edge at ${windowWidth}px, growing leftward`, () => {
      const barRect = controlBarRect(windowWidth);
      const overflowLeft = barRect.width - OVERFLOW_RIGHT_GAP - 28;
      const overflowRight = overflowLeft + 28;

      const parent = document.createElement('div');
      parent.getBoundingClientRect = () => barRect;
      const menuEl = makeMenu(parent, OVERFLOW_MENU_WIDTH);

      const overflowBtn = document.createElement('button');
      overflowBtn.getBoundingClientRect = () => rect(overflowLeft, 28);

      positionMenu(menuEl, [overflowBtn]);

      // Right edge of the menu (left + its own width) must equal the
      // trigger's right edge — not its left edge (the reported bug).
      const menuLeft = parseFloat(menuEl.style.left);
      expect(menuLeft + OVERFLOW_MENU_WIDTH).toBe(overflowRight);
      expect(menuLeft).not.toBe(overflowLeft); // would be left-aligned (the bug) if equal
      expect(menuLeft).toBeGreaterThanOrEqual(0);
      // Fully inside the bar: doesn't spill past either edge.
      expect(menuLeft + OVERFLOW_MENU_WIDTH).toBeLessThanOrEqual(barRect.width);
    });
  }

  it('the two menus anchor to different left offsets (proves it is trigger-relative, not a fixed corner)', () => {
    const barRect = controlBarRect(680);
    const parent = document.createElement('div');
    parent.getBoundingClientRect = () => barRect;

    const sourceMenu = makeMenu(parent, SOURCE_MENU_WIDTH);
    const chev = document.createElement('button');
    chev.getBoundingClientRect = () => rect(SPLIT_LEFT, 16);
    positionMenu(sourceMenu, [chev]);

    const overflowMenu = makeMenu(parent, OVERFLOW_MENU_WIDTH);
    const overflowBtn = document.createElement('button');
    overflowBtn.getBoundingClientRect = () => rect(barRect.width - OVERFLOW_RIGHT_GAP - 28, 28);
    positionMenu(overflowMenu, [overflowBtn]);

    // Before the top-left-corner-pin bug fix, both would sit at left:0
    // relative to the bar regardless of trigger — i.e. identical.
    expect(sourceMenu.style.left).not.toBe(overflowMenu.style.left);
    expect(sourceMenu.style.left).not.toBe('0px');
  });
});
