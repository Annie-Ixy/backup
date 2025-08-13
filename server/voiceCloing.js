const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
require('dotenv').config();

const router = express.Router();

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = './uploads';
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check if file is audio
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

// Routes

// Serve the main page
// router.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// Get all available voices
router.get('/api/voices', async (req, res) => {
    try {
        const voices = await elevenlabs.voices.getAll();
        res.json({
            success: true,
            voices: voices.voices || []
        });
    } catch (error) {
        console.error('Error fetching voices:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch voices'
        });
    }
});

// Clone a voice using IVC (Instant Voice Cloning)
router.post('/api/clone-voice', upload.single('audio'), async (req, res) => {
    try {
        const { name } = req.body;
        const audioFile = req.file;

        if (!name || !audioFile) {
            return res.status(400).json({
                success: false,
                error: 'Voice name and audio file are required'
            });
        }

        console.log('Cloning voice with name:', name);
        console.log('Audio file:', audioFile.filename);

        // Create a read stream for the uploaded file
        const fileStream = fs.createReadStream(audioFile.path);

        // Use IVC (Instant Voice Cloning) to create the voice
        const response = await elevenlabs.voices.ivc.create({
            name: name,
            files: [fileStream]
        });

        console.log('Voice cloned successfully:', response);

        // Clean up the uploaded file
        fs.unlinkSync(audioFile.path);

        res.json({
            success: true,
            voiceId: response.voice_id,
            message: `Voice "${name}" cloned successfully`
        });

    } catch (error) {
        console.error('Error cloning voice:', error);
        
        // Clean up the uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clone voice'
        });
    }
});

// Generate speech from text using a specific voice
router.post('/api/generate-speech', async (req, res) => {
    try {
        const { text, voiceId, format = 'aac' } = req.body;  // Default to AAC format

        if (!text || !voiceId || voiceId === 'undefined') {
            return res.status(400).json({
                success: false,
                error: 'Text and voice ID are required'
            });
        }

        console.log('Generating speech for voice:', voiceId);
        console.log('Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

        // Generate speech using ElevenLabs
        const audio = await elevenlabs.textToSpeech.convert(voiceId, {
            text: text,
            outputFormat: "mp3_44100_128",
            modelId: "eleven_multilingual_v2"
        });

        // Convert the readable stream to buffer
        const chunks = [];
        for await (const chunk of audio) {
            chunks.push(chunk);
        }
        const mp3Buffer = Buffer.concat(chunks);
        
        let finalBuffer;
        let contentType;
        let filename;
        
        // Convert to AAC if requested (default), otherwise keep as MP3
        if (format === 'aac') {
            console.log('Converting MP3 to AAC format...');
            try {
                finalBuffer = await convertMP3toAAC(mp3Buffer);
                contentType = 'audio/aac';
                filename = 'generated-speech.aac';
                console.log('Successfully converted to AAC');
            } catch (conversionError) {
                console.error('AAC conversion failed, falling back to MP3:', conversionError);
                // Fallback to MP3 if conversion fails
                finalBuffer = mp3Buffer;
                contentType = 'audio/mpeg';
                filename = 'generated-speech.mp3';
            }
        } else {
            finalBuffer = mp3Buffer;
            contentType = 'audio/mpeg';
            filename = 'generated-speech.mp3';
        }

        // Set appropriate headers for audio response
        res.set({
            'Content-Type': contentType,
            'Content-Length': finalBuffer.length,
            'Content-Disposition': `attachment; filename="${filename}"`
        });

        res.send(finalBuffer);

    } catch (error) {
        console.error('Error generating speech:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate speech'
        });
    }
});

// Helper function to convert audio buffer from MP3 to AAC
function convertMP3toAAC(mp3Buffer) {
    return new Promise((resolve, reject) => {
        const inputStream = new Readable();
        inputStream.push(mp3Buffer);
        inputStream.push(null);
        
        const chunks = [];
        
        ffmpeg(inputStream)
            .inputFormat('mp3')
            .audioCodec('aac')
            .audioBitrate('128k')
            .audioChannels(2)
            .audioFrequency(44100)
            .format('adts')  // AAC with ADTS headers for better compatibility
            .on('error', (err) => {
                console.error('FFmpeg conversion error:', err);
                reject(err);
            })
            .on('end', () => {
                const aacBuffer = Buffer.concat(chunks);
                resolve(aacBuffer);
            })
            .pipe()
            .on('data', (chunk) => {
                chunks.push(chunk);
            });
    });
}

// Health check endpoint
router.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Voice Cloning API is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 50MB.'
            });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

module.exports = router;