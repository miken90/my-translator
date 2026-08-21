/**
 * WindowManager — pin (always-on-top) and compact mode
 */

export class WindowManager {
    constructor(appWindow, { showToast } = {}) {
        this.appWindow = appWindow;
        this.isPinned = true;     // Always-on-top state
        this.isCompact = false;   // Compact mode (hide control bar)
        this._showToast = showToast || (() => {});
    }

    // ─── Event Binding ──────────────────────────────────────

    // `stopSession` is called before closing the window so an in-progress
    // session gets its final save (same as the app's own stop() path).
    bindEvents({ stopSession }) {
        document.getElementById('btn-close').addEventListener('click', async () => {
            await stopSession();
            await this.appWindow.close();
        });

        document.getElementById('btn-minimize').addEventListener('click', async () => {
            await this.appWindow.minimize();
        });

        document.getElementById('btn-pin').addEventListener('click', () => {
            this.togglePin();
        });

        document.getElementById('btn-compact').addEventListener('click', () => {
            this.toggleCompact();
        });
    }

    // ─── Pin / Unpin (Always on Top) ────────────────────

    async togglePin() {
        this.isPinned = !this.isPinned;
        await this.appWindow.setAlwaysOnTop(this.isPinned);
        const btn = document.getElementById('btn-pin');
        if (btn) {
            btn.classList.toggle('active', this.isPinned);
            btn.setAttribute('aria-pressed', String(this.isPinned));
        }
        this._showToast(this.isPinned ? 'Pinned on top' : 'Unpinned — window can go behind other apps', 'success');
    }

    // ─── Compact Mode ───────────────────────────────

    toggleCompact() {
        this.isCompact = !this.isCompact;
        const dragRegion = document.getElementById('drag-region');
        const overlay = document.getElementById('overlay-view');
        const btn = document.getElementById('btn-compact');

        if (this.isCompact) {
            dragRegion.classList.add('compact-hidden');
            overlay.classList.add('compact-mode');
        } else {
            dragRegion.classList.remove('compact-hidden');
            overlay.classList.remove('compact-mode');
        }
        if (btn) {
            btn.classList.toggle('active', this.isCompact);
            btn.setAttribute('aria-pressed', String(this.isCompact));
        }
    }
}
