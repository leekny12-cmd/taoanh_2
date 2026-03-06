import { GoogleGenAI, Modality } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl } from '../shared/state.js';
import { fileToBase64, getApiErrorMessage, processImageGenerationResponse } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';

// Module-level state
let originalImage = null;
let backgroundImage = null;

export function renderBackgroundTab(container) {
    container.innerHTML = `
        <div class="upload-group">
            <label>Ảnh gốc (để giữ lại chủ thể)</label>
            <div id="original-image-upload" class="drop-zone small" role="button" tabindex="0">
                <div id="original-image-preview" class="single-preview-container"><p>Tải ảnh gốc</p></div>
                <input type="file" id="original-file-input" accept="image/*" hidden>
            </div>
        </div>
        <div class="upload-group">
            <label>Ảnh nền (tùy chọn)</label>
            <div id="background-image-upload" class="drop-zone small" role="button" tabindex="0">
                 <div id="background-image-preview" class="single-preview-container"><p>Tải ảnh nền</p></div>
                <input type="file" id="background-file-input" accept="image/*" hidden>
            </div>
        </div>
        <div class="prompt-header">
            <label for="background-prompt-input">Mô tả nền (nếu không tải ảnh nền)</label>
            <div class="prompt-buttons">
                 <button id="generate-bg-prompt-btn">TẠO MÔ TẢ TỰ ĐỘNG TỪ GỢI Ý CỦA BẠN</button>
                 <div id="suggestion-wrapper" class="suggestion-wrapper hidden">
                    <input type="text" id="suggestion-input" placeholder="Gợi ý nền, ví dụ: trong rừng">
                    <button id="confirm-suggestion-btn" aria-label="Xác nhận gợi ý">✓</button>
                    <button id="cancel-suggestion-btn" aria-label="Hủy bỏ">✕</button>
                 </div>
            </div>
        </div>
        <textarea id="background-prompt-input" placeholder="Ví dụ: Một bãi biển nhiệt đới lúc hoàng hôn"></textarea>
        <button id="change-background-btn" disabled>Thay nền</button>
    `;

    const originalUploadEl = document.getElementById('original-image-upload');
    const originalFileInputEl = document.getElementById('original-file-input');
    const backgroundUploadEl = document.getElementById('background-image-upload');
    const backgroundFileInputEl = document.getElementById('background-file-input');
    const backgroundPromptInputEl = document.getElementById('background-prompt-input');
    const generateBgPromptBtnEl = document.getElementById('generate-bg-prompt-btn');
    const changeBackgroundBtnEl = document.getElementById('change-background-btn');
    const suggestionWrapperEl = document.getElementById('suggestion-wrapper');
    const suggestionInputEl = document.getElementById('suggestion-input');
    const confirmSuggestionBtnEl = document.getElementById('confirm-suggestion-btn');
    const cancelSuggestionBtnEl = document.getElementById('cancel-suggestion-btn');

    originalUploadEl.addEventListener('click', () => originalFileInputEl.click());
    originalFileInputEl.addEventListener('change', (e) => handleSingleFile(e, 'original'));

    backgroundUploadEl.addEventListener('click', () => backgroundFileInputEl.click());
    backgroundFileInputEl.addEventListener('change', (e) => handleSingleFile(e, 'background'));
    
    [backgroundPromptInputEl, originalFileInputEl, backgroundFileInputEl].forEach(el => {
        el.addEventListener('input', updateChangeBackgroundBtnState);
        el.addEventListener('change', updateChangeBackgroundBtnState);
    });

    changeBackgroundBtnEl.addEventListener('click', handleChangeBackgroundClick);

    generateBgPromptBtnEl.addEventListener('click', () => {
        if (!originalImage) {
            alert("Vui lòng tải lên ảnh gốc trước.");
            return;
        }
        generateBgPromptBtnEl.classList.add('hidden');
        suggestionWrapperEl.classList.remove('hidden');
        suggestionInputEl.focus();
    });

    cancelSuggestionBtnEl.addEventListener('click', () => {
        suggestionWrapperEl.classList.add('hidden');
        generateBgPromptBtnEl.classList.remove('hidden');
        suggestionInputEl.value = '';
    });

    confirmSuggestionBtnEl.addEventListener('click', () => handleGenerateBackgroundPromptClick(suggestionInputEl.value));
    suggestionInputEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') handleGenerateBackgroundPromptClick(suggestionInputEl.value);
    });

    renderSingleImagePreview('original');
    renderSingleImagePreview('background');
    updateChangeBackgroundBtnState();
}

async function handleSingleFile(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    const id = `file-${Date.now()}`;
    const fileData = { file, base64, id };

    if (type === 'original') originalImage = fileData;
    else if (type === 'background') backgroundImage = fileData;
    
    renderSingleImagePreview(type);
    updateChangeBackgroundBtnState();
}

