import { updateActiveTabButtonState } from '../../index.js';

export const QUOTA_CONFIG = {
    generate: { key: 'quota_generate_v2', limit: 60, period: 60 * 60 * 1000, name: 'Tạo ảnh' },
};

export function getQuotaState(type) {
    const config = QUOTA_CONFIG[type];
    const storedValue = localStorage.getItem(config.key);
    const now = Date.now();

    if (storedValue) {
        const state = JSON.parse(storedValue);
        if (now > state.resetTime) {
            // Period expired, reset
            const newState = { count: config.limit, resetTime: now + config.period };
            localStorage.setItem(config.key, JSON.stringify(newState));
            return newState;
        }
        return state;
    } else {
        // No stored value, initialize
        const newState = { count: config.limit, resetTime: now + config.period };
        localStorage.setItem(config.key, JSON.stringify(newState));
        return newState;
    }
}

export function useQuota(type) {
    const config = QUOTA_CONFIG[type];
    const state = getQuotaState(type);
    const newState = { ...state, count: Math.max(0, state.count - 1) };
    localStorage.setItem(config.key, JSON.stringify(newState));
    updateQuotaDisplay();
    // Re-check button states after using quota
    updateActiveTabButtonState();
}

export function updateQuotaDisplay() {
    const displayEl = document.getElementById('quota-display');
    if (!displayEl) return;

    const generateState = getQuotaState('generate');
    const timeLeftMs = Math.max(0, generateState.resetTime - Date.now());
    
    let timeLeftText = '';
    if (timeLeftMs > 60000) {
        const minutes = Math.ceil(timeLeftMs / 60000);
        timeLeftText = `${minutes} phút`;
    } else {
        const seconds = Math.ceil(timeLeftMs / 1000);
        timeLeftText = `${seconds} giây`;
    }

    const tooltipText = "Giới hạn tạo ảnh FREE là 250 lượt/ngày (Thời gian reset ngày là khoảng 14.00 giờ VN). và 60 lượt/60 phút. Bộ đếm chỉ mang tính tham khảo vì nó chỉ đếm lượt tạo trong ứng dụng này và sẽ reset nếu trang được tải lại.";
    displayEl.title = tooltipText;
    displayEl.innerHTML = `
        <span>Lượt ${QUOTA_CONFIG.generate.name}: <b>${generateState.count}/${QUOTA_CONFIG.generate.limit}</b> (làm mới sau ${timeLeftText})</span>
    `;
}