import React, { useState } from 'react';
import { Upload as AntUpload, Button, Card, message, Progress, Alert, Divider, Steps } from 'antd';
import { UploadOutlined, InboxOutlined, CheckCircleOutlined, PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Dragger } = AntUpload;

const Upload = () => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // 新增：分析相关状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisSuccess, setAnalysisSuccess] = useState(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: 上传, 1: 分析

  const performUpload = (attempt = 1) => {
    const formData = new FormData();
    formData.append('file', fileList[0]);

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    // 实际上传，添加超时设置
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 3600000); // 1小时超时

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: timeoutController.signal
    })
    .then(response => {
      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 检查内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('服务器返回了非JSON格式的响应');
      }
      
      return response.json();
    })
    .then(result => {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploading(false);
      
      if (result.success) {
        setUploadSuccess({
          successCount: result.summary?.success_count || 0,
          duplicateCount: result.summary?.duplicate_count || 0,
          errorCount: result.summary?.error_count || 0,
          fileName: fileList[0]?.name || '未知文件',
          message: result.message || '文件上传成功'
        });
        setFileList([]);
        setCurrentStep(1); // 切换到分析步骤
        
        // 根据处理结果显示不同类型的消息
        if (result.summary?.error_count > 0) {
          message.warning(`文件上传完成：成功处理 ${result.summary.success_count} 条，${result.summary.error_count} 条处理失败。现在可以开始分析。`);
        } else {
          message.success(`文件上传成功：处理了 ${result.summary.success_count} 条数据。现在可以开始分析。`);
        }
      } else {
        message.error(result.message || '上传失败');
      }
    })
    .catch(error => {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      
      console.error('上传错误:', error);
      
      // 如果是超时或网络错误，且重试次数少于3次，则自动重试
      if (attempt < 3 && (
        error.name === 'AbortError' || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('服务器返回了非JSON格式的响应')
      )) {
        message.warning(`上传失败，正在重试... (${attempt}/3)`);
        setRetryCount(attempt);
        
        // 延迟2秒后重试
        setTimeout(() => {
          performUpload(attempt + 1);
        }, 2000);
      } else {
        setUploading(false);
        setUploadProgress(0);
        setRetryCount(0);
        
        let errorMessage = '上传失败：' + error.message;
        if (error.name === 'AbortError') {
          errorMessage = '上传超时，请检查网络连接或文件大小';
        }
        
        message.error(errorMessage);
      }
    });
  };

  const handleUpload = () => {
    if (fileList.length === 0) {
      message.error('请先选择文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(null);
    setRetryCount(0);

    performUpload(1);
  };

  // 新增：分析处理函数
  const handleAnalysis = () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisSuccess(null);

    // 模拟分析进度（更慢的进度条，因为要处理所有数据）
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 5; // 更慢的进度增长
      });
    }, 1000); // 更长的间隔

    // 调用分析API
    fetch('/api/analysis/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(result => {
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalyzing(false);
      
      if (result.success) {
        setAnalysisSuccess({
          etlSuccessCount: result.summary?.etl_success_count || 0,
          aiSuccessCount: result.summary?.ai_success_count || 0,
          aiFailedCount: result.summary?.ai_failed_count || 0,
          message: result.message || '分析处理完成'
        });
        setCurrentStep(2); // 完成状态
        
        message.success(`分析完成：ETL处理${result.summary?.etl_success_count || 0}条，AI分析${result.summary?.ai_success_count || 0}条`);
      } else {
        message.error(result.message || '分析失败');
      }
    })
    .catch(error => {
      clearInterval(progressInterval);
      console.error('分析错误:', error);
      setAnalyzing(false);
      setAnalysisProgress(0);
      message.error('分析失败：' + error.message);
    });
  };

  // 重置所有状态
  const handleReset = () => {
    setFileList([]);
    setUploading(false);
    setUploadProgress(0);
    setUploadSuccess(null);
    setRetryCount(0);
    setAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisSuccess(null);
    setCurrentStep(0);
  };

  const uploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      // 检查文件类型
      const isValidType = file.name.match(/\.(xlsx|xls|csv)$/);
      if (!isValidType) {
        message.error('只支持 Excel (.xlsx, .xls) 和 CSV 文件');
        return false;
      }

      // 检查文件大小 (50MB)
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error('文件大小不能超过 50MB');
        return false;
      }

      setFileList([file]);
      return false; // 阻止自动上传
    },
    fileList,
  };

  return (
    <div>
      <Card title="Dash Social数据处理" style={{ marginBottom: '24px' }}>
        <p>上传Excel或CSV格式的社交媒体数据文件，然后进行数据去重和AI分析</p>
        
        {/* 步骤指示器 */}
        <Steps
          current={currentStep}
          style={{ marginBottom: '24px' }}
          items={[
            {
              title: '文件上传',
              description: '上传数据文件到系统',
              icon: currentStep === 0 && uploading ? <LoadingOutlined /> : <UploadOutlined />
            },
            {
              title: '数据分析',
              description: 'ETL去重和AI情感分析',
              icon: currentStep === 1 && analyzing ? <LoadingOutlined /> : <PlayCircleOutlined />
            },
            {
              title: '完成',
              description: '处理完成，可查看结果',
              icon: <CheckCircleOutlined />
            }
          ]}
        />
        
        <Divider />
        
        <Dragger {...uploadProps} style={{ marginBottom: '16px' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 Excel (.xlsx, .xls) 和 CSV 格式，文件大小不超过 50MB
          </p>
        </Dragger>

        {uploading && (
          <div style={{ marginBottom: '16px' }}>
            <Progress 
              percent={uploadProgress} 
              status={uploadProgress === 100 ? 'success' : 'active'}
              format={() => retryCount > 0 ? `重试中 (${retryCount}/3)` : `${uploadProgress}%`}
            />
            {retryCount > 0 && (
              <div style={{ marginTop: '8px', color: '#faad14', fontSize: '12px' }}>
                正在重试上传，请稍候...
              </div>
            )}
          </div>
        )}

        {uploadSuccess && (
          <Alert
            message={uploadSuccess.errorCount > 0 ? "上传部分成功" : "上传成功！"}
            description={
              <div>
                <p><strong>文件名：</strong>{uploadSuccess.fileName}</p>
                <p><strong>成功处理：</strong>{uploadSuccess.successCount} 条数据</p>
                {uploadSuccess.duplicateCount > 0 && (
                  <p><strong>重复数据：</strong>{uploadSuccess.duplicateCount} 条</p>
                )}
                {uploadSuccess.errorCount > 0 && (
                  <p style={{ color: '#faad14' }}><strong>处理失败：</strong>{uploadSuccess.errorCount} 条数据</p>
                )}
                {uploadSuccess.message && (
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    {uploadSuccess.message}
                  </p>
                )}
              </div>
            }
            type={uploadSuccess.errorCount > 0 ? "warning" : "success"}
            icon={<CheckCircleOutlined />}
            showIcon
            closable
            onClose={() => setUploadSuccess(null)}
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 分析进度显示 */}
        {analyzing && (
          <div style={{ marginBottom: '16px' }}>
            <Progress 
              percent={analysisProgress} 
              status={analysisProgress === 100 ? 'success' : 'active'}
              format={() => `分析中 ${analysisProgress}%`}
            />
            <div style={{ marginTop: '8px', color: '#1890ff', fontSize: '12px' }}>
              正在分批次进行数据去重和AI情感分析，处理所有数据可能需要几分钟，请稍候...
            </div>
          </div>
        )}

        {/* 分析结果显示 */}
        {analysisSuccess && (
          <Alert
            message="分析处理完成！"
            description={
              <div>
                <p><strong>ETL处理：</strong>{analysisSuccess.etlSuccessCount} 条数据</p>
                <p><strong>AI分析成功：</strong>{analysisSuccess.aiSuccessCount} 条数据</p>
                {analysisSuccess.aiFailedCount > 0 && (
                  <p style={{ color: '#faad14' }}><strong>AI分析失败：</strong>{analysisSuccess.aiFailedCount} 条数据</p>
                )}
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  {analysisSuccess.message}
                </p>
              </div>
            }
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            closable
            onClose={() => setAnalysisSuccess(null)}
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 动态按钮区域 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {currentStep === 0 && (
            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              loading={uploading}
              icon={<UploadOutlined />}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
          )}
          
          {currentStep === 1 && uploadSuccess && (
            <Button
              type="primary"
              onClick={handleAnalysis}
              loading={analyzing}
              icon={<PlayCircleOutlined />}
            >
              {analyzing ? '分析中...' : '开始分析'}
            </Button>
          )}
          
          {currentStep >= 1 && (
            <Button
              onClick={handleReset}
              disabled={analyzing}
            >
              重新开始
            </Button>
          )}
          
          {currentStep === 2 && analysisSuccess && (
            <Button
              type="link"
              onClick={() => window.location.href = '/analysis'}
            >
              查看分析结果 →
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Upload;