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

dropZone.onclick = () => videoUpload.click();

videoUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    video.src = URL.createObjectURL(file);
    video.load();
};


video.onloadedmetadata = () => {
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const imgH = vW * IMG_RATIO;

    canvas.width = vW;
    canvas.height = vH + imgH;

    dropZone.style.display = 'none';
    previewCard.style.display = 'block';


    video.currentTime = 0;
};

video.onseeked = render;

function render() {
    const vW = canvas.width;
    const vH = video.videoHeight;
    const imgH = vW * IMG_RATIO;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, vW, canvas.height);

    if (overlayImg.complete) {
        ctx.drawImage(overlayImg, 0, 0, vW, imgH);
    }
    ctx.drawImage(video, 0, imgH, vW, vH);


    progressBar.value = (video.currentTime / video.duration) * 100 || 0;
    timeDisplay.textContent = `${format(video.currentTime)} / ${format(video.duration || 0)}`;
    playBtn.textContent = (video.paused || video.ended) ? "▶" : "⏸";

    if (!video.paused && !video.ended || isRecording) {
        requestAnimationFrame(render);
    }
}

function format(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}


playBtn.onclick = () => {
    if (video.ended) video.currentTime = 0;
    video.paused ? video.play() : video.pause();
    render();
};

volRange.oninput = () => {
    video.volume = volRange.value;
    volIcon.textContent = video.volume === 0 ? '🔇' : (video.volume < 0.5 ? '🔉' : '🔊');
};

progressBar.oninput = () => {
    video.currentTime = (progressBar.value / 100) * video.duration;
};

video.onended = () => {
    render();
};


downloadBtn.onclick = async () => {
    if (isRecording) return;
    isRecording = true;
    downloadBtn.textContent = "waiting for video to end...";


    const canvasStream = canvas.captureStream(30);


    const videoStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    const audioTrack = videoStream.getAudioTracks()[0];

    const combinedStream = new MediaStream([canvasStream.getVideoTracks()[0]]);
    if (audioTrack) combinedStream.addTrack(audioTrack);

    const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000
    });

    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `composed_video_${Date.now()}.webm`;
        a.click();
        downloadBtn.textContent = "Download";
        isRecording = false;
        render();
    };

    recorder.start();
    video.currentTime = 0;
    await video.play();

    const checkEnd = () => {
        if (video.ended) recorder.stop();
        else if (isRecording) requestAnimationFrame(checkEnd);
    };
    checkEnd();
};