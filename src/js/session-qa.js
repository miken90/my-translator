/**
 * SessionQA — chat-style Q&A over a loaded session transcript.
 *
 * Fixed policy (no retrieval infra, no embeddings): full transcript as
 * context when under the token threshold; otherwise the same map-reduce
 * chunking used for AI summary (condenseForContext). No history
 * persistence beyond the session file — each question is answered fresh
 * from the transcript, in-memory chat history only lives for the current
 * sessions-view visit.
 */

import { callChatCompletion } from './ai-client.js';
import { aiSummary, estimateTokens, TOKEN_THRESHOLD } from './ai-summary.js';

const SYSTEM_PROMPT = `You are answering questions about a meeting or video transcript. Use ONLY the transcript content provided below as context — do not invent details. If the answer isn't in the transcript, say so clearly.

Transcript:
`;

class SessionQA {
    /**
     * @param {string} question
     * @param {string} transcriptText - full saved session .md content
     * @param {{ endpoint: string, apiKey: string, model: string, signal?: AbortSignal }} config
     * @returns {Promise<string>} the answer text
     */
    async ask(question, transcriptText, config) {
        const context = await this._buildContext(transcriptText, config);
        return callChatCompletion(
            [
                { role: 'system', content: SYSTEM_PROMPT + context },
                { role: 'user', content: question },
            ],
            config
        );
    }

    async _buildContext(transcriptText, config) {
        if (estimateTokens(transcriptText) <= TOKEN_THRESHOLD) {
            return transcriptText;
        }
        // Same map-reduce chunking as summary — condense to chunk-level
        // summaries instead of retrieval/embeddings.
        return aiSummary.condenseForContext(transcriptText, config);
    }
}

export const sessionQA = new SessionQA();
