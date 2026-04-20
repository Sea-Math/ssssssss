 const sources = [
        { name: "GN Math", type: "json", json: "https://cdn.jsdelivr.net/gh/gn-math/assets@latest/zones.json", cover: "https://cdn.jsdelivr.net/gh/gn-math/covers@main/", html: "https://cdn.jsdelivr.net/gh/gn-math/html@main/" },
        { name: "Sea Bean", type: "json", json: "https://cdn.jsdelivr.net/gh/sea-bean-unblocked/sde@main/zzz.json", cover: "https://cdn.jsdelivr.net/gh/sea-bean-unblocked/Singlemile@main/Icon/", html: "https://cdn.jsdelivr.net/gh/sea-bean-unblocked/Singlemile@main/games/" },
        { 
            name: "Master Archive", 
            type: "combined", 
            repos: ["sea-bean-unblocked/Folder-1", "sea-bean-unblocked/Folder-2", "sea-bean-unblocked/Folder-3"],
            icon: "https://sea-math-official.neocities.org/Perfet.png" 
        }
    ];

    let zones = [];
    let currentSource = 0;

    window.createSplash = function() {};

    function cleanDataProcess(rawFiles) {
        const seen = new Set();
        const processed = rawFiles.map(file => {
            let cleanName = file.name.replace(/\.html$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (seen.has(cleanName)) return null;
            seen.add(cleanName);
            return { ...file, name: cleanName };
        }).filter(item => item !== null);
        processed.sort((a, b) => a.name.localeCompare(b.name));
        return processed;
    }

    async function init() {
        const startupBox = document.getElementById("startupBox");
        const sourceSelect = document.getElementById("sourceSelect");
        startupBox.innerHTML = ""; sourceSelect.innerHTML = "";
        
        sources.forEach((s, i) => {
            const btn = document.createElement("div");
            btn.className = "startup-btn";
            btn.innerHTML = `<b>${s.name}</b><br><span style="font-size: 12px; opacity: 0.7;">Select Archive</span>`;
            btn.onclick = () => chooseStartup(i);
            startupBox.appendChild(btn);
            const opt = document.createElement("option"); opt.value = i; opt.innerText = s.name;
            sourceSelect.appendChild(opt);
        });

        const savedSource = localStorage.getItem("sourceIndex");
        if (savedSource !== null) {
            currentSource = parseInt(savedSource);
            sourceSelect.value = currentSource;
            loadSource();
        } else {
            document.getElementById("startupOverlay").style.display = "flex";
        }
    }

    async function loadSource() {
        const statusText = document.getElementById("sysStatus");
        const s = sources[currentSource];
        statusText.innerText = "INDEXING LIBRARY...";

        try {
            if (s.type === "json") {
                const r = await fetch(s.json);
                zones = await r.json();
            } else if (s.type === "combined") {
                const results = await Promise.all(s.repos.map(async (repo) => {
                    const r = await fetch(`https://api.github.com/repos/${repo}/contents/`);
                    const data = await r.json();
                    return data.filter(f => f.name.endsWith('.html')).map(f => ({
                        name: f.name, url: `https://cdn.jsdelivr.net/gh/${repo}@main/${f.name}`, isDirect: true, cover: s.icon
                    }));
                }));
                zones = cleanDataProcess(results.flat());
            }

            statusText.innerText = "SYSTEM ACTIVE";
            setTimeout(() => statusText.innerText = "", 2000);
            displayZones(zones);
        } catch (err) { 
            statusText.innerText = "ERROR FETCHING ARCHIVE";
            console.error(err);
        }
    }

    function displayZones(list) {
        const container = document.getElementById("container");
        container.innerHTML = "";
        document.getElementById("liveCount").innerText = list.length;
        const s = sources[currentSource];
        
        list.forEach(z => {
            const d = document.createElement("div");
            d.className = "zone-item";
            d.onclick = () => openZone(z);
            const img = document.createElement("img");
            if (s.type === "combined") { img.src = z.cover; } 
            else {
                let rc = z.cover || "";
                img.src = rc.includes("{COVER_URL}") ? rc.replace("{COVER_URL}", s.cover) : s.cover + rc.replace(/^\//, "");
            }
            img.onerror = () => img.src = "https://via.placeholder.com/220x175/001122/00d2ff?text=Game";
            const b = document.createElement("b"); b.textContent = z.name;
            d.append(img, b);
            container.appendChild(d);
        });
    }

    function filterZones() {
        const q = document.getElementById("searchBar").value.toLowerCase();
        displayZones(zones.filter(z => z.name && z.name.toLowerCase().includes(q)));
    }

    // --- YOUR PREFERRED LOADER LOGIC ---
    function openZone(z) {
        const s = sources[currentSource];
        let finalURL = z.isDirect ? z.url : (z.url.includes("{HTML_URL}") ? z.url.replace("{HTML_URL}", s.html) : s.html + z.url.replace(/^\//, ""));
        
        // Prevent CDN Plain-Text Error
        if (finalURL.includes("raw.githubusercontent.com")) {
            finalURL = finalURL.replace("raw.githubusercontent.com", "cdn.jsdelivr.net/gh").replace("/main/", "@main/").replace("/master/", "@master/");
        }

        document.getElementById("zoneViewer").style.display = "flex";
        
        // Reset and show loader bar
        document.getElementById("loaderBar").style.opacity = "1";
        document.getElementById("loaderBar").style.width = "40%";
        
        fetch(finalURL).then(r => r.text()).then(html => {
            document.getElementById("loaderBar").style.width = "100%";
            const doc = document.getElementById("zoneFrame").contentWindow.document;
            doc.open(); 
            doc.write(html); 
            doc.close();
            
            // Fade out and reset after writing
            setTimeout(() => {
                document.getElementById("loaderBar").style.opacity = "0";
                setTimeout(() => document.getElementById("loaderBar").style.width = "0%", 400);
            }, 300);
            
        }).catch(() => {
            // If fetch is blocked, try direct iframe src
            document.getElementById("zoneFrame").src = finalURL;
            document.getElementById("loaderBar").style.width = "100%";
            
            setTimeout(() => {
                document.getElementById("loaderBar").style.opacity = "0";
                setTimeout(() => document.getElementById("loaderBar").style.width = "0%", 400);
            }, 300);
        });
    }

    function chooseStartup(idx) {
        currentSource = idx;
        localStorage.setItem("sourceIndex", idx);
        document.getElementById("startupOverlay").style.display = "none";
        loadSource();
    }

    function toggleSettings(e) {
        const s = document.getElementById("settingsOverlay");
        if (e && e.target !== s) return;
        s.style.display = s.style.display === "flex" ? "none" : "flex";
    }

    function toggleSource(v) { 
        currentSource = parseInt(v); 
        localStorage.setItem("sourceIndex", v); 
        document.getElementById("container").innerHTML = ""; 
        loadSource(); 
    }
    
    function closeViewer() { 
        document.getElementById("zoneViewer").style.display = "none"; 
        document.getElementById("zoneFrame").src = "about:blank"; 
        // Reset loader silently
        document.getElementById("loaderBar").style.width = "0%";
    }

    window.onload = init;