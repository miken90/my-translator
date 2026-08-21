/**
 * AI Summary — OpenAI-compatible transcript summarization + persistence
 * formatting. Sends transcript to any OpenAI-compatible endpoint and
 * returns original + translated language summaries.
 *
 * Large transcripts (over TOKEN_THRESHOLD) are handled via map-reduce:
 * chunked on utterance (blank-line) boundaries, each chunk summarized
 * independently (map), then the chunk summaries are summarized again
 * (reduce) into one final original+translated pair. No truncation —
 * a 4h+ transcript completes without a context-length error, at some
 * cost to summary precision (documented limitation; regenerate is cheap).
 */

import { callChatCompletion } from './ai-client.js';

const SYSTEM_PROMPT = `You are a transcript summarizer. Given a transcript with original and translated text pairs, produce two concise summaries:

1. **Original Summary**: Summarize the content in the original language(s) detected from the transcript
2. **Translated Summary**: Summarize the content in the translated language detected from the transcript

Detect the languages from the transcript content. Keep summaries concise (3-5 sentences each).

Respond in this exact JSON format:
{"original": "summary in original language", "translated": "summary in translated language"}`;

// Rough heuristic: ~4 chars per token (no tokenizer dependency for this estimate).
const TOKEN_CHAR_RATIO = 4;
// If the transcript's estimated token count exceeds this, map-reduce chunk
// instead of sending it in one request.
export const TOKEN_THRESHOLD = 6000;
const CHUNK_TARGET_CHARS = TOKEN_THRESHOLD * TOKEN_CHAR_RATIO;

export function estimateTokens(text) {
    return Math.ceil((text || '').length / TOKEN_CHAR_RATIO);
}

/**
 * Split transcript text into chunks on utterance (blank-line-separated
 * entry) boundaries, never splitting an entry across two chunks, each
 * chunk capped at ~maxChars.
 */
export function chunkByUtterance(text, maxChars) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
        if (current && current.length + para.length + 2 > maxChars) {
            chunks.push(current);
            current = para;
        } else {
            current = current ? `${current}\n\n${para}` : para;
        }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [text];
}

class AISummary {
    /**
     * Summarize transcript content, chunking automatically if it's too large
     * for a single request.
     * @param {string} transcriptText - Raw transcript markdown content
     * @param {{ endpoint: string, apiKey: string, model: string, signal?: AbortSignal }} config
     * @returns {Promise<{ original: string, translated: string }>}
     */
    async summarize(transcriptText, config) {
        if (estimateTokens(transcriptText) <= TOKEN_THRESHOLD) {
            return this._summarizeSinglePass(transcriptText, config);
        }
        // Reduce step: summarize the concatenation of per-chunk summaries.
        const condensed = await this.condenseForContext(transcriptText, config);
        return this._summarizeSinglePass(condensed, config);
    }

    /**
     * Map phase only: chunk the transcript and summarize each chunk, then
     * concatenate — used as the reduce-input above, and reused as-is by
     * session-qa.js to build a condensed context for large transcripts
     * (same map-reduce chunking, no separate retrieval/embeddings).
     * @returns {Promise<string>}
     */
    async condenseForContext(transcriptText, config) {
        const chunks = chunkByUtterance(transcriptText, CHUNK_TARGET_CHARS);
        const summaries = [];
        for (const chunk of chunks) {
            const result = await this._summarizeSinglePass(chunk, config);
            summaries.push(`${result.original}\n${result.translated}`);
        }
        return summaries.join('\n\n---\n\n');
    }

    async _summarizeSinglePass(transcriptText, { endpoint, apiKey, model, signal }) {
        const content = await callChatCompletion(
            [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: transcriptText },
            ],
            { endpoint, apiKey, model, signal }
        );
        return this._parseResponse(content);
    }

    /**
     * Parse AI response — try JSON first, fallback to text splitting
     */
    _parseResponse(content) {
        // Try JSON parse
        try {
            const parsed = JSON.parse(content);
            if (parsed.original && parsed.translated) {
                return { original: parsed.original, translated: parsed.translated };
            }
        } catch { /* fallback to text parsing */ }

        // Try extracting JSON from markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.original && parsed.translated) {
                    return { original: parsed.original, translated: parsed.translated };
                }
            } catch { /* continue */ }
        }

        // Fallback: split on common section headers
        const parts = content.split(/\*\*(?:Original|Translated)\s*(?:Summary)?\*\*:?\s*/i).filter(Boolean);
        if (parts.length >= 2) {
            return { original: parts[0].trim(), translated: parts[1].trim() };
        }

        // Last resort: return whole content as original
        return { original: content.trim(), translated: '' };
    }

    /**
     * Format the "## AI Summary" section persisted into a session's .md
     * file. Model name + generation timestamp only — never the endpoint
     * URL or API key.
     */
    formatSummarySection({ original, translated, model }, generatedAt = new Date()) {
        const stamp = generatedAt.toISOString().replace('T', ' ').slice(0, 19);
        const lines = [
            '## AI Summary',
            '',
            `_Generated: ${stamp} · Model: ${model}_`,
            '',
            '**Original**',
            '',
            original,
            '',
            '**Translated**',
            '',
            translated,
        ];
        return lines.join('\n').trim();
    }

    /**
     * Replace any existing "## AI Summary" section in a saved transcript
     * with a freshly generated one (regenerate), or append if none exists
     * yet (first generate).
     */
    upsertSummarySection(fileContent, summarySection) {
        const withoutOld = this._stripSummarySection(fileContent);
        return `${withoutOld.trimEnd()}\n\n${summarySection}\n`;
    }

    _stripSummarySection(fileContent) {
        const startIdx = fileContent.indexOf('## AI Summary');
        if (startIdx === -1) return fileContent;

        // Section ends at the next top-level heading, or end of file.
        const rest = fileContent.slice(startIdx + '## AI Summary'.length);
        const nextHeadingMatch = rest.match(/\n## (?!AI Summary)/);
        const endIdx = nextHeadingMatch
            ? startIdx + '## AI Summary'.length + nextHeadingMatch.index
            : fileContent.length;

        return fileContent.slice(0, startIdx) + fileContent.slice(endIdx);
    }
}

export const aiSummary = new AISummary();
