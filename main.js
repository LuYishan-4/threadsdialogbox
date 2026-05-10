const video = document.getElementById('hiddenVideo');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const videoUpload = document.getElementById('videoUpload');
const dropZone = document.getElementById('dropZone');
const previewCard = document.getElementById('previewCard');
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const timeDisplay = document.getElementById('timeDisplay');
const downloadBtn = document.getElementById('downloadBtn');
const volRange = document.getElementById('volRange');

const IMG_RATIO = 0.25;
const overlayImg = new Image();
overlayImg.src = './assets/image.webp';

let isRecording = false;
let cachedImgH = 0;
let animationFrameId = null;
let logs = [];

// --- 偵錯日誌系統 ---
function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    logs.push(entry);
    console.log(entry);
}

function showDebugModal() {
    const existing = document.getElementById('debugModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'debugModal';
    modal.style = "position:fixed;top:10%;left:5%;width:90%;height:80%;background:#fff;z-index:10000;border:2px solid #333;padding:15px;display:flex;flex-direction:column;box-shadow:0 0 20px rgba(0,0,0,0.5);font-family:monospace;";
    
    const title = document.createElement('h3');
    title.textContent = "Debug Log (Capture)";
    
    const textArea = document.createElement('textarea');
    textArea.style = "flex:1;margin:10px 0;padding:5px;font-size:12px;overflow-y:scroll;";
    textArea.value = logs.join('\n');
    textArea.readOnly = true;

    const btnGroup = document.createElement('div');
    btnGroup.style = "display:flex;gap:10px;";

    const copyBtn = document.createElement('button');
    copyBtn.textContent = "複製全部日誌";
    copyBtn.style = "padding:10px;background:#007bff;color:#fff;border:none;border-radius:5px;";
    copyBtn.onclick = () => {
        textArea.select();
        document.execCommand('copy');
        alert('已複製到剪貼簿');
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = "關閉";
    closeBtn.style = "padding:10px;background:#666;color:#fff;border:none;border-radius:5px;";
    closeBtn.onclick = () => modal.remove();

    modal.appendChild(title);
    modal.appendChild(textArea);
    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(closeBtn);
    modal.appendChild(btnGroup);
    document.body.appendChild(modal);
}

window.onerror = (msg, url, line) => {
    log(`ERROR: ${msg} (Line: ${line})`);
    showDebugModal();
};

// --- 核心繪圖與渲染 ---
function drawFrame() {
    try {
        ctx.drawImage(overlayImg, 0, 0, canvas.width, cachedImgH);
        ctx.drawImage(video, 0, cachedImgH, canvas.width, video.videoHeight);
    } catch (e) {
        log(`Draw Error: ${e.message}`);
    }
}

function render() {
    if (video.videoWidth === 0) return;
    drawFrame();
    updateUI();
    if (!video.paused && !video.ended) {
        animationFrameId = requestAnimationFrame(render);
    }
}

function updateUI() {
    const cur = video.currentTime || 0;
    const dur = video.duration || 1;
    const percent = (cur / dur) * 100;
    progressBar.value = percent;
    timeDisplay.textContent = isRecording ? `Processing: ${Math.floor(percent)}%` : `${formatTime(cur)} / ${formatTime(dur)}`;
    playBtn.textContent = (video.paused || video.ended) ? "▶" : "⏸";
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// --- 事件處理 ---
dropZone.onclick = () => videoUpload.click();

videoUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    log(`File loaded: ${file.name} (${file.type})`);
    if (video.src) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(file);
    video.load();
};

video.onloadedmetadata = () => {
    cachedImgH = video.videoWidth * IMG_RATIO;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight + cachedImgH;
    dropZone.style.display = 'none';
    previewCard.style.display = 'block';
    log(`Canvas Init: ${canvas.width}x${canvas.height}`);
    video.currentTime = 0;
};

playBtn.onclick = () => {
    if (isRecording) return;
    if (video.paused) {
        video.play().catch(e => log(`Play Error: ${e.message}`));
        render();
    } else {
        video.pause();
    }
};

downloadBtn.onclick = async () => {
    if (isRecording || !video.src) return;
    
    log("Starting offline render...");
    isRecording = true;
    downloadBtn.disabled = true;
    
    video.pause();
    video.muted = true;
    video.currentTime = 0;

    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ? 'video/mp4' : 'video/webm';
    log(`MIME Type: ${mime}`);

    let stream;
    try {
        stream = canvas.captureStream(0);
        const vStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
        const tracks = [stream.getVideoTracks()[0]];
        if (vStream.getAudioTracks()[0]) tracks.push(vStream.getAudioTracks()[0]);

        const recorder = new MediaRecorder(new MediaStream(tracks), {
            mimeType: mime,
            videoBitsPerSecond: 5000000
        });

        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        
        recorder.onstop = () => {
            log("Recording stopped, generating file...");
            const blob = new Blob(chunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Export_${Date.now()}.mp4`;
            a.click();
            
            isRecording = false;
            downloadBtn.disabled = false;
            downloadBtn.textContent = "Download Video";
            showDebugModal(); // 錄製完畢主動顯示偵錯視窗確認流程
        };

        recorder.start();
        log("Recorder started");

        const fps = 30;
        const interval = 1 / fps;
        
        while (video.currentTime < video.duration) {
            drawFrame();
            stream.getVideoTracks()[0].requestFrame();
            video.currentTime += interval;
            await new Promise(r => video.onseeked = r);
            if (Math.floor(video.currentTime) % 5 === 0) log(`Render progress: ${video.currentTime.toFixed(1)}s`);
        }

        recorder.stop();
    } catch (e) {
        log(`CRITICAL ERROR: ${e.message}`);
        showDebugModal();
        isRecording = false;
        downloadBtn.disabled = false;
    }
};