const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { ipcRenderer } = require('electron');

let selectedFile = null;

document.getElementById('srtFile').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    document.getElementById('fileName').textContent = selectedFile ? selectedFile.name : 'No file selected';
    document.getElementById('translateButton').disabled = !selectedFile;
});

async function translateSubtitle() {
    if (!selectedFile) {
        showStatus('Por favor, selecione um arquivo SRT', 'error');
        return;
    }

    const targetLanguage = document.getElementById('targetLanguage').value;
    const processingSection = document.getElementById('processingSection');
    const progressText = document.getElementById('progressText');
    const translationPreview = document.getElementById('translationPreview');
    
    try {
        processingSection.style.display = 'block';
        translationPreview.style.display = 'block';
        translationPreview.textContent = '';
        showStatus('', '');
        
        const fileContent = await readFile(selectedFile);
        const subtitleBlocks = parseSubtitleBlocks(fileContent);
        
        progressText.textContent = `Processando 0/${subtitleBlocks.length} blocos de legendas...`;
        
        let translatedContent = '';
        for (let i = 0; i < subtitleBlocks.length; i++) {
            const block = subtitleBlocks[i];
            progressText.textContent = `Traduzindo legenda ${i + 1}/${subtitleBlocks.length}...`;
            
            // Mostrar o bloco atual sendo traduzido
            const lines = block.split('\n');
            const currentText = lines.slice(2).join('\n');
            translationPreview.textContent = `${lines[0]}\n${lines[1]}\n${currentText}\n`;
            translationPreview.scrollTop = translationPreview.scrollHeight;

            const translatedBlock = await translateBlock(block, targetLanguage, i + 1);
            translatedContent += translatedBlock + '\n\n';
            
            // Update progress and preview
            progressText.textContent = `Traduzindo legenda ${i + 1}/${subtitleBlocks.length}...`;
            translationPreview.textContent = translatedContent;
            translationPreview.scrollTop = translationPreview.scrollHeight;
        }
        
        // Save the translated file
        const saveFilePath = selectedFile.path.replace('.srt', `_${targetLanguage}.srt`);
        fs.writeFileSync(saveFilePath, translatedContent.trim());
        
        progressText.textContent = 'Translation completed!';
        showStatus(`Translation completed! File saved as: ${saveFilePath}`, 'success');
    } catch (error) {
        showStatus(`Translation error: ${error.message}`, 'error');
        progressText.textContent = 'Translation failed';
    }
}

function parseSubtitleBlocks(content) {
    return content.trim().split('\n\n').filter(block => block.trim());
}

async function translateBlock(block, targetLanguage, blockNumber) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const generationConfig = {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
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

    // Split the block into components
    const lines = block.split('\n');
    const index = lines[0];
    const timing = lines[1];
    const subtitleText = lines.slice(2).join('\n');

    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [{ text: `You are a professional subtitle translator. Translate the following subtitle text to ${languageMap[targetLanguage]}. 
                Consider the context and maintain the natural flow of dialogue. The translation should sound natural and preserve the original meaning and tone.
                Only translate the subtitle text, keep the timing and index exactly as is.

                Original subtitle block:
                Index: ${index}
                Timing: ${timing}
                Text: ${subtitleText}` }],
            }
        ],
    });

    const result = await chatSession.sendMessage(subtitleText);
    const translatedText = result.response.text().trim();

    // Reconstruct the subtitle block with original timing
    return `${index}\n${timing}\n${translatedText}`;
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = type;
}

// Controles da janela
document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});
