const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const authMiddleware = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const DeepfakeDetector = require('../services/deepfakeDetector');
const detector = new DeepfakeDetector();
const axios = require('axios');
const { extractFrames } = require('../services/videoProcessor'); // Import the video processor

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
      comments_count: post.comments.length
    }));

    console.log('Transformed posts:', transformedPosts); // Add this for debugging
    res.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single post
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('creator', 'username')
      .populate('comments.user', 'username');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('Raw post from DB:', post); // Debug log

    // Transform data to match frontend expectations
    const transformedPost = {
      id: post._id,
      title: post.title,
      content: post.content,
      media_url: post.media_url,
      media_type: post.media_type,
      created_at: post.createdAt,
      analysis_status: post.analysis_status,
      deepfake_analysis: post.deepfake_analysis ? {
        frames_analysis: post.deepfake_analysis.frames_analysis.map(frame => ({
          frame: frame.frame,
          frame_path: frame.frame_path
        }))
      } : null,
      profiles: {
        username: post.creator.username
      }
    };

    console.log('Transformed post:', transformedPost); // Debug log
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

    // Create post first
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
          const frames = await extractFrames(uploadPath);
          
          // Update the post with frame analysis
          const updatedPost = await Post.findByIdAndUpdate(
            post._id,
            {
              $set: {
                deepfake_analysis: {
                  frames_analysis: frames
                },
                analysis_status: 'completed'
              }
            },
            { new: true }
          );
          
          console.log('Updated post in MongoDB:', updatedPost);
        } catch (error) {
          console.error('Error processing video:', error);
          await Post.findByIdAndUpdate(post._id, {
            $set: { analysis_status: 'failed' }
          });
        }
      }
    });

    // Respond immediately with the post
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
      deepfake_analysis: post.deepfake_analysis,
      profiles: {
        username: post.creator.username
      }
    }));

    res.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
