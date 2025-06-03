#!/usr/bin/env python3
import struct

def create_favicon():
    # 创建一个简单的16x16 ICO文件
    # ICO文件头
    ico_header = struct.pack('<HHH', 0, 1, 1)  # Reserved, Type (1=ICO), Count
    
    # 图标目录条目
    width, height = 16, 16
    colors = 0  # 0 表示 256 色或更多
    planes = 1
    bit_count = 32
    image_size = width * height * 4  # 32位 RGBA
    image_offset = 22  # 头部 + 目录条目的大小
    
    dir_entry = struct.pack('<BBBBHHLL', width, height, colors, 0, planes, bit_count, image_size, image_offset)
    
    # 创建RGBA像素数据 (蓝色背景，白色AI字母的简化版本)
    pixels = []
    for y in range(16):
        for x in range(16):
            # 创建一个圆形的蓝色背景
            center_x, center_y = 8, 8
            distance = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            
            if distance <= 7:  # 圆形内部
                # AI字母的简化形状
                if ((x == 3 or x == 5) and 4 <= y <= 10) or (x == 4 and y == 7):  # A
                    pixels.extend([255, 255, 255, 255])  # 白色 BGRA
                elif (x in [10, 11, 12] and 4 <= y <= 10):  # I
                    pixels.extend([255, 255, 255, 255])  # 白色
                else:
                    pixels.extend([235, 99, 37, 255])  # 蓝色背景 BGRA
            else:
                pixels.extend([0, 0, 0, 0])  # 透明
    
    # 组合ICO文件
    ico_data = ico_header + dir_entry + bytes(pixels)
    
    # 写入文件
    with open('favicon.ico', 'wb') as f:
        f.write(ico_data)
    
    print('favicon.ico created successfully')

if __name__ == '__main__':
    create_favicon() 