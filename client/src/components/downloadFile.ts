import { api } from '../utils/request';
import { message } from 'antd';

export default function downloadFile(name: string) {
    api.get(`/test/download-sample-file/${name}`, {}, { responseType: 'blob' }).then(res => {
        try {
            if (res) {
                const url = window.URL.createObjectURL(new Blob([res]));
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
                window.URL.revokeObjectURL(url);
                message.success('下载成功');
            }
        } catch (error) {
            message.error('下载失败');
        }
    })
}