// script.js

// Get DOM elements
const settingsButton = document.getElementById('settings-button');
const settingsMenu = document.getElementById('settings-menu');
const closeSettingsButton = document.getElementById('close-settings-button');
const apiKeyInput = document.getElementById('api-key');
const modelSelection = document.getElementById('model-selection');
const transcriptionModelSelection = document.getElementById('transcription-model-selection');
const contentModerationToggle = document.getElementById('content-moderation');
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const maxTokensInput = document.getElementById('max-tokens');
const temperatureInput = document.getElementById('temperature');
const topPInput = document.getElementById('top-p');
const apiKeyModal = document.getElementById('api-key-modal');
const modalApiKeyInput = document.getElementById('modal-api-key');
const modalSaveApiKeyButton = document.getElementById('modal-save-api-key');
const voiceInputButton = document.getElementById('voice-input-button');
const imageUploadArea = document.getElementById('image-upload-area');
const imageInput = document.getElementById('image-input');
const fileUploadButton = document.getElementById('file-upload-button');
const fileInput = document.getElementById('file-input');

// Initialize global variables
let hasModerationModel = false;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let conversationHistory = []; // To keep track of the conversation

// SVG Icons with Updated Class for Recording Animation
const microphoneIcon = `<img src="/assets/microphone.svg" alt="Microphone Icon" class="h-6 w-6 object-contain"/>`;

// **Added 'recording-animation' class to apply CSS animation only to the recording icon**
const recordingIcon = `<img src="/assets/recording.svg" alt="Recording Icon" class="h-6 w-6 object-contain recording-animation"/>`;

// On page load, check if API key exists
document.addEventListener('DOMContentLoaded', () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        showApiKeyPrompt();
    } else {
        apiKeyInput.value = apiKey; // Fill in the settings field for convenience
        fetchModels();
    }
});

// Show API Key Prompt Modal
function showApiKeyPrompt() {
    apiKeyModal.classList.remove('hidden');
    modalApiKeyInput.focus();
}

// Save API Key from Modal
modalSaveApiKeyButton.addEventListener('click', () => {
    const apiKey = modalApiKeyInput.value.trim();
    if (apiKey) {
        storeApiKey(apiKey);
        apiKeyModal.classList.add('hidden');
        fetchModels();
    } else {
        alert('Please enter a valid API key.');
    }
});

// Store API key in localStorage
function storeApiKey(apiKey) {
    localStorage.setItem('groq_api_key', apiKey);
    console.log('API key stored in localStorage');
    apiKeyInput.value = apiKey; // Update the settings menu input
}

// Retrieve API key from localStorage
function getApiKey() {
    return localStorage.getItem('groq_api_key');
}

// Fetch models from GroqCloud API
async function fetchModels() {
    const apiKey = getApiKey();
    if (!apiKey) {
        return false;
    }
    const url = 'https://api.groq.com/openai/v1/models';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });
        if (!response.ok) { // Changed from response.status !== 200 for broader success range
            alert(`Failed to fetch models. Status code: ${response.status}`);
            return false;
        }
        const result = await response.json();
        if (result.error) {
            const errorMessage = result.error.message;
            alert(`Error fetching models: ${errorMessage}`);
            return false;
        }
        // Populate models into the selection dropdowns
        populateModels(result.data);
        return true;
    } catch (error) {
        console.error('Error fetching models:', error);
        alert('An error occurred while fetching models.');
        return false;
    }
}

// Helper function to check if a model is a vision model, including "llava" models
function isVisionModel(modelId) {
    return modelId.includes('vision') || modelId.includes('llava');
}

// Populate models into the selection dropdowns
function populateModels(models) {
    modelSelection.innerHTML = '';
    transcriptionModelSelection.innerHTML = '';
    hasModerationModel = false;

    // Separate models by type
    const textModels = [];
    const visionModels = [];
    const sptModels = [];

    models.forEach(model => {
        const modelId = model.id || '';

        if (modelId === 'llama-guard-3-8b') {
            hasModerationModel = true;
        }

        if (isVisionModel(modelId)) {
            visionModels.push(modelId);
        } else if (modelId.includes('whisper') || modelId.includes('distil-whisper')) {
            sptModels.push(modelId);
        } else {
            textModels.push(modelId);
        }
    });

    // Populate main models
    populateModelOptions(modelSelection, textModels, visionModels, 'Text Models', 'Vision Models');

    // Populate transcription models
    populateModelOptions(transcriptionModelSelection, sptModels, [], 'Speech-to-Text Models', '');

    // Set default transcription model
    const defaultTranscriptionModel = 'whisper-large-v3-turbo';
    const defaultTranscriptionOption = transcriptionModelSelection.querySelector(`option[value="${defaultTranscriptionModel}"]`);
    if (defaultTranscriptionOption) {
        transcriptionModelSelection.value = defaultTranscriptionModel;
    } else if (transcriptionModelSelection.options.length > 0) {
        transcriptionModelSelection.selectedIndex = 0;
    }

    if (hasModerationModel) {
        contentModerationToggle.disabled = false;
        console.log("Moderation model available.");
    } else {
        contentModerationToggle.disabled = true;
        contentModerationToggle.checked = false;
        alert("Content Moderation model not available. Content moderation disabled.");
    }

    // Show or hide image upload area based on selected model
    toggleImageUploadArea();
}

