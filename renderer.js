const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

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
        // Primeiro, solicita ao usuário onde salvar o arquivo
        const suggestedName = selectedFile.name.replace('.srt', `_${targetLanguage}.srt`);
        const savePath = await ipcRenderer.invoke('show-save-dialog', {
            defaultPath: suggestedName
        });
        
        if (!savePath) {
            showStatus('Operação cancelada pelo usuário', 'error');
            return;
        }

        processingSection.style.display = 'block';
        translationPreview.style.display = 'block';
        translationPreview.textContent = '';
        showStatus('', '');
        
        const fileContent = await readFile(selectedFile);
        const subtitleBlocks = parseSubtitleBlocks(fileContent);
        
        let translatedContent = '';
        for (let i = 0; i < subtitleBlocks.length; i++) {
            const block = subtitleBlocks[i];
            progressText.textContent = `Translating subtitle ${i + 1}/${subtitleBlocks.length}...`;
            
            // Mostrar o bloco atual sendo traduzido
            const lines = block.split('\n');
            const blockNumber = lines[0];
            const timing = lines[1];
            const text = lines.slice(2).join('\n');
            
            // Atualiza o preview com o bloco atual
            const currentPreview = `${blockNumber}\n${timing}\n${text}`;
            translationPreview.textContent = currentPreview;
            translationPreview.scrollTop = translationPreview.scrollHeight;

            const translatedBlock = await translateBlock(block, targetLanguage, i + 1);
            if (translatedContent) {
                translatedContent += '\n\n';
            }
            translatedContent += translatedBlock;
            
            // Atualiza o preview com todo o conteúdo traduzido
            translationPreview.textContent = translatedContent;
            translationPreview.scrollTop = translationPreview.scrollHeight;
        }
        
        // Salva o arquivo traduzido no local escolhido pelo usuário
        fs.writeFileSync(savePath, translatedContent);
        
        progressText.textContent = 'Translation completed!';
        showStatus(`Tradução concluída! Arquivo salvo em: ${savePath}`, 'success');
    } catch (error) {
        showStatus(`Erro na tradução: ${error.message}`, 'error');
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

// Window controls
document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});
