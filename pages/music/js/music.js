 // --- Elements ---
    const searchInput = document.getElementById('search-input'), searchBtn = document.getElementById('search-btn'), resultsList = document.getElementById('results-list');
    const searchLoading = document.getElementById('search-loading'), playerLoading = document.getElementById('player-loading');
    const audioPlayer = document.getElementById('audio-player'), playPauseBtn = document.getElementById('play-pause-btn'), playIcon = document.getElementById('play-icon');
    const progressFill = document.getElementById('progress-fill'), progressContainer = document.getElementById('progress-container'), progressTooltip = document.getElementById('progress-tooltip');
    const currentTimeEl = document.getElementById('current-time'), totalTimeEl = document.getElementById('total-time'), playingContext = document.getElementById('playing-context');
    const volumeContainer = document.getElementById('volume-container'), volumeFill = document.getElementById('volume-fill'), muteBtn = document.getElementById('mute-btn');
    const playerTitle = document.getElementById('player-title'), playerArtist = document.getElementById('player-artist'), playerArt = document.getElementById('player-art'), defaultArt = document.getElementById('default-art');
    const btnRepeat = document.getElementById('btn-repeat'), btnPrev = document.getElementById('btn-prev'), btnNext = document.getElementById('btn-next');
    const tabSearch = document.getElementById('tab-search'), tabPlaylists = document.getElementById('tab-playlists');
    
    // Lyrics Elements
    const lyricsBtn = document.getElementById('lyrics-btn'), lyricsPanel = document.getElementById('lyrics-panel'), closeLyricsBtn = document.getElementById('close-lyrics-btn');
    const lyricsContent = document.getElementById('lyrics-content'), lyricsTitleDisplay = document.getElementById('lyrics-title-display'), lyricsScrollArea = document.getElementById('lyrics-scroll-area');

    // Visualizer Elements
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');

    // --- Data & State ---
    const aestheticPalettes = [
        { color: '#ff4757', icon: 'bi-heart-fill' }, { color: '#2ed573', icon: 'bi-vinyl-fill' },
        { color: '#1e90ff', icon: 'bi-water' }, { color: '#ffa502', icon: 'bi-fire' },
        { color: '#a55eea', icon: 'bi-moon-stars-fill' }, { color: '#ff7f50', icon: 'bi-sunset-fill' }
    ];
    let storedPlaylists = JSON.parse(localStorage.getItem('sleek_sc_playlists'));
    if (!storedPlaylists || storedPlaylists.length === 0) {
        storedPlaylists = [{ id: 'pl_' + Date.now(), title: 'Favorites', color: '#ff4757', icon: 'bi-heart-fill', coverImage: null, tracks: [] }];
        localStorage.setItem('sleek_sc_playlists', JSON.stringify(storedPlaylists));
    }

    let searchResults = [];
    let playlists = storedPlaylists; 
    let currentPlaybackQueue = [];
    let currentQueueName = "None";
    let currentTrackIndex = -1;
    let isRepeat = false;
    let currentView = 'playlists_root'; 
    let activePlaylistId = null;
    let currentParsedLyrics = null;
    let isSyncedLyrics = false;
    
    // Visualizer State
    let audioCtx;
    let analyser;
    let dataArray;
    let visualizerInitialized = false;

    function savePlaylists() { localStorage.setItem('sleek_sc_playlists', JSON.stringify(playlists)); }

    function formatTime(seconds) {
      if (isNaN(seconds)) return "0:00";
      const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function updatePlayState(isPlaying) {
      if (isPlaying) { playIcon.className = 'bi bi-pause-fill'; playPauseBtn.classList.add('playing'); } 
      else { playIcon.className = 'bi bi-play-fill'; playPauseBtn.classList.remove('playing'); }
    }

    function resizeImageForStorage(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 150;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // --- AUDIO VISUALIZER ENGINE ---
    function initVisualizer() {
        if (visualizerInitialized) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        
        const source = audioCtx.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        analyser.fftSize = 128;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        visualizerInitialized = true;
        drawVisualizer();
    }

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (!visualizerInitialized || audioPlayer.paused) return;
        analyser.getByteFrequencyData(dataArray);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 95;
        const bars = analyser.frequencyBinCount;

        for(let i = 0; i < bars; i++) {
            const barHeight = (dataArray[i] / 255) * 40;
            if (barHeight === 0) continue;

            const angle = i * ((Math.PI * 2) / bars);
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            
            canvasCtx.beginPath();
            canvasCtx.moveTo(x1, y1);
            canvasCtx.lineTo(x2, y2);
            canvasCtx.strokeStyle = `rgba(116, 235, 213, ${(dataArray[i] / 255) + 0.3})`;
            canvasCtx.lineWidth = 5;
            canvasCtx.lineCap = 'round';
            canvasCtx.stroke();
        }
    }

    // --- View Rendering Engine ---
    function renderView() {
      resultsList.innerHTML = '';
      if (currentView === 'search') {
        if (searchResults.length === 0) { resultsList.innerHTML = '<div class="initial-msg">No tracks found. Search above!</div>'; return; }
        renderTracks(searchResults, 'search');
      } 
      else if (currentView === 'playlists_root') {
        const header = document.createElement('div');
        header.className = 'util-header';
        header.innerHTML = `<div>Your Library</div><button class="create-pl-btn" id="create-pl-btn"><i class="bi bi-plus-lg"></i> New Playlist</button>`;
        resultsList.appendChild(header);
        document.getElementById('create-pl-btn').addEventListener('click', createNewPlaylist);

        playlists.forEach((pl, index) => {
          const folder = document.createElement('div');
          folder.className = 'playlist-folder';
          folder.style.animationDelay = `${index * 0.05}s`;
          let iconHtml = pl.coverImage ? `<div class="pl-icon-wrap" style="background: transparent; padding: 0;"><img src="${pl.coverImage}" style="width:100%; height:100%; object-fit:cover;"></div>` 
                                       : `<div class="pl-icon-wrap" style="color: ${pl.color};"><i class="bi ${pl.icon}"></i></div>`;
          folder.innerHTML = `${iconHtml}<div class="pl-info"><div class="pl-title">${pl.title}</div><div class="pl-count">${pl.tracks.length} track${pl.tracks.length === 1 ? '' : 's'}</div></div><i class="bi bi-chevron-right" style="color: #95a5a6; font-size: 1.2rem;"></i>`;
          folder.addEventListener('click', () => { activePlaylistId = pl.id; currentView = 'playlist_detail'; renderView(); });
          resultsList.appendChild(folder);
        });
      } 
      else if (currentView === 'playlist_detail') {
        const pl = playlists.find(p => p.id === activePlaylistId);
        if(!pl) { currentView = 'playlists_root'; renderView(); return; }
        
        const header = document.createElement('div');
        header.className = 'util-header';
        let headerIconHtml = pl.coverImage ? `<img src="${pl.coverImage}" style="width:28px; height:28px; border-radius:6px; object-fit:cover; vertical-align:middle; margin-right:6px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">` : `<i class="bi ${pl.icon}" style="color: ${pl.color}; margin-right: 4px;"></i>`;
        header.innerHTML = `<button class="back-btn" id="back-to-pl"><i class="bi bi-arrow-left"></i></button><div style="font-weight: 800; font-size: 1.05rem; display:flex; align-items:center;">${headerIconHtml} ${pl.title}</div>`;
        resultsList.appendChild(header);
        document.getElementById('back-to-pl').addEventListener('click', () => { currentView = 'playlists_root'; renderView(); });

        if (pl.tracks.length === 0) {
          resultsList.innerHTML += `<div class="initial-msg">This playlist is empty.<br>Search for songs and add them to this queue!</div>`;
        } else {
          renderTracks(pl.tracks, 'playlist_detail');
        }
      }
    }

    function renderTracks(trackArray, context) {
      trackArray.forEach((item, index) => {
        const trackEl = document.createElement('div');
        trackEl.className = 'track-item';
        trackEl.style.animationDelay = `${index * 0.05}s`;
        if (currentPlaybackQueue === trackArray && currentTrackIndex === index) trackEl.classList.add('active');

        const thumb = item.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop';
        const title = item.title || 'Untitled track';
        const authorName = item.author && item.author.name ? item.author.name : 'Unknown artist';
        const actionIcon = context === 'search' ? 'bi-plus-lg' : 'bi-x-lg';
        const actionClass = context === 'search' ? '' : 'delete-btn';
        
        // Grip handle for drag drop in playlist view
        let gripHtml = context === 'playlist_detail' ? `<i class="bi bi-grip-vertical" style="color: #95a5a6; margin-right: -0.2rem; font-size: 1.4rem; cursor: grab;"></i>` : '';

        trackEl.innerHTML = `${gripHtml}<div class="track-item-thumb"><img src="${thumb}" alt="thumb" /></div><div class="track-item-info"><div class="track-item-title">${title}</div><div class="track-item-artist">${authorName}</div></div><button class="action-btn ${actionClass}"><i class="bi ${actionIcon}"></i></button>`;

        if (context === 'playlist_detail') {
          trackEl.setAttribute('draggable', 'true');
          trackEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            setTimeout(() => trackEl.classList.add('dragging'), 0);
          });
          trackEl.addEventListener('dragover', (e) => {
            e.preventDefault(); e.dataTransfer.dropEffect = 'move'; trackEl.classList.add('drag-over');
          });
          trackEl.addEventListener('dragleave', () => trackEl.classList.remove('drag-over'));
          trackEl.addEventListener('drop', (e) => {
            e.preventDefault(); trackEl.classList.remove('drag-over');
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = index;
            if (draggedIndex === targetIndex || isNaN(draggedIndex)) return;
            
            const pl = playlists.find(p => p.id === activePlaylistId);
            const draggedItem = pl.tracks.splice(draggedIndex, 1)[0];
            pl.tracks.splice(targetIndex, 0, draggedItem);
            
            if (currentPlaybackQueue === pl.tracks) {
              if (currentTrackIndex === draggedIndex) currentTrackIndex = targetIndex;
              else if (currentTrackIndex > draggedIndex && currentTrackIndex <= targetIndex) currentTrackIndex--;
              else if (currentTrackIndex < draggedIndex && currentTrackIndex >= targetIndex) currentTrackIndex++;
            }
            savePlaylists(); renderView();
          });
          trackEl.addEventListener('dragend', () => trackEl.classList.remove('dragging'));
        }

        // Add to playlist (from search)
        trackEl.querySelector('.action-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (context === 'search') {
            let optionsHtml = playlists.map(pl => `<div class="swal-pl-option" data-id="${pl.id}">${pl.coverImage ? `<img src="${pl.coverImage}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;">` : `<i class="bi ${pl.icon}" style="color:${pl.color}; font-size:1.5rem;"></i>`} <span>${pl.title}</span></div>`).join('');
            Swal.fire({
              title: 'Add to Queue/Playlist', html: `<div style="max-height: 250px; overflow-y: auto;">${optionsHtml}</div>`,
              showConfirmButton: false, showCloseButton: true, customClass: { popup: 'swal-custom-popup' },
              didOpen: () => {
                document.querySelectorAll('.swal-pl-option').forEach(opt => {
                  opt.addEventListener('click', () => {
                    const plId = opt.getAttribute('data-id'); const pl = playlists.find(p => p.id === plId);
                    if (pl.tracks.some(t => t.id === item.id)) { Swal.showValidationMessage('Track already in playlist!'); return; }
                    pl.tracks.push(item); savePlaylists(); Swal.close();
                    Swal.fire({ icon: 'success', title: 'Added!', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, background: 'rgba(255,255,255,0.9)'});
                    if (currentView === 'playlist_detail' && activePlaylistId === plId) renderView();
                  });
                });
              }
            });
          } else {
            const pl = playlists.find(p => p.id === activePlaylistId);
            Swal.fire({
              title: 'Remove track?', text: "It will be removed from this queue.", icon: 'warning',
              showCancelButton: true, confirmButtonColor: '#e74c3c', cancelButtonColor: '#95a5a6', confirmButtonText: 'Yes, remove it',
              customClass: { popup: 'swal-custom-popup' }
            }).then((result) => {
              if (result.isConfirmed) {
                pl.tracks.splice(index, 1);
                if (currentPlaybackQueue === pl.tracks) {
                  if (currentTrackIndex === index) { audioPlayer.pause(); currentTrackIndex = -1; updatePlayState(false); } 
                  else if (currentTrackIndex > index) { currentTrackIndex--; }
                }
                savePlaylists(); renderView();
              }
            });
          }
        });

        // Play track
        trackEl.addEventListener('click', () => {
          currentPlaybackQueue = trackArray; currentTrackIndex = index;
          if (context === 'playlist_detail') { const pl = playlists.find(p => p.id === activePlaylistId); currentQueueName = pl.title; } 
          else { currentQueueName = "Search Results"; }
          playCurrentTrack(); renderView();
        });

        resultsList.appendChild(trackEl);
      });
    }

    async function createNewPlaylist() {
      const { value: formValues } = await Swal.fire({
        title: 'New Playlist',
        html: `
          <input id="swal-input-title" class="swal2-input" placeholder="Playlist Name" style="background:rgba(255,255,255,0.5); border:1px solid #74ebd5; color:#2c3e50;">
          <div style="margin-top: 1rem; text-align: left; color:#7f8c8d; font-weight:600;">Optional Cover Image:</div>
          <input type="file" id="swal-input-image" accept="image/*" class="swal2-file" style="background:rgba(255,255,255,0.5); border:1px solid #74ebd5;">
        `,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Create', confirmButtonColor: '#1abc9c',
        customClass: { popup: 'swal-custom-popup' },
        preConfirm: async () => {
          const title = document.getElementById('swal-input-title').value;
          const fileInput = document.getElementById('swal-input-image');
          if (!title) { Swal.showValidationMessage('Please enter a name'); return false; }
          let coverImage = null;
          if (fileInput.files && fileInput.files[0]) { coverImage = await resizeImageForStorage(fileInput.files[0]); }
          return { title, coverImage };
        }
      });
      if (formValues) {
        const randomPalette = aestheticPalettes[Math.floor(Math.random() * aestheticPalettes.length)];
        const newPl = { id: 'pl_' + Date.now(), title: formValues.title, color: randomPalette.color, icon: randomPalette.icon, coverImage: formValues.coverImage, tracks: [] };
        playlists.push(newPl); savePlaylists(); renderView();
        Swal.fire({ icon: 'success', title: 'Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
      }
    }

    // --- Audio Player Logic ---
    function playCurrentTrack() {
      if (currentTrackIndex < 0 || currentTrackIndex >= currentPlaybackQueue.length) return;
      const track = currentPlaybackQueue[currentTrackIndex];
      
      initVisualizer();
      
      playerLoading.style.display = 'flex';
      playerTitle.textContent = track.title || 'Unknown';
      playerArtist.textContent = (track.author && track.author.name) ? track.author.name : 'Unknown';
      playingContext.textContent = `Queue: ${currentQueueName}`;
      
      if (track.thumbnail) { playerArt.src = track.thumbnail; playerArt.style.display = 'block'; defaultArt.style.display = 'none'; } 
      else { playerArt.style.display = 'none'; defaultArt.style.display = 'block'; }
      
      fetch(`https://me0w.tech/api/sc/format?url=${encodeURIComponent(track.url)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.url) {
            audioPlayer.src = data.url;
            audioPlayer.play().then(() => { updatePlayState(true); playerLoading.style.display = 'none'; }).catch(e => { console.error("Playback error", e); playerLoading.style.display = 'none'; });
            fetchLyrics(track.url);
          } else { throw new Error("Invalid stream URL"); }
        })
        .catch(err => { console.error(err); playerLoading.style.display = 'none'; Swal.fire('Error', 'Could not play track', 'error'); });
    }

    function playNext() {
      if (currentPlaybackQueue.length === 0) return;
      if (isRepeat) { playCurrentTrack(); return; }
      currentTrackIndex++;
      if (currentTrackIndex >= currentPlaybackQueue.length) { currentTrackIndex = 0; audioPlayer.pause(); updatePlayState(false); } 
      else { playCurrentTrack(); }
      renderView();
    }
    function playPrev() {
      if (currentPlaybackQueue.length === 0) return;
      if (audioPlayer.currentTime > 3) { audioPlayer.currentTime = 0; return; }
      currentTrackIndex--;
      if (currentTrackIndex < 0) currentTrackIndex = currentPlaybackQueue.length - 1;
      playCurrentTrack(); renderView();
    }

    // --- Search ---
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

    function performSearch() {
      const q = searchInput.value.trim();
      if (!q) return;
      searchLoading.style.display = 'flex'; currentView = 'search';
      tabSearch.classList.add('active'); tabPlaylists.classList.remove('active');
      
      fetch(`https://me0w.tech/api/sc/search?q=${encodeURIComponent(q)}`)
        .then(res => res.json())
        .then(data => {
          searchResults = data; renderView(); searchLoading.style.display = 'none';
        })
        .catch(err => {
          console.error(err); searchLoading.style.display = 'none'; resultsList.innerHTML = '<div class="initial-msg">Error fetching results.</div>';
        });
    }

    // --- Event Listeners ---
    tabSearch.addEventListener('click', () => { currentView = 'search'; tabSearch.classList.add('active'); tabPlaylists.classList.remove('active'); renderView(); });
    tabPlaylists.addEventListener('click', () => { currentView = 'playlists_root'; tabPlaylists.classList.add('active'); tabSearch.classList.remove('active'); renderView(); });

    playPauseBtn.addEventListener('click', () => {
      if (!audioPlayer.src) { if (currentPlaybackQueue.length > 0) { currentTrackIndex = 0; playCurrentTrack(); } return; }
      if (audioPlayer.paused) { audioPlayer.play(); initVisualizer(); updatePlayState(true); } 
      else { audioPlayer.pause(); updatePlayState(false); }
    });
    btnNext.addEventListener('click', playNext);
    btnPrev.addEventListener('click', playPrev);
    btnRepeat.addEventListener('click', () => { isRepeat = !isRepeat; btnRepeat.style.color = isRepeat ? '#1abc9c' : '#7f8c8d'; });

    audioPlayer.addEventListener('timeupdate', () => {
      if (audioPlayer.duration) {
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${progress}%`;
        syncLyrics();
      }
    });

    progressContainer.addEventListener('mousemove', (e) => {
      if (!audioPlayer.duration) return; const rect = progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const hoverTime = pos * audioPlayer.duration;
      progressTooltip.textContent = formatTime(hoverTime);
      progressTooltip.style.left = `${pos * 100}%`;
    });
    progressContainer.addEventListener('click', (e) => {
      if (!audioPlayer.duration) return; const rect = progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width; audioPlayer.currentTime = pos * audioPlayer.duration;
    });

    audioPlayer.addEventListener('ended', () => { if (isRepeat) { audioPlayer.currentTime = 0; audioPlayer.play(); } else { playNext(); } });

    // Volume Control
    volumeContainer.addEventListener('click', (e) => {
      const rect = volumeContainer.getBoundingClientRect(); let pos = (e.clientX - rect.left) / rect.width; pos = Math.max(0, Math.min(1, pos)); 
      audioPlayer.volume = pos; volumeFill.style.width = (pos * 100) + '%'; muteBtn.className = pos === 0 ? 'bi bi-volume-mute-fill' : 'bi bi-volume-up-fill';
    });
    muteBtn.addEventListener('click', () => {
      if (audioPlayer.volume > 0) { audioPlayer.dataset.lastVol = audioPlayer.volume; audioPlayer.volume = 0; volumeFill.style.width = '0%'; muteBtn.className = 'bi bi-volume-mute-fill'; } 
      else { const lastVol = audioPlayer.dataset.lastVol || 1; audioPlayer.volume = lastVol; volumeFill.style.width = (lastVol * 100) + '%'; muteBtn.className = 'bi bi-volume-up-fill'; }
    });

    // --- Lyrics Engine ---
    lyricsBtn.addEventListener('click', () => { lyricsPanel.classList.add('active'); });
    closeLyricsBtn.addEventListener('click', () => { lyricsPanel.classList.remove('active'); });

    function fetchLyrics(trackUrl) {
        currentParsedLyrics = null;
        lyricsContent.innerHTML = '<div class="initial-msg"><div class="loading-spinner" style="margin: 0 auto 1rem;"></div>Loading lyrics...</div>';
        lyricsTitleDisplay.textContent = playerTitle.textContent;
        
        fetch(`https://me0w.tech/api/sc/lyrics?url=${encodeURIComponent(trackUrl)}`)
            .then(res => res.json())
            .then(data => {
                if(data && data.lyrics) { parseAndRenderLyrics(data.lyrics); } 
                else { lyricsContent.innerHTML = '<div class="initial-msg">No lyrics found for this track.</div>'; }
            })
            .catch(err => { console.error("Lyrics error:", err); lyricsContent.innerHTML = '<div class="initial-msg">Error loading lyrics.</div>'; });
    }

    function parseAndRenderLyrics(rawLyrics) {
        const lines = rawLyrics.split('\n');
        const parsed = [];
        const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        isSyncedLyrics = false;

        lines.forEach(line => {
            const match = lrcRegex.exec(line.trim());
            if (match) {
                isSyncedLyrics = true;
                const m = parseInt(match[1], 10);
                const s = parseInt(match[2], 10);
                const ms = parseInt(match[3].padEnd(3, '0'), 10);
                const timeInSec = (m * 60) + s + (ms / 1000);
                const text = match[4].trim();
                if (text) parsed.push({ time: timeInSec, text: text });
            } else if (line.trim()) {
                parsed.push({ time: null, text: line.trim() });
            }
        });

        currentParsedLyrics = parsed;
        lyricsContent.innerHTML = '';
        
        if (parsed.length === 0) {
             lyricsContent.innerHTML = '<div class="initial-msg">Lyrics are empty.</div>'; return;
        }

        parsed.forEach((lineData, idx) => {
            const lineEl = document.createElement('div');
            lineEl.className = 'lyric-line';
            lineEl.textContent = lineData.text;
            lineEl.id = `lyric-${idx}`;
            
            if (isSyncedLyrics) {
                lineEl.addEventListener('click', () => { audioPlayer.currentTime = lineData.time; if(audioPlayer.paused) audioPlayer.play(); });
            }
            lyricsContent.appendChild(lineEl);
        });
    }

    function syncLyrics() {
        if (!isSyncedLyrics || !currentParsedLyrics || currentParsedLyrics.length === 0) return;
        const currentT = audioPlayer.currentTime;
        let activeIdx = -1;

        for (let i = 0; i < currentParsedLyrics.length; i++) {
            if (currentT >= currentParsedLyrics[i].time) { activeIdx = i; } 
            else { break; }
        }

        if (activeIdx !== -1) {
            const currentActive = document.querySelector('.lyric-line.active');
            const targetEl = document.getElementById(`lyric-${activeIdx}`);
            
            if (currentActive !== targetEl) {
                if (currentActive) currentActive.classList.remove('active');
                if (targetEl) {
                    targetEl.classList.add('active');
                    const scrollTarget = targetEl.offsetTop - (lyricsScrollArea.offsetHeight / 2) + (targetEl.offsetHeight / 2);
                    lyricsScrollArea.scrollTop = scrollTarget;
                }
            }
        }
    }

    // Init Library View
    renderView();