// Helper function to populate model options
function populateModelOptions(selectionElement, primaryModels, secondaryModels, primaryLabel, secondaryLabel) {
    selectionElement.innerHTML = '';

    if (primaryModels.length > 0) {
        const primaryOptGroup = document.createElement('optgroup');
        primaryOptGroup.label = primaryLabel;

        primaryModels.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            primaryOptGroup.appendChild(option);
        });

        selectionElement.appendChild(primaryOptGroup);
    }

    if (secondaryModels.length > 0 && secondaryLabel) {
        const secondaryOptGroup = document.createElement('optgroup');
        secondaryOptGroup.label = secondaryLabel;

        secondaryModels.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            secondaryOptGroup.appendChild(option);
        });

        selectionElement.appendChild(secondaryOptGroup);
    }
}

// Adjust the upload button functionality based on the selected model
function toggleImageUploadArea() {
    const selectedModel = modelSelection.value;
    const isVision = isVisionModel(selectedModel);

    if (isVision) {
        imageUploadArea.classList.remove('hidden');
        // Disable the file upload button when a vision model is selected
        fileUploadButton.disabled = true;
        fileUploadButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        imageUploadArea.classList.add('hidden');
        // Enable the file upload button for non-vision models
        fileUploadButton.disabled = false;
        fileUploadButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// Listen for model selection changes
modelSelection.addEventListener('change', toggleImageUploadArea);

// Handle voice input
async function handleVoiceInput(event) {
    if (isRecording) {
        // Stop recording
        mediaRecorder.stop();
        // Replace the recording icon back to microphone icon
        voiceInputButton.innerHTML = microphoneIcon;
        isRecording = false;
    } else {
        // Start recording
        isRecording = true;
        // Replace the microphone icon with recording icon (which has animation)
        voiceInputButton.innerHTML = recordingIcon;

        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support audio recording.');
            // Revert the icon since recording cannot start
            voiceInputButton.innerHTML = microphoneIcon;
            isRecording = false;
            return;
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            showApiKeyPrompt();
            // Revert the icon since recording cannot proceed without API key
            voiceInputButton.innerHTML = microphoneIcon;
            isRecording = false;
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'voice_input.webm');

                // Get selected transcription model
                const speechModel = transcriptionModelSelection.value;
                if (!speechModel) {
                    alert('No speech-to-text model selected.');
                    return;
                }

                formData.append('model', speechModel);

                const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
                const headers = {
                    'Authorization': `Bearer ${apiKey}`
                };

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: formData
                    });
                    if (!response.ok) { // Changed from response.status !== 200 for broader success range
                        console.error('Speech-to-text request failed with status:', response.status);
                        appendMessage('System', 'Speech-to-text request failed.');
                        return;
                    }
                    const result = await response.json();
                    if (result.error) {
                        const errorMessage = result.error.message;
                        appendMessage('System', `Error: ${errorMessage}`);
                        return;
                    }
                    const transcription = result.text;

                    // **Modified Logic Starts Here**
                    // Check if userInput already has text
                    if (userInput.value.trim() !== '') {
                        // Append transcription to existing text with a space
                        userInput.value += ' ' + transcription;
                    } else {
                        // Insert transcription directly
                        userInput.value = transcription;
                    }
                    // **Modified Logic Ends Here**

                    // **Removed the automatic sendMessage() call to prevent auto-sending**
                    // sendMessage();
                } catch (error) {
                    console.error('Error during speech-to-text:', error);
                    appendMessage('System', 'An error occurred during speech-to-text.');
                }
            };

            mediaRecorder.start();

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('An error occurred while accessing the microphone.');
            // Revert the icon since recording failed
            voiceInputButton.innerHTML = microphoneIcon;
            isRecording = false;
        }
    }
}

