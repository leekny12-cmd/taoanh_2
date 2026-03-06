/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { renderGenerateTab, handleGenerateClick, updateGenerateButtonState } from './src/tabs/generate.js';
import { renderBackgroundTab, handleChangeBackgroundClick, updateChangeBackgroundBtnState } from './src/tabs/background.js';
import { renderRestoreTab, handleRestoreClick, updateRestoreButtonState } from './src/tabs/restore.js';
import { renderInpaintTab, handleInpaintClick, updateInpaintButtonState } from './src/tabs/inpaint.js';
import { renderPromptMakerTab } from './src/tabs/promptMaker.js';
import { renderIdPhotoTab, handleIdPhotoClick, updateIdPhotoButtonState } from './src/tabs/idPhoto.js';
import { renderTravelTab, handleTravelClick, updateTravelButtonState } from './src/tabs/travel.js';


import { updateQuotaDisplay } from './src/shared/quota.js';
import { initUI, clearOutput } from './src/shared/ui.js';
import { generatedImagesHistory, lastGeneratedImageUrl, setLastGeneratedImageUrl } from './src/shared/state.js';


// App state
let activeTab: 'generate' | 'background' | 'restore' | 'inpaint' | 'prompt-maker' | 'id-photo' | 'travel' = 'generate';
let activeOutputTab: 'result' | 'history' = 'result';

// Common DOM Element references
let outputEl: HTMLElement;
let historyEl: HTMLElement;
let tabContentEl: HTMLElement;

/**
 * Initializes the application, sets up the DOM, and attaches event listeners.
 */
