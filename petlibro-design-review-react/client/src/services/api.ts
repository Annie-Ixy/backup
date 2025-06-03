import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Config {
  supportedLanguages: Record<string, string>;
  reviewCategories: Record<string, { name: string; description: string }>;
  supportedFileTypes: {
    documents: string[];
    images: string[];
  };
}

export interface UploadedFile {
  id: string;
  originalName: string;
  path: string;
  size: number;
  type: string;
}

export interface ProcessResult {
  fileId: string;
  success: boolean;
  processedData?: any;
  reviewResult?: ReviewResult;
  error?: string;
}

export interface ReviewResult {
  issues: Issue[];
  review_summary: ReviewSummary;
  recommendations: string[];
  overall_quality_score: number;
  metadata: {
    reviewedAt: string;
    language: string;
    categories: string[];
  };
}

export interface Issue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  location: string;
  original_text: string;
  suggested_fix: string;
  explanation: string;
  confidence: number;
  category: string;
}

export interface ReviewSummary {
  total_issues: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  by_type: Record<string, number>;
  by_category: Record<string, number>;
}

export const apiService = {
  // Get server configuration
  getConfig: async (): Promise<Config> => {
    const response = await api.get('http://localhost:5000/api/config');
    return response.data;
  },

  // Upload files
  uploadFiles: async (files: File[]): Promise<UploadedFile[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.files;
  },

  // Process files
  processFiles: async (
    fileIds: string[],
    language: string,
    reviewCategories: string[]
  ): Promise<ProcessResult[]> => {
    const response = await api.post('/process', {
      fileIds,
      language,
      reviewCategories,
    });
    return response.data.results;
  },

  // Generate report
  generateReport: async (
    fileId: string,
    reviewResult: ReviewResult,
    processedData: any,
    format: string
  ): Promise<{ reportFiles: Record<string, string> }> => {
    const response = await api.post('/generate-report', {
      fileId,
      reviewResult,
      processedData,
      format,
    });
    return response.data;
  },

  // Download report
  downloadReport: (filename: string): string => {
    return `${API_BASE_URL}/download/${filename}`;
  },
}; 