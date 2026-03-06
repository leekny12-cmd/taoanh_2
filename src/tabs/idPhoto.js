/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl } from '../shared/state.js';
import { fileToBase64, getApiErrorMessage, processImageGenerationResponse } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';
import { PHOTO_SPEC_OPTIONS } from './idPhotoSpecs.js';

let idPhotoImage = null; // Stores { file, base64, imageObject, displayUrl }
let customOutfitImage = null; // Stores { file, base64, imageObject }

export function renderIdPhotoTab(container) {
    // Populate spec options, grouping by country
    const groupedOptions = PHOTO_SPEC_OPTIONS.reduce((acc, spec) => {
        if (!acc[spec.country]) {
            acc[spec.country] = [];
        }
        acc[spec.country].push(spec);
        return acc;
    }, {});

    const specOptionsHtml = Object.keys(groupedOptions).sort().map(country => {
        const options = groupedOptions[country].map(spec => 
            `<option value="${spec.id}">${spec.docType} (${spec.widthCm}x${spec.heightCm}cm)</option>`
        ).join('');
        return `<optgroup label="${country}">${options}</optgroup>`;
    }).join('');

    container.innerHTML = `
        <div id="id-photo-upload-zone" class="drop-zone large" role="button" tabindex="0">
            <p>Tải ảnh chân dung của bạn. Để có kết quả tốt nên chụp ảnh từ chính diện, rõ nét. Nếu để AI can thiệp quá nhiều có thể ảnh tạo ra sẽ không còn giống nhân vật nữa.</p>
            <input type="file" id="id-photo-file-input" accept="image/*" hidden>
        </div>

        <div id="id-photo-editor" class="hidden">
            <div class="upload-group">
                <label>Ảnh gốc đã tải lên</label>
                <div id="id-photo-preview-container">
                     <img id="id-photo-preview-img" alt="Ảnh đã tải lên">
                     <button id="id-photo-remove-btn" class="remove-btn">&times;</button>
                </div>
            </div>
        </div>
        
        <div class="form-group">
            <label for="id-photo-spec">Quốc gia & Loại giấy tờ</label>
            <select id="id-photo-spec">${specOptionsHtml}</select>
        </div>

        <div class="id-photo-grid">
             <div class="form-group">
                <label for="id-photo-bg-color">Màu nền</label>
                 <div class="color-picker-wrapper">
                    <select id="id-photo-bg-color">
                        <option value="Trắng">Trắng</option>
                        <option value="Xám nhạt">Xám</option>
                        <option value="Xanh dương nhạt">Xanh dương nhạt</option>
                        <option value="Xanh dương đậm">Xanh dương đậm</option>
                        <option value="custom">Tùy chọn</option>
                    </select>
                    <input type="color" id="id-photo-bg-color-picker" value="#ffffff" class="hidden">
                </div>
            </div>
            <div class="form-group">
                <label for="id-photo-outfit">Trang phục</label>
                <select id="id-photo-outfit">
                    <option value="giữ nguyên trang phục gốc">Giữ nguyên trang phục gốc</option>
                    <option value="Áo sơ mi trắng">Áo sơ mi</option>
                    <option value="Áo vest nam trang trọng">Áo vest nam</option>
                    <option value="Áo vest nữ công sở">Áo vest nữ</option>
                    <option value="Áo dài truyền thống Việt Nam">Áo dài</option>
                    <option value="Áo sơ mi trắng với khăn quàng đỏ (học sinh Việt Nam)">Áo sơ mi khăn quàng đỏ</option>
                </select>
            </div>
        </div>
         <div class="upload-group">
            <label>Tải ảnh trang phục (tùy chọn)</label>
            <div id="id-photo-outfit-upload-zone" class="drop-zone small" role="button" tabindex="0">
                 <div id="id-photo-outfit-preview" class="single-preview-container"><p>Tải ảnh trang phục</p></div>
                <input type="file" id="id-photo-outfit-file-input" accept="image/*" hidden>
            </div>
        </div>
        <div class="options-grid">
            <div class="checkbox-section"><input type="checkbox" id="id-photo-smooth-skin"><label for="id-photo-smooth-skin">Làm mịn da</label></div>
            <div class="checkbox-section"><input type="checkbox" id="id-photo-tidy-hair"><label for="id-photo-tidy-hair">Tóc gọn gàng</label></div>
        </div>
        <button id="generate-id-photo-btn" disabled>Tạo ảnh thẻ</button>
    `;
    
    document.getElementById('id-photo-upload-zone').addEventListener('click', () => document.getElementById('id-photo-file-input').click());
    document.getElementById('id-photo-file-input').addEventListener('change', handleIdPhotoUpload);
    document.getElementById('id-photo-remove-btn').addEventListener('click', resetIdPhotoState);

    document.getElementById('id-photo-outfit-upload-zone').addEventListener('click', () => document.getElementById('id-photo-outfit-file-input').click());
    document.getElementById('id-photo-outfit-file-input').addEventListener('change', handleOutfitUpload);
    
    const specSelect = document.getElementById('id-photo-spec');
    specSelect.value = 'vn-passport-visa-4x6'; // Default to Vietnam passport
    
    const bgColorSelect = document.getElementById('id-photo-bg-color');
    const bgColorPicker = document.getElementById('id-photo-bg-color-picker');
    bgColorSelect.addEventListener('change', () => bgColorPicker.classList.toggle('hidden', bgColorSelect.value !== 'custom'));

    document.getElementById('generate-id-photo-btn').addEventListener('click', handleIdPhotoClick);
    updateIdPhotoButtonState();
}

