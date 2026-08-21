// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../../src/js/session-manager.js';

function makeSessionManager(invoke) {
    return new SessionManager({
        transcriptUI: { hasSessionContent: () => false, getFullSessionText: () => null, getExportText: () => null },
        invoke,
        settingsManager: { get: () => ({}) },
        aiSummary: {},
        sessionQA: {},
        showToast: vi.fn(),
        showView: vi.fn(),
        getSessionMeta: () => ({}),
    });
}

describe('SessionManager crash-recovery decision logic', () => {
    let invokeMock;
    let sm;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="recovery-dialog" style="display:none"></div>
        `;
        invokeMock = vi.fn();
        sm = makeSessionManager(invokeMock);
    });

    it('shows the recovery dialog when an orphan temp transcript with content is found', async () => {
        invokeMock.mockResolvedValueOnce('---\ndate: 2026-08-21\n---\n\n> hello\n');

        await sm.checkForOrphanTempTranscript();

        expect(invokeMock).toHaveBeenCalledWith('read_transcript', { filename: '_recording.md' });
        expect(document.getElementById('recovery-dialog').style.display).toBe('flex');
        expect(sm._pendingRecoveryContent).toContain('hello');
    });

    it('does not show the dialog when no temp file exists (read_transcript rejects)', async () => {
        invokeMock.mockRejectedValueOnce(new Error('Failed to read transcript: not found'));

        await sm.checkForOrphanTempTranscript();

        expect(document.getElementById('recovery-dialog').style.display).toBe('none');
        expect(sm._pendingRecoveryContent).toBeNull();
    });

    it('cleans up silently (no dialog) when the temp file exists but is empty/whitespace', async () => {
        invokeMock.mockResolvedValueOnce('   \n  ');
        invokeMock.mockResolvedValueOnce(undefined); // delete_transcript_temp

        await sm.checkForOrphanTempTranscript();

        expect(invokeMock).toHaveBeenCalledWith('delete_transcript_temp');
        expect(document.getElementById('recovery-dialog').style.display).toBe('none');
    });

    it('recover: saves the pending content as a final session and deletes the temp file', async () => {
        sm._pendingRecoveryContent = 'orphaned transcript content';
        invokeMock.mockResolvedValueOnce('/path/to/2026-08-21_10-00-00.md'); // save_transcript
        invokeMock.mockResolvedValueOnce(undefined); // delete_transcript_temp

        await sm.recoverPendingTranscript();

        expect(invokeMock).toHaveBeenNthCalledWith(1, 'save_transcript', { content: 'orphaned transcript content' });
        expect(invokeMock).toHaveBeenNthCalledWith(2, 'delete_transcript_temp');
        expect(sm._pendingRecoveryContent).toBeNull();
        expect(document.getElementById('recovery-dialog').style.display).toBe('none');
    });

    it('recover: still cleans up and hides the dialog even if save_transcript fails', async () => {
        sm._pendingRecoveryContent = 'orphaned transcript content';
        invokeMock.mockRejectedValueOnce(new Error('disk full'));
        invokeMock.mockResolvedValueOnce(undefined); // delete_transcript_temp still called in finally

        await sm.recoverPendingTranscript();

        expect(invokeMock).toHaveBeenCalledWith('delete_transcript_temp');
        expect(sm._pendingRecoveryContent).toBeNull();
        expect(document.getElementById('recovery-dialog').style.display).toBe('none');
    });

    it('discard: deletes the temp file without ever calling save_transcript', async () => {
        sm._pendingRecoveryContent = 'orphaned transcript content';
        invokeMock.mockResolvedValueOnce(undefined); // delete_transcript_temp

        await sm.discardPendingTranscript();

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith('delete_transcript_temp');
        expect(sm._pendingRecoveryContent).toBeNull();
        expect(document.getElementById('recovery-dialog').style.display).toBe('none');
    });
});
