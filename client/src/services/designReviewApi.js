import axios from 'axios';
import api from '../utils/request';

const API_BASE_URL = process.env.REACT_APP_DESIGN_API_URL;


export const designReviewApiService = {
  // Get server configuration
  getConfig: async () => {
    const response = await api.get('/test/api/design-review/config');
    return response;
  },

  // Upload files with progress tracking
  uploadFiles: async (files, onUploadProgress = null) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/test/api/design-review/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        onUploadProgress(progressEvent);
      } : undefined,
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
    
    let sseConnected = false;
    let pollingInterval = null;
    let processingCompleted = false;
    
    // Create EventSource for SSE
    const eventSource = new EventSource(`/test/api/design-review/progress/${sessionId}`);
    
    // Polling fallback function (similar to resume screening)
    const pollStatus = async () => {
      if (processingCompleted) {
        console.log('Processing already completed, stopping polling');
        return;
      }
      
      try {
        console.log('Polling status for session:', sessionId);
        const response = await api.get(`/test/api/design-review/status/${sessionId}`);
        
        if (response && response.status !== 'not_found') {
          console.log('Polling status received:', response);
          
          // Disable SSE since polling is working
          if (sseConnected && eventSource.readyState !== EventSource.CLOSED) {
            console.log('Polling working, closing SSE connection');
            eventSource.close();
            sseConnected = false;
          }
          
          if (onProgress) {
            onProgress(response);
          }
          
          if (response.status === 'completed' || response.stage === 'all_completed') {
            console.log('Processing completed via polling');
            processingCompleted = true;
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        } else {
          console.log('Session not found or expired:', response);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    // Set up progress listener
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message received:', data);
        
        if (data.type === 'connected') {
          console.log('SSE connected successfully:', data.sessionId);
          sseConnected = true;
          
          // Cancel polling if SSE is working
          if (pollingInterval) {
            console.log('SSE connected, stopping polling fallback');
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        } else if (data.type === 'progress') {
          console.log('SSE progress data:', data);
          if (onProgress) {
            onProgress(data);
          }
          
          if (data.status === 'completed' || data.stage === 'all_completed') {
            processingCompleted = true;
          }
        } else if (data.type === 'close') {
          console.log('SSE connection closed by server');
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
        console.error('Raw event data:', event.data);
      }
    };
    
    eventSource.onopen = (event) => {
      console.log('SSE connection opened:', event);
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      console.error('SSE readyState:', eventSource.readyState);
      console.error('SSE url:', eventSource.url);
      
      // Start polling fallback if SSE fails
      if (!sseConnected && !pollingInterval) {
        console.log('SSE failed, starting polling fallback');
        pollingInterval = setInterval(pollStatus, 2000); // Poll every 2 seconds
      }
    };
    
    // Start processing with session ID
    try {
      // Start polling fallback immediately as SSE might disconnect
      setTimeout(() => {
        if (!pollingInterval) {
          console.log('Starting polling fallback as backup');
          pollingInterval = setInterval(pollStatus, 2000);
        }
      }, 1000);
      
      const response = await api.post('/test/api/design-review/process', {
        fileIds,
        language,
        reviewCategories,
        sessionId,
      });
      
      // Keep checking for completion
      let checkCount = 0;
      const maxChecks = 300; // 10 minutes max
      
      const waitForCompletion = () => {
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            checkCount++;
            if (processingCompleted || checkCount >= maxChecks) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 1000);
        });
      };
      
      await waitForCompletion();
      
      // Clean up
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      return response.results;
    } catch (error) {
      // Clean up on error
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
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