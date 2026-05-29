/**
 * Theme Manager — Apple-style dark/light mode
 * Supports: system preference, manual toggle, persistence via localStorage
 */

const THEME_KEY = 'ls01_theme';

class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'auto';
    this.applyTheme(this.currentTheme);
    this.setupListeners();
  }

  getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    const effective = this.getEffectiveTheme();

    document.documentElement.setAttribute('data-theme', effective);
    this.setStoredTheme(theme);

    // Dispatch event for components that need to react
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: effective, setting: theme }
    }));
  }

  toggle() {
    const effective = this.getEffectiveTheme();
    const next = effective === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
  }

  setAuto() {
    this.applyTheme('auto');
  }

  setupListeners() {
    // Listen for system preference changes when in auto mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
  }

  // Utility to get theme-aware color values for Canvas/SVG
  getColor(name) {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim();
  }
}

// Singleton instance
const themeManager = new ThemeManager();

export { ThemeManager, themeManager };
