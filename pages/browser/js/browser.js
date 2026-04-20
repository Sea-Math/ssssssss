function getSavedBookmarks() {
          try {
              const saved = localStorage.getItem('sb_bookmarks');
              if (saved) return JSON.parse(saved);
          } catch(e) { console.error("Error loading bookmarks", e); }
          // Default fallback if no bookmarks exist in storage yet
          return [
              { id: 2, name: 'GitHub',      url: 'https://github.com' },
              { id: 3, name: 'CrazyGames',  url: 'https://crazygames.com' },
              { id: 6, name: 'Granite',     url: 'https://seabean.hollands.id.au/granite.html' },
              { id: 7, name: 'Shuttlemath', url: 'https://shuttlemath.com' },
              { id: 8, name: 'nowgg',       url: 'https://nowgg.fun' },
          ];
      }

      function mathApp() {
        return {
          canvas: null,
          ready: false,
          tabs: [],
          activeTabId: null,
          currentUrlInput: '',
          homeSearchInput: '',
          
          urlBarFocused: false,
          homeFocused: false,
          suggestions: [],
          sugIndex: -1,
          showUrlSuggestions: false,
          showHomeSuggestions: false,
          zoomLevel: 1.0,
          
          // Extension, Menus, & Persistent Setting States
          isDarkMode: localStorage.getItem('sb_darkmode') === 'true',
          customBgUrl: localStorage.getItem('sb_bg') || '',
          userWantsBookmarkBar: localStorage.getItem('sb_bmbar') !== 'false', // Default to true
          showCustomBookmarkModal: false,
          customBookmarkForm: { name: '', url: '' },
          menus: {
              searchTabs: false,
              extensions: false,
              profile: false,
              chromeMenu: false,
              customize: false
          },
          
          // Persistent Bookmarks
          bookmarks: getSavedBookmarks(),

          get activeTab() { return this.tabs.find((t) => t.id === this.activeTabId) },
          get showNewTabUI() { return !this.activeTab || !this.activeTab.url || this.activeTab.url === 'about:blank' || this.activeTab.url.includes('/newtab.html') },
          
          get isBookmarked() {
            if (!this.currentUrlInput) return false;
            return this.bookmarks.some(b => b.url === this.currentUrlInput);
          },

          async init() {
            // Setup Watchers for Auto-Saving Settings
            this.$watch('customBgUrl', val => localStorage.setItem('sb_bg', val));
            this.$watch('userWantsBookmarkBar', val => localStorage.setItem('sb_bmbar', val));
            this.$watch('isDarkMode', val => localStorage.setItem('sb_darkmode', val));

            try {
              const [canvasModule, clientModule] = await Promise.all([
                import('./shader-canvas.js'),
                import('./shader-client.js'),
              ])
              this.canvas = new canvasModule.ShaderCanvas('canvas-container')
              
              this.canvas.on(canvasModule.ShaderCanvas.EVENTS.SURFACE_CHANGE, (s) => {
                this.activeTabId = s ? s.id : null
                if (s && s.client) {
                  const url = s.client.decode(s.client._lastUrl || '');
                  this.currentUrlInput = url === 'about:blank' ? '' : url; 
                }
              })
              this.canvas.on(canvasModule.ShaderCanvas.EVENTS.URL_CHANGE, () => this.refreshTabs())
              this.canvas.on(canvasModule.ShaderCanvas.EVENTS.TITLE_CHANGE, () => this.refreshTabs())
              this.canvas.on(canvasModule.ShaderCanvas.EVENTS.READY, () => { this.ready = true })

              this.addTab()
              this.setupZoomListeners()
            } catch (e) { console.error(e) }
          },

          saveBookmarks() {
             localStorage.setItem('sb_bookmarks', JSON.stringify(this.bookmarks));
          },

          setupZoomListeners() {
            window.addEventListener('keydown', (e) => {
              if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') { e.preventDefault(); this.zoomIn(); } 
                else if (e.key === '-') { e.preventDefault(); this.zoomOut(); } 
                else if (e.key === '0') { e.preventDefault(); this.resetZoom(); }
              }
            });
            window.addEventListener('wheel', (e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) this.zoomIn(0.05);
                else this.zoomOut(0.05);
              }
            }, { passive: false });
          },

          zoomIn(step = 0.1) {
             this.zoomLevel = Math.min(this.zoomLevel + step, 5.0);
             this.zoomLevel = Math.round(this.zoomLevel * 100) / 100;
          },
          zoomOut(step = 0.1) {
             this.zoomLevel = Math.max(this.zoomLevel - step, 0.01); 
             this.zoomLevel = Math.round(this.zoomLevel * 100) / 100;
          },
          resetZoom() { this.zoomLevel = 1.0; },

          refreshTabs() {
            this.tabs = Array.from(this.canvas.surfaces.values()).map((s) => ({
              id: s.id, title: s.title, favicon: s.favicon, url: s.client ? s.client.decode(s.client._lastUrl || '') : ''
            }))
          },

          addTab() { 
            const id = this.canvas.createSurface(); 
            this.canvas.switchSurface(id); 
            this.refreshTabs();
          },

          closeTab(id) { 
            const index = this.tabs.findIndex(t => t.id === id);
            this.tabs = this.tabs.filter(t => t.id !== id);
            if (this.tabs.length === 0) {
              this.addTab();
            } else if (this.activeTabId === id) {
              const nextTab = this.tabs[index] || this.tabs[index - 1];
              if (nextTab) this.activateTab(nextTab.id);
            }
            this.canvas.closeSurface(id); 
          },

          activateTab(id) {
            if (id === this.activeTabId) return;
            this.activeTabId = id;
            this.canvas.switchSurface(id);
          },

          // JS INJECTION ENGINE FOR BOOKMARKLETS
          navigateBookmark(url) { 
            if (url.trim().startsWith('javascript:')) {
                this.injectJS(url);
            } else {
                this.currentUrlInput = url; 
                this.navigate(url); 
            }
          },

          injectJS(scriptUrl) {
            let code = scriptUrl.trim().substring(11); // remove "javascript:"
            code = decodeURIComponent(code);
            try {
                // Find all iframes and inject into the active one
                const container = document.getElementById('canvas-container');
                const iframes = container.getElementsByTagName('iframe');
                for (let iframe of iframes) {
                    if (iframe.style.display !== 'none' && iframe.contentWindow) {
                         iframe.contentWindow.eval(code);
                    }
                }
            } catch(e) {
                console.warn("Could not inject JS (Security Constraint):", e);
                alert("Bookmarklet blocked by cross-origin security frame.");
            }
          },
          
          removeBookmark(id){ 
             this.bookmarks = this.bookmarks.filter((b) => b.id !== id); 
             this.saveBookmarks();
          },
          
          toggleBookmark() {
            if (!this.currentUrlInput || this.currentUrlInput === 'about:blank') return;
            if (this.isBookmarked) {
              this.bookmarks = this.bookmarks.filter(b => b.url !== this.currentUrlInput);
            } else {
              this.bookmarks.push({ 
                  id: Date.now(), 
                  name: this.activeTab && this.activeTab.title ? this.activeTab.title : 'Saved Page', 
                  url: this.currentUrlInput, 
                  icon: this.activeTab ? this.activeTab.favicon : '' 
              });
            }
            this.saveBookmarks();
          },

          openCustomBookmarkModal() {
             this.customBookmarkForm = { name: '', url: '' };
             this.showCustomBookmarkModal = true;
          },

          saveCustomBookmark() {
             if (!this.customBookmarkForm.name || !this.customBookmarkForm.url) return;
             this.bookmarks.push({
                 id: Date.now(),
                 name: this.customBookmarkForm.name,
                 url: this.customBookmarkForm.url,
                 icon: 'mathpunch.jpeg'
             });
             this.saveBookmarks();
             this.showCustomBookmarkModal = false;
          },

          navigate(url) {
            this.zoomLevel = 1.0;
            this.canvas.navigate(url);
            this.closeDropdowns();
          },

          sharePage() {
            if(navigator.share && this.currentUrlInput) {
                navigator.share({ title: 'Check this out', url: this.currentUrlInput }).catch(()=>{});
            } else {
                navigator.clipboard.writeText(this.currentUrlInput);
                alert("Link copied to clipboard!");
            }
          },

          reloadTab() { this.canvas.reload() },
          goBack()    { this.canvas.goBack() },
          goForward() { this.canvas.goForward() },

          handleFileUpload(event) {
              const file = event.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (e) => { this.customBgUrl = e.target.result; };
              reader.readAsDataURL(file);
          },

          toggleDarkMode() { this.isDarkMode = !this.isDarkMode; this.menus.extensions = false; },
          
          toggleFullscreen() {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else if (document.exitFullscreen) document.exitFullscreen();
              this.menus.extensions = false;
          },

          fetchSuggestions(query, type) {
            this.sugIndex = -1;
            if (!query.trim()) {
              this.suggestions = []; this.showUrlSuggestions = false; this.showHomeSuggestions = false; return;
            }
            const script = document.createElement('script');
            const callbackName = 'googleSuggestCb_' + Math.round(100000 * Math.random());
            window[callbackName] = (data) => {
              this.suggestions = data[1].slice(0, 8); 
              if (type === 'url') this.showUrlSuggestions = true;
              if (type === 'home') this.showHomeSuggestions = true;
              delete window[callbackName]; script.remove();
            };
            script.src = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&callback=${callbackName}`;
            document.head.appendChild(script);
          },

          navSuggestion(dir, type) {
            if (!this.suggestions.length) return;
            this.sugIndex += dir;
            if (this.sugIndex >= this.suggestions.length) this.sugIndex = 0;
            if (this.sugIndex < 0) this.sugIndex = this.suggestions.length - 1;
            const selected = this.suggestions[this.sugIndex];
            if (type === 'url') this.currentUrlInput = selected;
            if (type === 'home') this.homeSearchInput = selected;
          },

          selectSuggestion(sug) { this.navigate(sug); },

          submitUrlForm() {
             if (this.sugIndex >= 0 && this.suggestions.length) this.navigate(this.suggestions[this.sugIndex]);
             else if (this.currentUrlInput) this.navigate(this.currentUrlInput);
          },

          submitHomeForm() {
             if (this.sugIndex >= 0 && this.suggestions.length) {
                 this.currentUrlInput = this.suggestions[this.sugIndex];
                 this.navigate(this.suggestions[this.sugIndex]);
             } else if (this.homeSearchInput) {
                 this.currentUrlInput = this.homeSearchInput;
                 this.navigate(this.homeSearchInput);
             }
             this.homeSearchInput = '';
          },

          toggleMenu(menu) {
              const current = this.menus[menu];
              Object.keys(this.menus).forEach(k => this.menus[k] = false); 
              this.menus[menu] = !current;
          },

          closeDropdowns() {
            this.urlBarFocused = false;
            this.homeFocused = false;
            this.showUrlSuggestions = false;
            this.showHomeSuggestions = false;
            this.sugIndex = -1;
            Object.keys(this.menus).forEach(k => this.menus[k] = false);
          }
        }
      }