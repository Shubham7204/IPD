import streamlit as st
import torch
from vit_pytorch import ViT
import cv2
import numpy as np
from torchvision import transforms
from PIL import Image
import plotly.graph_objects as go
import tempfile
import os
from tqdm import tqdm
from datetime import datetime

# Set page configuration
st.set_page_config(
    page_title="Deepfake Detection System",
    page_icon="🎥",
    layout="wide"
)

# Custom CSS to improve the appearance
st.markdown("""
    <style>
    .main {
        padding: 2rem;
    }
    .stAlert {
        padding: 1rem;
        margin: 1rem 0;
    }
    .verdict-box {
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        text-align: center;
    }
    .deepfake {
        background-color: #ffebee;
        color: #c62828;
    }
    .authentic {
        background-color: #e8f5e9;
        color: #2e7d32;
    }
    </style>
""", unsafe_allow_html=True)

@st.cache_resource
def load_model():
    """Load the ViT model with caching"""
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
    
    # Load pre-trained weights
    weights_path = "as_model_0.837.pt"  # Update this path
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=torch.device('cpu')))
    else:
        st.error(f"Weights file not found at {weights_path}")
        return None
    
    return model

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

def create_output_directory():
    """Create a directory to store output frames"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"output_frames_{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    return output_dir

def process_video(video_path, model, progress_bar, threshold=0.5):
    """Process video frames and return predictions"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Error opening video file")
    
    # Create output directory for frames
    output_dir = create_output_directory()
    saved_frames = []
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    predictions = []
    scores = []
    frames_processed = 0
    
    model.eval()
    with torch.no_grad():
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Sample every 20th frame
            if frames_processed % 20 == 0:
                processed_frame = preprocess_frame(frame)
                output = model(processed_frame.unsqueeze(0))
                
                # Debug: Check raw output before sigmoid
                raw_output = output.cpu().numpy()[0][0]
                score = torch.sigmoid(output).cpu().numpy()[0][0]
                pred = 1 if score < threshold else 0
                
                # Save frame with prediction overlay
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                text = "DEEPFAKE" if pred == 1 else "AUTHENTIC"
                color = (255, 0, 0) if pred == 1 else (0, 255, 0)
                
                # Add text overlay
                frame_with_text = frame_rgb.copy()
                cv2.putText(
                    frame_with_text,
                    f"{text} (Score: {score:.2f})",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    color,
                    2
                )
                
                # Save frame
                frame_path = os.path.join(output_dir, f"frame_{frames_processed:04d}_{text.lower()}.jpg")
                cv2.imwrite(frame_path, cv2.cvtColor(frame_with_text, cv2.COLOR_RGB2BGR))
                saved_frames.append({
                    'path': frame_path,
                    'frame_number': frames_processed,
                    'prediction': text,
                    'score': score
                })
                
                predictions.append(pred)
                scores.append(score)
                
                # Debug print
                st.write(f"Frame {frames_processed}: Raw output: {raw_output:.4f}, Score: {score:.4f}, Prediction: {pred}")
            
            frames_processed += 1
            progress_bar.progress(frames_processed / total_frames)
    
    cap.release()
    return predictions, scores, fps, saved_frames

def create_prediction_plot(scores, fps):
    """Create interactive plot using plotly"""
    time_points = [i/fps for i in range(len(scores))]
    
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=time_points,
        y=scores,
        mode='lines',
        name='Confidence Score'
    ))
    
    fig.add_hline(
        y=0.5,
        line_dash="dash",
        line_color="red",
        annotation_text="Decision Threshold"
    )
    
    fig.update_layout(
        title="Deepfake Detection Confidence Over Time",
        xaxis_title="Time (seconds)",
        yaxis_title="Confidence Score",
        hovermode='x'
    )
    
    return fig

