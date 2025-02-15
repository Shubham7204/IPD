const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const authMiddleware = require('../middleware/auth');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const DeepfakeDetector = require('../services/deepfakeDetector');
const detector = new DeepfakeDetector();
const axios = require('axios');
const OldModelAnalysis = require('../models/OldModelAnalysis');

// Configure file upload middleware with file size limit
router.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  abortOnLimit: true
}));

// Get all posts
router.get('/', async (req, res) => {
  try {
    console.log('Fetching posts...'); // Add this for debugging
    const posts = await Post.find()
      .populate('creator', 'username')
      .populate('comments.user', 'username')
      .sort('-createdAt');

    console.log('Found posts:', posts); // Add this for debugging

    const transformedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      media_type: post.media_type,
      created_at: post.createdAt,
      profiles: {
        username: post.creator.username
      },
      likes_count: post.likes.length,
      comments_count: post.comments.length,
      analysis_status: post.analysis_status,
      deepfake_analysis: post.deepfake_analysis ? {
        is_fake: post.deepfake_analysis.is_fake,
        confidence: post.deepfake_analysis.confidence,
        frames_analysis: post.deepfake_analysis.frames_analysis,
        summary: post.deepfake_analysis.summary
      } : null
    }));

    console.log('Transformed posts:', transformedPosts); // Add this for debugging
    res.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single post
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('creator', 'username');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const transformedPost = {
      id: post._id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      media_type: post.media_type,
      created_at: post.createdAt,
      analysis_status: post.analysis_status,
      deepfake_analysis: post.deepfake_analysis ? {
        is_fake: post.deepfake_analysis.is_fake,
        confidence: post.deepfake_analysis.confidence,
        frames_analysis: post.deepfake_analysis.frames_analysis,
        summary: post.deepfake_analysis.summary
      } : null,
      profiles: {
        username: post.creator.username
      }
    };

    res.json(transformedPost);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create post
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (!req.files || (!req.files.image && !req.files.video)) {
      return res.status(400).json({ message: 'No media file uploaded' });
    }

    const mediaFile = req.files.image || req.files.video;
    const mediaType = req.files.image ? 'image' : 'video';

    // Check file type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    const allowedTypes = mediaType === 'image' ? allowedImageTypes : allowedVideoTypes;

    if (!allowedTypes.includes(mediaFile.mimetype)) {
      return res.status(400).json({ 
        message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` 
      });
    }

    const fileExt = path.extname(mediaFile.name);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    const uploadPath = path.join(__dirname, '../uploads', fileName);

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)){
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Create post
    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      media_url: `/uploads/${fileName}`,
      media_type: mediaType,
      creator: req.user.id,
      analysis_status: mediaType === 'video' ? 'processing' : 'none'
    });

    await post.save();

    // Move the file and process video asynchronously
    mediaFile.mv(uploadPath, async (err) => {
      if (err) {
        console.error('Error saving media:', err);
        post.analysis_status = 'failed';
        await post.save();
        return;
      }

      if (mediaType === 'video') {
        console.log('Processing video:', uploadPath);
        
        try {
          const analysisResult = await detector.analyze_video(uploadPath);
          console.log('Analysis result:', analysisResult);

          // Calculate summary
          const totalFrames = analysisResult.frames_analysis.length;
          const fakeFrames = analysisResult.frames_analysis.filter(frame => frame.is_fake).length;
          const realFrames = totalFrames - fakeFrames;
          const averageConfidence = analysisResult.frames_analysis.reduce((sum, frame) => sum + frame.confidence, 0) / totalFrames;
          const confidencePercentage = Math.round((1 - averageConfidence) * 100);
          const isFake = fakeFrames > realFrames;

          const summary = {
            status: isFake ? "FAKE" : "REAL",
            confidence_percentage: confidencePercentage,
            total_frames: totalFrames,
            real_frames: realFrames,
            fake_frames: fakeFrames
          };

          const updatedPost = await Post.findByIdAndUpdate(
            post._id,
            {
              $set: {
                deepfake_analysis: {
                  frames_analysis: analysisResult.frames_analysis,
                  confidence: averageConfidence,
                  is_fake: isFake,
                  summary: summary
                },
                analysis_status: 'completed'
              }
            },
            { new: true }
          );
          
          console.log('Updated post with analysis:', updatedPost);
        } catch (error) {
          console.error('Error processing video:', error);
          await Post.findByIdAndUpdate(post._id, {
            $set: { analysis_status: 'failed' }
          });
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const newComment = {
      user: req.user.id,
      content: req.body.content,
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();
    
    // Populate the user information
    await post.populate('comments.user', 'username');
    
    const addedComment = post.comments[post.comments.length - 1];
    
    // Transform the comment to match frontend expectations
    const transformedComment = {
      id: addedComment._id,
      content: addedComment.content,
      created_at: addedComment.createdAt,
      profiles: {
        username: addedComment.user.username
      }
    };

    res.json(transformedComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Toggle like
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user.id);
    if (likeIndex === -1) {
      post.likes.push(req.user.id);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();
    res.json({ likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's posts
router.get('/user/posts', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({ creator: req.user.id })
      .populate('creator', 'username')
      .sort('-createdAt');

    const transformedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      media_type: post.media_type,
      created_at: post.createdAt,
      analysis_status: post.analysis_status,
      deepfake_analysis: post.deepfake_analysis ? {
        is_fake: post.deepfake_analysis.is_fake,
        confidence: post.deepfake_analysis.confidence,
        frames_analysis: post.deepfake_analysis.frames_analysis
      } : null,
      profiles: {
        username: post.creator.username
      }
    }));

    console.log('Transformed posts with frames:', transformedPosts); // Debug log
    res.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a new route for analyzing frames
router.post('/analyze/:postId', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get frames directory name from the post
    const videoFileName = path.basename(post.media_url);
    const framesDir = `frames_${path.parse(videoFileName).name}`;

    // Call Flask server to analyze frames
    const response = await axios.post('http://localhost:5000/analyze-frames', {
      frames_dir: framesDir
    });

    // Calculate summary with corrected confidence
    const totalFrames = response.data.total_frames;
    const fakeFrames = response.data.fake_frames_count;
    const realFrames = response.data.real_frames_count;
    
    // Calculate confidence based on the ratio of fake frames
    const confidencePercentage = Math.round((fakeFrames / totalFrames) * 100);

    const summary = {
      status: response.data.is_fake ? "FAKE" : "REAL",
      confidence_percentage: confidencePercentage,
      total_frames: totalFrames,
      real_frames: realFrames,
      fake_frames: fakeFrames
    };

    // Update post with analysis results and summary
    const updatedPost = await Post.findByIdAndUpdate(
      post._id,
      {
        $set: {
          deepfake_analysis: {
            frames_analysis: response.data.frames_analysis,
            confidence: response.data.confidence,
            is_fake: response.data.is_fake,
            summary: summary
          },
          analysis_status: 'completed'
        }
      },
      { new: true }
    );

    res.json(updatedPost);
  } catch (error) {
    console.error('Error analyzing frames:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add this new route
router.post('/analyze-old-model/:postId', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if analysis already exists
    let oldAnalysis = await OldModelAnalysis.findOne({ post_id: post._id });
    if (oldAnalysis) {
      return res.json(oldAnalysis);
    }

    // Get video path and frames directory name
    const videoFileName = path.basename(post.media_url);
    const videoPath = path.join(__dirname, '..', 'uploads', videoFileName);
    const framesDir = `frames_${path.parse(videoFileName).name.replace(/[\\\/]/g, '')}`;

    console.log('Video path:', videoPath);
    console.log('Frames directory:', framesDir);

    try {
      // First, extract frames using flask_server_2
      const extractResponse = await axios.post('http://localhost:5000/extract-frames', {
        video_path: videoPath,
        frames_dir: framesDir
      });

      if (!extractResponse.data.success) {
        throw new Error('Failed to extract frames');
      }

      // Now call old model Flask server (on port 5001) for analysis
      const response = await axios.post('http://localhost:5001/analyze-frames', {
        frames_dir: framesDir
      });

      console.log('Flask server response:', response.data);

      if (!response.data || !response.data.frames_analysis) {
        throw new Error('Invalid response from Flask server');
      }

      // Calculate summary
      const totalFrames = response.data.total_frames || 0;
      const fakeFrames = response.data.fake_frames_count || 0;
      const realFrames = response.data.real_frames_count || 0;
      const confidencePercentage = Math.round((fakeFrames / totalFrames) * 100);

      const summary = {
        status: response.data.is_fake ? "FAKE" : "REAL",
        confidence_percentage: confidencePercentage,
        total_frames: totalFrames,
        real_frames: realFrames,
        fake_frames: fakeFrames
      };

      // Save old model analysis
      oldAnalysis = await OldModelAnalysis.create({
        post_id: post._id,
        frames_analysis: response.data.frames_analysis,
        confidence: response.data.confidence,
        is_fake: response.data.is_fake,
        summary: summary
      });

      return res.json(oldAnalysis);

    } catch (flaskError) {
      console.error('Flask server error:', flaskError);
      return res.status(500).json({ 
        message: 'Flask server error', 
        details: flaskError.message,
        frames_dir: framesDir 
      });
    }

  } catch (error) {
    console.error('Error in analyze-old-model:', error);
    res.status(500).json({ 
      message: 'Server error', 
      details: error.message 
    });
  }
});

// Add a route to get old model analysis
router.get('/old-model-analysis/:postId', authMiddleware, async (req, res) => {
  try {
    const analysis = await OldModelAnalysis.findOne({ post_id: req.params.postId });
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }
    res.json(analysis);
  } catch (error) {
    console.error('Error fetching old model analysis:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
