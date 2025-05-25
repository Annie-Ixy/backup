import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileUpload from './components/FileUpload';
import CandidateRanking from './components/CandidateRanking';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import { Award, Upload, Users, TrendingUp } from 'lucide-react';
import axios from 'axios';

function App() {
  const [currentView, setCurrentView] = useState('upload');
  const [jobId, setJobId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [processedJobDescription, setProcessedJobDescription] = useState('');

  // Poll for results when jobId is set
  useEffect(() => {
    if (!jobId) return;

    const pollResults = async () => {
      try {
        const response = await axios.get(`/api/results/${jobId}`);
        const data = response.data;

        if (data.status === 'completed') {
          setCandidates(data.candidates);
          setLoading(false);
          setCurrentView('results');
          setProgress(100);
          if (data.jobDescription) {
            setProcessedJobDescription(data.jobDescription);
          }
        } else if (data.status === 'processing') {
          setCandidates(data.candidates || []);
          setProgress(data.progress || 0);
          if (data.jobDescription) {
            setProcessedJobDescription(data.jobDescription);
          }
        } else if (data.status === 'error') {
          setError(data.error || 'An error occurred during processing');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error polling results:', error);
        setError('Failed to fetch results');
        setLoading(false);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollResults, 2000);
    
    // Clean up interval on unmount or when jobId changes
    return () => clearInterval(interval);
  }, [jobId]);

  const handleFileUpload = async (file, jobDescription) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setCurrentView('processing');

    const formData = new FormData();
    formData.append('zipFile', file);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setJobId(response.data.jobId);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.error || 'Failed to upload file');
      setLoading(false);
      setCurrentView('upload');
    }
  };

  const handleStartOver = () => {
    setCurrentView('upload');
    setJobId(null);
    setCandidates([]);
    setLoading(false);
    setProgress(0);
    setError(null);
    setProcessedJobDescription('');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'upload':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FileUpload 
              onUpload={handleFileUpload} 
              error={error}
              jobDescription={jobDescription}
              onJobDescriptionChange={setJobDescription}
            />
          </motion.div>
        );
      
      case 'processing':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <LoadingScreen 
              progress={progress} 
              candidatesProcessed={candidates.length}
              onStartOver={handleStartOver}
            />
          </motion.div>
        );
      
      case 'results':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CandidateRanking 
              candidates={candidates} 
              jobDescription={processedJobDescription}
              onStartOver={handleStartOver}
            />
          </motion.div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentView={currentView} onStartOver={handleStartOver} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 text-gray-600">
              <Award className="h-5 w-5" />
              <span className="font-medium">AI Resume Screening System</span>
            </div>
            
            <div className="flex items-center space-x-6 mt-4 md:mt-0 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Upload className="h-4 w-4" />
                <span>ZIP Upload</span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4" />
                <span>AI Analysis</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Smart Ranking</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 