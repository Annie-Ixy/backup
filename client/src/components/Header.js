import React from 'react';
import { motion } from 'framer-motion';
import { Award, RotateCcw, Briefcase, Users } from 'lucide-react';

const Header = ({ currentView, onStartOver }) => {
  const getStepIndicator = () => {
    const steps = [
      { id: 'upload', label: '上传简历', icon: Briefcase },
      { id: 'processing', label: 'AI分析', icon: Award },
      { id: 'results', label: '候选人排名', icon: Users },
    ];

    const currentIndex = steps.findIndex(step => step.id === currentView);

    return (
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentIndex;
          const isCurrent = step.id === currentView;

          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center space-x-2 ${
                isActive ? 'text-primary-600' : 'text-gray-400'
              }`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isActive ? 'bg-primary-100' : 'bg-gray-100'
                } ${isCurrent ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:block">
                  {step.label}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={`hidden sm:block w-8 h-0.5 mx-3 ${
                  index < currentIndex ? 'bg-primary-300' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Title */}
          <motion.div 
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                简历智能筛选系统
              </h1>
              <p className="text-sm text-gray-500">
                HRBP部门 - AI驱动的候选人评估平台
              </p>
            </div>
          </motion.div>

          {/* Step Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {getStepIndicator()}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {currentView !== 'upload' && (
              <button
                onClick={onStartOver}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:block">
                  重新开始
                </span>
              </button>
            )}
            
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">在线</span>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default Header; 