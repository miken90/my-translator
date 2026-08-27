/**
 * Header dropdown menus — generic open/close/keyboard/outside-click behavior
 * shared by the two header popovers: the mic split-button's audio-source
 * menu (Meet chevron pattern) and the ⋯ overflow menu (Tana/Perplexity
 * pattern). Only one header menu is ever open at a time.
 */

const _openMenus = [];

/**
 * Anchors `menuEl` (position:absolute, offsetParent is the bare-ground
 * .control-bar — position:relative) under its trigger button(s), using
 * viewport rects so it works regardless of intermediate positioned
 * ancestors (each .pill is itself position:relative). Right-aligns when
 * the trigger sits in the right half of the bar, so a min-width:168px
 * menu never clips past the window's right edge at the 600px minimum
 * width — the CSS alone had no top/left/right, so every menu previously
 * fell back to its flex-item static position (the bar's top-left corner).
 */
export function positionMenu(menuEl, triggers) {
    const parent = menuEl.offsetParent || menuEl.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const rects = triggers.map((t) => t.getBoundingClientRect());
    const anchorLeft = Math.min(...rects.map((r) => r.left));
    const anchorRight = Math.max(...rects.map((r) => r.right));
    const anchorBottom = Math.max(...rects.map((r) => r.bottom));

    const gap = 4;
    menuEl.style.top = `${anchorBottom - parentRect.top + gap}px`;

    const barCenterX = parentRect.left + parentRect.width / 2;
    if (anchorLeft >= barCenterX) {
        menuEl.style.right = `${Math.max(parentRect.right - anchorRight, 0)}px`;
        menuEl.style.left = 'auto';
    } else {
        menuEl.style.left = `${Math.max(anchorLeft - parentRect.left, 0)}px`;
        menuEl.style.right = 'auto';
    }
}

/**
 * @param {object} opts
 * @param {HTMLElement[]} opts.triggers - elements that toggle the menu on click
 * @param {HTMLElement} opts.menuEl - the menu panel (role="menu")
 * @param {HTMLElement} [opts.ariaOwner] - element carrying aria-expanded/aria-controls
 *   (defaults to the last trigger, e.g. the chevron in a split-button)
 */
export function initHeaderMenu({ triggers, menuEl, ariaOwner } = {}) {
    const owner = ariaOwner || triggers[triggers.length - 1];
    let isOpen = false;

    function close() {
        if (!isOpen) return;
        isOpen = false;
        menuEl.hidden = true;
        owner.setAttribute('aria-expanded', 'false');
    }

    function open() {
        if (isOpen) return;
        closeAllHeaderMenus();
        isOpen = true;
        // Unhide before measuring — offsetParent/layout are unavailable
        // (null/zeroed) on a display:none element.
        menuEl.hidden = false;
        positionMenu(menuEl, triggers);
        owner.setAttribute('aria-expanded', 'true');
        const firstItem = menuEl.querySelector('[role^="menuitem"]');
        firstItem?.focus();
    }

    function toggle() {
        if (isOpen) close(); else open();
    }

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle();
        });
    });

    menuEl.addEventListener('keydown', (e) => {
        const items = Array.from(menuEl.querySelectorAll('[role^="menuitem"]'));
        const idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(idx + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(idx - 1 + items.length) % items.length]?.focus();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
            owner.focus();
        } else if (e.key === 'Tab') {
            close();
        }
    });

    document.addEventListener('click', (e) => {
        if (!isOpen) return;
        if (menuEl.contains(e.target) || triggers.includes(e.target) || triggers.some(t => t.contains(e.target))) return;
        close();
    });

    const handle = { open, close, toggle, isOpen: () => isOpen };
    _openMenus.push(handle);
    return handle;
}

export function closeAllHeaderMenus() {
    _openMenus.forEach((m) => m.close());
}
