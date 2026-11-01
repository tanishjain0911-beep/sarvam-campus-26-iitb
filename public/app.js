/**
 * Suno Accessible Reader Interface
 * Vanilla JS implementation compliant with briefs/T-ui.md and PLAN.md
 */

(() => {
  'use strict';

  // Language names mapping for accessible display
  const LANGUAGE_NAMES = {
    'en-IN': 'English (India)',
    'hi-IN': 'हिन्दी (Hindi)',
    'bn-IN': 'বাংলা (Bengali)',
    'gu-IN': 'ગુજરાતી (Gujarati)',
    'kn-IN': 'ಕನ್ನಡ (Kannada)',
    'ml-IN': 'മലയാളം (Malayalam)',
    'mr-IN': 'मराठी (Marathi)',
    'or-IN': 'ଓଡ଼ିଆ (Odia)',
    'pa-IN': 'ਪੰਜਾਬੀ (Punjabi)',
    'ta-IN': 'தமிழ் (Tamil)',
    'te-IN': 'తెలుగు (Telugu)'
  };

  // Sample texts for nontechnical readers
  const SAMPLE_TEXTS = {
    notice: 'Water supply notice: Routine maintenance on the main pipeline in Sector 4 is scheduled for tomorrow between 10:00 AM and 2:00 PM. Residents are advised to store necessary water in advance. Normal supply will resume by evening.',
    study: 'Photosynthesis is the process green plants use to convert sunlight, water, and carbon dioxide into oxygen and energy-rich sugars. Chlorophyll in leaves absorbs the light, supplying oxygen for life on Earth.',
    message: 'Hello neighbors! The community library book circle meets this Saturday at 4:00 PM in the community hall. Feel free to bring a friend, discuss stories, and pick out new books for the month.'
  };

  // DOM Elements
  const sourceText = document.getElementById('source-text');
  const charCounter = document.getElementById('char-counter');
  const sourceLang = document.getElementById('source-lang');
  const targetLang = document.getElementById('target-lang');
  const createAudioBtn = document.getElementById('create-audio-btn');
  const clearBtn = document.getElementById('clear-btn');
  const sampleButtons = document.querySelectorAll('.chip-btn');
  const readerForm = document.getElementById('reader-form');

  // Appearance Toolbar
  const toggleLargerTextBtn = document.getElementById('toggle-larger-text');
  const toggleHighContrastBtn = document.getElementById('toggle-high-contrast');

  // Health Notice Banner
  const healthBanner = document.getElementById('health-banner');
  const healthNoticeText = document.getElementById('health-notice-text');

  // Output Card & States
  const liveAnnouncer = document.getElementById('live-announcer');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const resultPanel = document.getElementById('result-panel');
  const errorAlert = document.getElementById('error-alert');
  const errorMessage = document.getElementById('error-message');
  const partialAlert = document.getElementById('partial-alert');
  const partialMessage = document.getElementById('partial-message');
  const retryAudioBtn = document.getElementById('retry-audio-btn');

  // Results & Audio Elements
  const resultBadge = document.getElementById('result-badge');
  const resultLangTag = document.getElementById('result-lang-tag');
  const outputText = document.getElementById('output-text');
  const copyTextBtn = document.getElementById('copy-text-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const audioSection = document.getElementById('audio-section');
  const audioPlayer = document.getElementById('audio-player');
  const speedButtons = document.querySelectorAll('.speed-btn');
  const downloadBtn = document.getElementById('download-btn');

  // Application State
  let currentAudioUrl = null;
  let currentAbortController = null;
  let currentPlaybackSpeed = 1.0;
  let isRequestInProgress = false;

  /**
   * Helper: Count Unicode code points properly (handling surrogate pairs)
   */
  function countCodePoints(str) {
    return Array.from(str || '').length;
  }

  /**
   * Screen reader announcer
   */
  function announce(message) {
    if (liveAnnouncer) {
      liveAnnouncer.textContent = '';
      // Small timeout ensures screen readers detect text change
      setTimeout(() => {
        liveAnnouncer.textContent = message;
      }, 50);
    }
  }

  /**
   * Appearance preference toggles
   * Stores preferences only in localStorage (never user text)
   */
  function initAppearancePreferences() {
    try {
      const isLargerText = localStorage.getItem('suno_larger_text') === 'true';
      if (isLargerText) {
        document.documentElement.classList.add('larger-text');
        toggleLargerTextBtn.setAttribute('aria-pressed', 'true');
      }

      const isHighContrast = localStorage.getItem('suno_high_contrast') === 'true';
      if (isHighContrast) {
        document.documentElement.classList.add('high-contrast');
        toggleHighContrastBtn.setAttribute('aria-pressed', 'true');
      }
    } catch {
      // Ignore localStorage availability errors
    }

    toggleLargerTextBtn.addEventListener('click', () => {
      const active = document.documentElement.classList.toggle('larger-text');
      toggleLargerTextBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      try {
        localStorage.setItem('suno_larger_text', active ? 'true' : 'false');
      } catch {}
      announce(active ? 'Larger text enabled.' : 'Larger text disabled.');
    });

    toggleHighContrastBtn.addEventListener('click', () => {
      const active = document.documentElement.classList.toggle('high-contrast');
      toggleHighContrastBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      try {
        localStorage.setItem('suno_high_contrast', active ? 'true' : 'false');
      } catch {}
      announce(active ? 'High contrast enabled.' : 'High contrast disabled.');
    });
  }

  /**
   * Update character counter and button validation
   */
  function updateCharacterCount() {
    const text = sourceText.value;
    const count = countCodePoints(text);
    charCounter.textContent = `${count} / 1000 characters`;

    if (count > 1000) {
      charCounter.classList.add('char-limit-exceeded');
      sourceText.setAttribute('aria-invalid', 'true');
      createAudioBtn.disabled = true;
    } else {
      charCounter.classList.remove('char-limit-exceeded');
      sourceText.removeAttribute('aria-invalid');
      createAudioBtn.disabled = (!text.trim() || isRequestInProgress);
    }
  }

  /**
   * Clean up old audio Blob URL to prevent memory leaks
   */
  function revokeAudioUrl() {
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.removeAttribute('src');
      audioPlayer.load();
    }
    if (downloadBtn) {
      downloadBtn.removeAttribute('href');
    }
  }

  /**
   * Reset the output panel back to the clean empty state
   */
  function showEmptyState() {
    revokeAudioUrl();
    emptyState.hidden = false;
    loadingState.hidden = true;
    resultPanel.hidden = true;
    errorAlert.hidden = true;
    partialAlert.hidden = true;
  }

  /**
   * Display loading state
   */
  function showLoadingState() {
    revokeAudioUrl();
    emptyState.hidden = true;
    loadingState.hidden = false;
    errorAlert.hidden = true;
    partialAlert.hidden = true;
    // Don't hide resultPanel completely if previous text was showing, but keep it quiet
    resultPanel.hidden = true;
    announce('Creating spoken audio. Please wait.');
  }

  /**
   * Display general error alert
   */
  function showErrorAlert(message) {
    revokeAudioUrl();
    loadingState.hidden = true;
    errorAlert.hidden = false;
    errorMessage.textContent = message;
    partialAlert.hidden = true;
    announce(`Error: ${message}`);
  }

  /**
   * Display partial error state (HTTP 502 with translated text)
   * The text remains visible, audio is cleared, retry is available
   */
  function showPartialError(text, targetLangCode, errorDetail, translated) {
    revokeAudioUrl();
    loadingState.hidden = true;
    emptyState.hidden = true;
    errorAlert.hidden = true;
    partialAlert.hidden = false;

    if (errorDetail) {
      partialMessage.textContent = `Text was prepared, but audio could not be generated: ${errorDetail}`;
    } else {
      partialMessage.textContent = 'Text was prepared, but voice generation could not be completed. You can read the prepared text below or try creating audio again.';
    }

    // Render returned text
    renderResultText(text, targetLangCode, Boolean(translated));
    // Hide audio section since audio failed
    audioSection.hidden = true;
    resultPanel.hidden = false;

    announce('Text prepared, but voice generation failed. You can read the text below.');
  }

  /**
   * Render result text safely using textContent
   */
  function renderResultText(text, targetLangCode, isTranslated) {
    outputText.textContent = text;
    outputText.setAttribute('lang', targetLangCode);

    if (isTranslated) {
      resultBadge.textContent = 'Translated text';
    } else {
      resultBadge.textContent = 'Original text';
    }

    const langLabel = LANGUAGE_NAMES[targetLangCode] || targetLangCode;
    resultLangTag.textContent = langLabel;
  }

  /**
   * Convert Base64 string to Blob
   */
  function base64ToBlob(base64, mimeType = 'audio/wav') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  /**
   * Handle successful response
   */
  function handleSuccess(data, targetLangCode) {
    revokeAudioUrl();
    loadingState.hidden = true;
    emptyState.hidden = true;
    errorAlert.hidden = true;
    partialAlert.hidden = true;

    // Render text
    renderResultText(data.text, targetLangCode, Boolean(data.translated));

    // Prepare audio blob
    if (data.audioBase64) {
      const mime = data.mimeType || 'audio/wav';
      const blob = base64ToBlob(data.audioBase64, mime);
      currentAudioUrl = URL.createObjectURL(blob);

      audioPlayer.src = currentAudioUrl;
      audioPlayer.playbackRate = currentPlaybackSpeed;
      audioSection.hidden = false;

      downloadBtn.href = currentAudioUrl;
      downloadBtn.download = 'suno-reading.wav';
    } else {
      audioSection.hidden = true;
    }

    resultPanel.hidden = false;
    announce('Spoken audio and text are ready.');
  }

  /**
   * Submit text for translation and TTS
   */
  async function submitReadRequest() {
    const text = sourceText.value.trim();
    if (!text || countCodePoints(text) > 1000) {
      return;
    }

    if (isRequestInProgress) {
      return; // Prevent duplicate requests
    }

    isRequestInProgress = true;
    createAudioBtn.disabled = true;
    createAudioBtn.setAttribute('aria-busy', 'true');
    showLoadingState();

    const srcLang = sourceLang.value;
    const tgtLang = targetLang.value;

    currentAbortController = new AbortController();

    try {
      const response = await fetch('/api/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          sourceLanguage: srcLang,
          targetLanguage: tgtLang
        }),
        signal: currentAbortController.signal
      });

      let responseData = null;
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }

      if (response.ok && responseData) {
        handleSuccess(responseData, tgtLang);
      } else if (response.status === 502 && responseData && responseData.text) {
        // Partial failure: translated text provided, speech failed
        showPartialError(responseData.text, tgtLang, responseData.error, responseData.translated);
      } else {
        const errorMsg = (responseData && responseData.error)
          ? responseData.error
          : `Request failed with server status ${response.status}.`;
        showErrorAlert(errorMsg);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request cancelled by user
        showEmptyState();
        announce('Request was cancelled.');
      } else {
        showErrorAlert('Unable to connect to the server. Please check your internet connection.');
      }
    } finally {
      isRequestInProgress = false;
      currentAbortController = null;
      createAudioBtn.removeAttribute('aria-busy');
      updateCharacterCount();
    }
  }

  /**
   * Reset / Clear editor and output
   */
  function handleClear() {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    sourceText.value = '';
    updateCharacterCount();
    showEmptyState();
    sourceText.focus();
    announce('Editor cleared.');
  }

  /**
   * Check backend server configuration health
   * GET /api/health -> { ok: true, configured: boolean }
   */
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        healthNoticeText.textContent = `Notice: Server responded with status ${res.status}. Voice generation may be unavailable.`;
        healthBanner.hidden = false;
        return;
      }
      const data = await res.json();
      if (data && data.configured === false) {
        healthNoticeText.textContent = 'Audio is not available yet. Ask the person hosting Suno to finish the voice setup.';
        healthBanner.hidden = false;
      } else {
        healthBanner.hidden = true;
      }
    } catch {
      healthNoticeText.textContent = 'Suno could not connect. Please check your connection or ask the person hosting this reader for help.';
      healthBanner.hidden = false;
    }
  }

  /**
   * Copy output text to clipboard
   */
  async function copyOutputText() {
    const text = outputText.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copyBtnText.textContent = 'Copied!';
      setTimeout(() => {
        copyBtnText.textContent = 'Copy text';
      }, 2000);
      announce('Text copied to clipboard.');
    } catch {
      // Fallback
      copyBtnText.textContent = 'Selected';
      announce('Unable to automatically copy. Please copy manually.');
    }
  }

  /**
   * Playback speed selection handler
   */
  function setPlaybackSpeed(rate) {
    currentPlaybackSpeed = rate;
    if (audioPlayer) {
      audioPlayer.playbackRate = rate;
    }
    speedButtons.forEach(btn => {
      const btnRate = parseFloat(btn.dataset.speed);
      const isActive = Math.abs(btnRate - rate) < 0.01;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /**
   * Initialize event listeners
   */
  function initEvents() {
    // Textarea input count
    sourceText.addEventListener('input', updateCharacterCount);

    // Form submission
    readerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitReadRequest();
    });

    createAudioBtn.addEventListener('click', (e) => {
      e.preventDefault();
      submitReadRequest();
    });

    // Clear button
    clearBtn.addEventListener('click', handleClear);

    // Retry audio button
    if (retryAudioBtn) {
      retryAudioBtn.addEventListener('click', submitReadRequest);
    }

    // Sample chip buttons
    sampleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const sampleKey = btn.dataset.sample;
        const text = SAMPLE_TEXTS[sampleKey];
        if (text) {
          sourceText.value = text;
          sourceLang.value = 'en-IN';
          updateCharacterCount();
          sourceText.focus();
          announce(`Loaded sample: ${btn.textContent}`);
        }
      });
    });

    // Playback speed buttons
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.dataset.speed);
        if (!isNaN(rate)) {
          setPlaybackSpeed(rate);
        }
      });
    });

    // Reapply playback rate if audio loads/changes
    audioPlayer.addEventListener('loadedmetadata', () => {
      audioPlayer.playbackRate = currentPlaybackSpeed;
    });

    // Copy text button
    copyTextBtn.addEventListener('click', copyOutputText);
  }

  // Initialize
  initAppearancePreferences();
  initEvents();
  updateCharacterCount();
  checkHealth();
})();
