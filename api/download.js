// /api/download.js — Vercel Serverless Function
// Hybrid: SaveFrom (primary) → Ikyy/TikWM (fallback)

const vm = require("vm")
const nodeCrypto = require("crypto")
const { JSDOM } = require("jsdom")

// ============================================
// CONFIG
// ============================================
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
const sfBase = "https://en1.savefrom.net"
const sfWorker = "https://worker.savefrom.net"
const _ts = 1781179117174
const sha256 = s => nodeCrypto.createHash("sha256").update(s, "utf8").digest("hex")
const sfHeaders = { "user-agent": ua, accept: "*/*", referer: sfBase + "/", origin: sfBase }

let cache = { secret: null, at: 0 }

// ============================================
// SAVEFROM ENGINE
// ============================================
async function sfText(url) {
  const r = await fetch(url, { headers: sfHeaders, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error("HTTP " + r.status)
  return r.text()
}

async function getChunks() {
  const home = await sfText(sfBase + "/")
  if (home.length < 5000 || home.includes("Discontinuation")) throw new Error("SaveFrom blocked")
  const runHit = home.match(/\/build\/js\/runtime\.js\?h=[0-9a-f]+\.js/)
  const runtime = await sfText(sfBase + (runHit ? runHit[0] : "/build/js/runtime.js"))
  const hVendor = (runtime.match(/4121:"([0-9a-f]{6,})"/) || [])[1]
  const hWrb = (runtime.match(/5229:"([0-9a-f]{6,})"/) || [])[1]
  if (!hVendor || !hWrb) throw new Error("chunk hash not found")
  const vendor = await sfText(sfBase + "/build/js/vendor.js?h=" + hVendor + ".js")
  const wrb = await sfText(sfBase + "/build/js/workerRequestBuilder.js?h=" + hWrb + ".js")
  return { vendor, wrb }
}

async function extractSecret(vendor, wrb) {
  const patched = wrb
    .split("for(let W in P[U][A])").join("for(let W in ((P[U]||{})[A]||{}))")
    .split("const C=P[U][t],a=!!P[U][A]&&P[U][A][m]").join("const C=(P[U]||{})[t],a=!!(P[U]&&P[U][A])&&P[U][A][m]")
    .split("if(!new Function(").join("if(!1&&!new Function(")

  const digests = []
  const realSubtle = nodeCrypto.webcrypto.subtle
  const hookedSubtle = new Proxy(realSubtle, {
    get(t, p) {
      if (p === "digest") return async (algo, data) => {
        let s = ""; try { s = new TextDecoder().decode(data) } catch {}
        digests.push(s)
        return realSubtle.digest(algo, data)
      }
      const v = t[p]; return typeof v === "function" ? v.bind(t) : v
    }
  })

  const reals = {}
  for (const k of ["Object","Array","Function","Boolean","Number","String","Symbol","Math","JSON","Date","RegExp","Error","TypeError","RangeError","SyntaxError","Promise","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent","encodeURI","decodeURI","Map","Set","WeakMap","WeakSet","ArrayBuffer","Uint8Array","Uint16Array","Uint32Array","Int8Array","Int16Array","Int32Array","Float32Array","Float64Array","DataView","TextEncoder","TextDecoder","Reflect","Proxy","BigInt","escape","unescape","Intl"]) reals[k] = global[k]
  reals.crypto = { subtle: hookedSubtle, getRandomValues: a => nodeCrypto.webcrypto.getRandomValues(a), randomUUID: () => nodeCrypto.webcrypto.randomUUID() }
  reals.console = { log(){}, warn(){}, error(){}, info(){} }
  reals.performance = global.performance; reals.atob = global.atob; reals.btoa = global.btoa
  reals.setTimeout = (f, d) => typeof f === "function" ? global.setTimeout(f, Math.min(d||0, 30)) : 0
  reals.clearTimeout = t => global.clearTimeout(t); reals.setInterval = () => 0; reals.clearInterval = () => {}
  reals.queueMicrotask = f => Promise.resolve().then(f); reals.URL = global.URL; reals.URLSearchParams = global.URLSearchParams; reals.Blob = global.Blob
  reals.fetch = u => { const url = String(u); if (url.includes("/msec")) return Promise.resolve(new global.Response(JSON.stringify({msec:Date.now()/1000}),{headers:{"content-type":"application/json"}})); return Promise.resolve(new global.Response("{}")) }
  reals.AbortController = global.AbortController; reals.AbortSignal = global.AbortSignal; reals.TextEncoder = global.TextEncoder; reals.TextDecoder = global.TextDecoder
  const storage = () => { const m = new Map(); return { getItem: k => m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k), clear:()=>m.clear(), key:i=>[...m.keys()][i]??null, get length(){return m.size} } }
  reals.localStorage = storage(); reals.sessionStorage = storage()
  reals.navigator = { userAgent: ua, language:"en-US", languages:["en-US","en"], platform:"Win32", webdriver:false, vendor:"Google Inc." }
  reals.location = { href:sfBase+"/", origin:sfBase, protocol:"https:", host:"en1.savefrom.net", hostname:"en1.savefrom.net", pathname:"/", search:"", hash:"", reload(){}, toString(){return this.href} }
  const el = () => ({ setAttribute(){}, getAttribute(){return null}, appendChild(x){return x}, addEventListener(){}, style:{}, dataset:{}, getContext(){return null} })
  reals.document = { createElement:()=>el(), getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[], getElementsByTagName:()=>[], addEventListener(){}, head:el(), body:el(), documentElement:el(), cookie:"", currentScript:null }

  const safe = new Proxy(function(){}, {
    get(t,p){if(p===Symbol.toPrimitive)return()=>0;if(p===Symbol.iterator)return undefined;if(p==="toString"||p==="valueOf")return()=>"";return safe},
    set(){return true}, apply(){return safe}, construct(){return safe}, has(){return false}
  })
  const captured = []
  const handler = {
    get(t,p,r){ if(p in t)return t[p]; if(["self","window","globalThis","global","top","parent","frames"].includes(p))return r; if(typeof p==="string"&&p.includes("webpackChunk"))return undefined; return safe },
    set(t,p,v){ t[p]=v; if(Array.isArray(v))captured.push(v); return true }
  }
  const ctx = new Proxy(reals, handler)
  reals.self=ctx;reals.window=ctx;reals.globalThis=ctx;reals.global=ctx;reals.top=ctx;reals.parent=ctx;reals.frames=ctx;reals.document.defaultView=ctx

  vm.createContext(ctx)
  try { vm.runInContext(vendor, ctx, {filename:"vendor.js"}) } catch {}
  try { vm.runInContext(patched, ctx, {filename:"wrb.js"}) } catch {}

  const modules = {}
  for (const arr of captured) for (const e of arr) if (Array.isArray(e)&&Array.isArray(e[0])&&e[1]&&typeof e[1]==="object") Object.assign(modules, e[1])

  const store = {}
  function req(id) {
    if(store[id])return store[id].exports; const m=store[id]={exports:{}}
    if(!modules[id]){m.exports=safe;return m.exports}
    try{modules[id].call(ctx,m,m.exports,req)}catch{}; return m.exports
  }
  req.d=(e,defs)=>{for(const k in defs)if(Object.prototype.hasOwnProperty.call(defs,k)&&!Object.prototype.hasOwnProperty.call(e,k))Object.defineProperty(e,k,{enumerable:true,get:defs[k]})}
  req.o=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)
  req.r=e=>{try{Object.defineProperty(e,Symbol.toStringTag,{value:"Module"})}catch{}Object.defineProperty(e,"__esModule",{value:true})}
  req.n=m=>{const g=m&&m.__esModule?()=>m.default:()=>m;req.d(g,{a:g});return g}
  req.e=()=>Promise.resolve(); req.g=ctx;req.p="/build/js/";req.u=()=>"";req.f={};req.m=modules;req.c=store;req.O=()=>{};req.l=()=>{};req.b=sfBase+"/"

  const sleep = ms => new Promise(r => global.setTimeout(r, ms))
  const sample = "https://vt.tiktok.com/ZSQaQuXkh/"
  for (const mid of [3245, 1299]) {
    let ex; try { ex = req(mid) } catch { continue }
    await sleep(400)
    let builder = null
    for (let tries = 0; tries < 20 && !builder; tries++) {
      for (const k of Reflect.ownKeys(ex)) {
        let v; try { v = ex[k] } catch { continue }
        if (typeof v === "function") builder = v
        if (v && typeof v.then === "function") { try { const aw = await Promise.race([v, sleep(1200).then(()=>"TO")]); if (typeof aw === "function") builder = aw } catch {} }
      }
      if (!builder) await sleep(180)
    }
    if (typeof builder === "function") {
      for (const arg of [sample, {url:sample}]) {
        try { let r = builder(arg); r = await Promise.race([Promise.resolve(r), sleep(5000).then(()=>null)]); if (typeof r === "function") await Promise.race([Promise.resolve(r(arg)), sleep(5000).then(()=>null)]) } catch {}
      }
    }
    if (digests.length) break
  }
  if (!digests.length) throw new Error("secret extraction failed")
  return digests[0].slice(-64)
}

