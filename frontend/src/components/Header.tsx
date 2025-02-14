import React from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from "framer-motion";

export function Header() {
  return (
    <header className="bg-[#ffffff] relative overflow-hidden">
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
    </header>
  );
} 