import { store } from '../core/store.js';

export class TutorialModal {
  constructor() {
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'modal-overlay';
    this.element.innerHTML = `
      <div class="tutorial-card">
        <h2 class="outfit">Welcome, Bureaucrat</h2>
        <p class="tutorial-text">
          Local Reality is glitching. We need someone to manually process the paperwork until the automated systems are online.
        </p>
        <p class="tutorial-instruction">
          <strong>Task:</strong> Process 5 Forms to prove competency.
        </p>
        <button id="tutorial-btn" class="buy-btn">I COMPLY</button>
      </div>
    `;

    this.element.querySelector('#tutorial-btn').addEventListener('click', () => {
      this.close();
    });

    return this.element;
  }

  close() {
    if (this.element) {
      this.element.remove();
      // Update state to step 1 (Waiting for 5 forms)
      const state = store.getState();
      store.setState({
        tutorial: { ...state.tutorial, step: 1 }
      });
    }
  }
}
