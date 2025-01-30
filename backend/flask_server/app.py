from flask import Flask, request, jsonify, send_from_directory
import cv2
import os
from werkzeug.utils import secure_filename
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
FRAMES_FOLDER = 'frames'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FRAMES_FOLDER, exist_ok=True)

def extract_frames(video_path, frames_dir):
    if not os.path.exists(frames_dir):
        os.makedirs(frames_dir)
        print(f"Created frames directory: {frames_dir}")

    vidObj = cv2.VideoCapture(video_path)
    count = 0
    success = 1
    frames = []
    
    # Get the frames directory name (the last part of the path)
    frames_dirname = os.path.basename(frames_dir)
    
    while success:
        success, image = vidObj.read()
        if not success:
            break
            
        frames_num = 20  # Save every 20th frame
        if count % frames_num == 0:
            frame_path = os.path.join(frames_dir, f"frame{count}.jpg")
            cv2.imwrite(frame_path, image)
            # Generate URL for MongoDB/Node.js server
            frame_url = f'/uploads/frames/{frames_dirname}/{os.path.basename(frame_path)}'
            frames.append({
                'frame': os.path.basename(frame_path),
                'frame_path': frame_url  # This will be served by Node.js
            })
            print(f"Saved frame: {frame_path}")
            print(f"Frame URL path: {frame_url}")
        count += 1
        
    vidObj.release()
    print(f"Total frames extracted: {len(frames)}")
    return frames

@app.route('/analyze', methods=['POST'])
def analyze_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Save uploaded video
        filename = secure_filename(video_file.filename)
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        video_file.save(video_path)
        print(f"Saved video to: {video_path}")

        # Create frames directory
        frames_dirname = f"frames_{os.path.splitext(filename)[0]}"
        frames_dir = os.path.join(FRAMES_FOLDER, frames_dirname)
        print(f"Frames will be saved to: {frames_dir}")

        # Extract frames
        frames = extract_frames(video_path, frames_dir)

        result = {
            'frames_analysis': frames
        }

        print("Analysis result:", result)
        return jsonify(result)

    except Exception as e:
        print("Error during analysis:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/frames/<path:filename>')
def serve_frame(filename):
    print(f"Serving frame: {filename}")
    # Split the path into directory and filename
    frame_dir = os.path.dirname(filename)
    frame_name = os.path.basename(filename)
    
    # Construct the full path to the frame
    frame_path = os.path.join(FRAMES_FOLDER, frame_dir)
    print(f"Looking for frame in: {frame_path}")
    
    return send_from_directory(frame_path, frame_name)

if __name__ == '__main__':
    app.run(port=5000) 