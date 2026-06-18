// /api/proxy.js — Media proxy for CORS bypass download
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(204).end()

  const { url } = req.query || {}
  if (!url) return res.status(400).json({ error: "url parameter required" })

  try {
    const mediaRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": new URL(url).origin + "/",
        "Accept": "*/*"
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!mediaRes.ok) return res.status(mediaRes.status).json({ error: "Upstream error " + mediaRes.status })

    res.setHeader("Content-Type", mediaRes.headers.get("content-type") || "application/octet-stream")
    if (mediaRes.headers.get("content-length")) res.setHeader("Content-Length", mediaRes.headers.get("content-length"))
    res.setHeader("Content-Disposition", "attachment")

    const reader = mediaRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
