import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Award, 
  TrendingUp, 
  User, 
  Briefcase, 
  GraduationCap, 
  Code, 
  Zap,
  RotateCcw,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import api from '../utils/request';
const CandidateRanking = ({ candidates, jobDescription, onStartOver, duplicateInfo, originalCount, removedCount }) => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [expandedStrengths, setExpandedStrengths] = useState(new Set());
  const [expandedSkills, setExpandedSkills] = useState(new Set());
  const [showDuplicateInfo, setShowDuplicateInfo] = useState(false);

  // Get jobId from the first candidate (all candidates in a ranking should have the same jobId)
  const jobId = candidates.length > 0 ? candidates[0].jobId : null;

  // Handle PDF viewing
  const handleViewPdf = (candidate) => {
    if (!candidate.hasPdf || !jobId) {
      alert('PDF文件不可用');
      return;
    }
    
    const pdfUrl = `/test/api/pdf/${jobId}/${candidate.id}`;
    window.open(pdfUrl, '_blank');
  };

  // Toggle expanded state for strengths and skills
  const toggleStrengthsExpanded = (candidateId) => {
    const newExpanded = new Set(expandedStrengths);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
    }
    setExpandedStrengths(newExpanded);
  };

  const toggleSkillsExpanded = (candidateId) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
    }
    setExpandedSkills(newExpanded);
  };

  // Filter candidates based on search and tier
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = filterTier === 'all' || candidate.tier === filterTier;
    
    return matchesSearch && matchesTier;
  });

  const getTierColor = (tier) => {
    switch (tier) {
      case "顶级推荐": return "badge-green";
      case "优秀候选": return "badge-blue";
      case "中等匹配": return "badge-yellow";
      case "有限匹配": return "badge-orange";
      case "不太匹配": return "badge-red";
      default: return "badge-gray";
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getMatchColor = (match) => {
    switch (match) {
      case '完美匹配': return 'text-green-600';
      case '高度匹配': return 'text-blue-600';
      case '良好匹配': return 'text-yellow-600';
      case '潜力匹配': return 'text-purple-600';
      case '一般匹配': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case '强烈推荐': return 'text-green-600';
      case '推荐': return 'text-blue-600';
      case '一般推荐': return 'text-yellow-600';
      case '可考虑': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const tierOptions = [
    { value: 'all', label: '全部等级' },
    { value: '顶级推荐', label: '顶级推荐' },
    { value: '优秀候选', label: '优秀候选' },
    { value: '中等匹配', label: '中等匹配' },
    { value: '有限匹配', label: '有限匹配' },
    { value: '不太匹配', label: '不太匹配' }
  ];

  const exportResults = () => {
    const csvContent = [
      ['排名', '姓名', '职位', '公司', '教育背景', '经验', '评分', '等级', '匹配度', '推荐', '技能', '优势'].join(','),
      ...filteredCandidates.map(candidate => [
        candidate.rank,
        candidate.name,
        candidate.position,
        candidate.company,
        candidate.education,
        candidate.experience,
        candidate.score,
        candidate.tier,
        candidate.match,
        candidate.recommendation,
        candidate.skills.join('; '),
        candidate.strengths.slice(0, 2).join('; ')
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `candidate_ranking_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Award className="text-primary-600" />
              候选人排名结果
            </h1>
            <p className="text-gray-600">
              共分析了 <span className="font-semibold text-primary-600">{candidates.length}</span> 位候选人，
              以下是基于AI分析的排名结果
              {removedCount > 0 && (
                <span className="ml-2 text-sm text-orange-600">
                  (已自动去除 {removedCount} 份重复简历)
                </span>
              )}
            </p>
            
            {/* 重复检测信息 */}
            {duplicateInfo && duplicateInfo.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowDuplicateInfo(!showDuplicateInfo)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  查看重复简历处理详情
                  {showDuplicateInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showDuplicateInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <h4 className="font-medium text-blue-900 mb-3">重复简历处理详情</h4>
                    <div className="space-y-3">
                      {duplicateInfo.map((group, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-blue-800">
                            重复组 {group.groupId}: 保留 {group.keptCandidate.name} ({group.keptCandidate.score}分)
                          </div>
                          <div className="text-blue-700 ml-4">
                            移除: {group.removedCandidates.map(c => `${c.name} (${c.score}分)`).join(', ')}
                          </div>
                          <div className="text-blue-600 ml-4 text-xs">
                            原因: {group.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-700">
                      <strong>统计:</strong> 原始简历 {originalCount} 份 → 去重后 {candidates.length} 份 → 移除重复 {removedCount} 份
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <button
              onClick={exportResults}
              className="btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>导出结果</span>
            </button>
            <button
              onClick={onStartOver}
              className="btn-primary flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>新建分析</span>
            </button>
          </div>
        </div>

        {/* Job Requirements Summary */}
        {jobDescription && (
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">岗位需求概述</h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {jobDescription}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索候选人姓名、职位或公司..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Tier Filter */}
            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  {tierOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Candidates List */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <AnimatePresence>
              {filteredCandidates.map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`card card-hover p-6 cursor-pointer transition-all duration-200 ${
                    selectedCandidate?.id === candidate.id 
                      ? 'border-primary-500 shadow-lg ring-2 ring-primary-200' 
                      : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-800 font-bold text-lg">
                        {candidate.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-semibold text-gray-900">{candidate.name}</h3>
                          {candidate.isDeduplicated && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium border border-orange-200">
                              <FileText size={12} />
                              已去重
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">{candidate.position}</p>
                        <p className="text-sm text-gray-500">{candidate.company}</p>
                        {candidate.duplicateInfo && (
                          <p className="text-xs text-orange-600 mt-1">
                            {candidate.duplicateInfo}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className={`text-3xl font-bold ${getScoreColor(candidate.score)}`}>
                        {candidate.score}
                      </div>
                      <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getTierColor(candidate.tier)}`}>
                        {candidate.tier}
                      </div>
                      {/* View PDF Button */}
                      {/* {candidate.hasPdf && jobId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPdf(candidate);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                          title="查看简历PDF"
                        >
                          <FileText size={12} />
                          <span>查看完整简历</span>
                        </button>
                      )} */}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <GraduationCap size={16} />
                      <span>{candidate.education}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Briefcase size={16} />
                      <span>{candidate.experience}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">核心优势</h4>
                    <div className="space-y-1">
                      {(expandedStrengths.has(candidate.id) ? candidate.strengths : candidate.strengths.slice(0, 3)).map((strength, index) => (
                        <p key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                          {strength}
                        </p>
                      ))}
                      {candidate.strengths.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStrengthsExpanded(candidate.id);
                          }}
                          className="text-sm text-primary-600 font-medium hover:text-primary-700 cursor-pointer"
                        >
                          {expandedStrengths.has(candidate.id) 
                            ? '收起' 
                            : `+${candidate.strengths.length - 3} 更多优势...`
                          }
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {(expandedSkills.has(candidate.id) ? candidate.skills : candidate.skills.slice(0, 4)).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                    {candidate.skills.length > 4 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSkillsExpanded(candidate.id);
                        }}
                        className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs hover:bg-primary-200 cursor-pointer"
                      >
                        {expandedSkills.has(candidate.id) 
                          ? '收起' 
                          : `+${candidate.skills.length - 4}`
                        }
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${getMatchColor(candidate.match)}`}>
                      匹配度: {candidate.match}
                    </span>
                    <span className={`text-sm font-medium ${getRecommendationColor(candidate.recommendation)}`}>
                      {candidate.recommendation}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredCandidates.length === 0 && (
              <motion.div
                className="text-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  没有找到匹配的候选人
                </h3>
                <p className="text-gray-500">
                  请尝试修改搜索条件或筛选器
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Candidate Detail Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Selected Candidate Details */}
            <div className="card p-6">
              {selectedCandidate ? (
                <motion.div
                  key={selectedCandidate.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <User className="text-primary-600" />
                      <h2 className="text-xl font-semibold">{selectedCandidate.name}</h2>
                    </div>
                    {/* View PDF Button in Detail Panel */}
                    {selectedCandidate.hasPdf && jobId && (
                      <button
                        onClick={() => handleViewPdf(selectedCandidate)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                        title="查看简历PDF"
                      >
                        <FileText size={16} />
                        <span>查看简历</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <TrendingUp size={16} />
                        核心优势
                      </h3>
                      <ul className="space-y-2">
                        {selectedCandidate.strengths.map((strength, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Briefcase size={16} />
                        代表项目
                      </h3>
                      <ul className="space-y-2">
                        {selectedCandidate.projects.map((project, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-success-500 rounded-full mt-2 flex-shrink-0"></div>
                            {project}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Code size={16} />
                        技术技能
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCandidate.skills.map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedCandidate.summary && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-2">
                          候选人总结
                        </h3>
                        <p className="text-sm text-gray-600">
                          {selectedCandidate.summary}
                        </p>
                      </div>
                    )}

                    {selectedCandidate.reasoning && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          <Zap size={16} />
                          评分理由
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {selectedCandidate.reasoning}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className={`text-2xl font-bold ${getScoreColor(selectedCandidate.score)}`}>
                            {selectedCandidate.score}
                          </div>
                          <div className="text-sm text-gray-600">综合评分</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary-600">#{selectedCandidate.rank}</div>
                          <div className="text-sm text-gray-600">排名</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center text-gray-500">
                  <User size={48} className="mx-auto mb-4 opacity-50" />
                  <p>点击左侧候选人查看详细信息</p>
                </div>
              )}
            </div>

            {/* Summary Statistics */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Star className="text-warning-500" />
                分析总结
              </h3>
              <div className="space-y-3 text-sm">
                {candidates.length > 0 && (
                  <>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-800">
                        首选推荐：{candidates[0]?.name}
                      </p>
                      <p className="text-green-700">
                        评分：{candidates[0]?.score}分，{candidates[0]?.tier}
                      </p>
                    </div>
                    
                    {candidates.length > 1 && (
                      <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                        <p className="font-medium text-primary-800">
                          备选推荐：{candidates.slice(1, 3).map(c => c.name).join('、')}
                        </p>
                        <p className="text-primary-700">
                          均为优秀候选人，可进入下一轮筛选
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-medium text-gray-800">
                        统计信息
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>平均分: {Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length)}</div>
                        <div>顶级推荐: {candidates.filter(c => c.tier === '顶级推荐').length}人</div>
                        <div>优秀候选: {candidates.filter(c => c.tier === '优秀候选').length}人</div>
                        <div>总计: {candidates.length}人</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateRanking; 