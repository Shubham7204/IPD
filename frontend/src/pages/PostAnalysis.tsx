import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Frame {
  frame: string;
  frame_path: string;
  confidence: number;
  is_fake: boolean;
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
    confidence: number;
    is_fake: boolean;
  };
}

const API_URL = 'http://localhost:3000';

export default function PostAnalysis() {
  const { postId } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await fetch(`${API_URL}/api/posts/${postId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch post');
        const data = await response.json();
        setPost(data);
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPost();
  }, [postId]);

  const renderFrameGrid = () => {
    if (!post?.deepfake_analysis?.frames_analysis) return null;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {post.deepfake_analysis.frames_analysis.map((frame, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden"
          >
            <img 
              src={`${API_URL}${frame.frame_path}`}
              alt={`Frame ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                console.error(`Error loading frame: ${frame.frame_path}`);
                const target = e.target as HTMLImageElement;
                target.src = 'placeholder.jpg'; // Add a placeholder image
              }}
            />
            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold ${
              frame.is_fake 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {(frame.confidence * 100).toFixed(0)}%
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const determineVideoStatus = (frames: Frame[]) => {
    const realFrames = frames.filter(f => !f.is_fake).length;
    const fakeFrames = frames.filter(f => f.is_fake).length;
    // Calculate average confidence
    const totalConfidence = frames.reduce((sum, frame) => sum + frame.confidence, 0);
    const averageConfidence = totalConfidence / frames.length;
    
    return {
      isReal: realFrames >= fakeFrames,
      realCount: realFrames,
      fakeCount: fakeFrames,
      totalFrames: frames.length,
      confidence: averageConfidence
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!post) {
    return <div className="p-6">Post not found</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <video 
              src={`${API_URL}${post.media_url}`}
              className="w-full rounded-lg shadow-lg"
              controls
            />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Analysis Summary</h2>
            {post.deepfake_analysis ? (
              <>
                {(() => {
                  const status = determineVideoStatus(post.deepfake_analysis.frames_analysis);
                  return (
                    <>
                      <div className={`text-2xl font-bold mb-4 ${
                        status.isReal ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {status.isReal ? 'VIDEO IS REAL' : 'VIDEO IS FAKE'}
                      </div>
                      <div className="text-lg mb-2">
                        Overall Confidence: {(status.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-gray-600 space-y-1">
                        <div>Total Frames: {status.totalFrames}</div>
                        <div>Real Frames: {status.realCount}</div>
                        <div>Fake Frames: {status.fakeCount}</div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="text-yellow-600">Analysis not available</div>
            )}
          </div>
        </div>
      </div>

      {post.deepfake_analysis && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Frame-by-Frame Analysis</h2>
          
          <div className="mb-8 overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Frame</th>
                  <th className="px-4 py-2 text-left">Confidence</th>
                  <th className="px-4 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {post.deepfake_analysis.frames_analysis.map((frame, index) => (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">Frame {index + 1}</td>
                    <td className="px-4 py-2">
                      {isNaN(frame.confidence) ? '0.0' : (frame.confidence * 100).toFixed(1)}%
                    </td>
                    <td className={`px-4 py-2 font-medium ${
                      frame.is_fake ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {frame.is_fake ? 'FAKE' : 'REAL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Extracted Frames</h3>
            {renderFrameGrid()}
          </div>
        </div>
      )}
    </div>
  );
} 