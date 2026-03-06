export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

export function applyWatermark(imageUrl) {
    return new Promise((resolve, reject) => {
        const watermarkText = "taoanhez.com";
        const img = new Image();
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error("Could not get canvas context"));
            }

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Set watermark style
            const fontSize = Math.max(50, Math.floor(img.width / 40));
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

            const padding = 30;
            const x = canvas.width / 2;
            const y = canvas.height - padding;

            ctx.fillText(watermarkText, x, y);

            resolve(canvas.toDataURL('image/jpeg'));
        };

        img.onerror = (error) => {
            reject(error);
        };

        img.src = imageUrl;
    });
}


/**
 * Helper to set a select element's value or fallback to a custom text area.
 */
export function setSelectOrCustom(selectEl, customEl, value) {
    if (!value) return;
    const optionExists = Array.from(selectEl.options).some(opt => opt.textContent === value || opt.value === value);
    if (optionExists) {
        const option = Array.from(selectEl.options).find(opt => opt.textContent === value || opt.value === value);
        selectEl.value = option.value;
        customEl.classList.add('hidden');
    } else {
        selectEl.value = 'custom';
        customEl.value = value;
        customEl.classList.remove('hidden');
    }
}

/**
 * Crops an image from a base64 string to a target aspect ratio using a center crop.
 * @param {string} imageBase64 The base64 string of the source image.
 * @param {string} aspectRatioString The target aspect ratio, e.g., "1:1", "3:4".
 * @returns {Promise<string>} A promise that resolves to the base64 string of the cropped image in webp format.
 */
export function cropImageToBase64(imageBase64, aspectRatioString) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const { naturalWidth: w, naturalHeight: h } = img;
            const [aspectW, aspectH] = aspectRatioString.split(':').map(Number);
            if (!aspectW || !aspectH) return reject(new Error(`Invalid aspect ratio: ${aspectRatioString}`));
            const targetAspectRatio = aspectW / aspectH;

            let cropWidth, cropHeight, cropX, cropY;

            // Determine crop dimensions
            if (w / h > targetAspectRatio) {
                // Image is wider than target, crop width
                cropHeight = h;
                cropWidth = h * targetAspectRatio;
                cropX = (w - cropWidth) / 2;
                cropY = 0;
            } else {
                // Image is taller than target, crop height
                cropWidth = w;
                cropHeight = w / targetAspectRatio;
                cropX = 0;
                cropY = (h - cropHeight) / 2;
            }

            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get 2D context for cropping.'));

            ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            // Using webp for potentially smaller file size, good for API calls
            resolve(canvas.toDataURL('image/webp', 0.92));
        };
        img.onerror = (error) => reject(new Error('Failed to load image for cropping.', { cause: error }));
        img.src = imageBase64;
    });
}

/**
 * Frames an image within a transparent canvas of a specified aspect ratio.
 * The image is scaled to fit within the canvas while maintaining its aspect ratio.
 * @param {string} imageBase64 The base64 string of the source image.
 * @param {string} aspectRatioString The target aspect ratio, e.g., "3:4".
 * @returns {Promise<string>} A promise that resolves to the base64 string of the framed image in PNG format.
 */
export function frameImageInAspectRatio(imageBase64, aspectRatioString) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const [targetW, targetH] = aspectRatioString.split(':').map(Number);
            if (!targetW || !targetH) return reject(new Error(`Invalid aspect ratio: ${aspectRatioString}`));
            const targetRatio = targetW / targetH;

            // Define canvas size, capping max dimension for performance
            const maxDim = 1024;
            let canvasWidth, canvasHeight;
            if (targetRatio >= 1) { // Landscape or square
                canvasWidth = maxDim;
                canvasHeight = Math.round(maxDim / targetRatio);
            } else { // Portrait
                canvasHeight = maxDim;
                canvasWidth = Math.round(maxDim * targetRatio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get 2D context.'));

            // Calculate "contain" dimensions for the source image
            const imgRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth, drawHeight;
            if (canvasWidth / canvasHeight > imgRatio) {
                // Canvas is wider than image aspect ratio, so height is the limiting dimension
                drawHeight = canvasHeight;
                drawWidth = Math.round(drawHeight * imgRatio);
            } else {
                // Canvas is taller or same aspect ratio, so width is the limiting dimension
                drawWidth = canvasWidth;
                drawHeight = Math.round(drawWidth / imgRatio);
            }

            // Center the image on the canvas
            const x = (canvasWidth - drawWidth) / 2;
            const y = (canvasHeight - drawHeight) / 2;

            // Draw the image
            ctx.drawImage(img, x, y, drawWidth, drawHeight);

            // Resolve with a PNG data URL to support transparency
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (error) => reject(new Error('Failed to load image for framing.', { cause: error }));
        img.src = imageBase64;
    });
}


