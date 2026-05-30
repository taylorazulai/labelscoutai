/**
 * Proxy intake submissions to n8n (server-side).
 * Avoids browser mixed-content and CORS blocks from the static landing page.
 *
 * Vercel env vars:
 *   N8N_WEBHOOK_URL    — n8n webhook URL (test or production)
 *   N8N_WEBHOOK_SECRET — optional; sent as X-LabelScout-Secret (use in Cloudflare WAF to allow)
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const webhookUrl =
    process.env.N8N_WEBHOOK_URL ||
    "https://n8n.powermindai.xyz/webhook-test/localscoutai-intake";

  const headers = { "Content-Type": "application/json" };
  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["X-LabelScout-Secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "";

    // Cloudflare bot challenges return HTML 403 — don't pass that through as success path.
    if (
      !upstream.ok &&
      (contentType.includes("text/html") || body.includes("Just a moment"))
    ) {
      console.error("n8n webhook blocked (likely Cloudflare bot protection)", {
        status: upstream.status,
        webhookUrl,
      });
      res.status(502).json({
        error:
          "Intake webhook blocked by upstream security (Cloudflare). Allow /webhook paths or add a WAF bypass rule.",
      });
      return;
    }

    res
      .status(upstream.status)
      .setHeader("Content-Type", contentType || "application/json")
      .send(body);
  } catch (err) {
    console.error("Intake proxy error:", err);
    res.status(502).json({ error: "Failed to reach intake webhook" });
  }
}
