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

function showToast(message, type = 'success') {
    // Remove qualquer toast existente
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Criar novo toast
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    // Ícone baseado no tipo
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✓' : '✕';
    
    // Mensagem
    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageElement);
    document.body.appendChild(toast);

    // Remover o toast após 5 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

async function translateSubtitle() {
    if (!selectedFile) {
        showStatus('Please select an SRT file', 'error');
        showToast('Please select an SRT file', 'error');
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
        progressText.textContent = 'Translating subtitle...';
        
        // Atualiza o preview com o conteúdo original
        translationPreview.textContent = fileContent;
        
        // Traduz todo o conteúdo de uma vez
        const translatedContent = await translateContent(fileContent, targetLanguage);
        
        // Atualiza o preview com o conteúdo traduzido
        translationPreview.textContent = translatedContent;
        translationPreview.scrollTop = translationPreview.scrollHeight;
        
        // Salva o arquivo traduzido no local escolhido pelo usuário
        fs.writeFileSync(savePath, translatedContent);
        
        progressText.textContent = 'Translation completed!';
        showStatus(`Translation completed! File saved at: ${savePath}`, 'success');
        showToast('Translation completed successfully!', 'success');

        // Envia notificação ao usuário
        ipcRenderer.send('show-notification', {
            title: 'Professional Subtitle Translator',
            body: `Your subtitle has been translated successfully!\nSaved at: ${path.basename(savePath)}`
        });
    } catch (error) {
        showStatus(`Translation error: ${error.message}`, 'error');
        progressText.textContent = 'Translation failed';
        showToast('Error translating subtitle', 'error');

        // Notificação de erro
        ipcRenderer.send('show-notification', {
            title: 'Professional Subtitle Translator',
            body: 'An error occurred while translating the subtitle. Please try again.'
        });
    }
}

async function translateContent(content, targetLanguage) {
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
        'zh': 'Chinese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'tr': 'Turkish',
        'nl': 'Dutch'
    };

    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [{ text: `You are a professional subtitle translator. Translate the following subtitle file to ${languageMap[targetLanguage]}. 
                Keep all timecodes and subtitle numbers exactly as they are.
                Maintain the same format and structure of the SRT file.
                Only translate the actual subtitle text, keeping all technical aspects of the file intact.
                Ensure natural and contextually appropriate translations.
                
                Original subtitle file:
                ${content}` }],
            }
        ],
    });

    const result = await chatSession.sendMessage(content);
    return result.response.text().trim();
}

function parseSubtitleBlocks(content) {
    return content.trim().split('\n\n').filter(block => block.trim());
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

// Detectar e selecionar o idioma do sistema
function detectSystemLanguage() {
    const systemLanguage = navigator.language;
    const languageSelect = document.getElementById('targetLanguage');
    const options = languageSelect.options;
    
    // Procura uma correspondência exata primeiro
    for (let option of options) {
        if (option.value.toLowerCase() === systemLanguage.toLowerCase()) {
            languageSelect.value = option.value;
            return;
        }
    }
    
    // Se não encontrar correspondência exata, procura pelo idioma base
    const baseLanguage = systemLanguage.split('-')[0];
    for (let option of options) {
        if (option.value.toLowerCase().startsWith(baseLanguage.toLowerCase())) {
            languageSelect.value = option.value;
            return;
        }
    }
}

// Chamar a função quando a página carregar
document.addEventListener('DOMContentLoaded', detectSystemLanguage);
