import { GoogleGenAI, Type } from '@google/genai';
import { getQuotaState, useQuota } from '../shared/quota.js';
import { isLoading, setIsLoading, FACE_PROMPT_TEXT } from '../shared/state.js';
import { fileToBase64, setSelectOrCustom } from '../shared/utils.js';

// Module-level state
let basePrompt = null;

export function renderPromptMakerTab(container) {
    container.innerHTML = `
        <div class="pm-actions">
            <button id="analyze-prompt-maker-image-btn" class="action-btn">Đọc từ ảnh</button>
        </div>
        <div class="prompt-maker-grid">
            <div class="form-group">
                <label for="pm-num-people">Số lượng người</label>
                <select id="pm-num-people">
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                </select>
            </div>
            <div class="form-group">
                <label for="pm-camera-angle">Góc máy</label>
                <select id="pm-camera-angle">
                    <option value="">Ngẫu nhiên</option>
                    <option value="Góc chụp ngang tầm mắt (eye-level shot)">Ngang tầm mắt</option>
                    <option value="Góc máy thấp (low-angle shot)">Góc máy thấp</option>
                    <option value="Góc máy cao (high-angle shot)">Góc máy cao</option>
                    <option value="Cận cảnh (close-up)">Cận cảnh</option>
                    <option value="Trung cảnh (medium shot)">Trung cảnh</option>
                    <option value="Toàn cảnh (full shot)">Toàn cảnh</option>
                    <option value="Góc máy nghiêng (dutch angle)">Góc máy nghiêng</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label for="pm-style">Phong cách ảnh</label>
                <select id="pm-style">
                    <option value="">Ngẫu nhiên</option>
                    <option value="Ảnh thật (photorealistic)">Ảnh thật</option>
                    <option value="Ảnh siêu thực">Ảnh siêu thực</option>
                    <option value="Ảnh chụp film">Ảnh chụp film</option>
                    <option value="Ảnh du lịch">Ảnh du lịch</option>
                    <option value="Tranh sơn dầu">Tranh sơn dầu</option>
                    <option value="Hoạt hình Disney">Hoạt hình Disney</option>
                    <option value="Phong cách Anime">Phong cách Anime</option>
                    <option value="Cyberpunk">Cyberpunk</option>
                    <option value="Steampunk">Steampunk</option>
                    <option value="Vintage/Retro">Vintage/Retro</option>
                    <option value="Thần tiên (Fantasy)">Thần tiên</option>
                    <option value="Gothic">Gothic</option>
                    <option value="Tối giản">Tối giản</option>
                    <option value="Màu nước">Màu nước</option>
                    <option value="custom">Khác (nhập bên dưới)</option>
                </select>
                <textarea id="pm-style-custom" class="hidden" placeholder="Mô tả phong cách bạn muốn..."></textarea>
            </div>
            <div class="form-group full-width"><label for="pm-context">Bối cảnh</label><textarea id="pm-context" placeholder="Ví dụ: Một quán cà phê ấm cúng vào buổi chiều mưa..."></textarea></div>
            <div class="form-group full-width"><label for="pm-location">Địa điểm cụ thể</label><textarea id="pm-location" placeholder="Ví dụ: Trên một con phố cổ ở Hội An, Việt Nam..."></textarea></div>
        </div>
        <div id="pm-person-details"></div>
        <button id="create-prompt-btn">Tạo Prompt</button>
        <div id="prompt-output-wrapper" class="hidden">
            <div class="checkbox-section"><input type="checkbox" id="pm-keep-face-checkbox"><label for="pm-keep-face-checkbox">Thêm prompt bám khuôn mặt</label></div>
             <div class="prompt-header">
                <label for="prompt-output">Prompt đã tạo</label>
                <div class="prompt-buttons"><button id="copy-prompt-btn" class="action-btn">Sao chép</button></div>
             </div>
             <textarea id="prompt-output" readonly></textarea>
        </div>
    `;
    
    document.getElementById('create-prompt-btn').addEventListener('click', handleCreatePromptClick);
    document.getElementById('analyze-prompt-maker-image-btn').addEventListener('click', handleAnalyzeImageForPromptMaker);
    document.getElementById('pm-keep-face-checkbox').addEventListener('change', updatePromptMakerOutput);
    
    const numPeopleSelect = document.getElementById('pm-num-people');
    numPeopleSelect.addEventListener('change', () => renderPersonDetailFields(parseInt(numPeopleSelect.value, 10)));
    
    const styleSelect = document.getElementById('pm-style');
    styleSelect.addEventListener('change', () => document.getElementById('pm-style-custom').classList.toggle('hidden', styleSelect.value !== 'custom'));

    document.getElementById('copy-prompt-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        navigator.clipboard.writeText(document.getElementById('prompt-output').value);
        const originalText = btn.textContent;
        btn.textContent = 'Đã sao chép!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    });
    
    renderPersonDetailFields(1);
}

function renderPersonDetailFields(count) {
    const container = document.getElementById('pm-person-details');
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'person-fieldset';
        fieldset.innerHTML = `
            <legend>Thông tin người ${i}</legend>
            <div class="prompt-maker-grid">
                 <div class="form-group"><label for="pm-gender-${i}">Giới tính</label><select id="pm-gender-${i}"><option value="">Không xác định</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></div>
                <div class="form-group"><label for="pm-age-${i}">Độ tuổi</label><input type="text" id="pm-age-${i}" placeholder="Ví dụ: 25, trung niên..."></div>
                <div class="form-group full-width"><label for="pm-outfit-${i}">Trang phục</label><textarea id="pm-outfit-${i}" placeholder="Ví dụ: Áo sơ mi trắng và quần jean..."></textarea></div>
                <div class="form-group">
                    <label for="pm-expression-${i}">Cảm xúc khuôn mặt</label>
                    <select id="pm-expression-${i}">
                        <option value="">Ngẫu nhiên</option><option value="Thanh bình">Thanh bình</option><option value="Tự tin">Tự tin</option><option value="Mơ màng">Mơ màng</option><option value="Vui vẻ">Vui vẻ</option><option value="Ngạc nhiên">Ngạc nhiên</option><option value="Buồn bã">Buồn bã</option><option value="Suy tư">Suy tư</option><option value="Tức giận">Tức giận</option><option value="Tinh nghịch">Tinh nghịch</option><option value="Kiêu hãnh">Kiêu hãnh</option><option value="Hài lòng">Hài lòng</option><option value="Hồi hộp">Hồi hộp</option><option value="Nhẹ nhõm">Nhẹ nhõm</option><option value="Lo lắng">Lo lắng</option><option value="custom">Khác (nhập bên dưới)</option>
                    </select>
                    <textarea id="pm-expression-${i}-custom" class="hidden" placeholder="Mô tả cảm xúc bạn muốn..."></textarea>
                </div>
                 <div class="form-group"><label for="pm-action-${i}">Hành động của nhân vật</label><textarea id="pm-action-${i}" placeholder="Ví dụ: Đang đọc sách..."></textarea></div>
            </div>
        `;
        container.appendChild(fieldset);

        const expressionSelect = document.getElementById(`pm-expression-${i}`);
        expressionSelect.addEventListener('change', () => document.getElementById(`pm-expression-${i}-custom`).classList.toggle('hidden', expressionSelect.value !== 'custom'));
        
        const genderSelect = document.getElementById(`pm-gender-${i}`);
        genderSelect.addEventListener('change', () => handleGenderChange(i));
    }
}

