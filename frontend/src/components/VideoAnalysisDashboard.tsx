import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

interface Frame {
  frame: string;
  confidence: number;
  is_fake: boolean;
  frame_path: string;
}

interface Post {
  id: string;
  title: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  analysis_status: string;
  deepfake_analysis?: {
    is_fake: boolean;
    confidence: number;
    frames_analysis: Frame[];
  };
}

const API_URL = 'http://localhost:3000';

export default function VideoAnalysisDashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserPosts() {
      try {
        const response = await fetch(`${API_URL}/api/posts/user/posts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setPosts(data.filter(post => post.media_type === 'video'));
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserPosts();
  }, []);

  if (loading) {
    return <div>Loading your video analyses...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Your Video Analyses</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <video 
              src={post.media_url.startsWith('http') ? post.media_url : `${API_URL}${post.media_url}`}
              className="w-full h-48 object-cover"
              controls
            />
            
            <div className="p-4">
              <h3 className="font-semibold mb-2">{post.title}</h3>
              
              {post.analysis_status === 'processing' ? (
                <div className="bg-yellow-100 text-yellow-700 p-2 rounded">
                  🔄 Analysis in progress...
                </div>
              ) : post.analysis_status === 'failed' ? (
                <div className="bg-red-100 text-red-700 p-2 rounded">
                  ❌ Analysis failed
                </div>
              ) : post.deepfake_analysis && (
                <>
                  <div className={`p-2 rounded mb-2 ${
                    post.deepfake_analysis.is_fake 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {post.deepfake_analysis.is_fake 
                      ? '⚠️ Potential Deepfake Detected' 
                      : '✅ No Deepfake Detected'}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    Confidence: {(post.deepfake_analysis.confidence * 100).toFixed(2)}%
                  </div>
                  
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  >
                    View Frame Analysis
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Frame Analysis Modal */}
      {selectedPost?.deepfake_analysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4">Frame-by-Frame Analysis</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedPost.deepfake_analysis.frames_analysis.map((frame, index) => (
                <div key={index} className="border rounded p-2">
                  <img 
                    src={frame.frame_path.startsWith('http') 
                      ? frame.frame_path 
                      : `${API_URL}${frame.frame_path}`
                    }
                    alt={`Frame ${index + 1}`}
                    className="w-full h-32 object-cover mb-2"
                  />
                  <div className={`text-sm ${
                    frame.is_fake ? 'text-red-600' : 'text-green-600'
                  }`}>
                    Confidence: {(frame.confidence * 100).toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedPost(null)}
              className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
} 