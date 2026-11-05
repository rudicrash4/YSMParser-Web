(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const input = $('fileInput');
  const dropzone = $('dropzone');
  const fileList = $('fileList');
  const convertButton = $('convertButton');
  const progressCard = $('progressCard');
  const resultCard = $('resultCard');
  const consoleOutput = $('consoleOutput');
  let selectedFiles = [];
  let parserModule = null;
  let parserPromise = null;
  let outputBlob = null;
  let busy = false;
  const logs = [];

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  function log(message) {
    const line = String(message ?? '').trim();
    if (!line) return;
    logs.push(line);
    while (logs.length > 100) logs.shift();
    consoleOutput.textContent = logs.join('\n');
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
  function setProgress(percent, title) {
    $('progressBar').style.width = `${percent}%`;
    $('progressPercent').textContent = `${percent}%`;
    if (title) $('statusTitle').textContent = title;
  }
  function refreshFiles() {
    fileList.replaceChildren();
    selectedFiles.forEach((file) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      const chip = document.createElement('span'); chip.className = 'file-chip'; chip.textContent = 'YSM';
      const name = document.createElement('span'); name.className = 'file-name'; name.textContent = file.name;
      const size = document.createElement('span'); size.className = 'file-size'; size.textContent = formatSize(file.size);
      li.append(chip, name, size); fileList.append(li);
    });
    $('fileToolbar').hidden = selectedFiles.length === 0;
    $('fileCount').textContent = `${selectedFiles.length} file dipilih`;
    convertButton.disabled = selectedFiles.length === 0 || busy;
  }
  function addFiles(fileListLike) {
    const incoming = Array.from(fileListLike || []).filter(f => f.name.toLowerCase().endsWith('.ysm'));
    const existing = new Set(selectedFiles.map(f => `${f.name}:${f.size}:${f.lastModified}`));
    for (const file of incoming) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!existing.has(key)) { selectedFiles.push(file); existing.add(key); }
    }
    refreshFiles();
    if (incoming.length === 0) log('Tidak ada file .ysm yang ditemukan.');
  }
  input.addEventListener('change', e => { addFiles(e.target.files); input.value = ''; });
  $('clearFiles').addEventListener('click', () => { selectedFiles = []; refreshFiles(); resultCard.hidden = true; });
  for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  for (const eventName of ['dragleave', 'drop']) dropzone.addEventListener(eventName, e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

  async function loadParser() {
    if (parserModule) return parserModule;
    if (parserPromise) return parserPromise;
    if (typeof window.YSMParserModule !== 'function') throw new Error('YSMParser.js tidak berhasil dimuat. Pastikan file YSMParser.js berada di folder yang sama dengan index.html.');
    parserPromise = window.YSMParserModule({
      noInitialRun: true,
      noExitRuntime: true,
      print: log,
      printErr: (message) => log(`[stderr] ${message}`),
      locateFile: (path) => new URL(path, document.baseURI).href,
      onAbort: (reason) => log(`Parser dihentikan: ${reason}`)
    }).then(module => {
      parserModule = module;
      log('Mesin YSMParser WebAssembly berhasil dimuat.');
      return module;
    }).catch(error => { parserPromise = null; throw error; });
    return parserPromise;
  }
  function ensureDir(FS, path) {
    try { FS.mkdir(path); } catch (e) { if (!FS.analyzePath(path).exists) throw e; }
  }
  function removeTree(FS, path) {
    let entries = [];
    try { entries = FS.readdir(path).filter(name => name !== '.' && name !== '..'); } catch { return; }
    for (const name of entries) {
      const child = `${path}/${name}`;
      const stat = FS.stat(child);
      if (FS.isDir(stat.mode)) removeTree(FS, child);
      else FS.unlink(child);
    }
    if (path !== '/') { try { FS.rmdir(path); } catch {} }
  }
  function collectFiles(FS, path, result = []) {
    for (const name of FS.readdir(path)) {
      if (name === '.' || name === '..') continue;
      const full = `${path}/${name}`;
      const stat = FS.stat(full);
      if (FS.isDir(stat.mode)) collectFiles(FS, full, result);
      else if (FS.isFile(stat.mode)) result.push(full);
    }
    return result;
  }
  function uniqueInputName(file, index, used) {
    const clean = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '') || `model-${index + 1}.ysm`;
    let candidate = clean;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const dot = clean.toLowerCase().endsWith('.ysm') ? clean.slice(0, -4) : clean;
      candidate = `${dot}-${n++}.ysm`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }
  async function runConversion() {
    if (busy || selectedFiles.length === 0) return;
    busy = true; convertButton.disabled = true;
    resultCard.hidden = true; progressCard.hidden = false;
    logs.length = 0; consoleOutput.textContent = '';
    setProgress(3, 'Memuat mesin parser…');
    try {
      const module = await loadParser();
      const FS = module.FS;
      if (!FS || typeof module.callMain !== 'function') throw new Error('API filesystem atau callMain tidak tersedia pada build WASM ini.');
      removeTree(FS, '/ysm_input'); removeTree(FS, '/ysm_output');
      ensureDir(FS, '/ysm_input'); ensureDir(FS, '/ysm_output');
      const used = new Set();
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const name = uniqueInputName(file, i, used);
        const bytes = new Uint8Array(await file.arrayBuffer());
        FS.writeFile(`/ysm_input/${name}`, bytes);
        log(`Input siap: ${name} (${formatSize(file.size)})`);
        setProgress(10 + Math.round((i + 1) / selectedFiles.length * 25), 'Menyiapkan file input…');
      }
      setProgress(40, 'Menjalankan YSMParser…');
      log('Menjalankan: YSMParser -i /ysm_input -o /ysm_output -v');
      try { module.callMain(['-i', '/ysm_input', '-o', '/ysm_output', '-v']); }
      catch (error) {
        if (error && (error.name === 'ExitStatus' || String(error).includes('Program terminated with exit'))) {
          log(`Parser selesai dengan status proses ${error.status ?? 'selesai'}.`);
        } else { throw error; }
      }
      setProgress(78, 'Mengumpulkan hasil…');
      const outputFiles = collectFiles(FS, '/ysm_output');
      if (outputFiles.length === 0) {
        throw new Error('Parser tidak menghasilkan file output. Periksa log di atas. Build WASM mungkin memerlukan argumen atau struktur input berbeda.');
      }
      if (typeof window.createZipBlob !== 'function') throw new Error('Modul ZIP tidak berhasil dimuat. Pastikan zip.js ada di folder aplikasi.');
      const zipFiles = [];
      for (const path of outputFiles) {
        const relative = path.replace(/^\/ysm_output\//, '');
        zipFiles.push({ name: relative, data: FS.readFile(path) });
        log(`Output: ${relative}`);
      }
      setProgress(90, 'Membuat arsip ZIP…');
      outputBlob = window.createZipBlob(zipFiles);
      setProgress(99, 'Menyelesaikan arsip ZIP…');
      $('resultSummary').textContent = `${outputFiles.length} file berhasil dikemas · ${formatSize(outputBlob.size)}`;
      resultCard.hidden = false;
      setProgress(100, 'Selesai');
      log(`Selesai. ${outputFiles.length} file dikemas ke ZIP.`);
    } catch (error) {
      console.error(error);
      log(`ERROR: ${error?.message || error}`);
      setProgress(100, 'Konversi gagal');
      $('statusTitle').textContent = 'Konversi gagal';
    } finally {
      busy = false; convertButton.disabled = selectedFiles.length === 0;
    }
  }
  convertButton.addEventListener('click', runConversion);
  $('downloadButton').addEventListener('click', () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a'); a.href = url; a.download = `YSMParser-Output-${new Date().toISOString().slice(0,10)}.zip`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  refreshFiles();
})();
