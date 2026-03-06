/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from '@google/genai';
import { getQuotaState, useQuota, QUOTA_CONFIG } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl, FACE_PROMPT_TEXT } from '../shared/state.js';
import { fileToBase64, applyWatermark, getApiErrorMessage, processImageGenerationResponse, frameImageInAspectRatio } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';


// Module-level state
let uploadedFiles = [];

// DOM Element references for this tab
let imageUploadEl;
let imagePreviewEl;
let promptInputEl;
let generateBtnEl;
let fileInputEl;
let clearPromptBtnEl;
let cutPromptBtnEl;
let img2promptBtnEl;
let keepFaceCheckboxEl;
let keepFaceSectionEl;

export function renderGenerateTab(container) {
    container.innerHTML = `
        <div id="image-upload" class="drop-zone small" role="button" tabindex="0" aria-label="Vùng tải ảnh lên">
            <p>Kéo và thả ảnh vào đây, hoặc nhấn để chọn tệp</p>
            <input type="file" id="file-input" accept="image/*" multiple hidden>
        </div>
        <div id="image-preview" class="preview-container" aria-live="polite"></div>
        <div class="prompt-header">
            <label id="prompt-input-label" for="prompt-input">Mô tả</label>
            <div class="prompt-buttons">
                <button id="img2prompt-btn" class="action-btn" aria-label="Tạo mô tả từ ảnh">IMG2PROMPT</button>
                <button id="cut-prompt-btn" class="action-btn" aria-label="Cắt mô tả (Ctrl+X)">CẮT</button>
                <button id="clear-prompt-btn" aria-label="Xóa mô tả">XÓA</button>
            </div>
        </div>
        <textarea id="prompt-input" placeholder="Ví dụ: Một chú mèo oai vệ đội mũ dự tiệc" aria-labelledby="prompt-input-label"></textarea>
        <div class="generation-options">
             <div class="aspect-ratio-group">
                <label for="generate-aspect-ratio">Tỉ lệ ảnh</label>
                <select id="generate-aspect-ratio">
                    <option value="3:4">Chân dung (3:4)</option>
                    <option value="4:3">Ngang (4:3)</option>
                    <option value="1:1">Vuông (1:1)</option>
                    <option value="9:16">Dọc (9:16)</option>
                    <option value="16:9">Rộng (16:9)</option>
                </select>
            </div>
            <div id="keep-face-section" class="checkbox-section hidden">
                <input type="checkbox" id="keep-face-checkbox">
                <label for="keep-face-checkbox">Giữ khuôn mặt</label>
            </div>
            <div class="checkbox-section">
                <input type="checkbox" id="watermark-checkbox">
                <label for="watermark-checkbox">Watermark</label>
            </div>
        </div>
        <button id="generate-btn" disabled>Tạo ảnh</button>
    `;

    imageUploadEl = document.getElementById('image-upload');
    imagePreviewEl = document.getElementById('image-preview');
    promptInputEl = document.getElementById('prompt-input');
    generateBtnEl = document.getElementById('generate-btn');
    fileInputEl = document.getElementById('file-input');
    clearPromptBtnEl = document.getElementById('clear-prompt-btn');
    cutPromptBtnEl = document.getElementById('cut-prompt-btn');
    img2promptBtnEl = document.getElementById('img2prompt-btn');
    keepFaceCheckboxEl = document.getElementById('keep-face-checkbox');
    keepFaceSectionEl = document.getElementById('keep-face-section');

    imageUploadEl.addEventListener('click', () => fileInputEl.click());
    fileInputEl.addEventListener('change', handleFileSelect);
    imageUploadEl.addEventListener('dragover', handleDragOver);
    imageUploadEl.addEventListener('dragleave', handleDragLeave);
    imageUploadEl.addEventListener('drop', handleDrop);
    promptInputEl.addEventListener('input', updateGenerateButtonState);
    generateBtnEl.addEventListener('click', handleGenerateClick);
    clearPromptBtnEl.addEventListener('click', handleClearPromptClick);
    cutPromptBtnEl.addEventListener('click', handleCutPromptClick);
    img2promptBtnEl.addEventListener('click', handleImg2PromptClick);

    renderImagePreviews();
    updateGenerateButtonState();
}

