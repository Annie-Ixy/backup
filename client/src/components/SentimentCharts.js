import React, { useEffect, useRef, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, DatePicker, Select, Button, Tooltip } from 'antd';
import { SmileOutlined, FrownOutlined, MehOutlined, ClockCircleOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';

const SentimentCharts = ({ sentimentData, loading = false }) => {
  const pieChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const channelChartRef = useRef(null);
  const hourlyChartRef = useRef(null);
  
  // 24小时分布相关状态
  const [selectedDates, setSelectedDates] = useState([]);
  const [hourlyViewMode, setHourlyViewMode] = useState('aggregated'); // 'aggregated' | 'by_date'
  
  // 获取可用日期列表
  const getAvailableDates = () => {
    if (!sentimentData?.hourly_analysis?.by_date) return [];
    return Object.keys(sentimentData.hourly_analysis.by_date).sort();
  };
  
  // 处理日期选择变化
  const handleDateSelectionChange = (dates) => {
    setSelectedDates(dates);
    // 不再调用API，只在前端切换数据显示
  };
  
  // 清除日期选择
  const handleClearDates = () => {
    setSelectedDates([]);
    setHourlyViewMode('aggregated');
  };

  // 初始化饼图
  useEffect(() => {
    if (!sentimentData?.chart_data?.pie_data || loading) return;

    const chart = echarts.init(pieChartRef.current);
    const option = {
      title: {
        text: '情感分布',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        data: ['正面', '负面', '中性']
      },
      series: [
        {
          name: '情感分布',
          type: 'pie',
          radius: ['30%', '70%'],
          center: ['60%', '50%'],
          data: sentimentData.chart_data.pie_data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          itemStyle: {
            color: function(params) {
              const colors = {
                '正面': '#52c41a',
                '负面': '#ff4d4f', 
                '中性': '#faad14'
              };
              return colors[params.name] || '#1890ff';
            }
          }
        }
      ]
    };
    chart.setOption(option);

    return () => chart.dispose();
  }, [sentimentData, loading, selectedDates, hourlyViewMode]);

  // 初始化趋势图
  useEffect(() => {
    if (!sentimentData?.chart_data?.trend_data || loading) return;

    const chart = echarts.init(trendChartRef.current);
    const trendData = sentimentData.chart_data.trend_data;
    
    const option = {
      title: {
        text: '情感趋势变化',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['正面', '负面', '中性'],
        top: 50
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.dates
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '正面',
          type: 'line',
          stack: '总量',
          data: trendData.positive,
          itemStyle: { color: '#52c41a' },
          areaStyle: { opacity: 0.3 }
        },
        {
          name: '负面',
          type: 'line',
          stack: '总量',
          data: trendData.negative,
          itemStyle: { color: '#ff4d4f' },
          areaStyle: { opacity: 0.3 }
        },
        {
          name: '中性',
          type: 'line',
          stack: '总量',
          data: trendData.neutral,
          itemStyle: { color: '#faad14' },
          areaStyle: { opacity: 0.3 }
        }
      ]
    };
    chart.setOption(option);

    return () => chart.dispose();
  }, [sentimentData, loading, selectedDates, hourlyViewMode]);

  // 初始化渠道对比图
  useEffect(() => {
    if (!sentimentData?.chart_data?.channel_data || loading) return;

    const chart = echarts.init(channelChartRef.current);
    const channelData = sentimentData.chart_data.channel_data;
    
    const option = {
      title: {
        text: '各渠道情感对比',
        left: 'center',
        top: 20,
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
        top: 50
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: channelData.channels
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '正面',
          type: 'bar',
          data: channelData.data.map(item => item.positive),
          itemStyle: { color: '#52c41a' }
        },
        {
          name: '负面',
          type: 'bar',
          data: channelData.data.map(item => item.negative),
          itemStyle: { color: '#ff4d4f' }
        },
        {
          name: '中性',
          type: 'bar',
          data: channelData.data.map(item => item.neutral),
          itemStyle: { color: '#faad14' }
        }
      ]
    };
    chart.setOption(option);

    return () => chart.dispose();
  }, [sentimentData, loading, selectedDates, hourlyViewMode]);

  // 初始化小时分布图
  useEffect(() => {
    if (!sentimentData?.chart_data?.hourly_data || loading) return;

    const chart = echarts.init(hourlyChartRef.current);
    
    // 根据选择的日期和视图模式决定使用哪个数据
    let chartTitle = '24小时情感分布';
    let seriesData = [];
    
    if (hourlyViewMode === 'by_date' && selectedDates.length > 0) {
      // 按日期模式：显示选中日期的数据
      const byDateData = sentimentData.hourly_analysis?.by_date || {};
      
      if (selectedDates.length === 1) {
        // 单日期详细视图
        const dateData = byDateData[selectedDates[0]] || sentimentData.chart_data.hourly_data;
        chartTitle = `24小时情感分布 - ${selectedDates[0]}`;
        seriesData = [
          {
            name: '正面',
            type: 'line',
            data: dateData.positive || [],
            itemStyle: { color: '#52c41a' },
            smooth: true
          },
          {
            name: '负面',
            type: 'line',
            data: dateData.negative || [],
            itemStyle: { color: '#ff4d4f' },
            smooth: true
          },
          {
            name: '中性',
            type: 'line',
            data: dateData.neutral || [],
            itemStyle: { color: '#faad14' },
            smooth: true
          }
        ];
      } else {
        // 多日期对比视图
        chartTitle = `24小时情感分布 - ${selectedDates.length}个日期对比`;
        const colors = ['#52c41a', '#ff4d4f', '#faad14', '#1890ff', '#722ed1', '#f5222d'];
        
        selectedDates.forEach((date, index) => {
          const dateData = byDateData[date];
          if (dateData) {
            const colorIndex = index % colors.length;
            seriesData.push(
              {
                name: `${date}-正面`,
                type: 'line',
                data: dateData.positive || [],
                itemStyle: { color: colors[colorIndex] },
                lineStyle: { type: 'solid' },
                smooth: true
              },
              {
                name: `${date}-负面`,
                type: 'line',
                data: dateData.negative || [],
                itemStyle: { color: colors[colorIndex] },
                lineStyle: { type: 'dashed' },
                smooth: true
              },
              {
                name: `${date}-中性`,
                type: 'line',
                data: dateData.neutral || [],
                itemStyle: { color: colors[colorIndex] },
                lineStyle: { type: 'dotted' },
                smooth: true
              }
            );
          }
        });
      }
    } else {
      // 汇总模式：使用默认汇总数据
      const hourlyData = sentimentData.chart_data.hourly_data;
      seriesData = [
        {
          name: '正面',
          type: 'line',
          data: hourlyData.positive || [],
          itemStyle: { color: '#52c41a' },
          smooth: true
        },
        {
          name: '负面',
          type: 'line',
          data: hourlyData.negative || [],
          itemStyle: { color: '#ff4d4f' },
          smooth: true
        },
        {
          name: '中性',
          type: 'line',
          data: hourlyData.neutral || [],
          itemStyle: { color: '#faad14' },
          smooth: true
        }
      ];
    }
    
    const option = {
      title: {
        text: chartTitle,
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: seriesData.map(s => s.name),
        top: 50,
        type: 'scroll',
        orient: selectedDates.length > 1 && hourlyViewMode === 'by_date' ? 'vertical' : 'horizontal',
        right: selectedDates.length > 1 && hourlyViewMode === 'by_date' ? 10 : 'center',
        height: selectedDates.length > 1 && hourlyViewMode === 'by_date' ? '60%' : 'auto'
      },
      grid: {
        left: '3%',
        right: selectedDates.length > 1 && hourlyViewMode === 'by_date' ? '25%' : '4%',
        bottom: '3%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: Array.from({length: 24}, (_, i) => `${i}:00`)
      },
      yAxis: {
        type: 'value'
      },
      series: seriesData
    };
    chart.setOption(option);

    return () => chart.dispose();
  }, [sentimentData, loading, selectedDates, hourlyViewMode]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px' }}>正在分析情感数据...</p>
        </div>
      </Card>
    );
  }

  if (!sentimentData || sentimentData.error) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '50vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px'
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
          <p style={{ fontSize: '16px', color: '#7f8c8d' }}>暂无情感分析数据</p>
          {sentimentData?.error && <p style={{ color: '#e74c3c', fontSize: '14px' }}>错误: {sentimentData.error}</p>}
        </Card>
      </div>
    );
  }

  const stats = sentimentData.sentiment_stats || {};
  
  // 调试：打印数据
  console.log('SentimentCharts - sentimentData:', sentimentData);
  console.log('SentimentCharts - stats:', stats);
  
  // 确保有默认数据显示
  const displayStats = {
    total_comments: stats.total_comments ?? 0,
    positive_count: stats.positive_count ?? 0,
    negative_count: stats.negative_count ?? 0,
    neutral_count: stats.neutral_count ?? 0,
    positive_rate: stats.positive_rate ?? 0,
    negative_rate: stats.negative_rate ?? 0,
    neutral_rate: stats.neutral_rate ?? 0
  };
  
  // 不使用测试数据，显示真实的查询结果（即使为0）
  console.log('显示真实数据统计:', displayStats);

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
            🎭 情感分析概览
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#7f8c8d',
            margin: 0,
            fontWeight: '500',
            lineHeight: '1.6'
          }}>
            基于AI智能分析的用户评论情感倾向检测与统计
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

      {/* 情感统计概览 */}
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
            <div style={{ position: 'relative', zIndex: 2, padding: '20px', textAlign: 'center' }}>
              <div style={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '14px', 
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                总评论数
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {displayStats.total_comments}
                <span style={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '16px',
                  marginLeft: '4px'
                }}>
                  条
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
        <Col span={6}>
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
                <SmileOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                正面评论
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {displayStats.positive_count}
              </div>
              <div style={{ 
                color: 'rgba(255,255,255,0.8)', 
                fontSize: '14px',
                marginTop: '4px'
              }}>
                ({displayStats.positive_rate.toFixed(1)}%)
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
        <Col span={6}>
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
                <FrownOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                负面评论
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {displayStats.negative_count}
              </div>
              <div style={{ 
                color: 'rgba(255,255,255,0.8)', 
                fontSize: '14px',
                marginTop: '4px'
              }}>
                ({displayStats.negative_rate.toFixed(1)}%)
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
        <Col span={6}>
          <Card style={{
            background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(243, 156, 18, 0.3)',
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
                <MehOutlined style={{ color: '#fff', fontSize: '16px', marginRight: '6px' }} />
                中性评论
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {displayStats.neutral_count}
              </div>
              <div style={{ 
                color: 'rgba(255,255,255,0.8)', 
                fontSize: '14px',
                marginTop: '4px'
              }}>
                ({displayStats.neutral_rate.toFixed(1)}%)
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



      {/* AI智能总结区域 */}
      {sentimentData?.ai_summary && (
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
              }}>🤖</span>
              AI智能总结
              {sentimentData?.ai_enhanced && (
                <span style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: '12px',
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
          <div style={{ 
            whiteSpace: 'pre-line', 
            lineHeight: '1.8',
            fontSize: '20px',
            color: '#34495e',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(255,255,255,0.5) 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(102, 126, 234, 0.1)',
            fontFamily: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
          }}>
            {sentimentData.ai_summary}
          </div>
        </Card>
      )}

      {/* 当没有AI总结但有数据时，显示基础信息 */}
      {!sentimentData?.ai_summary && displayStats.total_comments > 0 && (
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
                color: '#95a5a6'
              }}>📊</span>
              数据概览
            </span>
          }
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            marginBottom: 32,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}
          headStyle={{
            background: 'linear-gradient(135deg, rgba(149, 165, 166, 0.05) 0%, rgba(255,255,255,0.9) 100%)',
            borderRadius: '16px 16px 0 0',
            border: 'none',
            padding: '16px 24px'
          }}
          bodyStyle={{
            padding: '24px'
          }}
        >
          <div style={{ 
            lineHeight: '1.6',
            fontSize: '20px',
            color: '#7f8c8d',
            textAlign: 'center'
          }}>
            本次分析了 <strong style={{color: '#2c3e50'}}>{displayStats.total_comments}</strong> 条评论数据
            <br />
            包含 <strong style={{color: '#27ae60'}}>{displayStats.positive_count}</strong> 条正面评论，
            <strong style={{color: '#e74c3c'}}>{displayStats.negative_count}</strong> 条负面评论，
            <strong style={{color: '#f39c12'}}>{displayStats.neutral_count}</strong> 条中性评论
          </div>
        </Card>
      )}

      {/* 图表展示 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col span={12}>
          <Card style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div ref={pieChartRef} style={{ width: '100%', height: '370px' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div ref={trendChartRef} style={{ width: '100%', height: '370px' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div ref={channelChartRef} style={{ width: '100%', height: '370px' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Select
                    size="small"
                    value={hourlyViewMode}
                    onChange={setHourlyViewMode}
                    style={{ width: 100 }}
                    options={[
                      { value: 'aggregated', label: '汇总' },
                      { value: 'by_date', label: '按日期' }
                    ]}
                  />
                  {hourlyViewMode === 'by_date' && (
                    <>
                      <Select
                        mode="multiple"
                        size="small"
                        placeholder={getAvailableDates().length > 0 ? "选择日期" : "暂无可用日期"}
                        value={selectedDates}
                        onChange={handleDateSelectionChange}
                        style={{ minWidth: 150, maxWidth: 200 }}
                        options={getAvailableDates().map(date => ({ value: date, label: date }))}
                        maxTagCount={2}
                        maxTagTextLength={8}
                        disabled={getAvailableDates().length === 0}
                        allowClear
                      />
                      {selectedDates.length > 0 && (
                        <Tooltip title="清除日期选择">
                          <Button 
                            size="small" 
                            type="text" 
                            onClick={handleClearDates}
                            style={{ padding: '0 4px' }}
                          >
                            重置
                          </Button>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
              </div>
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
            <div ref={hourlyChartRef} style={{ width: '100%', height: '370px' }} />
          </Card>
        </Col>
      </Row>

      {/* 典型样例 */}
      {sentimentData.examples && (
        <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
          <Col span={12}>
            <Card title="正面评论样例" size="small">
              {sentimentData.examples.high_positive?.map((example, index) => (
                <div key={index} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f6ffed', borderRadius: '4px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>{example.text}</p>
                  <small style={{ color: '#666' }}>作者: {example.author_name} | 时间: {example.last_update}</small>
                </div>
              ))}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="负面评论样例" size="small">
              {sentimentData.examples.high_negative?.map((example, index) => (
                <div key={index} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#fff2f0', borderRadius: '4px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>{example.text}</p>
                  <small style={{ color: '#666' }}>作者: {example.author_name} | 时间: {example.last_update}</small>
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
`;

if (!document.head.querySelector('#sentiment-charts-styles')) {
  style.id = 'sentiment-charts-styles';
  document.head.appendChild(style);
}

export default SentimentCharts;