import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Menu,
  X,
  Home,
  Users,
  Plus,
  Gauge
} from "lucide-react";
import { useAuth } from '../contexts/AuthContext';

const NavLink = ({ to, label, icon: Icon }) => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to}>
      <motion.div
        className="relative px-3 py-2 rounded-lg flex items-center gap-3 transition-colors"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}>
        <Icon
          className={`w-5 h-5 ${
            isActive ? "text-[#151616]" : "text-[#151616]/60"
          }`}
        />
        <span
          className={`text-sm font-medium ${
            isActive ? "text-[#151616]" : "text-[#151616]/60"
          }`}>
          {label}
        </span>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 bg-[#D6F32F]/30 rounded-lg -z-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
};

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { session, setSession } = useAuth();
  const navigate = useNavigate(); // Hook to enable navigation

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  
    setSession(null);
    navigate('/'); // Navigate to the home page
    window.location.reload(); // Refresh the page
  };
  

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/dashboard", label: "Dashboard", icon: Gauge },
    { to: "/community", label: "Community", icon: Users },
    { to: "/create-post", label: "Create Post", icon: Plus }
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b-2 border-[#151616]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D6F32F] rounded-lg flex items-center justify-center border-2 border-[#151616] shadow-[2px_2px_0px_0px_#151616]">
                  <Bot className="w-6 h-6 text-[#151616]" />
                </div>
                <span className="font-bold text-lg">DeepSeek</span>
              </Link>
            </motion.div>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-[#151616]">
                    {session.user.username.split('@')[0]}
                  </span>
                  <span className="text-xs text-[#151616]/70">
                    {session.user.email}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg bg-[#D6F32F] border-2 border-[#151616] shadow-[3px_3px_0px_0px_#151616] hover:shadow-[1px_1px_0px_0px_#151616] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm font-medium"
                >
                  Logout
                </motion.button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg border-2 border-[#151616] hover:bg-[#D6F32F]/10 text-sm font-medium transition-colors"
                  >
                    Login
                  </motion.button>
                </Link>
                <Link to="/register">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg bg-[#D6F32F] border-2 border-[#151616] shadow-[3px_3px_0px_0px_#151616] hover:shadow-[1px_1px_0px_0px_#151616] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm font-medium"
                  >
                    Sign Up
                  </motion.button>
                </Link>
              </>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[#D6F32F]/20 transition-colors">
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-[#151616]" />
              ) : (
                <Menu className="w-6 h-6 text-[#151616]" />
              )}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden py-4">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;