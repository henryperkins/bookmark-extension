function sanitizeBaseUrl(baseUrl = "") {
  return baseUrl.replace(/\/+$/, "");
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
  throw new Error(`${context} ${res.status}${detail ? `: ${detail}` : ""}`);
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

  // Per v1preview.json: {endpoint}/openai/v1
  const root = `${sanitizeBaseUrl(baseUrl)}/openai/v1`;
  const chatUrl = buildUrl(root, "/chat/completions", apiVersion);
  const embedModel = embeddingDeployment || deployment;
  const embeddingsUrl = buildUrl(root, "/embeddings", apiVersion);

  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey
  };

  async function chat(messages, opts = {}) {
    const body = {
      model: deployment,
      messages,
      temperature: opts.temperature ?? 0
    };

    if (opts.max_tokens != null) body.max_tokens = opts.max_tokens;
    if (opts.top_p != null) body.top_p = opts.top_p;
    if (opts.response_format) body.response_format = opts.response_format;
    if (opts.tools) body.tools = opts.tools;
    if (opts.stream_options) body.stream_options = opts.stream_options;

    const res = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    return parseJsonOrThrow(res, "Chat error");
  }

  async function embed(input, opts = {}) {
    if (!embedModel) {
      throw new Error("Azure OpenAI embedding deployment is not configured");
    }

    const body = {
      model: embedModel,
      input
    };

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
