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

function drawFrame() {
    ctx.drawImage(overlayImg, 0, 0, canvas.width, cachedImgH);
    ctx.drawImage(video, 0, cachedImgH, canvas.width, video.videoHeight);
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
    
    if (isRecording) {
        timeDisplay.textContent = `Processing: ${Math.floor(percent)}%`;
    } else {
        timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
    playBtn.textContent = (video.paused || video.ended) ? "▶" : "⏸";
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

dropZone.onclick = () => videoUpload.click();

videoUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
    
    video.currentTime = 0;
    video.onseeked = () => {
        drawFrame();
        video.onseeked = null;
    };
};

playBtn.onclick = () => {
    if (isRecording) return;
    if (video.ended) video.currentTime = 0;
    if (video.paused) {
        video.play();
        render();
    } else {
        video.pause();
    }
};

volRange.oninput = () => { video.volume = volRange.value; };

progressBar.oninput = () => {
    if (isRecording) return;
    video.currentTime = (progressBar.value / 100) * video.duration;
    drawFrame();
};

downloadBtn.onclick = async () => {
    if (isRecording || !video.src) return;
    
    isRecording = true;
    downloadBtn.disabled = true;
    
    video.pause();
    video.muted = true;
    video.currentTime = 0;

    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ? 'video/mp4' : 'video/webm';
    const stream = canvas.captureStream(0); 
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
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rendered_${Date.now()}.mp4`;
        a.click();
        
        isRecording = false;
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download Video";
        video.muted = false;
        video.currentTime = 0;
    };

    recorder.start();

    const fps = 30;
    const interval = 1 / fps;
    
    while (video.currentTime < video.duration) {
        drawFrame();
        stream.getVideoTracks()[0].requestFrame();
        video.currentTime += interval;
        
        await new Promise(r => {
            video.onseeked = r;
        });
        updateUI();
    }

    recorder.stop();
};