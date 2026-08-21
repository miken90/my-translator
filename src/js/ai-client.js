/**
 * Shared OpenAI-compatible chat-completions client, used by ai-summary.js
 * and session-qa.js so both features share one fetch/timeout/error path.
 */

const REQUEST_TIMEOUT_MS = 60000;

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ endpoint: string, apiKey: string, model: string, signal?: AbortSignal, temperature?: number }} config
 * @returns {Promise<string>} the assistant message content
 */
export async function callChatCompletion(messages, { endpoint, apiKey, model, signal, temperature = 0.3 }) {
    const baseUrl = endpoint.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    // Combine caller signal (cancel on navigate) with a request timeout
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
            body: JSON.stringify({ model, messages, temperature }),
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
    return data.choices?.[0]?.message?.content || '';
}
