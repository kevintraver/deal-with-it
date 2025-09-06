class DealWithItApp {
    constructor() {
        this.originalImage = null;
        this.processedImageUrl = null;
        this.lastUrlAttempt = null;
        this.errorMessage = null;

        // Centralized UI state
        // phase: idle | fetchingUrl | processing | done | error
        // tab: file | url
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
        const fetchUrlBtn = document.getElementById('fetchUrlBtn');
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
        copyBtn.addEventListener('click', () => this.copyImageToClipboard());
        downloadBtn.addEventListener('click', () => this.downloadImage());
        newImageBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to upload area
            this.reset();
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

        // URL fetch
        fetchUrlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleUrlFetch(imageUrlInput.value);
        });
        imageUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleUrlFetch(imageUrlInput.value);
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
                // Immediately enter processing state to avoid flashing
                this.setState({ phase: 'processing' });
                this.processImage();
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

            // Transition to processing and continue
            this.setState({ phase: 'processing' });
            this.setProcessingText('Adding sunglasses...');
            await this.processImage();
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
        this.setProcessingText('Adding sunglasses...');
        this.hideError();
        
        try {
            // Convert current displayed image to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            ctx.drawImage(this.originalImage, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg').split(',')[1];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Add cool "Deal With It" sunglasses to the person's face in this image. Make the sunglasses black and stylish, positioned perfectly over their eyes. Also add the text "DEAL WITH IT" at the bottom of the image in bold white letters with a black outline. Keep everything else in the image exactly the same - only add the sunglasses and text.`
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
        if (el) el.textContent = text || 'Adding sunglasses...';
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
        const fetchUrlBtn = document.getElementById('fetchUrlBtn');

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

        // Upload area pointer/hover
        if (phase === 'idle') {
            uploadArea.classList.add('cursor-pointer', 'hover:bg-gray-50', 'border-dashed');
            uploadArea.classList.remove('border-solid');
            uploadArea.classList.remove('pointer-events-none');
        } else {
            uploadArea.classList.remove('cursor-pointer', 'hover:bg-gray-50', 'border-dashed');
            uploadArea.classList.add('border-solid');
            // Only block interactions on the area while busy; allow buttons in done/error
            if (this.isBusy()) {
                uploadArea.classList.add('pointer-events-none');
            } else {
                uploadArea.classList.remove('pointer-events-none');
            }
        }

        // Fetch button disabled state during busy
        if (fetchUrlBtn) {
            if (this.isBusy()) {
                fetchUrlBtn.setAttribute('disabled', 'true');
                fetchUrlBtn.classList.add('opacity-50', 'pointer-events-none');
            } else {
                fetchUrlBtn.removeAttribute('disabled');
                fetchUrlBtn.classList.remove('opacity-50', 'pointer-events-none');
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
        } else if (phase === 'processing' || phase === 'done' || (phase === 'error' && this.originalImage)) {
            // Show image whenever we have one (processing/done or error with original)
            uploadContent.classList.add('hidden');
            urlContent.classList.add('hidden');
            imageDisplay.classList.remove('hidden');
            if (phase === 'done') {
                actionButtons.classList.remove('hidden');
                newImageBtn.classList.remove('hidden');
            } else {
                actionButtons.classList.add('hidden');
                newImageBtn.classList.add('hidden');
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
