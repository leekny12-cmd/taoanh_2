/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, setLastGeneratedImageUrl, FACE_PROMPT_TEXT } from '../shared/state.js';
import { fileToBase64, getApiErrorMessage, processImageGenerationResponse, frameImageInAspectRatio } from '../shared/utils.js';
import { renderOutput } from '../shared/ui.js';
import { countries, locations, maleOutfits, femaleOutfits, poses, cameraAngles } from './travelData.js';


// Module-level state
let uploadedFiles = [];

export function renderTravelTab(container) {
    const countriesOptions = countries.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const cameraAnglesOptions = cameraAngles.map(angle => `<option value="${angle}">${angle}</option>`).join('');


    container.innerHTML = `
        <div class="upload-group">
            <label>Tải ảnh của bạn (có thể tải nhiều ảnh)</label>
            <div id="travel-image-upload" class="drop-zone small" role="button" tabindex="0" aria-label="Vùng tải ảnh du lịch">
                <p>Kéo và thả ảnh vào đây, hoặc nhấn để chọn tệp</p>
                <input type="file" id="travel-file-input" accept="image/*" multiple hidden>
            </div>
        </div>
        <div id="travel-image-preview" class="preview-container" aria-live="polite"></div>
        <div id="travel-keep-face-section" class="checkbox-section hidden">
            <input type="checkbox" id="travel-keep-face-checkbox">
            <label for="travel-keep-face-checkbox">Giữ khuôn mặt</label>
        </div>

        <div class="prompt-maker-grid">
            <div class="form-group">
                <label for="travel-country">Quốc Gia</label>
                <select id="travel-country">
                    <option value="random">Ngẫu nhiên</option>
                    ${countriesOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="travel-location">Địa điểm cụ thể</label>
                <select id="travel-location">
                    <option value="random">Ngẫu nhiên</option>
                </select>
            </div>
             <div class="form-group">
                <label for="travel-camera-angle">Góc máy</label>
                <select id="travel-camera-angle">
                    <option value="random">Ngẫu nhiên</option>
                    ${cameraAnglesOptions}
                </select>
            </div>
             <div class="form-group">
                <label for="travel-pose">Dáng pose</label>
                <select id="travel-pose">
                    <option value="random">Ngẫu nhiên</option>
                </select>
                <textarea id="travel-pose-custom" class="hidden" placeholder="Mô tả dáng pose bạn muốn..."></textarea>
            </div>
            <div class="form-group">
                <label for="travel-aspect-ratio">Tỉ lệ ảnh</label>
                <select id="travel-aspect-ratio">
                    <option value="3:4">Chân dung (3:4)</option>
                    <option value="4:3">Ngang (4:3)</option>
                    <option value="1:1">Vuông (1:1)</option>
                    <option value="9:16">Dọc (9:16)</option>
                    <option value="16:9">Rộng (16:9)</option>
                </select>
            </div>
        </div>
        
        <div id="travel-outfit-selectors"></div>

        <button id="travel-generate-btn" disabled>Tạo ảnh du lịch</button>
    `;

    // Event listeners
    document.getElementById('travel-image-upload').addEventListener('click', () => document.getElementById('travel-file-input').click());
    document.getElementById('travel-file-input').addEventListener('change', handleFileSelect);
    document.getElementById('travel-country').addEventListener('change', updateLocationOptions);
    document.getElementById('travel-pose').addEventListener('change', (e) => {
        document.getElementById('travel-pose-custom').classList.toggle('hidden', e.target.value !== 'custom');
    });
    document.getElementById('travel-generate-btn').addEventListener('click', handleTravelClick);
    
    // Initial state
    renderImagePreviews();
    updateDynamicUI();
    updateTravelButtonState();
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files) {
        handleFiles(Array.from(files));
    }
}

async function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    for (const file of imageFiles) {
        const base64 = await fileToBase64(file);
        const id = `file-travel-${Date.now()}-${Math.random()}`;
        uploadedFiles.push({ file, base64, id });
    }
    renderImagePreviews();
    updateDynamicUI();
    updateTravelButtonState();
}

function renderImagePreviews() {
    const previewEl = document.getElementById('travel-image-preview');
    if (!previewEl) return;
    
    previewEl.innerHTML = '';
    uploadedFiles.forEach(fileData => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item selected'; // All are selected by default
        previewItem.innerHTML = `
            <img src="${fileData.base64}" alt="${fileData.file.name}" />
            <button class="remove-btn" data-id="${fileData.id}" aria-label="Xóa ${fileData.file.name}">&times;</button>
        `;
        previewItem.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFile(fileData.id);
        });
        previewEl.appendChild(previewItem);
    });
}

function removeFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    renderImagePreviews();
    updateDynamicUI();
    updateTravelButtonState();
}

