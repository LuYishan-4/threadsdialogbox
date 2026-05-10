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

function render() {
    if (video.videoWidth === 0) return;
    
    ctx.drawImage(overlayImg, 0, 0, canvas.width, cachedImgH);
    ctx.drawImage(video, 0, cachedImgH, canvas.width, video.videoHeight);

  
    updateUI();

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
    const percent = (cur / dur) * 100;
    
    progressBar.value = percent;
    
    if (isRecording) {
        timeDisplay.textContent = `Encoding: ${Math.floor(percent)}%`;
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
    render();
};

playBtn.onclick = () => {
    if (isRecording) return;
    if (video.ended) video.currentTime = 0;
    video.paused ? video.play().then(() => render()) : video.pause();
};

volRange.oninput = () => { video.volume = volRange.value; };

progressBar.oninput = () => {
    if (isRecording) return;
    video.currentTime = (progressBar.value / 100) * video.duration;
    if (!animationFrameId) render();
};

downloadBtn.onclick = async () => {
    if (isRecording || !video.src) return;
    
    isRecording = true;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Processing...";

    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';

    const cvStream = canvas.captureStream(24);
    const vStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    
    const tracks = [...cvStream.getVideoTracks()];
    if (vStream.getAudioTracks()[0]) tracks.push(vStream.getAudioTracks()[0]);

    const mixed = new MediaStream(tracks);
    const recorder = new MediaRecorder(mixed, { 
        mimeType: mime, 
        videoBitsPerSecond: 2000000 
    });

    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Export_${Date.now()}.mp4`;
        a.click();
       
        mixed.getTracks().forEach(t => t.stop());
        chunks.length = 0;
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
            downloadBtn.disabled = false;
            downloadBtn.textContent = "Download Video";
            isRecording = false;
            video.pause();
            video.currentTime = 0;
            render();
        }, 500);
    };

    video.currentTime = 0;
    video.muted = true;
    recorder.start();
    

    await video.play();
    render();

    const check = () => {
        if (video.ended) {
            recorder.stop();
        } else if (isRecording) {
            requestAnimationFrame(check);
        }
    };
    check();
};