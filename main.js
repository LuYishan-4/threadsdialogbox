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

const overlayImgSrc = 'assets/image.webp';
let finalVideoBlobUrl = null;


function renderLoop() {
    if (!video.paused && !video.ended) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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


videoUpload.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {

        loadingOverlay.style.display = 'flex';
        loadingText.textContent = "waitting";

        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        loadingText.textContent = "get ready...";
        ffmpeg.FS('writeFile', 'temp_in.mp4', await fetchFile(file));
        ffmpeg.FS('writeFile', 'mask.webp', await fetchFile(overlayImgSrc));


        const tempVideo = document.createElement('video');
        tempVideo.src = URL.createObjectURL(file);
        await new Promise(r => tempVideo.onloadedmetadata = r);
        const vw = tempVideo.videoWidth;
        
        loadingText.textContent = ".....";

   
        const filter = `[1:v]scale=${vw}:-1[img];[img][0:v]vstack=inputs=2`;
        await ffmpeg.run(
            '-i', 'temp_in.mp4',
            '-i', 'mask.webp',
            '-filter_complex', filter,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-c:a', 'copy', 
            'out.mp4'
        );


        const data = ffmpeg.FS('readFile', 'out.mp4');
        finalVideoBlobUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

     
        video.src = finalVideoBlobUrl;
        video.load();

        loadingText.textContent = "Done!";
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            dropZone.style.display = 'none';
            previewCard.style.display = 'block';
        }, 500);

    } catch (err) {
        console.error(err);
        alert("FAILED TO PROCESS VIDEO.");
        loadingOverlay.style.display = 'none';
    }
};

video.onloadedmetadata = () => {
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
};

volRange.oninput = () => { video.volume = volRange.value; };


downloadBtn.onclick = () => {
    if (!finalVideoBlobUrl) return;
    const a = document.createElement('a');
    a.href = finalVideoBlobUrl;
    a.download = `GodTalk_Ready_${Date.now()}.mp4`;
    a.click();
};

dropZone.onclick = () => videoUpload.click();