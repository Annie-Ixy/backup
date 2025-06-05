// 重复简历检测功能测试

// 简单的ID生成器
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// 计算两个字符串的相似度（使用Jaccard相似度）
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  // 将文本转换为小写并分词
  const words1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(word => word.length > 1));
  const words2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(word => word.length > 1));
  
  // 计算交集和并集
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  // Jaccard相似度 = 交集大小 / 并集大小
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// 计算姓名相似度
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;
  
  const cleanName1 = name1.toLowerCase().trim();
  const cleanName2 = name2.toLowerCase().trim();
  
  // 完全匹配
  if (cleanName1 === cleanName2) return 1;
  
  // 检查是否一个名字包含另一个
  if (cleanName1.includes(cleanName2) || cleanName2.includes(cleanName1)) {
    return 0.8;
  }
  
  // 计算编辑距离相似度
  const maxLength = Math.max(cleanName1.length, cleanName2.length);
  if (maxLength === 0) return 0;
  
  const editDistance = levenshteinDistance(cleanName1, cleanName2);
  return 1 - (editDistance / maxLength);
}

// 计算编辑距离
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// 检测重复简历
function detectDuplicateResumes(candidates) {
  const duplicateGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < candidates.length; i++) {
    if (processed.has(i)) continue;
    
    const currentCandidate = candidates[i];
    const duplicates = [i];
    
    for (let j = i + 1; j < candidates.length; j++) {
      if (processed.has(j)) continue;
      
      const otherCandidate = candidates[j];
      
      // 计算各种相似度
      const nameSimilarity = calculateNameSimilarity(currentCandidate.name, otherCandidate.name);
      const textSimilarity = calculateTextSimilarity(currentCandidate.rawText, otherCandidate.rawText);
      
      // 检查关键信息相似度
      const educationSimilarity = calculateTextSimilarity(currentCandidate.education || '', otherCandidate.education || '');
      const experienceSimilarity = calculateTextSimilarity(currentCandidate.experience || '', otherCandidate.experience || '');
      
      // 判断是否为重复简历的条件
      const isDuplicate = (
        // 姓名高度相似且文本相似度高
        (nameSimilarity > 0.8 && textSimilarity > 0.7) ||
        // 或者文本内容极度相似（可能是同一份简历的不同版本）
        (textSimilarity > 0.9) ||
        // 或者姓名相同且教育背景和经验都相似
        (nameSimilarity > 0.9 && educationSimilarity > 0.8 && experienceSimilarity > 0.8)
      );
      
      if (isDuplicate) {
        duplicates.push(j);
        processed.add(j);
        
        console.log(`检测到重复简历: ${currentCandidate.name} 与 ${otherCandidate.name}`);
        console.log(`- 姓名相似度: ${(nameSimilarity * 100).toFixed(1)}%`);
        console.log(`- 文本相似度: ${(textSimilarity * 100).toFixed(1)}%`);
        console.log(`- 教育背景相似度: ${(educationSimilarity * 100).toFixed(1)}%`);
        console.log(`- 工作经验相似度: ${(experienceSimilarity * 100).toFixed(1)}%`);
      }
    }
    
    if (duplicates.length > 1) {
      duplicateGroups.push(duplicates);
    }
    processed.add(i);
  }
  
  return duplicateGroups;
}

