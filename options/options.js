const form = document.getElementById('cfg');
const runNow = document.getElementById('runNow');
const testConnectionBtn = document.getElementById('testConnection');
const testResult = document.getElementById('testResult');
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

async function ensureScrapingToggleMatchesPermissions(storedValue) {
  try {
    const hasPermission = await chrome.permissions.contains(ALL_URLS_PERMISSION);

    if (storedValue === undefined) {
      form.scraping.checked = hasPermission ? true : form.scraping.checked;
      return;
    }

    if (storedValue && !hasPermission) {
      console.warn('Scraping permission missing; disabling toggle until granted.');
      form.scraping.checked = false;
    } else if (!storedValue && hasPermission) {
      await chrome.permissions.remove(ALL_URLS_PERMISSION);
    }
  } catch (error) {
    console.warn('Failed to inspect optional permissions:', error);
  }
}

async function handleScrapingToggleChange() {
  if (form.scraping.checked) {
    try {
      const granted = await chrome.permissions.request(ALL_URLS_PERMISSION);
      if (!granted) {
        form.scraping.checked = false;
        alert('Enable scraping requires the optional <all_urls> permission.');
      }
    } catch (error) {
      form.scraping.checked = false;
      console.warn('Permission request failed:', error);
      alert('Could not request the optional permission. Scraping remains disabled.');
    }
  } else {
    try {
      await chrome.permissions.remove(ALL_URLS_PERMISSION);
    } catch (error) {
      console.warn('Failed to remove optional permission:', error);
    }
  }
}

function setTestResult(message, status) {
  testResult.style.display = 'block';
  testResult.textContent = message;
  testResult.className = '';
  if (status === 'success') {
    testResult.classList.add('success');
  } else if (status === 'error') {
    testResult.classList.add('error');
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
  testConnectionBtn.textContent = 'Testing...';
  setTestResult('Testing connection to Azure OpenAI…', null);

  chrome.runtime.sendMessage(
    {
      type: 'TEST_CONNECTION',
      config: { apiKey, baseUrl, deployment, embeddingDeployment, apiVersion }
    },
    response => {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = 'Test Connection';

      if (recordLastError('Connection test', false)) {
        setTestResult('Connection test failed. See console for details.', 'error');
        return;
      }

      if (response?.success) {
        setTestResult(`Connection successful! Model "${deployment}" responded.`, 'success');
      } else {
        setTestResult(response?.error || 'Connection test failed.', 'error');
      }
    }
  );
}

form.scraping.addEventListener('change', handleScrapingToggleChange);
form.addEventListener('submit', saveSettings);
runNow.addEventListener('click', triggerCleanup);
testConnectionBtn.addEventListener('click', testConnection);

loadSettings().catch(error => console.error('Failed to load settings:', error));
