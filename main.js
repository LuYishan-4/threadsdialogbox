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
const volIcon = document.getElementById('volIcon');

const IMG_RATIO = 0.25;
const overlayImg = new Image();
overlayImg.src = './assets/image.webp';

let isRecording = false;
let cachedImgH = 0;
let animationFrameId = null;

function render() {
    const vW = canvas.width;
    const vH = video.videoHeight;
    
    if (vW === 0 || vH === 0) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, vW, canvas.height);

    if (overlayImg.complete && overlayImg.naturalWidth !== 0) {
        ctx.drawImage(overlayImg, 0, 0, vW, cachedImgH);
    }
    
    ctx.drawImage(video, 0, cachedImgH, vW, vH);

    if (!isRecording) {
        updateUI();
    }

    if (!video.paused && !video.ended || isRecording) {
        animationFrameId = requestAnimationFrame(render);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function updateUI() {
    const cur = video.currentTime || 0;
    const dur = video.duration || 0;
    progressBar.value = (cur / dur) * 100 || 0;
    timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    playBtn.textContent = (video.paused || video.ended) ? "▶" : "⏸";
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

dropZone.addEventListener('click', () => videoUpload.click());

videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (video.src) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(file);
    video.load();
});

video.onloadedmetadata = () => {
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    cachedImgH = vW * IMG_RATIO;
    canvas.width = vW;
    canvas.height = vH + cachedImgH;
    dropZone.style.display = 'none';
    previewCard.style.display = 'block';
    video.currentTime = 0;
    requestAnimationFrame(render);
};

playBtn.addEventListener('click', async () => {
    if (isRecording) return;
    if (video.ended) video.currentTime = 0;
    if (video.paused) {
        try {
            await video.play();
            render(); 
        } catch (err) { console.error(err); }
    } else {
        video.pause();
    }
});

volRange.addEventListener('input', () => {
    const v = volRange.value;
    video.volume = v;
    volIcon.textContent = v == 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
});

progressBar.addEventListener('input', () => {
    if (!video.duration) return;
    video.currentTime = (progressBar.value / 100) * video.duration;
    if (!animationFrameId) render();
});

video.onseeked = () => {
    if (!animationFrameId) render();
};

downloadBtn.addEventListener('click', async () => {
    if (isRecording || !video.src) return;

    isRecording = true;
    const originalBtnText = downloadBtn.textContent;
    downloadBtn.textContent = "Encoding...";

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const canvasStream = canvas.captureStream(30);
    const videoStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    
    const tracks = [canvasStream.getVideoTracks()[0]];
    const audioTrack = videoStream.getAudioTracks()[0];
    if (audioTrack) tracks.push(audioTrack);

    const combinedStream = new MediaStream(tracks);
    const recorder = new MediaRecorder(combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000 
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GodlikeDialog_${Date.now()}.mp4`;
        a.click();
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
            downloadBtn.textContent = originalBtnText;
            isRecording = false;
            render();
        }, 1000);
    };

    video.currentTime = 0;
    recorder.start();
    await video.play();
    render();

    const checkEnd = () => {
        if (video.ended) {
            recorder.stop();
        } else if (isRecording) {
            requestAnimationFrame(checkEnd);
        }
    };
    checkEnd();
});