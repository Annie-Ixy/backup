import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Statistic, Alert, Table, Tag, Tooltip, Button, 
  Modal, Descriptions, Space, Empty
} from 'antd';
import { 
  ExclamationCircleOutlined, UserOutlined, 
  ClockCircleOutlined, EyeOutlined, AlertOutlined, MessageOutlined
} from '@ant-design/icons';

const AnomalyDetectionResults = ({ data, loading = false }) => {
  const [selectedComment, setSelectedComment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const anomalyData = data?.bad_cases;
  const extremeNegativeComments = anomalyData?.extreme_negative_comments;

  // 格式化时间显示
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return timeStr;
    }
  };

  // 获取平台显示标签
  const getPlatformTag = (platform) => {
    const platformConfig = {
      'xiaohongshu': { 
        background: 'linear-gradient(135deg, #ff6b96, #e91e63)', 
        color: '#fff', 
        text: '小红书',
        icon: '📖'
      },
      'reddit': { 
        background: 'linear-gradient(135deg, #ff4500, #e65100)', 
        color: '#fff', 
        text: 'Reddit',
        icon: '🔥'
      },
      'pet_website': { 
        background: 'linear-gradient(135deg, #52c41a, #388e3c)', 
        color: '#fff', 
        text: '宠物网站',
        icon: '🐾'
      },
      'dash_social': { 
        background: 'linear-gradient(135deg, #1890ff, #1565c0)', 
        color: '#fff', 
        text: 'Dash Social',
        icon: '💬'
      },
      'instagram': { 
        background: 'linear-gradient(135deg, #e1306c, #c13584)', 
        color: '#fff', 
        text: 'Instagram',
        icon: '📸'
      },
      'facebook': { 
        background: 'linear-gradient(135deg, #1877f2, #166fe5)', 
        color: '#fff', 
        text: 'Facebook',
        icon: '👥'
      }
    };
    
    const config = platformConfig[platform] || { 
      background: 'linear-gradient(135deg, #95a5a6, #7f8c8d)', 
      color: '#fff', 
      text: platform || '未知平台',
      icon: '❓'
    };
    
    return (
      <span 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: config.background,
          color: config.color,
          padding: '6px 14px',
          borderRadius: '14px',
          fontSize: '13px',
          fontWeight: '600',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          boxShadow: '0 3px 12px rgba(0,0,0,0.2)',
          border: 'none',
          minWidth: '85px',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          cursor: 'default',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-1px) scale(1.05)';
          e.target.style.boxShadow = '0 5px 16px rgba(0,0,0,0.25)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0) scale(1)';
          e.target.style.boxShadow = '0 3px 12px rgba(0,0,0,0.2)';
        }}
      >
        <span style={{ marginRight: '6px', fontSize: '11px' }}>{config.icon}</span>
        {config.text}
      </span>
    );
  };

  // 极端负面评论表格列定义
  const negativeCommentsColumns = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user) => (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          {user}
        </span>
      )
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => getPlatformTag(platform)
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 150,
      render: (time) => (
        <span style={{ fontSize: '12px' }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {formatTime(time)}
        </span>
      )
    },
    {
      title: '评论内容',
      dataIndex: 'content',
      key: 'content',
      width: 400,
      render: (content) => (
        <div style={{ 
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          lineHeight: '1.5',
          maxWidth: '380px',
          padding: '4px 0'
        }}>
          {content}
        </div>
      )
    },
        {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      sorter: (a, b) => {
        const aConfidence = a.confidence || 0;
        const bConfidence = b.confidence || 0;
        return bConfidence - aConfidence; // 从大到小排序
      },
      defaultSortOrder: 'descend',
      sortDirections: ['descend', 'ascend'],
      render: (confidence) => {
        if (confidence === null || confidence === undefined) return '-';
        const value = parseFloat(confidence);
        const color = value >= 0.8 ? '#52c41a' : value >= 0.6 ? '#faad14' : '#ff4d4f';
        return (
          <Tag color={color}>
            {(value * 100).toFixed(1)}%
          </Tag>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button 
          size="small" 
          type="link"
          icon={<EyeOutlined />}
          onClick={() => showCommentDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  // 显示评论详情
  const showCommentDetail = (comment) => {
    setSelectedComment(comment);
    setModalVisible(true);
  };

  // 处理分页变化
  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  // 当数据变化时重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  if (loading) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Card style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
          border: 'none',
          padding: '40px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>
            <AlertOutlined style={{ 
              color: '#3498db',
              animation: 'pulse 1.5s ease-in-out infinite'
            }} />
          </div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#2c3e50', 
            margin: '0 0 8px 0' 
          }}>
            正在分析极端负面评论
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#7f8c8d', 
            margin: 0 
          }}>
            AI正在处理数据，请稍候...
          </p>
        </Card>
      </div>
    );
  }

  if (!anomalyData) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Card style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
          border: 'none',
          padding: '40px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <Empty 
            description={
              <span style={{ fontSize: '16px', color: '#7f8c8d' }}>
                暂无极端负面评论数据
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }
  
  if (anomalyData.error) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Card style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
          border: 'none',
          padding: '40px',
          backdropFilter: 'blur(10px)',
          maxWidth: '500px'
        }}>
          <Alert
            message={
              <span style={{ fontSize: '18px', fontWeight: '600' }}>
                分析出错
              </span>
            }
            description={
              <span style={{ fontSize: '14px' }}>
                {anomalyData.error}
              </span>
            }
            type="error"
            showIcon
            style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '1px solid #f87171',
              borderRadius: '12px'
            }}
          />
        </Card>
      </div>
    );
  }

  const summary = anomalyData?.summary || {};
  // 后端已按置信度降序排序，直接使用
  const negativeComments = extremeNegativeComments?.details || [];
  const userStats = extremeNegativeComments?.user_stats || [];
  const platformStats = extremeNegativeComments?.platform_stats || [];

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      padding: '24px',
      fontFamily: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* 页面标题 */}
      <div style={{ 
        marginBottom: '32px',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '600', 
          color: '#2c3e50',
          margin: '0 0 8px 0',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <AlertOutlined style={{ marginRight: '12px', color: '#e74c3c' }} />
          异常检测分析
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#7f8c8d', 
          margin: 0,
          fontWeight: '400'
        }}>
          基于AI智能分析的极端负面评论检测与统计
        </p>
      </div>

      {/* 统计概览 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col span={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>总评论数</span>}
                value={summary.total_comments || 0}
                prefix={<MessageOutlined style={{ color: '#fff', fontSize: '20px' }} />}
                suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>条</span>}
                valueStyle={{ color: '#fff', fontSize: '32px', fontWeight: '700' }}
              />
            </div>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%'
            }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(245, 87, 108, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>极端负面评论数</span>}
                value={summary.extreme_negative_count || 0}
                prefix={<ExclamationCircleOutlined style={{ color: '#fff', fontSize: '20px' }} />}
                suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>条</span>}
                valueStyle={{ color: '#fff', fontSize: '32px', fontWeight: '700' }}
              />
              {summary.total_negative_count > summary.extreme_negative_count && (
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.8)', 
                  marginTop: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)'
                }}>
                  总负面评论：{summary.total_negative_count}条
                </div>
              )}
            </div>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%'
            }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(79, 172, 254, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>极端负面比例</span>}
                value={summary.extreme_negative_percentage || 0}
                prefix={<AlertOutlined style={{ color: '#fff', fontSize: '20px' }} />}
                suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>%</span>}
                valueStyle={{ color: '#fff', fontSize: '32px', fontWeight: '700' }}
              />
              <div style={{ 
                fontSize: '12px', 
                color: 'rgba(255,255,255,0.8)', 
                marginTop: '8px',
                background: 'rgba(255,255,255,0.1)',
                padding: '4px 8px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)'
              }}>
                基于极端负面标记筛选
              </div>
            </div>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%'
            }} />
          </Card>
        </Col>
      </Row>

      {/* 极端负面评论列表 */}
      <Card 
        title={
          <span style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center'
          }}>
            <MessageOutlined style={{ 
              marginRight: '12px', 
              fontSize: '20px',
              color: '#e74c3c',
              padding: '8px',
              background: 'rgba(231, 76, 60, 0.1)',
              borderRadius: '8px'
            }} />
            极端负面评论详情
            <span style={{
              marginLeft: '12px',
              fontSize: '14px',
              color: '#fff',
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontWeight: '500'
            }}>
              {negativeComments.length}条
            </span>
          </span>
        }
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          marginBottom: '32px'
        }}
        headStyle={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,249,250,0.9) 100%)',
          borderRadius: '16px 16px 0 0',
          border: 'none',
          padding: '20px 24px'
        }}
        bodyStyle={{
          padding: '24px'
        }}
      >
        {negativeComments.length > 0 ? (
                  <Table
          columns={negativeCommentsColumns}
          dataSource={negativeComments}
          pagination={{ 
            current: currentPage,
            pageSize: pageSize,
            total: negativeComments.length,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTitle: false,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1); // 改变页面大小时回到第一页
              setPageSize(size);
            }
          }}
          onChange={handleTableChange}
          rowKey={(record, index) => `comment-${index}`}
          size="small"
          scroll={{ x: 'max-content' }}
          defaultSortOrder="descend"
          sortedInfo={{ field: 'confidence', order: 'descend' }}
        />
        ) : (
          <Empty 
            description="暂无极端负面评论" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* 统计信息 */}
      <Row gutter={[24, 24]} style={{ marginTop: 32 }}>
        <Col span={12}>
          <Card 
            title={
              <span style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#2c3e50',
                display: 'flex',
                alignItems: 'center'
              }}>
                <UserOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#3498db',
                  padding: '6px',
                  background: 'rgba(52, 152, 219, 0.1)',
                  borderRadius: '6px'
                }} />
                按用户统计极端负面评论
              </span>
            }
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
              borderRadius: '16px 16px 0 0',
              border: 'none',
              padding: '16px 20px'
            }}
            bodyStyle={{
              padding: '20px'
            }}
          >
            {userStats.length > 0 ? (
                    <Table
                      columns={[
                        {
                    title: '用户',
                    dataIndex: 'user',
                    key: 'user',
                    render: (user) => (
                      <span>
                        <UserOutlined style={{ marginRight: 8 }} />
                        {user}
                      </span>
                    )
                  },
                  {
                    title: '极端负面评论数',
                    dataIndex: 'extreme_negative_count',
                    key: 'extreme_negative_count',
                    sorter: (a, b) => a.extreme_negative_count - b.extreme_negative_count,
                    defaultSortOrder: 'descend',
                    render: (count) => <Tag color="red">{count}</Tag>
                  },
                  {
                    title: '涉及平台',
                    dataIndex: 'platforms',
                    key: 'platforms',
                    render: (platforms) => (
                      <Space>
                        {platforms.map(platform => getPlatformTag(platform))}
                      </Space>
                    )
                  }
                ]}
                dataSource={userStats}
                pagination={{ pageSize: 10 }}
                rowKey="user"
                size="small"
                defaultSortOrder="descend"
                sortedInfo={{ field: 'extreme_negative_count', order: 'descend' }}
              />
            ) : (
              <Empty description="暂无用户统计数据" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <span style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#2c3e50',
                display: 'flex',
                alignItems: 'center'
              }}>
                <AlertOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#e67e22',
                  padding: '6px',
                  background: 'rgba(230, 126, 34, 0.1)',
                  borderRadius: '6px'
                }} />
                按平台统计极端负面评论
              </span>
            }
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)'
            }}
            headStyle={{
              background: 'linear-gradient(135deg, rgba(230, 126, 34, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
              borderRadius: '16px 16px 0 0',
              border: 'none',
              padding: '16px 20px'
            }}
            bodyStyle={{
              padding: '20px'
            }}
          >
            {platformStats.length > 0 ? (
              <Table
                columns={[
                  {
                    title: '平台',
                    dataIndex: 'platform',
                    key: 'platform',
                    render: (platform) => getPlatformTag(platform)
                  },
                  {
                    title: '极端负面评论数',
                    dataIndex: 'extreme_negative_count',
                    key: 'extreme_negative_count',
                    sorter: (a, b) => a.extreme_negative_count - b.extreme_negative_count,
                    defaultSortOrder: 'descend',
                    render: (count) => <Tag color="red">{count}</Tag>
                  },
                  {
                    title: '涉及用户数',
                    dataIndex: 'unique_users',
                    key: 'unique_users',
                    sorter: (a, b) => a.unique_users - b.unique_users,
                    render: (count) => <Tag color="blue">{count}</Tag>
                  }
                ]}
                dataSource={platformStats}
                pagination={false}
                rowKey="platform"
                size="small"
                defaultSortOrder="descend"
                sortedInfo={{ field: 'extreme_negative_count', order: 'descend' }}
              />
            ) : (
              <Empty description="暂无平台统计数据" />
            )}
                    </Card>
                  </Col>
                </Row>

      {/* 评论详情模态框 */}
      <Modal
        title="评论详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedComment && (
          <Descriptions title="详细信息" bordered>
            <Descriptions.Item label="用户" span={2}>
              <UserOutlined style={{ marginRight: 8 }} />
              {selectedComment.user}
            </Descriptions.Item>
            <Descriptions.Item label="平台">
              {getPlatformTag(selectedComment.platform)}
                    </Descriptions.Item>
                    
            <Descriptions.Item label="发布时间" span={3}>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              {formatTime(selectedComment.time)}
                        </Descriptions.Item>
            
            <Descriptions.Item label="评论内容" span={3}>
              <div style={{ 
                padding: '12px', 
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '6px',
                color: '#a8071a'
              }}>
                {selectedComment.content}
              </div>
                    </Descriptions.Item>
                    
            <Descriptions.Item label="情感分析" span={1}>
              <Tag color="red">负面</Tag>
                      </Descriptions.Item>
            
            {selectedComment.confidence && (
              <Descriptions.Item label="置信度" span={2}>
                <Tag color={selectedComment.confidence >= 0.8 ? 'green' : 
                           selectedComment.confidence >= 0.6 ? 'orange' : 'red'}>
                  {(selectedComment.confidence * 100).toFixed(1)}%
                      </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
        )}
      </Modal>
    </div>
  );
};

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.7;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .ant-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .ant-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
  }
  
  .ant-table-tbody > tr:hover {
    background: linear-gradient(135deg, rgba(52, 152, 219, 0.05) 0%, rgba(155, 89, 182, 0.05) 100%) !important;
    transform: scale(1.01);
    transition: all 0.2s ease;
  }
  
  .ant-statistic-content {
    animation: fadeInUp 0.8s ease-out;
  }
`;

if (!document.head.querySelector('#anomaly-detection-styles')) {
  style.id = 'anomaly-detection-styles';
  document.head.appendChild(style);
}

export default AnomalyDetectionResults;