import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/ai-client.js', () => ({
    callChatCompletion: vi.fn(),
}));

import { callChatCompletion } from '../../src/js/ai-client.js';
import { sessionQA } from '../../src/js/session-qa.js';
import { TOKEN_THRESHOLD } from '../../src/js/ai-summary.js';

const CONFIG = { endpoint: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'gpt-4o-mini' };

describe('SessionQA — fixed context policy (no retrieval, no embeddings)', () => {
    beforeEach(() => {
        callChatCompletion.mockReset();
    });

    it('uses the full transcript as context when under the token threshold (single request)', async () => {
        callChatCompletion.mockResolvedValueOnce('The answer is 42.');

        const answer = await sessionQA.ask('What is the answer?', 'short transcript content', CONFIG);

        expect(callChatCompletion).toHaveBeenCalledTimes(1);
        const [messages] = callChatCompletion.mock.calls[0];
        expect(messages[0].content).toContain('short transcript content');
        expect(messages[1]).toEqual({ role: 'user', content: 'What is the answer?' });
        expect(answer).toBe('The answer is 42.');
    });

    it('condenses via the same map-reduce chunking as summary when over the token threshold', async () => {
        const bigTranscript = 'x '.repeat(TOKEN_THRESHOLD * 4 + 1000); // well over threshold in chars
        // condenseForContext calls callChatCompletion once per chunk; final ask() call is one more.
        callChatCompletion.mockImplementation(() => Promise.resolve('chunk summary'));

        await sessionQA.ask('Summarize the key decision', bigTranscript, CONFIG);

        // At least 2 calls: >=1 for chunk condensing + 1 for the final Q&A answer.
        expect(callChatCompletion.mock.calls.length).toBeGreaterThanOrEqual(2);
        const finalCallMessages = callChatCompletion.mock.calls[callChatCompletion.mock.calls.length - 1][0];
        expect(finalCallMessages[1]).toEqual({ role: 'user', content: 'Summarize the key decision' });
        // The condensed context (not the raw huge transcript) is what's sent as system content.
        expect(finalCallMessages[0].content).toContain('chunk summary');
    });
});
