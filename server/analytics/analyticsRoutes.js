const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

// 统计文件路径
const statsFilePath = path.join(__dirname, 'tool_usage_stats.json');

// 确保统计文件存在
async function ensureStatsFile() {
    try {
        if (!await fs.pathExists(statsFilePath)) {
            const defaultStats = {
                "home": { "name": "首页", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "customer-service": { "name": "客服工具", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "design-review": { "name": "设计审查", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "questionnaire-analysis": { "name": "问卷分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "resume": { "name": "简历分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "social-media": { "name": "社媒分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
                "voice-cloning": { "name": "语音克隆", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} }
            };
            await fs.writeJson(statsFilePath, defaultStats, { spaces: 2 });
        }
    } catch (error) {
        console.error('Error ensuring stats file:', error);
    }
}

// 记录工具访问
router.post('/record-visit', async (req, res) => {
    try {
        await ensureStatsFile();
        const { toolKey } = req.body;
        
        if (!toolKey) {
            return res.status(400).json({ error: '工具标识不能为空' });
        }

        const stats = await fs.readJson(statsFilePath);
        
        if (!stats[toolKey]) {
            return res.status(400).json({ error: '无效的工具标识' });
        }

        const now = new Date().toISOString();
        const today = new Date().toISOString().split('T')[0];
        const userEmail = req.user?.email || 'anonymous';

        if (!stats[toolKey].firstVisit) {
            stats[toolKey].firstVisit = now;
        }
        
        stats[toolKey].lastVisit = now;
        stats[toolKey].visitCount = (stats[toolKey].visitCount || 0) + 1;
        
        // 用户访问统计
        if (!stats[toolKey].userVisits) stats[toolKey].userVisits = {};
        stats[toolKey].userVisits[userEmail] = (stats[toolKey].userVisits[userEmail] || 0) + 1;
        
        // 每日用户访问统计
        if (!stats[toolKey].dailyUserVisits) stats[toolKey].dailyUserVisits = {};
        if (!stats[toolKey].dailyUserVisits[userEmail]) stats[toolKey].dailyUserVisits[userEmail] = {};
        stats[toolKey].dailyUserVisits[userEmail][today] = true;

        await fs.writeJson(statsFilePath, stats, { spaces: 2 });
        
        res.json({ success: true, message: '访问记录成功' });
    } catch (error) {
        console.error('Error recording visit:', error);
        res.status(500).json({ error: '记录访问失败' });
    }
});

// 获取所有工具统计
router.get('/stats', async (req, res) => {
    try {
        await ensureStatsFile();
        const stats = await fs.readJson(statsFilePath);
        
        // 计算总访问量
        const totalVisits = Object.values(stats).reduce((sum, tool) => sum + (tool.visitCount || 0), 0);
        
        // 找到最后更新时间
        const lastUpdated = Object.values(stats)
            .map(tool => tool.lastVisit)
            .filter(date => date)
            .sort()
            .pop() || null;
        
        // 转换为前端期望的格式并按访问量排序
        const tools = Object.entries(stats)
            .map(([toolKey, tool]) => ({
                toolKey,
                name: tool.name,
                visitCount: tool.visitCount || 0,
                firstVisit: tool.firstVisit,
                lastVisit: tool.lastVisit,
                userVisits: tool.userVisits || {},
                dailyUserVisits: tool.dailyUserVisits || {}
            }))
            .sort((a, b) => b.visitCount - a.visitCount);

        res.json({
            totalVisits,
            lastUpdated,
            tools
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// 获取单个工具统计
router.get('/stats/:toolKey', async (req, res) => {
    try {
        await ensureStatsFile();
        const { toolKey } = req.params;
        const stats = await fs.readJson(statsFilePath);
        
        if (!stats[toolKey]) {
            return res.status(404).json({ error: '工具不存在' });
        }

        res.json(stats[toolKey]);
    } catch (error) {
        console.error('Error getting tool stats:', error);
        res.status(500).json({ error: '获取工具统计失败' });
    }
});

// 重置统计数据
router.post('/reset-stats', async (req, res) => {
    try {
        await ensureStatsFile();
        const defaultStats = {
            "home": { "name": "首页", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "customer-service": { "name": "客服工具", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "design-review": { "name": "设计审查", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "questionnaire-analysis": { "name": "问卷分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "resume": { "name": "简历分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "social-media": { "name": "社媒分析", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} },
            "voice-cloning": { "name": "语音克隆", "visitCount": 0, "lastVisit": null, "firstVisit": null, "userVisits": {}, "dailyUserVisits": {} }
        };
        
        await fs.writeJson(statsFilePath, defaultStats, { spaces: 2 });
        
        res.json({ success: true, message: '统计数据已重置' });
    } catch (error) {
        console.error('Error resetting stats:', error);
        res.status(500).json({ error: '重置统计数据失败' });
    }
});

module.exports = router; 