// Function to send a message
async function sendMessage() {
    const message = userInput.value.trim();
    const files = fileInput.files;
    const images = imageInput.files;
    const model = modelSelection.value;
    const isVision = isVisionModel(model);

    // Check for empty input
    if (!message && images.length === 0 && files.length === 0) {
        alert('Please enter a message or upload a file.');
        return;
    }

    userInput.value = ''; // Clear input field

    const apiKey = getApiKey();
    if (!apiKey) {
        showApiKeyPrompt();
        return;
    }

    const maxTokens = parseInt(maxTokensInput.value) || 1000;
    const temperature = parseFloat(temperatureInput.value) || 1.0;
    const topP = parseFloat(topPInput.value) || 1.0;

    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const headers = {
        'Authorization': `Bearer ${apiKey}`
    };

    const messages = [...conversationHistory];

    if (isVision) {
        // Handle vision models by sending image file and messages using FormData
        const formData = new FormData();

        // Append the image file to FormData
        if (images.length > 0) {
            const imageFile = images[0]; // Assuming only one image is uploaded
            formData.append('file', imageFile, imageFile.name);
            appendMessage('User', `[Image: ${imageFile.name}]\n${message}`);
        } else {
            alert('Please upload an image for the vision model.');
            return;
        }

        // Append other necessary fields to FormData
        messages.push({ role: 'user', content: message });
        formData.append('model', model);
        formData.append('messages', JSON.stringify(messages));
        formData.append('max_tokens', maxTokens);
        formData.append('temperature', temperature);
        formData.append('top_p', topP);

        // Send the request without setting the 'Content-Type' header
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers, // Do not set 'Content-Type' when using FormData
                body: formData
            });
            if (!response.ok) { // Changed from response.status !== 200 for broader success range
                console.error('API request failed with status:', response.status);
                appendMessage('System', 'API request failed.');
                return;
            }
            const result = await response.json();
            if (result.error) {
                const errorMessage = result.error.message;
                appendMessage('System', `Error: ${errorMessage}`);
                return;
            }
            const aiMessage = result.choices[0].message.content;
            appendMessage('AI', aiMessage);
            conversationHistory.push({ role: 'assistant', content: aiMessage });
        } catch (error) {
            console.error('Error during API request:', error);
            appendMessage('System', 'An error occurred while communicating with the AI.');
        }
    } else {
        // Existing code for non-vision models
        if (files.length > 0) {
            let combinedMessage = message;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileContent = await readFileContent(file);
                combinedMessage += `\n[File: ${file.name}]\n${fileContent}\n`;
            }
            appendMessage('User', combinedMessage);
            messages.push({ role: 'user', content: combinedMessage });
            fileInput.value = ''; // Reset file input
        } else {
            appendMessage('User', message);
            messages.push({ role: 'user', content: message });
        }

        const body = {
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) { // Changed from response.status !== 200 for broader success range
                console.error('API request failed with status:', response.status);
                appendMessage('System', 'API request failed.');
                return;
            }
            const result = await response.json();
            if (result.error) {
                const errorMessage = result.error.message;
                appendMessage('System', `Error: ${errorMessage}`);
                return;
            }
            const aiMessage = result.choices[0].message.content;
            appendMessage('AI', aiMessage);
            conversationHistory.push({ role: 'assistant', content: aiMessage });
        } catch (error) {
            console.error('Error during API request:', error);
            appendMessage('System', 'An error occurred while communicating with the AI.');
        }
    }
}

// Helper function to read file content
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const fileType = file.type;
            let content = reader.result;

            // For image files, include a placeholder
            if (fileType.startsWith('image/')) {
                content = '[Image file content not displayed]';
            }

            resolve(content);
        };

        reader.onerror = () => {
            reject(reader.error);
        };

        // Read as text or data URL based on file type
        if (file.type.startsWith('text/') || file.name.match(/\.(py|js|java|c|cpp)$/)) {
            reader.readAsText(file);
        } else if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// Function to append messages to the chat box
function appendMessage(sender, message) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('mb-4');

    const senderLabel = document.createElement('div');
    senderLabel.classList.add('font-bold');
    senderLabel.textContent = sender;

    const messageContent = document.createElement('div');
    messageContent.classList.add('whitespace-pre-wrap');
    messageContent.textContent = message;

    messageContainer.appendChild(senderLabel);
    messageContainer.appendChild(messageContent);
    chatBox.appendChild(messageContainer);
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
}

// Event listener for the upload button
fileUploadButton.addEventListener('click', () => {
    fileInput.click();
});

// Provide UI feedback on file selection
fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files.length > 0) {
        let fileNames = [];
        for (let i = 0; i < files.length; i++) {
            fileNames.push(files[i].name);
        }
        // Provide UI feedback
        alert(`Selected files: ${fileNames.join(', ')}`);
    }
});

// Event listeners
sendButton.addEventListener('click', sendMessage);

settingsButton.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
    // Load stored API key into the settings input
    const storedApiKey = getApiKey();
    if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
    }
});

closeSettingsButton.addEventListener('click', () => {
    settingsMenu.classList.add('hidden');
});

// Save API key from settings menu
apiKeyInput.addEventListener('change', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        storeApiKey(apiKey);
        fetchModels();
    }
});

// Handle voice input button click
voiceInputButton.addEventListener('click', handleVoiceInput);

// Accessibility enhancements
userInput.setAttribute('aria-label', 'Message Input');
sendButton.setAttribute('aria-label', 'Send Message');
voiceInputButton.setAttribute('aria-label', 'Voice Input');