async function handleIdPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const base64 = await fileToBase64(file);
        const imageObj = new Image();
        imageObj.onload = async () => {
            // Create a display thumbnail
            const displayUrl = await createDisplayThumbnail(imageObj.src);
            idPhotoImage = { file, base64, imageObject: imageObj, displayUrl };

            document.getElementById('id-photo-upload-zone').classList.add('hidden');
            const editorEl = document.getElementById('id-photo-editor');
            const previewImgEl = document.getElementById('id-photo-preview-img');
            editorEl.classList.remove('hidden');
            previewImgEl.src = idPhotoImage.displayUrl;

            updateIdPhotoButtonState();
        };
        imageObj.src = base64;
    } catch (error) {
        console.error("Error handling image upload:", error);
        alert("Không thể xử lý ảnh. Vui lòng thử ảnh khác.");
    }
}

async function handleOutfitUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const base64 = await fileToBase64(file);
        const imageObj = new Image();
        imageObj.onload = () => {
            customOutfitImage = { file, base64, imageObject: imageObj }; // Store the image object
            renderOutfitPreview();
            updateIdPhotoButtonState();
        };
        imageObj.src = base64;
    } catch (error) {
        console.error("Error handling outfit upload:", error);
        alert("Không thể xử lý ảnh trang phục.");
    }
}

function renderOutfitPreview() {
    const containerEl = document.getElementById('id-photo-outfit-preview');
    if (customOutfitImage) {
        containerEl.innerHTML = `
            <img src="${customOutfitImage.base64}" alt="Ảnh trang phục" class="single-preview-img"/>
            <button class="remove-btn" aria-label="Xóa ảnh trang phục">&times;</button>
        `;
        containerEl.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            customOutfitImage = null;
            renderOutfitPreview();
            updateIdPhotoButtonState();
        });
    } else {
        containerEl.innerHTML = `<p>Tải ảnh trang phục</p>`;
    }
}

function resetIdPhotoState() {
    if (idPhotoImage && idPhotoImage.displayUrl) {
        URL.revokeObjectURL(idPhotoImage.displayUrl);
    }
    idPhotoImage = null;
    document.getElementById('id-photo-upload-zone').classList.remove('hidden');
    document.getElementById('id-photo-editor').classList.add('hidden');
    document.getElementById('id-photo-preview-img').src = '';
    updateIdPhotoButtonState();
}


/**
 * Creates a center-cropped thumbnail for display purposes.
 */
