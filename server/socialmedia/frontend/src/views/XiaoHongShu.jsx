import React from 'react';
import { Card, Empty, Tag } from 'antd';
import { HeartOutlined, ToolOutlined } from '@ant-design/icons';

const XiaoHongShu = () => {
  return (
    <div>
      <Card 
        title={
          <span>
            <HeartOutlined style={{ marginRight: '8px', color: '#ff4d4f' }} />
            小红书数据分析
            <Tag color="orange" style={{ marginLeft: '12px' }}>开发中</Tag>
          </span>
        } 
        style={{ marginBottom: '24px' }}
      >
        <Empty
          image={<ToolOutlined style={{ fontSize: '64px', color: '#ff4d4f' }} />}
          description={
            <div>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>小红书数据源功能正在开发中</p>
              <p style={{ color: '#666', marginBottom: '16px' }}>
                即将支持小红书平台的数据爬取、情感分析和品牌监控功能
              </p>
              <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                <p><strong>计划功能：</strong></p>
                <ul style={{ textAlign: 'left' }}>
                  <li>小红书帖子内容爬取</li>
                  <li>用户评论情感分析</li>
                  <li>品牌提及监控</li>
                  <li>热门话题跟踪</li>
                  <li>影响者识别</li>
                </ul>
              </div>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default XiaoHongShu;
