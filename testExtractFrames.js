const { extractFrames } = require('./backend/services/videoProcessor');

const videoPath = './path/to/your/video.mp4'; // Update this path
extractFrames(videoPath)
    .then(frames => {
        console.log('Extracted frames:', frames);
    })
    .catch(err => {
        console.error('Error:', err);
    }); 