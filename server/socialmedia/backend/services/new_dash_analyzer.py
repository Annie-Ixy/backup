# -*- coding: utf-8 -*-
"""
新的 Dash Social 数据分析引擎
基于DWD_AI表进行三大专项分析：Brand Mention、Sentiment、Bad Case
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
import logging
import re
from collections import Counter

from config.database_config import get_db_config

logger = logging.getLogger(__name__)

class NewDashAnalyzer:
    """基于DWD_AI表的新数据分析器"""
    
    def __init__(self):
        self.db_config = get_db_config()
        
        # 默认品牌关键词
        self.brand_keywords = [
            'petlibro', 'PETLIBRO', 'Petlibro',
            '宠物喂食器', '智能饮水机', '自动喂食器',
            '宠物用品', '智能宠物', '宠物科技'
        ]
    
    def query_data(self, keywords: List[str] = None, start_date: str = None, 
                   end_date: str = None, platforms: List[str] = None, 
                   ai_status_filter: str = 'completed') -> pd.DataFrame:
        """
        查询DWD_AI表数据
        
        Args:
            keywords: 关键词列表
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            platforms: 平台列表
            ai_status_filter: AI处理状态过滤 ('completed', 'all', 'pending', 'failed')
            
        Returns:
            查询结果DataFrame
        """
        try:
            # 构建基础查询（从DWD_AI表查询）
            sql = """
                SELECT record_id, dwd_record_id, last_update, brand_label, author_name, 
                       channel, message_type, text, tags, post_link, sentiment, caption, 
                       upload_batch_id, original_row_index, dedupe_date, source_count,
                       ai_sentiment, ai_confidence, ai_processed_at, ai_error_message, 
                       ai_processing_status, ai_model_version, ai_analysis_batch_id,
                       extremely_negative, created_at, updated_at
                FROM dwd_dash_social_comments_ai 
                WHERE 1=1
            """
            
            # 添加AI状态过滤
            if ai_status_filter != 'all':
                sql += f" AND ai_processing_status = '{ai_status_filter}'"
            
            # 添加关键词条件
            if keywords and len(keywords) > 0:
                keyword_conditions = []
                for keyword in keywords:
                    keyword_conditions.append(
                        f"(text LIKE '%{keyword}%' OR tags LIKE '%{keyword}%' "
                        f"OR caption LIKE '%{keyword}%' OR brand_label LIKE '%{keyword}%')"
                    )
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
            
            # 按时间倒序排列
            sql += " ORDER BY last_update DESC"
            
            logger.info(f"执行查询SQL: {sql}")
            
            # 执行查询
            result = self.db_config.execute_query_dict(sql)
            
            if result is None or len(result) == 0:
                return pd.DataFrame()
            
            # 转换为DataFrame
            df = pd.DataFrame(result)
            logger.info(f"查询到 {len(df)} 条数据")
            
            return df
            
        except Exception as e:
            logger.error(f"查询数据失败: {e}")
            return pd.DataFrame()
    
    def analyze_brand_mentions(self, df: pd.DataFrame, keywords: List[str] = None) -> Dict[str, Any]:
        """
        1. Brand Mention 品牌提及分析
        
        Args:
            df: 查询结果DataFrame
            keywords: 分析的关键词列表
            
        Returns:
            品牌提及分析结果
        """
        try:
            if df.empty:
                return {'error': '没有数据可供分析'}
            
            # 使用传入的关键词或默认关键词
            analysis_keywords = keywords or self.brand_keywords
            
            brand_analysis = {}
            
            for keyword in analysis_keywords:
                # 查找包含该关键词的记录
                keyword_pattern = re.compile(keyword, re.IGNORECASE)
                mentions = df[
                    df['text'].str.contains(keyword_pattern, regex=True, na=False) |
                    df['tags'].str.contains(keyword_pattern, regex=True, na=False) |
                    df['caption'].str.contains(keyword_pattern, regex=True, na=False) |
                    df['brand_label'].str.contains(keyword_pattern, regex=True, na=False)
                ]
                
                if len(mentions) == 0:
                    brand_analysis[keyword] = {
                        'total_mentions': 0,
                        'daily_breakdown': {},
                        'sentiment_distribution': {},
                        'platforms': {}
                    }
                    continue
                
                # 统计总提及次数
                total_mentions = len(mentions)
                
                # 按日期统计
                mentions['date'] = pd.to_datetime(mentions['last_update'], errors='coerce').dt.date
                daily_breakdown = mentions.groupby('date').size().to_dict()
                # 转换日期为字符串
                daily_breakdown = {str(k): v for k, v in daily_breakdown.items()}
                
                # AI情感分布统计（优先使用AI分析结果）
                sentiment_col = 'ai_sentiment'
                if mentions[sentiment_col].isna().all():
                    sentiment_col = 'sentiment'  # fallback到原始情感标签
                
                sentiment_distribution = {k: int(v) for k, v in mentions[sentiment_col].value_counts().to_dict().items()}
                
                # 渠道分布统计
                channels = {k: int(v) for k, v in mentions['channel'].value_counts().to_dict().items()}
                
                brand_analysis[keyword] = {
                    'total_mentions': total_mentions,
                    'daily_breakdown': daily_breakdown,
                    'sentiment_distribution': sentiment_distribution,
                    'channels': channels,
                    'sample_mentions': mentions[['text', 'last_update', sentiment_col, 'author_name', 'ai_confidence']].head(5).to_dict('records')
                }
            
            # 生成总体统计
            total_mentions_all = sum([data['total_mentions'] for data in brand_analysis.values()])
            
            summary = {
                'total_keywords': len(analysis_keywords),
                'total_mentions_all': total_mentions_all,
                'most_mentioned_keyword': max(brand_analysis.items(), key=lambda x: x[1]['total_mentions'])[0] if total_mentions_all > 0 else None,
                'analysis_period': {
                    'start_date': str(df['last_update'].min().date()) if not df.empty else None,
                    'end_date': str(df['last_update'].max().date()) if not df.empty else None
                }
            }
            
            return {
                'summary': summary,
                'keyword_analysis': brand_analysis,
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"品牌提及分析失败: {e}")
            return {'error': f'品牌提及分析失败: {str(e)}'}
    
    def analyze_sentiment_details(self, df: pd.DataFrame, hourly_analysis_dates: List[str] = None) -> Dict[str, Any]:
        """
        2. Sentiment 情感分析（基于AI分析结果）
        
        Args:
            df: 查询结果DataFrame
            hourly_analysis_dates: 指定日期的小时分析
            
        Returns:
            情感分析结果
        """
        try:
            if df.empty:
                return {'error': '没有数据可供分析'}
            
            # 优先使用AI情感分析结果
            sentiment_column = 'ai_sentiment'
            if df[sentiment_column].isna().all():
                sentiment_column = 'sentiment'  # fallback到原始情感标签
                logger.warning("AI情感分析数据不完整，使用原始情感标签")
            
            logger.info(f"使用情感字段: {sentiment_column}")
            
            # 1. 整体情感分布
            overall_distribution = {k: int(v) for k, v in df[sentiment_column].value_counts().to_dict().items()}
            
            # 2. 情感统计（基于AI分析结果）
            sentiment_counts = df[sentiment_column].value_counts()
            total_count = len(df)
            
            # 极端负面统计（仅当有extremely_negative字段时）
            extremely_negative_count = 0
            extremely_negative_rate = 0.0
            if 'extremely_negative' in df.columns:
                extremely_negative_count = int(df['extremely_negative'].sum())
                extremely_negative_rate = (extremely_negative_count / total_count * 100) if total_count > 0 else 0
            
            sentiment_stats = {
                'total_comments': total_count,
                'positive_count': int(sentiment_counts.get('positive', 0)),
                'negative_count': int(sentiment_counts.get('negative', 0)),
                'neutral_count': int(sentiment_counts.get('neutral', 0)),
                'positive_rate': (sentiment_counts.get('positive', 0) / total_count * 100) if total_count > 0 else 0,
                'negative_rate': (sentiment_counts.get('negative', 0) / total_count * 100) if total_count > 0 else 0,
                'neutral_rate': (sentiment_counts.get('neutral', 0) / total_count * 100) if total_count > 0 else 0,
                'extremely_negative_count': extremely_negative_count,
                'extremely_negative_rate': extremely_negative_rate
            }
            
            # 3. AI置信度统计（如果有AI数据）
            ai_confidence_stats = {}
            if sentiment_column == 'ai_sentiment' and not df['ai_confidence'].isna().all():
                confidence_data = df['ai_confidence'].dropna()
                ai_confidence_stats = {
                    'mean_confidence': float(confidence_data.mean()),
                    'low_confidence_count': int((confidence_data < 0.5).sum()),
                    'high_confidence_count': int((confidence_data >= 0.8).sum()),
                    'low_confidence_rate': float((confidence_data < 0.5).mean() * 100),
                    'confidence_distribution': {
                        'high': int((confidence_data >= 0.8).sum()),
                        'medium': int(((confidence_data >= 0.5) & (confidence_data < 0.8)).sum()),
                        'low': int((confidence_data < 0.5).sum())
                    }
                }
            
            # 4. 按时间的情感趋势
            if 'last_update' in df.columns and not df['last_update'].isna().all():
                df['date'] = pd.to_datetime(df['last_update'], errors='coerce').dt.date
            else:
                df['date'] = pd.Timestamp.now().date()
            
            sentiment_trends = df.groupby(['date', sentiment_column]).size().unstack(fill_value=0)
            
            # 为ECharts优化数据格式
            sentiment_trends_dict = {}
            chart_data = {
                'dates': [],
                'positive': [],
                'negative': [],
                'neutral': []
            }
            
            for date, row in sentiment_trends.iterrows():
                date_str = str(date)
                sentiment_trends_dict[date_str] = row.to_dict()
                
                # ECharts格式数据
                chart_data['dates'].append(date_str)
                chart_data['positive'].append(int(row.get('positive', 0)))
                chart_data['negative'].append(int(row.get('negative', 0)))
                chart_data['neutral'].append(int(row.get('neutral', 0)))
            
            # 5. 渠道情感对比
            channel_sentiment = df.groupby(['channel', sentiment_column]).size().unstack(fill_value=0)
            channel_sentiment_dict = {}
            channel_chart_data = {
                'channels': [],
                'data': []
            }
            
            for channel, row in channel_sentiment.iterrows():
                channel_sentiment_dict[channel] = row.to_dict()
                
                # 为图表优化数据格式
                channel_chart_data['channels'].append(channel)
                channel_chart_data['data'].append({
                    'channel': channel,
                    'positive': int(row.get('positive', 0)),
                    'negative': int(row.get('negative', 0)),
                    'neutral': int(row.get('neutral', 0)),
                    'total': int(row.sum())
                })
            
            # 6. 典型内容样例
            high_positive = df[df[sentiment_column] == 'positive'].head(3)[
                ['text', sentiment_column, 'last_update', 'author_name', 'ai_confidence']
            ].to_dict('records')
            
            high_negative = df[df[sentiment_column] == 'negative'].head(3)[
                ['text', sentiment_column, 'last_update', 'author_name', 'ai_confidence']
            ].to_dict('records')
            
            # 7. 为饼图优化的数据格式
            pie_chart_data = [
                {'name': '正面', 'value': int(sentiment_counts.get('positive', 0)), 'sentiment': 'positive'},
                {'name': '负面', 'value': int(sentiment_counts.get('negative', 0)), 'sentiment': 'negative'},
                {'name': '中性', 'value': int(sentiment_counts.get('neutral', 0)), 'sentiment': 'neutral'}
            ]
            
            # 8. 小时分布分析
            hourly_distribution = self._calculate_hourly_distribution(df, hourly_analysis_dates, sentiment_column)

            return {
                'overall_distribution': overall_distribution,
                'sentiment_stats': sentiment_stats,
                'ai_confidence_stats': ai_confidence_stats,
                'sentiment_trends': sentiment_trends_dict,
                'channel_sentiment': channel_sentiment_dict,
                'examples': {
                    'high_positive': high_positive,
                    'high_negative': high_negative
                },
                'summary': sentiment_stats,
                'status': 'success',
                # 新增：为前端图表优化的数据格式
                'chart_data': {
                    'pie_data': pie_chart_data,
                    'trend_data': chart_data,
                    'channel_data': channel_chart_data,
                    'hourly_data': hourly_distribution.get('aggregated', hourly_distribution) if isinstance(hourly_distribution, dict) else hourly_distribution
                },
                # 新增：按日期分组的24小时分布数据
                'hourly_analysis': hourly_distribution,
                # 数据源信息
                'data_source': {
                    'sentiment_source': sentiment_column,
                    'ai_processed_count': int(df[df['ai_processing_status'] == 'completed'].shape[0]),
                    'total_count': total_count
                }
            }
            
        except Exception as e:
            logger.error(f"情感分析失败: {e}")
            return {'error': f'情感分析失败: {str(e)}'}
    
    def analyze_bad_cases(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        3. 异常检测分析 - 专注于极端负面评论分析（基于AI分析结果）
        
        Args:
            df: 查询结果DataFrame
            
        Returns:
            极端负面评论分析结果
        """
        try:
            if df.empty:
                return {'error': '没有数据可供分析'}
            
            # 优先使用AI情感分析结果
            sentiment_column = 'ai_sentiment'
            if df[sentiment_column].isna().all():
                sentiment_column = 'sentiment'  # fallback到原始情感标签
                logger.warning("AI情感分析数据不完整，使用原始情感标签进行异常检测")
            
            # 获取所有负面评论
            negative_comments = df[df[sentiment_column] == 'negative'].copy()
            
            # 使用extremely_negative字段筛选极端负面评论
            extreme_negative_comments = negative_comments.copy()
            
            if 'extremely_negative' in df.columns:
                # 只保留extremely_negative=1的负面评论作为极端负面评论
                extreme_negative_mask = negative_comments['extremely_negative'] == 1
                extreme_negative_comments = negative_comments[extreme_negative_mask].copy()
                
                logger.info(f"应用extremely_negative字段筛选：{len(negative_comments)}条负面评论中，{len(extreme_negative_comments)}条为极端负面评论")
            else:
                logger.info("没有extremely_negative字段，将所有负面评论视为极端负面评论")
            
            if extreme_negative_comments.empty:
                return {
                    'extreme_negative_comments': {
                        'count': 0,
                        'details': []
                    },
                    'summary': {
                        'total_comments': len(df),
                        'total_negative_count': len(negative_comments),
                        'extreme_negative_count': 0,
                        'extreme_negative_percentage': 0
                    },
                    'data_source': {
                        'sentiment_source': sentiment_column,
                        'ai_processed_count': int(df[df['ai_processing_status'] == 'completed'].shape[0]) if 'ai_processing_status' in df.columns else 0
                    },
                    'status': 'success'
                }
            
            # 按时间降序排序（最新的在前）
            extreme_negative_comments = extreme_negative_comments.sort_values('last_update', ascending=False)
            
            # 提取极端负面评论的详细信息
            extreme_negative_details = []
            for _, comment in extreme_negative_comments.iterrows():
                comment_detail = {
                    'user': comment['author_name'],
                    'platform': comment['channel'],
                    'time': comment['last_update'].isoformat() if pd.notna(comment['last_update']) else '',
                    'content': comment['text'],
                    'sentiment': comment[sentiment_column],
                }
                
                # 添加AI置信度信息（如果存在）
                if sentiment_column == 'ai_sentiment' and 'ai_confidence' in comment and pd.notna(comment['ai_confidence']):
                    comment_detail['confidence'] = float(comment['ai_confidence'])
                    comment_detail['ai_model'] = comment.get('ai_model_version', '')
                
                extreme_negative_details.append(comment_detail)
            
            # 统计信息
            total_comments = len(df)
            total_negative_count = len(negative_comments)
            extreme_negative_count = len(extreme_negative_comments)
            extreme_negative_percentage = (extreme_negative_count / total_comments) * 100 if total_comments > 0 else 0
            
            # 按用户统计极端负面评论
            user_extreme_stats = extreme_negative_comments.groupby('author_name').agg({
                'text': 'count',
                'last_update': ['min', 'max'],
                'channel': lambda x: list(x.unique())
            }).reset_index()
            
            user_extreme_stats.columns = ['user', 'extreme_negative_count', 'first_extreme', 'last_extreme', 'platforms']
            
            # 按极端负面评论数降序排序
            user_extreme_stats = user_extreme_stats.sort_values('extreme_negative_count', ascending=False)
            
            # 按平台统计极端负面评论
            platform_extreme_stats = extreme_negative_comments.groupby('channel').agg({
                'text': 'count',
                'author_name': lambda x: len(x.unique())
            }).reset_index()
            
            platform_extreme_stats.columns = ['platform', 'extreme_negative_count', 'unique_users']
            
            # 按极端负面评论数降序排序
            platform_extreme_stats = platform_extreme_stats.sort_values('extreme_negative_count', ascending=False)
            
            # AI分析质量统计（如果使用AI数据）
            ai_quality_stats = {}
            if sentiment_column == 'ai_sentiment' and 'ai_confidence' in negative_comments.columns:
                confidence_data = negative_comments['ai_confidence'].dropna()
                extreme_confidence_data = extreme_negative_comments['ai_confidence'].dropna()
                
                if not confidence_data.empty:
                    ai_quality_stats = {
                        'avg_confidence_all_negative': float(confidence_data.mean()),
                        'avg_confidence_extreme': float(extreme_confidence_data.mean()) if not extreme_confidence_data.empty else 0,
                        'low_confidence_negative_count': int((confidence_data < 0.5).sum()),
                        'high_confidence_negative_count': int((confidence_data >= 0.8).sum()),
                        'filter_method': 'extremely_negative_field',
                        'filtered_out_count': total_negative_count - extreme_negative_count
                    }
            
            return {
                'extreme_negative_comments': {
                    'count': extreme_negative_count,
                    'details': extreme_negative_details,
                    'user_stats': user_extreme_stats.to_dict('records') if not extreme_negative_comments.empty else [],
                    'platform_stats': platform_extreme_stats.to_dict('records') if not extreme_negative_comments.empty else []
                },
                'summary': {
                    'total_comments': total_comments,
                    'total_negative_count': total_negative_count,
                    'extreme_negative_count': extreme_negative_count,
                    'extreme_negative_percentage': round(extreme_negative_percentage, 2),
                    'unique_extreme_users': extreme_negative_comments['author_name'].nunique() if not extreme_negative_comments.empty else 0,
                    'platforms_with_extreme': extreme_negative_comments['channel'].nunique() if not extreme_negative_comments.empty else 0
                },
                'ai_quality_stats': ai_quality_stats,
                'data_source': {
                    'sentiment_source': sentiment_column,
                    'ai_processed_count': int(df[df['ai_processing_status'] == 'completed'].shape[0]) if 'ai_processing_status' in df.columns else 0,
                    'total_count': total_comments
                },
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"极端负面评论分析失败: {e}")
            return {'error': f'极端负面评论分析失败: {str(e)}'}
    
    def _calculate_hourly_distribution(self, df: pd.DataFrame, hourly_analysis_dates: List[str] = None, 
                                     sentiment_column: str = 'ai_sentiment') -> Dict[str, Any]:
        """
        计算24小时情感分布（基于AI分析结果）
        """
        try:
            if df.empty or 'last_update' not in df.columns or df['last_update'].isna().all():
                # 返回空的24小时数据结构
                empty_hourly = {
                    'hours': list(range(24)),
                    'positive': [0] * 24,
                    'negative': [0] * 24,
                    'neutral': [0] * 24
                }
                return {
                    'aggregated': empty_hourly,
                    'by_date': {}
                }
            
            # 处理时间数据
            df_copy = df.copy()
            df_copy['datetime'] = pd.to_datetime(df_copy['last_update'], errors='coerce')
            df_copy['date'] = df_copy['datetime'].dt.date
            df_copy['hour'] = df_copy['datetime'].dt.hour
            
            # 过滤掉无效的时间数据
            df_copy = df_copy.dropna(subset=['datetime'])
            
            if df_copy.empty:
                empty_hourly = {
                    'hours': list(range(24)),
                    'positive': [0] * 24,
                    'negative': [0] * 24,
                    'neutral': [0] * 24
                }
                return {
                    'aggregated': empty_hourly,
                    'by_date': {}
                }
            
            # 计算汇总的24小时分布
            hourly_sentiment = df_copy.groupby(['hour', sentiment_column]).size().unstack(fill_value=0)
            aggregated_distribution = {
                'hours': list(range(24)),
                'positive': [int(hourly_sentiment.loc[h, 'positive']) if h in hourly_sentiment.index and 'positive' in hourly_sentiment.columns else 0 for h in range(24)],
                'negative': [int(hourly_sentiment.loc[h, 'negative']) if h in hourly_sentiment.index and 'negative' in hourly_sentiment.columns else 0 for h in range(24)],
                'neutral': [int(hourly_sentiment.loc[h, 'neutral']) if h in hourly_sentiment.index and 'neutral' in hourly_sentiment.columns else 0 for h in range(24)]
            }
            
            # 计算按日期分组的24小时分布
            by_date_distribution = {}
            
            if hourly_analysis_dates:
                # 如果指定了日期，只计算这些日期的分布
                for date_str in hourly_analysis_dates:
                    try:
                        target_date = pd.to_datetime(date_str).date()
                        date_df = df_copy[df_copy['date'] == target_date]
                        
                        if not date_df.empty:
                            date_hourly = date_df.groupby(['hour', sentiment_column]).size().unstack(fill_value=0)
                            by_date_distribution[date_str] = {
                                'hours': list(range(24)),
                                'positive': [int(date_hourly.loc[h, 'positive']) if h in date_hourly.index and 'positive' in date_hourly.columns else 0 for h in range(24)],
                                'negative': [int(date_hourly.loc[h, 'negative']) if h in date_hourly.index and 'negative' in date_hourly.columns else 0 for h in range(24)],
                                'neutral': [int(date_hourly.loc[h, 'neutral']) if h in date_hourly.index and 'neutral' in date_hourly.columns else 0 for h in range(24)]
                            }
                        else:
                            # 如果该日期没有数据，返回空的24小时结构
                            by_date_distribution[date_str] = {
                                'hours': list(range(24)),
                                'positive': [0] * 24,
                                'negative': [0] * 24,
                                'neutral': [0] * 24
                            }
                    except Exception as e:
                        logger.warning(f"处理日期 {date_str} 时出错: {e}")
                        continue
            else:
                # 如果没有指定日期，计算所有存在数据的日期
                available_dates = sorted(df_copy['date'].unique())
                for date_obj in available_dates:
                    date_str = str(date_obj)
                    date_df = df_copy[df_copy['date'] == date_obj]
                    
                    date_hourly = date_df.groupby(['hour', sentiment_column]).size().unstack(fill_value=0)
                    by_date_distribution[date_str] = {
                        'hours': list(range(24)),
                        'positive': [int(date_hourly.loc[h, 'positive']) if h in date_hourly.index and 'positive' in date_hourly.columns else 0 for h in range(24)],
                        'negative': [int(date_hourly.loc[h, 'negative']) if h in date_hourly.index and 'negative' in date_hourly.columns else 0 for h in range(24)],
                        'neutral': [int(date_hourly.loc[h, 'neutral']) if h in date_hourly.index and 'neutral' in date_hourly.columns else 0 for h in range(24)]
                    }
            
            return {
                'aggregated': aggregated_distribution,
                'by_date': by_date_distribution,
                'sentiment_source': sentiment_column
            }
            
        except Exception as e:
            logger.error(f"计算24小时分布失败: {e}")
            # 返回空数据结构
            empty_hourly = {
                'hours': list(range(24)),
                'positive': [0] * 24,
                'negative': [0] * 24,
                'neutral': [0] * 24
            }
            return {
                'aggregated': empty_hourly,
                'by_date': {},
                'error': str(e)
            }
    
    def get_database_stats(self) -> Dict[str, Any]:
        """获取数据库统计信息（基于新的三层架构）"""
        try:
            # ODS层统计
            ods_count_sql = "SELECT COUNT(*) as total FROM ods_dash_social_comments"
            ods_result = self.db_config.execute_query(ods_count_sql)
            ods_count = ods_result[0]['total'] if ods_result else 0
            
            # DWD层统计
            dwd_count_sql = "SELECT COUNT(*) as total FROM dwd_dash_social_comments"
            dwd_result = self.db_config.execute_query(dwd_count_sql)
            dwd_count = dwd_result[0]['total'] if dwd_result else 0
            
            # DWD_AI层统计
            ai_count_sql = "SELECT COUNT(*) as total FROM dwd_dash_social_comments_ai"
            ai_result = self.db_config.execute_query(ai_count_sql)
            ai_count = ai_result[0]['total'] if ai_result else 0
            
            # AI处理状态统计
            ai_status_sql = """
                SELECT ai_processing_status, COUNT(*) as count 
                FROM dwd_dash_social_comments_ai 
                GROUP BY ai_processing_status
            """
            ai_status_result = self.db_config.execute_query(ai_status_sql)
            ai_status_stats = {row['ai_processing_status']: row['count'] for row in ai_status_result} if ai_status_result else {}
            
            # 最新数据时间
            latest_time_sql = "SELECT MAX(last_update) as latest_time FROM dwd_dash_social_comments_ai"
            latest_result = self.db_config.execute_query(latest_time_sql)
            latest_time = latest_result[0]['latest_time'] if latest_result and latest_result[0]['latest_time'] else None
            
            # 渠道分布（基于DWD_AI层）
            channel_sql = "SELECT channel, COUNT(*) as count FROM dwd_dash_social_comments_ai GROUP BY channel"
            channel_result = self.db_config.execute_query(channel_sql)
            channel_stats = {row['channel']: row['count'] for row in channel_result} if channel_result else {}
            
            # AI情感分布（只统计已完成AI分析的数据）
            ai_sentiment_sql = """
                SELECT ai_sentiment, COUNT(*) as count 
                FROM dwd_dash_social_comments_ai 
                WHERE ai_processing_status = 'completed' AND ai_sentiment IS NOT NULL
                GROUP BY ai_sentiment
            """
            ai_sentiment_result = self.db_config.execute_query(ai_sentiment_sql)
            ai_sentiment_stats = {row['ai_sentiment']: row['count'] for row in ai_sentiment_result} if ai_sentiment_result else {}
            
            return {
                'data_layers': {
                    'ods_records': ods_count,
                    'dwd_records': dwd_count,
                    'ai_records': ai_count
                },
                'ai_processing': ai_status_stats,
                'latest_data_time': str(latest_time) if latest_time else None,
                'channel_distribution': channel_stats,
                'ai_sentiment_distribution': ai_sentiment_stats,
                'connection_status': 'connected',
                'last_updated': datetime.now().isoformat(),
                'architecture': 'three_layer_dwd_ai'
            }
            
        except Exception as e:
            logger.error(f"获取数据库统计失败: {e}")
            return {
                'error': f'获取数据库统计失败: {str(e)}',
                'connection_status': 'error',
                'last_updated': datetime.now().isoformat()
            }
