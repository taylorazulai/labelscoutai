/**
 * Proxy intake submissions to n8n (server-side).
 * Avoids browser mixed-content and CORS blocks from the static landing page.
 *
 * Set N8N_WEBHOOK_URL in Vercel → Project → Settings → Environment Variables.
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

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const body = await upstream.text();
    const contentType =
      upstream.headers.get("content-type") || "application/json";

    res.status(upstream.status).setHeader("Content-Type", contentType).send(body);
  } catch (err) {
    console.error("Intake proxy error:", err);
    res.status(502).json({ error: "Failed to reach intake webhook" });
  }
}
