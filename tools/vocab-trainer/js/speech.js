/**
 * Text-to-Speech wrapper — Web Speech API
 * Provides Apple-style pronunciation with voice selection fallback
 */

let synth = null;
let voices = [];
let preferredVoice = null;

function initSpeech() {
  if (typeof window === 'undefined') return false;
  synth = window.speechSynthesis;
  if (!synth) return false;

  // Load voices
  function loadVoices() {
    voices = synth.getVoices();
    // Prefer: 1) Google US English, 2) Samantha (macOS), 3) Any en-US, 4) Any en
    preferredVoice =
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.name === 'Samantha') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];
  }

  loadVoices();

  // Chrome loads voices asynchronously
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }

  return true;
}

/**
 * Speak a word or sentence
 * @param {string} text — text to speak
 * @param {object} options — { rate: 0.8-1.2, pitch: 0.8-1.2 }
 * @returns {Promise} resolves when speaking finishes
 */
function speak(text, options = {}) {
  return new Promise((resolve, reject) => {
    if (!synth) {
      if (!initSpeech()) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice?.lang || 'en-US';
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    synth.speak(utterance);
  });
}

/**
 * Quick helper: speak a word with natural pause
 * @param {string} word
 * @returns {Promise}
 */
function speakWord(word) {
  return speak(word, { rate: 0.85, pitch: 1.0 });
}

/**
 * Quick helper: speak an example sentence
 * @param {string} sentence
 * @returns {Promise}
 */
function speakSentence(sentence) {
  return speak(sentence, { rate: 0.85, pitch: 1.0 });
}

/**
 * Check if TTS is available
 * @returns {boolean}
 */
function isSpeechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get available voices list (for settings)
 * @returns {Array} [{ name, lang }]
 */
function getAvailableVoices() {
  if (!synth) initSpeech();
  return voices.map(v => ({ name: v.name, lang: v.lang }));
}

export {
  speak,
  speakWord,
  speakSentence,
  isSpeechAvailable,
  getAvailableVoices,
  initSpeech,
};
