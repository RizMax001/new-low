// DOWNSOSMED v11.0 - SaveFrom API Edition
// Backend: server/server.js (SaveFrom + CORS)
// Made with 💜 by RizkyMaxz

// ============================================
// CONFIG - ganti dengan URL server kamu
// ============================================
// Auto-detect: kalau di Vercel/deploy → pakai origin, kalau lokal → localhost:3000
const API_URL = (function() {
  var h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
  if (h.includes('.vercel.app') || h.includes('.now.sh')) return window.location.origin;
  return window.location.origin; // custom domain
})();

const PROXY_BASE = API_URL + '/api/proxy?url=';

let downloadLinks = [];

// ============================================
// THEME
// ============================================
var themeToggle = document.getElementById('themeToggle');
if (localStorage.getItem('theme') === 'light') document.body.classList.remove('dark-mode');
themeToggle.addEventListener('click', function () {
  var isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// ============================================
// NAVBAR
// ============================================
window.addEventListener('scroll', function () {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
});

document.getElementById('hamburger').addEventListener('click', function () {
  document.getElementById('navMenu').classList.toggle('open');
});

// ============================================
// INPUT
// ============================================
var urlInput = document.getElementById('url');
var clearBtn = document.getElementById('clearBtn');

urlInput.addEventListener('input', function () {
  clearBtn.style.display = urlInput.value ? 'flex' : 'none';
});

clearBtn.addEventListener('click', function () {
  urlInput.value = '';
  clearBtn.style.display = 'none';
  urlInput.focus();
});

urlInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') fetchMedia();
});

// ============================================
// LOADING
// ============================================
function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Memuat...';
  document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingSpinner').style.display = 'none';
}

// ============================================
// DETECT PLATFORM (for UI label)
// ============================================
function detectPlatform(url) {
  var u = url.toLowerCase();
  if (u.includes('tiktok.com') || u.includes('vt.tiktok')) return 'TikTok';
  if (u.includes('instagram.com')) return 'Instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'Facebook';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'Twitter/X';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'Pinterest';
  if (u.includes('reddit.com')) return 'Reddit';
  if (u.includes('linkedin.com')) return 'LinkedIn';
  if (u.includes('vimeo.com')) return 'Vimeo';
  if (u.includes('dailymotion.com')) return 'Dailymotion';
  return 'Media';
}

// ============================================
// FETCH MEDIA - call our SaveFrom backend
// ============================================
async function fetchMedia() {
  var url = urlInput.value.trim();

  if (!url) {
    showToast('Masukkan URL!', 'error');
    return;
  }

  try {
    new URL(url);
  } catch (e) {
    showToast('URL tidak valid!', 'error');
    return;
  }

  clearPreview();
  document.getElementById('result').style.display = 'none';

  var platform = detectPlatform(url);
  showLoading('⚡ Mengambil media dari ' + platform + '...');

  var startTime = Date.now();

  try {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 60000); // 60s timeout (SaveFrom can be slow)

    var response = await fetch(API_URL + '/api/download?url=' + encodeURIComponent(url), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timer);

    var data = await response.json();
    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    hideLoading();

    if (!data.status || !data.result) {
      showToast(data.error || 'Media tidak ditemukan!', 'error');
      return;
    }

    if (data.result.medias && data.result.medias.length === 0) {
      showToast('Tidak ada media yang bisa didownload!', 'error');
      return;
    }

    console.log('⚡ Fetched in ' + elapsed + 's (' + (data.runtime || '') + ')');
    renderMedia(data.result);

  } catch (err) {
    hideLoading();
    if (err.name === 'AbortError') {
      showToast('Timeout! Server terlalu lama merespons.', 'error');
    } else {
      console.error('Fetch error:', err);
      showToast('Gagal terhubung ke server!', 'error');
    }
  }
}

