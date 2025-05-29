import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Zap, 
  Users,
  TrendingUp,
  FileArchive,
  Briefcase
} from 'lucide-react';

const FileUpload = ({ onUpload, error, jobDescription, onJobDescriptionChange }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      // Handle rejected files
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleUpload = async () => {
    if (!selectedFile || !jobDescription.trim()) return;
    
    setUploading(true);
    try {
      await onUpload(selectedFile, jobDescription);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const canUpload = selectedFile && jobDescription && jobDescription.trim();

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI驱动的简历筛选系统
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          输入职位描述并上传候选人简历（PDF文件或包含多个PDF的ZIP文件），我们的AI系统将自动分析、评估并排名所有候选人
        </p>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4 mx-auto">
              <Zap className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              智能分析
            </h3>
            <p className="text-gray-600 text-sm">
              使用先进的AI技术自动提取简历关键信息，包括技能、经验、教育背景等
            </p>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-center w-12 h-12 bg-success-100 rounded-lg mb-4 mx-auto">
              <TrendingUp className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              智能评分
            </h3>
            <p className="text-gray-600 text-sm">
              基于您提供的岗位要求对候选人进行多维度评估，生成客观的综合评分
            </p>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex items-center justify-center w-12 h-12 bg-warning-100 rounded-lg mb-4 mx-auto">
              <Users className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              候选人排名
            </h3>
            <p className="text-gray-600 text-sm">
              自动生成候选人排名列表，提供详细的匹配度分析和推荐建议
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Job Description Input */}
      <motion.div
        className="bg-white rounded-xl border border-gray-300 p-8 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-lg">
            <Briefcase className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">职位描述</h2>
        </div>
        
        <textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="请输入详细的职位描述，包括：
• 职位名称和级别
• 工作职责和要求
• 技能要求（编程语言、框架、工具等）
• 经验要求
• 教育背景要求
• 公司/行业背景
• 其他特殊要求

例如：
职位：高级AI工程师
级别：高级工程师
类型：全职
重点领域：计算机视觉、自然语言处理
核心技能：Python、PyTorch、TensorFlow、深度学习
经验要求：3-5年AI/ML相关经验
教育背景：计算机科学、人工智能相关专业本科及以上学历"
          className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          required
        />
        
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            详细的职位描述将帮助AI更准确地评估候选人匹配度
          </p>
          <span className={`text-sm ${jobDescription && jobDescription.trim() ? 'text-green-600' : 'text-gray-400'}`}>
            {jobDescription ? jobDescription.length : 0} 字符
          </span>
        </div>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* Error Display */}
        {error && (
          <motion.div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-red-800 font-medium">上传失败</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* File Drop Zone */}
        <div
          {...getRootProps()}
          className={`text-center p-8 cursor-pointer rounded-lg transition-all duration-200 ${
            isDragActive
              ? 'bg-primary-50 border-primary-300'
              : selectedFile
              ? 'bg-green-50 border-green-300'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="mb-4">
            {selectedFile ? (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            ) : isDragActive ? (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full">
                <Upload className="w-8 h-8 text-primary-600" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                <FileArchive className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </div>

          {selectedFile ? (
            <div>
              <p className="text-lg font-semibold text-green-800 mb-2">
                文件已选择
              </p>
              <div className="inline-flex items-center space-x-2 text-green-600 mb-4">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-sm">({formatFileSize(selectedFile.size)})</span>
              </div>
            </div>
          ) : isDragActive ? (
            <div>
              <p className="text-lg font-semibold text-primary-800 mb-2">
                释放文件开始上传
              </p>
              <p className="text-primary-600">
                将PDF或ZIP文件拖放到此处
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold text-gray-800 mb-2">
                上传简历文件
              </p>
              <p className="text-gray-600 mb-4">
                上传单个PDF简历文件或包含多个PDF简历的ZIP文件
              </p>
              <div className="text-sm text-gray-500">
                <p>• 支持格式：PDF文件 或 ZIP文件</p>
                <p>• 文件大小：最大100MB</p>
                <p>• PDF：单个候选人简历</p>
                <p>• ZIP：多个PDF简历的压缩包</p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Button */}
        {selectedFile && (
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={handleUpload}
              disabled={uploading || !canUpload}
              className={`inline-flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                uploading || !canUpload
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
              } text-white`}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>上传中...</span>
                </>
              ) : !jobDescription || !jobDescription.trim() ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>请先输入职位描述</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>开始分析简历</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => setSelectedFile(null)}
              disabled={uploading}
              className="ml-4 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              重新选择
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Instructions */}
      <motion.div
        className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          使用说明
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">步骤一：输入职位描述</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• 详细描述职位要求和技能需求</li>
              <li>• 包含工作职责和期望经验</li>
              <li>• 说明教育背景和行业要求</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">步骤二：上传简历文件</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• 单个简历：直接上传PDF文件</li>
              <li>• 多个简历：压缩成ZIP格式后上传</li>
              <li>• AI将根据职位要求进行智能匹配</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FileUpload; 