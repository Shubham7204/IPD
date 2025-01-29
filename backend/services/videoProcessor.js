const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const UPLOAD_FOLDER = path.join(__dirname, '../uploads');

async function extractFrames(videoPath) {
    return new Promise((resolve, reject) => {
        // Generate a unique folder name for frames
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const videoBaseName = path.basename(videoPath, path.extname(videoPath));
        const framesDir = path.join(UPLOAD_FOLDER, `frames_${videoBaseName}_${timestamp}_${randomString}`);
        
        // Create frames directory if it doesn't exist
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
            console.log(`Created frames directory: ${framesDir}`);
        }

        console.log(`Starting frame extraction from: ${videoPath}`);
        console.log(`Saving frames to: ${framesDir}`);

        // Get video duration first
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('Error getting video metadata:', err);
                return reject(err);
            }

            const duration = metadata.format.duration;
            const frameCount = Math.min(20, Math.max(10, Math.floor(duration))); // Extract 1 frame per second, min 10, max 20 frames

            ffmpeg(videoPath)
                .screenshots({
                    count: frameCount,
                    folder: framesDir,
                    filename: 'frame-%d.jpg',
                    size: '640x480' // Increased resolution
                })
                .on('end', async () => {
                    try {
                        console.log('Frames extracted successfully');
                        
                        // Read and sort the frames
                        const frameFiles = fs.readdirSync(framesDir)
                            .filter(file => file.endsWith('.jpg'))
                            .sort((a, b) => {
                                const aNum = parseInt(a.match(/\d+/)[0]);
                                const bNum = parseInt(b.match(/\d+/)[0]);
                                return aNum - bNum;
                            })
                            .map(file => ({
                                frame: file,
                                frame_path: `/uploads/${path.basename(framesDir)}/${file}`
                            }));

                        console.log(`Successfully processed ${frameFiles.length} frames`);
                        resolve(frameFiles);
                    } catch (error) {
                        console.error('Error processing extracted frames:', error);
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    console.error('Error extracting frames:', err);
                    reject(err);
                });
        });
    });
}

module.exports = { extractFrames };