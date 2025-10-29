# Troubleshooting Guide

## Blank Popup Panel

### Quick Checks
1. **Reload the extension**:
   - Go to `edge://extensions`
   - Find "Edge Bookmark Cleaner"
   - Click the reload icon (🔄)

2. **Check service worker**:
   - Go to `edge://extensions`
   - Find "Edge Bookmark Cleaner"
   - Click "Service Worker" → "Inspect"
   - Look for errors in console

3. **Check popup console**:
   - Click extension icon to open popup
   - Right-click anywhere in popup
   - Select "Inspect"
   - Check Console tab for errors

### Common Causes

#### Missing Build Files
**Symptom**: Popup is completely blank, no errors in console

**Solution**:
```bash
cd popup
npm install
npm run build
```

#### Service Worker Not Running
**Symptom**: Popup blank, service worker shows "inactive"

**Solution**:
1. Go to `edge://extensions`
2. Toggle extension off and on
3. Or click "Reload" button

#### Chrome API Errors
**Symptom**: Console shows "Cannot read property 'sendMessage' of undefined"

**Solution**:
- Extension context may be invalidated
- Reload the extension
- Close and reopen the popup

## Test Connection Button Not Working

### Quick Checks
1. **Verify credentials**:
   - API Key is correct
   - Base URL format: `https://YOUR-RESOURCE.openai.azure.com` (no trailing slash)
   - Deployment name matches your Azure resource

2. **Check service worker console**:
   - Go to `edge://extensions` → Service Worker → Inspect
   - Click "Test Connection"
   - Look for error messages

### Common Errors

#### "Failed to communicate with service worker"
**Cause**: Service worker is not running or crashed

**Solution**:
1. Reload extension
2. Try test connection again

#### "Connection test failed"
**Cause**: Invalid credentials or network issue

**Solution**:
1. Verify API key is correct
2. Check base URL format (no `/openai/v1` suffix)
3. Verify deployment name exists in Azure
4. Check network connectivity
5. Try in Azure Portal to confirm credentials work

#### "Model not found"
**Cause**: Deployment name doesn't exist

**Solution**:
1. Go to Azure OpenAI Studio
2. Check your deployment names
3. Use exact deployment name (case-sensitive)

## Import Bookmarks Not Working

### Quick Checks
1. **File format**:
   - Must be HTML format (Netscape bookmark format)
   - Export from Edge: `edge://favorites` → ⋯ → Export favorites

2. **File size**:
   - Very large files (>500KB or >800 bookmarks) may take time
   - Wait for completion alert

3. **Parent folder ID**:
   - Default is "1" (Bookmarks Bar)
   - Use valid folder ID from your bookmarks

### Common Issues

#### "Import complete!" but no bookmarks appear
**Cause**: Wrong parent folder ID or bookmarks filtered out

**Solution**:
1. Check parent folder ID is correct
2. Imported bookmarks may be in different folder
3. Check if URLs were duplicates (skipped)
4. Check service worker console for warnings

#### Import takes very long
**Cause**: Large file with many bookmarks

**Solution**:
- Be patient, import is processing
- Check service worker console for progress
- Don't close popup or browser during import

#### "Import failed" error
**Cause**: Invalid HTML format or permission issue

**Solution**:
1. Verify file is valid HTML bookmark export
2. Try exporting bookmarks again
3. Check file isn't corrupted
4. Check service worker console for specific error

## General Debugging Steps

### 1. Check Extension Permissions
Go to `edge://extensions` → Edge Bookmark Cleaner → Details

Required permissions:
- ✓ Bookmarks
- ✓ Storage
- ✓ Downloads
- ✓ Alarms
- ✓ Offscreen
- ✓ Notifications
- ✓ Unlimited Storage

Optional permissions:
- `<all_urls>` (only if page scraping enabled)

### 2. Check Storage
Open service worker console:
```javascript
// Check settings
chrome.storage.sync.get(null, console.log)

// Check local storage
chrome.storage.local.get(null, console.log)

// Check review queue
chrome.storage.local.get('reviewQueue', console.log)
```

### 3. Clear Extension Data
If extension is behaving strangely:

1. Open service worker console
2. Run:
```javascript
// Clear all local storage
chrome.storage.local.clear()

// Clear sync storage (will lose settings!)
chrome.storage.sync.clear()
```

3. Reload extension
4. Reconfigure settings

### 4. Check for Conflicts
- Disable other bookmark extensions
- Check if other extensions are interfering
- Try in Incognito mode (if extension is allowed)

### 5. Reinstall Extension
Last resort:

1. Export your bookmarks first (backup!)
2. Go to `edge://extensions`
3. Remove "Edge Bookmark Cleaner"
4. Reload the page
5. Click "Load unpacked"
6. Select the `bookmark-extension` folder
7. Reconfigure settings

## Getting Help

If issues persist:

1. **Collect information**:
   - Edge version: `edge://version`
   - Extension version: Check manifest.json
   - Error messages from all consoles
   - Steps to reproduce

2. **Check service worker console**:
   - Most errors appear here
   - Copy full error stack traces

3. **Check popup console**:
   - Right-click popup → Inspect
   - Copy any errors

4. **Check options page console**:
   - F12 on options page
   - Copy any errors

## Known Limitations

1. **Edge Reading List**: Not supported (Edge-specific API)
2. **Minimum Edge version**: 116+ required for offscreen documents
3. **Storage limits**: 
   - Sync storage: ~100KB (settings)
   - Local storage: Unlimited (with permission)
4. **API rate limits**: Respects Azure OpenAI rate limits
5. **Large imports**: Files >500KB may take several minutes

## Debug Mode

Enable verbose logging:

```javascript
// In any console (popup, service worker, options)
chrome.storage.local.set({ debugLogs: true })
```

Disable:
```javascript
chrome.storage.local.set({ debugLogs: false })
```

Then reload extension and check service worker console for detailed logs.
