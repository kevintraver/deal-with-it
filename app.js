class DealWithItApp {
    constructor() {
        this.originalImage = null;
        this.processedImageUrl = null;
        this.lastUrlAttempt = null;
        this.errorMessage = null;

        // Centralized UI state
        // phase: idle | fetchingUrl | processing | done | error  
        // tab: file | url
        // Always start with file tab to ensure consistent state
        this.state = { phase: 'idle', tab: 'file' };
        
        this.initializeEventListeners();
        this.loadSavedApiKey();
        this.setupDragAndDrop();
        this.setupGlobalDragAndDrop();
        this.setupClipboardPaste();

        // Initial render
        this.render();
    }

    initializeEventListeners() {
        const imageInput = document.getElementById('imageInput');
        const uploadArea = document.getElementById('uploadArea');
        const copyBtn = document.getElementById('copyBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const newImageBtn = document.getElementById('newImageBtn');
        const retryBtn = document.getElementById('retryBtn');
        const apiKeyInput = document.getElementById('apiKey');
        const tabFile = document.getElementById('tabFile');
        const tabUrl = document.getElementById('tabUrl');
        const urlContent = document.getElementById('urlContent');
        const uploadContent = document.getElementById('uploadContent');
        const submitBtn = document.getElementById('submitBtn');
        const imageUrlInput = document.getElementById('imageUrlInput');
        
        imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        uploadArea.addEventListener('click', () => {
            // Only trigger if upload content is visible (not when image is displayed)
            if (!document.getElementById('uploadContent').classList.contains('hidden')) {
                // Check for API key before opening file picker
                const apiKey = document.getElementById('apiKey').value;
                if (!apiKey || !apiKey.trim()) {
                    this.showError('Please enter your Gemini API key first to process images. You can get one for free from Google AI Studio.');
                    // Focus on API key input
                    document.getElementById('apiKey').focus();
                    return;
                }
                imageInput.click();
            }
        });
        copyBtn.addEventListener('click', () => {
            if (!copyBtn.hasAttribute('disabled')) {
                this.copyImageToClipboard();
            }
        });
        downloadBtn.addEventListener('click', () => {
            if (!downloadBtn.hasAttribute('disabled')) {
                this.downloadImage();
            }
        });
        newImageBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to upload area
            if (!newImageBtn.hasAttribute('disabled')) {
                this.reset();
            }
        });
        retryBtn.addEventListener('click', () => this.retryProcessing());
        apiKeyInput.addEventListener('input', () => {
            this.saveApiKey();
            // Don't auto-hide errors when retry button is visible
            // Processing errors should only be dismissed by clicking "Try Again"
        });

        // Tabs
        tabFile.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTab('file');
        });
        tabUrl.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTab('url');
        });

        // Unified submit behavior
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isBusy()) return;
                const apiKey = document.getElementById('apiKey').value;
                if (!apiKey || !apiKey.trim()) {
                    this.showError('Please enter your Gemini API key first to process images. You can get one for free from Google AI Studio.');
                    document.getElementById('apiKey').focus();
                    return;
                }
                // If an image is already loaded, submit means process
                if (this.state.phase === 'imageLoaded' && this.originalImage) {
                    this.processImage();
                    return;
                }
                // Otherwise branch by tab
                if (this.state.tab === 'file') {
                    // Trigger file picker
                    imageInput.click();
                    return;
                }
                if (this.state.tab === 'url') {
                    const url = imageUrlInput.value;
                    if (!url || !url.trim()) {
                        this.showError('Please enter an image URL.');
                        imageUrlInput.focus();
                        return;
                    }
                    this.handleUrlFetch(url);
                }
            });
        }
        imageUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleUrlFetch(imageUrlInput.value);
            }
        });

        // Process button removed (unified submit handles processing)

        // Enter key submission for additional prompt
        const additionalPrompt = document.getElementById('additionalPrompt');
        additionalPrompt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // Enter without Shift submits (if image is loaded and not busy)
                if (this.state.phase === 'imageLoaded' && !this.isBusy() && this.originalImage) {
                    e.preventDefault();
                    this.processImage();
                }
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('bg-gray-100');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('bg-gray-100');
            }, false);
        });

        uploadArea.addEventListener('drop', this.handleDrop.bind(this), false);
    }

    setupGlobalDragAndDrop() {
        // Make entire document a drag zone
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, this.preventDefaults, false);
        });

        // Visual feedback for entire page
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, () => {
                document.body.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, () => {
                document.body.classList.remove('drag-active');
            }, false);
        });

        // Handle file drop on entire document
        document.addEventListener('drop', this.handleGlobalDrop.bind(this), false);
    }

    setupClipboardPaste() {
        // Listen for paste events on the document
        document.addEventListener('paste', this.handlePaste.bind(this));
    }

    async handlePaste(e) {
        // Only handle image paste on the File tab; let normal text paste elsewhere
        if (this.isBusy() || this.state.tab !== 'file') return;
        const items = e.clipboardData?.items;
        if (!items) return;

        // Look for image in clipboard
        for (let item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    this.handleImageFile(file);
                }
                break;
            }
        }
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        }
    }

    handleGlobalDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                this.handleImageFile(file);
            }
        }
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleImageFile(file);
        }
    }

    handleImageFile(file) {
        if (this.isBusy()) return; // Prevent actions during busy states
        // Check for API key first
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey || !apiKey.trim()) {
            this.showError('Please enter your Gemini API key first to process images. You can get one for free from Google AI Studio.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.setDisplayedImage(e.target.result);
                // Show the process button instead of auto-processing
                this.setState({ phase: 'imageLoaded' });
                // Focus on additional prompt field for convenience
                setTimeout(() => {
                    const promptField = document.getElementById('additionalPrompt');
                    if (promptField) promptField.focus();
                }, 100);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleUrlFetch(url) {
        if (this.isBusy()) return;
        const apiKey = document.getElementById('apiKey').value;
        const trimmedUrl = (url || '').trim();
        this.lastUrlAttempt = trimmedUrl || null;
        if (!apiKey || !apiKey.trim()) {
            this.showError('Please enter your Gemini API key first to process images. You can get one for free from Google AI Studio.', true);
            document.getElementById('apiKey').focus();
            return;
        }
        if (!trimmedUrl) {
            this.showError('Please enter an image URL.');
            return;
        }
        try {
            this.hideError();
            // Enter fetching state
            this.setState({ phase: 'fetchingUrl', tab: 'url' });
            this.setProcessingText('Fetching image...');

            // Try to fetch the image via our proxy to avoid CORS issues
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(trimmedUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch image from URL');
            }
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.startsWith('image/')) {
                throw new Error('URL does not point to an image');
            }
            const blob = await response.blob();

            // Create an object URL and Image element
            const objectUrl = URL.createObjectURL(blob);
            await this.loadImageFromSrc(objectUrl);
            
            // Revoke object URL after image loads
            URL.revokeObjectURL(objectUrl);

            // Show the process button instead of auto-processing
            this.setState({ phase: 'imageLoaded' });
            // Focus on additional prompt field for convenience
            setTimeout(() => {
                const promptField = document.getElementById('additionalPrompt');
                if (promptField) promptField.focus();
            }, 100);
        } catch (error) {
            console.error('URL fetch error:', error);
            this.showError(error.message || 'Failed to fetch image from URL. Some sites may block downloads.', true);
            this.setState({ phase: 'error', tab: 'url' });
            this.setProcessingText('');
        }
    }

    loadImageFromSrc(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.originalImage = img;
                this.setDisplayedImage(src);
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }
    
    setDisplayedImage(imageSrc) {
        const displayedImage = document.getElementById('displayedImage');
        displayedImage.src = imageSrc;
    }
    
    async processImage() {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) {
            this.showError('Please enter your Gemini API key');
            return;
        }
        
        this.setState({ phase: 'processing' });
        this.setProcessingText('Dealing with it...');
        this.hideError();
        
        try {
            // Convert current displayed image to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            ctx.drawImage(this.originalImage, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg').split(',')[1];
            
            // Get additional prompt if provided
            const additionalPrompt = document.getElementById('additionalPrompt').value.trim();
            let promptText = `Add cool "Deal With It" sunglasses to the person's face in this image. Make the sunglasses black and stylish, positioned perfectly over their eyes. Also add the text "DEAL WITH IT" at the bottom of the image in bold white letters with a black outline. Keep everything else in the image exactly the same - only add the sunglasses and text.`;
            
            // Append additional instructions if provided
            if (additionalPrompt) {
                promptText += ` Additional instructions: ${additionalPrompt}`;
            }
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: promptText
                            },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: imageData
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        responseModalities: ["IMAGE"]
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }
            
            const data = await response.json();
            
            // Find the image part in the response
            const imagePart = data.candidates[0].content.parts.find(part => part.inlineData);
            
            if (!imagePart) {
                throw new Error('No image returned from Gemini');
            }
            
            // Convert base64 to image and display
            const base64Image = imagePart.inlineData.data;
            const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64Image}`;
            
            // Store processed image URL for download
            this.processedImageUrl = imageUrl;
            
            // Replace the displayed image with the processed one
            this.setDisplayedImage(imageUrl);
            // Move to done state, which will reveal action buttons
            this.setState({ phase: 'done' });
            
        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message || 'Failed to process image. Please check your API key and try again.', true);
            this.setState({ phase: 'error' });
            this.setProcessingText('');
        } finally {
            // Render handles overlay visibility
        }
    }
    
    async copyImageToClipboard() {
        try {
            const imageUrl = this.processedImageUrl || document.getElementById('displayedImage').src;
            
            // Convert image to blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            // Copy to clipboard
            const type = blob.type || 'image/png';
            await navigator.clipboard.write([
                new ClipboardItem({ [type]: blob })
            ]);
            
            // Show success feedback
            const copyBtn = document.getElementById('copyBtn');
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="material-icons text-sm">check</span><span>Copied!</span>';
            copyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            copyBtn.classList.add('bg-green-600');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('bg-green-600');
                copyBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy image:', error);
            this.showError('Failed to copy image to clipboard');
        }
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = 'deal-with-it.png';
        // Use processed image if available, otherwise use original
        link.href = this.processedImageUrl || document.getElementById('displayedImage').src;
        link.click();
    }
    
    reset() {
        this.originalImage = null;
        this.processedImageUrl = null;
        this.lastUrlAttempt = null;
        this.errorMessage = null;
        
        // Clear inputs
        document.getElementById('imageInput').value = '';
        document.getElementById('imageUrlInput').value = '';
        document.getElementById('additionalPrompt').value = '';
        // Reset UI state, keeping current tab
        this.setState({ phase: 'idle' });
        this.hideError();
    }

    // State/Render helpers
    isBusy() {
        return this.state.phase === 'fetchingUrl' || this.state.phase === 'processing';
    }

    setProcessingText(text) {
        const el = document.getElementById('processingText');
        if (el) el.textContent = text || 'Dealing with it...';
    }

    setState(next) {
        this.state = { ...this.state, ...next };
        this.render();
    }

    render() {
        const { phase, tab } = this.state;
        const uploadContent = document.getElementById('uploadContent');
        const urlContent = document.getElementById('urlContent');
        const imageDisplay = document.getElementById('imageDisplay');
        const actionButtons = document.getElementById('actionButtons');
        const newImageBtn = document.getElementById('newImageBtn');
        const overlay = document.getElementById('processingOverlay');
        const uploadArea = document.getElementById('uploadArea');
        const tabFile = document.getElementById('tabFile');
        const tabUrl = document.getElementById('tabUrl');
        const submitBtnEl = document.getElementById('submitBtn');

        // Tabs styling/selection
        if (tab === 'file') {
            tabFile.classList.add('bg-white', 'shadow', 'text-gray-800');
            tabFile.setAttribute('aria-selected', 'true');
            tabUrl.classList.remove('bg-white', 'shadow', 'text-gray-800');
            tabUrl.setAttribute('aria-selected', 'false');
        } else {
            tabUrl.classList.add('bg-white', 'shadow', 'text-gray-800');
            tabUrl.setAttribute('aria-selected', 'true');
            tabFile.classList.remove('bg-white', 'shadow', 'text-gray-800');
            tabFile.setAttribute('aria-selected', 'false');
        }

        // Disable interactions while busy
        const disableCls = ['pointer-events-none', 'opacity-50'];
        [tabFile, tabUrl].forEach((el) => {
            if (this.isBusy()) el.classList.add(...disableCls); else el.classList.remove(...disableCls);
        });

        // Upload area pointer/hover and consistent idle height
        if (phase === 'idle') {
            uploadArea.classList.add('cursor-pointer', 'hover:bg-gray-50', 'border-dashed', 'flex', 'items-center', 'justify-center', 'h-[380px]');
            uploadArea.classList.remove('border-solid');
            uploadArea.classList.remove('pointer-events-none');
        } else {
            uploadArea.classList.remove('cursor-pointer', 'hover:bg-gray-50', 'border-dashed', 'h-[380px]');
            uploadArea.classList.add('border-solid');
            // Keep flex centering for images
            if (phase === 'imageLoaded' || phase === 'processing' || phase === 'done') {
                uploadArea.classList.add('flex', 'items-center', 'justify-center');
            } else {
                uploadArea.classList.remove('flex', 'items-center', 'justify-center');
            }
            // Only block interactions on the area while busy; allow buttons in done/error
            if (this.isBusy()) {
                uploadArea.classList.add('pointer-events-none');
            } else {
                uploadArea.classList.remove('pointer-events-none');
            }
        }

        // Submit button disabled state during busy
        if (submitBtnEl) {
            if (this.isBusy()) {
                submitBtnEl.setAttribute('disabled', 'true');
                submitBtnEl.classList.add('opacity-50', 'pointer-events-none');
            } else {
                submitBtnEl.removeAttribute('disabled');
                submitBtnEl.classList.remove('opacity-50', 'pointer-events-none');
            }
        }

        // Visibility by phase
        const showOverlay = phase === 'processing' || phase === 'fetchingUrl';
        if (showOverlay) overlay.classList.remove('hidden'); else overlay.classList.add('hidden');

        // Content panels
        if (phase === 'idle') {
            if (tab === 'file') {
                uploadContent.classList.remove('hidden');
                urlContent.classList.add('hidden');
            } else {
                urlContent.classList.remove('hidden');
                uploadContent.classList.add('hidden');
            }
            imageDisplay.classList.add('hidden');
            actionButtons.classList.add('hidden');
            newImageBtn.classList.add('hidden');
        } else if (phase === 'imageLoaded') {
            // Show image with process button
            uploadContent.classList.add('hidden');
            urlContent.classList.add('hidden');
            imageDisplay.classList.remove('hidden');
            actionButtons.classList.add('hidden');
            newImageBtn.classList.add('hidden');
        } else if (phase === 'processing' || phase === 'done' || (phase === 'error' && this.originalImage)) {
            // Show image whenever we have one (processing/done or error with original)
            uploadContent.classList.add('hidden');
            urlContent.classList.add('hidden');
            imageDisplay.classList.remove('hidden');
            
            // Always show action buttons but disable during processing
            actionButtons.classList.remove('hidden');
            newImageBtn.classList.remove('hidden');
            
            // Disable/enable buttons based on phase
            const copyBtn = document.getElementById('copyBtn');
            const downloadBtn = document.getElementById('downloadBtn');
            if (phase === 'processing') {
                // Disable buttons during processing
                [copyBtn, downloadBtn, newImageBtn].forEach(btn => {
                    if (btn) {
                        btn.setAttribute('disabled', 'true');
                        btn.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                });
            } else {
                // Enable buttons when done or error
                [copyBtn, downloadBtn, newImageBtn].forEach(btn => {
                    if (btn) {
                        btn.removeAttribute('disabled');
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                });
            }
        } else if (phase === 'error' && !this.originalImage) {
            // No image yet; show tab’s content to let user retry input
            imageDisplay.classList.add('hidden');
            actionButtons.classList.add('hidden');
            newImageBtn.classList.add('hidden');
            if (tab === 'file') {
                uploadContent.classList.remove('hidden');
                urlContent.classList.add('hidden');
            } else {
                urlContent.classList.remove('hidden');
                uploadContent.classList.add('hidden');
            }
        }

        // Unified submit container is always visible; no per-phase visibility toggles
    }

    switchTab(tab) {
        if (this.isBusy()) return; // Prevent switching during busy states
        const tabFile = document.getElementById('tabFile');
        const tabUrl = document.getElementById('tabUrl');
        const imageUrlInput = document.getElementById('imageUrlInput');

        // Reset inputs and image when switching tabs but keep phase idle
        this.reset();
        if (tab === 'url') imageUrlInput.value = '';
        this.setState({ tab, phase: 'idle' });

        // Auto-focus URL input when switching to URL tab (after render)
        if (tab === 'url') {
            setTimeout(() => {
                const urlInput = document.getElementById('imageUrlInput');
                if (urlInput) urlInput.focus();
            }, 60);
        }

        // No tab-specific visibility needed for submit button
    }

    showError(message, showRetry = false) {
        const errorEl = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const retryBtn = document.getElementById('retryBtn');
        
        errorText.textContent = message;
        errorEl.classList.remove('hidden');
        
        if (showRetry && (this.originalImage || this.lastUrlAttempt)) {
            retryBtn.classList.remove('hidden');
        } else {
            retryBtn.classList.add('hidden');
        }
    }
    
    hideError() {
        document.getElementById('errorMessage').classList.add('hidden');
        document.getElementById('retryBtn').classList.add('hidden');
    }

    retryProcessing() {
        this.hideError();
        if (this.originalImage) {
            this.processImage();
            return;
        }
        if (this.lastUrlAttempt) {
            this.handleUrlFetch(this.lastUrlAttempt);
        }
    }

    saveApiKey() {
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey.trim()) {
            localStorage.setItem('gemini-api-key', apiKey);
        }
    }

    loadSavedApiKey() {
        const savedApiKey = localStorage.getItem('gemini-api-key');
        if (savedApiKey) {
            document.getElementById('apiKey').value = savedApiKey;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DealWithItApp();
});
