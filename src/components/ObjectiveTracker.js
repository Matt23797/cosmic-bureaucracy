export class ObjectiveTracker {
    constructor() {
        this.element = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.id = 'objective-tracker';
        this.element.className = 'objective-tracker';
        this.element.innerHTML = `
            <div class="objective-content">
                <span class="obj-label">CURRENT OBJECTIVE:</span>
                <span id="obj-text" class="obj-text">Wait for instructions...</span>
            </div>
            <div class="objective-progress-bg">
                <div id="obj-progress-bar" class="objective-progress-fill"></div>
            </div>
        `;
        return this.element;
    }

    update(state) {
        if (!this.element) return;

        const objText = this.element.querySelector('#obj-text');
        const progressBar = this.element.querySelector('#obj-progress-bar');

        let text = "Continue administration.";
        let progress = 0;

        const totalDepts = Object.values(state.departments || {}).reduce((a, b) => a + b, 0);
        const forms = state.resources.forms || 0;
        const totalForms = state.stats?.totalForms || 0;

        if (state.tutorial?.active) {
            text = "Prove competency: Process 5 Forms.";
            progress = (forms / 5) * 100;
        } else if (totalDepts === 0) {
            text = "Hire your first Department (Office Intern).";
            progress = (forms / 15) * 100;
        } else if (totalForms < 1000) {
            text = "Scale production: Reach 1,000 Total Forms.";
            progress = (totalForms / 1000) * 100;
        } else if (!state.activePhilosophy) {
            text = "Establish doctrine: Select a Philosophy.";
            progress = 0;
        } else if (state.resources.paradox > 0 && !state.paradoxBurst?.active) {
            text = "Stabilize reality: Trigger a Paradox Burst.";
            progress = (state.resources.paradox / 50) * 100;
        } else if (totalForms < 10000000) {
            text = "Metaphysical target: Reach 10M Forms.";
            progress = (totalForms / 10000000) * 100;
        } else {
            text = "System critical: Perform a Reality Audit.";
            progress = 100;
        }

        objText.innerText = text;
        progressBar.style.width = `${Math.min(100, progress)}%`;
    }
}