function handleCutPromptClick() {
    if (!promptInputEl) return;
    const textToCut = promptInputEl.value;
    if (textToCut) {
        navigator.clipboard.writeText(textToCut).then(() => {
            promptInputEl.value = '';
            promptInputEl.dispatchEvent(new Event('input'));
        }).catch(err => {
            console.error('Không thể cắt văn bản: ', err);
            alert('Không thể truy cập clipboard để cắt. Vui lòng kiểm tra quyền của trình duyệt.');
        });
    }
}

function handleClearPromptClick() {
    if (promptInputEl) {
        promptInputEl.value = '';
        promptInputEl.dispatchEvent(new Event('input'));
    }
}

async function handleImg2PromptClick() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    if (isLoading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        updateGenerateButtonState();
        const originalText = img2promptBtnEl.innerHTML;
        img2promptBtnEl.innerHTML = `<span class="small-spinner"></span> Đang đọc...`;

        try {
            const base64 = await fileToBase64(file);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const imagePart = {
                inlineData: {
                    data: base64.split(',')[1],
                    mimeType: file.type
                }
            };

            const textPart = {
                text: `Phân tích: Bối cảnh, Ánh sáng, màu sắc, phong cách nghệ thuật, hiệu ứng hình ảnh, bố cục, Góc máy, Dáng pose, trang phục, phụ kiện (nếu có) của hình ảnh này để tạo ra một prompt chi tiết cho việc tạo ảnh AI. Prompt nên nắm bắt được Bối cảnh, Ánh sáng, màu sắc, phong cách nghệ thuật, hiệu ứng hình ảnh, bố cục, Góc máy, Dáng pose, trang phục, phụ kiện. **Điều quan trọng: không mô tả bất kỳ đặc điểm thể chất, đặc điểm khuôn mặt hoặc danh tính của người trong ảnh.** Mục tiêu là tạo ra một prompt có thể được sử dụng với một ảnh tham chiếu khác để tạo ra một hình ảnh theo cùng phong cách. Chỉ trả về văn bản prompt.`
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] }
            });

            useQuota('generate');

            if (response.text) {
                promptInputEl.value = response.text.trim();
                promptInputEl.dispatchEvent(new Event('input')); // To update button state
            } else {
                alert('Không thể tạo mô tả từ ảnh. Vui lòng thử lại.');
            }

        } catch (error) {
            console.error("Error during Img2Prompt:", error);
            alert(`Đã xảy ra lỗi khi tạo mô tả: ${error.message}`);
        } finally {
            setIsLoading(false);
            img2promptBtnEl.innerHTML = originalText;
            updateGenerateButtonState();
        }
    };
    input.click();
}


function handleFileSelect(event) {
    const target = event.target;
    if (target.files) {
        handleFiles(Array.from(target.files));
    }
}

function handleDragOver(event) {
    event.preventDefault();
    imageUploadEl?.classList.add('active');
}

function handleDragLeave(event) {
    event.preventDefault();
    imageUploadEl?.classList.remove('active');
}

function handleDrop(event) {
    event.preventDefault();
    imageUploadEl?.classList.remove('active');
    if (event.dataTransfer?.files) {
        handleFiles(Array.from(event.dataTransfer.files));
    }
}

async function handleFiles(files) {
    const wasEmpty = uploadedFiles.length === 0;
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    for (const file of imageFiles) {
        const base64 = await fileToBase64(file);
        const id = `file-${Date.now()}-${Math.random()}`;
        uploadedFiles.push({ file, base64, id, selected: true });
    }

    renderImagePreviews();
    updateGenerateButtonState();
}

function renderImagePreviews() {
    if (!imagePreviewEl) return;
    imagePreviewEl.innerHTML = '';
    uploadedFiles.forEach(fileData => {
        const previewItem = document.createElement('div');
        previewItem.className = `preview-item ${fileData.selected ? 'selected' : ''}`;
        previewItem.setAttribute('aria-selected', fileData.selected);
        previewItem.setAttribute('role', 'option');
        previewItem.innerHTML = `
            <img src="${fileData.base64}" alt="${fileData.file.name}" />
            <div class="selection-tick">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9,16.17L4.83,12l-1.42,1.41L9,19 21,7l-1.41-1.41L9,16.17z"></path></svg>
            </div>
            <button class="remove-btn" data-id="${fileData.id}" aria-label="Remove ${fileData.file.name}">&times;</button>
        `;
        previewItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                return;
            }
            e.stopPropagation();
            toggleFileSelection(fileData.id);
        });

        previewItem.querySelector('.remove-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFile(fileData.id)
        });
        imagePreviewEl.appendChild(previewItem);
    });
}

