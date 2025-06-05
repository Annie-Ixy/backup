import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  FileText, 
  TrendingUp, 
  Users, 
  CheckCircle,
  RotateCcw,
  Zap
} from 'lucide-react';

const LoadingScreen = ({ progress, candidatesProcessed, onStartOver }) => {
  const stages = [
    {
      id: 'extract',
      label: '提取PDF文件',
      icon: FileText,
      threshold: 10,
      description: '正在从ZIP文件中提取PDF简历文件...'
    },
    {
      id: 'parse',
      label: '解析简历内容',
      icon: Brain,
      threshold: 30,
      description: '使用AI技术提取简历中的关键信息...'
    },
    {
      id: 'analyze',
      label: 'AI智能分析',
      icon: Zap,
      threshold: 70,
      description: '分析候选人技能、经验和匹配度...'
    },
    {
      id: 'rank',
      label: '生成排名',
      icon: TrendingUp,
      threshold: 90,
      description: '根据评估结果生成候选人排名...'
    },
    {
      id: 'complete',
      label: '完成分析',
      icon: CheckCircle,
      threshold: 100,
      description: '分析完成，准备展示结果...'
    }
  ];

  const getCurrentStage = () => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (progress >= stages[i].threshold) {
        return stages[i];
      }
    }
    return stages[0];
  };

  const currentStage = getCurrentStage();

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Main Loading Icon */}
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-6"
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Brain className="w-10 h-10 text-white" />
        </motion.div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          AI正在分析简历
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          请稍候，我们正在使用先进的AI技术分析候选人简历...
        </p>
      </motion.div>

      {/* Progress Card */}
      <motion.div
        className="bg-white rounded-xl border border-gray-200 shadow-lg p-8 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              整体进度
            </span>
            <span className="text-sm font-medium text-primary-600">
              {progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Current Stage */}
        <div className="flex items-center space-x-4 mb-6">
          <motion.div
            className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full"
            animate={{ 
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <currentStage.icon className="w-6 h-6 text-primary-600" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {currentStage.label}
            </h3>
            <p className="text-gray-600">
              {currentStage.description}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {candidatesProcessed}
            </div>
            <div className="text-sm text-gray-600">
              已处理候选人
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-success-600">
              {Math.round(progress)}%
            </div>
            <div className="text-sm text-gray-600">
              完成进度
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-warning-600">
              AI
            </div>
            <div className="text-sm text-gray-600">
              智能分析中
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stages Timeline */}
      <motion.div
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          处理阶段
        </h3>
        
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const isCompleted = progress >= stage.threshold;
            const isCurrent = currentStage.id === stage.id;
            const Icon = stage.icon;

            return (
              <motion.div
                key={stage.id}
                className={`flex items-center space-x-4 p-3 rounded-lg transition-all duration-200 ${
                  isCurrent 
                    ? 'bg-primary-50 border border-primary-200' 
                    : isCompleted 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-gray-50 border border-gray-200'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isCurrent 
                    ? 'bg-primary-500' 
                    : isCompleted 
                    ? 'bg-green-500' 
                    : 'bg-gray-300'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    isCurrent || isCompleted ? 'text-white' : 'text-gray-500'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <div className={`font-medium ${
                    isCurrent 
                      ? 'text-primary-800' 
                      : isCompleted 
                      ? 'text-green-800' 
                      : 'text-gray-600'
                  }`}>
                    {stage.label}
                  </div>
                  {isCurrent && (
                    <div className="text-sm text-primary-600">
                      {stage.description}
                    </div>
                  )}
                </div>

                {isCompleted && !isCurrent && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                
                {isCurrent && (
                  <motion.div
                    className="w-2 h-2 bg-primary-500 rounded-full"
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Loading Animation */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <div className="loading-dots mx-auto mb-4" />
        <p className="text-gray-500 text-sm mb-6">
          这个过程可能需要几分钟时间，请耐心等待...
        </p>

        <button
          onClick={onStartOver}
          className="inline-flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors duration-200"
        >
          <RotateCcw className="w-4 h-4" />
          <span>取消并重新开始</span>
        </button>
      </motion.div>
    </div>
  );
};

export default LoadingScreen; 