// 处理重复简历，保留最佳版本
function processDuplicateResumes(candidates) {
  console.log(`开始重复简历检测，共 ${candidates.length} 位候选人`);
  
  const duplicateGroups = detectDuplicateResumes(candidates);
  
  if (duplicateGroups.length === 0) {
    console.log('未检测到重复简历');
    return {
      uniqueCandidates: candidates,
      duplicateInfo: []
    };
  }
  
  console.log(`检测到 ${duplicateGroups.length} 组重复简历`);
  
  const duplicateInfo = [];
  const indicesToRemove = new Set();
  
  duplicateGroups.forEach((group, groupIndex) => {
    const groupCandidates = group.map(index => candidates[index]);
    
    // 选择最佳候选人（评分最高的）
    const bestCandidate = groupCandidates.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    const bestIndex = group.find(index => candidates[index].id === bestCandidate.id);
    const duplicateIndices = group.filter(index => index !== bestIndex);
    
    // 记录重复信息
    const duplicateNames = duplicateIndices.map(index => candidates[index].name);
    duplicateInfo.push({
      groupId: groupIndex + 1,
      keptCandidate: {
        name: bestCandidate.name,
        score: bestCandidate.score,
        filename: bestCandidate.filename
      },
      removedCandidates: duplicateNames.map((name, idx) => ({
        name,
        score: candidates[duplicateIndices[idx]].score,
        filename: candidates[duplicateIndices[idx]].filename
      })),
      reason: '重复简历，保留评分最高版本'
    });
    
    // 标记要移除的索引
    duplicateIndices.forEach(index => indicesToRemove.add(index));
    
    // 更新保留候选人的信息，标记为去重后的结果
    bestCandidate.isDeduplicated = true;
    bestCandidate.duplicateCount = group.length;
    bestCandidate.duplicateInfo = `此候选人有 ${group.length} 份相似简历，已保留评分最高版本`;
    
    console.log(`重复组 ${groupIndex + 1}: 保留 ${bestCandidate.name}(${bestCandidate.score}分), 移除 ${duplicateNames.join(', ')}`);
  });
  
  // 创建去重后的候选人列表
  const uniqueCandidates = candidates.filter((_, index) => !indicesToRemove.has(index));
  
  console.log(`重复简历处理完成: 原始 ${candidates.length} 人 -> 去重后 ${uniqueCandidates.length} 人`);
  
  return {
    uniqueCandidates,
    duplicateInfo,
    originalCount: candidates.length,
    uniqueCount: uniqueCandidates.length,
    removedCount: indicesToRemove.size
  };
}

// 测试数据
const testCandidates = [
  {
    id: generateId(),
    name: '张三',
    filename: '张三_简历.pdf',
    score: 85,
    education: '北京大学计算机科学与技术专业',
    experience: '3年软件开发经验',
    rawText: '张三，北京大学计算机科学与技术专业毕业，具有3年软件开发经验，熟悉Java、Python等编程语言，参与过多个大型项目开发。'
  },
  {
    id: generateId(),
    name: '张三',
    filename: '张三_最新简历.pdf',
    score: 88,
    education: '北京大学计算机科学与技术专业',
    experience: '3年软件开发经验',
    rawText: '张三，北京大学计算机科学与技术专业毕业，拥有3年软件开发经验，精通Java、Python编程，曾参与多个大型项目的开发工作。'
  },
  {
    id: generateId(),
    name: '李四',
    filename: '李四_简历.pdf',
    score: 75,
    education: '清华大学软件工程专业',
    experience: '2年前端开发经验',
    rawText: '李四，清华大学软件工程专业毕业，具有2年前端开发经验，熟悉React、Vue等前端框架。'
  },
  {
    id: generateId(),
    name: '王五',
    filename: '王五_简历.pdf',
    score: 92,
    education: '上海交通大学人工智能专业',
    experience: '5年AI算法工程师经验',
    rawText: '王五，上海交通大学人工智能专业毕业，具有5年AI算法工程师经验，专注于机器学习和深度学习算法研究。'
  },
  {
    id: generateId(),
    name: '赵六',
    filename: '赵六_简历.pdf',
    score: 80,
    education: '浙江大学数据科学专业',
    experience: '4年数据分析师经验',
    rawText: '赵六，浙江大学数据科学专业毕业，具有4年数据分析师经验，擅长数据挖掘和统计分析。'
  }
];

// 执行测试
console.log('=== 重复简历检测功能测试 ===\n');

console.log('原始候选人列表:');
testCandidates.forEach((candidate, index) => {
  console.log(`${index + 1}. ${candidate.name} (${candidate.score}分) - ${candidate.filename}`);
});

console.log('\n开始重复检测...\n');

const result = processDuplicateResumes(testCandidates);

console.log('\n=== 检测结果 ===');
console.log(`原始候选人数量: ${result.originalCount}`);
console.log(`去重后候选人数量: ${result.uniqueCount}`);
console.log(`移除重复数量: ${result.removedCount}`);

console.log('\n去重后的候选人列表:');
result.uniqueCandidates.forEach((candidate, index) => {
  console.log(`${index + 1}. ${candidate.name} (${candidate.score}分) - ${candidate.filename}${candidate.isDeduplicated ? ' [已去重]' : ''}`);
});

if (result.duplicateInfo.length > 0) {
  console.log('\n重复处理详情:');
  result.duplicateInfo.forEach(group => {
    console.log(`组 ${group.groupId}: 保留 ${group.keptCandidate.name}(${group.keptCandidate.score}分), 移除 ${group.removedCandidates.map(c => `${c.name}(${c.score}分)`).join(', ')}`);
  });
}

console.log('\n测试完成！'); 