function toggleFileSelection(id) {
    const file = uploadedFiles.find(f => f.id === id);
    if (file) {
        file.selected = !file.selected;
    }
    renderImagePreviews();
    updateGenerateButtonState();
}

function removeFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    renderImagePreviews();
    updateGenerateButtonState();
}

export function updateGenerateButtonState() {
    if (!generateBtnEl || !promptInputEl) return;

    if (keepFaceSectionEl) {
        const hasImages = uploadedFiles.length > 0;
        keepFaceSectionEl.classList.toggle('hidden', !hasImages);
    }

    if (img2promptBtnEl) {
        img2promptBtnEl.disabled = isLoading;
    }

    const quotaType = 'generate';
    const hasQuota = getQuotaState(quotaType).count > 0;

    generateBtnEl.disabled = promptInputEl.value.trim() === '' || isLoading || !hasQuota;
    generateBtnEl.title = !hasQuota ? `Bạn đã hết lượt tạo ảnh trong phút này.` : '';
}

export async function handleGenerateClick() {
    if (isLoading || !promptInputEl) return;

    const quotaType = 'generate';
    const quotaState = getQuotaState(quotaType);

    if (quotaState.count <= 0) {
        const timeLeft = Math.ceil((quotaState.resetTime - Date.now()) / 1000);
        alert(`Bạn đã hết lượt ${QUOTA_CONFIG[quotaType].name}. Vui lòng thử lại sau ${timeLeft} giây.`);
        return;
    }

    setIsLoading(true);
    updateGenerateButtonState();
    const outputEl = document.getElementById('output');
    outputEl.innerHTML = `<div class="spinner"></div><p>Đang tạo ảnh... Việc này có thể mất một chút thời gian.</p>`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const watermarkCheckbox = document.getElementById('watermark-checkbox');
        const selectedFiles = uploadedFiles.filter(f => f.selected);
        const isEditing = selectedFiles.length > 0;
        const aspectRatio = document.getElementById('generate-aspect-ratio').value;
        
        const imageParts = await Promise.all(selectedFiles.map(async (fileData) => {
            const framedBase64 = await frameImageInAspectRatio(fileData.base64, aspectRatio);
            return {
                inlineData: {
                    data: framedBase64.split(',')[1],
                    mimeType: 'image/png' // Always PNG because of transparency
                }
            };
        }));
        
        let finalPrompt = promptInputEl.value;

        // Add keep face prompt only when editing
        if (isEditing && keepFaceCheckboxEl && keepFaceCheckboxEl.checked) {
            finalPrompt = `${FACE_PROMPT_TEXT}\n\n${finalPrompt}`;
        }
        
        outputEl.innerHTML = `<div class="spinner"></div><p>Đang gửi yêu cầu đến AI...</p>`;
        const textPart = { text: finalPrompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [...imageParts, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        useQuota('generate');

        const { textContent, errorMessage, imageUrl: imageUrlFromApi } = processImageGenerationResponse(response);

        let outputHtml = '';
        setLastGeneratedImageUrl(null);

        if (imageUrlFromApi) {
            const finalImageUrl = (watermarkCheckbox && watermarkCheckbox.checked) ? await applyWatermark(imageUrlFromApi) : imageUrlFromApi;
            setLastGeneratedImageUrl(finalImageUrl);
            outputHtml = `<img src="${finalImageUrl}" alt="Generated Image" class="generated-image">`;
        }

        renderOutput(outputHtml + textContent + errorMessage);

    } catch (error) {
        setLastGeneratedImageUrl(null);
        renderOutput(getApiErrorMessage(error));
    } finally {
        setIsLoading(false);
        updateGenerateButtonState();
    }
}