// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptUI } from '../../src/js/ui.js';

describe('TranscriptUI.getExportText', () => {
    let ui;

    beforeEach(() => {
        const container = document.createElement('div');
        ui = new TranscriptUI(container);
    });

    it('returns null when sessionLog is empty', () => {
        expect(ui.getExportText('md')).toBeNull();
        expect(ui.getExportText('txt')).toBeNull();
    });

    it('is always sourced from sessionLog, not the (possibly trimmed) segments display buffer', () => {
        ui.configure({ maxLines: 1 }); // small maxChars so segments gets trimmed
        for (let i = 0; i < 10; i++) {
            ui.addOriginal(`original ${i} `.repeat(20));
            ui.addTranslation(`translation ${i} `.repeat(20));
        }
        expect(ui.segments.length).toBeLessThan(ui.sessionLog.length);

        const exported = ui.getExportText('md');
        // Every sessionLog entry appears in the export, including ones long
        // since trimmed out of the live display buffer.
        expect(exported).toContain('translation 0');
        expect(exported).toContain('translation 9');
    });

    it('md format includes bold speaker/timestamp header and blockquote original', () => {
        ui.addOriginal('hello there', 'A');
        ui.addTranslation('xin chao');

        const md = ui.getExportText('md');
        expect(md).toMatch(/\*\*\[\d{2}:\d{2}:\d{2}\] Speaker A\*\*/);
        expect(md).toContain('> hello there');
        expect(md).toContain('xin chao');
    });

    it('txt format has no markdown syntax but keeps the same timestamp/speaker info', () => {
        ui.addOriginal('hello there', 'A');
        ui.addTranslation('xin chao');

        const txt = ui.getExportText('txt');
        expect(txt).toMatch(/\[\d{2}:\d{2}:\d{2}\] Speaker A/);
        expect(txt).not.toContain('**');
        expect(txt).not.toContain('> hello there');
        expect(txt).toContain('hello there');
        expect(txt).toContain('xin chao');
    });

    it('includes session-level metadata in frontmatter', () => {
        ui.addOriginal('hi');
        ui.addTranslation('chao');
        const md = ui.getExportText('md', { duration: '5m 0s', sourceLang: 'en', targetLang: 'vi' });
        expect(md).toContain('duration: 5m 0s');
        expect(md).toContain('source_lang: en');
        expect(md).toContain('target_lang: vi');
        expect(md).toContain(`segments: ${ui.sessionLog.length}`);
    });
});
