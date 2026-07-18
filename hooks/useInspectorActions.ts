import { useCallback, Dispatch, SetStateAction } from 'react';
import { EmojiReplacement, EmojiSettings } from '@/types';
import { useI18n } from '@/lib/i18n';

interface UseInspectorActionsParams {
  activeReplacement: EmojiReplacement | null;
  emojiSettings: EmojiSettings;
  applyReplacementPatch: (
    faceId: string,
    patch: Partial<EmojiReplacement>,
    options?: { customState?: boolean }
  ) => void;
  setEmojiSettings: (next: EmojiSettings) => void;
  setReplacements: Dispatch<SetStateAction<EmojiReplacement[]>>;
  showToast: (message: string) => void;
  setActiveReplacementId: (faceId: string | null) => void;
  // Call before mutating replacements so the change becomes undoable.
  // Not called from handleUpdate itself — that fires many times per drag/slider
  // gesture, and callers signal the start of each gesture separately.
  pushHistory: () => void;
}

export function useInspectorActions({
  activeReplacement,
  emojiSettings,
  applyReplacementPatch,
  setEmojiSettings,
  setReplacements,
  showToast,
  setActiveReplacementId,
  pushHistory,
}: UseInspectorActionsParams) {
  const { t } = useI18n();

  const handleUpdate = useCallback(
    (patch: Partial<EmojiReplacement>) => {
      if (!activeReplacement) return;
      applyReplacementPatch(activeReplacement.faceId, patch);
    },
    [activeReplacement, applyReplacementPatch]
  );

  const handleResetToDefault = useCallback(() => {
    if (!activeReplacement) return;

    pushHistory();
    applyReplacementPatch(
      activeReplacement.faceId,
      {
        scale: emojiSettings.scale,
        opacity: emojiSettings.opacity,
        flipX: emojiSettings.flipX,
        flipY: emojiSettings.flipY,
        // Global defaults have no position concept — reset re-centers the emoji
        offsetX: 0,
        offsetY: 0,
      },
      { customState: false }
    );

    showToast(t.toasts.resetToDefaultDone);
  }, [activeReplacement, emojiSettings, applyReplacementPatch, pushHistory, showToast, t]);

  const handleAdoptAsDefault = useCallback(() => {
    if (!activeReplacement) return;

    const nextDefaults: EmojiSettings = {
      ...emojiSettings,
      scale: activeReplacement.scale ?? emojiSettings.scale,
      opacity: activeReplacement.opacity ?? emojiSettings.opacity,
      flipX: activeReplacement.flipX ?? emojiSettings.flipX,
      flipY: activeReplacement.flipY ?? emojiSettings.flipY,
    };

    setEmojiSettings(nextDefaults);

    pushHistory();
    applyReplacementPatch(
      activeReplacement.faceId,
      {
        scale: nextDefaults.scale,
        opacity: nextDefaults.opacity,
        flipX: nextDefaults.flipX,
        flipY: nextDefaults.flipY,
      },
      { customState: false }
    );

    showToast(t.toasts.adoptedAsDefault);
  }, [
    activeReplacement,
    emojiSettings,
    setEmojiSettings,
    applyReplacementPatch,
    pushHistory,
    showToast,
    t,
  ]);

  const handleApplyToAll = useCallback(() => {
    if (!activeReplacement) return;

    const nextScale = activeReplacement.scale ?? emojiSettings.scale;
    const nextOpacity = activeReplacement.opacity ?? emojiSettings.opacity;
    const nextFlipX = activeReplacement.flipX ?? emojiSettings.flipX;
    const nextFlipY = activeReplacement.flipY ?? emojiSettings.flipY;

    pushHistory();
    setReplacements((prev) =>
      prev.map((replacement) => ({
        ...replacement,
        scale: nextScale,
        opacity: nextOpacity,
        flipX: nextFlipX,
        flipY: nextFlipY,
        isCustom: true,
      }))
    );

    showToast(t.toasts.appliedToAll);
  }, [activeReplacement, emojiSettings, setReplacements, pushHistory, showToast, t]);

  const handleClose = useCallback(() => {
    setActiveReplacementId(null);
  }, [setActiveReplacementId]);

  return {
    handleUpdate,
    handleResetToDefault,
    handleAdoptAsDefault,
    handleApplyToAll,
    handleClose,
  };
}
