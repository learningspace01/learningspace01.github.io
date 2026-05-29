/**
 * Flashcard Component — 3D 翻转单词卡片
 * Apple-style with smooth flip animation, touch gestures
 */

import { speakWord, speakSentence, isSpeechAvailable } from './speech.js';

// Track active Flashcard for keyboard focus
let activeFlashcard = null;

class Flashcard {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onFlip: options.onFlip || (() => {}),
      onRate: options.onRate || (() => {}),
      autoPlayAudio: options.autoPlayAudio ?? true,
      ...options,
    };
    this.isFlipped = false;
    this.word = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this._keyHandler = null;
    this.render();
    this.bindEvents();
    this.setActive();
  }

  setWord(word) {
    this.word = word;
    this.isFlipped = false;
    this.updateContent();
    this.card.classList.remove('flipped');

    // Auto-play pronunciation on new card
    if (this.options.autoPlayAudio && isSpeechAvailable()) {
      setTimeout(() => this.playAudio(), 300);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="flashcard-wrapper">
        <div class="flashcard" id="flashcard">
          <div class="flashcard-face flashcard-front">
            <div class="flashcard-content">
              <div class="flashcard-word" id="card-word"></div>
              <div class="flashcard-phonetic" id="card-phonetic"></div>
              <div class="flashcard-hint">点击翻转查看释义</div>
            </div>
            <button class="flashcard-audio-btn" id="card-audio" aria-label="发音">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-content">
              <div class="flashcard-meaning" id="card-meaning"></div>
              <div class="flashcard-definitions" id="card-definitions"></div>
              <div class="flashcard-tags" id="card-tags"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.card = this.container.querySelector('#flashcard');
    this.wordEl = this.container.querySelector('#card-word');
    this.phoneticEl = this.container.querySelector('#card-phonetic');
    this.meaningEl = this.container.querySelector('#card-meaning');
    this.definitionsEl = this.container.querySelector('#card-definitions');
    this.tagsEl = this.container.querySelector('#card-tags');
    this.audioBtn = this.container.querySelector('#card-audio');
  }

  updateContent() {
    if (!this.word) return;

    this.wordEl.textContent = this.word.word;
    this.phoneticEl.textContent = this.word.phonetic || '';
    this.meaningEl.textContent = this.word.meaning || '';

    // Definitions
    if (this.word.definitions && this.word.definitions.length > 0) {
      this.definitionsEl.innerHTML = this.word.definitions.map(def => `
        <div class="flashcard-definition">
          <span class="flashcard-pos">${def.pos}</span>
          <span class="flashcard-def">${def.def}</span>
          ${def.example ? `<div class="flashcard-example">${def.example}</div>` : ''}
        </div>
      `).join('');
    } else {
      this.definitionsEl.innerHTML = '';
    }

    // Tags
    if (this.word.tags && this.word.tags.length > 0) {
      this.tagsEl.innerHTML = this.word.tags.map(tag =>
        `<span class="badge badge-blue">${tag}</span>`
      ).join('');
    } else {
      this.tagsEl.innerHTML = '';
    }
  }

  bindEvents() {
    // Click to flip
    this.card.addEventListener('click', (e) => {
      // Don't flip if clicking audio button
      if (e.target.closest('#card-audio')) return;
      this.flip();
    });

    // Audio button
    this.audioBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playAudio();
    });

    // Touch gestures
    this.card.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.card.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > 60 && absDx > absDy) {
        e.preventDefault();
        if (dx > 0) {
          this.options.onRate?.('good');
        } else {
          this.options.onRate?.('again');
        }
      }
    }, { passive: false });
  }

  setActive() {
    // Remove previous active listener
    if (activeFlashcard && activeFlashcard !== this) {
      document.removeEventListener('keydown', activeFlashcard._keyHandler);
    }
    activeFlashcard = this;

    // Remove old handler if exists
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }

    // Keyboard support — only one active handler
    this._keyHandler = (e) => {
      if (!this.word) return;
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.flip();
          break;
        case 'ArrowLeft':
          this.options.onRate?.('again');
          break;
        case 'ArrowRight':
          this.options.onRate?.('good');
          break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (activeFlashcard === this) {
      activeFlashcard = null;
    }
  }

  flip() {
    this.isFlipped = !this.isFlipped;
    this.card.classList.toggle('flipped', this.isFlipped);
    this.options.onFlip?.(this.isFlipped);

    // Play example sentence when flipped
    if (this.isFlipped && this.word?.definitions?.[0]?.example) {
      setTimeout(() => {
        speakSentence(this.word.definitions[0].example).catch(() => {});
      }, 400);
    }
  }

  async playAudio() {
    if (!this.word) return;
    try {
      this.audioBtn.classList.add('playing');
      await speakWord(this.word.word);
      this.audioBtn.classList.remove('playing');
    } catch {
      this.audioBtn.classList.remove('playing');
    }
  }

  destroy() {
    // Cleanup if needed
  }
}

export { Flashcard };