function App() {
    document.body.innerHTML = `
        <div class="app-wrapper">
            <header class="top-header">
                <div class="header-section">
                    <h1>HAIART AI GENERATOR</h1>
                </div>
                <div class="tabs">
                    <button id="tab-generate" class="tab-button active" data-tab="generate">Tạo ảnh AI</button>
                    <button id="tab-background" class="tab-button" data-tab="background">Thay nền ảnh</button>
                    <button id="tab-restore" class="tab-button" data-tab="restore">Phục hồi ảnh cũ</button>
                    <button id="tab-inpaint" class="tab-button" data-tab="inpaint">Inpaint</button>
                    <button id="tab-prompt-maker" class="tab-button" data-tab="prompt-maker">Prompt Maker</button>
                    <button id="tab-id-photo" class="tab-button" data-tab="id-photo">Ảnh thẻ 3Xu</button>
                    <button id="tab-travel" class="tab-button" data-tab="travel">Ảnh du lịch</button>
                </div>
                <div id="quota-display" class="quota-display"></div>
            </header>
            <main>
                <div class="input-section">
                    <div id="tab-content"></div>
                </div>
                <div class="output-container">
                    <div class="output-tabs">
                        <button id="output-tab-result" class="output-tab-button active" data-tab="result">Kết quả</button>
                        <button id="output-tab-history" class="output-tab-button" data-tab="history">Ảnh đã tạo</button>
                    </div>
                    <div class="output-content-wrapper">
                         <section id="output" class="output-section" aria-live="polite">
                            <div class="placeholder">
                                <p>Ảnh của bạn sẽ xuất hiện ở đây.</p>
                            </div>
                        </section>
                        <section id="history" class="output-section hidden" aria-live="polite">
                            <div id="history-gallery" class="history-gallery">
                                <div class="placeholder">
                                    <p>Các ảnh bạn tạo trong phiên này sẽ xuất hiện ở đây.</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            <footer class="bottom-footer">
                <div class="header-buttons">
                    <div class="header-buttons-scroller">
                        <!-- Original Set -->
                        <a href="https://nguyenhoanghai1605.github.io/haiart" target="_blank" class="header-link-btn">APP ẢNH SẢN PHẨM PREMIUM</a>
                        <button class="header-link-btn js-prompt-library-btn">THƯ VIỆN PROMPT FREE!</button>
                        <a href="https://zalo.me" target="_blank" class="header-link-btn">NHÓM HỖ TRỢ AI</a>
                        <a href="https://www.facebook.com" target="_blank" class="header-link-btn">DỊCH VỤ ẢNH AI CHUYÊN NGHIỆP</a>
                        <!-- Duplicated Set for seamless loop -->
                        <a href="https://nguyenhoanghai1605.github.io/haiart" target="_blank" class="header-link-btn">APP ẢNH SẢN PHẨM PREMIUM</a>
                        <button class="header-link-btn js-prompt-library-btn">THƯ VIỆN PROMPT FREE!</button>
                        <a href="https://zalo.me" target="_blank" class="header-link-btn">NHÓM HỖ TRỢ AI</a>
                        <a href="https://www.facebook.com" target="_blank" class="header-link-btn">DỊCH VỤ ẢNH AI CHUYÊN NGHIỆP</a>
                    </div>
                </div>
                <div class="theme-switcher">
                    <button id="theme-menu-toggle" class="theme-menu-toggle" aria-haspopup="true" aria-expanded="false" title="Chọn giao diện">
                        <div id="current-theme-indicator" class="theme-indicator"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                           <path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>
                        </svg>
                    </button>
                    <div id="theme-menu" class="theme-menu" role="menu">
                        <button class="theme-menu-item" role="menuitem" data-theme="theme-green-life">
                            <div class="theme-indicator theme-green-life"></div>
                            <span>Green Life</span>
                        </button>
                        <button class="theme-menu-item" role="menuitem" data-theme="theme-blue-ocean">
                            <div class="theme-indicator theme-blue-ocean"></div>
                            <span>Blue Ocean</span>
                        </button>
                        <button class="theme-menu-item" role="menuitem" data-theme="theme-dark-red">
                            <div class="theme-indicator theme-dark-red"></div>
                            <span>Dark Red</span>
                        </button>
                        <button class="theme-menu-item" role="menuitem" data-theme="theme-grey-light">
                            <div class="theme-indicator theme-grey-light"></div>
                            <span>Grey Light</span>
                        </button>
                    </div>
                </div>
            </footer>
        </div>
        <div id="zoom-modal" class="modal">
            <span id="modal-close-btn" class="modal-close" aria-label="Đóng chế độ xem phóng to">&times;</span>
            <img class="modal-content" id="zoomed-img" alt="Ảnh đã phóng to">
        </div>
        <div id="prompt-library-modal" class="modal">
            <div class="prompt-modal-inner">
                <span id="prompt-modal-close-btn" class="modal-close" aria-label="Đóng thư viện prompt">&times;</span>
                <iframe id="prompt-library-iframe" title="Thư viện Prompt"></iframe>
            </div>
        </div>
    `;

    // Get references to common DOM elements
    outputEl = document.getElementById('output')!;
    historyEl = document.getElementById('history')!;
    const zoomModalEl = document.getElementById('zoom-modal')!;
    const zoomedImgEl = document.getElementById('zoomed-img') as HTMLImageElement;
    const modalCloseBtnEl = document.getElementById('modal-close-btn')!;
    tabContentEl = document.getElementById('tab-content')!;

    // Prompt Library Modal elements
    const promptLibraryModalEl = document.getElementById('prompt-library-modal')!;
    const promptLibraryIframeEl = document.getElementById('prompt-library-iframe') as HTMLIFrameElement;
    const promptModalCloseBtnEl = document.getElementById('prompt-modal-close-btn')!;

    // Initialize shared UI module
    initUI(outputEl, zoomModalEl, zoomedImgEl, modalCloseBtnEl, handleRegenerateClick, switchOutputTab);
    
    /**
     * Handles incoming messages from the iframe window to paste prompts.
     */
    function handleIncomingPrompt(event: MessageEvent) {
        // IMPORTANT: Check the origin of the message for security.
        if (event.origin !== 'https://taoanhez.com') {
            return;
        }

        // We expect the data to be the prompt string.
        if (typeof event.data !== 'string' || event.data.trim() === '') {
            return;
        }

        const promptText = event.data;
        let targetEl: HTMLTextAreaElement | HTMLInputElement | null = null;

        switch (activeTab) {
            case 'generate':
                targetEl = document.getElementById('prompt-input') as HTMLTextAreaElement;
                break;
            case 'background':
                // Only paste if there's no background image uploaded
                const bgPromptEl = document.getElementById('background-prompt-input') as HTMLTextAreaElement;
                if (bgPromptEl && !bgPromptEl.disabled) {
                    targetEl = bgPromptEl;
                }
                break;
            case 'inpaint':
                targetEl = document.getElementById('inpaint-prompt-input') as HTMLTextAreaElement;
                break;
            case 'prompt-maker':
                targetEl = document.getElementById('pm-context') as HTMLTextAreaElement;
                break;
        }

        if (targetEl) {
            targetEl.value = promptText;
            targetEl.dispatchEvent(new Event('input', { bubbles: true })); // Trigger UI updates
            targetEl.focus();
            closePromptLibraryModal(); // Close the modal for a smooth workflow
        }
    }

    // Main Tab switching logic
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const tabName = target.dataset.tab as typeof activeTab;
            if (tabName !== activeTab) {
                activeTab = tabName;
                document.querySelector('.tab-button.active')?.classList.remove('active');
                target.classList.add('active');
                renderActiveTab();
            }
        });
    });
    
    // Output Tab switching logic
    document.querySelectorAll('.output-tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            const tabName = target.dataset.tab as 'result' | 'history';
            switchOutputTab(tabName);
        });
    });

    // --- Prompt Library Modal Logic ---
    function openPromptLibraryModal() {
        promptLibraryIframeEl.src = 'https://nguyenhoanghai1605.github.io/haiart/';
        promptLibraryModalEl.style.display = 'flex';
    }

    function closePromptLibraryModal() {
        promptLibraryModalEl.style.display = 'none';
        promptLibraryIframeEl.src = 'about:blank'; // Stop loading to save resources
    }

    const handlePromptLibraryClick = () => {
        // A simple check for mobile devices based on screen width.
        // On mobile, iframes can have usability issues (like copying text),
        // so opening in a new tab is a better experience.
        const isMobile = window.innerWidth < 1024;

        if (isMobile) {
            window.open('https://nguyenhoanghai1605.github.io/haiart/', '_blank');
        } else {
            openPromptLibraryModal();
        }
    };

    document.querySelectorAll('.js-prompt-library-btn').forEach(button => {
        button.addEventListener('click', handlePromptLibraryClick);
    });

    promptModalCloseBtnEl.addEventListener('click', closePromptLibraryModal);
    promptLibraryModalEl.addEventListener('click', (event) => {
        if (event.target === promptLibraryModalEl) {
            closePromptLibraryModal();
        }
    });

    // --- Theme Switcher Logic ---
    const THEME_STORAGE_KEY = 'habu-ai-theme';

    const themeSwitcherEl = document.querySelector('.theme-switcher')!;
    const themeMenuToggleEl = document.getElementById('theme-menu-toggle') as HTMLButtonElement;
    const themeMenuEl = document.getElementById('theme-menu')!;
    const currentThemeIndicatorEl = document.getElementById('current-theme-indicator')!;

    function applyTheme(themeName: string) {
        document.body.classList.remove('theme-green-life', 'theme-blue-ocean', 'theme-dark-red', 'theme-grey-light');
        document.body.classList.add(themeName);
        currentThemeIndicatorEl.className = `theme-indicator ${themeName}`;
        closeThemeMenu();
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
    }

    function openThemeMenu() {
        themeMenuEl.classList.add('open');
        themeMenuToggleEl.setAttribute('aria-expanded', 'true');
    }

    function closeThemeMenu() {
        themeMenuEl.classList.remove('open');
        themeMenuToggleEl.setAttribute('aria-expanded', 'false');
    }

    themeMenuToggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = themeMenuToggleEl.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            closeThemeMenu();
        } else {
            openThemeMenu();
        }
    });

    document.querySelectorAll('.theme-menu-item').forEach(button => {
        button.addEventListener('click', () => {
            const themeName = (button as HTMLButtonElement).dataset.theme;
            if (themeName) {
                applyTheme(themeName);
            }
        });
    });

    window.addEventListener('click', (event) => {
        if (!themeSwitcherEl.contains(event.target as Node)) {
            closeThemeMenu();
        }
    });

    function loadInitialTheme() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        // Default to 'theme-green-life' if nothing is saved
        const initialTheme = savedTheme || 'theme-green-life';
        applyTheme(initialTheme);
    }
    
    window.addEventListener('message', handleIncomingPrompt, false);

    loadInitialTheme(); // Set theme on startup
    updateQuotaDisplay(); // Initial quota display
    setInterval(updateQuotaDisplay, 5000); // Periodically update quota display
    renderActiveTab(); // Render the initial active tab
}

