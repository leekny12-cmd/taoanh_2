import { GoogleGenAI, Modality } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl } from '../shared/state.js';
import { fileToBase64, getApiErrorMessage, processImageGenerationResponse } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';

// Module-level state
let restorationImage = null;

export function renderRestoreTab(container) {
    container.innerHTML = `
        <div class="upload-group">
            <label>Tải ảnh cũ, hư hại</label>
            <div id="restoration-image-upload" class="drop-zone" role="button" tabindex="0">
                <div id="restoration-image-preview" class="single-preview-container large"><p>Tải ảnh để phục hồi</p></div>
                <input type="file" id="restoration-file-input" accept="image/*" hidden>
            </div>
        </div>
        <div class="options-grid">
             <div class="checkbox-section">
                <input type="checkbox" id="colorize-checkbox">
                <label for="colorize-checkbox">Tô màu</label>
            </div>
             <div class="checkbox-section">
                <input type="checkbox" id="face-rotate-checkbox">
                <label for="face-rotate-checkbox">Xoay mặt (chính diện)</label>
            </div>
        </div>
        <div class="outfit-section">
            <label for="outfit-select">Thay trang phục (tùy chọn)</label>
            <div class="outfit-controls">
                 <select id="outfit-select">
                    <option value="none">Không thay đổi</option>
                    <option value="Vest nam">Vest nam</option>
                    <option value="Vest nữ">Vest nữ</option>
                    <option value="Áo dài Việt Nam">Áo dài Việt Nam</option>
                    <option value="Áo sơ mi">Áo sơ mi</option>
                    <option value="custom">Khác (nhập bên dưới)</option>
                </select>
                <textarea id="custom-outfit-input" class="hidden" placeholder="Mô tả trang phục bạn muốn..."></textarea>
            </div>
        </div>
        <button id="restore-btn" disabled>Phục hồi ảnh</button>
    `;
    
    const restorationUploadEl = document.getElementById('restoration-image-upload');
    const restorationFileInputEl = document.getElementById('restoration-file-input');
    const restoreBtnEl = document.getElementById('restore-btn');
    const outfitSelectEl = document.getElementById('outfit-select');
    const customOutfitInputEl = document.getElementById('custom-outfit-input');

    restorationUploadEl.addEventListener('click', () => restorationFileInputEl.click());
    restorationFileInputEl.addEventListener('change', handleSingleFile);
    restoreBtnEl.addEventListener('click', handleRestoreClick);
    
    outfitSelectEl.addEventListener('change', () => {
        customOutfitInputEl.classList.toggle('hidden', outfitSelectEl.value !== 'custom');
    });

    renderSingleImagePreview();
    updateRestoreButtonState();
}

async function handleSingleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    restorationImage = { file, base64, id: `file-${Date.now()}` };
    
    renderSingleImagePreview();
    updateRestoreButtonState();
}

function renderSingleImagePreview() {
    const containerEl = document.getElementById('restoration-image-preview');
    if (!containerEl) return;

    if (restorationImage) {
        containerEl.innerHTML = `
            <img src="${restorationImage.base64}" alt="${restorationImage.file.name}" class="single-preview-img"/>
            <button class="remove-btn" aria-label="Remove image">&times;</button>
        `;
        containerEl.querySelector('.remove-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            restorationImage = null;
            renderSingleImagePreview();
            updateRestoreButtonState();
        });
    } else {
        containerEl.innerHTML = `<p>Tải ảnh để phục hồi</p>`;
    }
}

export function updateRestoreButtonState() {
     const btn = document.getElementById('restore-btn');
     if (!btn) return;
     const hasQuota = getQuotaState('generate').count > 0;
     btn.disabled = isLoading || !restorationImage || !hasQuota;
     btn.title = !hasQuota ? 'Bạn đã hết lượt tạo ảnh trong phút này.' : '';
}

export async function handleRestoreClick() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }

    if (isLoading || !restorationImage) return;
    setIsLoading(true);
    updateRestoreButtonState();
    const outputEl = document.getElementById('output');
    outputEl.innerHTML = `<div class="spinner"></div><p>Đang phục hồi ảnh... Việc này có thể mất một chút thời gian.</p>`;

    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const colorizeEl = document.getElementById('colorize-checkbox');
        const faceRotateEl = document.getElementById('face-rotate-checkbox');
        const outfitSelectEl = document.getElementById('outfit-select');
        const customOutfitInputEl = document.getElementById('custom-outfit-input');

        let prompt = `**ROLE:** You are a world-class expert in digital photo restoration and enhancement.\n**PRIMARY GOAL:** Your primary task is to restore the provided old/damaged photograph. The final result must be sharp, clear, and look as if it were taken with a modern, high-end professional camera. This includes fixing scratches, removing noise, and improving details.\n**ABSOLUTE CONSTRAINT: THE MOST IMPORTANT RULE:** You must preserve the absolute identity and likeness of any person in the photograph. The restored face and features must be 100% identical to the original, only enhanced in clarity and quality. DO NOT alter their identity.\n**MOST REQUIRED:** Retain 100% of the facial features of the person in the original photo. **USE THE UPLOADED IMAGE AS THE MOST ACCURATE REFERENCE FOR THE FACE.** Absolutely do not change the lines, eyes, nose, mouth. Photorealistic studio portrait. Skin shows fine micro-texture and subtle subsurface scattering; eyes tack sharp; hairline blends cleanly with individual strands and natural fly away. Fabric shows authentic weave, seams and natural wrinkles; metals reflect with tiny imperfections. Lighting coherent with scene; natural shadow falloff on cheekbone, jawline and nose. Background has believable micro-details; avoid CGI-clean look. 85mm equivalent, f/2.0 to f/2.8; subject tack sharp, cinematic color grade; confident posture, slight asymmetry.`;
        if (colorizeEl.checked) prompt += `\n- **ADDITIONAL TASK: Colorize:** Professionally colorize this photograph. The colors should be realistic, natural, and appropriate for the scene. Skin tones must be lifelike.`;
        if (faceRotateEl.checked) prompt += `\n- **ADDITIONAL TASK: Face Rotation:** The photo contains one person. You must adjust their pose to be front-facing. This rotation must be subtle and natural, while strictly adhering to the **ABSOLUTE CONSTRAINT** of preserving their exact facial identity.`;
        
        let outfitSelection = outfitSelectEl.value === 'custom' ? customOutfitInputEl.value : outfitSelectEl.value;
        if (outfitSelection !== 'none' && outfitSelection.trim() !== '') {
            prompt += `\n- **ADDITIONAL TASK: Change Outfit:** Replace the original clothing of the main subject with a '${outfitSelection}'. The new outfit must be seamlessly integrated, with realistic lighting, shadows, and fabric texture that matches the restored image's quality. Ensure the new clothing fits the subject's posture and body shape naturally.`;
        }
        prompt += `\n**FINAL OUTPUT FORMAT:** The output must be only the final, restored image.`;

        const imagePart = { inlineData: { data: restorationImage.base64.split(',')[1], mimeType: restorationImage.file.type } };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, {text: prompt}] },
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
        updateRestoreButtonState();
    }
}