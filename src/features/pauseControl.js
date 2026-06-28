/**
 * pauseControl.js
 * "Market Halt / Resume" — Feature 5.
 * Pausing freezes the render scheduler (DOM updates stop) while stream
 * ingestion continues in the background. Resuming flushes the accumulated state.
 */

import { RenderScheduler } from '../state/renderScheduler.js';

let _btnEl     = null;
let _statusEl  = null;

export const PauseControl = {
  mount(containerEl) {
    containerEl.innerHTML = `
      <button class="halt-btn" id="halt-btn">
        <span class="halt-icon">⏸</span> Halt Market
      </button>
      <span class="halt-status" id="halt-status"></span>
    `;
    _btnEl    = document.getElementById('halt-btn');
    _statusEl = document.getElementById('halt-status');

    _btnEl.addEventListener('click', () => {
      if (RenderScheduler.isPaused()) {
        RenderScheduler.resume();
        _updateUI(false);
      } else {
        RenderScheduler.pause();
        _updateUI(true);
      }
    });
  },
};

function _updateUI(paused) {
  if (!_btnEl) return;
  if (paused) {
    _btnEl.innerHTML = '<span class="halt-icon">▶</span> Resume Market';
    _btnEl.classList.add('halted');
    _statusEl.textContent = 'MARKET HALTED — live data buffering';
    _statusEl.classList.add('halted-label');
  } else {
    _btnEl.innerHTML = '<span class="halt-icon">⏸</span> Halt Market';
    _btnEl.classList.remove('halted');
    _statusEl.textContent = '';
    _statusEl.classList.remove('halted-label');
  }
}