async function createDisplayThumbnail(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const { naturalWidth: w, naturalHeight: h } = img;
            const targetAspectRatio = 3 / 4;
            let cropWidth, cropHeight, cropX, cropY;

            if (w / h > targetAspectRatio) {
                cropHeight = h;
                cropWidth = h * targetAspectRatio;
                cropX = (w - cropWidth) / 2;
                cropY = 0;
            } else {
                cropWidth = w;
                cropHeight = w / targetAspectRatio;
                cropX = 0;
                cropY = (h - cropHeight) / 2;
            }
            
            const canvas = document.createElement('canvas');
            const maxDisplayWidth = 600;
            let displayWidth = cropWidth > maxDisplayWidth ? maxDisplayWidth : cropWidth;
            let displayHeight = (displayWidth / cropWidth) * cropHeight;

            canvas.width = displayWidth;
            canvas.height = displayHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get 2D context.'));

            ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, displayWidth, displayHeight);
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('Canvas toBlob failed.'));
                resolve(URL.createObjectURL(blob));
            }, 'image/jpeg', 0.9);
        };
        img.onerror = () => reject(new Error('Failed to load image for thumbnail.'));
        img.src = imageUrl;
    });
}


export function updateIdPhotoButtonState() {
    const btn = document.getElementById('generate-id-photo-btn');
    if (!btn) return;
    const outfitSelect = document.getElementById('id-photo-outfit');
    if(outfitSelect) outfitSelect.disabled = !!customOutfitImage;
    const hasQuota = getQuotaState('generate').count > 0;
    btn.disabled = isLoading || !idPhotoImage || !hasQuota;
    btn.title = !hasQuota ? 'Bạn đã hết lượt tạo ảnh trong phút này.' : '';
}

async function getFaceBoundingBox(ai, imageBase64) {
    const imagePart = { inlineData: { data: imageBase64.split(',')[1], mimeType: 'image/jpeg' } };
    const prompt = "Phân tích hình ảnh này và trả về một đối tượng JSON duy nhất chứa tọa độ hộp giới hạn được chuẩn hóa (normalized bounding box) của khuôn mặt chính. Đối tượng phải có các khóa: 'x_min', 'y_min', 'x_max', 'y_max'.";
    const schema = {
        type: Type.OBJECT,
        properties: {
            x_min: { type: Type.NUMBER },
            y_min: { type: Type.NUMBER },
            x_max: { type: Type.NUMBER },
            y_max: { type: Type.NUMBER },
        },
        required: ['x_min', 'y_min', 'x_max', 'y_max'],
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } },
    });

    return JSON.parse(response.text);
}

async function cropImageToPassportFrame(imageObject, box, spec) {
    return new Promise((resolve, reject) => {
        const { naturalWidth: w, naturalHeight: h } = imageObject;
        const faceLeft = box.x_min * w, faceTop = box.y_min * h;
        const faceWidth = (box.x_max - box.x_min) * w, faceHeight = (box.y_max - box.y_min) * h;
        const faceCenterX = faceLeft + faceWidth / 2, faceCenterY = faceTop + faceHeight / 2;

        const [aspectW, aspectH] = spec.aspectRatio.split(' / ').map(Number);
        if (!aspectW || !aspectH) return reject(new Error(`Invalid aspect ratio: ${spec.aspectRatio}`));
        const targetAspectRatio = aspectW / aspectH;
        
        const paddingFactor = 3.5;
        const faceLongerDim = Math.max(faceWidth, faceHeight);
        let idealCropWidth, idealCropHeight;

        if (targetAspectRatio >= 1) {
            idealCropWidth = faceLongerDim * paddingFactor;
            idealCropHeight = idealCropWidth / targetAspectRatio;
        } else {
            idealCropHeight = faceLongerDim * paddingFactor;
            idealCropWidth = idealCropHeight * targetAspectRatio;
        }
        
        const maxPossibleCenteredWidth = 2 * Math.min(faceCenterX, w - faceCenterX);
        const maxPossibleCenteredHeight = 2 * Math.min(faceCenterY, h - faceCenterY);
        let finalCropWidth = idealCropWidth, finalCropHeight = idealCropHeight;

        if (finalCropWidth > maxPossibleCenteredWidth) {
            finalCropWidth = maxPossibleCenteredWidth;
            finalCropHeight = finalCropWidth / targetAspectRatio;
        }
        if (finalCropHeight > maxPossibleCenteredHeight) {
            finalCropHeight = maxPossibleCenteredHeight;
            finalCropWidth = finalCropHeight * targetAspectRatio;
        }

        const cropX = faceCenterX - finalCropWidth / 2;
        const cropY = faceCenterY - finalCropHeight / 2;

        const canvas = document.createElement('canvas');
        const maxAiInputSize = 1024;
        let drawWidth = finalCropWidth, drawHeight = finalCropHeight;

        if (drawWidth > maxAiInputSize || drawHeight > maxAiInputSize) {
            if (drawWidth > drawHeight) {
                drawHeight = Math.round(drawHeight * (maxAiInputSize / drawWidth));
                drawWidth = maxAiInputSize;
            } else {
                drawWidth = Math.round(drawWidth * (maxAiInputSize / drawHeight));
                drawHeight = maxAiInputSize;
            }
        }

        canvas.width = drawWidth;
        canvas.height = drawHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get 2D context for cropping.'));

        ctx.drawImage(imageObject, cropX, cropY, finalCropWidth, finalCropHeight, 0, 0, drawWidth, drawHeight);
        resolve(canvas.toDataURL('image/webp', 0.95));
    });
}

