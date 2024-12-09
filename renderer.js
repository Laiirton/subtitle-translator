const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

let selectedFile = null;

document.getElementById('srtFile').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    document.getElementById('fileName').textContent = selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado';
    document.getElementById('translateButton').disabled = !selectedFile;
});

async function translateSubtitle() {
    if (!selectedFile) {
        showStatus('Por favor, selecione um arquivo SRT', 'error');
        return;
    }

    const targetLanguage = document.getElementById('targetLanguage').value;
    const statusElement = document.getElementById('status');
    
    try {
        showStatus('Traduzindo...', '');
        
        const fileContent = await readFile(selectedFile);
        const translatedContent = await translateContent(fileContent, targetLanguage);
        
        // Save the translated file
        const saveFilePath = selectedFile.path.replace('.srt', `_${targetLanguage}.srt`);
        fs.writeFileSync(saveFilePath, translatedContent);
        
        showStatus(`Tradução concluída! Arquivo salvo como: ${saveFilePath}`, 'success');
    } catch (error) {
        showStatus(`Erro na tradução: ${error.message}`, 'error');
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
    const model = genAI.getGenerativeModel({ model: "gemini-exp-1206" });

    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
    };

    const languageMap = {
        'pt-BR': 'português do Brasil',
        'en': 'inglês',
        'es': 'espanhol',
        'fr': 'francês',
        'de': 'alemão',
        'it': 'italiano',
        'ja': 'japonês',
        'ko': 'coreano',
        'zh': 'chinês'
    };

    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [{ text: `Traduza esta legenda para ${languageMap[targetLanguage]}. Mantenha o formato SRT exato, incluindo números de sequência e timestamps:` }],
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