// ============================================
// RENDER MEDIA
// ============================================
function renderMedia(result) {
  var preview = document.getElementById('media-preview');
  var dlBtns = document.getElementById('dl-btns');

  preview.innerHTML = '';
  dlBtns.innerHTML = '';
  downloadLinks = [];

  var platform = result.source || 'Media';
  var author = result.author || '';
  var title = result.title || '';

  document.getElementById('platform').innerHTML = '<i class="fas fa-play-circle"></i> ' + platform;
  document.getElementById('author').textContent = author ? '@' + author : '';

  var captionEl = document.getElementById('caption');
  if (title && !/^https?:\/\//i.test(title)) {
    captionEl.style.display = '';
    captionEl.textContent = title.length > 120 ? title.substring(0, 120) + '…' : title;
  } else {
    captionEl.style.display = 'none';
  }

  var medias = result.medias || [];

  // Separate media types
  var videos = [];
  var photos = [];
  var audios = [];

  for (var i = 0; i < medias.length; i++) {
    var m = medias[i];
    var type = (m.type || '').toLowerCase();
    var ext = (m.extension || '').toLowerCase();
    var quality = (m.quality || '').toLowerCase();

    if (type === 'audio' || ext === 'mp3' || ext === 'm4a' || quality.includes('audio')) {
      audios.push(m);
    } else if (type === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'gif'].indexOf(ext) !== -1) {
      photos.push(m);
    } else {
      videos.push(m);
    }
  }

  console.log('Videos:', videos.length, 'Photos:', photos.length, 'Audios:', audios.length);

  // Show thumbnail if no preview-able media but thumb exists
  if (result.thumb && videos.length === 0 && photos.length === 0) {
    var thumbImg = document.createElement('img');
    thumbImg.src = result.thumb;
    thumbImg.alt = 'Thumbnail';
    thumbImg.style.cssText = 'width:100%;max-height:300px;object-fit:contain;background:#000;border-radius:8px';
    preview.appendChild(thumbImg);
  }

  // Priority: Video > Photo > Audio
  if (videos.length > 0) {
    var videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.src = videos[0].url;
    videoEl.poster = result.thumb || '';
    videoEl.style.cssText = 'width:100%;max-height:480px;object-fit:contain;background:#000';
    preview.appendChild(videoEl);

    // Download buttons for each quality
    for (var vi = 0; vi < videos.length; vi++) {
      var vLabel = videos[vi].quality || ('Video ' + (vi + 1));
      var vExt = (videos[vi].extension || 'mp4').toUpperCase();
      addButton(dlBtns, 'video', videos[vi].url, vLabel, vExt + ' • Tanpa Watermark', 'fa-video', 'dl-video');
      downloadLinks.push({ type: 'video', url: videos[vi].url });
    }

    // Add audio buttons too
    for (var ai = 0; ai < audios.length; ai++) {
      var aLabel = audios[ai].quality || ('Audio ' + (ai + 1));
      addButton(dlBtns, 'audio', audios[ai].url, aLabel, (audios[ai].extension || 'mp3').toUpperCase() + ' • Audio Only', 'fa-music', 'dl-music');
      downloadLinks.push({ type: 'audio', url: audios[ai].url });
    }

  } else if (photos.length > 0) {
    if (photos.length === 1) {
      var imgEl = document.createElement('img');
      imgEl.src = photos[0].url;
      imgEl.alt = 'Photo';
      imgEl.style.cssText = 'width:100%;max-height:480px;object-fit:contain;background:#000;cursor:pointer';
      imgEl.onclick = function () { window.open(photos[0].url, '_blank') };
      preview.appendChild(imgEl);

      addButton(dlBtns, 'photo_0', photos[0].url, 'Foto', 'JPG/PNG • HD', 'fa-image', 'dl-photo');
      downloadLinks.push({ type: 'photo', url: photos[0].url });
    } else {
      createSlider(preview, photos);
      for (var j = 0; j < photos.length; j++) {
        var photoNum = j + 1;
        addButton(dlBtns, 'photo_' + j, photos[j].url, 'Foto ' + photoNum, 'JPG/PNG • ' + photoNum + '/' + photos.length, 'fa-image', 'dl-photo');
        downloadLinks.push({ type: 'photo', url: photos[j].url, name: 'Foto ' + photoNum });
      }
    }
  } else if (audios.length > 0) {
    var audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = audios[0].url;
    audioEl.style.cssText = 'width:100%;max-width:380px;margin:16px auto;display:block';
    preview.appendChild(audioEl);

    for (var a2 = 0; a2 < audios.length; a2++) {
      var a2Label = audios[a2].quality || ('Audio ' + (a2 + 1));
      addButton(dlBtns, 'audio', audios[a2].url, a2Label, (audios[a2].extension || 'mp3').toUpperCase(), 'fa-music', 'dl-music');
      downloadLinks.push({ type: 'audio', url: audios[a2].url });
    }
  }

  if (downloadLinks.length === 0) {
    showToast('Media tidak tersedia!', 'error');
    return;
  }

  var resultSection = document.getElementById('result');
  resultSection.style.display = 'block';
  setTimeout(function () {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);

  showToast('Media berhasil dimuat! 🎉', 'success');
}

