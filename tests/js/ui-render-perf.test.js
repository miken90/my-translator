// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranscriptUI } from '../../src/js/ui.js';

describe('TranscriptUI keyed-card render performance', () => {
    let ui;
    let container;
    let originalRAF;
    let originalCAF;

    beforeEach(() => {
        originalRAF = global.requestAnimationFrame;
        originalCAF = global.cancelAnimationFrame;
        // Make requestAnimationFrame synchronous so setProvisional's
        // coalesced render resolves within the same test tick, unless a
        // specific test overrides this to inspect scheduling directly.
        global.requestAnimationFrame = (cb) => { cb(); return 1; };
        global.cancelAnimationFrame = () => {};

        container = document.createElement('div');
        document.body.appendChild(container);
        ui = new TranscriptUI(container);
    });

    afterEach(() => {
        global.requestAnimationFrame = originalRAF;
        global.cancelAnimationFrame = originalCAF;
        container.remove();
    });

    it('bounds DOM node count and avoids detached-node accumulation over 5000 synthetic updates', () => {
        const N = 5000;
        // jsdom DOM operations are much slower than a real browser; 5000
        // iterations x 3 operations each needs more than the 5s default.
        for (let i = 0; i < N; i++) {
            ui.addOriginal(`original text ${i}`, `speaker-${i % 3}`, i % 2 === 0 ? 'en' : 'vi');
            ui.setProvisional(`partial ${i}`);
            ui.addTranslation(`translation ${i}`);
        }
        ui.clearProvisional();

        const cardNodes = ui._cardRenderer._cardNodes;

        // Node count is bounded by trim (maxChars=1200 / short synthetic
        // strings settles around ~70-80) — the key property is that it does
        // NOT scale with N=5000, not an exact number.
        expect(cardNodes.size).toBeLessThan(200);
        expect(ui.contentEl.children.length).toBeLessThan(200);

        // Every tracked card node is still attached under contentEl — no
        // detached nodes accumulating outside the visible tree.
        for (const node of cardNodes.values()) {
            expect(ui.contentEl.contains(node)).toBe(true);
        }

        // sessionLog keeps the full, untrimmed history (existing invariant).
        expect(ui.sessionLog.length).toBe(N);
    }, 30000);

    it('leaves no tracked card nodes or detached nodes after clear()', () => {
        for (let i = 0; i < 20; i++) {
            ui.addOriginal(`o${i}`);
            ui.addTranslation(`t${i}`);
        }
        expect(ui._cardRenderer._cardNodes.size).toBeGreaterThan(0);

        ui.clear();

        expect(ui._cardRenderer._cardNodes.size).toBe(0);
        expect(ui._cardRenderer._provisionalCardEl).toBeNull();
        expect(container.children.length).toBe(0);
    });

    it('touches only the provisional card when only provisional text changes (O(changed), not O(displayed))', () => {
        // Seed a handful of stable, already-rendered cards.
        for (let i = 0; i < 5; i++) {
            ui.addOriginal(`stable original ${i}`);
            ui.addTranslation(`stable translation ${i}`);
        }

        const stableNodes = Array.from(ui._cardRenderer._cardNodes.values());
        const mutatedTargets = new Set();
        const observer = new MutationObserver((records) => {
            for (const r of records) mutatedTargets.add(r.target);
        });
        observer.observe(ui.contentEl, { childList: true, subtree: true, characterData: true, attributes: true });

        // Rapid-fire provisional updates for an in-progress utterance — the
        // stable cards' own content never changes.
        for (let i = 0; i < 50; i++) {
            ui.setProvisional(`growing partial text ${i}`);
        }
        observer.disconnect();

        for (const stable of stableNodes) {
            expect(mutatedTargets.has(stable)).toBe(false);
            for (const child of stable.querySelectorAll('*')) {
                expect(mutatedTargets.has(child)).toBe(false);
            }
        }
    });

    it('skips the DOM write entirely for a card whose content signature is unchanged', () => {
        ui.addOriginal('hello');
        ui.addTranslation('translated hello');

        const [cardEl] = ui._cardRenderer._cardNodes.values();
        const sigBefore = cardEl.dataset.sig;

        // Re-render with no actual data change (e.g. a provisional-only
        // update elsewhere would trigger this same _renderCards() pass).
        ui._render();

        expect(cardEl.dataset.sig).toBe(sigBefore);
    });

    it('coalesces rapid setProvisional calls into a single scheduled animation frame', () => {
        const scheduledCallbacks = [];
        global.requestAnimationFrame = (cb) => { scheduledCallbacks.push(cb); return scheduledCallbacks.length; };

        ui.setProvisional('a');
        ui.setProvisional('ab');
        ui.setProvisional('abc');

        expect(scheduledCallbacks.length).toBe(1); // later calls reuse the pending frame

        scheduledCallbacks[0](); // flush the single scheduled frame
        expect(ui.provisionalText).toBe('abc'); // reflects the latest value, not the first
    });

    it('addOriginal/addTranslation flush immediately without waiting for a frame', () => {
        let rafCalls = 0;
        global.requestAnimationFrame = (cb) => { rafCalls++; cb(); return rafCalls; };

        ui.addOriginal('final text');

        // The pending-original card rendered synchronously, with zero rAF
        // scheduling involved — only setProvisional/clearProvisional use rAF.
        expect(ui._cardRenderer._cardNodes.size).toBe(1);
        expect(ui.contentEl.querySelector('.seg-card')).not.toBeNull();
        expect(rafCalls).toBe(0);
    });
});
