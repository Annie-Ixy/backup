import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ type = 'info', message, isVisible, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'error':
        return <XCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "flex items-center p-4 rounded-lg shadow-lg backdrop-blur-sm";
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-100/90 text-green-800 border border-green-200`;
      case 'error':
        return `${baseStyles} bg-red-100/90 text-red-800 border border-red-200`;
      case 'warning':
        return `${baseStyles} bg-yellow-100/90 text-yellow-800 border border-yellow-200`;
      default:
        return `${baseStyles} bg-blue-100/90 text-blue-800 border border-blue-200`;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-4 left-0 right-0 z-50 flex justify-center"
        >
          <div className={`${getStyles()} max-w-sm`}>
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-3 flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast; 