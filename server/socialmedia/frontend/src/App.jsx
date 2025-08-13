import React, { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, ConfigProvider, Row, Col, Card, Tabs } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { 
  UploadOutlined, 
  BarChartOutlined, 
  HistoryOutlined,
  DashboardOutlined,
  HeartOutlined,
  GlobalOutlined,
  PlusOutlined
} from '@ant-design/icons'

// 导入页面组件
import Upload from './views/Upload.jsx'
import Analysis from './views/Analysis.jsx'
import History from './views/History.jsx'
import XiaoHongShu from './views/XiaoHongShu.jsx'
import Reddit from './views/Reddit.jsx'
import PetWebsite from './views/PetWebsite.jsx'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  const location = useLocation()
  const [activeDataSource, setActiveDataSource] = useState('dash-social')

  // 数据源标签页配置
  const dataSourceTabs = [
    {
      key: 'dash-social',
      label: 'Dash Social',
      icon: <DashboardOutlined />,
    },
    {
      key: 'xiaohongshu',
      label: '小红书',
      icon: <HeartOutlined />,
      developing: true, // 标记为开发中，但不禁用点击
    },
    {
      key: 'reddit',
      label: 'Reddit',
      icon: <GlobalOutlined />,
      developing: true, // 标记为开发中，但不禁用点击
    },
    {
      key: 'pet-website',
      label: '宠物网站',
      icon: <PlusOutlined />,
      developing: true, // 标记为开发中，但不禁用点击
    },
  ]

  // 根据当前数据源获取菜单项
  const getMenuItems = (dataSource) => {
    if (dataSource === 'dash-social') {
      return [
        {
          key: '/upload',
          icon: <UploadOutlined />,
          label: <Link to="/upload">数据上传</Link>,
        },
        {
          key: '/analysis',
          icon: <BarChartOutlined />,
          label: <Link to="/analysis">数据分析</Link>,
        },
        {
          key: '/history',
          icon: <HistoryOutlined />,
          label: <Link to="/history">上传历史</Link>,
        },
      ]
    }
    // 其他数据源暂时返回空菜单
    return []
  }

  const menuItems = getMenuItems(activeDataSource)

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ 
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
          padding: 0
        }}>
          {/* 顶部工具标题 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <DashboardOutlined 
              style={{ 
                fontSize: '24px', 
                color: '#1890ff',
                marginRight: '12px' 
              }} 
            />
            <Title 
              level={3} 
              style={{ 
                margin: 0, 
                color: '#1890ff',
                fontWeight: 600
              }}
            >
              社媒AI分析工具
            </Title>
          </div>
          
          {/* 数据源标签页 */}
          <div style={{ 
            padding: '0 24px',
            background: '#f8f9fa'
          }}>
            <Tabs
              activeKey={activeDataSource}
              onChange={setActiveDataSource}
              items={dataSourceTabs.map(tab => ({
                key: tab.key,
                label: (
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px'
                  }}>
                    {tab.icon}
                    {tab.label}
                    {tab.developing && <span style={{ fontSize: '12px', color: '#faad14' }}>（开发中）</span>}
                  </span>
                )
              }))}
              size="large"
              style={{ marginBottom: '-1px' }}
            />
          </div>
        </Header>

        <Content style={{ padding: '24px' }}>
          <Row gutter={24}>
            {/* 左侧：功能导航菜单 */}
            <Col span={6}>
              {activeDataSource === 'dash-social' && (
                <Card 
                  title="功能导航" 
                  className="navigation-card"
                  bodyStyle={{ padding: '12px' }}
                >
                  <Menu
                    mode="vertical"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    style={{ 
                      border: 'none',
                      background: 'transparent'
                    }}
                  />
                </Card>
              )}
              {activeDataSource !== 'dash-social' && (
                <Card 
                  title="数据源信息" 
                  className="navigation-card"
                  bodyStyle={{ padding: '16px' }}
                >
                  <div style={{ textAlign: 'center', color: '#666' }}>
                    <p>该数据源功能正在开发中</p>
                    <p>敬请期待...</p>
                  </div>
                </Card>
              )}
            </Col>
            
            {/* 右侧：主要内容区域 */}
            <Col span={18}>
              {activeDataSource === 'dash-social' && (
                <Routes>
                  <Route path="/" element={<Analysis />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/history" element={<History />} />
                </Routes>
              )}
              {activeDataSource === 'xiaohongshu' && <XiaoHongShu />}
              {activeDataSource === 'reddit' && <Reddit />}
              {activeDataSource === 'pet-website' && <PetWebsite />}
            </Col>
          </Row>
        </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default App