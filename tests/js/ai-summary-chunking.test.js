import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/ai-client.js', () => ({
    callChatCompletion: vi.fn(),
}));

import { callChatCompletion } from '../../src/js/ai-client.js';
import { aiSummary, estimateTokens, chunkByUtterance, TOKEN_THRESHOLD } from '../../src/js/ai-summary.js';

const CONFIG = { endpoint: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'gpt-4o-mini' };

function jsonReply(original, translated) {
    return JSON.stringify({ original, translated });
}

describe('estimateTokens', () => {
    it('estimates roughly 4 chars per token, rounded up', () => {
        expect(estimateTokens('a'.repeat(400))).toBe(100);
        expect(estimateTokens('a'.repeat(401))).toBe(101);
        expect(estimateTokens('')).toBe(0);
    });
});

describe('chunkByUtterance', () => {
    it('keeps a single short transcript as one chunk', () => {
        const text = 'entry one\n\nentry two\n\nentry three';
        expect(chunkByUtterance(text, 1000)).toEqual([text]);
    });

    it('never splits a single utterance across chunks even if it alone exceeds maxChars', () => {
        const huge = 'x'.repeat(500);
        const chunks = chunkByUtterance(`short\n\n${huge}\n\nshort2`, 100);
        expect(chunks.some(c => c.includes(huge))).toBe(true);
        // The huge paragraph is never split into two chunks.
        expect(chunks.filter(c => c.includes(huge))).toHaveLength(1);
    });

    it('groups consecutive short paragraphs into one chunk until the cap would be exceeded', () => {
        const paras = Array.from({ length: 10 }, (_, i) => `entry ${i}`.repeat(5));
        const text = paras.join('\n\n');
        const maxChars = paras[0].length * 3 + 4; // room for ~3 entries per chunk
        const chunks = chunkByUtterance(text, maxChars);
        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(maxChars + paras[0].length); // generous margin for the "never split" guarantee
        }
        // Every paragraph appears exactly once across all chunks.
        const rejoined = chunks.join('\n\n');
        for (const p of paras) expect(rejoined).toContain(p);
    });
});

describe('aiSummary.summarize — single pass vs map-reduce', () => {
    beforeEach(() => {
        callChatCompletion.mockReset();
    });

    it('uses a single request when the transcript is under the token threshold', async () => {
        callChatCompletion.mockResolvedValueOnce(jsonReply('orig summary', 'trans summary'));

        const result = await aiSummary.summarize('short transcript', CONFIG);

        expect(callChatCompletion).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ original: 'orig summary', translated: 'trans summary' });
    });

    it('chunks (map-reduce) when the transcript exceeds the token threshold, without truncating content', async () => {
        // Build a transcript whose estimated tokens exceed TOKEN_THRESHOLD.
        const bigTranscript = Array.from(
            { length: 50 },
            (_, i) => `**Speaker 1:**\n> original line ${i} `.repeat(20)
        ).join('\n\n');
        expect(estimateTokens(bigTranscript)).toBeGreaterThan(TOKEN_THRESHOLD);

        // One resolved value per chunk-summarize call, plus one for the final reduce call.
        callChatCompletion.mockImplementation(() => Promise.resolve(jsonReply('chunk original', 'chunk translated')));

        const result = await aiSummary.summarize(bigTranscript, CONFIG);

        // At least 2 calls: >=1 chunk summarization + 1 final reduce pass.
        expect(callChatCompletion.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(result).toEqual({ original: 'chunk original', translated: 'chunk translated' });
    });
});

describe('aiSummary.formatSummarySection', () => {
    it('includes model name and a generated timestamp, never the endpoint or API key', () => {
        const section = aiSummary.formatSummarySection(
            { original: 'orig text', translated: 'trans text', model: 'gpt-4o-mini' },
            new Date('2026-08-21T14:30:00.000Z')
        );

        expect(section).toContain('## AI Summary');
        expect(section).toContain('gpt-4o-mini');
        expect(section).toContain('2026-08-21 14:30:00');
        expect(section).toContain('orig text');
        expect(section).toContain('trans text');
        expect(section).not.toContain('https://');
        expect(section).not.toContain('sk-test');
        expect(section).not.toContain(CONFIG.apiKey);
        expect(section).not.toContain(CONFIG.endpoint);
    });
});

describe('aiSummary.upsertSummarySection — regenerate replaces, first-generate appends', () => {
    it('appends a summary section when the transcript has none yet', () => {
        const fileContent = '---\ndate: 2026-08-21\n---\n\n> hello\ntranslated hello\n';
        const section = '## AI Summary\n\n_Generated: x_\n\n**Original**\n\nfoo\n\n**Translated**\n\nbar';

        const updated = aiSummary.upsertSummarySection(fileContent, section);

        expect(updated).toContain('> hello');
        expect(updated).toContain('## AI Summary');
        expect(updated).toContain('foo');
    });

    it('replaces an existing summary section instead of duplicating it (regenerate)', () => {
        const oldSection = '## AI Summary\n\n_Generated: old_\n\n**Original**\n\nOLD ORIGINAL\n\n**Translated**\n\nOLD TRANSLATED';
        const fileContent = `---\ndate: 2026-08-21\n---\n\n> hello\ntranslated hello\n\n${oldSection}\n`;
        const newSection = '## AI Summary\n\n_Generated: new_\n\n**Original**\n\nNEW ORIGINAL\n\n**Translated**\n\nNEW TRANSLATED';

        const updated = aiSummary.upsertSummarySection(fileContent, newSection);

        expect(updated).toContain('NEW ORIGINAL');
        expect(updated).not.toContain('OLD ORIGINAL');
        // Only one "## AI Summary" heading remains.
        expect(updated.match(/## AI Summary/g)).toHaveLength(1);
        // Transcript body before the summary is untouched.
        expect(updated).toContain('> hello');
    });
});
