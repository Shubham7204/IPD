import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Sparkles, Plus } from 'lucide-react';
import { motion } from "framer-motion";
import { api } from '../lib/api';

interface Post {
  id: string;
  title: string;
  content: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  profiles: {
    username: string;
  };
  likes_count: number;
  comments_count: number;
  analysis_status: string;
  deepfake_analysis?: {
    is_fake: boolean;
    confidence: number;
    frames_analysis: {
      frame: string;
      confidence: number;
      is_fake: boolean;
      frame_path: string;
    }[];
    summary?: {
      status: string;
      confidence_percentage: number;
      total_frames: number;
      real_frames: number;
      fake_frames: number;
    };
  };
}

const API_URL = 'http://localhost:3000';

const PostCard: React.FC<{ post: Post; index: number }> = ({ post, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const mediaUrl = post.media_url.startsWith('http') 
    ? post.media_url 
    : `${API_URL}${post.media_url}`;

  return (
    <Link to={`/posts/${post.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="bg-white border-b-2 border-[#151616]/10 hover:bg-gray-50 transition-colors duration-200"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-4">
            {/* User Avatar */}
            <div className="w-12 h-12 bg-[#D6F32F] rounded-full border-2 border-[#151616] flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-[#151616]">
                {post.profiles.username[0].toUpperCase()}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* User Info & Date */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-[#151616]">@{post.profiles.username}</h3>
                <span className="text-sm text-[#151616]/50">·</span>
                <span className="text-sm text-[#151616]/50">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[#151616] mb-2">{post.title}</h2>
              <p className="text-[#151616]/70 mb-4">{post.content}</p>

              {/* Media */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#151616]">
                {post.media_type === 'image' ? (
                  <img
                    src={mediaUrl}
                    alt={post.title}
                    className="w-full h-[400px] object-cover"
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    className="w-full h-[400px] object-cover"
                    controls
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                
                {/* Analysis Badge */}
                {post.media_type === 'video' && post.analysis_status === 'completed' && post.deepfake_analysis?.summary && (
                  <div
                    className={`absolute bottom-4 left-4 px-4 py-2 rounded-full flex items-center gap-2 text-base font-bold ${
                      post.deepfake_analysis.summary.status === 'REAL' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {post.deepfake_analysis.summary.status === 'REAL' ? 'REAL' : 'DEEPFAKE'}
                    <span className="text-sm opacity-90">
                      {post.deepfake_analysis.summary.confidence_percentage}% confidence
                    </span>
                  </div>
                )}
                
                {/* Processing Badge */}
                {post.media_type === 'video' && post.analysis_status === 'processing' && (
                  <div className="absolute bottom-4 left-4 px-4 py-2 rounded-full bg-yellow-500 text-white flex items-center gap-2 text-base font-bold">
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    <span>Analyzing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getPosts();
        console.log('Received posts:', data); // Debug log
        if (!Array.isArray(data)) {
          console.error('Expected array of posts, got:', typeof data);
          setError('Invalid data received from server');
          return;
        }
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setError('Failed to load posts. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  useEffect(() => {
    // Start polling if there are processing videos
    const processingPosts = posts.some(post => 
      post.media_type === 'video' && post.analysis_status === 'processing'
    );

    if (processingPosts && !pollInterval) {
      const interval = setInterval(async () => {
        const data = await api.getPosts();
        setPosts(data);
        
        // Stop polling if no more processing videos
        if (!data.some(post => post.analysis_status === 'processing')) {
          clearInterval(interval);
          setPollInterval(null);
        }
      }, 5000); // Poll every 5 seconds
      
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [posts]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading posts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <section className="py-24 bg-[#ffffff] relative overflow-hidden mt-16">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(#151616 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
            opacity: "0.1",
          }}
        />
      </div>

      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-[#151616] text-white rounded-full px-4 py-2 mb-4"
          >
            <Sparkles className="w-4 h-4 text-[#D6F32F]" />
            <span className="text-sm font-medium">Trending Now</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-[#151616] mb-4"
          >
            Share What's Real
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-[#151616]/70 max-w-2xl mx-auto mb-8"
          >
            Connect with others, share your moments, and let our AI ensure the authenticity of every video shared.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mb-8"
          >
            <Link
              to="/create-post"
              className="group bg-[#D6F32F] px-6 py-3 rounded-2xl font-bold text-[#151616] border-2 border-[#151616] shadow-[4px_4px_0px_0px_#151616] hover:shadow-[2px_2px_0px_0px_#151616] hover:translate-y-[2px] hover:translate-x-[2px] transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Share a Video
            </Link>
          </motion.div>
        </div>

        <div className="w-full max-w-5xl mx-auto">
          {posts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-[#151616]/10">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="text-4xl">✨</div>
                <div className="text-xl font-bold text-[#151616]">Be the First</div>
                <div className="text-[#151616]/70">
                  Start the conversation by sharing your first video!
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="divide-y divide-[#151616]/10">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}