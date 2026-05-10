const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const video = document.getElementById('hiddenVideo');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const videoUpload = document.getElementById('videoUpload');
const dropZone = document.getElementById('dropZone');
const previewCard = document.getElementById('previewCard');
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const downloadBtn = document.getElementById('downloadBtn');
const volRange = document.getElementById('volRange');
const timeDisplay = document.getElementById('timeDisplay');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

const IMG_RATIO = 0.25;
const overlayImg = new Image();
overlayImg.src = 'assets/image.webp';
let cachedImgH = 0;
let isRendering = false;

function draw() {
    if (video.videoWidth === 0) return;
    ctx.drawImage(overlayImg, 0, 0, canvas.width, cachedImgH);
    ctx.drawImage(video, 0, cachedImgH, canvas.width, video.videoHeight);
}

function renderLoop() {
    if (!video.paused && !video.ended) {
        draw();
        updateUI();
        requestAnimationFrame(renderLoop);
    }
}

function updateUI() {
    const cur = video.currentTime || 0;
    const dur = video.duration || 1;
    progressBar.value = (cur / dur) * 100;
    timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    playBtn.textContent = video.paused ? "▶" : "⏸";
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
    video.src = URL.createObjectURL(file);
    video.load();
};

video.onloadedmetadata = () => {
    cachedImgH = video.videoWidth * IMG_RATIO;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight + cachedImgH;
    dropZone.style.display = 'none';
    previewCard.style.display = 'block';
    setTimeout(draw, 100);
};

playBtn.onclick = () => {
    if (video.paused) {
        video.play();
        renderLoop();
    } else {
        video.pause();
    }
};

progressBar.oninput = () => {
    video.currentTime = (progressBar.value / 100) * video.duration;
    draw();
};

volRange.oninput = () => { video.volume = volRange.value; };


downloadBtn.onclick = async () => {
    const file = videoUpload.files[0];
    if (!file) return;

    try {
        loadingOverlay.style.display = 'flex';
        downloadBtn.disabled = true;

        if (!ffmpeg.isLoaded()) {
            loadingText.textContent = "d";
            await ffmpeg.load();
        }

        loadingText.textContent = "waiting";
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
        ffmpeg.FS('writeFile', 'mask.webp', await fetchFile(overlayImg.src));

        loadingText.textContent = "114514";

        const filter = `[1:v]scale=${video.videoWidth}:-1[img];[img][0:v]vstack=inputs=2`;

        await ffmpeg.run(
            '-i', 'input.mp4',
            '-i', 'mask.webp',
            '-filter_complex', filter,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-c:a', 'copy', 
            'output.mp4'
        );

        loadingText.textContent = "Done";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `GodTalk_${Date.now()}.mp4`;
        a.click();

        ffmpeg.FS('unlink', 'input.mp4');
        ffmpeg.FS('unlink', 'mask.webp');
        ffmpeg.FS('unlink', 'output.mp4');

    } catch (err) {
        console.error(err);
        alert("fail to process video. Please try again.");
    } finally {
        loadingOverlay.style.display = 'none';
        downloadBtn.disabled = false;
    }
};