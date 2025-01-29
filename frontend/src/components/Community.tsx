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
}

const API_URL = 'http://localhost:3000';

const PostCard: React.FC<{ post: Post; index: number }> = ({ post, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!post || !post.media_url) {
    return null;
  }

  const mediaUrl = post.media_url.startsWith('http') 
    ? post.media_url 
    : `${API_URL}${post.media_url}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        to={`/posts/${post.id}`}
        className="block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="bg-white rounded-3xl overflow-hidden border-2 border-[#151616] shadow-[4px_4px_0px_0px_#151616] hover:shadow-[8px_8px_0px_0px_#151616] transition-all duration-300"
          whileHover={{ y: -5 }}
        >
          <div className="relative h-48">
            {post.media_type === 'image' ? (
              <img
                src={mediaUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
              >
                Your browser does not support the video tag.
              </video>
            )}
            <div className="absolute top-4 right-4 text-sm font-bold text-white bg-[#151616]/50 px-2 py-1 rounded-full">
              {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
          
          <div className="p-6">
            <h2 className="text-xl font-bold text-[#151616] mb-3">{post.title}</h2>
            <p className="text-[#151616]/70 mb-4 line-clamp-2">{post.content}</p>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#151616]/70">
                Posted by {post?.profiles?.username || 'Anonymous'}
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 text-[#151616]/70">
                  <Heart className={`h-5 w-5 ${isHovered ? 'text-red-500' : ''}`} />
                  <span>{post.likes_count || 0}</span>
                </div>
                <div className="flex items-center space-x-1 text-[#151616]/70">
                  <MessageCircle className="h-5 w-5" />
                  <span>{post.comments_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-[#151616] text-white rounded-full px-4 py-2 mb-4"
          >
            <Sparkles className="w-4 h-4 text-[#D6F32F]" />
            <span className="text-sm font-medium">Community Posts</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-black text-[#151616] mb-6"
          >
            Sustainable Product Blog
            <span className="inline-block ml-2">
              <motion.div
                animate={{ rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block"
              >
                🌱
              </motion.div>
            </span>
          </motion.h2>

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
              Create Post
            </Link>
          </motion.div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.length === 0 ? (
            <div className="col-span-full text-center text-gray-500">
              No posts yet. Be the first to create one!
            </div>
          ) : (
            posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}