async function handleGenderChange(personIndex) {
    if (getQuotaState('generate').count <= 0) return alert(`Bạn đã hết lượt tạo ảnh. Không thể tự động cập nhật.`);
    
    const genderSelect = document.getElementById(`pm-gender-${personIndex}`);
    const outfitEl = document.getElementById(`pm-outfit-${personIndex}`);
    if (!genderSelect.value) return;

    const originalOutfit = outfitEl.value;
    outfitEl.disabled = true;
    outfitEl.value = 'AI đang suy nghĩ...';

    try {
        const age = document.getElementById(`pm-age-${personIndex}`).value;
        let style = document.getElementById('pm-style').value;
        if (style === 'custom') style = document.getElementById('pm-style-custom').value;
        const context = document.getElementById('pm-context').value;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `You are a creative assistant. Based on the provided context, suggest a suitable outfit for the character. Return ONLY a valid JSON object with an "outfit" key. The description should be in Vietnamese.`;
        const prompt = `Context:\n- Style: ${style || 'realistic'}\n- Scene: ${context || 'general'}\n- Gender: ${genderSelect.value}\n- Age: ${age || 'unspecified'}\nSuggest a suitable outfit.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: { outfit: { type: Type.STRING } } },
            }
        });
        useQuota('generate');
        outfitEl.value = JSON.parse(response.text).outfit || originalOutfit;
    } catch (error) {
        console.error("Error updating details on gender change:", error);
        outfitEl.value = originalOutfit;
        alert(`Đã xảy ra lỗi khi cập nhật: ${error.message}`);
    } finally {
        outfitEl.disabled = false;
    }
}

function updatePromptMakerOutput() {
    const textarea = document.getElementById('prompt-output');
    if (!textarea || basePrompt === null) return;
    const checkbox = document.getElementById('pm-keep-face-checkbox');
    textarea.value = basePrompt + (checkbox.checked ? FACE_PROMPT_TEXT : '');
}

async function handleCreatePromptClick() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    if (isLoading) return;

    basePrompt = null;
    setIsLoading(true);
    const createBtn = document.getElementById('create-prompt-btn');
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="small-spinner"></span> Đang tạo...';

    const outputWrapper = document.getElementById('prompt-output-wrapper');
    const outputTextarea = document.getElementById('prompt-output');
    outputTextarea.value = 'AI đang suy nghĩ...';
    outputWrapper.classList.remove('hidden');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        let style = document.getElementById('pm-style').value;
        if (style === 'custom') style = document.getElementById('pm-style-custom').value;
        const cameraAngle = document.getElementById('pm-camera-angle').value;
        const context = document.getElementById('pm-context').value;
        const location = document.getElementById('pm-location').value;
        const numPeople = parseInt(document.getElementById('pm-num-people').value, 10);

        let peopleDetails = '';
        for (let i = 1; i <= numPeople; i++) {
            let expression = document.getElementById(`pm-expression-${i}`).value;
            if (expression === 'custom') expression = document.getElementById(`pm-expression-${i}-custom`).value;
            peopleDetails += `\nNgười ${i}: Giới tính: ${document.getElementById(`pm-gender-${i}`).value || 'AI tự quyết định'}, Tuổi: ${document.getElementById(`pm-age-${i}`).value || 'AI tự quyết định'}, Trang phục: ${document.getElementById(`pm-outfit-${i}`).value || 'AI tự quyết định'}, Cảm xúc: ${expression || 'AI tự quyết định'}, Hành động: ${document.getElementById(`pm-action-${i}`).value || 'AI tự quyết định'}`;
        }

        const systemInstruction = `You are an expert in creating artistic, detailed prompts for AI image generation. Based on user details, create a cohesive, high-quality prompt in Vietnamese. If a detail is missing, creatively fill it in. The output should be a single descriptive paragraph suitable for generating a photorealistic image. Do not use markdown. Output only the final prompt text.`;
        const userInputs = `**Bối cảnh:**\n- Tổng số người: ${numPeople}\n- Phong cách: ${style || 'AI tự quyết định'}\n- Góc máy: ${cameraAngle || 'AI tự quyết định'}\n- Bối cảnh: ${context || 'AI tự quyết định'}\n- Địa điểm: ${location || 'AI tự quyết định'}\n**Chi tiết từng người:**${peopleDetails}`;

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: userInputs, config: { systemInstruction } });
        useQuota('generate');
        basePrompt = response.text.trim();
        updatePromptMakerOutput();
    } catch (error) {
        console.error("Error creating prompt:", error);
        outputTextarea.value = `Đã xảy ra lỗi: ${error.message}`;
    } finally {
        setIsLoading(false);
        createBtn.disabled = false;
        createBtn.innerHTML = 'Tạo Prompt';
    }
}

async function handleAnalyzeImageForPromptMaker() {
    const quotaState = getQuotaState('generate');
    if (quotaState.count <= 0) {
        alert(`Bạn đã hết lượt tạo ảnh. Vui lòng thử lại sau ${Math.ceil((quotaState.resetTime - Date.now()) / 1000)} giây.`);
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const analyzeBtn = document.getElementById('analyze-prompt-maker-image-btn');
        const originalText = analyzeBtn.textContent;
        analyzeBtn.innerHTML = `<span class="small-spinner"></span> Đang phân tích...`;
        analyzeBtn.disabled = true;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64 = await fileToBase64(file);

            const imagePart = { inlineData: { data: base64.split(',')[1], mimeType: file.type } };
            const prompt = `Analyze the image and extract details in Vietnamese as a JSON object: total number of people, photo style, camera angle, context, location, and for each person: gender, age, outfit, expression, and action.`;
            const schema = {
              type: Type.OBJECT,
              properties: {
                numberOfPeople: { type: Type.INTEGER }, photoStyle: { type: Type.STRING }, cameraAngle: { type: Type.STRING }, context: { type: Type.STRING }, location: { type: Type.STRING },
                people: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gender: { type: Type.STRING }, age: { type: Type.STRING }, outfit: { type: Type.STRING }, expression: { type: Type.STRING }, action: { type: Type.STRING } } } }
              },
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: { parts: [imagePart, { text: prompt }] }, config: { responseMimeType: "application/json", responseSchema: schema },
            });
            useQuota('generate');
            populatePromptMakerForm(JSON.parse(response.text));
        } catch (error) {
            console.error("Error analyzing image:", error);
            alert(`Không thể phân tích ảnh: ${error.message}`);
        } finally {
            setIsLoading(false);
            analyzeBtn.innerHTML = originalText;
            analyzeBtn.disabled = false;
        }
    };
    input.click();
}

function populatePromptMakerForm(data) {
    setSelectOrCustom(document.getElementById('pm-style'), document.getElementById('pm-style-custom'), data.photoStyle);
    document.getElementById('pm-context').value = data.context || '';
    document.getElementById('pm-location').value = data.location || '';
    
    const cameraAngleSelect = document.getElementById('pm-camera-angle');
    if (data.cameraAngle) {
        const matchingOption = Array.from(cameraAngleSelect.options).find(opt => data.cameraAngle.toLowerCase().includes(opt.textContent.toLowerCase()));
        if (matchingOption) cameraAngleSelect.value = matchingOption.value;
    }

    const numPeople = Math.min(data.people?.length || 1, 5);
    document.getElementById('pm-num-people').value = String(numPeople);
    renderPersonDetailFields(numPeople);

    if (data.people) {
        data.people.slice(0, numPeople).forEach((person, index) => {
            const i = index + 1;
            document.getElementById(`pm-gender-${i}`).value = person.gender || '';
            document.getElementById(`pm-age-${i}`).value = person.age || '';
            document.getElementById(`pm-outfit-${i}`).value = person.outfit || '';
            document.getElementById(`pm-action-${i}`).value = person.action || '';
            setSelectOrCustom(document.getElementById(`pm-expression-${i}`), document.getElementById(`pm-expression-${i}-custom`), person.expression);
        });
    }
}