function decodeBlob(blob) {
  const code = blob.includes("/*js-response*/") ? blob.split("/*js-response*/").join("") : blob
  const raw = []
  const recProxy = path => new Proxy(function(){}, {
    get(t,p){ if(p===Symbol.toPrimitive||p==="toString"||p===Symbol.toStringTag)return()=>""; if(p==="then")return undefined; return recProxy(path+"."+String(p)) },
    apply(t,thisArg,args){ raw.push(args); return recProxy(path) },
    set(){return true}
  })
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="sf_result">pending</div></body></html>', { runScripts:"dangerously", pretendToBeVisual:true, url:sfBase+"/18CX/", referrer:sfBase+"/" })
  const w = dom.window
  Object.defineProperty(w, "frameElement", {value:w.document.createElement("iframe"),configurable:true})
  w.sf = recProxy("sf"); w.console = {log(){},warn(){},error(){},info(){}}
  try { w.eval(code) } catch {}
  let result = null
  for (const args of raw) for (const a of args) if (a&&typeof a==="object"&&(Array.isArray(a.url)||a.id||a.title||a.success===false||a.html)) result = a
  dom.window.close()
  return result
}

async function sfConvert(url, force) {
  if (force || !cache.secret || Date.now() - cache.at > 25*60*1000) {
    const {vendor, wrb} = await getChunks()
    cache = { secret: await extractSecret(vendor, wrb), at: Date.now() }
  }
  const ts = Date.now()
  const body = new URLSearchParams({
    sf_url:url, sf_submit:"", new:"2", lang:"en", app:"", country:"id",
    os:"Windows", browser:"Edge", channel:"main", "sf-nomad":"1",
    url, ts:String(ts), _ts:String(_ts), _tsc:"0", _s:sha256(url+ts+cache.secret), _x:"1"
  })
  const r = await fetch(sfWorker+"/savefrom.php", {
    method:"POST",
    headers:{...sfHeaders,"content-type":"application/x-www-form-urlencoded",accept:"application/json, text/plain, */*"},
    body:body.toString(),
    signal: AbortSignal.timeout(20000)
  })
  if (!r.ok) throw new Error("Worker HTTP " + r.status)
  return r.text()
}

