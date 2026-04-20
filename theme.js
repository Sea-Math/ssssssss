document.addEventListener('DOMContentLoaded', () => {
    const themes = {
     blue: { name: 'Ocean Blue', accent: '#00d2ff', dark: '#0077ff', bgDeep: '#000814', bgLight: '#001f3f', sidebarBg: 'rgba(0, 8, 20, 0.85)', textMuted: '#6b8cae' },
        purple: { name: 'Neon Purple', accent: '#d500ff', dark: '#7b00ff', bgDeep: '#0d0014', bgLight: '#2b004d', sidebarBg: 'rgba(13, 0, 20, 0.85)', textMuted: '#a37ec4' },
        red: { name: 'Crimson Red', accent: '#ff3333', dark: '#b30000', bgDeep: '#140000', bgLight: '#3d0000', sidebarBg: 'rgba(20, 0, 0, 0.85)', textMuted: '#c47e7e' },
        green: { name: 'Forest Green', accent: '#00ff88', dark: '#00aa55', bgDeep: '#001408', bgLight: '#003617', sidebarBg: 'rgba(0, 20, 8, 0.85)', textMuted: '#67a886' },
        orange: { name: 'Sunset Orange', accent: '#ff9900', dark: '#cc5500', bgDeep: '#1a0800', bgLight: '#3d1400', sidebarBg: 'rgba(26, 8, 0, 0.85)', textMuted: '#ba8c6c' },
        pink: { name: 'Sakura Pink', accent: '#ff99cc', dark: '#cc0066', bgDeep: '#1a000d', bgLight: '#4d0026', sidebarBg: 'rgba(26, 0, 13, 0.85)', textMuted: '#c989a9' },
        dark: { name: 'Midnight Dark', accent: '#aaaaaa', dark: '#555555', bgDeep: '#050505', bgLight: '#1a1a1a', sidebarBg: 'rgba(5, 5, 5, 0.85)', textMuted: '#888888' },
        yellow: { name: 'Midnight Lemon', accent: '#FDE047', dark: '#CA8A04', bgDeep: '#050505', bgLight: '#1a1a17', sidebarBg: 'rgba(5, 5, 5, 0.85)', textMuted: '#8a8a82' },
        maybe: { name: 'AMOLED Dark', accent: '#aaaaaa', dark: '#555555', bgDeep: '#000000', bgLight: '#111111', sidebarBg: 'rgba(0, 0, 0, 0.85)', textMuted: '#777777' }

    };

    const themeGridContainer = document.getElementById('themeGridContainer');
    let currentThemeKey = localStorage.getItem("selectedTheme") || 'blue';
    let isThemeAnimating = false; // Glitch fix flag

    // Restore Theme on Load
    if(themes[currentThemeKey]) {
        applyThemeStyles(themes[currentThemeKey]);
    }

    // Build the Grid
    for (const [key, theme] of Object.entries(themes)) {
        let btn = document.createElement('button');
        btn.className = `theme-preview-btn ${key === currentThemeKey ? 'active' : ''}`;
        btn.onclick = () => window.triggerThemeWave(key, btn);
        btn.title = theme.name;
        
        let swatch = document.createElement('div');
        swatch.className = 'theme-color-swatch';
        swatch.style.background = `linear-gradient(135deg, ${theme.accent}, ${theme.dark})`;
        
        btn.appendChild(swatch);
        themeGridContainer.appendChild(btn);
    }

    function applyThemeStyles(theme) {
        const root = document.documentElement;
        root.style.setProperty('--accent', theme.accent);
        root.style.setProperty('--accent-dark', theme.dark);
        root.style.setProperty('--bg-deep', theme.bgDeep);
        root.style.setProperty('--bg-light', theme.bgLight);
        root.style.setProperty('--sidebar-bg', theme.sidebarBg);
        root.style.setProperty('--text-muted', theme.textMuted);
    }

    // Exported function for onclick events
    window.triggerThemeWave = function(themeKey, clickedBtn) {
        if (themeKey === currentThemeKey || isThemeAnimating) return; // Prevent glitch if clicked too fast
        
        const theme = themes[themeKey];
        if (!theme) return;

        isThemeAnimating = true;

        document.querySelectorAll('.theme-preview-btn').forEach(b => b.classList.remove('active'));
        if(clickedBtn) clickedBtn.classList.add('active');

        document.getElementById('settingsOverlay').style.display = 'none'; 
        const overlay = document.getElementById("themeTransitionOverlay");
        const waveContainer = document.getElementById("themeWaveContainer");
        const parallax = document.querySelector("#themeTransitionOverlay .parallax"); // Fixed selector

        waveContainer.style.background = `linear-gradient(to bottom, ${theme.dark}, ${theme.bgDeep})`;
        waveContainer.style.boxShadow = `0 -5px 30px ${theme.accent}`;
        
        if (parallax) {
            parallax.innerHTML = `
                <use href="#gentle-wave" x="48" y="0" fill="${theme.accent}" opacity="0.7" />
                <use href="#gentle-wave" x="48" y="3" fill="${theme.accent}" opacity="0.5" />
                <use href="#gentle-wave" x="48" y="5" fill="${theme.dark}" opacity="0.3" />
                <use href="#gentle-wave" x="48" y="7" fill="${theme.dark}" />
            `;
        }

        overlay.style.display = "block";
        waveContainer.style.transition = "none";
        waveContainer.style.height = "0%";
        waveContainer.style.transform = "translateY(120px)";
        void waveContainer.offsetWidth; 

        waveContainer.style.transition = "height 0.8s ease-out, transform 0.8s ease-out";
        waveContainer.style.height = "100%";
        waveContainer.style.transform = "translateY(0px)";

        // When the wave fully covers the screen
        setTimeout(() => {
            applyThemeStyles(theme);
            localStorage.setItem("selectedTheme", themeKey);
            currentThemeKey = themeKey;
            
            // RELOAD THE ACTIVE IFRAME BEHIND THE WAVE
            const iframe = document.getElementById("mainFrame");
            if (iframe && iframe.src) {
                iframe.src = iframe.src;
            }
            
            if (window.createSplash) window.createSplash("themeTransitionOverlay"); 

            setTimeout(() => {
                waveContainer.style.transition = "height 1.2s cubic-bezier(0.65, 0, 0.35, 1), transform 1.2s cubic-bezier(0.65, 0, 0.35, 1)";
                waveContainer.style.height = "0%";
                waveContainer.style.transform = "translateY(120px)";
                
                setTimeout(() => {
                    overlay.style.display = "none";
                    isThemeAnimating = false; // Release lock
                }, 1200);
            }, 500);
        }, 800);
    };
});
