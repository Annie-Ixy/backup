import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, DatePicker, Checkbox, Row, Col, message, Spin } from 'antd';
import { SearchOutlined, BarChartOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import SentimentCharts from '../components/SentimentCharts';
import AnomalyDetectionResults from '../components/AnomalyDetectionResults';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Analysis = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [platforms, setPlatforms] = useState([]);

  // 获取平台列表
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/platforms');
        const result = await response.json();
        if (result.success) {
          setPlatforms(result.data || []);
        }
      } catch (error) {
        console.error('获取平台列表失败:', error);
      }
    };
    fetchPlatforms();
  }, []);

  const handleAnalysis = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: values.keywords,
          start_date: values.dateRange ? values.dateRange[0].format('YYYY-MM-DD') : null,
          end_date: values.dateRange ? values.dateRange[1].format('YYYY-MM-DD') : null,
          platforms: values.platforms,
          analysis_types: values.analysisTypes,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setAnalysisResult(result.data);
        message.success('分析完成！');
      } else {
        message.error(result.message || '分析失败');
      }
    } catch (error) {
      message.error('分析请求失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div>
      <Card title="Dash Social数据分析" style={{ marginBottom: '24px' }}>
        <p>基于关键词和时间范围进行品牌提及、情感分析和特殊情况监控</p>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAnalysis}
          initialValues={{
            analysisTypes: ['brand_mentions', 'sentiment', 'bad_cases']
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="分析关键词"
                name="keywords"
                rules={[{ required: true, message: '请输入关键词' }]}
              >
                <Select
                  mode="tags"
                  placeholder="请输入关键词，支持多个"
                  style={{ width: '100%' }}
                >
                  <Option value="petlibro">petlibro</Option>
                  <Option value="Scout Smart Camera">Scout Smart Camera</Option>
                  <Option value="Fountain">Fountain</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="时间范围"
                name="dateRange"
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="平台筛选"
                name="platforms"
              >
                <Select
                  mode="multiple"
                  placeholder="选择平台（可多选）"
                  allowClear
                >
                  {platforms.map(platform => (
                    <Option key={platform} value={platform}>{platform}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="分析类型"
                name="analysisTypes"
                rules={[{ required: true, message: '请选择分析类型' }]}
              >
                <Checkbox.Group>
                  <Checkbox value="brand_mentions">品牌提及分析</Checkbox>
                  <Checkbox value="sentiment">情感分析</Checkbox>
                  <Checkbox value="bad_cases">异常检测</Checkbox>
                </Checkbox.Group>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={loading}
              size="large"
            >
              开始分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <p style={{ marginTop: '16px' }}>正在分析数据，请稍候...</p>
          </div>
        </Card>
      )}

      {analysisResult && (
        <Card title={<><BarChartOutlined /> 分析结果</>} style={{ marginBottom: '24px' }}>
          {/* 情感分析图表 */}
          {analysisResult.sentiment_analysis && (
            <SentimentCharts 
              sentimentData={analysisResult.sentiment_analysis} 
              loading={false}
            />
          )}
          
          {/* 其他分析结果 */}
          {analysisResult.brand_mentions && (
            <Card title="品牌提及分析" style={{ marginTop: '24px' }}>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p>品牌提及分析结果（待开发）</p>
              </div>
            </Card>
          )}
          
          {/* 异常检测分析 */}
          {analysisResult && Object.keys(analysisResult).includes('bad_cases') && (
            <div style={{ marginTop: '24px' }}>
              <AnomalyDetectionResults 
                data={analysisResult} 
                loading={false}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Analysis;