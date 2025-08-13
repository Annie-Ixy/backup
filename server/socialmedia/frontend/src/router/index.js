import { createRouter, createWebHistory } from 'vue-router'

// 导入页面组件
import Upload from '@/views/Upload.vue'
import Analysis from '@/views/Analysis.vue'
import History from '@/views/History.vue'

const routes = [
  {
    path: '/',
    redirect: '/upload'
  },
  {
    path: '/upload',
    name: 'Upload',
    component: Upload,
    meta: {
      title: '数据上传',
      description: '上传Excel或CSV格式的Dash Social数据文件'
    }
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: Analysis,
    meta: {
      title: '数据分析',
      description: '对上传的数据进行品牌提及、情感分析和特殊情况监控'
    }
  },
  {
    path: '/history',
    name: 'History',
    component: History,
    meta: {
      title: '历史记录',
      description: '查看上传历史和分析记录'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 社媒AI分析工具`
  }
  next()
})

export default router