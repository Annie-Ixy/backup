import React from 'react';
import { Card, Empty, Tag } from 'antd';
import { GlobalOutlined, ToolOutlined } from '@ant-design/icons';

const Reddit = () => {
  return (
    <div>
      <Card 
        title={
          <span>
            <GlobalOutlined style={{ marginRight: '8px', color: '#ff4500' }} />
            Reddit数据分析
            <Tag color="orange" style={{ marginLeft: '12px' }}>开发中</Tag>
          </span>
        } 
        style={{ marginBottom: '24px' }}
      >
        <Empty
          image={<ToolOutlined style={{ fontSize: '64px', color: '#ff4500' }} />}
          description={
            <div>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Reddit数据源功能正在开发中</p>
              <p style={{ color: '#666', marginBottom: '16px' }}>
                即将支持Reddit平台的数据爬取、社区分析和讨论监控功能
              </p>
              <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                <p><strong>计划功能：</strong></p>
                <ul style={{ textAlign: 'left' }}>
                  <li>Reddit帖子和评论爬取</li>
                  <li>情感分析</li>
                  <li>内容分类</li>
                  <li>趋势识别</li>
                </ul>
              </div>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default Reddit;
