const { extractFrames } = require('./services/videoProcessor');
const path = require('path');

// Replace this with the path to your test video
const videoPath = path.join(__dirname, 'uploads', 'your-video.mp4');

console.log('Testing frame extraction...');
console.log('Video path:', videoPath);

extractFrames(videoPath)
    .then(frames => {
        console.log('Successfully extracted frames:', frames);
    })
    .catch(err => {
        console.error('Failed to extract frames:', err);
    }); 