# Gemini Code Assistant Context

This document provides context for the Gemini Code Assistant to understand the project structure, conventions, and key files.

## Project Overview

This is a browser extension for Microsoft Edge that uses Azure OpenAI to clean up and organize bookmarks. It can find and remove duplicate bookmarks, automatically tag them, and suggest folder placements. The extension is built with JavaScript and uses a React-based UI for the popup.

### Building and Running

**Build the popup:**

```bash
cd popup
npm install
npm run build
```

**Run tests:**

```bash
cd popup
npm test
```

### Development Conventions

*   The project follows the Manifest V3 service worker pattern for Chrome extensions.
*   The popup is built with React and TypeScript.
*   Component tests for the popup are written with Vitest and React Testing Library.
*   The main extension is written in plain JavaScript.

### Key Files

*   `manifest.json`: The extension manifest file.
*   `serviceWorker.js`: The main background script that orchestrates the cleanup process.
*   `openaiClient.js`: A wrapper for the Azure OpenAI API.
*   `popup/`: The source code for the React-based popup UI.
    *   `src/`: The main source code for the popup.
        *   `App.tsx`: The main application component, which includes the tabbed interface for different functionalities.
        *   `main.tsx`: The entry point for the React application.
        *   `context/JobContext.tsx`: A React context for managing the state of the cleanup job. It provides a `JobProvider` that uses a `useReducer` hook to manage the job state and a `JobContext` that allows components to access the job state.
        *   `hooks/useJob.ts`: A custom hook that provides a simple interface for accessing the job state and dispatching actions.
        *   `components/`: Reusable React components used in the popup UI.
            *   `JobDashboard.tsx`: A component that displays the progress of the cleanup job, including the current stage, progress, and activity log.
            *   `ProgressHeader.tsx`: A component that displays the overall progress of the cleanup job.
            *   `StageList.tsx`: A component that displays a list of the stages in the cleanup job and their status.
            *   `ActivityFeed.tsx`: A component that displays a log of the activities performed during the cleanup job.
            *   `MetricsPanel.tsx`: A component that displays metrics about the cleanup job, such as the number of duplicates found and the time taken.
            *   `ReportModal.tsx`: A component that displays a report of the cleanup job.
*   `options/`: The HTML and JavaScript for the extension's options page.
*   `utils/`: Utility modules for various tasks like rate limiting, storage management, and duplicate detection.
