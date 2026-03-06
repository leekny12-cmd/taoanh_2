import { GoogleGenAI, Modality } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl } from '../shared/state.js';
import { fileToBase64, getApiErrorMessage, processImageGenerationResponse } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';

// Module-level state
let inpaintImage = null;
let inpaintDisplayCanvas = null;
let inpaintMaskCanvas = null;
let inpaintOriginalImage = null;
let isDrawing = false;
let brushSize = 30;
let undoStack = [];

export function renderInpaintTab(container) {
    container.innerHTML = `
        <div class="upload-group">
            <label>Tải ảnh và tô màu vùng cần chỉnh sửa</label>
            <div id="inpaint-image-upload" class="drop-zone large" role="button" tabindex="0">
                <div id="inpaint-image-preview" class="single-preview-container large"><p>Tải ảnh lên</p></div>
                <input type="file" id="inpaint-file-input" accept="image/*" hidden>
            </div>
        </div>
        <div id="inpaint-canvas-wrapper" class="hidden">
            <canvas id="inpaint-display-canvas"></canvas>
        </div>
        <div id="inpaint-tools" class="inpaint-tools-container hidden">
            <div class="tool">
                <label for="brush-size">Cỡ cọ: <span id="brush-size-value">${brushSize}</span></label>
                <input type="range" id="brush-size" min="5" max="100" value="${brushSize}" step="1">
            </div>
            <div class="tool-buttons">
                <button id="undo-btn" class="action-btn small">Hoàn tác</button>
                <button id="clear-mask-btn" class="action-btn small">Xóa vùng chọn</button>
            </div>
        </div>
        <div class="prompt-header"><label for="inpaint-prompt-input">Mô tả vùng cần chỉnh sửa</label></div>
        <textarea id="inpaint-prompt-input" placeholder="Ví dụ: Thêm một chiếc mũ cao bồi"></textarea>
        <button id="inpaint-btn" disabled>Chỉnh sửa ảnh</button>
    `;

    const inpaintUploadEl = document.getElementById('inpaint-image-upload');
    const inpaintFileInputEl = document.getElementById('inpaint-file-input');
    const inpaintBtnEl = document.getElementById('inpaint-btn');
    const inpaintPromptEl = document.getElementById('inpaint-prompt-input');
    
    inpaintUploadEl.addEventListener('click', () => inpaintFileInputEl.click());
    inpaintFileInputEl.addEventListener('change', handleSingleFile);
    inpaintBtnEl.addEventListener('click', handleInpaintClick);
    inpaintPromptEl.addEventListener('input', updateInpaintButtonState);

    if (inpaintImage) {
        initializeInpaintCanvas(inpaintImage);
    }
    updateInpaintButtonState();
}

async function handleSingleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    inpaintImage = { file, base64, id: `file-${Date.now()}` };
    
    initializeInpaintCanvas(inpaintImage);
    updateInpaintButtonState();
}

function initializeInpaintCanvas(fileData) {
    const uploadZone = document.getElementById('inpaint-image-upload');
    const canvasWrapper = document.getElementById('inpaint-canvas-wrapper');
    const tools = document.getElementById('inpaint-tools');
    
    uploadZone.classList.add('hidden');
    canvasWrapper.classList.remove('hidden');
    tools.classList.remove('hidden');

    inpaintDisplayCanvas = document.getElementById('inpaint-display-canvas');
    inpaintMaskCanvas = document.createElement('canvas');
    inpaintOriginalImage = new Image();
    
    inpaintOriginalImage.onload = () => {
        if (!inpaintOriginalImage || !inpaintDisplayCanvas || !inpaintMaskCanvas) return;
        const scale = Math.min(1, inpaintDisplayCanvas.parentElement.clientWidth / inpaintOriginalImage.width);
        const canvasWidth = inpaintOriginalImage.width * scale;
        const canvasHeight = inpaintOriginalImage.height * scale;

        inpaintDisplayCanvas.width = inpaintMaskCanvas.width = canvasWidth;
        inpaintDisplayCanvas.height = inpaintMaskCanvas.height = canvasHeight;
        inpaintDisplayCanvas.getContext('2d').drawImage(inpaintOriginalImage, 0, 0, canvasWidth, canvasHeight);
        undoStack = [];
    };
    inpaintOriginalImage.src = fileData.base64;

    ['mousedown', 'touchstart'].forEach(evt => inpaintDisplayCanvas.addEventListener(evt, startDraw, { passive: false }));
    ['mousemove', 'touchmove'].forEach(evt => inpaintDisplayCanvas.addEventListener(evt, draw, { passive: false }));
    ['mouseup', 'mouseleave', 'touchend'].forEach(evt => inpaintDisplayCanvas.addEventListener(evt, stopDraw));

    const brushSizeSlider = document.getElementById('brush-size');
    const brushSizeValue = document.getElementById('brush-size-value');
    brushSizeSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value, 10);
        brushSizeValue.textContent = String(brushSize);
    });
    
    document.getElementById('undo-btn').addEventListener('click', handleUndo);
    document.getElementById('clear-mask-btn').addEventListener('click', handleClearMask);

    if (!canvasWrapper.querySelector('.remove-btn')) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.setAttribute('aria-label', 'Remove image');
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '5px';
        removeBtn.style.right = '5px';
        canvasWrapper.appendChild(removeBtn);
        removeBtn.addEventListener('click', () => {
            inpaintImage = null; inpaintOriginalImage = null; inpaintDisplayCanvas = null; inpaintMaskCanvas = null; undoStack = [];
            uploadZone.classList.remove('hidden');
            canvasWrapper.classList.add('hidden');
            tools.classList.add('hidden');
            canvasWrapper.removeChild(removeBtn);
            updateInpaintButtonState();
        });
    }
}