function renderSingleImagePreview(type) {
    const containerEl = document.getElementById(`${type}-image-preview`);
    if (!containerEl) return;

    let imageData = null;
    let placeholderText = '';
    if (type === 'original') {
        imageData = originalImage;
        placeholderText = 'Tải ảnh gốc';
    } else {
        imageData = backgroundImage;
        placeholderText = 'Tải ảnh nền';
    }

    if (imageData) {
        containerEl.innerHTML = `
            <img src="${imageData.base64}" alt="${imageData.file.name}" class="single-preview-img"/>
            <button class="remove-btn" data-type="${type}" aria-label="Remove image">&times;</button>
        `;
        containerEl.querySelector('.remove-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (type === 'original') originalImage = null;
            else if (type === 'background') backgroundImage = null;
            renderSingleImagePreview(type);
            updateChangeBackgroundBtnState();
        });
    } else {
        containerEl.innerHTML = `<p>${placeholderText}</p>`;
    }
}

export function updateChangeBackgroundBtnState() {
    const btn = document.getElementById('change-background-btn');
    const promptEl = document.getElementById('background-prompt-input');
    if (!btn || !promptEl) return;

    promptEl.disabled = !!backgroundImage;
    if (backgroundImage) promptEl.value = '';

    const hasOriginal = !!originalImage;
    const hasBackground = !!backgroundImage;
    const hasPrompt = promptEl.value.trim() !== '';
    const hasQuota = getQuotaState('generate').count > 0;

    btn.disabled = isLoading || !hasOriginal || (!hasBackground && !hasPrompt) || !hasQuota;
    btn.title = !hasQuota ? 'Bạn đã hết lượt tạo ảnh trong phút này.' : '';
}

async function handleGenerateBackgroundPromptClick(suggestion = "") {
    if (!originalImage) return;

    setIsLoading(true);
    const generateBtn = document.getElementById('generate-bg-prompt-btn');
    const suggestionWrapperEl = document.getElementById('suggestion-wrapper');
    const promptButtonsEl = generateBtn.parentElement;
    
    suggestionWrapperEl.classList.add('hidden');
    const spinner = document.createElement('span');
    spinner.className = 'small-spinner';
    promptButtonsEl.appendChild(spinner);
    updateChangeBackgroundBtnState();

    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const imagePart = { inlineData: { data: originalImage.base64.split(',')[1], mimeType: originalImage.file.type } };
        const textPart = { text: `Analyze the subject in this image. Create a detailed, professional photography background prompt that would complement the subject. The user suggested: "${suggestion}". The background should be realistic and harmonious with the subject's lighting and style. Only return the prompt text.` };

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [imagePart, textPart] } });

        const promptEl = document.getElementById('background-prompt-input');
        if(promptEl) {
            promptEl.value = response.text;
            promptEl.dispatchEvent(new Event('input')); 
        }
    } catch (error) {
        console.error("Error generating background prompt:", error);
        alert(`Không thể tạo mô tả: ${error.message}`);
    } finally {
        setIsLoading(false);
        spinner.remove();
        document.getElementById('suggestion-input').value = '';
        generateBtn.classList.remove('hidden');
        updateChangeBackgroundBtnState();
    }
}

export async function handleChangeBackgroundClick() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    
    if (isLoading || !originalImage) return;
    setIsLoading(true);
    updateChangeBackgroundBtnState();
    const outputEl = document.getElementById('output');
    outputEl.innerHTML = `<div class="spinner"></div><p>Đang thay đổi nền... Việc này có thể mất một chút thời gian.</p>`;

    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const promptEl = document.getElementById('background-prompt-input');
        
        const parts = [{ inlineData: { data: originalImage.base64.split(',')[1], mimeType: originalImage.file.type } }];
        let backgroundInstruction = '';

        if (backgroundImage) {
            parts.push({ inlineData: { data: backgroundImage.base64.split(',')[1], mimeType: backgroundImage.file.type } });
            backgroundInstruction = "using the second image provided as the new background.";
        } else {
            backgroundInstruction = `placing the subject into a new background described as: "${promptEl.value}".`;
        }

        const instructionText = `**ROLE: Professional Photo Editor.**\n**TASK:** Your task is to expertly replace the background of the first image (the original subject). You must meticulously cut out the subject and place it seamlessly into the new background.\n**INSTRUCTIONS:**\n1. Identify and isolate the primary subject(s) from the first image.\n2. Place the isolated subject(s) into the new context ${backgroundInstruction}\n3. **Crucially, you must create a photorealistic final image.** This means harmonizing lighting, shadows, color grading, and perspective between the subject and the new background. The final result should look like a single, professionally taken photograph, not a composite.`;
        parts.push({ text: instructionText });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: parts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        
        useQuota('generate');
        const { textContent, errorMessage, imageUrl } = processImageGenerationResponse(response);
        let outputHtml = '';
        setLastGeneratedImageUrl(null);

        if (imageUrl) {
            setLastGeneratedImageUrl(imageUrl);
            outputHtml = `<img src="${imageUrl}" alt="Generated Image" class="generated-image">`;
        }
        
        renderOutput(outputHtml + textContent + errorMessage);

    } catch (error) {
        setLastGeneratedImageUrl(null);
        renderOutput(getApiErrorMessage(error));
    } finally {
        setIsLoading(false);
        updateChangeBackgroundBtnState();
    }
}