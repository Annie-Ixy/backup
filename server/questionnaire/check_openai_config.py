#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenAI配置检查脚本
用于诊断OpenAI API配置问题
"""

import os
import sys

def check_openai_config():
    """检查OpenAI配置"""
    print("🔍 OpenAI配置检查")
    print("=" * 50)
    
    # 0. 加载.env文件
    print("0. 加载.env文件...")
    try:
        from dotenv import load_dotenv
        load_dotenv()  # 加载.env文件
        print("✅ .env文件加载成功")
    except ImportError:
        print("⚠️ python-dotenv库未安装，跳过.env文件加载")
    except Exception as e:
        print(f"⚠️ .env文件加载失败: {e}")
    
    # 1. 检查OpenAI库是否安装
    print("1. 检查OpenAI库安装状态...")
    try:
        import openai
        print("✅ OpenAI库已安装")
        print(f"   版本: {openai.__version__}")
    except ImportError as e:
        print("❌ OpenAI库未安装")
        print(f"   错误: {e}")
        print("   解决方案: pip install openai")
        return False
    
    # 2. 检查环境变量
    print("\n2. 检查环境变量...")
    
    # 检查API密钥
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        print(f"✅ OPENAI_API_KEY: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else '***'}")
    else:
        print("❌ OPENAI_API_KEY 未设置")
        print("   解决方案: 设置环境变量 OPENAI_API_KEY=your_api_key")
    
    # 检查模型设置
    model = os.getenv("OPENAI_MODEL")
    if model:
        print(f"✅ OPENAI_MODEL: {model}")
    else:
        print("❌ OPENAI_MODEL 未设置")
        print("   解决方案: 设置环境变量 OPENAI_MODEL=gpt-3.5-turbo")
    
    # 检查基础URL
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    print(f"🔗 OPENAI_BASE_URL: {base_url}")
    
    # 检查代理设置
    http_proxy = os.getenv("http_proxy")
    https_proxy = os.getenv("https_proxy")
    if http_proxy or https_proxy:
        print(f"🌐 代理设置:")
        if http_proxy:
            print(f"   http_proxy: {http_proxy}")
        if https_proxy:
            print(f"   https_proxy: {https_proxy}")
    else:
        print("🌐 未设置代理")
    
    # 3. 测试OpenAI客户端初始化
    print("\n3. 测试OpenAI客户端初始化...")
    if not api_key:
        print("❌ 跳过客户端测试，API密钥未设置")
        return False
    
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        print("✅ OpenAI客户端初始化成功")
        
        # 4. 测试简单API调用（可选）
        print("\n4. 测试API连接...")
        if input("是否测试API连接？(y/n): ").lower() == 'y':
            try:
                response = client.chat.completions.create(
                    model=model or "gpt-3.5-turbo",
                    messages=[
                        {"role": "user", "content": "Hello"}
                    ],
                    max_tokens=5
                )
                print("✅ API连接测试成功")
                print(f"   响应: {response.choices[0].message.content}")
                return True
            except Exception as e:
                print(f"❌ API连接测试失败: {e}")
                return False
        else:
            return True
            
    except Exception as e:
        print(f"❌ OpenAI客户端初始化失败: {e}")
        return False

def print_solution():
    """打印解决方案"""
    print("\n🛠️ 解决方案:")
    print("=" * 50)
    print("1. 安装OpenAI库:")
    print("   pip install openai")
    print()
    print("2. 设置环境变量:")
    print("   export OPENAI_API_KEY='your_api_key_here'")
    print("   export OPENAI_MODEL='gpt-3.5-turbo'")
    print()
    print("3. 如果在Windows上，可以这样设置:")
    print("   set OPENAI_API_KEY=your_api_key_here")
    print("   set OPENAI_MODEL=gpt-3.5-turbo")
    print()
    print("4. 或者创建 .env 文件:")
    print("   OPENAI_API_KEY=your_api_key_here")
    print("   OPENAI_MODEL=gpt-3.5-turbo")

if __name__ == "__main__":
    success = check_openai_config()
    if not success:
        print_solution()
    else:
        print("\n🎉 OpenAI配置检查完成，所有配置正常！") 