function updateLocationOptions() {
    const countrySelect = document.getElementById('travel-country');
    const locationSelect = document.getElementById('travel-location');
    const selectedCountryName = countrySelect.value;
    
    locationSelect.innerHTML = '<option value="random">Ngẫu nhiên</option>';
    if (selectedCountryName === 'random') return;

    const selectedCountry = countries.find(c => c.name === selectedCountryName);
    if (selectedCountry && locations[selectedCountry.code]) {
        const locationOptions = locations[selectedCountry.code].map(loc => `<option value="${loc}">${loc}</option>`).join('');
        locationSelect.innerHTML += locationOptions;
    }
}

function updateDynamicUI() {
    const count = uploadedFiles.length;
    document.getElementById('travel-keep-face-section').classList.toggle('hidden', count === 0);
    renderOutfitSelectors(count);
    updatePoseOptions(count);
}

function populateOutfitOptions(personNum, gender) {
    const selectEl = document.getElementById(`travel-outfit-${personNum}`);
    if (!selectEl) return;

    let outfitSource = [];
    if (gender === 'Nam') {
        outfitSource = maleOutfits;
    } else if (gender === 'Nữ') {
        outfitSource = femaleOutfits;
    }
    
    const outfitOptions = outfitSource.map(o => `<option value="${o}">${o}</option>`).join('');
    const currentVal = selectEl.value;

    selectEl.innerHTML = `
        <option value="random">Ngẫu nhiên (AI tự chọn)</option>
        ${outfitOptions}
        <option value="custom">Tự mô tả bên dưới</option>
    `;
    
    // Preserve selection if possible
    if (Array.from(selectEl.options).some(opt => opt.value === currentVal)) {
        selectEl.value = currentVal;
    } else {
        selectEl.value = 'random';
    }


    const customEl = document.getElementById(`travel-outfit-${personNum}-custom`);
    customEl.classList.toggle('hidden', selectEl.value !== 'custom');
}

function renderOutfitSelectors(count) {
    const container = document.getElementById('travel-outfit-selectors');
    if (!container) return;

    container.innerHTML = '';
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
        const personNum = i + 1;
        const personGroup = document.createElement('div');
        personGroup.className = 'form-group';
        personGroup.innerHTML = `
            <label>Trang phục & Giới tính người ${personNum}</label>
            <div class="gender-selector">
                <input type="radio" id="gender-nam-${personNum}" name="travel-gender-${personNum}" value="Nam">
                <label for="gender-nam-${personNum}">Nam</label>
                <input type="radio" id="gender-nu-${personNum}" name="travel-gender-${personNum}" value="Nữ">
                <label for="gender-nu-${personNum}">Nữ</label>
                <input type="radio" id="gender-random-${personNum}" name="travel-gender-${personNum}" value="random" checked>
                <label for="gender-random-${personNum}">Ngẫu nhiên</label>
            </div>
            <select id="travel-outfit-${personNum}"></select>
            <textarea id="travel-outfit-${personNum}-custom" class="hidden" placeholder="Mô tả trang phục cho người ${personNum}..."></textarea>
        `;
        container.appendChild(personGroup);
        
        const selectEl = personGroup.querySelector('select');
        const customEl = personGroup.querySelector('textarea');
        selectEl.addEventListener('change', () => customEl.classList.toggle('hidden', selectEl.value !== 'custom'));

        const genderSelector = personGroup.querySelector('.gender-selector');
        genderSelector.addEventListener('change', (e) => {
            const selectedGender = e.target.value;
            populateOutfitOptions(personNum, selectedGender);
        });
        
        populateOutfitOptions(personNum, 'random'); // Initial population
    }
}


function updatePoseOptions(count) {
    const poseSelect = document.getElementById('travel-pose');
    if (!poseSelect) return;

    let poseKey = 'solo';
    if (count === 2) poseKey = 'duo';
    else if (count > 2) poseKey = 'group';

    let poseOptions = '';
    if (count > 0 && poses[poseKey]) {
        poseOptions = poses[poseKey].map(p => `<option value="${p}">${p}</option>`).join('');
    }
    
    poseSelect.innerHTML = `
        <option value="random">Ngẫu nhiên (AI tự chọn)</option>
        ${poseOptions}
        ${count > 0 ? '<option value="custom">Tự mô tả bên dưới</option>' : ''}
    `;
    document.getElementById('travel-pose-custom').classList.add('hidden');
}


export function updateTravelButtonState() {
    const btn = document.getElementById('travel-generate-btn');
    if (!btn) return;

    const hasQuota = getQuotaState('generate').count > 0;
    const hasImage = uploadedFiles.length > 0;
    
    btn.disabled = isLoading || !hasImage || !hasQuota;
    btn.title = !hasQuota ? 'Bạn đã hết lượt tạo ảnh trong phút này.' : '';
    if (!hasImage) {
        btn.title = 'Vui lòng tải lên ít nhất một ảnh.';
    }
}

