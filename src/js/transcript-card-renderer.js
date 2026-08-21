/**
 * CardRenderer — keyed incremental DOM for TranscriptUI's card list.
 *
 * Owns the segId -> card element map and the singleton provisional card
 * element. A render pass only writes a card's innerHTML when its computed
 * content signature actually changed, so an unrelated provisional-text
 * update never repaints already-settled cards. Card creation/removal
 * follows the segments array directly (append-only aside from trim/stale
 * removal — ids are monotonic and never reordered — so DOM order never
 * needs reconciling beyond appendChild).
 */
export class CardRenderer {
    constructor(contentEl) {
        this.contentEl = contentEl;
        this._cardNodes = new Map(); // segId -> card element
        this._provisionalCardEl = null;
    }

    setContentEl(contentEl) {
        this.contentEl = contentEl;
    }

    /** Drop all tracked nodes — call whenever the container was wiped externally. */
    reset() {
        this._cardNodes.clear();
        this._provisionalCardEl = null;
    }

    /**
     * @param {Array} segments - TranscriptUI.segments (already trimmed)
     * @param {{text: string, speaker: ?string, language: ?string}} provisional
     */
    render(segments, provisional) {
        const seenIds = new Set();
        let lastRenderedSpeaker = null;
        let lastRenderedLang = null;

        for (const seg of segments) {
            // Speaker/language "last shown" tracking updates every pass
            // regardless of whether this segment renders a card — matches
            // the original full-rebuild renderer's behavior exactly.
            const showSpeaker = seg.speaker && seg.speaker !== lastRenderedSpeaker;
            const showLang = seg.language && seg.language !== lastRenderedLang;
            if (showSpeaker) lastRenderedSpeaker = seg.speaker;
            if (showLang) lastRenderedLang = seg.language;

            if (!this._isCardVisible(seg)) {
                const stale = this._cardNodes.get(seg.id);
                if (stale) {
                    stale.remove();
                    this._cardNodes.delete(seg.id);
                }
                continue;
            }

            seenIds.add(seg.id);
            let cardEl = this._cardNodes.get(seg.id);
            if (!cardEl) {
                cardEl = document.createElement('div');
                this._cardNodes.set(seg.id, cardEl);
                // Segments are append-only aside from removals, so a
                // brand-new card always belongs at the end.
                this.contentEl.appendChild(cardEl);
            }
            this._patchCard(cardEl, seg, showSpeaker, showLang);
        }

        // Remove cards for segments no longer tracked (trim / stale-expiry).
        // A translation-arriving-after-trim never reaches here for the
        // vanished id — TranscriptUI.addTranslation's own lookup already
        // treats it as gone — so there is nothing to patch for it; this
        // loop only ever cleans up cards for ids genuinely dropped.
        for (const [id, node] of this._cardNodes) {
            if (!seenIds.has(id)) {
                node.remove();
                this._cardNodes.delete(id);
            }
        }

        this._renderProvisionalCard(provisional, lastRenderedSpeaker, lastRenderedLang);
    }

    /**
     * A segment only renders a card when it has visible content — mirrors
     * the pre-keyed renderer's implicit "else: nothing" branch (a pending
     * 'original' segment with empty text renders nothing at all).
     */
    _isCardVisible(seg) {
        if (seg.status === 'translated' && seg.translation) return true;
        if (seg.status === 'original' && seg.original) return true;
        return false;
    }

    _patchCard(cardEl, seg, showSpeaker, showLang) {
        const isStale = seg.status === 'original' && !!seg.isStale;
        const lowConfidence = seg.status === 'translated' && seg.confidence !== null && seg.confidence < 0.7;
        const sig = JSON.stringify([
            seg.status, seg.original, seg.translation, isStale, lowConfidence,
            showSpeaker ? seg.speaker : null,
            showLang ? seg.language : null,
            seg.createdAt,
        ]);
        if (cardEl.dataset.sig === sig) return;
        cardEl.dataset.sig = sig;

        cardEl.className = 'seg-card' + (isStale ? ' seg-stale' : '');
        cardEl.innerHTML = this._buildCardInnerHtml(seg, showSpeaker, showLang, isStale, lowConfidence);
    }

