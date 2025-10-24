# Quick Start Guide

Get Edge Bookmark Cleaner running in 5 minutes.

## Step 1: Build the Popup (2 minutes)

```bash
cd popup
npm install
npm run build
```

This creates the UI in `../build/popup/`.

## Step 2: Add Icons (1 minute)

You need three PNG files in the `icons/` folder:
- `icon16.png` (16×16 pixels)
- `icon48.png` (48×48 pixels)
- `icon128.png` (128×128 pixels)

**Quick option**: Download any bookmark icon pack, or create simple colored squares temporarily.

## Step 3: Load in Edge (1 minute)

1. Open Edge
2. Go to `edge://extensions`
3. Enable **Developer mode** (toggle in left sidebar)
4. Click **Load unpacked**
5. Select the `bookmark-extension` folder
6. Extension appears in toolbar

## Step 4: Configure Azure OpenAI (1 minute)

1. Click the extension icon
2. Right-click → **Options** (or look for Options in the popup)
3. Fill in:
   - **API Key**: Get from Azure Portal → Your OpenAI resource → Keys and Endpoint
   - **Base URL**: `https://YOUR-RESOURCE-NAME.openai.azure.com`
   - **Chat Deployment**: The name you gave when deploying a GPT model
   - **Embedding Deployment**: Your embedding model name (or leave blank to use chat deployment)
4. Click **Save Settings**

## Step 5: Test It (30 seconds)

1. On the Options page, click **Run Now**
2. You'll see a notification showing progress
3. Click the extension icon to see the **Review** tab
4. Accept or reject duplicates

## What Now?

- **Schedule automatic cleanup**: Options → Schedule → Daily/Weekly
- **Enable page scraping**: Options → Check "Enable page scraping" (better duplicate detection)
- **Manage bookmarks**: Extension popup → Add / Manage / Import-Export tabs

## Troubleshooting

**Extension won't load?**
- Did you run `npm run build` in the popup folder?
- Check the Edge console for errors: `edge://extensions` → Details → Errors

**No Options page?**
- Right-click the extension icon → Options
- Or manually navigate to: `edge://extensions` → Details → Extension options

**API errors?**
- Verify your API key is correct
- Check deployment names match exactly (case-sensitive)
- Ensure Azure resource is active and has quota

**No progress notification?**
- Check Edge notification permissions
- Service worker console: `edge://extensions` → Service Worker → Inspect

## Next Steps

- Read the full [README.md](./README.md) for advanced configuration
- Check [tests/README.md](./tests/README.md) for testing guidelines
- See `thefullcode.md` for complete architecture details

## Quick Commands Reference

```bash
# Build popup for production
cd popup && npm run build

# Development mode (hot reload)
cd popup && npm run dev

# Rebuild after code changes
cd popup && npm run build

# Check for errors
# Open edge://extensions → Service Worker → Inspect
```

That's it! You now have an AI-powered bookmark manager. 🎉