async function centerCropImage(imageObject, aspectRatioString) {
    return new Promise((resolve, reject) => {
        const { naturalWidth: w, naturalHeight: h } = imageObject;
        const [aspectW, aspectH] = aspectRatioString.split(' / ').map(Number);
        if (!aspectW || !aspectH) return reject(new Error(`Invalid aspect ratio: ${aspectRatioString}`));
        const targetAspectRatio = aspectW / aspectH;

        let cropWidth, cropHeight, cropX, cropY;

        if (w / h > targetAspectRatio) {
            cropHeight = h;
            cropWidth = h * targetAspectRatio;
            cropX = (w - cropWidth) / 2;
            cropY = 0;
        } else {
            cropWidth = w;
            cropHeight = w / targetAspectRatio;
            cropX = 0;
            cropY = (h - cropHeight) / 2;
        }
        
        const canvas = document.createElement('canvas');
        const maxAiInputSize = 1024;
        let drawWidth = cropWidth, drawHeight = cropHeight;

        if (drawWidth > maxAiInputSize || drawHeight > maxAiInputSize) {
            if (drawWidth > drawHeight) {
                drawHeight = Math.round(drawHeight * (maxAiInputSize / drawWidth));
                drawWidth = maxAiInputSize;
            } else {
                drawWidth = Math.round(drawWidth * (maxAiInputSize / drawHeight));
                drawHeight = maxAiInputSize;
            }
        }
        
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get 2D context for cropping.'));

        ctx.drawImage(imageObject, cropX, cropY, cropWidth, cropHeight, 0, 0, drawWidth, drawHeight);
        resolve(canvas.toDataURL('image/webp', 0.95));
    });
}


