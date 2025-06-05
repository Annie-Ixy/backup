import axios from 'axios';
import api from '../utils/request';

const API_BASE_URL = process.env.REACT_APP_DESIGN_API_URL;


export const designReviewApiService = {
  // Get server configuration
  getConfig: async () => {
    const response = await api.get('/test/api/design-review/config');
    return response;
  },

  // Upload files
  uploadFiles: async (files) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/test/api/design-review/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.files;
  },

  // Process files
  processFiles: async (fileIds, language, reviewCategories) => {
    const response = await api.post('/test/api/design-review/process', {
      fileIds,
      language,
      reviewCategories,
    });
    return response.results;
  },

  // Generate report
  generateReport: async (fileId, reviewResult, processedData, format) => {
    const response = await api.post('/test/api/design-review/generate-report', {
      fileId,
      reviewResult,
      processedData,
      format,
    });
    return response;
  },

  // Download report
  downloadReport: (filename) => {
    return `${API_BASE_URL}/test/api/design-review/download/${filename}`;
  },
}; 