export async function handleTravelClick() {
    if (isLoading || uploadedFiles.length === 0) return;

    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${quotaState.resetTime - Date.now()} giây.`);
        return;
    }
    
    setIsLoading(true);
    updateTravelButtonState();
    renderOutput(`<div class="spinner"></div><p>Đang chuẩn bị chuyến du lịch AI... Việc này có thể mất một chút thời gian.</p>`);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Gather data from form
        const country = document.getElementById('travel-country').value;
        const location = document.getElementById('travel-location').value;
        const cameraAngle = document.getElementById('travel-camera-angle').value;
        const keepFace = document.getElementById('travel-keep-face-checkbox').checked;
        const aspectRatio = document.getElementById('travel-aspect-ratio').value;
        
        let poseSelectEl = document.getElementById('travel-pose');
        let pose = poseSelectEl.value;
        if (pose === 'custom') {
            pose = document.getElementById('travel-pose-custom').value;
        }

        const imageParts = await Promise.all(uploadedFiles.map(async (fileData) => {
            const framedBase64 = await frameImageInAspectRatio(fileData.base64, aspectRatio);
            return {
                inlineData: {
                    data: framedBase64.split(',')[1],
                    mimeType: 'image/png' // Always PNG for transparency
                }
            };
        }));
        
        let prompt = `**ROLE:** Expert Travel Photographer and AI Image Editor.
**GOAL:** Create a single, stunning, photorealistic travel photograph based on the user's request and provided images. The final image should be vibrant, high-quality, and look like a professionally captured moment.

**SCENE DETAILS:**
- **Location:** A breathtaking scene at ${location === 'random' ? 'a famous tourist destination' : `"${location}"`} in ${country === 'random' ? 'a beautiful country' : `"${country}"`}. The background must be epic, scenic, and appropriate for the location.
- **Camera Angle:** ${cameraAngle === 'random' ? 'Chosen by AI for the most dramatic and fitting effect' : `"${cameraAngle}"`}.
- **Style:** High-resolution, travel photography style with natural lighting, cinematic color grading, and a sharp focus on the subjects.

**SUBJECT DETAILS:**
There are ${uploadedFiles.length} people in the photo, described as follows:
`;
        
        uploadedFiles.forEach((_, index) => {
            const personNum = index + 1;

            // Get gender
            const genderRadio = document.querySelector(`input[name="travel-gender-${personNum}"]:checked`);
            const gender = genderRadio ? genderRadio.value : 'random';
            
            let genderDescription = 'gender to be chosen by AI';
            if (gender === 'Nam') genderDescription = 'male';
            if (gender === 'Nữ') genderDescription = 'female';

            // Get outfit
            const outfitSelectEl = document.getElementById(`travel-outfit-${personNum}`);
            let outfit = outfitSelectEl.value;
            if (outfit === 'custom') {
                outfit = document.getElementById(`travel-outfit-${personNum}-custom`).value;
            } else if (outfit === 'random') {
                outfit = "an outfit perfectly suitable for the location and chosen gender";
            }

            prompt += `\n- **Person ${personNum}:** Must be based on Input Image ${personNum}. This person is **${genderDescription}**. Their outfit should be: "${outfit}".`;
        });
        
        prompt += `\n\n**POSE & COMPOSITION:**
- The subjects should be arranged in the following pose: "${pose === 'random' ? 'A natural and engaging pose chosen by AI that fits the scene and number of people' : pose}".
- The composition should place the subjects naturally within the scene, interacting with the environment if appropriate.`;
        
        if (keepFace) {
            prompt += `\n\n**CRITICAL INSTRUCTION: FACE FIDELITY** ${FACE_PROMPT_TEXT}`;
        }

        prompt += `\n\n**FINAL OUTPUT:** Return only the final, edited image. Do not add any text, explanation, or markdown.`;
        
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [...imageParts, textPart] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        
        useQuota('generate');
        const { textContent, errorMessage, imageUrl } = processImageGenerationResponse(response);
        let outputHtml = '';
        setLastGeneratedImageUrl(null);

        if (imageUrl) {
            setLastGeneratedImageUrl(imageUrl);
            outputHtml = `<img src="${imageUrl}" alt="Ảnh du lịch đã tạo" class="generated-image">`;
        }
        
        renderOutput(outputHtml + textContent + errorMessage);

    } catch (error) {
        setLastGeneratedImageUrl(null);
        renderOutput(getApiErrorMessage(error));
    } finally {
        setIsLoading(false);
        updateTravelButtonState();
    }
}