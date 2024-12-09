const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

let selectedFile = null;

document.getElementById('srtFile').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    document.getElementById('fileName').textContent = selectedFile ? selectedFile.name : 'No file selected';
    document.getElementById('translateButton').disabled = !selectedFile;
});

async function translateSubtitle() {
    if (!selectedFile) {
        showStatus('Please select an SRT file', 'error');
        return;
    }

    const targetLanguage = document.getElementById('targetLanguage').value;
    const statusElement = document.getElementById('status');
    
    try {
        showStatus('Translating...', '');
        
        const fileContent = await readFile(selectedFile);
        const translatedContent = await translateContent(fileContent, targetLanguage);
        
        // Save the translated file
        const saveFilePath = selectedFile.path.replace('.srt', `_${targetLanguage}.srt`);
        fs.writeFileSync(saveFilePath, translatedContent);
        
        showStatus(`Translation completed! File saved as: ${saveFilePath}`, 'success');
    } catch (error) {
        showStatus(`Translation error: ${error.message}`, 'error');
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function translateContent(content, targetLanguage) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
    };

    const languageMap = {
        'en': 'English',
        'es': 'Spanish',
        'pt-BR': 'Brazilian Portuguese',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
    };

    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [{ text: `Translate this subtitle to ${languageMap[targetLanguage]}. Keep the exact SRT format, including sequence numbers and timestamps:` }],
            }
        ],
    });

    const result = await chatSession.sendMessage(content);
    return result.response.text();
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = type;
}
