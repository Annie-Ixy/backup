import { useState, useEffect, useCallback } from 'react';

// Translation system for the Voice Cloning App
export const useTranslation = () => {
  const [currentLang, setCurrentLang] = useState(
    localStorage.getItem('preferredLanguage') || 'en'
  );

  const translations = {
    en: {
      // Header
      'app-title': 'Voice Cloning Studio',
      'app-subtitle': 'Transform text into natural speech with AI-powered voice synthesis',
      
      // Voice Cloning Section
      'clone-title': 'Clone a Voice',
      'clone-subtitle': 'Upload an audio sample to create a new voice clone',
      'voice-name-label': 'Voice Name:',
      'voice-name-placeholder': 'Enter a name for your cloned voice',
      'audio-sample-label': 'Audio Sample (MP3, WAV, FLAC):',
      'audio-sample-hint': 'Upload clear speech samples (30 seconds - 10 minutes recommended)',
      'clone-btn': 'Clone Voice',
      
      // Voice Selection Section
      'select-voice-title': 'Select Voice',
      'choose-voice-label': 'Choose a voice:',
      'loading-voices': 'Loading voices...',
      'select-voice-placeholder': 'Select a voice...',
      'refresh-btn': 'Refresh',
      
      // Text to Speech Section
      'generate-title': 'Generate Speech',
      'text-input-label': 'Enter text to convert to speech:',
      'text-input-placeholder': 'Type your message here...',
      'audio-format-label': 'Output Format:',
      'generate-btn': 'Generate Speech',
      'download-btn': 'Download Audio',
      
      // Footer
      'footer-text': '',
      'footer-text-2': '',
      
      // Status Messages
      'status-loading-voices': 'Loading voices...',
      'status-cloning': 'Cloning voice... This may take a few moments.',
      'status-clone-success': 'Voice cloned successfully!',
      'status-generating': 'Generating speech...',
      'status-generated': 'Speech generated successfully!',
      'status-error': 'An error occurred. Please try again.',
      'status-provide-both': 'Please provide both voice name and audio file',
      'status-select-voice-text': 'Please select a voice and enter text'
    },
    cn: {
      // Header
      'app-title': '声音克隆工作室',
      'app-subtitle': '使用AI技术将文字转换为自然语音',
      
      // Voice Cloning Section
      'clone-title': '克隆声音',
      'clone-subtitle': '上传音频样本以创建新的声音克隆',
      'voice-name-label': '声音名称：',
      'voice-name-placeholder': '为您的克隆声音输入一个名称',
      'audio-sample-label': '音频样本（MP3、WAV、FLAC）：',
      'audio-sample-hint': '上传清晰的语音样本（建议30秒至10分钟）',
      'clone-btn': '克隆声音',
      
      // Voice Selection Section
      'select-voice-title': '选择声音',
      'choose-voice-label': '选择一个声音：',
      'loading-voices': '正在加载声音...',
      'select-voice-placeholder': '选择一个声音...',
      'refresh-btn': '刷新',
      
      // Text to Speech Section
      'generate-title': '生成语音',
      'text-input-label': '输入要转换为语音的文字：',
      'text-input-placeholder': '在此输入您的消息...',
      'audio-format-label': '输出格式：',
      'generate-btn': '生成语音',
      'download-btn': '下载音频',
      
      // Footer
      'footer-text': '',
      'footer-text-2': '',
      
      // Status Messages
      'status-loading-voices': '正在加载声音...',
      'status-cloning': '正在克隆声音...这可能需要一些时间。',
      'status-clone-success': '声音克隆成功！',
      'status-generating': '正在生成语音...',
      'status-generated': '语音生成成功！',
      'status-error': '发生错误，请重试。',
      'status-provide-both': '请提供声音名称和音频文件',
      'status-select-voice-text': '请选择声音并输入文字'
    }
  };

  const toggleLanguage = useCallback(() => {
    const newLang = currentLang === 'en' ? 'cn' : 'en';
    setCurrentLang(newLang);
    localStorage.setItem('preferredLanguage', newLang);
    
    // Update HTML lang attribute
    document.documentElement.lang = newLang === 'cn' ? 'zh-CN' : 'en';
    
    // Update page title
    document.title = newLang === 'cn' ? 
      '声音克隆工作室 - AI语音生成' : 
      'Voice Cloning Studio - AI Voice Generation';
  }, [currentLang]);

  const t = useCallback((key) => {
    return translations[currentLang][key] || translations['en'][key] || key;
  }, [currentLang, translations]);

  useEffect(() => {
    // Initialize language on component mount
    document.documentElement.lang = currentLang === 'cn' ? 'zh-CN' : 'en';
    document.title = currentLang === 'cn' ? 
      '声音克隆工作室 - AI语音生成' : 
      'Voice Cloning Studio - AI Voice Generation';
  }, [currentLang]);

  return {
    t,
    currentLang,
    toggleLanguage
  };
}; 