import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import Navbar from './components/NavBar';
import Footer from './components/Footer';
import CreatePost from './components/CreatePost';
import PostDetails from './components/PostDetails';
import Community from './components/Community';
import FrameAnalysis from './pages/FrameAnalysis';

const App = () => {
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route 
              path="/dashboard" 
              element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />} 
            />
            <Route path="/create-post" element={<CreatePost />} />
            <Route path="/posts/:id" element={<PostDetails />} />
            <Route path="/community" element={<Community />} />
            <Route path="/posts/:postId/analysis" element={<FrameAnalysis />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
