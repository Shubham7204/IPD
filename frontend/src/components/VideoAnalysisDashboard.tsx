import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Frame {
  frame: string;
  frame_path: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  analysis_status: string;
  deepfake_analysis?: {
    frames_analysis: Frame[];
  };
}

const API_URL = 'http://localhost:3000';

export default function VideoAnalysisDashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function fetchUserPosts() {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/api/posts/user/posts`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        console.log('Fetched posts:', data);
        setPosts(data.filter(post => post.media_type === 'video'));
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUserPosts();
  }, []);

  const handleOpenModal = (post: Post) => {
    setSelectedPost(post);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTimeout(() => setSelectedPost(null), 200); // Clear selected post after animation
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Video Frames</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-lg shadow p-4">
            <video 
              src={`${API_URL}${post.media_url}`}
              className="w-full h-48 object-cover mb-4"
              controls
            />
            <h3 className="font-semibold mb-2">{post.title}</h3>
            
            {post.analysis_status === 'processing' ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                <span>Processing...</span>
              </div>
            ) : post.analysis_status === 'completed' && post.deepfake_analysis ? (
              <button
                onClick={() => handleOpenModal(post)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                View Frames ({post.deepfake_analysis.frames_analysis.length})
              </button>
            ) : (
              <div className="text-gray-500">No frames available</div>
            )}
          </div>
        ))}
      </div>

      {/* Frames Modal */}
      <AnimatePresence>
        {showModal && selectedPost?.deepfake_analysis && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />
            <div className="flex items-center justify-center min-h-screen p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
              >
                <div className="sticky top-0 bg-white pb-4 mb-4 border-b flex justify-between items-center">
                  <h3 className="text-xl font-bold">Extracted Frames</h3>
                  <button 
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedPost.deepfake_analysis.frames_analysis.map((frame, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200"
                    >
                      <div className="relative pt-[75%]">
                        <img 
                          src={`${API_URL}${frame.frame_path}`}
                          alt={`Frame ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => console.error(`Error loading frame: ${API_URL}${frame.frame_path}`)}
                        />
                      </div>
                      <div className="p-2 text-center text-sm text-gray-600">
                        Frame {index + 1}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 