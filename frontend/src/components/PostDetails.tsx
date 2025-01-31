import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Sparkles, Send } from 'lucide-react';
import { motion } from "framer-motion";
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    email: string;
  };
}

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
  comments: Comment[];
  likes?: string[];
}

const API_URL = 'http://localhost:3000';

export default function PostDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      if (!id) return;
      try {
        setLoading(true);
        console.log('Fetching post with ID:', id);
        
        // Try to fetch from Supabase first
        const response = await fetch(`${API_URL}/api/posts/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch post: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Fetched post data:', data);
        
        if (!data) {
          throw new Error('No data received');
        }
        
        // Update state with the fetched data
        setPost(data);
        setComments(data.comments || []);
        setLikesCount(data.likes_count || 0);
        setIsLiked(data.likes?.includes(session?.user?.id));
        setError(''); // Clear any previous errors
      } catch (error) {
        console.error('Error fetching post:', error);
        setError('Failed to load post. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    if (id) {
      fetchPost();
    }
  }, [id, session?.user?.id]);

  const handleLike = async () => {
    if (!session) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/posts/${id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setLikesCount(data.likes_count);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/posts/${id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment })
      });
      const newCommentData = await response.json();
      setComments([newCommentData, ...comments]);
      setNewComment('');
    } catch (error) {
      setError('Failed to add comment. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading post...</div>
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

  if (!post) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Post not found</div>
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto bg-white rounded-3xl overflow-hidden border-2 border-[#151616] shadow-[4px_4px_0px_0px_#151616]"
        >
          <div className="relative h-96">
            {post.media_type === 'image' ? (
              <img
                src={post.media_url.startsWith('http') 
                  ? post.media_url 
                  : `${API_URL}${post.media_url}`}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={post.media_url.startsWith('http') 
                  ? post.media_url 
                  : `${API_URL}${post.media_url}`}
                controls
                className="w-full h-full object-cover"
              >
                Your browser does not support the video tag.
              </video>
            )}
            <div className="absolute top-4 right-4 text-sm font-bold text-white bg-[#151616]/50 px-4 py-2 rounded-full">
              {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="p-8">
            <h1 className="text-4xl font-bold text-[#151616] mb-4">{post.title}</h1>
            <p className="text-[#151616]/70 mb-6 whitespace-pre-wrap">{post.content}</p>

            <div className="flex items-center justify-between border-t border-b border-[#151616]/10 py-4 mb-8">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-2 ${
                    isLiked ? 'text-red-500' : 'text-[#151616]/70'
                  } hover:text-red-500 transition`}
                >
                  <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{likesCount}</span>
                </button>
                <div className="flex items-center space-x-2 text-[#151616]/70">
                  <MessageCircle className="h-6 w-6" />
                  <span>{comments.length}</span>
                </div>
              </div>
              <div className="text-sm text-[#151616]/70">
                Posted by {post.profiles.username}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D6F32F]" />
                <h2 className="text-2xl font-bold text-[#151616]">Comments</h2>
              </div>

              {session && (
                <form onSubmit={handleComment} className="space-y-4">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-4">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-grow px-4 py-3 border-2 border-[#151616] rounded-xl focus:ring-2 focus:ring-[#D6F32F] focus:border-[#151616] transition-all"
                      placeholder="Add a comment..."
                      required
                    />
                    <button
                      type="submit"
                      className="bg-[#D6F32F] px-6 rounded-xl font-bold text-[#151616] border-2 border-[#151616] shadow-[4px_4px_0px_0px_#151616] hover:shadow-[2px_2px_0px_0px_#151616] hover:translate-y-[2px] hover:translate-x-[2px] transition-all duration-200"
                      aria-label="Send comment"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#151616]/5 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#151616]">
                          {comment.profiles?.username || 'Anonymous'}
                        </span>
                        <span className="text-xs text-[#151616]/70">
                          {comment.profiles?.email}
                        </span>
                      </div>
                      <span className="text-sm text-[#151616]/70">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[#151616]/70">{comment.content}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}