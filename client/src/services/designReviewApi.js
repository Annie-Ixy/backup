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

  // Process files with real-time progress
  processFilesWithProgress: async (fileIds, language, reviewCategories, onProgress) => {
    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create EventSource for SSE
    const eventSource = new EventSource(`/test/api/design-review/progress/${sessionId}`);
    
    // Set up progress listener
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('SSE connected:', data.sessionId);
        } else if (data.type === 'progress') {
          if (onProgress) {
            onProgress(data);
          }
        } else if (data.type === 'close') {
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };
    
    // Start processing with session ID
    try {
      const response = await api.post('/test/api/design-review/process', {
        fileIds,
        language,
        reviewCategories,
        sessionId,
      });
      
      // Close SSE connection if still open
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      
      return response.results;
    } catch (error) {
      // Close SSE connection on error
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      throw error;
    }
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