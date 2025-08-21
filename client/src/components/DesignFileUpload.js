import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image } from 'lucide-react';
import { motion } from 'framer-motion';

const getMimeType = (ext) => {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
  };
  return mimeTypes[ext] || null;
};

const DesignFileUpload = ({ onFilesSelected, acceptedFileTypes, disabled = false }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (!disabled) {
      onFilesSelected(acceptedFiles);
    }
  }, [onFilesSelected, disabled]);

  const allAcceptedTypes = [
    ...acceptedFileTypes.documents,
    ...acceptedFileTypes.images
  ];

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: allAcceptedTypes.reduce((acc, ext) => {
      const mimeType = getMimeType(ext);
      if (mimeType) acc[mimeType] = [ext];
      return acc;
    }, {}),
    multiple: true,
    disabled,
  });

  const getFileIcon = (fileName) => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (acceptedFileTypes.images.includes(ext)) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="w-full">
      <div {...getRootProps()}>
        <motion.div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : isDragActive
                ? 'border-blue-500 bg-blue-50 cursor-pointer'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 cursor-pointer'
          }`}
          whileHover={disabled ? {} : { scale: 1.01 }}
          whileTap={disabled ? {} : { scale: 0.99 }}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          {disabled ? (
            <p className="text-lg font-medium text-gray-500">正在上传文件，请稍候...</p>
          ) : isDragActive ? (
            <p className="text-lg font-medium text-blue-600">释放文件以上传...</p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-700 mb-2">
                拖拽文件到此处，或点击选择文件
              </p>
              <p className="text-sm text-gray-500">
                支持的格式：{allAcceptedTypes.join(', ')}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                最多可同时上传10个文件
              </p>
            </>
          )}
        </motion.div>
      </div>

      {acceptedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            已选择的文件 ({acceptedFiles.length})
          </h3>
          <div className="space-y-2">
            {acceptedFiles.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
              >
                {getFileIcon(file.name)}
                <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DesignFileUpload; 