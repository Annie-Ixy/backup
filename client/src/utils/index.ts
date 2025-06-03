// // 实现一个去调用接口的函数
import { api } from './request';

export const isLogin = async() => {
    try {
        const res = await api.get(
            '/dev-api/udap/product_af109/summary_card',
            {}, // params 参数，这里为空对象
            {   // config 参数，在这里添加 headers
                headers: {
                    'token': sessionStorage.getItem('token')
                }
            }
        ) as unknown as {
            code: number;
        };
        if (res.code === 0) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('请求失败:', error);
        throw error;
    }
} 