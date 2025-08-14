import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message } from 'antd';
import { api } from '../utils/request';
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons';



const History = () => {
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);

  // 上传历史表格列定义
  const uploadColumns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size) => {
        if (size < 1024 * 1024) {
          return `${(size / 1024).toFixed(1)} KB`;
        }
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      }
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap = {
          'success': 'green',
          'processing': 'blue',
          'failed': 'red',
          'pending': 'orange'
        };
        const textMap = {
          'completed': '成功',
          'processing': '处理中',
          'failed': '失败',
          'pending': '等待中'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '数据量',
      dataIndex: 'original_rows',
      key: 'original_rows',
      render: (count) => count ? `${count} 条` : '-'
    },
  ];


  // 加载上传历史
  const loadUploadHistory = async () => {
    setUploadsLoading(true);
    try {
      const response = await api.get('/socialmedia/api/uploads/history');
      
      if (response.success) {
        setUploadHistory(response.data || []);
      } else {
        message.error('加载上传历史失败');
      }
    } catch (error) {
      console.error('加载上传历史失败:', error);
      // 使用模拟数据
      setUploadHistory([]);
    } finally {
      setUploadsLoading(false);
    }
  };



  useEffect(() => {
    loadUploadHistory();
  }, []);

  return (
    <div>
      <Card title={<><HistoryOutlined /> 历史记录</>}>
        <p>查看数据上传记录和分析历史，跟踪系统使用情况</p>
        
        <div>
            <div style={{ marginBottom: '16px' }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadUploadHistory}
                loading={uploadsLoading}
              >
                刷新
              </Button>
            </div>
            <Table
              columns={uploadColumns}
              dataSource={uploadHistory}
              loading={uploadsLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`
              }}
            />
        </div>
      </Card>
    </div>
  );
};

export default History;