import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_LOGO = path.join(__dirname, '../public/assets/logo.png');
const ANDROID_RES = path.join(__dirname, '../android/app/src/main/res');

const MIPMAP_FOLDERS = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi'
];

const TARGET_FILES = [
    'ic_launcher.png',
    'ic_launcher_round.png',
    'ic_launcher_foreground.png'
];

async function updateIcons() {
    console.log('Update Icons Script -----------------');
    if (!fs.existsSync(SOURCE_LOGO)) {
        console.error(`ERROR: Source logo not found at ${SOURCE_LOGO}`);
        process.exit(1);
    }

    // 1. Clean XML (AnyDPI) which points to foreground/background
    // We explicitly remove these folders because they prioritize XML vectors over our PNGs.
    const foldersToDelete = [
        'mipmap-anydpi-v26',
        'drawable-v24',
        'drawable' // Careful here, but usually safe for Capacitor defaults
    ];

    for (const folder of foldersToDelete) {
        const targetPath = path.join(ANDROID_RES, folder);
        if (fs.existsSync(targetPath)) {
            // Filter: Only delete icon-related XMLs if we don't want to nuke the whole folder
            // effectively we want to kill ic_launcher*.xml
            const files = fs.readdirSync(targetPath);
            files.forEach(f => {
                if (f.includes('ic_launcher') || f.includes('background') || f.includes('foreground')) {
                    fs.unlinkSync(path.join(targetPath, f));
                    console.log(`Deleted conflict: ${folder}/${f}`);
                }
            });
        }
    }

    // 2. Overwrite PNGs (Launcher Icons)
    for (const folder of MIPMAP_FOLDERS) {
        const folderPath = path.join(ANDROID_RES, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        for (const file of TARGET_FILES) {
            const dest = path.join(folderPath, file);
            fs.copyFileSync(SOURCE_LOGO, dest);
            console.log(`Updated: ${folder}/${file}`);
        }
    }

    // 3. Fallback for Foreground (Adaptive)
    // If Android asks for 'ic_launcher_foreground', give it our PNG.
    const drawablePath = path.join(ANDROID_RES, 'drawable');
    if (!fs.existsSync(drawablePath)) fs.mkdirSync(drawablePath);
    fs.copyFileSync(SOURCE_LOGO, path.join(drawablePath, 'ic_launcher_foreground.png'));

    console.log('-------------------------------------');
    console.log('Icons updated! Please run: ./gradlew clean && ./gradlew assembleDebug');
}

updateIcons();
