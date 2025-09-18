# GifToFrames

一个纯前端的 GIF 拆帧与雪碧图生成器，基于浏览器端的 GIF 解析实现，不需要上传文件即可获得所有帧、雪碧图 PNG、CSS 动画代码与 TAR/JSON 元数据。

## 功能概览

- 拖拽或选择 GIF 后，在浏览器中解析所有帧。
- 自动合成雪碧图，可自定义列数、间距、背景色并导出 PNG。
- 一键生成 CSS `steps()` 动画代码，便于嵌入网页。
- 支持下载所有帧的 TAR 包以及帧信息 JSON 文件。
- 提供 Rickroll、Nyan Cat、Dancing Baby 等热门 GIF 的专属内容页。
- 内置示例 GIF 由脚本生成，适合二次创作或 SEO 落地页扩展。

## 目录结构

```
assets/
  css/styles.css       # 页面样式
  js/
    popularSources.js  # 热门 GIF 的内嵌 data URI 数据
    gifParser.js       # GIF 解码与帧提取逻辑
    frameTools.js      # 帧合成、雪碧图、CSS、元数据工具
    resultView.js      # 负责渲染结果视图与下载逻辑
    tar.js             # 简易 TAR 打包实现
    app.js             # 首页交互逻辑
    popularPage.js     # 热门 GIF 页面脚本
index.html             # 主工具页面
popular/               # 各热门 GIF 专页
scripts/generate_sample_gifs.py  # 生成示例 GIF 的脚本
```

## 本地运行

本项目为静态站点，直接用任意静态服务器或浏览器打开即可。

```bash
# 方式一：使用 Python 启动本地服务器
python -m http.server 8000
# 访问 http://localhost:8000/index.html

# 方式二：直接在浏览器打开 index.html（部分浏览器需要允许本地模块加载）
```

## 生成示例 GIF

仓库内的示例 GIF 通过 `scripts/generate_sample_gifs.py` 脚本自动生成，如需重新生成可执行：

```bash
python scripts/generate_sample_gifs.py
```

脚本会在 `generated-gifs/` 目录下生成可下载的 GIF 文件，并将其 Base64 编码写入
`assets/js/popularSources.js`，供页面以 data URI 的形式引用。由于仓库不再包含二进制
GIF，若需更新示例素材，请运行上述脚本并提交更新后的 JS 文本文件即可。

## 二次处理建议

- 利用导出的 TAR 包与 JSON 元数据，可在 Unity、Godot 等游戏引擎中快速创建序列帧动画。
- CSS 动画代码可直接应用到网页的 steps 动画，实现加载、提示等互动效果。
- 将 PNG 帧导入视频编辑软件（如 Premiere、AE、剪映），可制作短视频、贴纸素材或直播素材。
- 与背景抠图、WebP 压缩等工具组合，可继续生成高效的 Web 动效资源。
