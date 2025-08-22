import React from 'react';
import { motion } from 'framer-motion';
import './GlassPanel.css';

export default function GlassPanel({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`glass-panel ${className}`}
    >
      {children}
    </motion.div>
  );
}
