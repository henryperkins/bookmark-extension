function sanitizeBaseUrl(baseUrl = '') {
  if (!baseUrl) return '';
  let out = baseUrl.trim();
  // Remove trailing slashes
  out = out.replace(/\/+$/, '');
  // Strip an accidental trailing /openai or /openai/v1 that users sometimes paste
  out = out.replace(/\/openai(?:\/v1)?$/i, '');
  return out;
}

function buildUrl(root, path, version) {
  const base = `${root}${path}`;
  if (!version || version === 'v1') return base;
  const separator = path.includes('?') ? '&' : '?';
  return `${base}${separator}api-version=${encodeURIComponent(version)}`;
}

async function parseJsonOrThrow(res, context) {
  if (res.ok) {
    return res.json();
  }

  let detail = '';
  try {
    const data = await res.json();
    detail = data?.error?.message || JSON.stringify(data);
  } catch {
    detail = await res.text();
  }
  let guidance = '';
  if (res.status === 401) {
    guidance = ' (401 Unauthorized. Verify: 1) API Key is from this Azure OpenAI resource, 2) Base URL looks like https://<resource>.openai.azure.com (no trailing /openai/v1), 3) apiVersion matches your resource: use v1 only if unified endpoint enabled; otherwise e.g. 2024-07-01-preview, 4) Deployment names are correct.)';
  }
  throw new Error(`${context} ${res.status}${detail ? `: ${detail}` : ''}${guidance}`);
}

export function createOpenAI({
  apiKey,
  baseUrl,
  deployment,
  embeddingDeployment,
  apiVersion = 'v1'
}) {
  if (!apiKey) throw new Error('Azure OpenAI apiKey is required');
  if (!baseUrl) throw new Error('Azure OpenAI baseUrl is required');
  if (!deployment) throw new Error('Azure OpenAI deployment is required');
  const cleaned = sanitizeBaseUrl(baseUrl);
  const embedModel = embeddingDeployment || deployment;

  // Unified ("v1") vs legacy (preview date string) Azure endpoint selection.
  // Unified:   {endpoint}/openai/v1/chat/completions  body: { model: <deployment>, ... }
  // Legacy:    {endpoint}/openai/deployments/<dep>/chat/completions?api-version=YYYY-MM-DD-preview
  const isUnified = /^v1(-|$)/i.test(apiVersion);

  // Build URLs
  const rootUnified = `${cleaned}/openai/v1`;
  const chatUrl = isUnified
    ? buildUrl(rootUnified, '/chat/completions', apiVersion)
    : `${cleaned}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const embeddingsUrl = isUnified
    ? buildUrl(rootUnified, '/embeddings', apiVersion)
    : `${cleaned}/openai/deployments/${encodeURIComponent(embedModel)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`;

  const headers = {
    'Content-Type': 'application/json',
    'api-key': apiKey
  };

  async function chat(messages, opts = {}) {
    const buildBody = (options, forceMaxCompletion = false) => {
      const params = options || {};
      const base = isUnified
        ? { model: deployment, messages }
        : { messages };

      // Only include temperature if explicitly set to 1 (some models only support temperature: 1 or omitting it)
      if (params.temperature != null && params.temperature === 1) {
        base.temperature = 1;
      }

      // Token limits priority / translation
      if (forceMaxCompletion && params.max_tokens != null) {
        base.max_completion_tokens = params.max_tokens;
      } else if (params.max_completion_tokens != null) {
        base.max_completion_tokens = params.max_completion_tokens;
      } else if (params.max_tokens != null) {
        base.max_tokens = params.max_tokens;
      } else if (params.max_output_tokens != null) {
        base.max_output_tokens = params.max_output_tokens; // reasoning models variant
      }

      if (params.top_p != null) base.top_p = params.top_p;
      if (params.response_format) base.response_format = params.response_format;
      if (params.tools) base.tools = params.tools;
      if (params.stream_options) base.stream_options = params.stream_options;
      return base;
    };

    const attempt = async (options = opts, forceMaxCompletion = false) => {
      const body = buildBody(options, forceMaxCompletion);
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      return parseJsonOrThrow(res, 'Chat error');
    };

    try {
      return await attempt(opts, false);
    } catch (e) {
      const message = String(e?.message || '');
      if (opts.max_tokens != null && !opts.max_completion_tokens && /Unsupported parameter:\s*'max_tokens'/i.test(message)) {
        // Retry once translating to max_completion_tokens per new API guidance.
        return await attempt(opts, true);
      }
      if (opts.max_completion_tokens != null && /Unsupported parameter:\s*'max_completion_tokens'/i.test(message)) {
        const { max_completion_tokens, ...rest } = opts;
        return await attempt({ ...rest, max_tokens: max_completion_tokens }, false);
      }
      throw e;
    }
  }

  async function embed(input, opts = {}) {
    if (!embedModel) {
      throw new Error('Azure OpenAI embedding deployment is not configured');
    }

    const body = isUnified
      ? { model: embedModel, input }
      : { input };

    if (opts.encoding_format) body.encoding_format = opts.encoding_format;
    if (opts.dimensions != null) body.dimensions = opts.dimensions;

    const res = await fetch(embeddingsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    return parseJsonOrThrow(res, 'Embed error');
  }

  return { chat, embed };
}
