<?php
if ($_FILES['video']) {
    $videoTemp = $_FILES['video']['tmp_name'];
    $imagePath = "assets/image.webp";
    $outputPath = "output.mp4";


    $cmd = "ffmpeg -i $videoTemp -i $imagePath -filter_complex \"[1:v]scale=iw:-1[img];[0:v]pad=iw:ih+ih*0.25:0:ih*0.25[bg];[bg][img]overlay=0:0\" -c:a copy $outputPath";
    
    exec($cmd);


    header('Content-Type: video/mp4');
    readfile($outputPath);
    unlink($outputPath);
}
?>