function getEventPosition(event) {
    const rect = inpaintDisplayCanvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    return {
        x: (touch || event).clientX - rect.left,
        y: (touch || event).clientY - rect.top
    };
}

function startDraw(event) {
    event.preventDefault();
    if (!inpaintMaskCanvas) return;
    isDrawing = true;
    const maskCtx = inpaintMaskCanvas.getContext('2d');
    undoStack.push(maskCtx.getImageData(0, 0, inpaintMaskCanvas.width, inpaintMaskCanvas.height));
    if (undoStack.length > 10) undoStack.shift();
    draw(event);
}

function stopDraw() {
    if (isDrawing) {
        isDrawing = false;
        updateInpaintButtonState();
    }
}

function draw(event) {
    if (!isDrawing || !inpaintMaskCanvas) return;
    event.preventDefault();
    const maskCtx = inpaintMaskCanvas.getContext('2d');
    const pos = getEventPosition(event);
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    maskCtx.fill();
    redrawDisplay();
}

function redrawDisplay() {
    if (!inpaintDisplayCanvas || !inpaintOriginalImage || !inpaintMaskCanvas) return;
    const displayCtx = inpaintDisplayCanvas.getContext('2d');
    displayCtx.clearRect(0, 0, inpaintDisplayCanvas.width, inpaintDisplayCanvas.height);
    displayCtx.drawImage(inpaintOriginalImage, 0, 0, inpaintDisplayCanvas.width, inpaintDisplayCanvas.height);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = inpaintMaskCanvas.width;
    tempCanvas.height = inpaintMaskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(inpaintMaskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    displayCtx.drawImage(tempCanvas, 0, 0);
}

function handleUndo() {
    if (undoStack.length > 0 && inpaintMaskCanvas) {
        inpaintMaskCanvas.getContext('2d').putImageData(undoStack.pop(), 0, 0);
        redrawDisplay();
        updateInpaintButtonState();
    }
}

function handleClearMask() {
    if (inpaintMaskCanvas) {
        const maskCtx = inpaintMaskCanvas.getContext('2d');
        undoStack.push(maskCtx.getImageData(0, 0, inpaintMaskCanvas.width, inpaintMaskCanvas.height));
        if (undoStack.length > 10) undoStack.shift();
        maskCtx.clearRect(0, 0, inpaintMaskCanvas.width, inpaintMaskCanvas.height);
        redrawDisplay();
        updateInpaintButtonState();
    }
}

export function updateInpaintButtonState() {
    const btn = document.getElementById('inpaint-btn');
    const promptEl = document.getElementById('inpaint-prompt-input');
    if (!btn || !promptEl || !inpaintMaskCanvas) return;

    const maskData = inpaintMaskCanvas.getContext('2d').getImageData(0, 0, inpaintMaskCanvas.width, inpaintMaskCanvas.height).data;
    let hasDrawing = false;
    for (let i = 3; i < maskData.length; i += 4) {
        if (maskData[i] > 0) { hasDrawing = true; break; }
    }

    const hasQuota = getQuotaState('generate').count > 0;
    btn.disabled = isLoading || !inpaintImage || !promptEl.value.trim() || !hasDrawing || !hasQuota;
    btn.title = !hasQuota ? 'Bạn đã hết lượt tạo ảnh trong phút này.' : '';
}

export async function handleInpaintClick() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    
    if (isLoading || !inpaintImage || !inpaintMaskCanvas) return;

    const promptEl = document.getElementById('inpaint-prompt-input');
    if (!promptEl?.value.trim()) return;

    setIsLoading(true);
    updateInpaintButtonState();
    const outputEl = document.getElementById('output');
    outputEl.innerHTML = `<div class="spinner"></div><p>Đang chỉnh sửa ảnh... Việc này có thể mất một chút thời gian.</p>`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const maskBase64 = inpaintMaskCanvas.toDataURL('image/png').split(',')[1];
        const originalImagePart = { inlineData: { data: inpaintImage.base64.split(',')[1], mimeType: inpaintImage.file.type } };
        const maskImagePart = { inlineData: { data: maskBase64, mimeType: 'image/png' } };
        const prompt = `**ROLE:** AI Photo Inpainting Expert.\n**TASK:** You are given an original image and a mask image. Your task is to modify ONLY the area of the original image that corresponds to the non-transparent parts of the mask image. The rest of the image must remain untouched.\n**MODIFICATION:** The change to make in the masked area is: "${promptEl.value}".\n**IMPORTANT:** The final result must be a seamless, photorealistic blend. The modified area should match the lighting, texture, and style of the surrounding original image.\n**OUTPUT:** Return only the final edited image.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [originalImagePart, maskImagePart, { text: prompt }] },
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
        updateInpaintButtonState();
    }
}