/**
 * Switches between the 'Result' and 'History' tabs in the output column.
 */
function switchOutputTab(tabName: 'result' | 'history') {
    if (tabName === activeOutputTab) return;
    activeOutputTab = tabName;

    document.querySelector('.output-tab-button.active')?.classList.remove('active');
    document.getElementById(`output-tab-${tabName}`)?.classList.add('active');

    if (tabName === 'history') {
        outputEl.classList.add('hidden');
        historyEl.classList.remove('hidden');
        renderHistoryGallery();
    } else {
        historyEl.classList.add('hidden');
        outputEl.classList.remove('hidden');
    }
}

/**
 * Renders the gallery of generated images.
 */
function renderHistoryGallery() {
    const galleryEl = document.getElementById('history-gallery');
    if (!galleryEl) return;

    if (generatedImagesHistory.length === 0) {
        galleryEl.innerHTML = `
            <div class="placeholder">
                <p>Các ảnh bạn tạo trong phiên này sẽ xuất hiện ở đây.</p>
            </div>
        `;
        return;
    }

    galleryEl.innerHTML = '';
    generatedImagesHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `<img src="${item.url}" alt="Ảnh đã tạo" loading="lazy">`;
        historyItem.addEventListener('click', () => {
            setLastGeneratedImageUrl(item.url);
            // We need to re-import renderOutput here to avoid circular dependencies
            // A better way is to have a centralized event bus, but for this refactor, let's keep it simple.
            // We can just re-render the image in the output pane and switch.
            outputEl.innerHTML = `<div class="output-content"><img src="${item.url}" alt="Ảnh đã tạo" class="generated-image"></div>`;
            const content = outputEl.innerHTML;
            import('./src/shared/ui.js').then(ui => {
                ui.renderOutput(content);
            });
            switchOutputTab('result');
        });
        galleryEl.appendChild(historyItem);
    });
}

