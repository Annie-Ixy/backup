import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Download,
  Table,
  ArrowLeft,
  LogOut,
  User,
  PieChart,
  BarChart,
  LineChart,
  Filter,
  Calendar,
  Target,
  CheckSquare,
  Grid,
  Circle,
  MessageCircle,
} from 'lucide-react';
import { questionnaireApi } from '../services/questionnaireApi';
import Toast from '../components/Toast';

import { isLogin } from '../utils/index.ts';

const QuestionnaireAnalysis = () => {
  const navigate = useNavigate();
  const [username] = useState(localStorage.getItem('username') || 'User');

  const [file, setFile] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [analysisId, setAnalysisId] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [fieldFilters, setFieldFilters] = useState({});
  const [customTags, setCustomTags] = useState([]);
  const [summaryDimensions, setSummaryDimensions] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(true);
  const [activeTab, setActiveTab] = useState('analysis');

  // 打标进度相关状态
  const [taggingProgress, setTaggingProgress] = useState(0);
  const [showTaggingProgress, setShowTaggingProgress] = useState(false);
  const [taggingStatus, setTaggingStatus] = useState('');
  
  // 统计分析进度相关状态
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showAnalysisProgress, setShowAnalysisProgress] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');

  // 页面标签页状态
  const [pageTab, setPageTab] = useState('upload');

  // 分析结果视图状态
  const [resultViewMode, setResultViewMode] = useState('structured'); // 'structured' | 'json'

  // 字段筛选模式状态
  const [filterMode, setFilterMode] = useState('byType'); // 'byType' | 'byField'

  // Classification处理状态
  const [classificationResult, setClassificationResult] = useState(null);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [classificationError, setClassificationError] = useState('');

  const [groupedFields, setGroupedFields] = useState(new Map());  // 添加 groupedFields 状态

  let isLoginIndex = 0;

  useEffect(() => {
    if (isLoginIndex === 0) {
      isLoginIndex++;
      isLogin().then(res => {
        if (!res) {
          navigate('/login');
        }
      })
    }
  }, [navigate]);

  // 监控页面切换和分类结果变化，清理不匹配的字段选择
  useEffect(() => {
    if (pageTab === 'results' && classificationResult && classificationResult.processed_data) {
      const availableFields = Object.keys(classificationResult.processed_data);
      // 检查当前选择的字段是否都在打标结果中
      const validSelectedFields = selectedFields.filter(field => availableFields.includes(field));
      
      // 如果有字段不在打标结果中，则更新选择
      if (validSelectedFields.length !== selectedFields.length) {
        console.log('清理不匹配的字段选择，保留有效字段:', validSelectedFields);
        setSelectedFields(validSelectedFields);
      }
    }
  }, [pageTab, classificationResult]); // 移除 selectedFields 依赖

  // 拖拽上传处理
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('文件格式不支持，请上传 CSV、Excel 文件');
      return;
    }

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // 上传文件
  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await questionnaireApi.upload(file);
      console.log('上传结果:', res);
      
      // 使用原始文件名而不是服务器返回的文件名
      const uploadInfo = {
        ...res,
        filename: file.name
      };
      
      setUploadInfo(uploadInfo);
      setAnalysisId(res.analysisId);

      // 初始化 groupedFields
      const newGroupedFields = new Map();
      if (res.questionTypes) {
        // 处理量表题
        res.questionTypes.scaleQuestions?.forEach(q => {
          const mainQuestionMatch = q.column.match(/^([Qq]\d+)/);
          if (mainQuestionMatch) {
            const mainQuestion = mainQuestionMatch[0];
            if (!newGroupedFields.has(mainQuestion)) {
              newGroupedFields.set(mainQuestion, {
                mainQuestion: mainQuestion,
                fields: [],
                type: 'scale'
              });
            }
            newGroupedFields.get(mainQuestion).fields.push(q.column);
          }
        });

        // 处理单选题
        res.questionTypes.singleChoice?.forEach(q => {
          const mainQuestionMatch = q.column.match(/^([Qq]\d+)/);
          if (mainQuestionMatch) {
            const mainQuestion = mainQuestionMatch[0];
            if (!newGroupedFields.has(mainQuestion)) {
              newGroupedFields.set(mainQuestion, {
                mainQuestion: mainQuestion,
                fields: [],
                type: 'single'
              });
            }
            newGroupedFields.get(mainQuestion).fields.push(q.column);
          }
        });

        // 处理开放题
        res.questionTypes.openEnded?.forEach(q => {
          const mainQuestionMatch = q.column.match(/^([Qq]\d+)/);
          if (mainQuestionMatch) {
            const mainQuestion = mainQuestionMatch[0];
            if (!newGroupedFields.has(mainQuestion)) {
              newGroupedFields.set(mainQuestion, {
                mainQuestion: mainQuestion,
                fields: [],
                type: 'open'
              });
            }
            newGroupedFields.get(mainQuestion).fields.push(q.column);
          }
        });
      }
      setGroupedFields(newGroupedFields);
      
      // 文件上传成功后根据开放题数量决定跳转页面
      const openEndedCount = res.questionTypes?.openEnded?.length || 0;
      if (openEndedCount === 0) {
        // 无开放题，直接跳转到统计分析页面
        setPageTab('results');
      } else {
        // 有开放题，跳转到分析配置页面
        setPageTab('config');
      }
      
      // 清除上一个文件的分类处理结果
      setClassificationResult(null);

    } catch (err) {
      console.error('上传失败:', err);
      setError(err.message || '上传失败');
    }
    setLoading(false);
  };

  // 获取分析统计

  const getMatrixScaleData = (matrixScale, multipleChoice) => {
    // 计算矩阵量表题的数量
    const matrixCount = matrixScale ? Object.keys(matrixScale).length : 0;

    // 计算多选题的数量  
    const multipleChoiceCount = multipleChoice ? Object.keys(multipleChoice).length : 0;

    // 合并矩阵量表和多选题的数据
    const combinedData = [];

    // 添加矩阵量表题
    if (matrixScale && typeof matrixScale === 'object') {
      Object.entries(matrixScale).forEach(([groupName, questions]) => {
        combinedData.push({
          type: 'matrix',
          groupName: groupName,
          columns: questions.map(q => q.column || q),
          count: questions.length
        });
      });
    }

    // 添加多选题
    if (multipleChoice && typeof multipleChoice === 'object') {
      Object.entries(multipleChoice).forEach(([groupName, options]) => {
        combinedData.push({
          type: 'multiple',
          groupName: groupName,
          columns: options.map(opt => opt.full_column || opt.option || opt),
          count: options.length
        });
      });
    }

    return {
      matrixCount,
      multipleChoiceCount,
      totalCount: matrixCount + multipleChoiceCount,
      combinedData
    };
  }



  // 开始打标
  const handleAnalyze = async () => {
    if (!analysisId) return;
    if (selectedFields.length === 0) {
      setError('请先选择要分析的字段');
      return;
    }

    setLoading(true);
    setError('');
    setShowAnalysisProgress(true);
    setAnalysisProgress(0);
    setAnalysisStatus('正在准备数据...');
    
    try {
      // 获取所有选中问题的子字段，优先选择带有"一级主题"的字段
      const fieldsToAnalyze = [];
      selectedFields.forEach(selectedField => {
        // 在 groupedFields 中查找对应的组
        const matchingGroup = Array.from(groupedFields.values()).find(group => 
          group.mainQuestion === selectedField
        );
        if (matchingGroup) {
          // 检查该组中是否有带有"一级主题"的字段
          const topicFields = matchingGroup.fields.filter(field => field.includes("一级主题"));
          
          if (topicFields.length > 0) {
            // 如果有一级主题字段，只添加一级主题字段
            console.log(`发现一级主题字段: ${topicFields}，忽略同标题其他字段`);
            fieldsToAnalyze.push(...topicFields);
          } else {
            // 如果没有一级主题字段，添加该组的所有字段
            fieldsToAnalyze.push(...matchingGroup.fields);
          }
        }
      });

      // 更新进度
      setAnalysisProgress(10);
      setAnalysisStatus('正在处理选中字段...');
      
      console.log('开始分析，选择的字段:', fieldsToAnalyze);
      console.log('问题类型信息:', uploadInfo.questionTypes);
      
      // 模拟进度增加
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
        
        // 更新状态消息
        if (analysisProgress < 30) {
          setAnalysisStatus('正在分析文本内容...');
        } else if (analysisProgress < 60) {
          setAnalysisStatus('正在生成标签...');
        } else {
          setAnalysisStatus('正在整理分析结果...');
        }
      }, 500);
      
      const res = await questionnaireApi.statistics({
        analysisId,
        selectedFields: fieldsToAnalyze,
        questionTypes: uploadInfo.questionTypes
      });

      // 清除进度条定时器
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalysisStatus('分析完成！');
      
      // 延迟隐藏进度条
      setTimeout(() => {
        setShowAnalysisProgress(false);
      }, 1000);

      console.log('分析结果:', res.results);
      setAnalysisResult(res.results);
      setShowResult(true);
      setActiveTab('analysis');
      setPageTab('results'); // 分析完成后自动跳转到分析结果
    } catch (err) {
      console.error('分析失败:', err);
      setError(err.message || '分析失败');
      setAnalysisStatus('分析失败: ' + (err.message || '未知错误'));
      setShowAnalysisProgress(false);
    }
    setLoading(false);
  };

  // 开始Classification处理
  const handleClassification = async () => {
    if (!analysisId) return;
    // if (selectedFields.length === 0) {
    //   setClassificationError('请先选择要分析的字段');
    //   return;
    // }

    setClassificationLoading(true);
    setClassificationError('');
    setShowTaggingProgress(true);
    setTaggingProgress(0);
    setTaggingStatus('正在准备数据...');
    
    try {
      // 模拟进度增加
      const progressInterval = setInterval(() => {
        setTaggingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
        
        // 更新状态消息
        if (taggingProgress < 30) {
          setTaggingStatus('正在分析文本内容...');
        } else if (taggingProgress < 60) {
          setTaggingStatus('正在生成标签...');
        } else {
          setTaggingStatus('正在整理分析结果...');
        }
      }, 500);
      
      console.log('开始Classification处理，选择的字段:', selectedFields);
      const result = await questionnaireApi.classification({
        analysisId,
        selectedFields
      });

      // 清除进度条定时器
      clearInterval(progressInterval);
      setTaggingProgress(100);
      setTaggingStatus('分析完成！');
      
      // 延迟隐藏进度条
      setTimeout(() => {
        setShowTaggingProgress(false);
      }, 1000);

      console.log('Classification处理结果:', result);
      console.log('processed_data结构:', result.processed_data);
      
      // 检查processed_data的类型和结构
      if (result.processed_data) {
        console.log('processed_data类型:', typeof result.processed_data);
        console.log('processed_data是否为数组:', Array.isArray(result.processed_data));
        console.log('processed_data长度:', result.processed_data.length);
        
        // 如果是数组，查看第一个元素
        if (Array.isArray(result.processed_data) && result.processed_data.length > 0) {
          console.log('第一个元素示例:', result.processed_data[0]);
          console.log('field属性:', result.processed_data[0].field);
        }
      }
      
      setClassificationResult(result);
      
      // 更新groupedFields，添加打标后新增的开放题列
      if (result.processed_data && result.processed_data.length > 0) {
        console.log('开始更新groupedFields，包含打标后的新列');
        
        // 保留原有的分组信息
        const newGroupedFields = new Map(groupedFields);
        
        // 处理打标后的数据
        result.processed_data.forEach(item => {
          if (!item.field) return;
          
          console.log(`处理字段: ${item.field}`);
          
          // 尝试找到对应的主问题
          const mainQuestionMatch = item.field.match(/^([Qq]\d+)/);
          if (mainQuestionMatch) {
            const mainQuestion = mainQuestionMatch[0];
            console.log(`匹配到主问题: ${mainQuestion}`);
            
            // 检查这个字段是否已经在任何现有组中
            let fieldExists = false;
            for (const group of newGroupedFields.values()) {
              if (group.fields.includes(item.field)) {
                fieldExists = true;
                break;
              }
            }
            
            // 如果字段不存在于任何组中
            if (!fieldExists) {
              console.log(`字段 ${item.field} 是新的，需要添加`);
              
              // 如果已有该主问题的分组，则添加到该分组
              if (newGroupedFields.has(mainQuestion)) {
                console.log(`添加到现有组 ${mainQuestion}`);
                const group = newGroupedFields.get(mainQuestion);
                group.fields.push(item.field);
              } else {
                // 否则创建新的分组
                console.log(`创建新组 ${mainQuestion}`);
                newGroupedFields.set(mainQuestion, {
                  mainQuestion: mainQuestion,
                  fields: [item.field],
                  type: 'open' // 默认为开放题
                });
              }
            }
          }
        });
        
        console.log('更新后的groupedFields:', Array.from(newGroupedFields.entries()));
        setGroupedFields(newGroupedFields);
      }
      
      setActiveTab('analysis');
    } catch (err) {
      console.error('Classification处理失败:', err);
      setClassificationError(err.message || 'Classification处理失败');
      setTaggingStatus('分析失败: ' + (err.message || '未知错误'));
      setShowTaggingProgress(false);
    }
    setClassificationLoading(false);
  };

  // 下载Classification结果
  const downloadClassificationResult = async () => {
    if (!classificationResult || !analysisId) return;

    try {
      const blob = await questionnaireApi.downloadClassification(analysisId);
      if (!blob) {
        throw new Error('下载失败');
      }
      window.open(window.location.origin+'/dev-api-py/download-classification/'+analysisId, '_blank');
    } catch (error) {
      console.error('下载失败:', error);
      setClassificationError('下载失败，请重试');
    }
  };





  // 移除文件
  const removeFile = () => {
    setFile(null);
    setUploadInfo(null);
    setAnalysisId('');
    setError('');
    setAnalysisResult(null);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 解析换行符
  const parseNewlines = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
  };

  // 格式化分析结果显示
  const formatAnalysisResult = (result) => {
    if (!result) return null;

    const formatted = {};
    Object.keys(result).forEach(key => {
      const value = result[key];
      if (typeof value === 'string') {
        formatted[key] = parseNewlines(value);
      } else if (Array.isArray(value)) {
        formatted[key] = value.map(item =>
          typeof item === 'string' ? parseNewlines(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        formatted[key] = formatAnalysisResult(value);
      } else {
        formatted[key] = value;
      }
    });
    return formatted;
  };

  // 渲染智能分析结果
  const renderAnalysisResult = (result) => {
    if (!result) return null;

    return (
      <div className="space-y-6">
        {/* 分析摘要 */}
        {result.summary && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-blue-600" />
              分析摘要
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.summary.totalFields}</div>
                <div className="text-sm text-gray-600">总字段数</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{result.summary.analyzedQuestions}</div>
                <div className="text-sm text-gray-600">已分析问题</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(result.scaleQuestions?.length || 0) + (result.multipleChoiceQuestions?.length || 0) +
                    (result.matrixQuestions?.length || 0) + (result.singleChoiceQuestions?.length || 0) +
                    (result.openEndedQuestions?.length || 0)}
                </div>
                <div className="text-sm text-gray-600">题型数量</div>
              </div>
            </div>
          </div>
        )}

        {/* 量表题分析 */}
        {result.scaleQuestions && result.scaleQuestions.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              量表题分析 ({result.scaleQuestions.length})
            </h3>
            <div className="space-y-6">
              {result.scaleQuestions.map((question, index) => (
                <div key={index} className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium text-gray-800 mb-3">{question.column}</h4>

                  {question.error ? (
                    <div className="text-red-500 text-sm">{question.error}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 基础统计 */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">基础统计</h5>
                        <div className="space-y-1 text-sm">
                          <div>有效样本: {question.statistics?.count}</div>
                          <div>平均分: {question.statistics?.mean?.toFixed(2)}</div>
                          <div>标准差: {question.statistics?.std?.toFixed(2)}</div>
                          <div>最值: {question.statistics?.min} - {question.statistics?.max}</div>
                          <div>中位数: {question.statistics?.median}</div>
                        </div>
                      </div>

                      {/* 分布情况 */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">分数分布</h5>
                        <div className="space-y-1 text-sm">
                          {question.distribution && Object.entries(question.distribution).map(([score, data]) => (
                            <div key={score} className="flex justify-between">
                              <span>{score}分:</span>
                              <span>{data.count}人 ({data.percentage.toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* NPS分析 */}
                      {question.npsAnalysis && (
                        <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg">
                          <h5 className="font-medium mb-2">NPS分析</h5>
                          <div className="grid grid-cols-3 gap-4 text-center text-sm">
                            <div>
                              <div className="font-medium text-green-600">推荐者</div>
                              <div>{question.npsAnalysis.promoters.count}人 ({question.npsAnalysis.promoters.percentage.toFixed(1)}%)</div>
                            </div>
                            <div>
                              <div className="font-medium text-yellow-600">中性者</div>
                              <div>{question.npsAnalysis.passives.count}人 ({question.npsAnalysis.passives.percentage.toFixed(1)}%)</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">批评者</div>
                              <div>{question.npsAnalysis.detractors.count}人 ({question.npsAnalysis.detractors.percentage.toFixed(1)}%)</div>
                            </div>
                          </div>
                          <div className="mt-2 text-center">
                            <span className="font-medium">NPS得分: {question.npsAnalysis.nps.toFixed(1)}</span>
                            <span className="ml-2 text-sm text-gray-600">({question.npsAnalysis.evaluation})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 多选题分析 */}
        {result.multipleChoiceQuestions && result.multipleChoiceQuestions.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-purple-600" />
              多选题分析 ({result.multipleChoiceQuestions.length})
            </h3>
            <div className="space-y-6">
              {result.multipleChoiceQuestions.map((question, index) => (
                <div key={index} className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium text-gray-800 mb-3">{question.column}</h4>
                  <div className="text-sm text-gray-600 mb-3">
                    有效响应: {question.validResponses} | 选项数: {question.totalOptions}
                  </div>

                  <div className="space-y-2">
                    {question.options && question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="flex-1">{option.option}</span>
                        <div className="text-right">
                          <div className="font-medium">{option.count}人</div>
                          <div className="text-sm text-gray-600">{option.percentage.toFixed(1)}%</div>
                        </div>
                        <div className="ml-3 w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${Math.min(option.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {question.summary && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm">
                      <div>最多选择: {question.mostSelected?.option} ({question.mostSelected?.percentage.toFixed(1)}%)</div>
                      <div>最少选择: {question.summary.leastSelected?.option} ({question.summary.leastSelected?.percentage.toFixed(1)}%)</div>
                      <div>平均选择率: {question.summary.averageSelectionRate?.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 矩阵量表题分析 */}
        {result.matrixQuestions && result.matrixQuestions.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Grid className="w-5 h-5 text-orange-600" />
              矩阵量表题分析 ({result.matrixQuestions.length})
            </h3>
            <div className="space-y-6">
              {result.matrixQuestions.map((question, index) => (
                <div key={index} className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium text-gray-800 mb-3">{question.questionStem}</h4>
                  <div className="text-sm text-gray-600 mb-3">子问题数: {question.totalSubQuestions}</div>

                  <div className="space-y-4">
                    {question.subQuestions && question.subQuestions.map((subQ, subIndex) => (
                      <div key={subIndex} className="bg-gray-50 p-4 rounded-lg">
                        <div className="font-medium text-sm mb-3">
                          子项目 {subQ.subNumber}
                          {subQ.subItem && (
                            <span className="ml-2 font-normal text-gray-600">- {subQ.subItem}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 基础信息 */}
                          <div>
                            <div className="text-xs space-y-1 mb-3">
                              <div>样本数: {subQ.validResponses}</div>
                              {subQ.statistics && (
                                <>
                                  <div>平均分: {subQ.statistics.mean?.toFixed(2)}</div>
                                  <div>范围: {subQ.statistics.min} - {subQ.statistics.max}</div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 选项分布 */}
                          {subQ.options && subQ.options.length > 0 && (
                            <div>
                              <div className="text-xs font-medium mb-2">选项分布:</div>
                              <div className="space-y-1">
                                {subQ.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center justify-between text-xs">
                                    <span className="flex-1 truncate">{option.value}:</span>
                                    <span className="ml-2">{option.count}人 ({option.percentage.toFixed(1)}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 单选题分析 */}
        {result.singleChoiceQuestions && result.singleChoiceQuestions.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Circle className="w-5 h-5 text-blue-600" />
              单选题分析 ({result.singleChoiceQuestions.length})
            </h3>
            <div className="space-y-6">
              {result.singleChoiceQuestions.map((question, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-gray-800 mb-3">{question.column}</h4>

                  {question.error ? (
                    <div className="text-red-500 text-sm">{question.error}</div>
                  ) : (
                    <div>
                      <div className="text-sm text-gray-600 mb-3">
                        有效响应: {question.validResponses} | 选项数: {question.totalOptions}
                      </div>

                      <div className="space-y-2">
                        {question.options && question.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="flex-1">{option.option}</span>
                            <div className="text-right">
                              <div className="font-medium">{option.count}人</div>
                              <div className="text-sm text-gray-600">{option.percentage.toFixed(1)}%</div>
                            </div>
                            <div className="ml-3 w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${Math.min(option.percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {question.mostSelected && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                          <div>最多选择: {question.mostSelected.option} ({question.mostSelected.percentage.toFixed(1)}%)</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 开放题分析 */}
        {result.openEndedQuestions && result.openEndedQuestions.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              开放题分析 ({result.openEndedQuestions.length})
            </h3>
            <div className="space-y-6">
              {result.openEndedQuestions.map((question, index) => (
                <div key={index} className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-medium text-gray-800 mb-3">{question.column}</h4>

                  {question.error ? (
                    <div className="text-red-500 text-sm">{question.error}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">基础统计</h5>
                        <div className="space-y-1 text-sm">
                          <div>有效响应: {question.validResponses}</div>
                          <div>平均长度: {question.statistics?.averageLength?.toFixed(1)} 字符</div>
                          <div>唯一回答: {question.statistics?.uniqueCount}</div>
                          <div>唯一性比例: {(question.statistics?.uniquenessRatio * 100)?.toFixed(1)}%</div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">高频词汇</h5>
                        <div className="flex flex-wrap gap-1">
                          {question.topKeywords && question.topKeywords.slice(0, 8).map((keyword, kwIndex) => (
                            <span key={kwIndex} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                              {keyword.word} ({keyword.count})
                            </span>
                          ))}
                        </div>
                      </div>

                      {question.sampleResponses && question.sampleResponses.length > 0 && (
                        <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                          <h5 className="font-medium mb-2">示例回答</h5>
                          <div className="space-y-2">
                            {question.sampleResponses.slice(0, 3).map((response, resIndex) => (
                              <div key={resIndex} className="text-sm text-gray-700 italic border-l-2 border-gray-300 pl-2">
                                "{response}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 交互分析 */}
        {result.crossAnalysis && result.crossAnalysis.correlations && result.crossAnalysis.correlations.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" />
              字段相关性分析
            </h3>
            <div className="text-sm text-gray-600 mb-4">{result.crossAnalysis.summary}</div>

            <div className="space-y-3">
              {result.crossAnalysis.correlations.map((corr, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{corr.field1} ↔ {corr.field2}</div>
                    <div className="text-xs text-gray-600">{corr.strength}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{corr.correlation.toFixed(3)}</div>
                    <div className={`text-xs ${corr.correlation > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {corr.correlation > 0 ? '正相关' : '负相关'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 获取文件图标
  const getFileIcon = (fileName) => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (ext === '.csv') {
      return <FileText className="w-5 h-5 text-green-600" />;
    }
    return <FileSpreadsheet className="w-5 h-5 text-blue-600" />;
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  // 返回首页
  const handleBackToHome = () => {
    navigate('/home');
  };

  // 检查问题是否属于开放题组
  const isPartOfOpenEndedGroup = (field) => {
    if (!classificationResult || !classificationResult.processed_data) return false;
    
    const baseMatch = field.match(/^([Qq]\d+)/);
    if (!baseMatch) return false;
    
    const baseQuestionId = baseMatch[1].toUpperCase();
    return classificationResult.processed_data.some(item => {
      const itemMatch = item.field.match(/^([Qq]\d+)/);
      return itemMatch && 
             itemMatch[1].toUpperCase() === baseQuestionId && 
             item.type === 2;
    });
  };

  // 获取问题类型的标签样式和文本
  const getTypeLabel = (type, field) => {
    // 检查是否属于开放题组
    const isOpenEndedGroupMember = isPartOfOpenEndedGroup(field);
    
    if (isOpenEndedGroupMember) {
      return {
        text: '开放题组',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-500'
      };
    }

    switch (type) {
      case 0:
        return {
          text: '单选题',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-500'
        };
      case 1:
        return {
          text: '量表题',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-500'
        };
      case 2:
        return {
          text: '开放题',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-500'
        };
      // case 3:
      //   return {
      //     text: '多选/矩阵题',
      //     bgColor: 'bg-purple-100',
      //     textColor: 'text-purple-800',
      //     borderColor: 'border-purple-500'
      //   };
      default:
        return {
          text: '其他',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-500'
        };
    }
  };

  // 获取问题类型的样式
  const getTypeStyle = (group) => {
    switch (group.type) {
      case 'scale':
        return {
          text: '量表题',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        };
      case 'single':
        return {
          text: '单选题',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-200'
        };
      case 'open':
        return {
          text: '开放题',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-700',
          borderColor: 'border-purple-200'
        };
      default:
        return {
          text: '其他',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        };
    }
  };

  // 处理字段选择的回调函数
  const handleFieldSelect = useCallback((mainQuestion) => {
    setSelectedFields(prev => {
      const isSelected = prev.includes(mainQuestion);
      if (isSelected) {
        return prev.filter(field => field !== mainQuestion);
      } else {
        return [...prev, mainQuestion];
      }
    });
  }, []);

  // 添加调试用的useEffect
  useEffect(() => {
    console.log('selectedFields changed:', selectedFields);
  }, [selectedFields]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToHome}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回首页</span>
              </button>
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">问卷文本分析</h1>
                <p className="text-sm text-gray-500">使用AI技术进行智能问卷分析和洞察</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <User className="h-5 w-5" />
                <span>欢迎，{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>退出</span>
              </button>
            </div>
          </div>
        </div>
      </header>

         {/* Main Content */}
         <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl">
            {/* Page Header */}
            <motion.div
              className="text-center p-8 border-b border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                问卷文本分析系统
              </h2>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                上传问卷数据文件，使用AI技术进行智能分析，包括情绪分析、话题归类、关键词提取、内容摘要和数据看板
              </p>

              {/* Features */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4 mx-auto">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    智能分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    使用先进的AI技术自动分析问卷文本，提取关键信息和洞察
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4 mx-auto">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    多维度分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    支持情绪分析、话题归类、关键词提取和内容摘要等多种分析方式
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4 mx-auto">
                    <PieChart className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    数据统计
                  </h3>
                  <p className="text-gray-600 text-sm">
                    按标签汇总用户数量、比例等统计数据，输出代表性语句
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4 mx-auto">
                    <LineChart className="w-6 h-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    趋势分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    分析数据的时间趋势和变化模式，提供改进建议
                  </p>
                </motion.div>
              </div>
            </motion.div>

               {/* Page Tabs */}
               <div className="border-b border-gray-200">
              <div className="flex space-x-1 px-8 pt-6">
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${pageTab === 'upload'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={() => setPageTab('upload')}
                >
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    文件上传
                  </div>
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${pageTab === 'config'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={() => setPageTab('config')}
                  disabled={loading || !analysisId}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    分析配置
                  </div>
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${pageTab === 'results'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={() => setPageTab('results')}
                  disabled={loading || !analysisId}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    统计分析
                  </div>
                </button>
              </div>
            </div>



          {/* Tab Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <div className="space-y-6">

                      {/* Upload Tab */}
                  {pageTab === 'upload' && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* 拖拽上传区域 */}
                      <div className="space-y-6">
                        {!file ? (
                          <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${isDragActive
                                ? 'border-blue-400 bg-blue-50 scale-[1.02]'
                                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                              }`}
                          >
                            <input {...getInputProps()} />
                            <div className="flex flex-col items-center space-y-4">
                              <div className="p-4 bg-blue-100 rounded-full">
                                <Upload className="w-8 h-8 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                  上传问卷数据文件
                                </h3>
                                <p className="text-gray-600 mb-4">
                                  拖拽文件到此处，或点击选择文件
                                </p>
                                <p className="text-sm text-gray-500">
                                  支持 CSV、Excel (.xlsx/.xls) 格式，最大 10MB
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                {getFileIcon(file.name)}
                                <div>
                                  <h4 className="font-semibold text-gray-900">{file.name}</h4>
                                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>准备上传</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={removeFile}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="flex space-x-3">
                              <button
                                onClick={handleUpload}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center space-x-2"
                              >
                                {loading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>上传中...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    <span>开始上传</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 上传结果显示 */}
                        {uploadInfo && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-green-50 border border-green-200 rounded-xl p-6"
                          >
                            <div className="flex items-start space-x-3">
                              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-semibold text-green-900 mb-2">上传成功</h4>
                                <div className="space-y-2 text-sm text-green-700">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="font-medium">文件名：</span>
                                      <span>{uploadInfo.filename}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">文件大小：</span>
                                      <span>{formatFileSize(uploadInfo.fileSize)}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">记录数：</span>
                                      <span>{uploadInfo.rowCount} 条</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">字段数：</span>
                                      <span>{uploadInfo.columnCount || uploadInfo.columns?.length || 0} 个</span>
                                    </div>
                                  </div>

                                  {uploadInfo.columns && uploadInfo.columns.length > 0 && (
                                    <div className="mt-4">
                                      <span className="font-medium">检测到的字段：</span>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {uploadInfo.columns.map((col, index) => (
                                          <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                            {col}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {uploadInfo.preview && uploadInfo.preview.length > 0 && (
                                    <div className="mt-4">
                                      <span className="font-medium">数据预览：</span>
                                      <div className="mt-2 bg-white border border-green-200 rounded-lg p-3 max-h-40 overflow-auto">
                                        <pre className="text-xs text-gray-700">
                                          {JSON.stringify(uploadInfo.preview, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* 错误提示 */}
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-200 rounded-xl p-6"
                          >
                            <div className="flex items-start space-x-3">
                              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="font-semibold text-red-900 mb-1">上传失败</h4>
                                <p className="text-sm text-red-700">{error}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  



                    {/* Config Tab */}
                    {pageTab === 'config' && uploadInfo && (
                      <motion.div
                        key="config"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                      <div className="space-y-6">
                          {/* 工作流程指引 */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              分析工作流程
                            </h3>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                                <div className="text-sm">
                                  <div className="font-medium text-gray-800">题型识别配置</div>
                                  <div className="text-gray-600">查看字段分类</div>
                                </div>
                              </div>
                              <div className="hidden md:flex items-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                                <div className="text-sm">
                                  <div className="font-medium text-gray-800">数据打标</div>
                                  <div className="text-gray-600">智能分类处理(若无开放题，则跳过打标)</div>
                                </div>
                              </div>
                              <div className="hidden md:flex items-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                                <div className="text-sm">
                                  <div className="font-medium text-gray-800">统计分析</div>
                                  <div className="text-gray-600">选择字段和分析</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        
                          <div className="bg-white rounded-xl border border-gray-300 p-6">
                            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                              <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                              题型识别与分析配置
                            </h3>

                      
                            {/* Question Type Recognition Results */}
                            {uploadInfo.questionTypes && (
                              <div className="mb-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    题型识别结果
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 text-sm">
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-blue-600">
                                        {uploadInfo.questionTypes?.scaleQuestions?.length || 0}
                                      </div>
                                      <div className="text-gray-600">量表题</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-orange-600">
                                        {uploadInfo.questionTypes?.singleChoice?.length || 0}
                                      </div>
                                      <div className="text-gray-600">单选题</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-red-600">
                                        {uploadInfo.questionTypes?.openEnded?.length || 0}
                                      </div>
                                      <div className="text-gray-600">开放题</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Debug Area - Show raw data structure */}
                            <div className="mb-6">
                              <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                                  📋 查看原始数据结构 (调试信息)
                                </summary>
                                <div className="mt-3 text-sm">
                                  <h5 className="font-medium text-gray-800 mb-2">文件信息:</h5>
                                  <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                    {JSON.stringify({
                                      filename: uploadInfo.filename,
                                      fileSize: uploadInfo.fileSize,
                                      rowCount: uploadInfo.rowCount,
                                      columnCount: uploadInfo.columnCount,
                                      analysisId: uploadInfo.analysisId
                                    }, null, 2)}
                                  </pre>

                                  <h5 className="font-medium text-gray-800 mt-4 mb-2">列名列表:</h5>
                                  <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                    {JSON.stringify(uploadInfo.columns, null, 2)}
                                  </pre>

                                  <h5 className="font-medium text-gray-800 mt-4 mb-2">题型识别结果:</h5>
                                  <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                                    {JSON.stringify(uploadInfo.questionTypes, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </div>

  {/* 2. 开始打标按钮区域 */}
  <div className="mt-8 pt-6 border-t border-gray-200">
                              <div className="mb-4">
                                <h4 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                  数据打标
                                </h4>
                                <p className="text-sm text-gray-600">
                                  对上传的问卷数据进行智能分类和标签处理，识别问题类型并生成分析标签
                                </p>
                                <p className="text-sm text-blue-600 mt-1">
                                  💡 若无开放题，则跳过打标
                                </p>
                              </div>

                              {/* 字段选择状态提示 */}
                              <div className="mb-4">
                                {selectedFields.length > 0 ? (
                                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>已准备处理 {selectedFields.length} 个字段</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>系统将自动处理所有开放性问题字段</span>
                                  </div>
                                )}
                              </div>

                              {/* Classification错误显示 */}
                              {classificationError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-red-800">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="font-medium">数据处理失败</span>
                                  </div>
                                  <div className="mt-1 text-sm text-red-700">{classificationError}</div>
                                </div>
                              )}

                              {/* 开始打标按钮 */}
                              <div className="flex justify-center">
                                <button
                                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                  onClick={handleClassification}
                                  disabled={classificationLoading || !analysisId}
                                >
                                  {classificationLoading ? (
                                    <>
                                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>处理中...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                      </svg>
                                      <span>🏷️ 开始打标</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* 打标进度条 */}
                              {showTaggingProgress && (
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                  <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-medium text-blue-800">打标进度</h4>
                                    <span className="text-sm text-blue-700">{taggingProgress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                                      style={{ width: `${taggingProgress}%` }}
                                    ></div>
                                  </div>
                                  <p className="mt-2 text-sm text-blue-600">{taggingStatus}</p>
                                </div>
                              )}

                              {/* 调试信息 */}
                              <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                <div>调试信息:</div>
                                <div>analysisId: {analysisId || '未设置'}</div>
                                <div>检测到字段: {uploadInfo?.columns?.length || 0} 个</div>
                                <div>uploadInfo: {uploadInfo ? '已加载' : '未加载'}</div>
                              </div>

                              {/* Classification处理结果表格 */}
                              {classificationResult && classificationResult.processed_data && (
                                <div className="mt-8 pt-6 border-t border-gray-200">
                                  <div className="mb-4">
                                    <div className="flex justify-between items-center">
                                      <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <Table className="w-5 h-5 text-green-600" />
                                        分类处理结果 (前10行预览)
                                      </h4>
                                      <button
                                        onClick={downloadClassificationResult}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                      >
                                        <Download className="w-4 h-4" />
                                        下载完整结果
                                      </button>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      已完成开放性问题的智能分类处理，以下是处理后的数据预览
                                    </p>
                            </div>

                                  {/* 处理结果摘要 */}
                                  {classificationResult.summary && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                      <h5 className="font-semibold text-green-900 mb-2">处理摘要</h5>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-green-600">{classificationResult.summary.total_responses || 0}</div>
                                          <div className="text-gray-600">总响应数</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-blue-600">{classificationResult.summary.processed_fields || 0}</div>
                                          <div className="text-gray-600">已处理字段</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-purple-600">
                                            {classificationResult.processed_data ? Object.keys(classificationResult.processed_data).length : 0}
                                          </div>
                                          <div className="text-gray-600">处理字段数</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-orange-600">10</div>
                                          <div className="text-gray-600">预览行数</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* 数据表格 */}
                                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    {/* 表格说明 */}
                                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-700">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>表格支持上下左右滚动查看完整数据 • 共 {Object.keys(classificationResult.processed_data).length} 个字段 • 显示前10行</span>
                                      </div>
                                    </div>
                                    
                                    {/* 可滚动表格容器 */}
                                    <div className="overflow-auto max-h-96 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                      <table className="min-w-full border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300 bg-gray-50 sticky left-0 z-20 min-w-[60px]">
                                              <div className="flex items-center">
                                                <span className="text-xs text-gray-500">#</span>
                                              </div>
                                            </th>
                                            {classificationResult.processed_data.map((item, index) => (
                                                <th key={item.field} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-300 bg-gray-50 min-w-[150px] max-w-[250px]">
                                                  <div className="flex flex-col">
                                                    <span className="truncate" title={item.field}>
                                                      {item.field}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-normal">
                                                      字段 {index + 1}
                                                    </span>
                                                  </div>
                                                </th>
                                             ))}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {Array.from({ length: Math.min(10, classificationResult.sample_size || 10) }, (_, index) => (
                                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 text-sm text-gray-500 border-b border-gray-200 font-mono bg-gray-50 sticky left-0 z-10 min-w-[60px]">
                                                <div className="flex items-center justify-center">
                                                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                                                    {index + 1}
                                                  </span>
                                                </div>
                                              </td>
                                              {classificationResult.processed_data.map((item) => (
                                                <td key={item.field} className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 min-w-[150px] max-w-[250px]">
                                                  <div className="group relative">
                                                    <div 
                                                      className="truncate cursor-help"
                                                      title={item.values[index] || '-'}
                                                    >
                                                      {item.values[index] || '-'}
                                                    </div>
                                                    {/* 悬停时显示完整内容 */}
                                                    {item.values[index] && item.values[index].length > 20 && (
                                                      <div className="invisible group-hover:visible absolute bottom-full left-0 z-30 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg transform -translate-y-1">
                                                        <div className="break-words whitespace-pre-wrap">
                                                          {item.values[index]}
                                                        </div>
                                                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    
                                    {/* 表格底部信息 */}
                                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                                      <div className="flex justify-between items-center">
                                        <span>显示第 1-10 行，共 {classificationResult.sample_size || 10} 行数据预览</span>
                                        <span>
                                          字段数：{classificationResult.processed_data.length} 个
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 表格说明 */}
                                  <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                                    <div className="flex items-center gap-2 mb-2">
                                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="font-medium">使用说明：</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                                      <ul className="list-disc list-inside space-y-1">
                                        <li>表格支持上下左右滚动查看完整数据</li>
                                        <li>鼠标悬停在单元格上查看完整内容</li>
                                        <li>第一列行号固定，方便对照</li>
                                        <li>此预览仅显示前10行数据</li>
                                      </ul>
                                      <ul className="list-disc list-inside space-y-1">
                                        <li>完整数据请点击"下载完整结果"按钮获取</li>
                                        <li>处理后的数据包含了智能分类和翻译结果</li>
                                        <li>每个开放性问题字段都经过了AI分析处理</li>
                                        <li>字段总数显示在表格顶部和底部</li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>







                            </div>












                      </div>
                      </motion.div>
                    )}








              </div>
              {pageTab === 'results' && (
                          <motion.div
                            key="results"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* 统计分析功能区域 */}
                            <div className="space-y-6 mb-8">
                              {/* 统计分析标题和说明 */}
                              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5 text-green-600" />
                                  统计分析功能
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                          基于已选择的字段进行专业的统计分析，生成图表和洞察报告
                                        </p>

                                {/* 字段选择区域 */}
                                <div className="mb-6">
                                  <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-blue-600" />
                                    选择分析字段
                                  </h4>
                                  
                                  {(() => {
                                    // 检查是否有开放题
                                    const openEndedCount = uploadInfo?.questionTypes?.openEnded?.length || 0;
                                    // 如果没有开放题，直接显示字段选择；如果有开放题，需要检查是否完成数据打标
                                    return openEndedCount === 0 || (classificationResult && classificationResult.processed_data && classificationResult.processed_data.length > 0);
                                  })() ? (
                                    <div className="space-y-3">
                                      <div className="text-sm text-gray-600 mb-3">
                                        请选择要进行统计分析的字段：
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto p-2">
                                        {(() => {
                                          // 将 Map 转换为数组并按题型分组
                                          const groups = Array.from(groupedFields.values());
                                          console.log('渲染字段选择区域，当前groupedFields:', groups);
                                          
                                          // 确保所有打标后的字段都被包含
                                          if (classificationResult && classificationResult.processed_data) {
                                            console.log('检查打标后的字段是否都已包含');
                                            
                                            // 创建一个临时Map来存储所有字段
                                            const allFieldsMap = new Map(groupedFields);
                                            
                                            // 处理打标后的数据，确保所有字段都被包含
                                            classificationResult.processed_data.forEach(item => {
                                              if (!item.field) return;
                                              
                                              // 检查这个字段是否已经在任何现有组中
                                              let fieldExists = false;
                                              let existingGroup = null;
                                              
                                              for (const [key, group] of allFieldsMap.entries()) {
                                                if (group.fields.includes(item.field)) {
                                                  fieldExists = true;
                                                  existingGroup = key;
                                                  break;
                                                }
                                              }
                                              
                                              // 如果字段不存在于任何组中
                                              if (!fieldExists) {
                                                // 尝试找到对应的主问题
                                                const mainQuestionMatch = item.field.match(/^([Qq]\d+)/);
                                                if (mainQuestionMatch) {
                                                  const mainQuestion = mainQuestionMatch[0];
                                                  
                                                  // 如果已有该主问题的分组，则添加到该分组
                                                  if (allFieldsMap.has(mainQuestion)) {
                                                    const group = allFieldsMap.get(mainQuestion);
                                                    if (!group.fields.includes(item.field)) {
                                                      group.fields.push(item.field);
                                                      console.log(`添加字段 ${item.field} 到现有组 ${mainQuestion}`);
                                                    }
                                                  } else {
                                                    // 否则创建新的分组
                                                    allFieldsMap.set(mainQuestion, {
                                                      mainQuestion: mainQuestion,
                                                      fields: [item.field],
                                                      type: 'open' // 默认为开放题
                                                    });
                                                    console.log(`创建新组 ${mainQuestion} 并添加字段 ${item.field}`);
                                                  }
                                                }
                                              } else {
                                                console.log(`字段 ${item.field} 已存在于组 ${existingGroup}`);
                                              }
                                            });
                                            
                                            // 使用更新后的allFieldsMap
                                            const updatedGroups = Array.from(allFieldsMap.values());
                                            console.log('更新后的groups:', updatedGroups);
                                            
                                            const groupedByType = {
                                              scale: updatedGroups.filter(g => g.type === 'scale'),
                                              single: updatedGroups.filter(g => g.type === 'single'),
                                              open: updatedGroups.filter(g => g.type === 'open')
                                            };
                                            
                                            // 按题型顺序渲染
                                            return ['scale', 'single', 'open'].map(type => {
                                              const typeGroups = groupedByType[type];
                                              if (!typeGroups.length) return null;
                                              
                                              return typeGroups.map((group, index) => {
                                                const typeStyle = getTypeStyle(group);
                                                const isSelected = selectedFields.includes(group.mainQuestion);
                                                
                                                console.log('Rendering group:', {
                                                  mainQuestion: group.mainQuestion,
                                                  fields: group.fields,
                                                  isSelected,
                                                  currentSelectedFields: selectedFields
                                                });

                                                const handleChange = (e) => {
                                                  if (e.target.checked) {
                                                    setSelectedFields(prev => [...prev, group.mainQuestion]);
                                                  } else {
                                                    setSelectedFields(prev => prev.filter(f => f !== group.mainQuestion));
                                                  }
                                                };

                                                return (
                                                  <div key={index} className={`bg-white border ${typeStyle.borderColor} rounded-lg p-4 hover:shadow-md transition-shadow h-auto`}>
                                                    <div className="flex items-start space-x-3">
                                                      <div className="pt-1">
                                                        <input
                                                          type="checkbox"
                                                          checked={isSelected}
                                                          onChange={handleChange}
                                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                      </div>
                                                      <div 
                                                        className="flex-1 min-w-0"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          handleChange({
                                                            target: { checked: !isSelected }
                                                          });
                                                        }}
                                                      >
                                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                                          <h3 className="text-lg font-medium text-gray-800 break-words">{group.mainQuestion}</h3>
                                                          <span className={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap ${typeStyle.bgColor} ${typeStyle.textColor}`}>
                                                            {typeStyle.text}
                                                          </span>
                                                        </div>
                                                        <div className="mt-2 text-sm text-gray-600">
                                                          包含 {group.fields.length} 个子字段
                                                        </div>
                                                        {/* 显示子字段列表 */}
                                                        <div className="mt-2 text-xs text-gray-500">
                                                          {group.fields.slice(0, 2).map((field, i) => (
                                                            <div key={i} className="break-words">{field}</div>
                                                          ))}
                                                          {group.fields.length > 2 && (
                                                            <div className="text-gray-400">
                                                              还有 {group.fields.length - 2} 个字段...
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              });
                                            });
                                          }
                                          
                                          // 如果没有打标结果，使用原始的groupedFields
                                          const groupedByType = {
                                            scale: groups.filter(g => g.type === 'scale'),
                                            single: groups.filter(g => g.type === 'single'),
                                            open: groups.filter(g => g.type === 'open')
                                          };

                                          // 按题型顺序渲染
                                          return ['scale', 'single', 'open'].map(type => {
                                            const typeGroups = groupedByType[type];
                                            if (!typeGroups.length) return null;

                                            return typeGroups.map((group, index) => {
                                              const typeStyle = getTypeStyle(group);
                                              const isSelected = selectedFields.includes(group.mainQuestion);

                                              const handleChange = (e) => {
                                                if (e.target.checked) {
                                                  setSelectedFields(prev => [...prev, group.mainQuestion]);
                                                } else {
                                                  setSelectedFields(prev => prev.filter(f => f !== group.mainQuestion));
                                                }
                                              };

                                              return (
                                                <div key={index} className={`bg-white border ${typeStyle.borderColor} rounded-lg p-4 hover:shadow-md transition-shadow h-auto`}>
                                                  <div className="flex items-start space-x-3">
                                                    <div className="pt-1">
                                                      <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={handleChange}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                      />
                                                    </div>
                                                    <div 
                                                      className="flex-1 min-w-0"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        handleChange({
                                                          target: { checked: !isSelected }
                                                        });
                                                      }}
                                                    >
                                                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                                        <h3 className="text-lg font-medium text-gray-800 break-words">{group.mainQuestion}</h3>
                                                        <span className={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap ${typeStyle.bgColor} ${typeStyle.textColor}`}>
                                                          {typeStyle.text}
                                                        </span>
                                                      </div>
                                                      <div className="mt-2 text-sm text-gray-600">
                                                        包含 {group.fields.length} 个子字段
                                                      </div>
                                                      {/* 显示子字段列表 */}
                                                      <div className="mt-2 text-xs text-gray-500">
                                                        {group.fields.slice(0, 2).map((field, i) => (
                                                          <div key={i} className="break-words">{field}</div>
                                                        ))}
                                                        {group.fields.length > 2 && (
                                                          <div className="text-gray-400">
                                                            还有 {group.fields.length - 2} 个字段...
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            });
                                          });
                                        })()}
                                      </div>

                                      {/* 快速选择按钮 */}
                                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            // 获取所有主问题
                                            const allMainQuestions = Array.from(groupedFields.values()).map(group => group.mainQuestion);
                                            setSelectedFields(allMainQuestions);
                                          }}
                                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                        >
                                          全选
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedFields([])}
                                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                        >
                                          清空
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 bg-orange-50 border border-orange-200 p-4 rounded-lg">
                                      <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        <span className="font-medium text-orange-800">请先完成数据打标</span>
                                      </div>
                                      <div className="text-orange-700">
                                        请先在"分析配置"页面点击"🏷️ 开始打标"按钮完成数据处理，然后返回此页面选择要分析的字段。
                                      </div>
                                    </div>
                                  )}

                                  {/* 选择状态提示 */}
                                  <div className="mt-3">
                                        {selectedFields.length > 0 ? (
                                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 p-3 rounded-lg">
                                            <CheckCircle className="w-4 h-4" />
                                            <span>已选择 {selectedFields.length} 个字段进行统计分析</span>
                                          </div>
                                        ) : (
                                      <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-100 p-3 rounded-lg">
                                            <AlertCircle className="w-4 h-4" />
                                        <span>请选择至少一个字段进行分析</span>
                                          </div>
                                        )}
                                  </div>
                                      </div>

                                      {/* 统计分析按钮 */}
                                      <div className="flex justify-center">
                                        <button
                                          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                          onClick={handleAnalyze}
                                    disabled={loading || !analysisId || selectedFields.length === 0 || (() => {
                                      // 检查是否有开放题
                                      const openEndedCount = uploadInfo?.questionTypes?.openEnded?.length || 0;
                                      // 如果没有开放题，不需要检查数据打标；如果有开放题，需要检查是否完成数据打标
                                      return openEndedCount > 0 && !classificationResult?.processed_data;
                                    })()}
                                        >
                                          {loading ? (
                                            <>
                                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                              <span>分析中...</span>
                                            </>
                                          ) : (
                                            <>
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                              </svg>
                                              <span>📊 开始统计分析</span>
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {/* 统计分析进度条 */}
                                      {showAnalysisProgress && (
                                        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 shadow-sm">
                                          <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-medium text-green-800">分析进度</h4>
                                            <span className="text-sm text-green-700">{analysisProgress}%</span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                              className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                                              style={{ width: `${analysisProgress}%` }}
                                            ></div>
                                          </div>
                                          <p className="mt-2 text-sm text-green-600">{analysisStatus}</p>
                                        </div>
                                      )}

                                      {/* 分析说明 */}
                                <div className="mt-4 text-sm text-gray-600 bg-white p-3 rounded">
                                  <div className="font-medium mb-2 text-gray-800">📋 分析流程说明：</div>
                                  <div className="mb-3 text-green-700 bg-green-50 p-2 rounded text-xs">
                                    ✅ 基于打标处理后的数据进行统计分析，确保数据质量和一致性
                                  </div>
                                  <div className="font-medium mb-1">统计分析内容：</div>
                                        <ul className="list-disc list-inside space-y-1">
                                          <li>描述性统计：均值、中位数、标准差等</li>
                                          <li>频次分析：各选项的分布情况</li>
                                          <li>相关性分析：变量间的关联度</li>
                                          <li>可视化图表：柱状图、饼图、散点图等</li>
                                        </ul>
                                      </div>
                                    </div>
                      </div>

                            {/* 结果展示区域 */}
                            {analysisResult ? (
                              <>
                            {/* Result Type Tabs */}
                            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
                              <button
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'analysis' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                onClick={() => setActiveTab('analysis')}
                              >
                                    分析结果
                              </button>
                              <button
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                onClick={() => setActiveTab('dashboard')}
                              >
                                数据看板
                              </button>
                            </div>

                            {/* Result Content */}
                            <AnimatePresence mode="wait">
                              {activeTab === 'analysis' && analysisResult && (
                                <motion.div
                                  key="analysis"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-inner overflow-x-auto max-h-96">
                                    <div className="flex justify-between items-center mb-4">
                                      <h3 className="text-xl font-bold text-gray-800">文本分析结果</h3>
                                      <div className="flex space-x-2">
                                        <button
                                          className={`px-3 py-1 text-sm rounded-md transition-colors ${resultViewMode === 'structured'
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                          onClick={() => setResultViewMode('structured')}
                                        >
                                          结构化视图
                                        </button>
                                        <button
                                          className={`px-3 py-1 text-sm rounded-md transition-colors ${resultViewMode === 'json'
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                          onClick={() => setResultViewMode('json')}
                                        >
                                          JSON视图
                                        </button>
                                      </div>
                                    </div>
                                    {resultViewMode === 'structured' ? (
                                      renderAnalysisResult(formatAnalysisResult(analysisResult))
                                    ) : (
                                      <pre className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                                        {JSON.stringify(formatAnalysisResult(analysisResult), null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                </motion.div>
                              )}

                              {activeTab === 'dashboard' && (
                                <motion.div
                                  key="dashboard"
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <div className="space-y-6">
                                    <div className="text-center mb-8">
                                      <h3 className="text-2xl font-bold text-gray-900 mb-2">数据分析看板</h3>
                                      <p className="text-gray-600">所选变量的描述性分析图表</p>
                                    </div>

                                    {analysisResult ? (() => {
                                      const formattedResult = formatAnalysisResult(analysisResult);
                                      const scaleQuestions = formattedResult.scaleQuestions || [];
                                      const singleChoiceQuestions = formattedResult.singleChoiceQuestions || [];
                                      const openEndedQuestions = formattedResult.openEndedQuestions || [];

                                      return (
                                        <div className="space-y-8">
                                          {/* 量表题 - 仪表盘展示 */}
                                          {scaleQuestions.length > 0 && (
                                            <div className="bg-white rounded-lg shadow-lg p-6">
                                              <h4 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                                <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                                                量表题分析 ({scaleQuestions.length}题)
                                              </h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {scaleQuestions.map((question, index) => {
                                                  const avgScore = question.statistics?.mean || 0;
                                                  const maxScore = question.statistics?.max || 10;
                                                  const percentage = (avgScore / maxScore) * 100;

                                                  return (
                                                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                                                      <h5 className="font-medium text-gray-800 mb-4 text-sm">{question.column}</h5>
                                                      <div className="relative w-40 h-40 mx-auto">
                                                        {/* 仪表盘 */}
                                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                          {/* 背景圆弧 */}
                                                          <path
                                                            d="M 20 50 A 30 30 0 1 1 80 50"
                                                            fill="none"
                                                            stroke="#e5e7eb"
                                                            strokeWidth="8"
                                                            strokeLinecap="round"
                                                          />
                                                          {/* 进度圆弧 */}
                                                          <path
                                                            d="M 20 50 A 30 30 0 1 1 80 50"
                                                            fill="none"
                                                            stroke="url(#gaugeGradient)"
                                                            strokeWidth="8"
                                                            strokeLinecap="round"
                                                            strokeDasharray={`${(percentage / 100) * 188.5} 188.5`}
                                                            className="transition-all duration-1000 ease-out"
                                                          />
                                                          {/* 渐变定义 */}
                                                          <defs>
                                                            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                              <stop offset="0%" stopColor="#ef4444" />
                                                              <stop offset="50%" stopColor="#f59e0b" />
                                                              <stop offset="100%" stopColor="#10b981" />
                                                            </linearGradient>
                                                          </defs>
                                                        </svg>
                                                        {/* 中心数值 */}
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                          <div className="text-2xl font-bold text-gray-800">{avgScore.toFixed(1)}</div>
                                                          <div className="text-xs text-gray-500">平均分</div>
                                                        </div>
                                                      </div>
                                                      <div className="mt-4 text-center">
                                                        <div className="text-xs text-gray-500">
                                                          样本数: {question.statistics?.count || 0}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                          标准差: {question.statistics?.std?.toFixed(2) || 0}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}

                                          {/* 单选题 - 环形图展示 */}
                                          {singleChoiceQuestions.length > 0 && (
                                            <div className="bg-white rounded-lg shadow-lg p-6">
                                              <h4 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                                <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                                                单选题分析 ({singleChoiceQuestions.length}题)
                                              </h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {singleChoiceQuestions.map((question, index) => {
                                                  const options = question.options || [];
                                                  const total = options.reduce((sum, opt) => sum + opt.count, 0);
                                                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

                                                  let currentAngle = 0;
                                                  const segments = options.map((option, i) => {
                                                    const percentage = total > 0 ? (option.count / total) * 100 : 0;
                                                    const angle = (percentage / 100) * 360;
                                                    const startAngle = currentAngle;
                                                    currentAngle += angle;

                                                    return {
                                                      ...option,
                                                      percentage,
                                                      startAngle,
                                                      endAngle: currentAngle,
                                                      color: colors[i % colors.length]
                                                    };
                                                  });

                                                  return (
                                                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                                                      <h5 className="font-medium text-gray-800 mb-4 text-sm">{question.column}</h5>
                                                      <div className="relative w-40 h-40 mx-auto">
                                                        <svg className="w-full h-full" viewBox="0 0 100 100">
                                                          {segments.length === 1 && segments[0].percentage === 100 ? (
                                                            // 当只有一个选项且占比100%时，绘制完整圆形
                                                            <circle 
                                                              cx="50" 
                                                              cy="50" 
                                                              r="35" 
                                                              fill={segments[0].color} 
                                                              className="transition-all duration-500 hover:opacity-80"
                                                            />
                                                          ) : (
                                                            // 正常情况下绘制多个扇形
                                                            segments.map((segment, i) => {
                                                              const startAngleRad = (segment.startAngle - 90) * Math.PI / 180;
                                                              const endAngleRad = (segment.endAngle - 90) * Math.PI / 180;
                                                              const largeArcFlag = segment.percentage > 50 ? 1 : 0;

                                                              const x1 = 50 + 35 * Math.cos(startAngleRad);
                                                              const y1 = 50 + 35 * Math.sin(startAngleRad);
                                                              const x2 = 50 + 35 * Math.cos(endAngleRad);
                                                              const y2 = 50 + 35 * Math.sin(endAngleRad);

                                                              const pathData = [
                                                                `M 50 50`,
                                                                `L ${x1} ${y1}`,
                                                                `A 35 35 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                                                                `Z`
                                                              ].join(' ');

                                                              return (
                                                                <path
                                                                  key={i}
                                                                  d={pathData}
                                                                  fill={segment.color}
                                                                  className="transition-all duration-500 hover:opacity-80"
                                                                />
                                                              );
                                                            })
                                                          )}
                                                          {/* 中心圆 */}
                                                          <circle cx="50" cy="50" r="15" fill="white" />
                                                        </svg>
                                                        {/* 中心文字 */}
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                          <div className="text-lg font-bold text-gray-800">{total}</div>
                                                          <div className="text-xs text-gray-500">总数</div>
                                                        </div>
                                                      </div>
                                                      {/* 图例 */}
                                                      <div className="mt-4 space-y-1">
                                                        {segments.map((segment, i) => (
                                                          <div key={i} className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center">
                                                              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: segment.color }}></div>
                                                              <span className="text-gray-600 break-words w-40">{segment?.value || segment?.option}</span>
                                                            </div>
                                                            <span className="text-gray-800 font-medium">{segment.percentage.toFixed(1)}%</span>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}

                                          {/* 开放题分析 */}
                                          {openEndedQuestions.length > 0 && (
                                            <div className="bg-white rounded-lg shadow-lg p-6">
                                              <h4 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                                                <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
                                                开放题分析 ({openEndedQuestions.length}题)
                                              </h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {openEndedQuestions.map((question, index) => (
                                                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                                                    <h5 className="font-medium text-gray-800 mb-4 text-sm">{question.column}</h5>
                                                    <div className="space-y-2 text-sm">
                                                      <div>有效响应: <span className="font-bold text-green-700">{question.validResponses}</span></div>
                                                      <div>平均长度: <span className="font-bold text-blue-700">{question.statistics?.averageLength || 0}</span> 字符</div>
                                                      <div>唯一回答: <span className="font-bold text-purple-700">{question.statistics?.uniqueCount || 0}</span></div>
                                                      <div>唯一性比例: <span className="font-bold text-orange-700">{(question.statistics?.uniquenessRatio * 100)?.toFixed(1)}%</span></div>
                                                    </div>
                                                    {question.topKeywords && question.topKeywords.length > 0 && (
                                                      <div className="mt-4">
                                                        <div className="font-medium text-xs text-gray-600 mb-1">高频词汇：</div>
                                                        <div className="flex flex-wrap gap-1">
                                                          {question.topKeywords.slice(0, 8).map((keyword, kwIndex) => (
                                                            <span key={kwIndex} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                                              {keyword.word} ({keyword.count})
                                                            </span>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    )}
                                                    {question.sampleResponses && question.sampleResponses.length > 0 && (
                                                      <div className="mt-4">
                                                        <div className="font-medium text-xs text-gray-600 mb-1">示例回答：</div>
                                                        <div className="space-y-1">
                                                          {question.sampleResponses.slice(0, 3).map((response, resIndex) => (
                                                            <div key={resIndex} className="text-xs text-gray-700 italic border-l-2 border-gray-300 pl-2">
                                                              "{response}"
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })() : (
                                      <div className="text-center py-12">
                                        <div className="text-gray-400 text-lg mb-2">📊</div>
                                        <p className="text-gray-500">暂无分析结果</p>
                                        <p className="text-gray-400 text-sm mt-1">请先上传数据并进行分析</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                          </AnimatePresence>
                              </>
                            ) : (
                              <div className="text-center py-12">
                                <div className="text-gray-400 text-lg mb-2">📊</div>
                                <p className="text-gray-500 mb-2">暂无统计分析结果</p>
                                <p className="text-gray-400 text-sm">请先选择字段并点击"📊 开始统计分析"按钮</p>
                              </div>
                            )}
                  </motion.div>
                  )} 
            </AnimatePresence>
          </div>






          </div>
        </div>
      </div>
    </div>
  );
};


 export default QuestionnaireAnalysis;
