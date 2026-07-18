// Chinese (zh) UI copy dictionary. This is the canonical shape — `en.ts` is
// typed against `typeof zh` so the two dictionaries can never drift in keys.
export const zh = {
  header: {
    title: 'カオナシ',
    privacyBadge: '🔒 照片在这里，也只在这里',
  },
  windowDrag: {
    dropHint: '松手上传',
  },
  uploader: {
    title: '上传图片',
    titleDragging: '松开上传',
    subtitle: '点击选择或拖拽图片到此处',
    formats: '支持 JPG、PNG、WEBP 格式（最大 20MB）',
    mobileHint: '📱 移动设备可直接调用相机或相册',
    sampleButton: '试试示例图',
  },
  processing: {
    shrinking: '⚙️ 正在瘦身图片',
    analyzing: '🌀 图片处理中',
    detecting: '🔍 正在找脸',
    redetecting: '🔁 正在重新找脸',
    hintShrinking: '图片瘦身中，导出依旧高清',
    hintDefault: '稍等片刻，正在分析图片...',
  },
  error: {
    title: '提示',
    noFacesFound: '🙈 没找到人脸，换张试试',
    detectionFailed: '😵 检测出错了，点「重新检测」再试一次',
    modelLoadFailed: '模型加载失败，请刷新页面或检查网络后重试',
  },
  status: {
    facesDetected: (n: number) => `✓ 检测到 ${n} 张人脸`,
    allReplacedLabel: '🎉 已全部替换',
    replacedLabel: '⏳ 已替换',
    progressCount: (n: number, total: number) => `(${n}/${total})`,
    srReplacedCount: (n: number) => `已替换 ${n} 项`,
  },
  actions: {
    undoTitle: '撤销 (Ctrl/Cmd+Z)',
    redoTitle: '重做 (Ctrl/Cmd+Shift+Z)',
    redetect: '重新检测',
    newPhoto: '换一张',
    applyAll: '全部替换',
    applyAllTitleDisabled: '请先选择表情',
    reset: '重置',
    undoLabel: '撤销',
    redoLabel: '重做',
    redetectLabel: '重新检测',
    resetLabel: '清空',
    newPhotoLabel: '换一张',
    download: '下载图片',
    downloadTitleDisabled: '请先替换表情',
  },
  badges: {
    faceLabel: (n: number) => `第 ${n} 张脸`,
    faceAria: (n: number, hasReplacement: boolean) =>
      `第 ${n} 张脸${hasReplacement ? '（已替换，点击微调）' : ''}`,
    adjustTip: '微调当前表情',
    replaceFirstTip: '先替换后再微调',
  },
  emojiToolbar: {
    randomTitle: '随机表情',
    searchPlaceholder: '搜索表情，比如「笑」「猫」「生气」...',
    noMatch: '🙈 没找到匹配的表情',
    sizeLabel: '📐 表情大小',
  },
  modelLoading: {
    title: '正在加载检测引擎',
    subtitle: '首次使用需要下载模型，请稍候...',
    phaseWasm: '下载运行时',
    phaseModel: '加载检测模型',
    tip: '💡 提示：模型仅需加载一次，后续访问将秒开',
  },
  toasts: {
    pickEmojiFirst: '👇 先选一个表情，再点人脸',
    unsupportedFileType: '🖼️ 只支持图片文件',
    fileTooLarge: '📦 图片超过 20MB',
    imageLoadFailed: '😵 图片加载失败',
    sampleLoadFailed: '😵 示例图加载失败',
    manyFaces: (n: number) => `🤯 发现 ${n} 张脸，稍等我慢慢处理`,
    resetCleared: '♻️ 已清空',
    redetectCleared: '🔄 已重新检测',
    exportSuccess: '✅ 已保存到下载',
  },
  common: {
    undo: '撤销',
  },
  footer: {
    madeBy: 'Made with ❤️ by',
    viewSource: 'View Source',
  },
  languageToggle: {
    switchToLabel: 'EN',
    aria: '切换到英文',
  },
  themeToggle: {
    aria: '切换深色/浅色模式',
  },
};
