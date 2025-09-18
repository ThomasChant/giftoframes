# GifToFrames

A fully client-side GIF frame extraction and sprite sheet generator. The browser decodes each GIF directly, so you can preview every frame, export PNG sprite sheets, grab CSS animation snippets, and download TAR/JSON metadata without uploading any files.

## Feature overview

- Drag and drop a GIF (or pick one from disk) to parse every frame in the browser.
- Automatically assemble sprite sheets with configurable columns, spacing, and background color, then export as PNG.
- Generate ready-to-use CSS `steps()` animations alongside the sprite sheet.
- Download the complete frame set as a TAR archive plus detailed frame metadata as JSON.
- Explore dedicated landing pages for popular GIFs such as Rickroll, Nyan Cat, and Dancing Baby.
- Rebuild the bundled sample GIFs with the provided script to keep text-based assets up to date for SEO landing pages or remixing.

## Project structure

```
assets/
  css/styles.css       # Site-wide styles
  js/
    popularSources.js  # Inline data URIs for featured GIFs
    gifParser.js       # GIF decoding and frame extraction logic
    frameTools.js      # Sprite sheet, CSS, and metadata helpers
    resultView.js      # Renders results and download actions
    tar.js             # Minimal TAR archive implementation
    app.js             # Homepage interactions
    popularPage.js     # Logic shared by featured GIF pages
index.html             # Main conversion tool
popular/               # Individual popular GIF landing pages
scripts/generate_sample_gifs.py  # Script that rebuilds the sample GIF data map
```

## Running locally

The project is a static site and works with any static file server—or by opening the HTML directly in a browser that allows module scripts from disk.

```bash
# Option 1: start a local server with Python
python -m http.server 8000
# Visit http://localhost:8000/index.html

# Option 2: open index.html directly in your browser (module loading may require additional flags)
```

## Rebuilding the sample GIFs

All featured GIFs are generated via `scripts/generate_sample_gifs.py`. Re-run the script whenever you want to regenerate the inline data URIs:

```bash
python scripts/generate_sample_gifs.py
```

The script outputs downloadable GIF files to `generated-gifs/` and writes their Base64 payloads into
`assets/js/popularSources.js` for in-browser use as data URIs. Because the repository avoids storing binary GIFs, be sure to commit the updated JS file after regenerating assets.

## Follow-up workflows

- Use the exported TAR archive and JSON metadata to quickly author sprite animations in engines like Unity or Godot.
- Drop the CSS snippet into a site to create lightweight `steps()` animations for loaders, tooltips, or playful hover states.
- Import individual PNG frames into tools such as Premiere, After Effects, or Figma to craft stickers, stream overlays, or short-form videos.
- Pair the outputs with background removal or WebP compression utilities to produce optimized assets for broader motion design pipelines.

