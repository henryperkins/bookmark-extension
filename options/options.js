const form = document.getElementById('cfg');
const runNow = document.getElementById('runNow');
const testConnectionBtn = document.getElementById('testConnection');
let testResult = document.getElementById('testResult');
const scrapingNotice = document.getElementById('scrapingNotice');
const ALL_URLS_PERMISSION = { origins: ['<all_urls>'] };

function recordLastError(context, ignoreClosedPort = true) {
  const err = chrome.runtime.lastError;
  if (!err) return null;
  if (ignoreClosedPort && /message port closed/i.test(err.message)) {
    return err;
  }
  console.warn(`${context}: ${err.message}`);
  return err;
}

function setScrapingNotice(message = '') {
  if (!scrapingNotice) return;
  const messageSpan = scrapingNotice.querySelector('[data-message]');
  if (!message) {
    scrapingNotice.hidden = true;
    if (messageSpan) {
      messageSpan.textContent = '';
    }
    return;
  }
  if (messageSpan) {
    messageSpan.textContent = message;
  }
  scrapingNotice.hidden = false;
}

async function ensureScrapingToggleMatchesPermissions(storedValue) {
  try {
    const hasPermission = await chrome.permissions.contains(ALL_URLS_PERMISSION);

    if (storedValue === undefined) {
      form.scraping.checked = !!hasPermission;
      setScrapingNotice(hasPermission ? '' : 'Toggle “Enable page scraping” to request the required permission.');
      return;
    }

    if (storedValue && !hasPermission) {
      form.scraping.checked = false;
      setScrapingNotice('Grant the optional permission to turn scraping back on.');
    } else if (!storedValue && hasPermission) {
      await chrome.permissions.remove(ALL_URLS_PERMISSION);
      setScrapingNotice('');
    } else {
      setScrapingNotice('');
    }
  } catch (error) {
    console.warn('Failed to inspect optional permissions:', error);
    setScrapingNotice('We could not verify the optional permission. Toggle scraping again to retry.');
  }
}

async function handleScrapingToggleChange() {
  if (form.scraping.checked) {
    try {
      const granted = await chrome.permissions.request(ALL_URLS_PERMISSION);
      if (!granted) {
        form.scraping.checked = false;
        alert('Enable scraping requires the optional <all_urls> permission.');
        setScrapingNotice('Permission was declined, so scraping stays off. Toggle again if you change your mind.');
      } else {
        setScrapingNotice('');
      }
    } catch (error) {
      form.scraping.checked = false;
      console.warn('Permission request failed:', error);
      alert('Could not request the optional permission. Scraping remains disabled.');
      setScrapingNotice('We could not request the optional permission. Scraping stays off.');
    }
  } else {
    try {
      await chrome.permissions.remove(ALL_URLS_PERMISSION);
      setScrapingNotice('');
    } catch (error) {
      console.warn('Failed to remove optional permission:', error);
      setScrapingNotice('We could not remove the optional permission. Scraping may still be on.');
    }
  }
}

function ensureTestResultElement() {
  if (testResult) {
    return testResult;
  }
  if (!form) {
    return null;
  }
  const el = document.createElement('div');
  el.id = 'testResult';
  el.style.display = 'none';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  form.appendChild(el);
  testResult = el;
  return testResult;
}

function setTestResult(message, status) {
  const resultEl = ensureTestResultElement();
  if (!resultEl) return;

  resultEl.style.display = 'block';
  resultEl.textContent = message;
  resultEl.className = '';
  if (status === 'success') {
    resultEl.classList.add('success');
  } else if (status === 'error') {
    resultEl.classList.add('error');
  }
}

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'apiKey',
    'baseUrl',
    'deployment',
    'embeddingDeployment',
    'apiVersion',
    'enableScraping',
    'deviceOnly',
    'previewMode',
    'schedule'
  ]);

  form.key.value = data.apiKey || '';
  form.url.value = data.baseUrl || '';
  form.dep.value = data.deployment || '';
  form.edep.value = data.embeddingDeployment || '';
  form.apiVersion.value = data.apiVersion || 'v1';
  form.scraping.checked = data.enableScraping ?? true;
  form.deviceOnly.checked = data.deviceOnly ?? false;
  form.preview.checked = data.previewMode ?? true;
  form.schedule.value = data.schedule ?? 'DAILY_3AM';

  await ensureScrapingToggleMatchesPermissions(data.enableScraping);
}

async function saveSettings(e) {
  e.preventDefault();

  const settings = {
    apiKey: form.key.value,
    baseUrl: form.url.value,
    deployment: form.dep.value,
    embeddingDeployment: form.edep.value || form.dep.value,
    apiVersion: form.apiVersion.value || 'v1',
    enableScraping: form.scraping.checked,
    deviceOnly: form.deviceOnly.checked,
    previewMode: form.preview.checked,
    schedule: form.schedule.value
  };

  await chrome.storage.sync.set(settings);

  chrome.runtime.sendMessage(
    { type: 'UPDATE_SCHEDULE', mode: settings.schedule },
    () => recordLastError('Schedule update')
  );

  alert('Settings saved successfully!');
}

function triggerCleanup() {
  chrome.storage.sync.get(['apiKey', 'baseUrl', 'deployment']).then(config => {
    if (!config.apiKey || !config.baseUrl || !config.deployment) {
      alert('Please configure Azure OpenAI settings before running cleanup.');
      return;
    }

    chrome.runtime.sendMessage({ type: 'RUN_NOW' }, response => {
      if (recordLastError('Cleanup trigger')) return;
      if (response) {
        alert('Cleanup started! Check notifications for progress.');
      } else {
        alert('Failed to start cleanup. Check console for errors.');
      }
    });
  });
}

async function testConnection() {
  const apiKey = form.key.value;
  const baseUrl = form.url.value;
  const deployment = form.dep.value;
  const embeddingDeployment = form.edep.value || deployment;
  const apiVersion = form.apiVersion.value || 'v1';

  if (!apiKey || !baseUrl || !deployment) {
    setTestResult('Please fill in API Key, Base URL, and Chat Deployment first.', 'error');
    return;
  }

  testConnectionBtn.disabled = true;
  const originalLabel = testConnectionBtn.textContent;
  testConnectionBtn.textContent = 'Testing...';
  setTestResult('Testing connection to Azure OpenAI…', null);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_CONNECTION',
      config: { apiKey, baseUrl, deployment, embeddingDeployment, apiVersion }
    });

    if (response?.success) {
      setTestResult(`Connection successful! Model "${deployment}" responded.`, 'success');
    } else if (response?.error) {
      setTestResult(response.error, 'error');
    } else {
      setTestResult('Connection test failed. No response from service worker.', 'error');
    }
  } catch (error) {
    console.error('Connection test crashed:', error);
    const message = error?.message || 'Connection test failed due to an unexpected error.';
    setTestResult(message, 'error');
  } finally {
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = originalLabel || 'Test Connection';
  }
}

form.scraping.addEventListener('change', handleScrapingToggleChange);
form.addEventListener('submit', saveSettings);
runNow.addEventListener('click', triggerCleanup);
testConnectionBtn.addEventListener('click', testConnection);

loadSettings().catch(error => console.error('Failed to load settings:', error));
