class DealWithItApp {
    constructor() {
        this.originalImage = null;
        this.processedImageUrl = null;
        this.imageLoaded = false;
        this.activeTab = 'file'; // 'file' or 'url'
        
        this.initializeEventListeners();
        this.loadSavedApiKey();
        this.setupDragAndDrop();
        this.setupClipboardPaste();
        this.updateSubmitButtonState();
        this.updateTabDisplay();
    }

    initializeEventListeners() {
        // Core elements
        const imageInput = document.getElementById('imageInput');
        const apiKeyInput = document.getElementById('apiKey');
        const submitBtn = document.getElementById('submitBtn');
        const additionalPrompt = document.getElementById('additionalPrompt');
        
        // Tab buttons
        const uploadFileBtn = document.getElementById('uploadFileBtn');
        const uploadUrlBtn = document.getElementById('uploadUrlBtn');
        
        // Upload area elements
        const fileUploadContent = document.getElementById('fileUploadContent');
        const urlUploadContent = document.getElementById('urlUploadContent');
        const loadUrlBtn = document.getElementById('loadUrlBtn');
        const imageUrlInput = document.getElementById('imageUrlInput');
        
        // Image area
        const changeImageBtn = document.getElementById('changeImageBtn');
        
        // Action buttons
        const copyBtn = document.getElementById('copyBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        // API Key
        apiKeyInput.addEventListener('input', () => {
            this.saveApiKey();
            this.updateSubmitButtonState();
        });
        
        // Tab switching
        uploadFileBtn?.addEventListener('click', () => {
            this.activeTab = 'file';
            if (this.imageLoaded) {
                // If image is loaded, switching tabs should allow new upload
                this.resetForNewImage();
            } else {
                this.updateTabDisplay();
            }
        });
        uploadUrlBtn?.addEventListener('click', () => {
            this.activeTab = 'url';
            if (this.imageLoaded) {
                // If image is loaded, switching tabs should allow new upload
                this.resetForNewImage();
            } else {
                this.updateTabDisplay();
            }
        });
        
        // File upload
        imageInput?.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // Make file upload area clickable
        fileUploadContent?.addEventListener('click', () => {
            if (!this.imageLoaded) {
                imageInput.click();
            }
        });
        
        // URL loading
        loadUrlBtn?.addEventListener('click', () => this.handleUrlLoad());
        imageUrlInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleUrlLoad();
            }
        });
        
        // Change image button
        changeImageBtn?.addEventListener('click', () => this.resetForNewImage());
        
        // Submit button
        submitBtn?.addEventListener('click', () => this.processImage());
        
        // Action buttons
        copyBtn?.addEventListener('click', () => this.copyImageToClipboard());
        downloadBtn?.addEventListener('click', () => this.downloadImage());
        
        // Enter key in additional prompt
        additionalPrompt?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && this.imageLoaded) {
                e.preventDefault();
                this.processImage();
            }
        });
    }
    
    updateTabDisplay() {
        const uploadFileBtn = document.getElementById('uploadFileBtn');
        const uploadUrlBtn = document.getElementById('uploadUrlBtn');
        const fileUploadContent = document.getElementById('fileUploadContent');
        const urlUploadContent = document.getElementById('urlUploadContent');
        
        if (this.activeTab === 'file') {
            // Active file tab
            uploadFileBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg bg-white shadow text-gray-800 w-full text-center';
            uploadFileBtn.setAttribute('aria-selected', 'true');
            
            // Inactive URL tab
            uploadUrlBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg text-gray-600 hover:text-gray-800 w-full text-center';
            uploadUrlBtn.setAttribute('aria-selected', 'false');
            
            // Show/hide content
            fileUploadContent.classList.remove('hidden');
            urlUploadContent.classList.add('hidden');
        } else {
            // Active URL tab
            uploadUrlBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg bg-white shadow text-gray-800 w-full text-center';
            uploadUrlBtn.setAttribute('aria-selected', 'true');
            
            // Inactive file tab
            uploadFileBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg text-gray-600 hover:text-gray-800 w-full text-center';
            uploadFileBtn.setAttribute('aria-selected', 'false');
            
            // Show/hide content
            urlUploadContent.classList.remove('hidden');
            fileUploadContent.classList.add('hidden');
            
            // Focus URL input
            setTimeout(() => {
                document.getElementById('imageUrlInput').focus();
            }, 100);
        }
    }
    
    setupDragAndDrop() {
        const fileUploadContent = document.getElementById('fileUploadContent');
        
        // Prevent defaults for drag events on entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Handle drop on file upload area
        if (fileUploadContent) {
            fileUploadContent.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    // Switch to file tab if not already
                    this.activeTab = 'file';
                    this.updateTabDisplay();
                    this.handleImageFile(files[0]);
                }
            });
            
            // Visual feedback for drag over
            ['dragenter', 'dragover'].forEach(eventName => {
                fileUploadContent.addEventListener(eventName, () => {
                    const dragArea = fileUploadContent.querySelector('.border-dashed');
                    dragArea.classList.add('border-indigo-500', 'bg-indigo-50');
                });
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                fileUploadContent.addEventListener(eventName, () => {
                    const dragArea = fileUploadContent.querySelector('.border-dashed');
                    dragArea.classList.remove('border-indigo-500', 'bg-indigo-50');
                });
            });
        }
    }
    
    setupClipboardPaste() {
        document.addEventListener('paste', (e) => {
            // Don't intercept paste in text inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        // Switch to file tab
                        this.activeTab = 'file';
                        this.updateTabDisplay();
                        this.handleImageFile(file);
                    }
                    break;
                }
            }
        });
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleImageFile(file);
        }
    }
    
    handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayImage(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    async handleUrlLoad() {
        const urlInput = document.getElementById('imageUrlInput');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showError('Please enter an image URL');
            return;
        }
        
        try {
            // Show loading state
            const loadBtn = document.getElementById('loadUrlBtn');
            const originalText = loadBtn.textContent;
            loadBtn.textContent = 'Loading...';
            loadBtn.disabled = true;
            
            // Try to load the image directly first
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const imageLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
            });
            
            img.src = url;
            const loadedImg = await imageLoaded;
            
            // Create canvas to get the image data
            const canvas = document.createElement('canvas');
            canvas.width = loadedImg.width;
            canvas.height = loadedImg.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(loadedImg, 0, 0);
            
            this.originalImage = loadedImg;
            this.displayImage(canvas.toDataURL());
            
            loadBtn.textContent = originalText;
            loadBtn.disabled = false;
            
        } catch (error) {
            this.showError('Failed to load image from URL. Please check the URL and try again.');
            const loadBtn = document.getElementById('loadUrlBtn');
            loadBtn.textContent = 'Load Image';
            loadBtn.disabled = false;
        }
    }
    
    displayImage(src) {
        const uploadArea = document.getElementById('uploadArea');
        const imageArea = document.getElementById('imageArea');
        const displayedImage = document.getElementById('displayedImage');
        const actionButtons = document.getElementById('actionButtons');
        
        // Hide upload area, show image
        uploadArea.classList.add('hidden');
        imageArea.classList.remove('hidden');
        displayedImage.src = src;
        
        // Hide action buttons initially (until processed)
        actionButtons.classList.add('hidden');
        
        this.imageLoaded = true;
        this.processedImageUrl = null;
        this.updateSubmitButtonState();
        
        // Keep tabs visible and functional
        this.updateTabDisplay();
        
        // Focus on additional prompt
        setTimeout(() => {
            document.getElementById('additionalPrompt').focus();
        }, 100);
    }
    
    resetForNewImage() {
        const uploadArea = document.getElementById('uploadArea');
        const imageArea = document.getElementById('imageArea');
        const actionButtons = document.getElementById('actionButtons');
        const imageInput = document.getElementById('imageInput');
        const imageUrlInput = document.getElementById('imageUrlInput');
        const additionalPrompt = document.getElementById('additionalPrompt');
        const submitBtn = document.getElementById('submitBtn');
        
        // Reset state
        this.originalImage = null;
        this.processedImageUrl = null;
        this.imageLoaded = false;
        
        // Reset UI
        uploadArea.classList.remove('hidden');
        imageArea.classList.add('hidden');
        actionButtons.classList.add('hidden');
        imageInput.value = '';
        imageUrlInput.value = '';
        additionalPrompt.value = '';
        submitBtn.textContent = 'Deal with it';
        
        this.updateSubmitButtonState();
        this.updateTabDisplay();
        this.hideError();
    }
    
    async processImage() {
        const apiKey = document.getElementById('apiKey').value;
        const additionalPrompt = document.getElementById('additionalPrompt').value;
        
        if (!apiKey) {
            this.showError('Please enter your Gemini API key');
            document.getElementById('apiKey').focus();
            return;
        }
        
        if (!this.originalImage) {
            this.showError('Please upload an image first');
            return;
        }
        
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.textContent;
        
        try {
            // Show processing state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="animate-spin">⚙️</span> Processing...';
            
            // Create canvas and get base64
            const canvas = document.createElement('canvas');
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.originalImage, 0, 0);
            
            const imageData = canvas.toDataURL('image/jpeg').split(',')[1];
            
            // Build prompt
            let promptText = `Add cool "Deal With It" sunglasses to the person's face in this image. Make the sunglasses black and stylish, positioned perfectly over their eyes and adjusted to match the shape of their face, the angle of their head, and the perspective of the photo. The sunglasses should align naturally with their facial orientation and viewing direction. Also add the text "DEAL WITH IT" at the bottom of the image in bold white letters with a black outline. Keep everything else in the image exactly the same - only add the sunglasses and text.`;
            
            if (additionalPrompt.trim()) {
                promptText += ` Additional instructions: ${additionalPrompt.trim()}`;
            }
            
            // Call Gemini API
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptText },
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
            const processedBase64 = imagePart.inlineData.data;
            const processedUrl = `data:${imagePart.inlineData.mimeType};base64,${processedBase64}`;
            
            this.processedImageUrl = processedUrl;
            document.getElementById('displayedImage').src = processedUrl;
            
            // Show action buttons
            document.getElementById('actionButtons').classList.remove('hidden');
            
            // Update submit button
            submitBtn.innerHTML = '✨ Try Again with New Instructions';
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('Processing failed:', error);
            this.showError(error.message || 'Failed to process image');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
    
    async copyImageToClipboard() {
        try {
            const imgSrc = this.processedImageUrl || document.getElementById('displayedImage').src;
            const response = await fetch(imgSrc);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            
            // Show success feedback
            const copyBtn = document.getElementById('copyBtn');
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="material-icons mr-2">check</span>Copied!';
            copyBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            copyBtn.classList.add('bg-green-500');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('bg-green-500');
                copyBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showError('Failed to copy image to clipboard');
        }
    }
    
    downloadImage() {
        const link = document.createElement('a');
        link.download = 'deal-with-it.png';
        link.href = this.processedImageUrl || document.getElementById('displayedImage').src;
        link.click();
    }
    
    updateSubmitButtonState() {
        const submitBtn = document.getElementById('submitBtn');
        const apiKey = document.getElementById('apiKey').value;
        
        if (this.imageLoaded && apiKey) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }
    
    hideError() {
        document.getElementById('errorMessage').classList.add('hidden');
    }
    
    loadSavedApiKey() {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            document.getElementById('apiKey').value = savedKey;
            this.updateSubmitButtonState();
        }
    }
    
    saveApiKey() {
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey) {
            localStorage.setItem('gemini_api_key', apiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DealWithItApp();
});