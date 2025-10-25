function sanitizeBaseUrl(baseUrl = "") {
  if (!baseUrl) return "";
  let out = baseUrl.trim();
  // Remove trailing slashes
  out = out.replace(/\/+$/, "");
  // Strip an accidental trailing /openai or /openai/v1 that users sometimes paste
  out = out.replace(/\/openai(?:\/v1)?$/i, "");
  return out;
}

function buildUrl(root, path, version) {
  const base = `${root}${path}`;
  if (!version || version === "v1") return base;
  const separator = path.includes("?") ? "&" : "?";
  return `${base}${separator}api-version=${encodeURIComponent(version)}`;
}

async function parseJsonOrThrow(res, context) {
  if (res.ok) {
    return res.json();
  }

  let detail = "";
  try {
    const data = await res.json();
    detail = data?.error?.message || JSON.stringify(data);
  } catch {
    detail = await res.text();
  }
  let guidance = "";
  if (res.status === 401) {
    guidance = " (401 Unauthorized. Verify: 1) API Key is from this Azure OpenAI resource, 2) Base URL looks like https://<resource>.openai.azure.com (no trailing /openai/v1), 3) apiVersion matches your resource: use v1 only if unified endpoint enabled; otherwise e.g. 2024-07-01-preview, 4) Deployment names are correct.)";
  }
  throw new Error(`${context} ${res.status}${detail ? `: ${detail}` : ""}${guidance}`);
}

export function createOpenAI({
  apiKey,
  baseUrl,
  deployment,
  embeddingDeployment,
  apiVersion = "v1"
}) {
  if (!apiKey) throw new Error("Azure OpenAI apiKey is required");
  if (!baseUrl) throw new Error("Azure OpenAI baseUrl is required");
  if (!deployment) throw new Error("Azure OpenAI deployment is required");
  const cleaned = sanitizeBaseUrl(baseUrl);
  const embedModel = embeddingDeployment || deployment;

  // Unified ("v1") vs legacy (preview date string) Azure endpoint selection.
  // Unified:   {endpoint}/openai/v1/chat/completions  body: { model: <deployment>, ... }
  // Legacy:    {endpoint}/openai/deployments/<dep>/chat/completions?api-version=YYYY-MM-DD-preview
  const isUnified = /^v1(-|$)/i.test(apiVersion);

  // Build URLs
  const rootUnified = `${cleaned}/openai/v1`;
  const chatUrl = isUnified
    ? buildUrl(rootUnified, "/chat/completions", apiVersion)
    : `${cleaned}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const embeddingsUrl = isUnified
    ? buildUrl(rootUnified, "/embeddings", apiVersion)
    : `${cleaned}/openai/deployments/${encodeURIComponent(embedModel)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`;

  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey
  };

  async function chat(messages, opts = {}) {
    const buildBody = (forceMaxCompletion = false) => {
      const base = isUnified
        ? { model: deployment, messages, temperature: opts.temperature ?? 0 }
        : { messages, temperature: opts.temperature ?? 0 };

      // Token limits priority / translation
      if (forceMaxCompletion && opts.max_tokens != null) {
        base.max_completion_tokens = opts.max_tokens;
      } else if (opts.max_completion_tokens != null) {
        base.max_completion_tokens = opts.max_completion_tokens;
      } else if (opts.max_tokens != null) {
        base.max_tokens = opts.max_tokens;
      } else if (opts.max_output_tokens != null) {
        base.max_output_tokens = opts.max_output_tokens; // reasoning models variant
      }

      if (opts.top_p != null) base.top_p = opts.top_p;
      if (opts.response_format) base.response_format = opts.response_format;
      if (opts.tools) base.tools = opts.tools;
      if (opts.stream_options) base.stream_options = opts.stream_options;
      return base;
    };

    const attempt = async (forceMaxCompletion = false) => {
      const body = buildBody(forceMaxCompletion);
      const res = await fetch(chatUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      return parseJsonOrThrow(res, "Chat error");
    };

    try {
      return await attempt(false);
    } catch (e) {
      if (opts.max_tokens != null && !opts.max_completion_tokens && /Unsupported parameter: 'max_tokens'/i.test(e.message)) {
        // Retry once translating to max_completion_tokens per new API guidance.
        return await attempt(true);
      }
      throw e;
    }
  }

  async function embed(input, opts = {}) {
    if (!embedModel) {
      throw new Error("Azure OpenAI embedding deployment is not configured");
    }

    const body = isUnified
      ? { model: embedModel, input }
      : { input };

    if (opts.encoding_format) body.encoding_format = opts.encoding_format;
    if (opts.dimensions != null) body.dimensions = opts.dimensions;

    const res = await fetch(embeddingsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    return parseJsonOrThrow(res, "Embed error");
  }

  return { chat, embed };
}
