import React from 'react';
import { Card, Empty, Tag } from 'antd';
import { PlusOutlined, ToolOutlined } from '@ant-design/icons';

const PetWebsite = () => {
  return (
    <div>
      <Card 
        title={
          <span>
            <PlusOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
            宠物网站数据分析
            <Tag color="orange" style={{ marginLeft: '12px' }}>开发中</Tag>
          </span>
        } 
        style={{ marginBottom: '24px' }}
      >
        <Empty
          image={<ToolOutlined style={{ fontSize: '64px', color: '#52c41a' }} />}
          description={
            <div>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>宠物网站数据源功能正在开发中</p>
              <p style={{ color: '#666', marginBottom: '16px' }}>
                即将支持宠物相关网站的数据爬取、产品分析和用户反馈监控功能
              </p>
              <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                <p><strong>计划功能：</strong></p>
                <ul style={{ textAlign: 'left' }}>
                  <li>宠物电商网站数据爬取</li>
                  <li>咨询链接</li>
                  <li>内容分类</li>
                  <li>提取主要内容</li>
                </ul>
              </div>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default PetWebsite;
