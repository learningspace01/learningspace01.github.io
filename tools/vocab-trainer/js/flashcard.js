/**
 * Flashcard — Premium 3D flip card
 * Front: word + phonetic + pos badge + Chinese meaning
 * Back: multiple example sentences
 */

import { speakWord, speakSentence, isSpeechAvailable } from './speech.js';

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

    if (this.options.autoPlayAudio && isSpeechAvailable()) {
      setTimeout(() => this.playAudio(), 300);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="flashcard-wrapper">
        <div class="flashcard" id="flashcard">
          <!-- Front -->
          <div class="flashcard-face flashcard-front">
            <button class="flashcard-audio-btn" id="card-audio" aria-label="发音">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            </button>
            <div class="flashcard-inner">
              <div class="flashcard-word" id="card-word"></div>
              <div class="flashcard-phonetic" id="card-phonetic"></div>
              <div class="flashcard-pos-badge" id="card-pos"></div>
              <div class="flashcard-meaning-front" id="card-meaning-front"></div>
              <div class="flashcard-hint">轻触翻转 · 查看例句</div>
            </div>
          </div>
          <!-- Back: Examples -->
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-inner">
              <div class="flashcard-back-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                例句
              </div>
              <div class="flashcard-examples" id="card-examples"></div>
              <div class="flashcard-back-hint">轻触返回</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.card = this.container.querySelector('#flashcard');
    this.wordEl = this.container.querySelector('#card-word');
    this.phoneticEl = this.container.querySelector('#card-phonetic');
    this.posEl = this.container.querySelector('#card-pos');
    this.meaningFrontEl = this.container.querySelector('#card-meaning-front');
    this.examplesEl = this.container.querySelector('#card-examples');
    this.audioBtn = this.container.querySelector('#card-audio');
  }

  updateContent() {
    if (!this.word) return;

    // Front: word + phonetic + pos + meaning
    this.wordEl.textContent = this.word.word;
    this.phoneticEl.textContent = this.word.phonetic || '';

    const def = this.word.definitions?.[0];
    const pos = def?.pos || '';
    this.posEl.textContent = pos || '';

    this.meaningFrontEl.textContent = this.word.meaning || (def ? def.def : '') || '';

    // Back: examples
    const examples = this._collectExamples();
    if (examples.length > 0) {
      this.examplesEl.innerHTML = examples.map((ex, i) => `
        <div class="flashcard-example-item">
          <div class="flashcard-example-en">${i + 1}. ${this._escape(ex.en)}</div>
          ${ex.cn ? `<div class="flashcard-example-cn">${this._escape(ex.cn)}</div>` : ''}
        </div>
      `).join('');
    } else {
      this.examplesEl.innerHTML = `
        <div class="flashcard-example-item">
          <div class="flashcard-example-en">暂无例句</div>
        </div>
      `;
    }
  }

  _collectExamples() {
    const w = this.word;
    const examples = [];

    // 1. From word.examples array (preferred)
    if (w.examples && Array.isArray(w.examples)) {
      examples.push(...w.examples);
    }

    // 2. From definitions[n].example
    if (w.definitions && Array.isArray(w.definitions)) {
      for (const d of w.definitions) {
        if (d.example && !examples.some(e => e.en === d.example)) {
          examples.push({ en: d.example, cn: '' });
        }
      }
    }

    return examples.slice(0, 5); // max 5 examples
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  bindEvents() {
    this.card.addEventListener('click', (e) => {
      if (e.target.closest('#card-audio')) return;
      this.flip();
    });

    this.audioBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playAudio();
    });

    // Touch swipe
    this.card.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.card.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        this.options.onRate?.(dx > 0 ? 'good' : 'again');
      }
    }, { passive: false });
  }

  setActive() {
    if (activeFlashcard && activeFlashcard !== this) {
      document.removeEventListener('keydown', activeFlashcard._keyHandler);
    }
    activeFlashcard = this;

    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }

    this._keyHandler = (e) => {
      if (!this.word) return;
      switch (e.key) {
        case ' ': case 'Enter':
          e.preventDefault(); this.flip(); break;
        case 'ArrowLeft':
          this.options.onRate?.('again'); break;
        case 'ArrowRight':
          this.options.onRate?.('good'); break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (activeFlashcard === this) activeFlashcard = null;
  }

  flip() {
    this.isFlipped = !this.isFlipped;
    this.card.classList.toggle('flipped', this.isFlipped);
    this.options.onFlip?.(this.isFlipped);
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
}

export { Flashcard };
