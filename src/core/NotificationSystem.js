import { store } from './store.js';
import { Utils } from './Utils.js';

/**
 * Manages milestone declarations and achievement modals.
 */
export class NotificationSystem {
    constructor() {
        this.milestones = [100, 1000, 10000, 100000, 1000000, 10000000];
    }

    checkMilestones(state) {
        const totalForms = state.stats.totalForms || 0;
        const celebrated = state.stats.celebratedMilestones || [];

        for (const milestone of this.milestones) {
            if (totalForms >= milestone && !celebrated.includes(milestone)) {
                const nextCelebrated = [...celebrated, milestone];
                store.setState({
                    stats: {
                        ...state.stats,
                        celebratedMilestones: nextCelebrated
                    }
                });
                this.showMilestoneModal(milestone);
                break;
            }
        }
    }

    showMilestoneModal(milestone) {
        if (document.querySelector('.milestone-overlay')) return;

        const messages = {
            100: { title: 'First Hundred!', desc: 'The paperwork begins to flow.' },
            1000: { title: 'Thousand Forms!', desc: 'Your bureaucratic empire grows.' },
            10000: { title: 'Ten Thousand!', desc: 'The cosmos takes notice.' },
            100000: { title: 'Hundred Thousand!', desc: 'Reality bends to your filing.' },
            1000000: { title: 'ONE MILLION!', desc: 'You have transcended mere administration.' },
            10000000: { title: 'TEN MILLION!', desc: 'Meta-Authority beckons. Consider a Reality Audit.' }
        };

        const msg = messages[milestone] || { title: `${this.formatNumber(milestone)} Forms!`, desc: 'Progress!' };

        const overlay = document.createElement('div');
        overlay.className = 'milestone-overlay';
        overlay.innerHTML = `
            <div class="milestone-card">
                <div class="milestone-icon">🏆</div>
                <h2 class="outfit">${msg.title}</h2>
                <p>${msg.desc}</p>
                <button class="buy-btn milestone-dismiss">CONTINUE</button>
            </div>
        `;

        overlay.querySelector('.milestone-dismiss').addEventListener('click', () => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 300);
        });

        setTimeout(() => {
            if (document.body.contains(overlay)) {
                overlay.classList.add('fade-out');
                setTimeout(() => overlay.remove(), 300);
            }
        }, 5000);

        document.body.appendChild(overlay);
    }

    formatNumber(num) {
        return Utils.formatNumber(num);
    }
}
