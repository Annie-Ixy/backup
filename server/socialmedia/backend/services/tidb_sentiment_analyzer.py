#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基于TiDB MCP工具的情感分析器
直接使用TiDB查询，避免pandas连接问题
"""

import logging
from typing import List, Dict, Any
from collections import Counter
from datetime import datetime
import pandas as pd

logger = logging.getLogger(__name__)

class TiDBSentimentAnalyzer:
    """基于TiDB MCP的情感分析器"""
    
    def __init__(self):
        # 这里需要集成TiDB MCP工具
        pass
    
    def query_sentiment_data(self, keywords: List[str] = None, start_date: str = None, 
                            end_date: str = None, platforms: List[str] = None) -> List[Dict]:
        """
        使用TiDB MCP工具查询情感数据
        
        Args:
            keywords: 关键词列表
            start_date: 开始日期
            end_date: 结束日期
            platforms: 平台列表
            
        Returns:
            查询结果字典列表
        """
        try:
            # 构建SQL查询
            sql = "SELECT record_id, sentiment, text, channel, last_update, author_name, brand_label FROM ods_dash_social_comments WHERE 1=1"
            
            # 添加关键词条件
            if keywords and len(keywords) > 0:
                keyword_conditions = []
                for keyword in keywords:
                    keyword_conditions.append(f"(text LIKE '%{keyword}%' OR tags LIKE '%{keyword}%' OR caption LIKE '%{keyword}%' OR brand_label LIKE '%{keyword}%')")
                keyword_filter = " OR ".join(keyword_conditions)
                sql += f" AND ({keyword_filter})"
            
            # 添加时间条件
            if start_date:
                sql += f" AND DATE(last_update) >= '{start_date}'"
            if end_date:
                sql += f" AND DATE(last_update) <= '{end_date}'"
            
            # 添加渠道条件
            if platforms and len(platforms) > 0:
                channel_filter = "', '".join(platforms)
                sql += f" AND channel IN ('{channel_filter}')"
            
            # 只查询有情感标签的数据
            sql += " AND sentiment IS NOT NULL AND sentiment != ''"
            
            # 按时间倒序排列
            sql += " ORDER BY last_update DESC"
            
            logger.info(f"执行查询SQL: {sql}")
            
            # 这里应该调用TiDB MCP工具
            # 暂时返回空列表，实际使用时需要集成MCP调用
            return []
            
        except Exception as e:
            logger.error(f"查询数据失败: {e}")
            return []
    
    def analyze_sentiment_from_data(self, data: List[Dict]) -> Dict[str, Any]:
        """
        从查询数据中进行情感分析
        
        Args:
            data: 查询结果数据
            
        Returns:
            情感分析结果
        """
        try:
            if not data or len(data) == 0:
                return {'error': '没有数据可供分析'}
            
            total_count = len(data)
            
            # 1. 基础情感统计
            sentiment_counts = Counter([item['sentiment'] for item in data])
            
            sentiment_stats = {
                'total_comments': total_count,
                'positive_count': sentiment_counts.get('positive', 0),
                'negative_count': sentiment_counts.get('negative', 0),
                'neutral_count': sentiment_counts.get('neutral', 0),
            }
            
            # 计算百分比
            sentiment_stats.update({
                'positive_rate': (sentiment_stats['positive_count'] / total_count * 100) if total_count > 0 else 0,
                'negative_rate': (sentiment_stats['negative_count'] / total_count * 100) if total_count > 0 else 0,
                'neutral_rate': (sentiment_stats['neutral_count'] / total_count * 100) if total_count > 0 else 0,
            })
            
            # 2. 渠道情感分析
            channel_sentiment = {}
            for item in data:
                channel = item.get('channel', 'unknown')
                sentiment = item['sentiment']
                if channel not in channel_sentiment:
                    channel_sentiment[channel] = {'positive': 0, 'negative': 0, 'neutral': 0}
                channel_sentiment[channel][sentiment] += 1
            
            # 3. 时间趋势分析（简化版）
            date_sentiment = {}
            for item in data:
                try:
                    date_str = item['last_update'][:10] if item.get('last_update') else '2025-07-31'
                    sentiment = item['sentiment']
                    if date_str not in date_sentiment:
                        date_sentiment[date_str] = {'positive': 0, 'negative': 0, 'neutral': 0}
                    date_sentiment[date_str][sentiment] += 1
                except:
                    continue
            
            # 4. 为图表优化的数据格式
            pie_data = [
                {'name': '正面', 'value': sentiment_stats['positive_count'], 'sentiment': 'positive'},
                {'name': '负面', 'value': sentiment_stats['negative_count'], 'sentiment': 'negative'},
                {'name': '中性', 'value': sentiment_stats['neutral_count'], 'sentiment': 'neutral'}
            ]
            
            # 渠道图表数据
            channel_chart_data = {
                'channels': list(channel_sentiment.keys()),
                'data': []
            }
            
            for channel, counts in channel_sentiment.items():
                channel_chart_data['data'].append({
                    'channel': channel,
                    'positive': counts['positive'],
                    'negative': counts['negative'],
                    'neutral': counts['neutral'],
                    'total': sum(counts.values())
                })
            
            # 趋势图表数据
            trend_data = {
                'dates': sorted(date_sentiment.keys()),
                'positive': [],
                'negative': [],
                'neutral': []
            }
            
            for date in trend_data['dates']:
                counts = date_sentiment[date]
                trend_data['positive'].append(counts['positive'])
                trend_data['negative'].append(counts['negative'])
                trend_data['neutral'].append(counts['neutral'])
            
            # 5. 样例数据
            positive_examples = [item for item in data if item['sentiment'] == 'positive'][:3]
            negative_examples = [item for item in data if item['sentiment'] == 'negative'][:3]
            
            # 6. 小时分布（简化版）
            hourly_distribution = {
                'hours': list(range(24)),
                'positive': [0] * 24,
                'negative': [0] * 24,
                'neutral': [0] * 24
            }
            
            # 7. 完整结果
            result = {
                'overall_distribution': sentiment_counts,
                'sentiment_stats': sentiment_stats,
                'sentiment_trends': date_sentiment,
                'channel_sentiment': channel_sentiment,
                'examples': {
                    'high_positive': positive_examples,
                    'high_negative': negative_examples
                },
                'chart_data': {
                    'pie_data': pie_data,
                    'trend_data': trend_data,
                    'channel_data': channel_chart_data,
                    'hourly_data': hourly_distribution
                },
                'status': 'success'
            }
            
            return result
            
        except Exception as e:
            logger.error(f"情感分析失败: {e}")
            return {'error': f'情感分析失败: {str(e)}'}

def get_sentiment_data_via_mcp():
    """使用MCP工具获取情感数据的示例函数"""
    # 这里需要实际调用MCP工具
    # 暂时返回示例数据
    sample_data = [
        {"record_id": 1, "sentiment": "negative", "text": "产品质量有问题", "channel": "instagram", "last_update": "2025-07-31T15:52:00", "author_name": "user1", "brand_label": "petlibro"},
        {"record_id": 2, "sentiment": "positive", "text": "很好的产品", "channel": "facebook", "last_update": "2025-07-31T16:00:00", "author_name": "user2", "brand_label": "petlibro"},
        {"record_id": 3, "sentiment": "neutral", "text": "一般般吧", "channel": "instagram", "last_update": "2025-07-31T15:30:00", "author_name": "user3", "brand_label": "petlibro"}
    ]
    return sample_data

if __name__ == '__main__':
    # 测试分析器
    analyzer = TiDBSentimentAnalyzer()
    sample_data = get_sentiment_data_via_mcp()
    result = analyzer.analyze_sentiment_from_data(sample_data)
    
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))