function sfNormalize(result) {
  if (!result) return null
  const list = Array.isArray(result.url) ? result.url : []
  const media = list.map(m => ({ url:m.url, quality:m.subname||m.quality||null, ext:m.ext||null, type:m.type||null, label:m.name||null }))
  if (!media.length) return null
  return { title:(result.meta&&result.meta.title)||result.title||null, thumb:result.thumb||(result.meta&&result.meta.thumb)||null, duration:(result.meta&&result.meta.duration)||result.duration||null, media }
}

async function trySaveFrom(url) {
  let blob = await sfConvert(url)
  if (blob.includes("#json#")) {
    const j = JSON.parse(blob.match(/#json#([\s\S]+?)#json#/)[1])
    if (j.success === false) return null
    return sfNormalize(j)
  }
  let result = decodeBlob(blob)
  if (!result) { blob = await sfConvert(url, true); result = decodeBlob(blob) }
  if (result && result.success === false) return null
  return sfNormalize(result)
}

// ============================================
// FALLBACK: IKYY API + TIKWM
// ============================================
const IKYY = "https://api.ikyyxd.my.id"
const TIKWM = "https://www.tikwm.com/api/"

async function safeFetch(url, timeout) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeout || 15000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

function detectPlatform(url) {
  const u = url.toLowerCase()
  if (u.includes("tiktok.com") || u.includes("vt.tiktok")) return "tiktok"
  if (u.includes("instagram.com")) return "instagram"
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook"
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter"
  if (u.includes("pinterest.com") || u.includes("pin.it")) return "pinterest"
  return "other"
}

async function raceFallback(url) {
  const platform = detectPlatform(url)
  const tasks = []

  if (platform === "tiktok") {
    // TikWM (fastest for TikTok)
    tasks.push(safeFetch(TIKWM + "?url=" + encodeURIComponent(url) + "&hd=1", 12000).then(d => {
      if (!d || d.code !== 0 || !d.data) return null
      const r = d.data; const medias = []
      if (r.hdplay) medias.push({ url: r.hdplay, type: "video", quality: "HD", extension: "mp4" })
      if (r.play) medias.push({ url: r.play, type: "video", quality: "SD", extension: "mp4" })
      if (r.images && r.images.length) r.images.forEach(img => medias.push({ url: img, type: "image", extension: "jpg" }))
      if (r.music) medias.push({ url: r.music, type: "audio", extension: "mp3" })
      if (!medias.length) return null
      return { source: "TikTok", author: r.author?.unique_id || "", title: r.title || "", thumb: r.cover || "", medias }
    }))
    // Ikyy TikTok v4
    tasks.push(safeFetch(IKYY + "/download/tiktokv4?url=" + encodeURIComponent(url)).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = []
      if (r.media?.no_watermark) medias.push({ url: r.media.no_watermark, type: "video", quality: "HD No WM", extension: "mp4" })
      if (r.media?.music) medias.push({ url: r.media.music, type: "audio", extension: "mp3" })
      if (!medias.length) return null
      return { source: "TikTok", author: r.author?.username || "", title: r.title || "", thumb: r.media?.thumbnail || "", medias }
    }))
    // Ikyy TikTok v3
    tasks.push(safeFetch(IKYY + "/download/tiktokv3?url=" + encodeURIComponent(url)).then(d => {
      if (!d || !d.status || !d.result?.success) return null
      const r = d.result.data; const medias = []
      if (r.video) medias.push({ url: r.video, type: "video", quality: "No WM", extension: "mp4" })
      if (r.music) medias.push({ url: r.music, type: "audio", extension: "mp3" })
      if (r.images?.length) r.images.forEach(img => medias.push({ url: img, type: "image", extension: "jpg" }))
      if (!medias.length) return null
      return { source: "TikTok", author: r.author || "", title: r.title || "", medias }
    }))
  } else if (platform === "youtube") {
    tasks.push(safeFetch(IKYY + "/download/ytmp4?q=" + encodeURIComponent(url)).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = []
      if (r.VideoUrl?.url) medias.push({ url: r.VideoUrl.url, type: "video", quality: "720p", extension: "mp4" })
      if (!medias.length) return null
      return { source: "YouTube", title: r.title || "", thumb: r.thumbnail || "", medias }
    }))
    if (url.includes("/shorts/")) {
      tasks.push(safeFetch(IKYY + "/download/yt-shorts?url=" + encodeURIComponent(url)).then(d => {
        if (!d || !d.status || !d.result) return null
        const r = d.result; const medias = []
        if (r.DownloadUrl?.url) medias.push({ url: r.DownloadUrl.url, type: "video", quality: "HD", extension: "mp4" })
        if (!medias.length) return null
        return { source: "YouTube Shorts", title: r.title || "", medias }
      }))
    }
  } else if (platform === "instagram") {
    tasks.push(safeFetch(IKYY + "/download/igall?url=" + encodeURIComponent(url), 20000).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = []
      if (r.video?.length) r.video.forEach(v => medias.push({ url: v, type: "video", extension: "mp4" }))
      if (r.image?.length) r.image.forEach(img => medias.push({ url: img, type: "image", extension: "jpg" }))
      if (!medias.length) return null
      return { source: "Instagram", medias }
    }))
    tasks.push(safeFetch(IKYY + "/download/igv2?url=" + encodeURIComponent(url), 20000).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; if (!r.medias?.length) return null
      return { source: "Instagram", author: r.author || "", title: r.title || "", medias: r.medias }
    }))
  } else if (platform === "facebook") {
    tasks.push(safeFetch(IKYY + "/download/facebook?url=" + encodeURIComponent(url), 20000).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = r.medias || []
      if (r.hd) medias.push({ url: r.hd, type: "video", quality: "HD", extension: "mp4" })
      if (r.sd) medias.push({ url: r.sd, type: "video", quality: "SD", extension: "mp4" })
      if (!medias.length) return null
      return { source: "Facebook", title: r.title || "", medias }
    }))
  } else if (platform === "twitter") {
    tasks.push(safeFetch(IKYY + "/download/twitterdl?apikey=kyzz&url=" + encodeURIComponent(url)).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = r.medias || []
      if (r.video) medias.push({ url: r.video, type: "video", extension: "mp4" })
      if (!medias.length) return null
      return { source: "Twitter/X", title: r.title || "", medias }
    }))
  } else if (platform === "pinterest") {
    tasks.push(safeFetch(IKYY + "/download/pindl?url=" + encodeURIComponent(url)).then(d => {
      if (!d || !d.status || !d.result) return null
      const r = d.result; const medias = r.medias || []
      if (r.video) medias.push({ url: r.video, type: "video", extension: "mp4" })
      if (r.image) medias.push({ url: r.image, type: "image", extension: "jpg" })
      if (!medias.length) return null
      return { source: "Pinterest", title: r.title || "", medias }
    }))
  }

  if (!tasks.length) return null

  // Race: first successful result wins
  return new Promise(resolve => {
    let done = false, count = 0
    const total = tasks.length
    tasks.forEach(t => t.then(r => {
      count++
      if (r && !done) { done = true; resolve(r) }
      else if (count >= total && !done) { done = true; resolve(null) }
    }).catch(() => { count++; if (count >= total && !done) { done = true; resolve(null) } }))
    setTimeout(() => { if (!done) { done = true; resolve(null) } }, 25000)
  })
}

