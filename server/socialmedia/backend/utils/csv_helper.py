# -*- coding: utf-8 -*-
"""
CSV文件处理帮助工具
用于检测和修复CSV文件的编码、格式问题
"""

import os
import logging
import chardet
import pandas as pd
from typing import Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)

class CSVHelper:
    """CSV文件处理助手"""
    
    @staticmethod
    def detect_encoding(file_path: str) -> Dict[str, Any]:
        """
        检测文件编码
        
        Returns:
            {
                'encoding': str,
                'confidence': float,
                'method': str  # 'chardet' or 'fallback'
            }
        """
        try:
            # 使用chardet检测
            with open(file_path, 'rb') as f:
                raw_data = f.read(100000)  # 读取前100KB
                result = chardet.detect(raw_data)
                
                if result and result.get('confidence', 0) > 0.5:
                    return {
                        'encoding': result['encoding'],
                        'confidence': result['confidence'],
                        'method': 'chardet'
                    }
        
        except Exception as e:
            logger.warning(f"chardet检测失败: {e}")
        
        # 备用检测方法 - 尝试读取文件的不同部分
        common_encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030', 'iso-8859-1', 'cp1252', 'latin1']
        
        for encoding in common_encodings:
            try:
                with open(file_path, 'r', encoding=encoding, errors='strict') as f:
                    # 尝试读取更多内容来验证编码
                    content = f.read(5000)
                    if content:  # 确保读取到内容
                        return {
                            'encoding': encoding,
                            'confidence': 0.8,
                            'method': 'fallback'
                        }
            except (UnicodeDecodeError, UnicodeError):
                continue
            except Exception:
                continue
        
        return {
            'encoding': 'utf-8',
            'confidence': 0.1,
            'method': 'default'
        }
    
    @staticmethod
    def detect_separator(file_path: str, encoding: str = 'utf-8') -> str:
        """
        检测CSV分隔符
        """
        separators = [',', ';', '\t', '|']
        
        try:
            # 先尝试指定编码，如果失败则尝试其他编码
            first_lines = []
            encodings_to_try = [encoding, 'utf-8', 'gbk', 'gb2312', 'iso-8859-1', 'cp1252']
            
            # 特别处理：如果传入的编码不在尝试列表中，优先尝试
            if encoding not in encodings_to_try:
                encodings_to_try.insert(0, encoding)
            
            for enc in encodings_to_try:
                try:
                    with open(file_path, 'r', encoding=enc, errors='ignore') as f:
                        for i, line in enumerate(f):
                            first_lines.append(line.strip())
                            if i >= 5:  # 只读前5行
                                break
                    if first_lines:  # 确保读取到内容
                        break  # 成功读取就跳出
                except (UnicodeDecodeError, UnicodeError, OSError):
                    continue
                except Exception as e:
                    logger.debug(f"使用编码 {enc} 读取分隔符检测失败: {e}")
                    continue
            
            # 统计每种分隔符的出现次数
            sep_counts = {}
            for sep in separators:
                total_count = 0
                consistent = True
                first_count = None
                
                for line in first_lines:
                    if line:
                        count = line.count(sep)
                        if first_count is None:
                            first_count = count
                        elif count != first_count and count > 0:
                            consistent = False
                        total_count += count
                
                # 优先选择一致且出现次数多的分隔符
                sep_counts[sep] = {
                    'total': total_count,
                    'consistent': consistent,
                    'per_line': total_count / len(first_lines) if first_lines else 0
                }
            
            # 选择最佳分隔符
            best_sep = ','
            best_score = 0
            
            for sep, stats in sep_counts.items():
                score = stats['total']
                if stats['consistent']:
                    score *= 2  # 一致性加分
                if stats['per_line'] > 1:
                    score *= 1.5  # 每行多个分隔符加分
                
                if score > best_score:
                    best_score = score
                    best_sep = sep
            
            return best_sep
            
        except Exception as e:
            logger.warning(f"分隔符检测失败: {e}")
            return ','
        
        # 如果没有读取到内容，返回默认分隔符
        if not first_lines:
            logger.warning("未能读取到文件内容进行分隔符检测，使用默认逗号")
            return ','
    
    @staticmethod
    def analyze_csv_file(file_path: str) -> Dict[str, Any]:
        """
        分析CSV文件的详细信息
        """
        try:
            file_size = os.path.getsize(file_path)
            
            # 检测编码
            encoding_info = CSVHelper.detect_encoding(file_path)
            encoding = encoding_info['encoding']
            
            # 检测分隔符（使用安全模式）
            try:
                separator = CSVHelper.detect_separator(file_path, encoding)
            except Exception as e:
                logger.warning(f"分隔符检测失败，使用默认逗号: {e}")
                separator = ','
            
            # 尝试读取文件获取基本信息
            try:
                # 使用容错模式读取
                read_params = {'encoding': encoding, 'sep': separator, 'nrows': 100}
                
                # 添加错误处理参数
                try:
                    import pandas as pd
                    version = pd.__version__.split('.')
                    major, minor = int(version[0]), int(version[1])
                    
                    if major > 1 or (major == 1 and minor >= 3):
                        read_params['on_bad_lines'] = 'skip'
                    else:
                        read_params['error_bad_lines'] = False
                except:
                    pass
                
                df = pd.read_csv(file_path, **read_params)
                
                analysis = {
                    'file_size': file_size,
                    'encoding': encoding_info,
                    'separator': separator,
                    'columns': df.columns.tolist(),
                    'column_count': len(df.columns),
                    'sample_row_count': len(df),
                    'has_header': True,  # 假设有标题行
                    'readable': True,
                    'error': None
                }
                
                # 检查是否可能没有标题行
                if df.columns.dtype == 'object':
                    first_row_types = [type(val).__name__ for val in df.iloc[0] if pd.notna(val)]
                    col_types = [type(col).__name__ for col in df.columns]
                    if set(first_row_types) == set(col_types):
                        analysis['has_header'] = False
                
                return analysis
                
            except Exception as e:
                return {
                    'file_size': file_size,
                    'encoding': encoding_info,
                    'separator': separator,
                    'readable': False,
                    'error': str(e)
                }
                
        except Exception as e:
            return {
                'readable': False,
                'error': f"文件分析失败: {str(e)}"
            }
    
    @staticmethod
    def read_csv_simple(file_path: str) -> Tuple[Optional[pd.DataFrame], str]:
        """
        简单健壮的CSV读取（不依赖复杂分析）
        """
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030', 'iso-8859-1', 'cp1252', 'latin1']
        separators = [',', ';', '\t', '|']
        
        for encoding in encodings:
            for separator in separators:
                try:
                    # 简单参数读取
                    df = pd.read_csv(file_path, encoding=encoding, sep=separator)
                    
                    # 验证结果
                    if len(df) > 0 and len(df.columns) > 1:
                        logger.info(f"简单CSV读取成功: 编码={encoding}, 分隔符='{separator}'")
                        return df, ""
                    
                except Exception:
                    continue
        
        # 尝试容错读取
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding, sep=None, engine='python')
                if len(df) > 0:
                    logger.info(f"容错CSV读取成功: 编码={encoding}")
                    return df, ""
            except Exception:
                continue
        
        return None, "所有简单读取方法都失败"
    
    @staticmethod
    def read_csv_robust(file_path: str, max_attempts: int = 10) -> Tuple[Optional[pd.DataFrame], str]:
        """
        健壮的CSV读取方法
        
        Returns:
            (DataFrame or None, error_message)
        """
        try:
            # 1. 分析文件
            analysis = CSVHelper.analyze_csv_file(file_path)
            
            if not analysis.get('readable', False):
                return None, analysis.get('error', '文件不可读')
            
            encoding = analysis['encoding']['encoding']
            separator = analysis['separator']
            
            # 2. 尝试读取
            read_attempts = [
                # 基础尝试
                {'encoding': encoding, 'sep': separator},
                {'encoding': encoding, 'sep': separator, 'header': 0},
                {'encoding': encoding, 'sep': separator, 'header': None},
                
                # 备用编码
                {'encoding': 'utf-8', 'sep': separator},
                {'encoding': 'gbk', 'sep': separator},
                {'encoding': 'iso-8859-1', 'sep': separator},
                
                # 备用分隔符
                {'encoding': encoding, 'sep': ','},
                {'encoding': 'utf-8', 'sep': ','},
                
                # 错误容忍（根据pandas版本调整）
                CSVHelper._get_error_tolerance_params('utf-8', separator),
                CSVHelper._get_error_tolerance_params(encoding, separator)
            ]
            
            last_error = None
            
            for i, params in enumerate(read_attempts[:max_attempts]):
                try:
                    # 添加容错参数
                    safe_params = params.copy()
                    safe_params['encoding_errors'] = 'replace'  # 替换无法解码的字符
                    
                    try:
                        df = pd.read_csv(file_path, **safe_params)
                    except TypeError:
                        # 如果pandas不支持encoding_errors参数，回退到原始参数
                        df = pd.read_csv(file_path, **params)
                    
                    # 验证读取结果
                    if len(df) == 0:
                        logger.debug(f"尝试 {i+1}: 文件为空")
                        continue
                    
                    if len(df.columns) == 1 and params.get('sep', ',') != ',':
                        # 可能分隔符错误，尝试逗号
                        logger.debug(f"尝试 {i+1}: 分隔符可能错误，只有一列")
                        continue
                    
                    logger.info(f"CSV读取成功 (尝试 {i+1}): {params}")
                    return df, ""
                    
                except UnicodeDecodeError as e:
                    last_error = e
                    logger.debug(f"CSV读取尝试 {i+1} 编码错误: {params}, 错误: {e}")
                    continue
                except Exception as e:
                    last_error = e
                    logger.debug(f"CSV读取尝试 {i+1} 失败: {params}, 错误: {e}")
                    continue
            
            return None, f"所有读取方法都失败，最后错误: {last_error}"
            
        except Exception as e:
            return None, f"CSV读取异常: {str(e)}"
    
    @staticmethod
    def _get_error_tolerance_params(encoding: str, separator: str) -> Dict[str, Any]:
        """获取错误容忍参数（兼容不同pandas版本）"""
        params = {'encoding': encoding, 'sep': separator}
        
        try:
            # 检查pandas版本是否支持on_bad_lines参数
            import pandas as pd
            version = pd.__version__.split('.')
            major, minor = int(version[0]), int(version[1])
            
            # pandas >= 1.3.0 支持 on_bad_lines
            if major > 1 or (major == 1 and minor >= 3):
                params['on_bad_lines'] = 'skip'
            else:
                # 旧版本使用 error_bad_lines
                params['error_bad_lines'] = False
                
        except Exception:
            # 如果检测失败，使用保守策略
            pass
            
        return params
    
    @staticmethod
    def fix_csv_file(file_path: str, output_path: str = None) -> Tuple[bool, str]:
        """
        修复CSV文件（转换为UTF-8编码）
        
        Args:
            file_path: 源文件路径
            output_path: 输出文件路径，如果为None则覆盖原文件
            
        Returns:
            (success, message)
        """
        try:
            # 读取文件
            df, error_msg = CSVHelper.read_csv_robust(file_path)
            
            if df is None:
                return False, f"无法读取源文件: {error_msg}"
            
            # 确定输出路径
            if output_path is None:
                output_path = file_path
            
            # 保存为UTF-8编码的CSV
            df.to_csv(output_path, encoding='utf-8-sig', index=False)
            
            return True, f"文件已修复并保存为: {output_path}"
            
        except Exception as e:
            return False, f"文件修复失败: {str(e)}"
