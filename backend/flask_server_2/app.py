from flask import Flask, request, jsonify, send_from_directory
import torch
from vit_pytorch import ViT
import cv2
import numpy as np
from torchvision import transforms
from PIL import Image
import os
from werkzeug.utils import secure_filename
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
# Enable CORS for all routes
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configure folders
UPLOAD_FOLDER = 'uploads'
FRAMES_FOLDER = 'frames'
MODEL_FOLDER = 'models'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FRAMES_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

# Global variable for model
model = None

def load_model():
    """Load the ViT model"""
    global model
    try:
        model = ViT(
            image_size=224,
            patch_size=32,
            num_classes=1,
            dim=1024,
            depth=6,
            heads=16,
            mlp_dim=2048,
            dropout=0.1,
            emb_dropout=0.1
        )
        
        weights_path = os.path.join(MODEL_FOLDER, "as_model_0.837.pt")
        if not os.path.exists(weights_path):
            raise FileNotFoundError(f"Model weights not found at {weights_path}")
            
        model.load_state_dict(torch.load(weights_path, map_location=torch.device('cpu')))
        model.eval()  # Set to evaluation mode
        print("Model loaded successfully")
        return True
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        return False

def preprocess_frame(frame):
    """Preprocess video frame for model input"""
    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(frame_rgb)
    return preprocess(pil_image)

def extract_frames(video_path, frames_dir):
    """Extract frames from video"""
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
            # Use the same URL structure as flask_server
            frame_url = f'/uploads/frames/{frames_dirname}/{os.path.basename(frame_path)}'
            frames.append({
                'frame': os.path.basename(frame_path),
                'frame_path': frame_url
            })
            print(f"Saved frame: {frame_path}")
            print(f"Frame URL path: {frame_url}")
        count += 1
        
    vidObj.release()
    return frames

def analyze_frame(frame_path, threshold=0.5):
    """Analyze a single frame using the ViT model"""
    global model
    try:
        if model is None:
            if not load_model():
                raise Exception("Model not loaded")

        # Read and preprocess frame
        frame = cv2.imread(frame_path)
        processed_frame = preprocess_frame(frame)
        
        # Get prediction
        with torch.no_grad():
            output = model(processed_frame.unsqueeze(0))
            confidence = float(torch.sigmoid(output).cpu().numpy()[0][0])
            is_fake = confidence < threshold
            
        print(f"Analyzed {frame_path}: confidence = {confidence}, is_fake = {is_fake}")
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

        # Create frames directory
        frames_dirname = f"frames_{os.path.splitext(filename)[0]}"
        frames_dir = os.path.join(FRAMES_FOLDER, frames_dirname)

        # Extract and analyze frames
        frames = extract_frames(video_path, frames_dir)
        frames_analysis = []
        total_confidence = 0

        for frame in frames:
            frame_path = os.path.join(frames_dir, frame['frame'])
            confidence, is_fake = analyze_frame(frame_path)
            total_confidence += confidence
            
            frames_analysis.append({
                'frame': frame['frame'],
                'frame_path': frame['frame_path'],
                'confidence': confidence,
                'is_fake': is_fake
            })

        # Calculate overall results
        num_frames = len(frames_analysis)
        if num_frames > 0:
            average_confidence = total_confidence / num_frames
            fake_frames = sum(1 for frame in frames_analysis if frame['is_fake'])
            real_frames = num_frames - fake_frames
            is_fake = fake_frames > real_frames

            result = {
                'frames_analysis': frames_analysis,
                'confidence': average_confidence,
                'is_fake': is_fake,
                'total_frames': num_frames,
                'fake_frames_count': fake_frames,
                'real_frames_count': real_frames
            }
            return jsonify(result)
        else:
            return jsonify({'error': 'No frames were analyzed'}), 500

    except Exception as e:
        print("Error during analysis:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/frames/<path:filename>')
def serve_frame(filename):
    """Serve frame images"""
    try:
        print(f"Serving frame: {filename}")
        frame_dir = os.path.dirname(filename)
        frame_name = os.path.basename(filename)
        frame_path = os.path.join(FRAMES_FOLDER, frame_dir)
        print(f"Full path: {os.path.join(frame_path, frame_name)}")
        return send_from_directory(frame_path, frame_name)
    except Exception as e:
        print(f"Error serving frame {filename}: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if load_model():
        print("Starting server with ViT model loaded")
        # Allow access from any host and enable debug mode
        app.run(host='0.0.0.0', port=5000, debug=True)
    else:
        print("Failed to load model. Please ensure the model file exists.")