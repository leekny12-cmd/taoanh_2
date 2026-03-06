import { lastGeneratedImageUrl, addGeneratedImageToHistory, setLastGeneratedImageUrl } from './state.js';

let outputEl;
let zoomModalEl;
let zoomedImgEl;
let onRegenerate;
let onSwitchOutputTab;

export function initUI(
    outputElement,
    zoomModalElement,
    zoomedImgElement,
    modalCloseBtnElement,
    regenerateCallback,
    switchOutputTabCallback,
) {
    outputEl = outputElement;
    zoomModalEl = zoomModalElement;
    zoomedImgEl = zoomedImgElement;
    onRegenerate = regenerateCallback;
    onSwitchOutputTab = switchOutputTabCallback;

    modalCloseBtnElement.addEventListener('click', closeZoomModal);
    zoomModalEl.addEventListener('click', (event) => {
        if (event.target === zoomModalEl) {
            closeZoomModal();
        }
    });
}

function handleZoomClick() {
    if (lastGeneratedImageUrl) {
        zoomedImgEl.src = lastGeneratedImageUrl;
        zoomModalEl.style.display = 'flex';
    }
}

function closeZoomModal() {
    zoomModalEl.style.display = 'none';
}

function handleDownloadClick() {
    if (lastGeneratedImageUrl) {
        const a = document.createElement('a');
        a.href = lastGeneratedImageUrl;
        a.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

function handleDownloadResizedClick() {
    if (!lastGeneratedImageUrl) return;

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minSide = 400;
        let newWidth, newHeight;

        if (img.width < img.height) {
            newWidth = minSide;
            newHeight = img.height * (minSide / img.width);
        } else {
            newHeight = minSide;
            newWidth = img.width * (minSide / img.height);
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        const dataUrl = canvas.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `generated-image-resized-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    img.onerror = () => {
        console.error("Không thể tải ảnh để thay đổi kích thước.");
    };
    img.src = lastGeneratedImageUrl;
}

export function clearOutput() {
    if (!outputEl) return;
    onSwitchOutputTab('result');
    outputEl.innerHTML = `
        <div class="placeholder">
            <p>Ảnh của bạn sẽ xuất hiện ở đây.</p>
        </div>
    `;
    setLastGeneratedImageUrl(null);
}

export function renderOutput(content) {
    if (!outputEl) return;
    onSwitchOutputTab('result');
    
    if (!content.trim()) {
        clearOutput();
        return;
    }

    let finalHtml;
    if (lastGeneratedImageUrl) {
        addGeneratedImageToHistory(lastGeneratedImageUrl);
        finalHtml = `
            <div class="output-content">
                ${content}
            </div>
            <div class="output-actions">
                <button id="zoom-btn" class="action-btn" aria-label="Phóng to ảnh">Phóng to</button>
                <button id="regenerate-btn" class="action-btn" aria-label="Tạo lại ảnh">Tạo lại</button>
                <button id="download-btn" class="action-btn" aria-label="Tải xuống ảnh">Tải xuống</button>
                <button id="download-resize-btn" class="action-btn" aria-label="Tải xuống ảnh đã đổi kích thước">Tải xuống (đã đổi kích thước)</button>
            </div>
            <button id="clear-btn" class="clear-btn">Xóa</button>
        `;
    } else {
         finalHtml = `
            <div class="output-content">
                ${content}
            </div>
            <button id="clear-btn" class="clear-btn">Xóa</button>
        `;
    }

    outputEl.innerHTML = finalHtml;

    document.getElementById('zoom-btn')?.addEventListener('click', handleZoomClick);
    document.getElementById('regenerate-btn')?.addEventListener('click', onRegenerate);
    document.getElementById('download-btn')?.addEventListener('click', handleDownloadClick);
    document.getElementById('download-resize-btn')?.addEventListener('click', handleDownloadResizedClick);
    document.getElementById('clear-btn')?.addEventListener('click', clearOutput);
}
