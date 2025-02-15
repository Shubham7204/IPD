import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import Navbar from './components/NavBar';
import Footer from './components/Footer';
import CreatePost from './components/CreatePost';
import PostDetails from './components/PostDetails';
import Community from './components/Community';
import PostAnalysis from './pages/PostAnalysis';
import Home from './pages/Home';
import OldModelAnalysis from './pages/OldModelAnalysis';

const App = () => {
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route 
              path="/dashboard" 
              element={isLoggedIn ? <Dashboard /> : <LoginPage />} 
            />
            <Route 
              path="/create-post" 
              element={isLoggedIn ? <CreatePost /> : <LoginPage />} 
            />
            <Route path="/posts/:id" element={<PostDetails />} />
            <Route path="/community" element={<Community />} />
            <Route path="/posts/:postId/analysis" element={<PostAnalysis />} />
            <Route path="/old-model-analysis/:postId" element={<OldModelAnalysis />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
