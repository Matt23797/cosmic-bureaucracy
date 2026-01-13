import './styles/main.css';
import { engine } from './core/Engine.js';
import { uiManager } from './core/UIManager.js';
import { store } from './core/store.js';
import { WorkScreen } from './screens/WorkScreen.js';
import { DepartmentScreen } from './screens/DepartmentScreen.js';
import { PhilosophyScreen } from './screens/PhilosophyScreen.js';
import { ResetScreen } from './screens/ResetScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { StatusBar } from '@capacitor/status-bar';

// Register All Screens
uiManager.registerScreen('work', new WorkScreen());
uiManager.registerScreen('departments', new DepartmentScreen());
uiManager.registerScreen('philosophy', new PhilosophyScreen());
uiManager.registerScreen('resets', new ResetScreen());
uiManager.registerScreen('settings', new SettingsScreen());

// Initial Render (Start with default state)
uiManager.renderCurrentScreen();

// Initialize Chain
async function startGame() {
  const hideBar = async () => {
    try { await StatusBar.hide(); } catch (e) { }
  };

  // Initial hide
  await hideBar();

  // Re-hide on resume (Fixes backgrounding issue)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      hideBar();
    }
  });

  // Load and Auth
  await store.init();

  // Start Engine
  engine.start();
}

// Debug: Expose store globally (only in development)
if (import.meta.env.DEV) {
  window.store = store;
}
startGame();
