# Deal With It 😎

A modern web app that automatically adds the iconic "Deal With It" sunglasses to any photo using AI. Built with vanilla HTML/CSS/JavaScript and powered by Google's Gemini 2.5 Flash Image API.

## Features

- 🖼️ **Multiple Upload Methods**: Drag & drop, paste from clipboard (Ctrl/⌘+V), or browse files
- 🤖 **AI-Powered**: Uses Google Gemini 2.5 Flash Image API to intelligently add sunglasses and text
- 📋 **Clipboard Integration**: Copy processed images directly to clipboard
- 💾 **Download Support**: Save your memes as PNG files
- 🔒 **Privacy First**: API keys stored locally in your browser
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚡ **Fast Processing**: Optimized for quick meme generation

## How to Use

1. **Get a Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your free API key
2. **Enter API Key**: Paste it in the input field (it's saved locally for future use)
3. **Upload Image**: 
   - Drag & drop anywhere on the page
   - Paste from clipboard (Ctrl/⌘+V)
   - Click "Choose File" button
4. **Auto-Magic**: The app automatically adds sunglasses and "DEAL WITH IT" text
5. **Share**: Copy to clipboard or download the result

### Shareable Links (Auto-fill API Key)

You can prefill the API key via URL parameters so non-technical folks can just click a link:

- Use any of: `apiKey`, `apikey`, or `key`
- Example: `https://your-domain.com/?apiKey=YOUR_GEMINI_API_KEY`

Notes:
- The app saves the provided key to the browser's local storage.
- For safety, the key is removed from the URL bar immediately after loading (using `history.replaceState`).
- Passing secrets in URLs can still appear in browser history or server logs. Share with caution.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Tailwind), JavaScript
- **AI**: Google Gemini 2.5 Flash Image API
- **Icons**: Material Icons
- **Fonts**: Google Fonts (Poppins)
- **Analytics**: Vercel Analytics
- **Deployment**: Vercel

## Local Development

1. Clone the repository
2. Open `index.html` in your browser
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Start creating memes!

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kevintraver/deal-with-it)
