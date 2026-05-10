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
    if (video.videoWidth === 0) return;

    ctx.drawImage(overlayImg, 0, 0, canvas.width, cachedImgH);
    ctx.drawImage(video, 0, cachedImgH, canvas.width, video.videoHeight);

    if (!isRecording) updateUI();

    if (!video.paused && !video.ended || isRecording) {
        animationFrameId = requestAnimationFrame(render);
    } else {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function updateUI() {
    const cur = video.currentTime || 0;
    const dur = video.duration || 1;
    progressBar.value = (cur / dur) * 100;
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
    cachedImgH = video.videoWidth * IMG_RATIO;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight + cachedImgH;
    dropZone.style.display = 'none';
    previewCard.style.display = 'block';
    render();
};

playBtn.addEventListener('click', async () => {
    if (isRecording) return;
    if (video.ended) video.currentTime = 0;
    video.paused ? video.play().then(() => render()) : video.pause();
});

volRange.addEventListener('input', () => {
    video.volume = volRange.value;
    volIcon.textContent = video.volume == 0 ? '🔇' : (video.volume < 0.5 ? '🔉' : '🔊');
});

progressBar.addEventListener('input', () => {
    video.currentTime = (progressBar.value / 100) * video.duration;
    if (!animationFrameId) render();
});

video.onseeked = () => { if (!animationFrameId) render(); };

downloadBtn.addEventListener('click', async () => {
    if (isRecording || !video.src) return;

    isRecording = true;
    downloadBtn.textContent = "Encoding...";

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const canvasStream = canvas.captureStream(24);
    const videoStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    
    const tracks = [...canvasStream.getVideoTracks()];
    if (videoStream.getAudioTracks()[0]) tracks.push(videoStream.getAudioTracks()[0]);

    const recorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000 
    });

    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `Export_${Date.now()}.mp4`;
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            downloadBtn.textContent = "Download";
            isRecording = false;
        }, 1000);
    };

    video.currentTime = 0;
    recorder.start();
    await video.play();
    render();

    const checkEnd = () => {
        if (video.ended) recorder.stop();
        else if (isRecording) requestAnimationFrame(checkEnd);
    };
    checkEnd();
});