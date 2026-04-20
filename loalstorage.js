// FILE 1: loalstorage.js
// Upload this exact code to your GitHub at: https://cdn.jsdelivr.net/gh/Sea-Math/Sea-Math.github.io@main/loalstorage.js

window.GameSaver = {
    save: function(gameName, key, value) {
        try {
            let allSaves = JSON.parse(localStorage.getItem('GlobalHub_Saves') || '{}');
            if (!allSaves[gameName]) allSaves[gameName] = {};
            allSaves[gameName][key] = value;
            localStorage.setItem('GlobalHub_Saves', JSON.stringify(allSaves));
        } catch (e) {
            console.error("Save failed", e);
        }
    },

    load: function(gameName) {
        try {
            let allSaves = JSON.parse(localStorage.getItem('GlobalHub_Saves') || '{}');
            return allSaves[gameName] || {};
        } catch (e) {
            return {};
        }
    },

    exportData: function() {
        return btoa(localStorage.getItem('GlobalHub_Saves') || '{}');
    },

    importData: function(base64String) {
        try {
            let decoded = atob(base64String);
            JSON.parse(decoded); 
            localStorage.setItem('GlobalHub_Saves', decoded);
            return true;
        } catch(e) {
            return false;
        }
    },

    getInjectorScript: function(gameName) {
        const savedData = this.load(gameName);
        return `<script>
            (function() {
                // 1. Inject saved data into the game's local storage BEFORE it loads
                const savedData = ${JSON.stringify(savedData)};
                for (let k in savedData) {
                    localStorage.setItem(k, savedData[k]);
                }

                // 2. Override the game's localStorage.setItem to auto-sync back to the Hub
                const originalSetItem = localStorage.setItem;
                localStorage.setItem = function(key, value) {
                    originalSetItem.call(localStorage, key, value);
                    // Send to parent window (the Hub)
                    window.parent.postMessage({
                        type: 'hubSave',
                        game: '${gameName}',
                        key: key,
                        val: value
                    }, '*');
                };

                // 3. Block redirects and ads
                window.onbeforeunload = function() { return "Staying in site!"; };
                window.open = function() { return null; };
                setInterval(function() {
                    const ads = document.querySelectorAll('.ad, .ads, .adsbygoogle, .banner-ads, [id^="ad-"], iframe[src*="doubleclick"]');
                    ads.forEach(ad => ad.remove());
                }, 500);
            })();
        <\/script>`;
    }
};

// Listen for the overridden setItem messages from the game iframe
window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'hubSave') {
        window.GameSaver.save(e.data.game, e.data.key, e.data.val);
    }
});