// ============================================
// PHOTO SLIDER
// ============================================
function createSlider(container, photos) {
  var slider = document.createElement('div');
  slider.className = 'gallery-slider';

  var slides = document.createElement('div');
  slides.className = 'gallery-slides';

  for (var i = 0; i < photos.length; i++) {
    var slide = document.createElement('div');
    slide.className = 'gallery-slide';

    var img = document.createElement('img');
    img.src = photos[i].url;
    img.alt = 'Photo ' + (i + 1);
    img.style.cssText = 'width:100%;max-height:480px;object-fit:contain;background:#000;cursor:pointer';

    img.onclick = (function (url) { return function () { window.open(url, '_blank') } })(photos[i].url);

    slide.appendChild(img);
    slides.appendChild(slide);
  }

  slider.appendChild(slides);

  if (photos.length > 1) {
    var prevBtn = document.createElement('button');
    prevBtn.className = 'gallery-nav prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.onclick = function () { changeSlide(-1) };
    slider.appendChild(prevBtn);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'gallery-nav next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.onclick = function () { changeSlide(1) };
    slider.appendChild(nextBtn);

    var dots = document.createElement('div');
    dots.className = 'gallery-dots';

    for (var j = 0; j < photos.length; j++) {
      var dot = document.createElement('button');
      dot.className = 'gallery-dot' + (j === 0 ? ' active' : '');
      dot.onclick = (function (idx) { return function () { goToSlide(idx) } })(j);
      dots.appendChild(dot);
    }
    slider.appendChild(dots);

    var counter = document.createElement('div');
    counter.className = 'gallery-counter';
    counter.id = 'slideCounter';
    counter.textContent = '1 / ' + photos.length;
    slider.appendChild(counter);
  }

  container.appendChild(slider);
  window.currentSlide = 0;
  window.totalPhotos = photos.length;
}

function changeSlide(dir) {
  window.currentSlide = (window.currentSlide + dir + window.totalPhotos) % window.totalPhotos;
  updateSlider();
}

function goToSlide(idx) {
  window.currentSlide = idx;
  updateSlider();
}

function updateSlider() {
  var slidesEl = document.querySelector('.gallery-slides');
  var dots = document.querySelectorAll('.gallery-dot');
  var counter = document.getElementById('slideCounter');

  if (slidesEl) slidesEl.style.transform = 'translateX(-' + (window.currentSlide * 100) + '%)';
  for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i === window.currentSlide);
  if (counter) counter.textContent = (window.currentSlide + 1) + ' / ' + window.totalPhotos;
}

