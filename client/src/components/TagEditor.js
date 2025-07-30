import React, { useState, useEffect } from 'react';
import { getTagsForEditing, saveManualTags, getAITagsForEditing, getCustomTagsForEditing, saveAIManualTags, saveCustomManualTags } from '../services/questionnaireApi';

const TagEditor = ({ analysisId, onClose, onDataUpdate, refreshTrigger, editType = 'mixed' }) => {
  const [tagData, setTagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { rowId, question, tagType }
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [modifications, setModifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [batchOperation, setBatchOperation] = useState('');
  const [batchTagType, setBatchTagType] = useState('level1_themes');
  const [batchTargetTag, setBatchTargetTag] = useState('');
  const [batchReplacementTag, setBatchReplacementTag] = useState('');

  const itemsPerPage = 20;

  useEffect(() => {
    loadTagData();
  }, [analysisId, refreshTrigger, editType]); // 添加editType依赖

  // 当选择的问题变化时，更新批量操作的标签类型默认值
  useEffect(() => {
    if (tagData && tagData.open_questions && selectedQuestion) {
      const currentQuestion = tagData.open_questions.find(q => q.original_field === selectedQuestion);
      if (currentQuestion && currentQuestion.available_columns) {
        if (currentQuestion.available_columns.includes(currentQuestion.level1_theme_field)) {
          setBatchTagType('level1_themes');
        } else if (currentQuestion.available_columns.includes(currentQuestion.level2_tag_field)) {
          setBatchTagType('level2_tags');
        } else if (currentQuestion.available_columns.includes(currentQuestion.reference_tag_field)) {
          setBatchTagType('reference_tags');
        }
      }
    }
  }, [selectedQuestion, tagData]);

  const loadTagData = async () => {
    try {
      setLoading(true);
      console.log('开始加载标签数据, analysisId:', analysisId, 'editType:', editType);
      
      let data;
      // 根据editType选择不同的API
      switch (editType) {
        case 'ai':
          data = await getAITagsForEditing(analysisId);
          console.log('AI打标编辑数据加载成功:', data);
          break;
        case 'custom':
          data = await getCustomTagsForEditing(analysisId);
          console.log('参考标签编辑数据加载成功:', data);
          break;
        case 'mixed':
        default:
          data = await getTagsForEditing(analysisId);
          console.log('混合模式标签数据加载成功:', data);
          break;
      }
      
      // 调试：输出字段信息
      if (data.open_questions) {
        data.open_questions.forEach(question => {
          console.log(`🔍 问题字段: ${question.original_field}`);
          console.log('  - available_columns:', question.available_columns);
          console.log('  - reference_tag_field:', question.reference_tag_field);
          console.log('  - level1_theme_field:', question.level1_theme_field);
          console.log('  - level2_tag_field:', question.level2_tag_field);
          console.log('  - 是否包含参考标签字段:', question.available_columns?.includes(question.reference_tag_field));
        });
      }
      
      setTagData(data);
      if (data.open_questions && data.open_questions.length > 0) {
        setSelectedQuestion(data.open_questions[0].original_field);
        
        // 根据第一个问题的可用字段设置批量操作的默认标签类型
        const firstQuestion = data.open_questions[0];
        if (firstQuestion.available_columns) {
          if (firstQuestion.available_columns.includes(firstQuestion.level1_theme_field)) {
            setBatchTagType('level1_themes');
          } else if (firstQuestion.available_columns.includes(firstQuestion.level2_tag_field)) {
            setBatchTagType('level2_tags');
          } else if (firstQuestion.available_columns.includes(firstQuestion.reference_tag_field)) {
            setBatchTagType('reference_tags');
          }
        }
      }
    } catch (error) {
      console.error('加载标签数据失败:', error);
      alert('加载标签数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTagEdit = (rowId, questionField, tagType, newTags) => {
    // 更新本地数据
    setTagData(prevData => {
      const newData = { ...prevData };
      const rowData = newData.data.find(row => row.id === rowId);
      if (rowData && rowData.questions[questionField]) {
        rowData.questions[questionField][tagType] = newTags;
      }
      return newData;
    });

    // 记录修改
    setModifications(prev => {
      const existingIndex = prev.findIndex(m => 
        m.rowId === rowId && 
        m.fieldName === questionField && 
        m.tagType === tagType
      );
      const newMod = {
        rowId: rowId,
        fieldName: questionField,
        tagType: tagType,
        newValues: newTags
      };
      
      if (existingIndex >= 0) {
        const newMods = [...prev];
        newMods[existingIndex] = newMod;
        return newMods;
      } else {
        return [...prev, newMod];
      }
    });
  };

  const handleSaveChanges = async () => {
    if (modifications.length === 0) {
      alert('没有修改需要保存');
      return;
    }

    // 过滤掉无效的修改数据
    const validModifications = modifications.filter(mod => 
      mod.rowId !== null && mod.rowId !== undefined &&
      mod.fieldName && mod.fieldName.trim() !== '' &&
      mod.tagType && mod.tagType.trim() !== '' &&
      Array.isArray(mod.newValues)
    );

    console.log('原始修改数量:', modifications.length);
    console.log('有效修改数量:', validModifications.length);
    console.log('有效修改数据:', validModifications);

    if (validModifications.length === 0) {
      alert('没有有效的修改需要保存');
      return;
    }

    try {
      setSaving(true);
      let saveFunction;
      switch (editType) {
        case 'ai':
          saveFunction = saveAIManualTags;
          break;
        case 'custom':
          saveFunction = saveCustomManualTags;
          break;
        case 'mixed':
        default:
          saveFunction = saveManualTags;
          break;
      }
      await saveFunction(analysisId, validModifications);
      setModifications([]);
      
      // 保存成功后，重新加载数据并更新父组件
      let updatedData;
      switch (editType) {
        case 'ai':
          updatedData = await getAITagsForEditing(analysisId);
          break;
        case 'custom':
          updatedData = await getCustomTagsForEditing(analysisId);
          break;
        case 'mixed':
        default:
          updatedData = await getTagsForEditing(analysisId);
          break;
      }
      setTagData(updatedData);
      if (onDataUpdate && updatedData) {
        onDataUpdate(updatedData);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchOperation = () => {
    if (selectedRows.size === 0) {
      alert('请选择要操作的行');
      return;
    }

    if (!batchOperation) {
      alert('请选择批量操作类型');
      return;
    }

    const affectedRows = Array.from(selectedRows);
    console.log('执行批量操作:', {
      operation: batchOperation,
      tagType: batchTagType,
      question: selectedQuestion,
      targetTag: batchTargetTag,
      replacementTag: batchReplacementTag,
      affectedRows: affectedRows
    });

    // 验证必要的参数
    if (!selectedQuestion || !batchTagType) {
      alert('请先选择问题和标签类型');
      return;
    }

    // 对每个选中的行进行批量操作
    affectedRows.forEach(rowId => {
      const rowData = tagData.data.find(row => row.id === rowId);
      if (!rowData || !rowData.questions[selectedQuestion]) {
        console.warn(`跳过无效行: rowId=${rowId}, selectedQuestion=${selectedQuestion}`);
        return;
      }

      const currentTags = rowData.questions[selectedQuestion][batchTagType] || [];
      let newTags = [...currentTags];

      // 根据操作类型处理标签
      if (batchOperation === 'replace' && batchTargetTag && batchReplacementTag) {
        newTags = newTags.map(tag => tag === batchTargetTag ? batchReplacementTag : tag);
        console.log(`替换操作: 行${rowId}, ${batchTargetTag} -> ${batchReplacementTag}`);
      } else if (batchOperation === 'add' && batchReplacementTag) {
        if (!newTags.includes(batchReplacementTag)) {
          newTags.push(batchReplacementTag);
          console.log(`添加操作: 行${rowId}, 添加标签: ${batchReplacementTag}`);
        }
      } else if (batchOperation === 'remove' && batchTargetTag) {
        newTags = newTags.filter(tag => tag !== batchTargetTag);
        console.log(`删除操作: 行${rowId}, 删除标签: ${batchTargetTag}`);
      }

      // 调用编辑函数来更新数据和记录修改
      console.log(`调用handleTagEdit: rowId=${rowId}, question=${selectedQuestion}, tagType=${batchTagType}, newTags=`, newTags);
      handleTagEdit(rowId, selectedQuestion, batchTagType, newTags);
    });

    // 重置状态
    setSelectedRows(new Set());
    setBatchTargetTag('');
    setBatchReplacementTag('');
    setBatchOperation('');
    
    console.log(`批量操作完成，影响 ${affectedRows.length} 行，请点击"保存修改"以保存到后端`);
  };

  const toggleRowSelection = (rowId) => {
    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(rowId)) {
        newSelected.delete(rowId);
      } else {
        newSelected.add(rowId);
      }
      return newSelected;
    });
  };

  const selectAllRows = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map(row => row.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">正在加载标签数据...</div>
      </div>
    );
  }

  if (!tagData || !tagData.open_questions || tagData.open_questions.length === 0) {
    return (
      <div className="text-center text-red-500">
        没有找到可编辑的开放题字段
      </div>
    );
  }

  // 过滤数据
  const filteredData = tagData.data.filter(row => {
    if (!searchTerm || !selectedQuestion) return true;
    
    const searchText = searchTerm.toLowerCase();
    const questionData = row.questions[selectedQuestion];
    if (!questionData) return false;
    
    const originalText = questionData.original_text.toLowerCase();
    const cnText = questionData.cn_text.toLowerCase();
    const level1Text = questionData.level1_themes.join(' ').toLowerCase();
    const level2Text = questionData.level2_tags.join(' ').toLowerCase();
    const referenceText = (questionData.reference_tags || []).join(' ').toLowerCase();
    
    return originalText.includes(searchText) || 
           cnText.includes(searchText) || 
           level1Text.includes(searchText) ||
           level2Text.includes(searchText) ||
           referenceText.includes(searchText);
  });

  // 分页
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // 获取当前选中问题的信息
  const currentQuestion = tagData.open_questions.find(q => q.original_field === selectedQuestion);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 bg-blue-500 text-white">
          <h2 className="text-xl font-bold">标签编辑器</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                console.log('手动刷新TagEditor数据...');
                loadTagData();
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-sm"
              title="刷新最新数据"
            >
              🔄 刷新
            </button>
            <button
              onClick={() => {
                if (modifications.length > 0) {
                  const confirmed = window.confirm('有未保存的修改，确定要关闭吗？');
                  if (!confirmed) return;
                }
                onClose();
              }}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            {/* 搜索 */}
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder={`搜索 ${selectedQuestion || '问题'} 的文本或标签...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* 问题选择 */}
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md min-w-64"
            >
              {tagData.open_questions.map(question => (
                <option key={question.original_field} value={question.original_field}>
                  {question.original_field}
                </option>
              ))}
            </select>
          </div>

          {/* 批量操作区域 */}
          <div className="flex flex-wrap gap-4 items-center mt-4 p-4 bg-gray-100 rounded-lg">
            <div className="text-sm font-medium text-gray-700">批量操作：</div>
            
            {/* 标签类型选择 */}
            <select
              value={batchTagType}
              onChange={(e) => setBatchTagType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {/* 动态显示一级主题选项（如果存在） */}
              {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level1_theme_field) && (
                <option value="level1_themes">一级主题</option>
              )}
              {/* 动态显示二级标签选项（如果存在） */}
              {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level2_tag_field) && (
                <option value="level2_tags">二级标签</option>
              )}
              {/* 动态显示参考标签选项（如果存在） */}
              {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.reference_tag_field) && (
                <option value="reference_tags">参考标签</option>
              )}
            </select>

            {/* 批量操作类型 */}
            <select
              value={batchOperation}
              onChange={(e) => setBatchOperation(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">选择操作</option>
              <option value="add">添加标签</option>
              <option value="remove">移除标签</option>
              <option value="replace">替换标签</option>
            </select>

            {/* 批量操作输入 */}
            {batchOperation === 'remove' && (
              <input
                type="text"
                placeholder="要移除的标签"
                value={batchTargetTag}
                onChange={(e) => setBatchTargetTag(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            )}

            {batchOperation === 'add' && (
              <input
                type="text"
                placeholder="要添加的标签"
                value={batchReplacementTag}
                onChange={(e) => setBatchReplacementTag(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            )}

            {batchOperation === 'replace' && (
              <>
                <input
                  type="text"
                  placeholder="原标签"
                  value={batchTargetTag}
                  onChange={(e) => setBatchTargetTag(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="新标签"
                  value={batchReplacementTag}
                  onChange={(e) => setBatchReplacementTag(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </>
            )}

            <button
              onClick={handleBatchOperation}
              disabled={saving || selectedRows.size === 0 || !batchOperation}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 text-sm"
            >
              执行批量操作
            </button>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-4">
              <button
                onClick={selectAllRows}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                {selectedRows.size === filteredData.length ? '取消全选' : '全选'}
              </button>
              <span className="text-sm text-gray-600">
                已选择 {selectedRows.size} 行，共 {filteredData.length} 行
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveChanges}
                disabled={saving || modifications.length === 0}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {saving ? '保存中...' : `保存修改 (${modifications.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="border p-2 w-12">选择</th>
                <th className="border p-2 w-16">ID</th>
                <th className="border p-2 w-1/4">{selectedQuestion}</th>
                <th className="border p-2 w-1/4">{selectedQuestion}-CN</th>
                {/* 动态显示一级主题列（如果存在） */}
                {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level1_theme_field) && (
                  <th className="border p-2 w-1/6">{selectedQuestion}一级主题</th>
                )}
                {/* 动态显示二级标签列（如果存在） */}
                {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level2_tag_field) && (
                  <th className="border p-2 w-1/6">{selectedQuestion}二级标签</th>
                )}
                {/* 动态显示参考标签列（如果存在） */}
                {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.reference_tag_field) && (
                  <th className="border p-2 w-1/6">{selectedQuestion}标签</th>
                )}
                <th className="border p-2 w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(row => {
                const questionData = row.questions[selectedQuestion] || {};
                return (
                  <tr key={row.id} className={selectedRows.has(row.id) ? 'bg-blue-50' : ''}>
                    <td className="border p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                      />
                    </td>
                    <td className="border p-2 text-center">{row.id}</td>
                    <td className="border p-2 max-w-xs">
                      <div className="truncate" title={questionData.original_text || ''}>
                        {questionData.original_text || ''}
                      </div>
                    </td>
                    <td className="border p-2 max-w-xs">
                      <div className="truncate" title={questionData.cn_text || ''}>
                        {questionData.cn_text || ''}
                      </div>
                    </td>
                    {/* 一级主题列 */}
                    {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level1_theme_field) && (
                      <td className="border p-2">
                        {editingCell && editingCell.rowId === row.id && editingCell.tagType === 'level1_themes' ? (
                          <input
                            type="text"
                            value={questionData.level1_themes?.join(', ') || ''}
                            onChange={(e) => {
                              const newTags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                              handleTagEdit(row.id, selectedQuestion, 'level1_themes', newTags);
                            }}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="flex flex-wrap gap-1 min-h-6 cursor-pointer hover:bg-gray-50"
                            onClick={() => setEditingCell({ rowId: row.id, tagType: 'level1_themes' })}
                          >
                            {(questionData.level1_themes || []).map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    {/* 二级标签列 */}
                    {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.level2_tag_field) && (
                      <td className="border p-2">
                        {editingCell && editingCell.rowId === row.id && editingCell.tagType === 'level2_tags' ? (
                          <input
                            type="text"
                            value={questionData.level2_tags?.join(', ') || ''}
                            onChange={(e) => {
                              const newTags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                              handleTagEdit(row.id, selectedQuestion, 'level2_tags', newTags);
                            }}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="flex flex-wrap gap-1 min-h-6 cursor-pointer hover:bg-gray-50"
                            onClick={() => setEditingCell({ rowId: row.id, tagType: 'level2_tags' })}
                          >
                            {(questionData.level2_tags || []).map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                                          {/* 参考标签列（动态显示） */}
                    {currentQuestion && currentQuestion.available_columns && currentQuestion.available_columns.includes(currentQuestion.reference_tag_field) && (
                      <td className="border p-2">
                        {editingCell && editingCell.rowId === row.id && editingCell.tagType === 'reference_tags' ? (
                          <input
                            type="text"
                            value={questionData.reference_tags?.join(', ') || ''}
                            onChange={(e) => {
                              const newTags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                              handleTagEdit(row.id, selectedQuestion, 'reference_tags', newTags);
                            }}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="flex flex-wrap gap-1 min-h-6 cursor-pointer hover:bg-gray-50"
                            onClick={() => setEditingCell({ rowId: row.id, tagType: 'reference_tags' })}
                          >
                            {(questionData.reference_tags || []).map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="border p-2 text-center">
                      <button
                        onClick={() => setEditingCell({ rowId: row.id, tagType: 'level1_themes' })}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm mr-1"
                        title="编辑一级主题"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            显示 {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredData.length)} 条，共 {filteredData.length} 条
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:bg-gray-100"
            >
              上一页
            </button>
            <span className="px-3 py-1">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:bg-gray-100"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagEditor; 