/**
 * Renders the UI for the currently active tab.
 */
function renderActiveTab() {
    switch (activeTab) {
        case 'generate':
            renderGenerateTab(tabContentEl);
            break;
        case 'background':
            renderBackgroundTab(tabContentEl);
            break;
        case 'restore':
            renderRestoreTab(tabContentEl);
            break;
        case 'inpaint':
            renderInpaintTab(tabContentEl);
            break;
        case 'prompt-maker':
            renderPromptMakerTab(tabContentEl);
            break;
        case 'id-photo':
            renderIdPhotoTab(tabContentEl);
            break;
        case 'travel':
            renderTravelTab(tabContentEl);
            break;
    }
}

/**
 * A centralized handler for the "Regenerate" button that calls the appropriate
 * handler based on the currently active tab.
 */
export function handleRegenerateClick() {
    switch (activeTab) {
        case 'generate':
            handleGenerateClick();
            break;
        case 'background':
            handleChangeBackgroundClick();
            break;
        case 'restore':
            handleRestoreClick();
            break;
        case 'inpaint':
            handleInpaintClick();
            break;
        case 'id-photo':
            handleIdPhotoClick();
            break;
        case 'travel':
            handleTravelClick();
            break;
        // No regenerate for prompt maker
    }
}

/**
 * A centralized function to update button states, typically after a quota change.
 */
export function updateActiveTabButtonState() {
     switch (activeTab) {
        case 'generate':
            updateGenerateButtonState();
            break;
        case 'background':
            updateChangeBackgroundBtnState();
            break;
        case 'restore':
            updateRestoreButtonState();
            break;
        case 'inpaint':
            updateInpaintButtonState();
            break;
        case 'id-photo':
            updateIdPhotoButtonState();
            break;
        case 'travel':
            updateTravelButtonState();
            break;
    }
}


// Start the application
App();