import cv2
import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image

class DeepfakeDetector:
    def __init__(self):
        self.model = tf.keras.models.load_model('models/deepfake_detection_model.h5', compile=False)

    def FrameCapture(self, path, frames_dir):
        # Create frames directory if it doesn't exist
        if not os.path.exists(frames_dir):
            os.makedirs(frames_dir)

        vidObj = cv2.VideoCapture(path)
        count = 0
        success = 1
        frames = []
        
        while success:
            success, image = vidObj.read()
            if not success:
                break
                
            # Save frames with 'frame' prefix and count as multiples of 20
            frames_num = 20
            if count % frames_num == 0:
                frame_path = os.path.join(frames_dir, f"frame{count}.jpg")
                cv2.imwrite(frame_path, image)
                frames.append(frame_path)
            count += 1
            
        vidObj.release()
        return frames

    def evaluate_frames(self, frames):
        total_confidence = 0
        results = []
        
        for frame_path in frames:
            img = image.load_img(frame_path, target_size=(224, 224))
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array /= 255.0
            
            confidence = float(self.model.predict(img_array, verbose=0)[0][0])
            total_confidence += confidence
            
            results.append({
                'frame': os.path.basename(frame_path),
                'confidence': confidence,
                'is_fake': confidence >= 0.5,
                'frame_path': frame_path
            })
            
        average_confidence = total_confidence / len(frames) if frames else 0
        return results, average_confidence

    def analyze_video(self, video_path):
        try:
            print(f"Processing video: {video_path}")  # Debug log
            video_filename = os.path.basename(video_path)
            frames_dirname = f"frames_{video_filename}"
            
            # Create frames directory in backend/uploads
            frames_dir = os.path.join(os.path.dirname(os.path.dirname(video_path)), 'uploads', frames_dirname)
            print(f"Frames will be saved to: {frames_dir}")  # Debug log
            
            # Create frames directory if it doesn't exist
            if not os.path.exists(frames_dir):
                os.makedirs(frames_dir)
                print(f"Created directory: {frames_dir}")  # Debug log
            
            # Extract frames
            frames = self.FrameCapture(video_path, frames_dir)
            print(f"Extracted {len(frames)} frames")  # Debug log
            
            # Create frame results with correct URLs
            frame_results = []
            for frame_path in frames:
                relative_path = f'/uploads/{frames_dirname}/{os.path.basename(frame_path)}'
                print(f"Frame path: {frame_path}")  # Debug log
                print(f"Relative path: {relative_path}")  # Debug log
                frame_results.append({
                    'frame': os.path.basename(frame_path),
                    'frame_path': relative_path
                })
            
            result = {
                'frames': frame_results,
                'frames_dir': f'/uploads/{frames_dirname}'
            }
            print(f"Returning result: {json.dumps(result)}")  # Debug log
            return result
            
        except Exception as e:
            print(f"Error in analyze_video: {str(e)}")
            raise e

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No video path provided"}))
        sys.exit(1)

    video_path = sys.argv[1]
    detector = DeepfakeDetector()
    
    try:
        result = detector.analyze_video(video_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)})) 