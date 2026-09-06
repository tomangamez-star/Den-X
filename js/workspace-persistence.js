// ============================================================
// TEMPORARY WORKSPACE HANDOFF
// Keeps the animation room intact while Figure Creator is open.
// This is not DenX's future full project-save system.
// ============================================================

(() => {
    const HANDOFF_KEY = "denx.workspaceHandoff.v1";

    window.denxSaveWorkspaceHandoff = () => {
        if (!window.denxTimelineCaptureSession) return false;

        const payload = {
            version: 1,
            savedAt: Date.now(),
            timeline: window.denxTimelineCaptureSession()
        };

        try {
            sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
            return true;
        } catch (error) {
            console.warn("DenX workspace handoff could not be saved:", error);
            return false;
        }
    };

    function restoreWorkspaceHandoff() {
        const raw = sessionStorage.getItem(HANDOFF_KEY);
        if (!raw) return;

        try {
            const payload = JSON.parse(raw);

            if (payload?.timeline && window.denxTimelineRestoreSession) {
                window.denxTimelineRestoreSession(payload.timeline);
            }
        } catch (error) {
            console.warn("DenX workspace handoff could not be restored:", error);
        } finally {
            sessionStorage.removeItem(HANDOFF_KEY);
        }
    }

    restoreWorkspaceHandoff();
})();
