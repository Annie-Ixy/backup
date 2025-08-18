import React, { useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Tag, List, Empty } from 'antd';
import { 
  MessageOutlined,
  CalendarOutlined,
  SmileOutlined,
  FrownOutlined,
  MehOutlined,
  TrophyOutlined,
  RiseOutlined,
  TagsOutlined
} from '@ant-design/icons';
import * as echarts from 'echarts';

const BrandMentionResults = ({ brandData, loading = false }) => {
  const trendChartRef = useRef(null);

  // 获取数据
  const { summary, keyword_analysis } = brandData || {};

  // 初始化趋势图表
  useEffect(() => {
    if (!trendChartRef.current || !keyword_analysis) return;

    const chart = echarts.init(trendChartRef.current);
    
    // 准备趋势图数据
    const allDates = new Set();
    Object.values(keyword_analysis).forEach(data => {
      Object.keys(data.daily_breakdown || {}).forEach(date => allDates.add(date));
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    const series = Object.entries(keyword_analysis).map(([keyword, data], index) => {
      const colors = ['#667eea', '#764ba2', '#11998e', '#38ef7d', '#f093fb', '#f5576c'];
      return {
        name: keyword,
        type: 'line',
        smooth: true,
        data: sortedDates.map(date => data.daily_breakdown[date] || 0),
        itemStyle: { color: colors[index % colors.length] },
        lineStyle: { width: 3 },
        symbolSize: 6,
        emphasis: {
          focus: 'series',
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' }
        }
      };
    });

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { 
          type: 'cross',
          crossStyle: { color: '#999' }
        },
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(102, 126, 234, 0.2)',
        borderWidth: 1,
        textStyle: { color: '#333' },
        extraCssText: 'box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px);'
      },
      legend: {
        top: 30,
        type: 'scroll',
        textStyle: { color: '#666', fontWeight: '500' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '18%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedDates,
        axisLabel: {
          rotate: 45,
          formatter: (value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
          color: '#666'
        },
        axisLine: { lineStyle: { color: 'rgba(102, 126, 234, 0.2)' } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '提及次数',
        nameTextStyle: { color: '#666' },
        axisLabel: { color: '#666' },
        axisLine: { lineStyle: { color: 'rgba(102, 126, 234, 0.2)' } },
        splitLine: { 
          lineStyle: { 
            color: 'rgba(102, 126, 234, 0.1)',
            type: 'dashed'
          }
        }
      },
      series: series
    };

    chart.setOption(option);
    
    return () => chart.dispose();
  }, [keyword_analysis]);

  // 如果没有数据，显示空状态
  if (!brandData || brandData.error) {
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
          backdropFilter: 'blur(10px)',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>
            📢
          </div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#2c3e50', 
            margin: '0 0 8px 0' 
          }}>
            暂无品牌提及数据
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#7f8c8d', 
            margin: '0 0 16px 0' 
          }}>
            请先上传数据或检查查询条件
          </p>
          {brandData?.error && (
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '1px solid #f87171',
              borderRadius: '12px',
              padding: '12px',
              color: '#dc2626',
              fontSize: '14px'
            }}>
              错误: {brandData.error}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 获取情感图标
  const getSentimentIcon = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return <SmileOutlined style={{ color: '#52c41a' }} />;
      case 'negative': return <FrownOutlined style={{ color: '#ff4d4f' }} />;
      case 'neutral': return <MehOutlined style={{ color: '#faad14' }} />;
      default: return <MehOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 获取情感标签颜色
  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'warning';
      default: return 'default';
    }
  };

  // 渲染评论内容，处理图片链接
  const renderCommentContent = (text) => {
    if (!text) return '暂无评论内容';

    // 检查是否包含图片链接（支持各种图片服务和CDN）
    const imageUrlRegex = /(https?:\/\/[^\s]+(?:\.(jpg|jpeg|png|gif|webp|bmp)|\/[a-zA-Z0-9_-]+\.jpg))/gi;
    
    // 特殊处理：包含 amazonaws.com 等图片服务的链接
    const specialImageServices = [
      'amazonaws.com',
      'cloudinary.com', 
      'imgur.com',
      'instagram.com',
      'facebook.com',
      'dashhudson'
    ];
    
    const parts = [];
    let lastIndex = 0;
    let match;

    // 重置正则表达式
    imageUrlRegex.lastIndex = 0;
    
    while ((match = imageUrlRegex.exec(text)) !== null) {
      const url = match[0];
      const isImageService = specialImageServices.some(service => url.includes(service));
      const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
      
      // 如果是图片扩展名或者是已知的图片服务
      if (hasImageExtension || isImageService) {
        // 添加匹配前的文本
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: text.slice(lastIndex, match.index)
          });
        }
        
        // 添加图片
        parts.push({
          type: 'image',
          content: url
        });
        
        lastIndex = match.index + match[0].length;
      }
    }
    
    // 添加剩余的文本
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }
    
    // 如果没有找到图片，返回原始文本
    if (parts.length === 0) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
    }
    
    return parts.map((part, index) => {
      if (part.type === 'image') {
        return (
          <div key={index} style={{ margin: '12px 0' }}>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              padding: '8px',
              border: '1px solid rgba(102, 126, 234, 0.15)'
            }}>
              <img 
                src={part.content} 
                alt="评论图片"
                style={{
                  width: '100%',
                  maxHeight: '250px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(part.content, '_blank')}
                onError={(e) => {
                  e.target.style.display = 'none';
                  const container = e.target.parentNode;
                  container.innerHTML = `
                    <div style="
                      text-align: center;
                      padding: 16px;
                      color: #666;
                      background: rgba(102, 126, 234, 0.05);
                      border-radius: 6px;
                      border: 1px dashed rgba(102, 126, 234, 0.3);
                    ">
                      <div style="margin-bottom: 8px;">🖼️ 图片加载失败</div>
                      <a href="${part.content}" target="_blank" rel="noopener noreferrer" 
                         style="color: #1890ff; text-decoration: underline; font-size: 12px;">
                        点击查看原图
                      </a>
                    </div>
                  `;
                }}
              />
            </div>
          </div>
        );
      }
      
      return part.content ? (
        <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
          {part.content}
        </span>
      ) : null;
    }).filter(Boolean);
  };

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      padding: '24px',
      fontFamily: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
      borderRadius: '16px'
    }}>
      {/* 页面标题区域 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '40px',
        textAlign: 'center',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0 0 16px 0',
            letterSpacing: '1px'
          }}>
            📢 品牌提及监控
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#7f8c8d',
            margin: 0,
            fontWeight: '500',
            lineHeight: '1.6'
          }}>
            基于评论内容的品牌关键词智能监控与分析
          </p>
        </div>
        <div style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          borderRadius: '50%',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 150,
          height: 150,
          background: 'linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%)',
          borderRadius: '50%',
          zIndex: 1
        }} />
      </div>

      {/* 品牌提及统计概览 */}
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
            <div style={{ position: 'relative', zIndex: 2, padding: '20px', textAlign: 'center' }}>
              <div style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '14px', 
                fontWeight: '500',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TagsOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                监控关键词
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {summary?.total_keywords || 0}
                <span style={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '16px',
                  marginLeft: '4px'
                }}>
                  个
                </span>
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
        <Col span={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(17, 153, 142, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2, padding: '20px', textAlign: 'center' }}>
              <div style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '14px', 
                fontWeight: '500',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RiseOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                总提及次数
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {summary?.total_mentions_all || 0}
                <span style={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '16px',
                  marginLeft: '4px'
                }}>
                  次
                </span>
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
        <Col span={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(245, 87, 108, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2, padding: '20px', textAlign: 'center' }}>
              <div style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '14px', 
                fontWeight: '500',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrophyOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                热门关键词
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '20px', 
                fontWeight: '700',
                lineHeight: '1.2',
                wordBreak: 'break-all'
              }}>
                {summary?.most_mentioned_keyword || '暂无'}
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

      {/* 趋势图表 */}
      <Card 
        title={
          <span style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '20px',
              marginRight: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>📈</span>
            品牌提及趋势
          </span>
        }
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          marginBottom: 32,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden'
        }}
        headStyle={{
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
          borderRadius: '16px 16px 0 0',
          border: 'none',
          padding: '16px 24px'
        }}
        bodyStyle={{
          padding: '24px'
        }}
      >
        {summary?.total_mentions_all > 0 ? (
          <div ref={trendChartRef} style={{ height: '400px' }}></div>
        ) : (
          <div style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ marginBottom: '16px', opacity: 0.3 }}>
              <svg width="120" height="80" viewBox="0 0 120 80">
                <polyline 
                  points="10,70 30,40 50,50 70,20 90,30 110,10" 
                  fill="none" 
                  stroke="#d9d9d9" 
                  strokeWidth="3"
                  strokeDasharray="5,5"
                />
                <polyline 
                  points="10,60 30,55 50,35 70,40 90,25 110,15" 
                  fill="none" 
                  stroke="#bfbfbf" 
                  strokeWidth="3"
                  strokeDasharray="3,3"
                />
              </svg>
            </div>
            <span style={{ fontSize: '16px', color: '#7f8c8d' }}>
              暂无品牌提及趋势数据
            </span>
          </div>
        )}
      </Card>

      {/* 关键词详细列表 */}
      <Card 
        title={
          <span style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#2c3e50',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '20px',
              marginRight: '8px',
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>🏷️</span>
            关键词详情
          </span>
        }
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden'
        }}
        headStyle={{
          background: 'linear-gradient(135deg, rgba(17, 153, 142, 0.05) 0%, rgba(56, 239, 125, 0.05) 100%)',
          borderRadius: '16px 16px 0 0',
          border: 'none',
          padding: '16px 24px'
        }}
        bodyStyle={{
          padding: '24px'
        }}
      >
        {Object.entries(keyword_analysis || {}).map(([keyword, data], index) => (
          <Card 
            key={keyword}
            size="small"
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#2c3e50'
                }}>
                  🔍 关键词：{keyword}
                </span>
                <Tag 
                  color="blue" 
                  style={{ 
                    fontSize: '14px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontWeight: '500'
                  }}
                >
                  {data.total_mentions || 0} 次提及
                </Tag>
              </div>
            }
            style={{ 
              marginBottom: '20px',
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '12px',
              border: '1px solid rgba(102, 126, 234, 0.1)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}
            headStyle={{
              background: `linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(255,255,255,0.8) 100%)`,
              borderRadius: '12px 12px 0 0',
              border: 'none',
              padding: '12px 16px'
            }}
            bodyStyle={{
              padding: '16px'
            }}
          >
            {/* 情感统计 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                marginBottom: '8px',
                color: '#2c3e50',
                display: 'flex',
                alignItems: 'center'
              }}>
                🎭 情感分布：
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(data.sentiment_distribution || {}).map(([sentiment, count]) => (
                  <Tag 
                    key={sentiment} 
                    color={getSentimentColor(sentiment)}
                    style={{ 
                      margin: '2px',
                      padding: '4px 8px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    {getSentimentIcon(sentiment)} {sentiment}: {count}
                  </Tag>
                ))}
              </div>
            </div>

            {/* 评论样例 */}
            {data.sample_mentions && data.sample_mentions.length > 0 && (
              <div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  marginBottom: '12px',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  💬 评论样例：
                </div>
                <List
                  size="small"
                  dataSource={data.sample_mentions.slice(0, 3)}
                  renderItem={(item) => (
                    <List.Item style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '12px',
                      marginBottom: '12px',
                      padding: '16px',
                      border: '1px solid rgba(102, 126, 234, 0.1)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                    }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ 
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <Tag 
                            color={getSentimentColor(item.ai_sentiment)} 
                            size="small"
                            style={{
                              borderRadius: '12px',
                              fontWeight: '500'
                            }}
                          >
                            {getSentimentIcon(item.ai_sentiment)} {item.ai_sentiment}
                          </Tag>
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#999',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <CalendarOutlined style={{ marginRight: '4px' }} /> 
                            {item.last_update} | {item.author_name || '匿名'}
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: '#000000',
                          background: 'rgba(102, 126, 234, 0.02)',
                          padding: '12px',
                          borderRadius: '8px',
                          borderLeft: '4px solid rgba(102, 126, 234, 0.3)',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {renderCommentContent(item.text)}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Card>
        ))}
        
        {(!keyword_analysis || Object.keys(keyword_analysis).length === 0) && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            color: '#7f8c8d',
            fontSize: '16px'
          }}>
            暂无关键词分析数据
          </div>
        )}
      </Card>
    </div>
  );
};

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
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
  
  .ant-statistic-content {
    animation: fadeInUp 0.8s ease-out;
  }
  
  .ant-tag {
    transition: all 0.2s ease;
  }
  
  .ant-tag:hover {
    transform: scale(1.05);
  }
`;

if (!document.head.querySelector('#brand-mention-styles')) {
  style.id = 'brand-mention-styles';
  document.head.appendChild(style);
}

export default BrandMentionResults;