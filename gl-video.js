
function setupVideo(url, copyVideo) {
    const video = document.createElement('video');

    var playing = false;
    var timeupdate = false;

    video.autoplay = true;
    video.muted = true;
    video.loop = true;

    // Waiting for these 2 events ensures
    // there is data in the video

    video.addEventListener('playing', function() {
        playing = true;
        checkReady();
    }, true);

    video.addEventListener('timeupdate', function() {
        timeupdate = true;
        checkReady();
    }, true);

    video.src = url;
    video.play();

    function checkReady() {
        if (playing && timeupdate) {
            copyVideo = true;
        }
    }

    return video;
}