export function getApiErrorMessage(error) {
    console.error("API Error Details:", error); // Log the full error for debugging

    let userMessage = 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.'; // Default

    if (error && typeof error.message === 'string') {
        const lowerCaseMessage = error.message.toLowerCase();

        if (lowerCaseMessage.includes('api key not valid')) {
            userMessage = 'Lỗi xác thực: API key không hợp lệ. Vui lòng liên hệ quản trị viên.';
        } else if (lowerCaseMessage.includes('safety') || lowerCaseMessage.includes('blocked')) {
            userMessage = 'Yêu cầu của bạn đã bị chặn vì lý do an toàn. Vui lòng điều chỉnh mô tả hoặc hình ảnh và thử lại.';
        } else if (error.message.includes('[400]')) {
            userMessage = 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại mô tả và hình ảnh. Mô hình có thể không hỗ trợ định dạng hoặc nội dung được cung cấp.';
        } else if (error.message.includes('[429]')) {
            userMessage = 'Bạn đã gửi quá nhiều yêu cầu trong một thời gian ngắn. Vui lòng đợi một lát rồi thử lại.';
        } else if (error.message.includes('[500]') || error.message.includes('[503]')) {
            userMessage = 'Máy chủ AI đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau giây lát.';
        } else if (lowerCaseMessage.includes('quota')) {
            userMessage = 'Đã đạt đến giới hạn quota của API. Vui lòng thử lại sau.';
        } else if (lowerCaseMessage.includes('deadline exceeded')) {
            userMessage = 'Yêu cầu đã hết thời gian chờ. Máy chủ có thể đang bận. Vui lòng thử lại.';
        } else if (lowerCaseMessage.includes('face')) { // Specific to ID photo, but can be generic
            userMessage = 'Không thể tìm thấy khuôn mặt trong ảnh hoặc khuôn mặt không đủ rõ. Vui lòng thử một bức ảnh khác.';
        }
        else {
            // Keep it clean for the user
            const cleanedMessage = error.message.replace(/\[.*?\]/g, '').trim();
            userMessage = `Đã xảy ra lỗi: ${cleanedMessage}`;
        }
    }
    
    return `<p class="error">${userMessage}</p>`;
}

/**
 * Processes the response from a Gemini image generation model (like gemini-flash-image).
 * @param {import('@google/genai').GenerateContentResponse} response The API response.
 * @returns {{textContent: string, errorMessage: string, imageUrl: string | null}}
 */
export function processImageGenerationResponse(response) {
    let textContent = '';
    let errorMessage = '';
    let imageUrl = null;

    if (response.candidates?.[0]) {
        const candidate = response.candidates[0];

        if (candidate.content?.parts?.length > 0) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                } else if (part.text) {
                    textContent += `<p>${part.text.replace(/\n/g, '<br>')}</p>`;
                }
            }
        } else if (candidate.finishReason) {
            switch (candidate.finishReason) {
                case 'SAFETY':
                    errorMessage = `<p class="error">Nội dung đã bị chặn do chính sách an toàn. Vui lòng thử một mô tả hoặc hình ảnh khác.</p>`;
                    break;
                case 'RECITATION':
                     errorMessage = `<p class="error">Nội dung đã bị chặn do chính sách về trích dẫn (recitation). Vui lòng thử một mô tả khác.</p>`;
                     break;
                case 'MAX_TOKENS':
                     errorMessage = `<p class="error">Không thể hoàn thành yêu cầu vì đã đạt đến giới hạn token. Vui lòng thử một mô tả ngắn gọn hơn.</p>`;
                     break;
                default:
                     errorMessage = `<p class="error">Không thể tạo nội dung. Lý do từ API: ${candidate.finishReason}. Vui lòng thử lại.</p>`;
            }
        }
    }

    if (!imageUrl && !textContent && !errorMessage) {
        errorMessage = `<p class="error">Không thể tạo nội dung. Mô hình đã không trả về kết quả hợp lệ hoặc phản hồi trống. Vui lòng thử lại.</p>`;
    }
    
    return { textContent, errorMessage, imageUrl };
}