def display_frames_gallery(saved_frames):
    """Display saved frames in a gallery format"""
    st.subheader("Analyzed Frames")
    
    # Add gallery controls
    st.sidebar.subheader("Gallery Controls")
    frames_per_row = st.sidebar.slider("Frames per row", 1, 5, 3)
    show_only = st.sidebar.multiselect(
        "Filter predictions",
        options=["DEEPFAKE", "AUTHENTIC"],
        default=["DEEPFAKE", "AUTHENTIC"]
    )
    
    # Filter frames based on selection
    filtered_frames = [f for f in saved_frames if f['prediction'] in show_only]
    
    # Create expandable section for full gallery
    with st.expander("View Analyzed Frames", expanded=True):
        # Create columns for the gallery
        cols = st.columns(frames_per_row)
        
        # Display frames in columns
        for idx, frame_info in enumerate(filtered_frames):
            col = cols[idx % frames_per_row]
            with col:
                # Create a container for each frame
                with st.container():
                    # Display the image
                    st.image(
                        frame_info['path'],
                        use_column_width=True
                    )
                    
                    # Add colored label based on prediction
                    if frame_info['prediction'] == "DEEPFAKE":
                        label_color = "#ffebee"
                        text_color = "#c62828"
                    else:
                        label_color = "#e8f5e9"
                        text_color = "#2e7d32"
                    
                    st.markdown(
                        f"""
                        <div style="
                            background-color: {label_color};
                            color: {text_color};
                            padding: 8px;
                            border-radius: 5px;
                            margin: 2px 0;
                            text-align: center;
                            font-weight: bold;
                        ">
                            {frame_info['prediction']}
                        </div>
                        <div style="
                            font-size: 0.9em;
                            text-align: center;
                            margin: 5px 0;
                        ">
                            Frame {frame_info['frame_number']}
                            <br>
                            Score: {frame_info['score']:.2f}
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
    
    # Add download button for frames
    if st.button("Download Analyzed Frames"):
        # Create a zip file containing all frames
        import zipfile
        import io
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zip_file:
            for frame_info in filtered_frames:
                zip_file.write(
                    frame_info['path'],
                    arcname=os.path.basename(frame_info['path'])
                )
        
        # Create download button
        st.download_button(
            label="Download Frames ZIP",
            data=zip_buffer.getvalue(),
            file_name="analyzed_frames.zip",
            mime="application/zip"
        )

def main():
    st.title("🎥 Deepfake Detection System")
    
    # Sidebar
    st.sidebar.header("Settings")
    confidence_threshold = st.sidebar.slider(
        "Detection Threshold",
        min_value=0.0,
        max_value=1.0,
        value=0.75,  # Changed default threshold
        help="Adjust the threshold for deepfake detection (higher = more conservative)"
    )
    
    # Load model
    try:
        with st.spinner("Loading model..."):
            model = load_model()
        if model is None:
            st.error("Failed to load model. Please check the weights file.")
            return
        st.success("Model loaded successfully!")
    except Exception as e:
        st.error(f"Error loading model: {str(e)}")
        return
    
    # File uploader
    uploaded_file = st.file_uploader(
        "Upload a video file",
        type=['mp4', 'avi', 'mov'],
        help="Upload a video file to analyze for deepfake detection"
    )
    
    if uploaded_file is not None:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            tmp_file.write(uploaded_file.read())
            video_path = tmp_file.name
        
        try:
            # Create columns for results
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("Processing Video")
                progress_bar = st.progress(0)
                predictions, scores, fps, saved_frames = process_video(
                    video_path, model, progress_bar, confidence_threshold
                )
                
                # Calculate statistics
                total_frames = len(predictions)
                positive_predictions = sum(predictions)
                
                # IMPORTANT FIX: Changed to use threshold percentage
                threshold_percentage = confidence_threshold * 100
                deepfake_percentage = (positive_predictions/total_frames*100)
                avg_confidence = np.mean(scores) * 100
                
                # Display verdict
                if deepfake_percentage > 50:
                    st.markdown("""
                        <div class="verdict-box deepfake">
                            <h2>⚠️ DEEPFAKE DETECTED</h2>
                            <p>This video is likely manipulated</p>
                        </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown("""
                        <div class="verdict-box authentic">
                            <h2>✅ AUTHENTIC VIDEO</h2>
                            <p>This video appears to be genuine</p>
                        </div>
                    """, unsafe_allow_html=True)
            
            with col2:
                st.subheader("Detection Statistics")
                st.metric("Frames Analyzed", total_frames)
                st.metric("Deepfake Confidence", f"{deepfake_percentage:.1f}%")
                st.metric("Average Score", f"{avg_confidence:.1f}%")
            
            # Show prediction plot
            st.subheader("Analysis Over Time")
            fig = create_prediction_plot(scores, fps)
            st.plotly_chart(fig, use_container_width=True)
            
            # Additional information
            with st.expander("Detailed Analysis"):
                st.write(f"- Total frames analyzed: {total_frames}")
                st.write(f"- Frames classified as deepfake: {positive_predictions}")
                st.write(f"- Frames classified as authentic: {total_frames - positive_predictions}")
                st.write(f"- Video FPS: {fps:.2f}")
            
            # Display frames gallery after the statistics
            display_frames_gallery(saved_frames)
            
        except Exception as e:
            st.error(f"Error processing video: {str(e)}")
        
        finally:
            # Cleanup temporary file
            os.unlink(video_path)
            # Cleanup saved frames
            for frame_info in saved_frames:
                try:
                    os.unlink(frame_info['path'])
                except:
                    pass
            try:
                os.rmdir(os.path.dirname(saved_frames[0]['path']))
            except:
                pass
    
    # Footer
    st.markdown("---")
    st.markdown("Deepfake Detection System powered by Vision Transformer (ViT)")

if __name__ == "__main__":
    main()