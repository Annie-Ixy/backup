# -*- coding: utf-8 -*-
"""
数据分析控制器
处理数据分析相关的HTTP请求
"""

import json
from datetime import datetime, timedelta
from flask import request, jsonify
import logging

from services.new_dash_analyzer import NewDashAnalyzer
from services.ai_sentiment_analyzer import AISentimentAnalyzer
from services.etl_processor import ETLProcessor
from services.batch_ai_analyzer import BatchAIAnalyzer
from services.batch_extreme_negative_analyzer import BatchExtremeNegativeAnalyzer
from config.database_config import get_db_config

logger = logging.getLogger(__name__)

class AnalysisController:
    """数据分析控制器"""
    
    def __init__(self):
        self.analyzer = NewDashAnalyzer()  # 使用新的基于DWD_AI的分析器
        self.ai_analyzer = AISentimentAnalyzer()
        self.etl_processor = ETLProcessor()  # ETL处理器
        self.batch_ai_analyzer = BatchAIAnalyzer()  # 批量AI分析器
        self.extreme_analyzer = BatchExtremeNegativeAnalyzer()  # 极端负面分析器
        self.db_config = get_db_config()
    
    def handle_analysis(self, request):
        """
        处理数据分析请求
        
        Args:
            request: Flask请求对象
            
        Returns:
            JSON响应
        """
        try:
            # 解析请求参数
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': '请求参数错误',
                    'message': '请提供JSON格式的请求参数'
                }), 400
            
            # 获取分析参数
            keywords = data.get('keywords', [])
            start_date = data.get('start_date')
            end_date = data.get('end_date')
            platforms = data.get('platforms', [])
            analysis_types = data.get('analysis_types', ['brand_mentions', 'sentiment', 'bad_cases'])
            hourly_analysis_dates = data.get('hourly_analysis_dates', [])
            
            # 参数验证
            if not keywords or len(keywords) == 0:
                return jsonify({
                    'success': False,
                    'error': '参数错误',
                    'message': '请至少提供一个关键词进行分析'
                }), 400
            
            # 如果没有提供时间范围，默认分析最近30天
            if not start_date or not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            logger.info(f"开始分析: keywords={keywords}, date_range={start_date} to {end_date}")
            
            # 查询数据
            df = self.analyzer.query_data(keywords, start_date, end_date, platforms)
            
            if df.empty:
                # 即使没有数据，也要返回各分析类型的空结果结构
                empty_results = {}
                
                if 'brand_mentions' in analysis_types:
                    empty_results['brand_mentions'] = {
                        'summary': {'total_mentions_all': 0},
                        'keyword_analysis': {},
                        'status': 'success'
                    }
                
                if 'sentiment' in analysis_types:
                    empty_results['sentiment_analysis'] = {
                        'sentiment_stats': {
                            'total_comments': 0,
                            'positive_count': 0,
                            'negative_count': 0,
                            'neutral_count': 0,
                            'positive_rate': 0,
                            'negative_rate': 0,
                            'neutral_rate': 0
                        },
                        'chart_data': {
                            'pie_data': [{'name': '正面', 'value': 0}, {'name': '负面', 'value': 0}, {'name': '中性', 'value': 0}],
                            'trend_data': {'dates': [], 'positive': [], 'negative': [], 'neutral': []},
                            'channel_data': {'channels': [], 'data': []},
                            'hourly_data': {'hours': list(range(24)), 'positive': [0]*24, 'negative': [0]*24, 'neutral': [0]*24}
                        },
                        'status': 'success'
                    }
                
                if 'bad_cases' in analysis_types:
                    empty_results['bad_cases'] = {
                        'extreme_negative_comments': {
                            'count': 0,
                            'details': [],
                            'user_stats': [],
                            'platform_stats': []
                        },
                        'summary': {
                            'total_comments': 0,
                            'negative_count': 0,
                            'negative_percentage': 0,
                            'unique_negative_users': 0,
                            'platforms_with_negative': 0
                        },
                        'status': 'success'
                    }
                
                return jsonify({
                    'success': True,
                    'message': '在指定条件下没有找到相关数据',
                    'data': {
                        **empty_results,
                        'query_params': {
                            'keywords': keywords,
                            'start_date': start_date,
                            'end_date': end_date,
                            'platforms': platforms
                        },
                        'result_count': 0
                    }
                }), 200
            
            # 执行分析
            analysis_results = {}
            
            # 1. Brand Mention 分析
            if 'brand_mentions' in analysis_types:
                try:
                    brand_results = self.analyzer.analyze_brand_mentions(df, keywords)
                    analysis_results['brand_mentions'] = brand_results
                except Exception as e:
                    logger.error(f"品牌提及分析失败: {e}")
                    analysis_results['brand_mentions'] = {'error': str(e)}
            
            # 2. Sentiment 分析
            if 'sentiment' in analysis_types:
                try:
                    # 基础情感分析
                    sentiment_results = self.analyzer.analyze_sentiment_details(df, hourly_analysis_dates)
                    
                    # 启用AI增强分析，生成AI总结
                    ai_available = self.ai_analyzer.is_available()
                    logger.info(f"AI服务可用性检查: {ai_available}")
                    if ai_available:
                        logger.info("开始AI增强情感分析")
                        
                        # 准备样本评论用于AI总结
                        positive_samples = df[df['sentiment'] == 'positive']['text'].head(5).tolist()
                        negative_samples = df[df['sentiment'] == 'negative']['text'].head(5).tolist()
                        neutral_samples = df[df['sentiment'] == 'neutral']['text'].head(3).tolist()
                        
                        sample_comments = {
                            'positive': positive_samples,
                            'negative': negative_samples,
                            'neutral': neutral_samples
                        }
                        
                        try:
                            # 生成AI图表综合分析总结
                            ai_summary = self.ai_analyzer.generate_comprehensive_chart_summary(
                                sentiment_results.get('sentiment_stats', {}),
                                sentiment_results.get('chart_data', {}),
                                sentiment_results.get('sentiment_trends', {}),
                                sentiment_results.get('channel_sentiment', {}),
                                sentiment_results.get('hourly_analysis', {}),
                                sample_comments
                            )
                            
                            # 将AI总结添加到结果中
                            sentiment_results['ai_summary'] = ai_summary
                            sentiment_results['ai_enhanced'] = True
                            logger.info("AI图表综合分析总结生成成功")
                        
                        except Exception as ai_summary_error:
                            logger.warning(f"AI总结生成失败: {ai_summary_error}")
                            sentiment_results['ai_summary'] = self._generate_comprehensive_basic_summary(sentiment_results)
                            sentiment_results['ai_enhanced'] = False
                        

                        
                        logger.info("AI图表综合分析完成")
                    else:
                        # AI服务不可用时，生成基础图表综合总结
                        logger.info("AI服务不可用，生成基础图表综合总结")
                        sentiment_results['ai_enhanced'] = False
                        sentiment_results['ai_summary'] = self._generate_comprehensive_basic_summary(sentiment_results)
                    
                    analysis_results['sentiment_analysis'] = sentiment_results
                    
                except Exception as e:
                    logger.error(f"情感分析失败: {e}")
                    analysis_results['sentiment_analysis'] = {'error': str(e)}
            
            # 3. Bad Case 分析
            if 'bad_cases' in analysis_types:
                try:
                    bad_case_results = self.analyzer.analyze_bad_cases(df)
                    analysis_results['bad_cases'] = bad_case_results
                except Exception as e:
                    logger.error(f"特殊情况分析失败: {e}")
                    analysis_results['bad_cases'] = {'error': str(e)}
            
            # 添加查询信息
            query_info = {
                'keywords': keywords,
                'start_date': start_date,
                'end_date': end_date,
                'platforms': platforms,
                'analysis_types': analysis_types,
                'total_records': len(df),
                'query_time': datetime.now().isoformat()
            }
            
            return jsonify({
                'success': True,
                'message': f'分析完成，共分析了 {len(df)} 条数据',
                'query_info': query_info,
                'data': analysis_results
            }), 200
            
        except Exception as e:
            logger.error(f"数据分析处理异常: {e}")
            return jsonify({
                'success': False,
                'error': '分析过程出现异常',
                'message': str(e)
            }), 500

    def start_analysis(self):
        """
        开始数据分析处理：三阶段处理流程
        1. ETL去重（ODS → DWD）
        2. AI情感分析（DWD表更新）
        3. 极端负面分析（DWD表更新）
        4. 同步到DWD_AI表
        
        Returns:
            JSON响应
        """
        try:
            logger.info("开始数据分析处理...")
            
            # ========== 阶段1: ETL处理（ODS → DWD）==========
            logger.info("步骤1: 开始ETL处理（ODS → DWD）...")
            etl_result = self.etl_processor.process_ods_to_dwd(batch_size=1000)
            
            if etl_result.get('status') not in ['completed', 'partial']:
                return jsonify({
                    'success': False,
                    'error': 'ETL处理失败',
                    'message': etl_result.get('error', 'ETL处理过程中发生错误'),
                    'details': etl_result
                }), 500
            
            logger.info(f"ETL处理完成: {etl_result}")
            
            # ========== 阶段2: AI情感分析 ==========
            logger.info("步骤2: 开始AI情感分析...")
            
            # 重置可能卡住的processing状态
            reset_sql = """
                UPDATE dwd_dash_social_comments 
                SET ai_processing_status = 'pending'
                WHERE ai_processing_status = 'processing'
            """
            reset_count = self.db_config.execute_insert(reset_sql)
            logger.info(f"重置了 {reset_count} 条processing状态的记录为pending")
            
            # 分批次处理AI情感分析
            ai_results = []
            batch_size = 50
            batch_number = 1
            
            while True:
                logger.info(f"开始处理第 {batch_number} 批次AI分析...")
                ai_result = self.batch_ai_analyzer.process_pending_ai_analysis(batch_size=batch_size)
                
                if ai_result.get('total_records', 0) == 0:
                    break
                
                ai_results.append(ai_result)
                logger.info(f"第 {batch_number} 批次完成：成功 {ai_result.get('success_records', 0)} 条，失败 {ai_result.get('failed_records', 0)} 条")
                
                batch_number += 1
                if batch_number > 20:  # 防止无限循环
                    logger.warning("AI分析已处理20个批次，停止处理")
                    break
            
            # ========== 阶段3: 极端负面分析 ==========
            logger.info("步骤3: 开始极端负面分析...")
            
            # 首先处理非负面评论（直接设置为completed）
            non_negative_result = self.extreme_analyzer.process_non_negative_records(batch_size=100)
            logger.info(f"非负面评论处理完成: {non_negative_result.get('message', '')}")
            
            # 重置可能卡住的processing状态
            extreme_reset_sql = """
                UPDATE dwd_dash_social_comments 
                SET extreme_negative_processing_status = 'pending'
                WHERE extreme_negative_processing_status = 'processing'
                  AND ai_processing_status = 'completed'
                  AND ai_sentiment = 'negative'
            """
            extreme_reset_count = self.db_config.execute_insert(extreme_reset_sql)
            logger.info(f"重置了 {extreme_reset_count} 条极端负面processing状态的记录为pending")
            
            # 分批次处理极端负面分析
            extreme_results = []
            batch_number = 1
            
            while True:
                logger.info(f"开始处理第 {batch_number} 批次极端负面分析...")
                extreme_result = self.extreme_analyzer.process_pending_extreme_analysis(batch_size=batch_size)
                
                if extreme_result.get('total_records', 0) == 0:
                    break
                
                extreme_results.append(extreme_result)
                logger.info(f"第 {batch_number} 批次完成：成功 {extreme_result.get('success_records', 0)} 条，失败 {extreme_result.get('failed_records', 0)} 条")
                
                batch_number += 1
                if batch_number > 20:  # 防止无限循环
                    logger.warning("极端负面分析已处理20个批次，停止处理")
                    break
            
            # ========== 阶段4: 同步到DWD_AI表 ==========
            logger.info("步骤4: 开始同步到DWD_AI表...")
            sync_result = self.etl_processor.process_dwd_to_ai(batch_size=500)
            logger.info(f"DWD_AI同步完成: {sync_result.get('message', '')}")
            
            # ========== 汇总结果 ==========
            total_ai_success = sum(result.get('success_records', 0) for result in ai_results)
            total_ai_failed = sum(result.get('failed_records', 0) for result in ai_results)
            total_extreme_success = sum(result.get('success_records', 0) for result in extreme_results)
            total_extreme_failed = sum(result.get('failed_records', 0) for result in extreme_results)
            
            final_result = {
                'success': True,
                'message': f'分析处理完成：ETL处理{etl_result.get("success_records", 0)}条，AI分析{total_ai_success}条，极端负面分析{total_extreme_success}条，同步{sync_result.get("success_records", 0)}条',
                'summary': {
                    'etl_success_count': etl_result.get("success_records", 0),
                    'ai_success_count': total_ai_success,
                    'ai_failed_count': total_ai_failed,
                    'extreme_success_count': total_extreme_success,
                    'extreme_failed_count': total_extreme_failed,
                    'sync_success_count': sync_result.get("success_records", 0)
                },
                'details': {
                    'etl_result': etl_result,
                    'ai_analysis': {
                        'total_success': total_ai_success,
                        'total_failed': total_ai_failed,
                        'batch_results': ai_results
                    },
                    'extreme_analysis': {
                        'total_success': total_extreme_success,
                        'total_failed': total_extreme_failed,
                        'batch_results': extreme_results,
                        'non_negative_result': non_negative_result
                    },
                    'sync_result': sync_result
                }
            }
            
            logger.info(f"分析全部完成: {final_result['message']}")
            return jsonify(final_result)
            
        except Exception as e:
            logger.error(f"数据分析处理异常: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'error': '分析处理过程出现异常',
                'message': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
    
    def get_analysis_status(self):
        """
        获取分析状态统计（包括AI分析和极端负面分析）
        
        Returns:
            JSON响应
        """
        try:
            # 获取AI分析统计信息
            ai_stats = self.batch_ai_analyzer.get_ai_analysis_statistics()
            
            # 获取极端负面分析统计信息
            extreme_stats = self.extreme_analyzer.get_extreme_analysis_statistics()
            
            if ai_stats.get('status') == 'success':
                stats = ai_stats.get('statistics', {})
                
                return jsonify({
                    'success': True,
                    'data': {
                        'dwd_records': {
                            'total': stats.get('total_records', 0),
                            'ai_pending': stats.get('pending_records', 0),
                            'ai_processing': stats.get('processing_records', 0),
                            'ai_completed': stats.get('completed_records', 0),
                            'ai_failed': stats.get('failed_records', 0)
                        },
                        'ai_analysis': {
                            'ai_service_available': stats.get('ai_service_available', False),
                            'sentiment_distribution': stats.get('sentiment_distribution', {})
                        },
                        'extreme_analysis': {
                            'status_distribution': extreme_stats.get('status_distribution', {}),
                            'extreme_distribution': extreme_stats.get('extreme_distribution', {}),
                            'ai_service_available': extreme_stats.get('ai_service_available', False)
                        },
                        'last_updated': datetime.now().isoformat()
                    }
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': '获取分析状态失败',
                    'message': ai_stats.get('error', '未知错误')
                }), 500
                
        except Exception as e:
            logger.error(f"获取分析状态异常: {e}")
            return jsonify({
                'success': False,
                'error': '获取分析状态异常',
                'message': str(e)
            }), 500

    def get_keywords(self):
        """
        获取关键词配置列表
        
        Returns:
            JSON响应
        """
        try:
            sql = """
                SELECT id, keyword, category, priority, is_active, created_at, updated_at
                FROM keyword_configs 
                WHERE is_active = 1
                ORDER BY priority DESC, keyword ASC
            """
            
            result = self.db_config.execute_query(sql)
            
            if not result:
                # 如果没有关键词，返回默认关键词列表
                default_keywords = [
                    {'keyword': 'Petlibro', 'category': 'brand', 'priority': 10},
                    {'keyword': 'Scout Smart Camera', 'category': 'brand', 'priority': 9},
                    {'keyword': 'Fountain', 'category': 'product', 'priority': 8}
                ]
                return jsonify({
                    'success': True,
                    'data': default_keywords,
                    'total': len(default_keywords),
                    'message': '返回默认关键词列表'
                }), 200
            
            # 格式化结果
            keywords = []
            for row in result:
                keywords.append({
                    'id': row.get('id'),
                    'keyword': row.get('keyword'),
                    'category': row.get('category'),
                    'priority': row.get('priority'),
                    'is_active': bool(row.get('is_active')),
                    'created_at': str(row.get('created_at')) if row.get('created_at') else None,
                    'updated_at': str(row.get('updated_at')) if row.get('updated_at') else None
                })
            
            return jsonify({
                'success': True,
                'data': keywords,
                'total': len(keywords),
                'message': f'获取到 {len(keywords)} 个关键词'
            }), 200
            
        except Exception as e:
            logger.error(f"获取关键词失败: {e}")
            return jsonify({
                'success': False,
                'error': '获取关键词失败',
                'message': str(e)
            }), 500

    def get_platforms(self):
        """获取平台列表（从数据库中channel字段去重）"""
        try:
            # 使用统一的数据库配置
            sql = "SELECT DISTINCT channel FROM ods_dash_social_comments WHERE channel IS NOT NULL AND channel != '' ORDER BY channel"
            results = self.db_config.execute_query_dict(sql)
            
            logger.info(f"查询结果: {results}")
            
            platforms = [row['channel'] for row in results if row and row.get('channel')]
            logger.info(f"平台列表: {platforms}")
            
            return jsonify({
                'success': True,
                'data': platforms,
                'total': len(platforms),
                'message': f'获取到 {len(platforms)} 个平台'
            }), 200
            
        except Exception as e:
            logger.error(f"获取平台列表失败: {e}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
            return jsonify({
                'success': False,
                'error': '获取平台列表失败',
                'message': str(e)
            }), 500

    def get_database_stats(self):
        """
        获取数据库统计信息
        
        Returns:
            统计信息字典
        """
        try:
            return self.analyzer.get_database_stats()
        except Exception as e:
            logger.error(f"获取数据库统计失败: {e}")
            return {
                'error': f'获取数据库统计失败: {str(e)}',
                'connection_status': 'error',
                'last_updated': datetime.now().isoformat()
            }

    # def get_analysis_history(self, limit: int = 50):
    #     """
    #     获取分析历史记录
        
    #     Args:
    #         limit: 返回记录数量限制
            
    #     Returns:
    #         JSON响应
    #     """
    #     try:
    #         # 模拟分析历史记录的查询
    #         # 注意：由于当前系统没有专门的分析历史记录表，这里返回一些基于现有数据的模拟历史
    #         sql = """
    #             SELECT 
    #                 CONCAT('analysis_', DATE_FORMAT(MAX(created_at), '%%Y%%m%%d_%%H%%i%%s')) as analysis_id,
    #                 'sentiment,brand_mentions' as analysis_types,
    #                 'petlibro,宠物喂食器' as keywords,
    #                 DATE_FORMAT(DATE_SUB(MAX(created_at), INTERVAL 30 DAY), '%%Y-%%m-%%d') as start_date,
    #                 DATE_FORMAT(MAX(created_at), '%%Y-%%m-%%d') as end_date,
    #                 MAX(created_at) as analysis_time,
    #                 COUNT(*) as data_count,
    #                 channel as platform
    #             FROM dwd_dash_social_comments 
    #             WHERE ai_processing_status = 'completed'
    #             GROUP BY DATE(created_at), channel
    #             ORDER BY MAX(created_at) DESC 
    #             LIMIT %s
    #         """
            
    #         result = self.db_config.execute_query_dict(sql, (limit,))
            
    #         # 处理DataFrame或字典列表
    #         if result is None:
    #             return jsonify({
    #                 'success': True,
    #                 'data': [],
    #                 'message': '暂无分析记录'
    #             }), 200
            
    #         # 如果结果是pandas DataFrame，转换为字典列表
    #         if hasattr(result, 'to_dict'):
    #             result = result.to_dict('records')
    #         elif hasattr(result, 'empty') and result.empty:
    #             return jsonify({
    #                 'success': True,
    #                 'data': [],
    #                 'message': '暂无分析记录'
    #             }), 200
    #         elif len(result) == 0:
    #             return jsonify({
    #                 'success': True,
    #                 'data': [],
    #                 'message': '暂无分析记录'
    #             }), 200
            
    #         # 格式化结果
    #         analysis_history = []
    #         for row in result:
    #             analysis_history.append({
    #                 'key': row.get('analysis_id'),
    #                 'analysisType': row.get('analysis_types', '').split(','),
    #                 'keywords': row.get('keywords', '').split(','),
    #                 'dateRange': f"{row.get('start_date')} ~ {row.get('end_date')}",
    #                 'analysisTime': str(row.get('analysis_time')) if row.get('analysis_time') else None,
    #                 'dataCount': row.get('data_count', 0),
    #                 'platform': row.get('platform')
    #             })
            
    #         return jsonify({
    #             'success': True,
    #             'data': analysis_history,
    #             'total': len(analysis_history),
    #             'message': f'获取到 {len(analysis_history)} 条分析记录'
    #         }), 200
            
    #     except Exception as e:
    #         logger.error(f"获取分析历史失败: {e}")
    #         return jsonify({
    #             'success': False,
    #             'error': '获取分析历史失败',
    #             'message': str(e)
    #         }), 500

    def _generate_comprehensive_basic_summary(self, sentiment_results: dict) -> str:
        """
        生成基础的图表综合分析总结（当AI不可用时的fallback）
        """
        try:
            sentiment_stats = sentiment_results.get('sentiment_stats', {})
            chart_data = sentiment_results.get('chart_data', {})
            
            # 使用AI分析器的fallback方法
            return self.ai_analyzer._generate_fallback_chart_summary(
                sentiment_stats, chart_data, sentiment_results.get('sentiment_trends', {})
            )
            
        except Exception as e:
            logger.error(f"生成基础图表综合总结失败: {e}")
            return "图表数据分析总结生成失败，请重试。"