// ============================================
// DOWNLOAD
// ============================================
function addButton(container, type, url, title, subtitle, icon, btnClass) {
  var btn = document.createElement('button');
  btn.className = 'dl-btn ' + btnClass;
  btn.onclick = (function (u, t) { return function () { downloadFile(u, t) } })(url, type);

  btn.innerHTML =
    '<i class="fas ' + icon + '"></i>' +
    '<div class="dl-info"><strong>' + title + '</strong><small>' + subtitle + '</small></div>' +
    '<i class="fas fa-download dl-arrow"></i>';

  container.appendChild(btn);
}

function downloadFile(url, type) {
  var ext = 'mp4';
  if (type.indexOf('photo') !== -1) ext = 'jpg';
  else if (type === 'audio') ext = 'mp3';

  var filename = 'DownSosmed_' + ext + '_' + Date.now() + '.' + ext;

  showToast('⚡ Mempersiapkan download...', 'success');

  // Try 1: direct blob download
  singleBlobDownload(url, filename, type === 'audio')
    .then(function (ok) {
      if (ok) return;
      // Try 2: via our proxy (bypasses CORS)
      return singleBlobDownload(PROXY_BASE + encodeURIComponent(url), filename, type === 'audio');
    })
    .then(function (ok) {
      if (ok) return;
      // Try 3: open in new tab
      window.open(url, '_blank');
      showToast('Download di tab baru ↗', 'success');
    })
    .catch(function () {
      window.open(url, '_blank');
      showToast('Download di tab baru ↗', 'success');
    });
}

async function singleBlobDownload(url, filename, isAudio) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 30000);

    var res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error('Fetch failed');
    var blob = await res.blob();
    if (blob.size === 0) throw new Error('Empty blob');

    if (isAudio) blob = blob.slice(0, blob.size, 'audio/mpeg');

    var blobUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 60000);

    showToast('Download berhasil! ✓', 'success');
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================
// UI UTILITIES
// ============================================
function hideResult() {
  document.getElementById('result').style.display = 'none';
  urlInput.value = '';
  clearBtn.style.display = 'none';
  clearPreview();
}

function clearPreview() {
  document.getElementById('media-preview').innerHTML = '';
  document.getElementById('dl-btns').innerHTML = '';
  downloadLinks = [];
}

function toggleFAQ(el) {
  var item = el.parentElement;
  var isActive = item.classList.contains('active');
  var items = document.querySelectorAll('.faq-item');
  for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
  if (!isActive) item.classList.add('active');
}

function showToast(msg, type) {
  type = type || 'success';
  var toast = document.getElementById('toast');
  toast.className = type === 'error' ? 'error' : '';
  toast.querySelector('i').className = type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
  document.getElementById('toastMessage').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { toast.classList.remove('show'); }, 3500);
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }
  if (e.key === 'Escape') {
    var result = document.getElementById('result');
    if (result.style.display !== 'none') hideResult();
    document.getElementById('navMenu').classList.remove('open');
  }
});

// Preloader
window.addEventListener('load', function () {
  var pre = document.getElementById('preloader');
  pre.style.opacity = '0';
  setTimeout(function () { pre.style.display = 'none'; }, 300);
});

// Scroll progress & back to top
window.addEventListener('scroll', function () {
  var scrolled = window.scrollY;
  var max = document.documentElement.scrollHeight - window.innerHeight;
  var pct = max > 0 ? (scrolled / max) * 100 : 0;
  document.getElementById('scrollProgress').style.width = pct + '%';
  document.getElementById('backTop').classList.toggle('show', scrolled > 350);
}, { passive: true });

document.getElementById('backTop').addEventListener('click', function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Reveal animations
var observer = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
for (var i = 0; i < revealEls.length; i++) observer.observe(revealEls[i]);

// Smooth anchor links
var anchorLinks = document.querySelectorAll('a[href^="#"]');
for (var i = 0; i < anchorLinks.length; i++) {
  anchorLinks[i].addEventListener('click', function (e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

console.log('%c⚡ DownSosmed v11 - SaveFrom Edition', 'color:#7c3aed;font-size:14px;font-weight:bold;');
console.log('%c🔗 API: ' + API_URL, 'color:#06b6d4;font-size:11px;');
