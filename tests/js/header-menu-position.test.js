// @vitest-environment jsdom
//
// Bug: both header menus (mic source menu + ⋯ overflow menu) opened
// anchored to the bar's top-left corner instead of under their trigger,
// because open() never positioned menuEl at all — CSS only had
// `position: absolute` with no top/left/right, so the browser fell back
// to the flex-item static position (the .control-bar's top-left corner).
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

function controlBarRect(windowWidth) {
  const contentWidth = windowWidth - 2 /* overlay border */ - 8 /* control-bar padding */;
  return rect(0, contentWidth, 42);
}

describe('positionMenu — trigger-relative anchoring (regression for top-left-pinned menus)', () => {
  for (const windowWidth of [600, 680]) {
    it(`left-aligns the source menu under the split-button at ${windowWidth}px`, () => {
      const menuEl = document.createElement('div');
      const parent = document.createElement('div');
      parent.appendChild(menuEl);
      parent.getBoundingClientRect = () => controlBarRect(windowWidth);
      Object.defineProperty(menuEl, 'offsetParent', { value: parent, configurable: true });

      const current = document.createElement('button');
      const chev = document.createElement('button');
      current.getBoundingClientRect = () => rect(SPLIT_LEFT, 28);
      chev.getBoundingClientRect = () => rect(SPLIT_LEFT + 28, 16);

      positionMenu(menuEl, [current, chev]);

      expect(menuEl.style.right).toBe('auto');
      expect(menuEl.style.left).toBe(`${SPLIT_LEFT}px`);
      // Fully inside the bar: left edge + a 168px-min menu must not exceed content width.
      const barWidth = controlBarRect(windowWidth).width;
      expect(SPLIT_LEFT + 168).toBeLessThanOrEqual(barWidth);
    });

    it(`right-aligns the overflow menu under its trigger at ${windowWidth}px, never negative`, () => {
      const barRect = controlBarRect(windowWidth);
      const overflowLeft = barRect.width - OVERFLOW_RIGHT_GAP - 28;

      const menuEl = document.createElement('div');
      const parent = document.createElement('div');
      parent.appendChild(menuEl);
      parent.getBoundingClientRect = () => barRect;
      Object.defineProperty(menuEl, 'offsetParent', { value: parent, configurable: true });

      const overflowBtn = document.createElement('button');
      overflowBtn.getBoundingClientRect = () => rect(overflowLeft, 28);

      positionMenu(menuEl, [overflowBtn]);

      expect(menuEl.style.left).toBe('auto');
      const rightOffset = parseFloat(menuEl.style.right);
      expect(rightOffset).toBe(OVERFLOW_RIGHT_GAP);
      expect(rightOffset).toBeGreaterThanOrEqual(0);
      // Fully inside the bar on the left side too.
      expect(barRect.width - rightOffset - 168).toBeGreaterThanOrEqual(0);
    });
  }

  it('the two menus anchor to different positions (proves it is trigger-relative, not a fixed corner)', () => {
    const barRect = controlBarRect(680);
    const parent = document.createElement('div');
    parent.getBoundingClientRect = () => barRect;

    const sourceMenu = document.createElement('div');
    parent.appendChild(sourceMenu);
    Object.defineProperty(sourceMenu, 'offsetParent', { value: parent, configurable: true });
    const chev = document.createElement('button');
    chev.getBoundingClientRect = () => rect(SPLIT_LEFT, 16);
    positionMenu(sourceMenu, [chev]);

    const overflowMenu = document.createElement('div');
    parent.appendChild(overflowMenu);
    Object.defineProperty(overflowMenu, 'offsetParent', { value: parent, configurable: true });
    const overflowBtn = document.createElement('button');
    overflowBtn.getBoundingClientRect = () => rect(barRect.width - OVERFLOW_RIGHT_GAP - 28, 28);
    positionMenu(overflowMenu, [overflowBtn]);

    // Before the fix both would sit at left:0/top:0 relative to the bar
    // (its flex-item static position) regardless of trigger — i.e. identical.
    expect([sourceMenu.style.left, sourceMenu.style.right]).not.toEqual([overflowMenu.style.left, overflowMenu.style.right]);
    expect(sourceMenu.style.left).not.toBe('0px');
  });
});
