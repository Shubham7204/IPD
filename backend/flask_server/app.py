from flask import Flask, request, jsonify, send_from_directory
import cv2
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
from werkzeug.utils import secure_filename
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
FRAMES_FOLDER = 'frames'
MODEL_FOLDER = 'models'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FRAMES_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

# Global variable for model
model = None

def load_model():
    """Load the deepfake detection model"""
    global model
    try:
        model_path = os.path.join(MODEL_FOLDER, 'deepfake_detection_model.h5')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
        
        print(f"Loading model from {model_path}")
        model = tf.keras.models.load_model(model_path, compile=False)
        print("Model loaded successfully")
        return True
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        return False

def extract_frames(video_path, frames_dir):
    if not os.path.exists(frames_dir):
        os.makedirs(frames_dir)
        print(f"Created frames directory: {frames_dir}")

    vidObj = cv2.VideoCapture(video_path)
    count = 0
    success = 1
    frames = []
    
    frames_dirname = os.path.basename(frames_dir)
    
    while success:
        success, image = vidObj.read()
        if not success:
            break
            
        frames_num = 20  # Save every 20th frame
        if count % frames_num == 0:
            frame_path = os.path.join(frames_dir, f"frame{count}.jpg")
            cv2.imwrite(frame_path, image)
            frame_url = f'/uploads/frames/{frames_dirname}/{os.path.basename(frame_path)}'
            frames.append({
                'frame': os.path.basename(frame_path),
                'frame_path': frame_url
            })
            print(f"Saved frame: {frame_path}")
            print(f"Frame URL path: {frame_url}")
        count += 1
        
    vidObj.release()
    print(f"Total frames extracted: {len(frames)}")
    return frames

def analyze_frame(frame_path):
    """Analyze a single frame using the model"""
    global model
    try:
        if model is None:
            if not load_model():
                raise Exception("Model not loaded")

        # Prepare image for model
        img = image.load_img(frame_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array /= 255.0

        # Get prediction
        confidence = float(model.predict(img_array, verbose=0)[0][0])
        # If confidence is high (>0.5), it's real; if low (<0.5), it's fake
        is_fake = confidence < 0.5  # This logic is correct
        
        print(f"Analyzed {frame_path}: confidence = {confidence}, is_fake = {is_fake}")
        
        # Validate confidence value
        if np.isnan(confidence):
            raise ValueError("Model returned NaN confidence")
            
        return confidence, is_fake
    except Exception as e:
        print(f"Error analyzing frame {frame_path}: {str(e)}")
        raise

@app.route('/analyze', methods=['POST'])
def analyze_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Ensure model is loaded
        if model is None and not load_model():
            return jsonify({'error': 'Failed to load model'}), 500

        # Save uploaded video
        filename = secure_filename(video_file.filename)
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        video_file.save(video_path)
        print(f"Saved video to: {video_path}")

        # Create frames directory
        frames_dirname = f"frames_{os.path.splitext(filename)[0]}"
        frames_dir = os.path.join(FRAMES_FOLDER, frames_dirname)
        print(f"Processing frames in: {frames_dir}")

        # Extract frames
        frames = extract_frames(video_path, frames_dir)

        # Analyze frames
        total_confidence = 0
        frames_analysis = []
        analysis_errors = 0

        for frame in frames:
            try:
                frame_path = os.path.join(frames_dir, frame['frame'])
                confidence, is_fake = analyze_frame(frame_path)
                total_confidence += confidence
                
                frames_analysis.append({
                    'frame': frame['frame'],
                    'frame_path': frame['frame_path'],
                    'confidence': confidence,
                    'is_fake': is_fake
                })
            except Exception as e:
                print(f"Error analyzing frame: {str(e)}")
                analysis_errors += 1

        # Calculate overall results
        num_frames = len(frames_analysis)
        if num_frames > 0:
            average_confidence = total_confidence / num_frames
            fake_frames = sum(1 for frame in frames_analysis if frame['is_fake'])
            real_frames = num_frames - fake_frames
            # If there are more fake frames than real frames, the video is fake
            is_fake = fake_frames > real_frames
            
            print(f"Total frames: {num_frames}")
            print(f"Fake frames: {fake_frames}")
            print(f"Real frames: {real_frames}")
            print(f"Average confidence: {average_confidence}")
            print(f"Video is_fake: {is_fake}")
        else:
            return jsonify({'error': 'No frames were successfully analyzed'}), 500

        result = {
            'frames_analysis': frames_analysis,
            'confidence': average_confidence,
            'is_fake': is_fake,
            'total_frames': num_frames,
            'analysis_errors': analysis_errors,
            'fake_frames_count': fake_frames,
            'real_frames_count': real_frames
        }

        print("Analysis result:", result)
        return jsonify(result)

    except Exception as e:
        print("Error during analysis:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/analyze-frames', methods=['POST'])
def analyze_frames_route():
    try:
        data = request.get_json()
        frames_dir = data.get('frames_dir')
        
        if not frames_dir:
            return jsonify({'error': 'No frames directory provided'}), 400
            
        full_frames_dir = os.path.join(FRAMES_FOLDER, frames_dir)
        if not os.path.exists(full_frames_dir):
            return jsonify({'error': 'Frames directory not found'}), 404
            
        total_confidence = 0
        frames_analysis = []
        
        # Analyze each frame in the directory
        for frame_name in sorted(os.listdir(full_frames_dir)):
            if frame_name.endswith('.jpg'):
                frame_path = os.path.join(full_frames_dir, frame_name)
                confidence, is_fake = analyze_frame(frame_path)
                total_confidence += confidence
                
                frame_url = f'/uploads/frames/{frames_dir}/{frame_name}'
                frames_analysis.append({
                    'frame': frame_name,
                    'frame_path': frame_url,
                    'confidence': confidence,
                    'is_fake': is_fake
                })
        
        # Calculate overall results
        num_frames = len(frames_analysis)
        if num_frames > 0:
            average_confidence = total_confidence / num_frames
            fake_frames = sum(1 for frame in frames_analysis if frame['is_fake'])
            real_frames = num_frames - fake_frames
            # If there are more fake frames than real frames, the video is fake
            is_fake = fake_frames > real_frames
        else:
            average_confidence = 0
            is_fake = False
        
        result = {
            'frames_analysis': frames_analysis,
            'confidence': average_confidence,
            'is_fake': is_fake,
            'total_frames': num_frames,
            'fake_frames_count': fake_frames,
            'real_frames_count': real_frames
        }
        
        print(f"Analysis complete: {num_frames} frames analyzed")
        print(f"Overall result: confidence = {average_confidence}, is_fake = {is_fake}")
        return jsonify(result)
        
    except Exception as e:
        print("Error during analysis:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/frames/<path:filename>')
def serve_frame(filename):
    print(f"Serving frame: {filename}")
    frame_dir = os.path.dirname(filename)
    frame_name = os.path.basename(filename)
    frame_path = os.path.join(FRAMES_FOLDER, frame_dir)
    print(f"Full path: {os.path.join(frame_path, frame_name)}")
    return send_from_directory(frame_path, frame_name)

# Load model when starting the server
if __name__ == '__main__':
    if load_model():
        print("Starting server with model loaded")
        app.run(port=5000)
    else:
        print("Failed to load model. Please ensure the model file exists.") 