export async function handleIdPhotoClick() {
    if (isLoading || !idPhotoImage) return;
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    
    setIsLoading(true);
    updateIdPhotoButtonState();
    renderOutput(`<div class="spinner"></div><p>Bước 1/${customOutfitImage ? '4' : '3'}: Đang phân tích khuôn mặt...</p>`);
    
    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const specId = document.getElementById('id-photo-spec').value;
        const selectedSpec = PHOTO_SPEC_OPTIONS.find(s => s.id === specId);
        if (!selectedSpec) throw new Error("Không tìm thấy thông số kỹ thuật cho loại ảnh đã chọn.");

        // Step 1: Get face bounding box
        const faceBox = await getFaceBoundingBox(ai, idPhotoImage.base64);
        useQuota('generate'); // Count face detection as one usage

        renderOutput(`<div class="spinner"></div><p>Bước 2/${customOutfitImage ? '4' : '3'}: Đang chuẩn bị ảnh...</p>`);

        // Step 2: Create smart crop based on face box
        const croppedImageDataUrl = await cropImageToPassportFrame(idPhotoImage.imageObject, faceBox, selectedSpec);

        // Step 3: Prepare final generation prompt and image parts
        const bgColorSelect = document.getElementById('id-photo-bg-color');
        let bgColor = bgColorSelect.value === 'custom' ? document.getElementById('id-photo-bg-color-picker').value : bgColorSelect.value;
        const smoothSkin = document.getElementById('id-photo-smooth-skin').checked;
        const tidyHair = document.getElementById('id-photo-tidy-hair').checked;
        
        let secondaryTasks = `
- **Bảo tồn Danh tính:** Giữ lại 100% đặc điểm khuôn mặt của người trong ảnh gốc (Ảnh 1).
- **Nền:** Thay thế hoàn toàn phông nền bằng một màu trơn: ${bgColor}.
- **Chất lượng:** Nâng cao chất lượng tổng thể của ảnh (độ nét, ánh sáng) để đạt chuẩn studio chuyên nghiệp.
`;
        if (smoothSkin) secondaryTasks += `- **Da:** Làm mịn da một cách tự nhiên, giữ lại cấu trúc da thật.\n`;
        if (tidyHair) secondaryTasks += `- **Tóc:** Giữ nguyên kiểu tóc gốc nhưng làm cho nó gọn gàng hơn.\n`;

        const parts = [{ inlineData: { data: croppedImageDataUrl.split(',')[1], mimeType: 'image/webp' } }];
        
        if (customOutfitImage && customOutfitImage.imageObject) {
            renderOutput(`<div class="spinner"></div><p>Bước 3/4: Đang xử lý ảnh trang phục...</p>`);
            const croppedOutfitDataUrl = await centerCropImage(customOutfitImage.imageObject, selectedSpec.aspectRatio);
            
            secondaryTasks += `- **Trang phục:** Thay thế trang phục gốc bằng trang phục từ ảnh tham chiếu thứ hai (ảnh trang phục).\n`;
            parts.push({ inlineData: { data: croppedOutfitDataUrl.split(',')[1], mimeType: 'image/webp' } });
            renderOutput(`<div class="spinner"></div><p>Bước 4/4: Đang tạo ảnh thẻ cuối cùng...</p>`);
        } else {
            renderOutput(`<div class="spinner"></div><p>Bước 3/3: Đang tạo ảnh thẻ cuối cùng...</p>`);
            const outfit = document.getElementById('id-photo-outfit').value;
            if (outfit !== 'giữ nguyên trang phục gốc') {
                 secondaryTasks += `- **Trang phục:** Thay thế trang phục gốc bằng '${outfit}'.\n`;
            }
        }
        
        const finalPrompt = selectedSpec.requirements + '\n**CÁC TÁC VỤ BỔ SUNG:** **MOST REQUIRED:** Retain 100% of the facial features of the person in the original photo. **USE THE UPLOADED IMAGE AS THE MOST ACCURATE REFERENCE FOR THE FACE.** Absolutely do not change the lines, eyes, nose, mouth. Photorealistic studio portrait. Skin shows fine micro-texture and subtle subsurface scattering; eyes tack sharp; hairline blends cleanly with individual strands and natural fly away. Fabric shows authentic weave, seams and natural wrinkles; metals reflect with tiny imperfections. Lighting coherent with scene; natural shadow falloff on cheekbone, jawline and nose. Background has believable micro-details; avoid CGI-clean look. 85mm equivalent, f/2.0 to f/2.8; subject tack sharp, cinematic color grade; confident posture, slight asymmetry.\n' + secondaryTasks;
        parts.push({ text: finalPrompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', contents: { parts }, config: { responseModalities: [Modality.IMAGE] },
        });
        
        useQuota('generate');
        setLastGeneratedImageUrl(null);
        
        // This call only expects an image, so textContent will be empty.
        const { errorMessage, imageUrl } = processImageGenerationResponse(response);
        let outputHtml = '';
        
        if (imageUrl) {
            setLastGeneratedImageUrl(imageUrl);
            outputHtml = `<img src="${imageUrl}" alt="Ảnh thẻ đã tạo" class="generated-image">`;
        }
        
        renderOutput(outputHtml + errorMessage);

    } catch (error) {
        setLastGeneratedImageUrl(null);
        renderOutput(getApiErrorMessage(error));
    } finally {
        setIsLoading(false);
        updateIdPhotoButtonState();
    }
}