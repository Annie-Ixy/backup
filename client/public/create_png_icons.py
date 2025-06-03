#!/usr/bin/env python3
import struct
import zlib

def create_png_icon(size, filename):
    """创建指定尺寸的PNG图标"""
    width = height = size
    
    # PNG文件头
    png_signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8位RGB
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr_chunk = struct.pack('>I4s', len(ihdr_data), b'IHDR') + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # 创建图像数据
    rows = []
    center_x = center_y = width // 2
    
    for y in range(height):
        row = [0]  # PNG行过滤器类型 (0 = None)
        for x in range(width):
            # 计算到中心的距离
            distance = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
            radius = width * 0.4
            
            if distance <= radius:  # 圆形内部
                # 蓝色背景
                r, g, b = 37, 99, 235
                
                # AI字母形状 (根据尺寸调整)
                letter_scale = width / 16.0
                
                # A字母
                a_left = int(3 * letter_scale)
                a_right = int(5 * letter_scale)
                a_middle = int(4 * letter_scale)
                a_cross = int(7 * letter_scale)
                a_top = int(4 * letter_scale)
                a_bottom = int(10 * letter_scale)
                
                # I字母
                i_left = int(10 * letter_scale)
                i_right = int(12 * letter_scale)
                
                if ((x == a_left or x == a_right) and a_top <= y <= a_bottom) or (x == a_middle and y == a_cross):
                    r, g, b = 255, 255, 255  # 白色字母
                elif i_left <= x <= i_right and a_top <= y <= a_bottom:
                    r, g, b = 255, 255, 255  # 白色字母
            else:
                # 透明背景
                r, g, b = 255, 255, 255
            
            row.extend([r, g, b])
        
        rows.append(bytes(row))
    
    # 压缩图像数据
    raw_data = b''.join(rows)
    compressed_data = zlib.compress(raw_data)
    
    # IDAT chunk
    idat_crc = zlib.crc32(b'IDAT' + compressed_data) & 0xffffffff
    idat_chunk = struct.pack('>I4s', len(compressed_data), b'IDAT') + compressed_data + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend_chunk = struct.pack('>I4s', 0, b'IEND') + struct.pack('>I', iend_crc)
    
    # 组合PNG文件
    png_data = png_signature + ihdr_chunk + idat_chunk + iend_chunk
    
    # 写入文件
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    print(f'{filename} created successfully')

if __name__ == '__main__':
    # 创建不同尺寸的图标
    create_png_icon(16, 'favicon-16x16.png')
    create_png_icon(32, 'favicon-32x32.png')
    create_png_icon(192, 'android-chrome-192x192.png')
    create_png_icon(512, 'android-chrome-512x512.png')
    create_png_icon(180, 'apple-touch-icon.png') 