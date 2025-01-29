const { PythonShell } = require('python-shell');
const path = require('path');

class DeepfakeDetector {
  async analyze_video(videoPath) {
    return new Promise((resolve, reject) => {
      const options = {
        scriptPath: path.join(__dirname),
        args: [videoPath],
        pythonPath: 'python'  // or 'python3' depending on your system
      };

      PythonShell.run('deepfake_detector.py', options, function (err, results) {
        if (err) {
          console.error('Error running python script:', err);
          reject(err);
          return;
        }
        
        try {
          const analysis = JSON.parse(results[results.length - 1]);
          console.log('Python script output:', analysis); // Debug log
          resolve(analysis);
        } catch (error) {
          console.error('Error parsing python output:', error);
          reject(error);
        }
      });
    });
  }
}

module.exports = DeepfakeDetector; 