/**
 * AI Summary — OpenAI-compatible API client for transcript summarization
 * Sends transcript to any OpenAI-compatible endpoint and returns
 * original + translated language summaries.
 */

const SYSTEM_PROMPT = `You are a transcript summarizer. Given a transcript with original and translated text pairs, produce two concise summaries:

1. **Original Summary**: Summarize the content in the original language(s) detected from the transcript
2. **Translated Summary**: Summarize the content in the translated language detected from the transcript

Detect the languages from the transcript content. Keep summaries concise (3-5 sentences each).

Respond in this exact JSON format:
{"original": "summary in original language", "translated": "summary in translated language"}`;

const MAX_TRANSCRIPT_CHARS = 30000;
const REQUEST_TIMEOUT_MS = 60000;

class AISummary {
    /**
     * Summarize transcript content via OpenAI-compatible chat completions API
     * @param {string} transcriptText - Raw transcript markdown content
     * @param {{ endpoint: string, apiKey: string, model: string }} config
     * @returns {Promise<{ original: string, translated: string }>}
     */
    async summarize(transcriptText, { endpoint, apiKey, model, signal }) {
        const baseUrl = endpoint.replace(/\/+$/, '');
        const url = `${baseUrl}/chat/completions`;

        // Truncate long transcripts to avoid blowing model context
        const truncated = transcriptText.length > MAX_TRANSCRIPT_CHARS
            ? transcriptText.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[...transcript truncated]'
            : transcriptText;

        // Combine caller signal (cancel on navigate) with timeout signal
        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
        if (signal) signal.addEventListener('abort', () => timeoutController.abort());

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: truncated },
                    ],
                    temperature: 0.3,
                }),
                signal: timeoutController.signal,
            });
        } catch (err) {
            if (err.name === 'AbortError') throw new Error('Request timed out (60s)');
            throw new Error('Network error — check endpoint URL and connection');
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            if (response.status === 401) throw new Error('Invalid API key');
            if (response.status === 429) throw new Error('Rate limited — try again later');
            if (response.status === 404) throw new Error('Model not found or invalid endpoint');
            throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
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
}

export const aiSummary = new AISummary();
