class DealWithItApp {
    constructor() {
        this.originalImage = null;
        this.processedImageUrl = null;
        
        this.initializeEventListeners();
        this.loadSavedApiKey();
        this.setupDragAndDrop();
        this.setupGlobalDragAndDrop();
        this.setupClipboardPaste();
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
                this.displayImage(e.target.result);
                
                // Auto-process since API key is validated
                setTimeout(() => {
                    this.processImage();
                }, 500);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleUrlFetch(url) {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey || !apiKey.trim()) {
            this.showError('Please enter your Gemini API key first to process images. You can get one for free from Google AI Studio.');
            return;
        }
        if (!url || !url.trim()) {
            this.showError('Please enter an image URL.');
            return;
        }
        try {
            this.hideError();
            this.showProcessingOverlay(true);

            // Try to fetch the image via our proxy to avoid CORS issues
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
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

            // Process while overlay remains visible; processing will hide it
            await this.processImage();
        } catch (error) {
            console.error('URL fetch error:', error);
            this.showError(error.message || 'Failed to fetch image from URL. Some sites may block downloads.');
            this.showProcessingOverlay(false);
        }
    }

    loadImageFromSrc(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.originalImage = img;
                this.displayImage(src);
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }
    
    displayImage(imageSrc) {
        // Hide upload content and show image
        document.getElementById('uploadContent').classList.add('hidden');
        document.getElementById('imageDisplay').classList.remove('hidden');
        
        // Set the image source
        const displayedImage = document.getElementById('displayedImage');
        displayedImage.src = imageSrc;
        
        // Remove cursor pointer and hover effect when showing image
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.remove('cursor-pointer', 'hover:bg-gray-50');
        uploadArea.classList.add('border-solid');
    }
    
    async processImage() {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) {
            this.showError('Please enter your Gemini API key');
            return;
        }
        
        this.showProcessingOverlay(true);
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
            this.displayImage(imageUrl);
            
            // Show action buttons after processing is complete
            this.showActionButtons();
            
        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message || 'Failed to process image. Please check your API key and try again.', true);
        } finally {
            this.showProcessingOverlay(false);
        }
    }
    
    async copyImageToClipboard() {
        try {
            const imageUrl = this.processedImageUrl || document.getElementById('displayedImage').src;
            
            // Convert image to blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
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
        
        // Reset UI to initial state
        document.getElementById('uploadContent').classList.remove('hidden');
        document.getElementById('imageDisplay').classList.add('hidden');
        document.getElementById('actionButtons').classList.add('hidden');
        document.getElementById('newImageBtn').classList.add('hidden');
        document.getElementById('imageInput').value = '';
        
        // Restore upload area styling
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.add('cursor-pointer', 'hover:bg-gray-50');
        uploadArea.classList.remove('border-solid');
        uploadArea.classList.add('border-dashed');
        
        this.hideError();
    }
    
    showProcessingOverlay(show) {
        const overlay = document.getElementById('processingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    switchTab(tab) {
        const tabFile = document.getElementById('tabFile');
        const tabUrl = document.getElementById('tabUrl');
        const urlContent = document.getElementById('urlContent');
        const uploadContent = document.getElementById('uploadContent');
        const uploadArea = document.getElementById('uploadArea');

        if (tab === 'file') {
            // Style tabs
            tabFile.classList.add('bg-white', 'shadow', 'text-gray-800');
            tabFile.setAttribute('aria-selected', 'true');
            tabUrl.classList.remove('bg-white', 'shadow', 'text-gray-800');
            tabUrl.setAttribute('aria-selected', 'false');

            // Show file upload, hide URL
            uploadContent.classList.remove('hidden');
            urlContent.classList.add('hidden');

            // Restore pointer/hover for upload area
            uploadArea.classList.add('cursor-pointer', 'hover:bg-gray-50');
        } else {
            tabUrl.classList.add('bg-white', 'shadow', 'text-gray-800');
            tabUrl.setAttribute('aria-selected', 'true');
            tabFile.classList.remove('bg-white', 'shadow', 'text-gray-800');
            tabFile.setAttribute('aria-selected', 'false');

            // Show URL input, hide file upload
            urlContent.classList.remove('hidden');
            uploadContent.classList.add('hidden');
        }
    }

    showActionButtons() {
        document.getElementById('actionButtons').classList.remove('hidden');
        document.getElementById('newImageBtn').classList.remove('hidden');
    }
    
    showError(message, showRetry = false) {
        const errorEl = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const retryBtn = document.getElementById('retryBtn');
        
        errorText.textContent = message;
        errorEl.classList.remove('hidden');
        
        if (showRetry && this.originalImage) {
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
        if (this.originalImage) {
            this.hideError();
            this.processImage();
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