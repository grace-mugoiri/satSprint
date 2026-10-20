(function () {
    'use strict';

    const installButton = document.getElementById('installAppBtn');
    const helpScreen = document.getElementById('installHelpScreen');
    const helpText = document.getElementById('installHelpText');
    const closeHelpButton = document.getElementById('closeInstallHelpBtn');
    if (!installButton) return;

    let installPrompt = null;
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = () => /Android/i.test(navigator.userAgent);

    function updateButton() {
        installButton.hidden = isStandalone();
        if (isStandalone()) return;
        installButton.textContent = installPrompt ? 'Install SAT SPRINT' : 'Add SAT SPRINT to Home Screen';
    }

    function showHelp() {
        if (!helpScreen || !helpText) return;
        if (isIOS()) {
            helpText.textContent = 'In Safari, tap the Share button, choose “Add to Home Screen,” then tap “Add.” SAT SPRINT will get its own icon and open without the browser address bar.';
        } else if (isAndroid()) {
            helpText.textContent = 'In Chrome, tap the ⋮ menu and choose “Install app” or “Add to Home screen,” then confirm. SAT SPRINT will get its own icon for quicker access.';
        } else {
            helpText.textContent = 'Use your browser’s Install option or menu and choose “Install SAT SPRINT” or “Add to Home screen.” On phones, open this page in Safari or Chrome for the best install experience.';
        }
        helpScreen.classList.remove('hidden');
        closeHelpButton && closeHelpButton.focus();
    }

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        installPrompt = event;
        updateButton();
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        updateButton();
    });

    installButton.addEventListener('click', async () => {
        if (!installPrompt) {
            showHelp();
            return;
        }
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installPrompt = null;
        updateButton();
        if (choice && choice.outcome === 'dismissed') showHelp();
    });

    closeHelpButton && closeHelpButton.addEventListener('click', () => helpScreen.classList.add('hidden'));
    helpScreen && helpScreen.addEventListener('click', event => {
        if (event.target === helpScreen) helpScreen.classList.add('hidden');
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && helpScreen && !helpScreen.classList.contains('hidden')) helpScreen.classList.add('hidden');
    });

    updateButton();
})();
