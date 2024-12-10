const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const path = require('path');

let selectedFile = null;

// Função auxiliar para logs
function log(message) {
    ipcRenderer.send('log-message', message);
}

document.getElementById('srtFile').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    document.getElementById('fileName').textContent = selectedFile ? selectedFile.name : 'No file selected';
    document.getElementById('translateButton').disabled = !selectedFile;
    if (selectedFile) {
        log(`Selected file: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`);
    }
});

function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✓' : '✕';
    
    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageElement);
    document.body.appendChild(toast);

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
        log('Starting translation process...');
        const suggestedName = selectedFile.name.replace('.srt', `_${targetLanguage}.srt`);
        const savePath = await ipcRenderer.invoke('show-save-dialog', {
            defaultPath: suggestedName
        });
        
        if (!savePath) {
            log('Operation cancelled by user');
            showStatus('Operation cancelled by user', 'error');
            return;
        }

        processingSection.style.display = 'block';
        translationPreview.style.display = 'block';
        translationPreview.textContent = '';
        showStatus('', '');
        
        log('Reading subtitle file...');
        const fileContent = await readFile(selectedFile);
        progressText.textContent = 'Starting translation...';
        
        // Atualiza o preview com o conteúdo original
        translationPreview.textContent = fileContent;
        
        log('Starting block translation process...');
        const translatedContent = await translateContent(fileContent, targetLanguage);
        
        log('Saving translated file...');
        fs.writeFileSync(savePath, translatedContent);
        
        log('Translation completed successfully!');
        progressText.textContent = 'Translation completed!';
        showStatus(`Translation completed! File saved at: ${savePath}`, 'success');
        showToast('Translation completed successfully!', 'success');

        ipcRenderer.send('show-notification', {
            title: 'Professional Subtitle Translator',
            body: `Your subtitle has been translated successfully!\nSaved at: ${path.basename(savePath)}`
        });
    } catch (error) {
        log(`ERROR: ${error.message}`);
        showStatus(`Translation error: ${error.message}`, 'error');
        progressText.textContent = 'Translation failed';
        showToast('Error translating subtitle', 'error');

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

    // Normaliza as quebras de linha para \n
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Divide o conteúdo em blocos de legendas usando expressão regular
    const blocks = normalizedContent.split(/\n\s*\n/).filter(block => {
        // Verifica se o bloco tem o formato correto de legenda
        const lines = block.trim().split('\n');
        return lines.length >= 2 && /^\d+$/.test(lines[0].trim()) && 
               /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(lines[1].trim());
    });

    const BLOCK_SIZE = 180; // Aumentado para 180 legendas por requisição
    const totalBlocks = Math.ceil(blocks.length / BLOCK_SIZE);
    let translatedContent = [];
    
    const progressText = document.getElementById('progressText');
    const translationPreview = document.getElementById('translationPreview');

    log(`Total subtitle blocks: ${blocks.length}`);
    log(`Number of batches to process: ${totalBlocks}`);
    log(`Batch size: ${BLOCK_SIZE} subtitles`);

    for (let i = 0; i < blocks.length; i += BLOCK_SIZE) {
        try {
            const currentBlockNumber = Math.floor(i / BLOCK_SIZE) + 1;
            const endIndex = Math.min(i + BLOCK_SIZE, blocks.length);
            
            const progressMessage = `Translating batch ${currentBlockNumber} of ${totalBlocks} (subtitles ${i + 1} to ${endIndex})...`;
            progressText.textContent = progressMessage;
            log(progressMessage);
            
            const blockSlice = blocks.slice(i, endIndex);
            const blockContent = blockSlice.join('\n\n');
            
            const chatSession = model.startChat({
                generationConfig,
                history: [
                    {
                        role: "user",
                        parts: [{ text: `You are a professional subtitle translator. Translate the following subtitle block to ${languageMap[targetLanguage]}. 
                        Keep all subtitle numbers and time codes exactly as they are.
                        Keep the same format and structure as the SRT file.
                        Translate only the subtitle text, keeping all technical aspects of the file intact.
                        Ensure natural and contextually appropriate translations.
                        
                        Original subtitle block:
                        ${blockContent}` }],
                    }
                ],
            });

            const result = await chatSession.sendMessage(blockContent);
            const translatedBlock = result.response.text().trim();
            
            // Verifica se a tradução manteve a estrutura correta
            const originalLines = blockSlice.length;
            const translatedLines = translatedBlock.split(/\n\s*\n/).filter(block => block.trim()).length;
            
            if (translatedLines !== originalLines) {
                log(`WARNING: Possible issue in batch ${currentBlockNumber}. Number of subtitles differs from original.`);
            }

            translatedContent.push(translatedBlock);

            // Atualiza o preview com o progresso atual
            const currentProgress = translatedContent.join('\n\n');
            translationPreview.textContent = currentProgress;
            translationPreview.scrollTop = translationPreview.scrollHeight;

            // Verifica o progresso atual
            const currentTranslatedBlocks = currentProgress.split(/\n\s*\n/).filter(block => block.trim()).length;
            log(`Progress: ${currentTranslatedBlocks} of ${blocks.length} subtitles processed`);

            // Pequena pausa entre as requisições para evitar sobrecarga
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            log(`Error translating batch ${Math.floor(i / BLOCK_SIZE) + 1}: ${error.message}`);
            progressText.textContent = `Error translating batch ${Math.floor(i / BLOCK_SIZE) + 1}. Trying to continue...`;
            
            // Em caso de erro, tenta processar em blocos menores
            try {
                log('Attempting to process batch with reduced size...');
                const FALLBACK_SIZE = 50; // Tamanho reduzido para retry
                const blockSlice = blocks.slice(i, Math.min(i + BLOCK_SIZE, blocks.length));
                let fallbackContent = [];

                for (let j = 0; j < blockSlice.length; j += FALLBACK_SIZE) {
                    const fallbackEndIndex = Math.min(j + FALLBACK_SIZE, blockSlice.length);
                    const fallbackSlice = blockSlice.slice(j, fallbackEndIndex);
                    const fallbackBlockContent = fallbackSlice.join('\n\n');

                    const fallbackSession = model.startChat({
                        generationConfig,
                        history: [
                            {
                                role: "user",
                                parts: [{ text: `You are a professional subtitle translator. Translate the following subtitle block to ${languageMap[targetLanguage]}. 
                                Keep all subtitle numbers and time codes exactly as they are.
                                Keep the same format and structure as the SRT file.
                                Translate only the subtitle text, keeping all technical aspects of the file intact.
                                Ensure natural and contextually appropriate translations.
                                
                                Original subtitle block:
                                ${fallbackBlockContent}` }],
                            }
                        ],
                    });

                    const fallbackResult = await fallbackSession.sendMessage(fallbackBlockContent);
                    fallbackContent.push(fallbackResult.response.text().trim());
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                translatedContent.push(fallbackContent.join('\n\n'));
                log('Recovery successful with smaller blocks');
            } catch (fallbackError) {
                log(`Recovery failed. Keeping original block: ${fallbackError.message}`);
                // Se ainda assim falhar, mantém o bloco original
                const originalBlock = blocks.slice(i, i + BLOCK_SIZE).join('\n\n');
                translatedContent.push(originalBlock);
            }
            
            // Pausa mais longa antes de continuar
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    const finalContent = translatedContent.join('\n\n');
    const finalBlockCount = finalContent.split(/\n\s*\n/).filter(block => block.trim()).length;
    log(`Translation finished - Total blocks processed: ${finalBlockCount} of ${blocks.length}`);

    return finalContent;
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

// Detectar e selecionar o idioma do sistema
function detectSystemLanguage() {
    const systemLanguage = navigator.language;
    const languageSelect = document.getElementById('targetLanguage');
    const options = languageSelect.options;
    
    for (let option of options) {
        if (option.value.toLowerCase() === systemLanguage.toLowerCase()) {
            languageSelect.value = option.value;
            return;
        }
    }
    
    const baseLanguage = systemLanguage.split('-')[0];
    for (let option of options) {
        if (option.value.toLowerCase().startsWith(baseLanguage.toLowerCase())) {
            languageSelect.value = option.value;
            return;
        }
    }
}

document.addEventListener('DOMContentLoaded', detectSystemLanguage);
