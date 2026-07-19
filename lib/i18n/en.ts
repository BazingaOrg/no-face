import type { zh } from './zh';

// English (en) UI copy dictionary. Typed against `typeof zh` so a missing or
// extra key is a compile error, keeping the two dictionaries in lockstep.
export const en: typeof zh = {
  header: {
    title: 'No Face',
    privacyBadge: '🔒 Your photo stays here. Only here.',
  },
  windowDrag: {
    dropHint: 'Drop to upload',
  },
  uploader: {
    title: 'Upload a photo',
    titleDragging: 'Drop it here',
    subtitle: 'Click to browse, or drag and drop an image',
    formats: 'JPG, PNG, or WEBP (up to 20MB)',
    mobileHint: '📱 On mobile, use your camera or photo library',
    sampleButton: 'Try a sample photo',
  },
  processing: {
    shrinking: '⚙️ Shrinking your photo',
    analyzing: '🌀 Processing photo',
    detecting: '🔍 Looking for faces',
    redetecting: '🔁 Re-detecting faces',
    hintShrinking: 'Shrinking for detection — the export stays full quality',
    hintDefault: 'Hang tight, analyzing the photo...',
  },
  error: {
    title: 'Heads up',
    noFacesFound: '🙈 No faces found — try another photo',
    detectionFailed: '😵 Detection failed — tap Redetect to retry',
    modelLoadFailed: 'Model failed to load — refresh and try again',
  },
  status: {
    facesDetected: (n: number) => `✓ Found ${n} face${n === 1 ? '' : 's'}`,
    allReplacedLabel: '🎉 All replaced',
    replacedLabel: '⏳ Replaced',
    progressCount: (n: number, total: number) => `(${n}/${total})`,
    srReplacedCount: (n: number) => `${n} replaced`,
  },
  actions: {
    undoTitle: 'Undo (Ctrl/Cmd+Z)',
    redoTitle: 'Redo (Ctrl/Cmd+Shift+Z)',
    redetect: 'Redetect',
    newPhoto: 'New photo',
    applyAll: 'Replace all',
    applyAllTitleDisabled: 'Pick an emoji first',
    reset: 'Reset',
    undoLabel: 'Undo',
    redoLabel: 'Redo',
    redetectLabel: 'Redetect',
    resetLabel: 'Clear',
    newPhotoLabel: 'New photo',
    download: 'Download',
    downloadTitleDisabled: 'Replace a face first',
  },
  detectionMode: {
    relaxed: 'Relaxed',
    standard: 'Standard',
    strict: 'Strict',
    aria: 'Detection sensitivity',
  },
  badges: {
    faceLabel: (n: number) => `Face ${n}`,
    faceAria: (n: number, hasReplacement: boolean) =>
      `Face ${n}${hasReplacement ? ' (replaced, tap to adjust)' : ''}`,
    adjustTip: 'Adjust this emoji',
    replaceFirstTip: 'Replace it first, then adjust',
  },
  emojiToolbar: {
    randomTitle: 'Random emoji',
    searchPlaceholder: 'Search emoji',
    noMatch: '🙈 No matches',
    sizeLabel: '📐 Emoji size',
    sizeTiers: {
      small: 'Small',
      standard: 'Standard',
      large: 'Large',
    },
  },
  modelLoading: {
    title: 'Loading detection engine',
    subtitle: 'First run downloads the model — this only happens once...',
    phaseWasm: 'Downloading runtime',
    phaseModel: 'Loading detection model',
    tip: '💡 Tip: the model loads once — future visits start instantly',
  },
  toasts: {
    pickEmojiFirst: '👇 Pick an emoji first, then tap a face',
    unsupportedFileType: '🖼️ Only image files are supported',
    fileTooLarge: '📦 That photo is over 20MB',
    imageLoadFailed: '😵 Failed to load that image',
    sampleLoadFailed: '😵 Failed to load the sample photo',
    manyFaces: (n: number) => `🤯 Found ${n} faces — give me a moment`,
    resetCleared: '♻️ Cleared',
    redetectCleared: '🔄 Re-detected',
    exportSuccess: '✅ Saved to downloads',
  },
  common: {
    undo: 'Undo',
  },
  footer: {
    madeBy: 'Made with ❤️ by',
    viewSource: 'View Source',
  },
  languageToggle: {
    switchToLabel: '中',
    aria: 'Switch to Chinese',
  },
  themeToggle: {
    aria: 'Toggle dark/light theme',
  },
};
