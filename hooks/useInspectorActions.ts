import { useCallback, Dispatch, SetStateAction } from 'react';
import { EmojiReplacement, EmojiSettings } from '@/types';

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
}

export function useInspectorActions({
  activeReplacement,
  emojiSettings,
  applyReplacementPatch,
  setEmojiSettings,
  setReplacements,
  showToast,
  setActiveReplacementId,
}: UseInspectorActionsParams) {
  const handleUpdate = useCallback(
    (patch: Partial<EmojiReplacement>) => {
      if (!activeReplacement) return;
      applyReplacementPatch(activeReplacement.faceId, patch);
    },
    [activeReplacement, applyReplacementPatch]
  );

  const handleResetToDefault = useCallback(() => {
    if (!activeReplacement) return;

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

    showToast('🌟 样式回到默认啦');
  }, [activeReplacement, emojiSettings, applyReplacementPatch, showToast]);

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

    showToast('✅ 默认样式已更新');
  }, [
    activeReplacement,
    emojiSettings,
    setEmojiSettings,
    applyReplacementPatch,
    showToast,
  ]);

  const handleApplyToAll = useCallback(() => {
    if (!activeReplacement) return;

    const nextScale = activeReplacement.scale ?? emojiSettings.scale;
    const nextOpacity = activeReplacement.opacity ?? emojiSettings.opacity;
    const nextFlipX = activeReplacement.flipX ?? emojiSettings.flipX;
    const nextFlipY = activeReplacement.flipY ?? emojiSettings.flipY;

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

    showToast('🚀 全部表情同步完成');
  }, [activeReplacement, emojiSettings, setReplacements, showToast]);

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
