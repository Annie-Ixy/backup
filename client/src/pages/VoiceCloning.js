import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../components/useTranslation';
import { api } from '../utils/request';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Award, 
  User, 
  LogOut, 
  Mic, 
  Upload, 
  Users, 
  Volume2, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Play,
  Zap,
  Heart,
  FileAudio,
  MessageSquare
} from 'lucide-react';
import { Select, Spin } from 'antd';
import '../styles/VoiceCloning.css';

const VoiceCloning = () => {
  const { t, currentLang, toggleLanguage } = useTranslation();
  const navigate = useNavigate();
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [cloneStatus, setCloneStatus] = useState({ message: '', type: '' });
  const [speechStatus, setSpeechStatus] = useState({ message: '', type: '' });
  const [audioUrl, setAudioUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudioBlob, setCurrentAudioBlob] = useState(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [username, setUsername] = useState('用户');
  const [audioKey, setAudioKey] = useState(0); // 添加音频key来强制重新渲染
  const [selectedFormat, setSelectedFormat] = useState('aac'); // 添加格式选择状态
  
  const audioFileInputRef = useRef(null);
  const audioElementRef = useRef(null); // 添加音频元素引用
  const isRequestingRef = useRef(false);

  useEffect(() => {
    loadVoices();
    // 从 localStorage 获取用户名
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // 清理旧的音频URL以防止内存泄漏
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleGoToHome = () => {
    navigate('/home');
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    navigate('/');
  };

  const loadVoices = async () => {
    if (isRequestingRef.current) {
      console.log('VoiceCloning: 阻止重复请求，当前正在请求中');
      return;
    }
    
    console.log('VoiceCloning: 开始加载语音列表');
    
    try {
      isRequestingRef.current = true;
      setIsLoadingVoices(true);
      setCloneStatus({ message: t('status-loading-voices'), type: 'loading' });
      
      const response = await api.get('/test/voice-cloning/api/voices');
      const data = response;

      if (data.success) {
        setVoices(data.voices);
        setCloneStatus({ message: '', type: '' });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
      setCloneStatus({ 
        message: `${t('status-error')}: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      isRequestingRef.current = false;
      setIsLoadingVoices(false);
    }
  };

  const cloneVoice = async () => {
    if (!voiceName.trim() || !audioFile) {
      setCloneStatus({ 
        message: t('status-provide-both'), 
        type: 'error' 
      });
      return;
    }

    try {
      setIsCloning(true);
      setCloneStatus({ 
        message: t('status-cloning'), 
        type: 'loading' 
      });

      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('audio', audioFile);

      const response = await api.post('/test/voice-cloning/api/clone-voice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response;

      if (data.success) {
        const successMsg = t('status-clone-success');
        setCloneStatus({ 
          message: `${successMsg} Voice ID: ${data.voiceId}`, 
          type: 'success' 
        });
        setVoiceName('');
        setAudioFile(null);
        if (audioFileInputRef.current) {
          audioFileInputRef.current.value = '';
        }
        
        setTimeout(() => loadVoices(), 1000);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error cloning voice:', error);
      setCloneStatus({ 
        message: `${t('status-error')}: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setIsCloning(false);
    }
  };

  const generateSpeech = async () => {
    if (!textInput.trim() || !selectedVoice) {
      setSpeechStatus({ 
        message: t('status-select-voice-text'), 
        type: 'error' 
      });
      return;
    }

    try {
      setIsGenerating(true);
      setSpeechStatus({ 
        message: t('status-generating'), 
        type: 'loading' 
      });

      // 清理旧的音频URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl('');
      }

      const response = await api.post('/test/voice-cloning/api/generate-speech', {
        text: textInput,
        voiceId: selectedVoice,
        format: selectedFormat // 传递格式参数
      }, {
        responseType: 'blob'
      });

      if (response) {
        const audioBlob = response;
        const newAudioUrl = URL.createObjectURL(audioBlob);
        
        setAudioUrl(newAudioUrl);
        setCurrentAudioBlob(audioBlob);
        
        // 只有在重新生成时才增加key值来强制重新渲染音频元素
        if (audioUrl) {
          setAudioKey(prev => prev + 1);
          
          // 等待DOM更新后强制重新加载音频
          setTimeout(() => {
            if (audioElementRef.current) {
              audioElementRef.current.load();
              audioElementRef.current.currentTime = 0;
            }
          }, 100);
        }
        
        setSpeechStatus({ 
          message: t('status-generated'), 
          type: 'success' 
        });
      } else {
        throw new Error('Failed to generate speech');
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      setSpeechStatus({ 
        message: `${t('status-error')}: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (!currentAudioBlob) {
      alert('No audio available for download');
      return;
    }

    const url = URL.createObjectURL(currentAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    // 根据选择的格式使用正确的文件扩展名
    const extension = selectedFormat || 'aac';
    a.download = `generated-speech-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAudioFile(file);
  };

  const handleRefreshVoices = () => {
    loadVoices();
  };

  return (
    <div className="voice-cloning-container">
      {/* Language Toggle Button */}
      <div className="language-toggle">
        <button 
          className={`lang-btn ${currentLang === 'cn' ? 'cn' : ''}`} 
          onClick={toggleLanguage}
          title="Switch Language"
        >
          <span className="lang-en">EN</span>
          <span className="lang-divider">|</span>
          <span className="lang-cn">中文</span>
        </button>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoToHome}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回首页</span>
              </button>
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">语音克隆 AI</h1>
                <p className="text-sm text-gray-500">使用AI技术克隆语音并生成自然语音，打造个性化语音体验</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <User className="h-5 w-5" />
                <span>欢迎，{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>退出</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container">
        {/* Page Header Section */}
        <header className="page-header">
          <h1>
            <Mic className="header-icon" /> 
            <span>{t('app-title')}</span>
          </h1>
          <p>{t('app-subtitle')}</p>
        </header>

        <main>
          {/* Voice Cloning Section */}
          <section className="card">
            <h2>
              <Upload className="section-icon" /> 
              <span>{t('clone-title')}</span>
            </h2>
            <p>{t('clone-subtitle')}</p>
            
            <div className="form-group">
              <label htmlFor="voiceName">
                <MessageSquare className="label-icon" />
                {t('voice-name-label')}
              </label>
              <input
                type="text"
                id="voiceName"
                placeholder={t('voice-name-placeholder')}
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="audioFile">
                <FileAudio className="label-icon" />
                {t('audio-sample-label')}
              </label>
              <input
                ref={audioFileInputRef}
                type="file"
                id="audioFile"
                accept="audio/*"
                onChange={handleFileChange}
                required
              />
              <small>{t('audio-sample-hint')}</small>
            </div>

            <div className="button-group">
              <button 
                className="btn primary"
                onClick={cloneVoice}
                disabled={isCloning}
              >
                {isCloning ? (
                  <RefreshCw className="btn-icon spinning" />
                ) : (
                  <Sparkles className="btn-icon sparkles" />
                )}
                <span>{isCloning ? t('status-cloning') : t('clone-btn')}</span>
              </button>
            </div>
            
            {cloneStatus.message && (
              <div className={`status ${cloneStatus.type}`}>
                {cloneStatus.message}
              </div>
            )}
          </section>

          {/* Voice Selection Section */}
          <section className="card">
            <h2>
              <Users className="section-icon" /> 
              <span>{t('select-voice-title')}</span>
            </h2>
            <div className="form-group">
              <label htmlFor="voiceSelect">{t('choose-voice-label')}</label>
              <div className="select-with-button">
                <Select
                  id="voiceSelect"
                  value={selectedVoice}
                  onChange={(value) => setSelectedVoice(value)}
                  loading={isLoadingVoices}
                  placeholder={t('select-voice-placeholder')}
                  style={{ width: '100%' }}
                  showSearch
                  filterOption={(input, option) => {
                    const optionText = option?.children || option?.label || '';
                    return optionText.toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {voices.map((voice, index) => (
                    <Select.Option key={index} value={voice.voiceId || voice.voice_id}>
                      {voice.name} ({voice.category || 'Custom'})
                    </Select.Option>
                  ))}
                </Select>
                <button 
                  className="btn secondary"
                  onClick={handleRefreshVoices}
                  disabled={isLoadingVoices}
                >
                  {isLoadingVoices ? (
                    <RefreshCw className="btn-icon spinning" />
                  ) : (
                    <RefreshCw className="btn-icon refresh" />
                  )}
                  <span>{isLoadingVoices ? t('status-loading-voices') : t('refresh-btn')}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Text-to-Speech Section */}
          <section className="card">
            <h2>
              <Volume2 className="section-icon" /> 
              <span>{t('generate-title')}</span>
            </h2>
            <div className="form-group">
              <label htmlFor="textInput">
                <MessageSquare className="label-icon" />
                {t('text-input-label')}
              </label>
              <textarea
                id="textInput"
                placeholder={t('text-input-placeholder')}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows="4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="formatSelect">{t('audio-format-label')}</label>
              <Select
                id="formatSelect"
                value={selectedFormat}
                onChange={(value) => setSelectedFormat(value)}
                style={{ width: '100%' }}
              >
                <Select.Option value="aac">AAC (MP4)</Select.Option>
                <Select.Option value="mp3">MP3</Select.Option>
                <Select.Option value="wav">WAV</Select.Option>
              </Select>
            </div>

            <div className="button-group">
              <button 
                className="btn primary"
                onClick={generateSpeech}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="btn-icon spinning" />
                ) : (
                  <Play className="btn-icon play" />
                )}
                <span>{isGenerating ? t('status-generating') : t('generate-btn')}</span>
              </button>
            </div>
            
            {speechStatus.message && (
              <div className={`status ${speechStatus.type}`}>
                {speechStatus.message}
              </div>
            )}
            
            {audioUrl && (
              <div className="audio-player">
                <audio 
                  ref={audioElementRef}
                  key={audioKey} 
                  controls 
                  src={audioUrl}
                  onLoadStart={() => console.log('Audio loading started')}
                  onLoadedMetadata={() => console.log('Audio metadata loaded')}
                  onCanPlay={() => console.log('Audio can play')}
                  onError={(e) => console.error('Audio error:', e)}
                />
                <button 
                  className="btn secondary"
                  onClick={downloadAudio}
                >
                  <Download className="btn-icon download" /> 
                  <span>{t('download-btn')}</span>
                </button>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer>
          <p>
            <Zap className="footer-icon" /> 
            <span>{t('footer-text')}</span>
            <Heart className="footer-icon heart" />
            <span>{t('footer-text-2')}</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default VoiceCloning; 