    _buildCardHeaderHtml(speaker, language, showSpeaker, showLang, time) {
        if (!showSpeaker && !showLang) return '';
        let headerHtml = '<div class="seg-header">';
        if (showSpeaker) headerHtml += `<span class="speaker-label">Speaker ${speaker}</span>`;
        if (showLang) headerHtml += `<span class="lang-badge">${this._langEmoji(language)}</span>`;
        headerHtml += `<span class="seg-time">${time}</span>`;
        headerHtml += '</div>';
        return headerHtml;
    }

    _buildCardInnerHtml(seg, showSpeaker, showLang, isStale, lowConfidence) {
        const time = this._formatTime(seg.createdAt);
        const headerHtml = this._buildCardHeaderHtml(seg.speaker, seg.language, showSpeaker, showLang, time);

        if (seg.status === 'translated') {
            const confidenceClass = lowConfidence ? ' low-confidence' : '';
            return headerHtml +
                `<div class="seg-original">${this._esc(seg.original || '')}</div>` +
                `<div class="seg-translation${confidenceClass}">${this._esc(seg.translation)}</div>`;
        }

        // status === 'original' (the only other visible case)
        if (isStale) {
            return headerHtml + `<div class="seg-original seg-stale-text">${this._esc(seg.original)}</div>`;
        }
        return headerHtml +
            `<div class="seg-original">${this._esc(seg.original)}</div>` +
            `<div class="seg-translation pending">...</div>`;
    }

    _renderProvisionalCard(provisional, lastRenderedSpeaker, lastRenderedLang) {
        if (!provisional.text) {
            if (this._provisionalCardEl) {
                this._provisionalCardEl.remove();
                this._provisionalCardEl = null;
            }
            return;
        }

        if (!this._provisionalCardEl) {
            this._provisionalCardEl = document.createElement('div');
            this.contentEl.appendChild(this._provisionalCardEl);
        } else {
            // appendChild on a node already in the tree relocates it — keeps
            // the provisional card last even if new cards appeared after it.
            this.contentEl.appendChild(this._provisionalCardEl);
        }

        const sig = JSON.stringify([
            provisional.text, provisional.speaker, provisional.language,
            lastRenderedSpeaker, lastRenderedLang,
        ]);
        if (this._provisionalCardEl.dataset.sig === sig) return;
        this._provisionalCardEl.dataset.sig = sig;

        let provHeader = '';
        if (provisional.speaker && provisional.speaker !== lastRenderedSpeaker) {
            provHeader += `<span class="speaker-label">Speaker ${provisional.speaker}</span>`;
        }
        if (provisional.language && provisional.language !== lastRenderedLang) {
            provHeader += `<span class="lang-badge">${this._langEmoji(provisional.language)}</span>`;
        }
        if (provHeader) provHeader = `<div class="seg-header">${provHeader}</div>`;

        this._provisionalCardEl.className = 'seg-card seg-provisional-card';
        this._provisionalCardEl.innerHTML = provHeader + `<div class="seg-provisional">${this._esc(provisional.text)}</div>`;
    }

    _formatTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _esc(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /** Language flag emoji + code */
    _langEmoji(langCode) {
        const flags = {
            'en': '🇬🇧', 'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳',
            'vi': '🇻🇳', 'fr': '🇫🇷', 'de': '🇩🇪', 'es': '🇪🇸',
            'th': '🇹🇭', 'id': '🇮🇩', 'pt': '🇵🇹', 'ru': '🇷🇺',
            'ar': '🇸🇦', 'hi': '🇮🇳', 'it': '🇮🇹', 'nl': '🇳🇱',
            'pl': '🇵🇱', 'tr': '🇹🇷', 'sv': '🇸🇪', 'da': '🇩🇰',
            'no': '🇳🇴', 'fi': '🇫🇮', 'el': '🇬🇷', 'cs': '🇨🇿',
            'ro': '🇷🇴', 'hu': '🇭🇺', 'uk': '🇺🇦', 'he': '🇮🇱',
            'ms': '🇲🇾', 'tl': '🇵🇭', 'bn': '🇧🇩', 'ta': '🇱🇰',
        };
        const flag = flags[langCode] || '🌐';
        return `${flag} ${langCode.toUpperCase()}`;
    }
}
