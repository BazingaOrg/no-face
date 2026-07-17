# 模型文件设置指南

## 当前模型状态

### ✅ 已有模型（核心功能）

- `ssd_mobilenetv1_model` - SSD MobileNet V1 人脸检测器（推荐）
- `tiny_face_detector_model` - Tiny Face 检测器（极速模式）

### ❌ 已移除模型

#### Face Landmarks 68 Model（已移除）

**状态：** 该模型全库无调用点（自动旋转功能从未上线），已在 2026-07-17 的性能优化中移除，不再使用。以下章节仅作历史记录保留。

---

## 如何下载模型文件

### 方法一：从官方 CDN 下载（推荐）

```bash
# 进入 models 目录
cd public/models/

# 下载 Face Landmarks 68 模型
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model.bin
```

### 方法二：从 GitHub 下载

访问以下链接下载文件并放到 `public/models/` 目录：

- https://github.com/vladmandic/face-api/tree/master/model

需要的文件：
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model.bin`

### 方法三：使用备用 CDN

如果官方 CDN 较慢，可以使用备用源：

```bash
cd public/models/

# 使用 jsDelivr 镜像
curl -O https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_landmark_68_model-weights_manifest.json
curl -O https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_landmark_68_model.bin
```

**注意：** 如果下载的文件名是 `face_landmark_68_model-shard1`，需要重命名为 `face_landmark_68_model.bin`：
```bash
mv face_landmark_68_model-shard1 face_landmark_68_model.bin
```

---

## 验证安装

下载完成后，你的 `public/models/` 目录应该包含：

```
public/models/
├── ssd_mobilenetv1_model-weights_manifest.json
├── ssd_mobilenetv1_model.bin
├── tiny_face_detector_model-weights_manifest.json
├── tiny_face_detector_model.bin
├── face_landmark_68_model-weights_manifest.json  ✨ 新增
└── face_landmark_68_model.bin                    ✨ 新增
```

---

## 测试自动旋转功能

1. 重启开发服务器：`npm run dev`
2. 上传一张包含人脸的图片
3. 在浏览器控制台查看是否有：`✅ Face Landmarks 68 模型加载成功`
4. 替换表情后，在「高级设置」→「旋转角度」旁边会出现 **🎯 自动** 按钮
5. 点击「自动」按钮，表情会自动匹配人脸角度

---

## 故障排除

### 看到 "⚠️ Face Landmarks 68 模型未找到" 警告？

**原因：** 模型文件未正确放置

**解决方案：**
1. 确认文件在 `public/models/` 目录下
2. 确认文件名完全正确（区分大小写）
3. 清除浏览器缓存并刷新页面
4. 检查文件是否损坏（重新下载）

### 自动旋转按钮不显示？

**可能原因：**
1. Landmarks 模型未加载成功
2. 还没有替换表情（需要先选择表情并替换到人脸上）
3. 浏览器控制台有错误信息

---

## 性能影响

| 功能 | 加载时间 | 检测耗时 | 内存占用 |
|------|---------|---------|---------|
| 基础检测 | ~200ms | ~100ms | ~10MB |
| + Landmarks | +50ms | +30ms | +5MB |

**结论：** Landmarks 模型对性能影响很小，建议安装以获得更好的用户体验。

---

## 其他可选模型（暂未使用）

以下模型目前未集成到项目中，仅供参考：

- `face_recognition_model` - 人脸识别
- `face_expression_model` - 表情识别
- `age_gender_model` - 年龄性别识别
- `mtcnn_model` - MTCNN 检测器（高精度）

如果需要这些功能，可以在 GitHub Issues 提出建议。

