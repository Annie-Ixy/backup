# 智能问卷分析系统 API 文档

## 概述

本系统提供完整的智能问卷分析功能，基于原Python版本完全重写为Node.js实现。

## 主要特性

- 🔍 **智能题型识别** - 自动识别多选题、量表题、矩阵题、单选题、开放题
- 📊 **专业统计分析** - 平均值、标准差、分布分析、NPS评分
- 🎯 **模式匹配** - 支持多种问题编号格式（Q1、第1题等）
- 🌐 **多语言支持** - 中英文关键词检测
- ⚡ **智能筛选** - 按题型交互式筛选和分析
- 📈 **可视化支持** - 数据分布图表和统计指标展示

## API 接口

### 主要分析接口

#### POST /api/questionnaire/smart-analyze
**功能**: 执行完整的智能问卷分析

**请求体**:
```json
{
  "data": [
    {
      "Q1: 您的性别": "男",
      "Q2: 您对产品的整体满意度": "4",
      "Q3_选项1": "selected",
      "Q3_选项2": "",
      "Q3_选项3": "selected"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "analysisId": "analysis_123456",
  "data": {
    "questionTypes": {
      "multipleChoice": {...},
      "scaleQuestions": [...],
      "matrixScale": {...},
      "singleChoice": [...],
      "openEnded": [...]
    },
    "multipleChoiceAnalysis": {...},
    "scaleAnalysis": {...},
    "summary": "分析摘要"
  }
}
```

#### GET /api/questionnaire/question-types/:analysisId
**功能**: 获取问题类型识别结果

#### POST /api/questionnaire/filter-by-type
**功能**: 按题型筛选问题

#### POST /api/questionnaire/analyze-scale
**功能**: 深度分析量表题

#### POST /api/questionnaire/analyze-multiple-choice  
**功能**: 分析多选题

## 题型识别规则

### 多选题识别
- 检测列名中的分隔符（_、|、-、：等）
- 识别"选项1"、"选项2"等模式
- 至少包含2个相关选项

### 量表题识别
- 关键词匹配：满意度、评分、推荐、同意等
- 数值型数据且唯一值数量 ≤ 11
- 支持NPS评分计算（0-10量表）

### 矩阵题识别
- 编号模式：Q1-1、Q1_1、Q1.1等
- 问号分隔：Q4: 主问题? 子维度
- 至少包含2个子问题

### 单选题识别
- 唯一值数量 2-10 个
- 非数值型分类数据

### 开放题识别
- 唯一值数量 > 50
- 文本型数据

## NPS评分说明

Net Promoter Score (净推荐值) 计算规则：
- **推荐者** (Promoters): 评分 9-10
- **被动者** (Passives): 评分 7-8  
- **贬损者** (Detractors): 评分 0-6

**NPS = (推荐者% - 贬损者%) × 100**

评级标准：
- NPS ≥ 50: 优秀
- NPS ≥ 0: 良好
- NPS < 0: 需要改进

## 使用示例

### 基础智能分析
```javascript
const response = await fetch('/api/questionnaire/smart-analyze', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({data: questionnaireData})
});
const result = await response.json();
```

### 量表题专业分析
```javascript
const scaleAnalysis = await fetch('/api/questionnaire/analyze-scale', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    data: questionnaireData,
    column: 'Q5: 产品满意度'
  })
});
```

## 技术特点

1. **纯Node.js实现** - 避免跨语言调用复杂性
2. **内存高效** - 流式处理大数据集
3. **模式匹配** - 智能识别多种问题格式
4. **可扩展性** - 易于添加新的分析算法
5. **专业统计** - 提供完整的统计分析指标