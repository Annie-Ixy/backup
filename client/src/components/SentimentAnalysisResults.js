import React, { useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Typography, Divider, Tag, Alert } from 'antd';
import { BarChartOutlined, PieChartOutlined, LineChartOutlined, ClockCircleOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';

const { Title, Paragraph, Text } = Typography;

const SentimentAnalysisResults = ({ data }) => {
  const pieChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const channelChartRef = useRef(null);
  const hourlyChartRef = useRef(null);

  const sentimentData = data?.sentiment_analysis;
  const sentimentStats = sentimentData?.sentiment_stats;
  const chartData = sentimentData?.chart_data;
  const aiSummary = sentimentData?.ai_summary;
  const isAiEnhanced = sentimentData?.ai_enhanced;

  useEffect(() => {
    if (chartData) {
      initPieChart();
      initTrendChart();
      initChannelChart();
      initHourlyChart();
    }

    // 清理函数
    return () => {
      if (pieChartRef.current) {
        echarts.dispose(pieChartRef.current);
      }
      if (trendChartRef.current) {
        echarts.dispose(trendChartRef.current);
      }
      if (channelChartRef.current) {
        echarts.dispose(channelChartRef.current);
      }
      if (hourlyChartRef.current) {
        echarts.dispose(hourlyChartRef.current);
      }
    };
  }, [chartData]);

  const initPieChart = () => {
    if (!pieChartRef.current || !chartData?.pie_data) return;

    const chart = echarts.init(pieChartRef.current);
    const option = {
      title: {
        text: '情感分布',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'horizontal',
        bottom: 10,
        data: ['正面', '负面', '中性']
      },
      color: ['#52c41a', '#ff4d4f', '#faad14'],
      series: [
        {
          name: '情感分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: chartData.pie_data
        }
      ]
    };

    chart.setOption(option);
    
    // 响应式
    window.addEventListener('resize', () => {
      chart.resize();
    });
  };

  const initTrendChart = () => {
    if (!trendChartRef.current || !chartData?.trend_data) return;

    const chart = echarts.init(trendChartRef.current);
    const trendData = chartData.trend_data;

    const option = {
      title: {
        text: '情感趋势',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['正面', '负面', '中性'],
        bottom: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: trendData.dates,
        axisLabel: {
          rotate: 45,
          interval: 0,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '评论数量'
      },
      color: ['#52c41a', '#ff4d4f', '#faad14'],
      series: [
        {
          name: '正面',
          type: 'line',
          stack: 'Total',
          smooth: true,
          data: trendData.positive
        },
        {
          name: '负面',
          type: 'line',
          stack: 'Total',
          smooth: true,
          data: trendData.negative
        },
        {
          name: '中性',
          type: 'line',
          stack: 'Total',
          smooth: true,
          data: trendData.neutral
        }
      ]
    };

    chart.setOption(option);
    
    window.addEventListener('resize', () => {
      chart.resize();
    });
  };

  const initChannelChart = () => {
    if (!channelChartRef.current || !chartData?.channel_data) return;

    const chart = echarts.init(channelChartRef.current);
    const channelData = chartData.channel_data;

    const option = {
      title: {
        text: '平台情感对比',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['正面', '负面', '中性'],
        bottom: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: channelData.channels,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: '评论数量'
      },
      color: ['#52c41a', '#ff4d4f', '#faad14'],
      series: [
        {
          name: '正面',
          type: 'bar',
          stack: 'total',
          data: channelData.data.map(item => item.positive)
        },
        {
          name: '负面',
          type: 'bar',
          stack: 'total',
          data: channelData.data.map(item => item.negative)
        },
        {
          name: '中性',
          type: 'bar',
          stack: 'total',
          data: channelData.data.map(item => item.neutral)
        }
      ]
    };

    chart.setOption(option);
    
    window.addEventListener('resize', () => {
      chart.resize();
    });
  };

  const initHourlyChart = () => {
    if (!hourlyChartRef.current || !chartData?.hourly_data?.hours) return;

    const chart = echarts.init(hourlyChartRef.current);
    const hourlyData = chartData.hourly_data;

    const option = {
      title: {
        text: '24小时情感分布',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['正面', '负面', '中性'],
        bottom: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: hourlyData.hours.map(h => h + ':00'),
        name: '小时'
      },
      yAxis: {
        type: 'value',
        name: '评论数量'
      },
      color: ['#52c41a', '#ff4d4f', '#faad14'],
      series: [
        {
          name: '正面',
          type: 'bar',
          data: hourlyData.positive
        },
        {
          name: '负面',
          type: 'bar',
          data: hourlyData.negative
        },
        {
          name: '中性',
          type: 'bar',
          data: hourlyData.neutral
        }
      ]
    };

    chart.setOption(option);
    
    window.addEventListener('resize', () => {
      chart.resize();
    });
  };

  if (!sentimentData) {
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
          <Alert 
            message="暂无情感分析数据" 
            type="info" 
            style={{
              background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
              border: '1px solid #64b5f6',
              borderRadius: '12px'
            }}
          />
        </Card>
      </div>
    );
  }

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
          <BarChartOutlined style={{ marginRight: '12px', color: '#3498db' }} />
          情感分析概览
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#7f8c8d', 
          margin: 0,
          fontWeight: '400'
        }}>
          基于AI智能分析的社交媒体情感趋势洞察
        </p>
      </div>

      {/* 统计概览 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col span={6}>
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
                value={sentimentStats?.total_comments || 0}
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
        <Col span={6}>
          <Card style={{
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(17, 153, 142, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>正面情感</span>}
                value={sentimentStats?.positive_rate || 0}
                precision={1}
                suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>%</span>}
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
        <Col span={6}>
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
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>负面情感</span>}
                value={sentimentStats?.negative_rate || 0}
                precision={1}
                suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>%</span>}
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
        <Col span={6}>
          <Card style={{
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(252, 182, 159, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Statistic
                title={<span style={{ color: 'rgba(95, 95, 95, 0.9)', fontSize: '14px', fontWeight: '500' }}>中性情感</span>}
                value={sentimentStats?.neutral_rate || 0}
                precision={1}
                suffix={<span style={{ color: 'rgba(95, 95, 95, 0.8)', fontSize: '16px' }}>%</span>}
                valueStyle={{ color: '#5f5f5f', fontSize: '32px', fontWeight: '700' }}
              />
            </div>
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              background: 'rgba(95, 95, 95, 0.1)',
              borderRadius: '50%'
            }} />
          </Card>
        </Col>
      </Row>

      {/* AI总结 */}
      {aiSummary && (
        <Card 
          title={
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center'
            }}>
              <BarChartOutlined style={{ 
                marginRight: '12px', 
                fontSize: '20px',
                color: '#9b59b6',
                padding: '8px',
                background: 'rgba(155, 89, 182, 0.1)',
                borderRadius: '8px'
              }} />
              AI智能总结
              {isAiEnhanced && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '12px',
                  color: '#fff',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  padding: '4px 10px',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  AI增强
                </span>
              )}
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
            background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
            borderRadius: '16px 16px 0 0',
            border: 'none',
            padding: '20px 24px'
          }}
          bodyStyle={{
            padding: '24px'
          }}
        >
          <div style={{ 
            whiteSpace: 'pre-line', 
            lineHeight: '1.8',
            fontSize: '15px',
            color: '#34495e',
            background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.02) 0%, rgba(255,255,255,0.5) 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(155, 89, 182, 0.1)'
          }}>
            {aiSummary}
          </div>
        </Card>
      )}

      {/* 图表展示 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {/* 情感分布饼图 */}
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
                <PieChartOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#e74c3c',
                  padding: '6px',
                  background: 'rgba(231, 76, 60, 0.1)',
                  borderRadius: '6px'
                }} />
                情感分布
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
              background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
              borderRadius: '16px 16px 0 0',
              border: 'none',
              padding: '16px 20px'
            }}
            bodyStyle={{
              padding: '20px'
            }}
          >
            <div ref={pieChartRef} style={{ width: '100%', height: '320px' }} />
          </Card>
        </Col>

        {/* 情感趋势图 */}
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
                <LineChartOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#3498db',
                  padding: '6px',
                  background: 'rgba(52, 152, 219, 0.1)',
                  borderRadius: '6px'
                }} />
                情感趋势
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
            <div ref={trendChartRef} style={{ width: '100%', height: '320px' }} />
          </Card>
        </Col>

        {/* 平台对比图 */}
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
                <BarChartOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#27ae60',
                  padding: '6px',
                  background: 'rgba(39, 174, 96, 0.1)',
                  borderRadius: '6px'
                }} />
                平台情感对比
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
              background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
              borderRadius: '16px 16px 0 0',
              border: 'none',
              padding: '16px 20px'
            }}
            bodyStyle={{
              padding: '20px'
            }}
          >
            <div ref={channelChartRef} style={{ width: '100%', height: '320px' }} />
          </Card>
        </Col>

        {/* 24小时分布图 */}
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
                <ClockCircleOutlined style={{ 
                  marginRight: '8px', 
                  fontSize: '18px',
                  color: '#f39c12',
                  padding: '6px',
                  background: 'rgba(243, 156, 18, 0.1)',
                  borderRadius: '6px'
                }} />
                24小时分布
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
              background: 'linear-gradient(135deg, rgba(243, 156, 18, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
              borderRadius: '16px 16px 0 0',
              border: 'none',
              padding: '16px 20px'
            }}
            bodyStyle={{
              padding: '20px'
            }}
          >
            <div ref={hourlyChartRef} style={{ width: '100%', height: '320px' }} />
          </Card>
        </Col>
      </Row>

      {/* 典型评论示例 */}
      {sentimentData?.examples && (
        <Row gutter={[24, 24]}>
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
                  <span style={{ 
                    marginRight: '8px', 
                    fontSize: '18px',
                    color: '#27ae60',
                    padding: '6px',
                    background: 'rgba(39, 174, 96, 0.1)',
                    borderRadius: '6px'
                  }}>
                    😊
                  </span>
                  正面评论示例
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
                background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
                borderRadius: '16px 16px 0 0',
                border: 'none',
                padding: '16px 20px'
              }}
              bodyStyle={{
                padding: '20px'
              }}
            >
              {sentimentData.examples.high_positive?.map((comment, index) => (
                <div key={index} style={{ 
                  marginBottom: '16px', 
                  padding: '16px', 
                  background: 'linear-gradient(135deg, rgba(39, 174, 96, 0.08) 0%, rgba(255,255,255,0.5) 100%)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(39, 174, 96, 0.15)',
                  transition: 'all 0.2s ease'
                }}>
                  <Text style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.6', 
                    color: '#2c3e50',
                    display: 'block'
                  }}>
                    {comment.text}
                  </Text>
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: '#7f8c8d',
                    borderTop: '1px solid rgba(39, 174, 96, 0.1)',
                    paddingTop: '8px'
                  }}>
                    <Text type="secondary">@{comment.author_name} · {comment.last_update}</Text>
                  </div>
                </div>
              ))}
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
                  <span style={{ 
                    marginRight: '8px', 
                    fontSize: '18px',
                    color: '#e74c3c',
                    padding: '6px',
                    background: 'rgba(231, 76, 60, 0.1)',
                    borderRadius: '6px'
                  }}>
                    😞
                  </span>
                  负面评论示例
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
                background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
                borderRadius: '16px 16px 0 0',
                border: 'none',
                padding: '16px 20px'
              }}
              bodyStyle={{
                padding: '20px'
              }}
            >
              {sentimentData.examples.high_negative?.map((comment, index) => (
                <div key={index} style={{ 
                  marginBottom: '16px', 
                  padding: '16px', 
                  background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.08) 0%, rgba(255,255,255,0.5) 100%)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(231, 76, 60, 0.15)',
                  transition: 'all 0.2s ease'
                }}>
                  <Text style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.6', 
                    color: '#2c3e50',
                    display: 'block'
                  }}>
                    {comment.text}
                  </Text>
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: '#7f8c8d',
                    borderTop: '1px solid rgba(231, 76, 60, 0.1)',
                    paddingTop: '8px'
                  }}>
                    <Text type="secondary">@{comment.author_name} · {comment.last_update}</Text>
                  </div>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      )}
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
  
  .sentiment-comment:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }
`;

if (!document.head.querySelector('#sentiment-analysis-styles')) {
  style.id = 'sentiment-analysis-styles';
  document.head.appendChild(style);
}

export default SentimentAnalysisResults;