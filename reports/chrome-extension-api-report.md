**Chrome Extensions API Report — 28 Oct 2025**

- Manifest V2 is now fully disabled for every Chrome channel as of the Chrome 138 stable rollout on 24 Jul 2025; Chrome 139 removes the last enterprise bypass (`ExtensionManifestV2Availability`), so any MV2 binary instantly stops working once devices upgrade beyond 138.([developer.chrome.com](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline?utm_source=openai))
- Google continues to signal the MV2 sunset in developer comms and mailing lists; the 4 Mar 2025 PSA confirmed the “temporary re-enable” switch is gone in pre-stable builds and will not return to stable after Chrome 139.([groups.google.com](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3fL7swrnG3A?utm_source=openai))
- Administrators must plan fleet updates against the Chrome release cadence because Chrome 139 became stable on 5 Aug 2025, making the MV2 cutoff effectively in-market today.([developer.chrome.com](https://developer.chrome.com/release-notes/139?utm_source=openai))

**Recent API Surface Changes (Chrome 132 → 140)**
- Chrome 140 introduces `chrome.sidePanel.getLayout()` and the new `PanelLayout` type so extensions can detect whether the user docked the side panel left or right—crucial for RTL layouts and multi-pane UIs.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))
- Chrome 139 removes the `--extensions-on-chrome-urls` and `--disable-extensions-except` command-line flags in official Chrome builds, so developers must rely on policies or local Chrome variants when debugging privileged chrome:// surfaces.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))
- Chrome 135 shipped `chrome.userScripts.execute()`, letting extensions inject ad-hoc user scripts without persisting registrations; the reference now documents async return values and new injection options.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))
- Since Chrome 132 you can edit `chrome.storage` data directly in DevTools, simplifying debugging of MV3 service-worker state.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))
- Declarative Net Request rules gained response-header matching in Chrome 128 (`responseHeaders` / `excludedResponseHeaders`), enabling content-type gating and other late-stage filters without webRequest fallbacks.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new))

**Built-in On-Device AI for Extensions**
- Chrome 138 made the Summarizer, Translator, Language Detector, and Prompt APIs generally available to extensions, while Writer/Rewriter remain in origin trials and Proofreader is limited to Early Preview participants.([developer.chrome.com](https://developer.chrome.com/blog/ai-api-updates-io25?utm_source=openai))
- Using these APIs requires devices that meet Gemini Nano hardware criteria (desktop OS, ≥22 GB free storage, ≥4 GB VRAM GPU or 16 GB RAM CPU, unmetered network); failing requirements will silently block API availability.([developer.chrome.com](https://developer.chrome.com/docs/ai/summarizer-api?utm_source=openai))

**Tooling, Transparency & Diagnostics**
- Chrome 139’s new-tab footer now attributes which extension altered the page and exposes admin-managed notices, configurable via policies such as `NTPFooterExtensionAttributionEnabled` and `EnterpriseLogoUrlForBrowser`.([support.google.com](https://support.google.com/chrome/a/answer/7679408?utm_source=openai))
- The Extensions team published a dedicated “update lifecycle” guide (Sept 2025) to clarify background update cadence, partial rollouts, and rollback behavior—worth folding into release playbooks.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))

**Enterprise & Chrome Web Store Governance**
- Chrome Enterprise now supports curated, branded Web Store views with extension allow-lists, promotion slots, and upcoming remote-removal controls, reducing the need for custom catalogs.([theverge.com](https://www.theverge.com/2025/1/23/24350178/google-chrome-extensions-admin-enterprise-controls?utm_source=openai))
- Updated Web Store affiliate policies (enforced since 10 Jun 2025) forbid injecting undisclosed affiliate codes; violations can trigger delisting, so revenue-sharing extensions must add explicit UI consent flows.([developer.chrome.com](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025?utm_source=openai))

**Recommended Actions**
- Audit production fleets to ensure every MV2 dependency is retired before Chrome 139 auto-updates land; pin any holdout devices if you still need time to migrate.([developer.chrome.com](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline?utm_source=openai))
- Test side-panel extensions against Chrome 140 to respect user layout preferences and adopt `PanelLayout.side`; update QA matrices with the removed debug flags in Chrome 139.([developer.chrome.com](https://developer.chrome.com/docs/extensions/whats-new?utm_source=openai))
- If you leverage user-provided scripts, refactor to `userScripts.execute()` for one-off injections and rework permission prompts accordingly.([developer.chrome.com](https://developer.chrome.com/docs/extensions/reference/api/userScripts?utm_source=openai))
- Ship AI features only after verifying hardware checks and providing fallbacks when `Summarizer`, `Translator`, or `Prompt` return `unavailable`.([developer.chrome.com](https://developer.chrome.com/docs/ai/summarizer-api?utm_source=openai))
- Review enterprise configurations (NTP footers, curated store, affiliate disclosures) so admins and compliance teams have aligned messaging before Chrome 139 enforcement.([theverge.com](https://www.theverge.com/2025/1/23/24350178/google-chrome-extensions-admin-enterprise-controls?utm_source=openai))
