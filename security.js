
document.addEventListener('DOMContentLoaded', () => {
    // --- TAB CLOAKING ---
    const cloaks = {
        default: { title: "Portal", icon: "" },
        google: { title: "Google", icon: "https://www.google.com/favicon.ico" },
        drive: { title: "Google Drive", icon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" },
        ixl: { title: "IXL | Math, Language Arts", icon: "https://www.ixl.com/favicon.ico" },
        canvas: { title: "Dashboard", icon: "https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico" }
    };

    window.setCloak = function(val) {
        let cloak = cloaks[val] || cloaks.default;
        document.title = cloak.title;
        document.getElementById("favicon").href = cloak.icon;
        localStorage.setItem("tabCloak", val);
    };

    // --- PANIC & STEALTH LOGIC ---
    let panicUrl = localStorage.getItem("panicUrl") || "https://www.google.com";
    
    window.updatePanicUrl = function(val) {
        panicUrl = val;
        if (!panicUrl.startsWith('http')) panicUrl = 'https://' + panicUrl;
        localStorage.setItem("panicUrl", panicUrl);
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.location.replace(panicUrl);
    });

    let autoPanicEnabled = localStorage.getItem("autoPanicEnabled") === "true";
    
    window.updateAutoPanic = function(val) {
        autoPanicEnabled = (val === "true");
        localStorage.setItem("autoPanicEnabled", autoPanicEnabled);
    };
    
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && autoPanicEnabled) {
            window.location.replace(panicUrl);
        }
    });

    window.openAboutBlank = function() {
        let win = window.open('about:blank', '_blank');
        if (!win) return alert("Pop-ups must be enabled to use Stealth Mode.");
        let doc = win.document;
        doc.body.style.margin = '0'; doc.body.style.height = '100vh';
        let iframe = doc.createElement('iframe');
        iframe.style.border = 'none'; iframe.style.width = '100%'; iframe.style.height = '100%'; 
        iframe.src = window.location.href; 
        doc.body.appendChild(iframe);
        window.location.replace(panicUrl); 
    };

    // --- RESTORE SETTINGS ON LOAD ---
    let savedCloak = localStorage.getItem("tabCloak");
    if(savedCloak) { 
        document.getElementById("cloakSelect").value = savedCloak; 
        window.setCloak(savedCloak); 
    }
    
    let panicInput = document.getElementById("panicUrlInput");
    if(panicInput) panicInput.value = panicUrl;
    
    let savedAutoPanic = localStorage.getItem("autoPanicEnabled");
    if(savedAutoPanic) {
        document.getElementById("autoPanicSelect").value = savedAutoPanic;
    }
});