// ============================================
// MAIN HANDLER
// ============================================
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") return res.status(204).end()

  const { url: targetUrl } = req.query || {}

  if (!targetUrl) {
    return res.status(400).json({ status: false, error: "Parameter 'url' is required. Usage: /api/download?url=<encoded_url>" })
  }

  try { new URL(targetUrl) } catch {
    return res.status(400).json({ status: false, error: "Invalid URL" })
  }

  const start = Date.now()
  const platform = detectPlatform(targetUrl)
  let result = null
  let provider = "none"

  // Strategy 1: Try SaveFrom first
  try {
    const sf = await trySaveFrom(targetUrl)
    if (sf && sf.media && sf.media.length > 0) {
      result = {
        source: platform.charAt(0).toUpperCase() + platform.slice(1),
        title: sf.title || "",
        thumb: sf.thumb || "",
        medias: sf.media.map(m => ({
          url: m.url,
          type: guessType(m),
          quality: m.quality || m.label || "",
          extension: m.ext || guessExt(m)
        }))
      }
      provider = "savefrom"
    }
  } catch (e) {
    console.log("SaveFrom failed:", e.message)
  }

  // Strategy 2: Fallback to Ikyy/TikWM
  if (!result) {
    try {
      result = await raceFallback(targetUrl)
      if (result) provider = "fallback"
    } catch (e) {
      console.log("Fallback failed:", e.message)
    }
  }

  const elapsed = Date.now() - start

  if (!result || !result.medias || result.medias.length === 0) {
    return res.status(404).json({ status: false, error: "Media not found or not supported", platform, runtime: elapsed + "ms" })
  }

  return res.status(200).json({
    status: true,
    provider,
    result,
    runtime: elapsed + "ms"
  })
}

function guessType(m) {
  const ext = (m.ext || "").toLowerCase()
  const type = (m.type || "").toLowerCase()
  if (ext === "mp3" || ext === "m4a" || type.includes("audio")) return "audio"
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || type.includes("image")) return "image"
  return "video"
}
function guessExt(m) {
  const type = (m.type || "").toLowerCase()
  if (type.includes("audio")) return "mp3"
  if (type.includes("image")) return "jpg"
  return "mp4"
}
