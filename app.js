const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
  log: false,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
});
let ffmpegLoading = null;

function ensureLoaded(onProgress) {
  if (ffmpeg.isLoaded()) return Promise.resolve();
  if (!ffmpegLoading) {
    ffmpeg.setProgress(({ ratio }) => {
      if (onProgress && ratio >= 0 && ratio <= 1) onProgress(ratio);
    });
    ffmpegLoading = ffmpeg.load();
  }
  return ffmpegLoading;
}

// ---- tabs ----
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

function wireDropzone(key, onFile) {
  const dropzone = document.getElementById('dropzone-' + key);
  const fileInput = document.getElementById('fileInput-' + key);
  const fname = document.getElementById('fname-' + key);
  const goBtn = document.getElementById('goBtn-' + key);
  let currentFile = null;

  function setFile(file) {
    if (!file) return;
    currentFile = file;
    fname.textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
    goBtn.disabled = false;
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => setFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
  );
  dropzone.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  goBtn.addEventListener('click', () => {
    if (currentFile) onFile(currentFile);
  });
}

function setProgressUI(key, ratio) {
  const wrap = document.getElementById('progressWrap-' + key);
  const bar = document.getElementById('progressBar-' + key);
  wrap.style.display = 'block';
  bar.style.width = Math.round(ratio * 100) + '%';
}

// ---- GIF conversion ----
wireDropzone('gif', async (file) => {
  const status = document.getElementById('status-gif');
  const result = document.getElementById('result-gif');
  const goBtn = document.getElementById('goBtn-gif');
  const width = document.getElementById('gifWidth').value;
  const fps = document.getElementById('gifFps').value;
  result.innerHTML = '';
  goBtn.disabled = true;
  try {
    status.textContent = 'Loading conversion engine (first time only)...';
    await ensureLoaded((r) => setProgressUI('gif', r * 0.5));
    status.textContent = 'Reading file...';
    const inName = 'in' + (file.name.match(/\.[a-zA-Z0-9]+$/) || ['.mp4'])[0];
    ffmpeg.FS('writeFile', inName, await fetchFile(file));
    status.textContent = 'Converting to GIF...';
    await ffmpeg.run(
      '-i', inName,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`,
      '-loop', '0',
      'out.gif'
    );
    const data = ffmpeg.FS('readFile', 'out.gif');
    const blob = new Blob([data.buffer], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    status.textContent = 'Done. ' + (blob.size / 1024).toFixed(0) + ' KB.';
    result.innerHTML = '<a class="dl" download="converted.gif" href="' + url + '">Download GIF</a>';
    try { ffmpeg.FS('unlink', inName); ffmpeg.FS('unlink', 'out.gif'); } catch (e) {}
  } catch (err) {
    status.textContent = 'Error: ' + err.message + ' (try a shorter clip or a different format)';
    console.error(err);
  } finally {
    goBtn.disabled = false;
  }
});

// ---- Compress video ----
wireDropzone('compress', async (file) => {
  const status = document.getElementById('status-compress');
  const result = document.getElementById('result-compress');
  const goBtn = document.getElementById('goBtn-compress');
  const crf = document.getElementById('crf').value;
  result.innerHTML = '';
  goBtn.disabled = true;
  try {
    status.textContent = 'Loading conversion engine (first time only)...';
    await ensureLoaded((r) => setProgressUI('compress', r * 0.5));
    status.textContent = 'Reading file...';
    const inName = 'in' + (file.name.match(/\.[a-zA-Z0-9]+$/) || ['.mp4'])[0];
    ffmpeg.FS('writeFile', inName, await fetchFile(file));
    status.textContent = 'Compressing...';
    await ffmpeg.run(
      '-i', inName,
      '-vcodec', 'libx264',
      '-crf', crf,
      '-preset', 'veryfast',
      '-acodec', 'aac',
      'out.mp4'
    );
    const data = ffmpeg.FS('readFile', 'out.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const pct = ((1 - blob.size / file.size) * 100).toFixed(0);
    status.textContent = 'Done. ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB (' + (pct > 0 ? pct + '% smaller' : 'size changed') + ').';
    result.innerHTML = '<a class="dl" download="compressed.mp4" href="' + url + '">Download video</a>';
    try { ffmpeg.FS('unlink', inName); ffmpeg.FS('unlink', 'out.mp4'); } catch (e) {}
  } catch (err) {
    status.textContent = 'Error: ' + err.message + ' (try a shorter clip or a different format)';
    console.error(err);
  } finally {
    goBtn.disabled = false;
  }
});
