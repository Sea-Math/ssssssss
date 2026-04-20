import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
    import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, getDocs, where, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyCbm8kEHYW5Yq_uqQWc602oIUhsBFa8Qa0",
  authDomain: "chat-1e794.firebaseapp.com",
  projectId: "chat-1e794",
  storageBucket: "chat-1e794.firebasestorage.app",
  messagingSenderId: "28811401532",
  appId: "1:28811401532:web:5aa189d6b446ea66952639",
  measurementId: "G-67VSY5ZV5P"
};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    lucide.createIcons();

    // App State
    let currentUser = { uid: "", name: "", imageBase64: "" };
    let currentRoomId = "global";
    let unsubscribeMessages = null;
    let selectedUsersForGroup = [];
    let hasSentJoinMessage = false;
    
    const activeListeners = {};
    const sessionStartTime = Date.now();

    const msgContainer = document.getElementById('msg-container');
    const msgInput = document.getElementById('msg-input');

    // -- MEMORY & NOTIFICATIONS --
    function saveSidebarState() {
      const dms = [];
      document.querySelectorAll('#channel-list-dms .channel-item').forEach(el => {
        dms.push({ id: el.dataset.room, name: el.querySelector('span').innerText });
      });
      localStorage.setItem(`darkchat_dms_${currentUser.uid}`, JSON.stringify(dms));
    }

    function loadSidebarState() {
      const saved = localStorage.getItem(`darkchat_dms_${currentUser.uid}`);
      if (saved) {
        const dms = JSON.parse(saved);
        dms.forEach(dm => addChannelToSidebar(dm.id, dm.name, true, true));
      }
      listenForUnread('global');
    }

    function listenForUnread(roomId) {
      if (activeListeners[roomId]) return; 
      const q = query(collection(db, `rooms/${roomId}/messages`), orderBy("timestamp", "desc"), limit(1));
      
      activeListeners[roomId] = onSnapshot(q, (snapshot) => {
        if (roomId === currentRoomId) return; 
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const msgTime = data.timestamp ? data.timestamp.toDate().getTime() : Date.now();
            if (msgTime > sessionStartTime && data.senderId !== currentUser.uid && !data.isSystem) {
              const sidebarItem = document.querySelector(`[data-room="${roomId}"]`);
              if (sidebarItem && !sidebarItem.querySelector('.unread-dot')) {
                sidebarItem.insertAdjacentHTML('beforeend', '<div class="unread-dot"></div>');
              }
            }
          }
        });
      });
    }

    // -- NEW: SYSTEM MESSAGES --
    async function sendSystemMessage(text, type) {
      try {
        await addDoc(collection(db, `rooms/global/messages`), {
          isSystem: true,
          text: text,
          type: type, // 'join' or 'leave'
          timestamp: serverTimestamp()
        });
      } catch (e) { console.error("System message failed"); }
    }

    // 1. AUTO SIGN-IN
    const savedSession = localStorage.getItem('darkchat_session');
    if (savedSession) {
      currentUser = JSON.parse(savedSession);
      document.getElementById('login-overlay').style.display = "none";
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!currentUser.name || !currentUser.imageBase64) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if(userDoc.exists()) {
            currentUser = { uid: user.uid, ...userDoc.data() };
            localStorage.setItem('darkchat_session', JSON.stringify(currentUser));
          }
        }
        document.getElementById('login-overlay').style.display = "none";
        
        loadSidebarState(); 
        await setPresence(true);
        startFailSafeHeartbeat();
        loadMessages(currentRoomId);
        listenToPresence();
        listenToInvites();
        
        // Broadcast Join Message
        if (!hasSentJoinMessage) {
          sendSystemMessage(`${currentUser.name} slid into the server.`, 'join');
          hasSentJoinMessage = true;
        }
      } else {
        document.getElementById('login-overlay').style.display = "flex";
      }
    });

    document.getElementById('login-icon').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { currentUser.imageBase64 = event.target.result; };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('btn-enter').addEventListener('click', async () => {
      const username = document.getElementById('login-user').value.trim();
      const password = document.getElementById('login-pass').value.trim();
      if (username.length < 3) return alert("Username must be at least 3 chars");
      if (!currentUser.imageBase64) return alert("Upload an avatar");

      const fakeEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@darkchat.app`;
      try {
        let userCredential;
        try { userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password); } 
        catch (e) { userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password); }
        
        currentUser.uid = userCredential.user.uid; currentUser.name = username;
        localStorage.setItem('darkchat_session', JSON.stringify(currentUser));
        await setDoc(doc(db, "users", currentUser.uid), { name: currentUser.name, imageBase64: currentUser.imageBase64 }, { merge: true });
      } catch (error) { alert("Login Error: " + error.message); }
    });

    // 2. SENDING MESSAGES
    async function sendMessage(textOverride = null, attachmentBase64 = null) {
      const text = textOverride !== null ? textOverride : msgInput.value.trim();
      if(!text && !attachmentBase64) return;
      msgInput.value = '';

      let payload = { senderId: currentUser.uid, senderName: currentUser.name, imageBase64: currentUser.imageBase64, timestamp: serverTimestamp() };
      if (text) payload.text = text;
      if (attachmentBase64) payload.attachedImageBase64 = attachmentBase64;

      try { await addDoc(collection(db, `rooms/${currentRoomId}/messages`), payload); } 
      catch (error) { alert("Error: " + error.message); }
    }

    document.getElementById('send-btn').addEventListener('click', () => sendMessage());
    msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
    document.getElementById('attach-btn').addEventListener('click', () => document.getElementById('image-upload').click());
    document.getElementById('image-upload').addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => { sendMessage(null, event.target.result); };
      reader.readAsDataURL(file);
    });

    // 3. SEARCH & DMs & ADD TO GROUP
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('user-search-input');
    const searchResultsList = document.getElementById('search-results-list');
    const groupNameInput = document.getElementById('new-group-name');
    const createInviteBtn = document.getElementById('create-invite-btn');

    // Default New Chat Modal
    document.getElementById('open-search-btn').addEventListener('click', () => {
      searchModal.classList.add('active'); searchInput.value = ''; groupNameInput.value = '';
      document.getElementById('group-name-container').style.display = 'block';
      document.getElementById('modal-title').innerText = "Find User / Create Group";
      selectedUsersForGroup = []; createInviteBtn.style.display = 'none'; createInviteBtn.dataset.mode = 'new';
      renderSearchResults(); 
    });

    // Add to Existing Group Modal
    document.getElementById('add-to-group-btn').addEventListener('click', () => {
      searchModal.classList.add('active'); searchInput.value = '';
      document.getElementById('group-name-container').style.display = 'none';
      document.getElementById('modal-title').innerText = "Invite to Group";
      selectedUsersForGroup = []; createInviteBtn.style.display = 'none'; createInviteBtn.dataset.mode = 'add';
      renderSearchResults();
    });

    document.getElementById('close-search-btn').addEventListener('click', () => searchModal.classList.remove('active'));
    document.getElementById('cancel-search-btn').addEventListener('click', () => searchModal.classList.remove('active'));
    searchInput.addEventListener('input', renderSearchResults);

    async function renderSearchResults() {
      const filter = searchInput.value.toLowerCase();
      searchResultsList.innerHTML = '<div style="padding:10px; color:#666;">Searching database...</div>';
      const snap = await getDocs(collection(db, 'users'));
      searchResultsList.innerHTML = '';
      
      snap.docs.forEach(docSnap => {
        const userData = docSnap.data(); const uid = docSnap.id;
        if (uid === currentUser.uid) return; 
        if (filter && !userData.name.toLowerCase().includes(filter)) return; 
        
        const isSelected = selectedUsersForGroup.includes(uid);
        const mode = createInviteBtn.dataset.mode;
        const btnText = (groupNameInput.value.trim() !== '' || mode === 'add') ? (isSelected ? 'Selected' : 'Select') : 'Message';

        const html = `
          <div class="search-user-item" style="background: ${isSelected ? 'var(--bg-hover)' : 'transparent'}; border-left: ${isSelected ? '3px solid var(--accent-blue)' : 'none'}">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${userData.imageBase64}" style="width:24px; height:24px; border-radius:50%;">
              <span>${userData.name}</span>
            </div>
            <button class="btn-cancel" style="padding: 4px 8px; font-size:11px; background: ${isSelected ? 'var(--accent-blue)' : 'var(--bg-panel)'};" onclick="handleUserSelect('${uid}', '${userData.name}')">${btnText}</button>
          </div>
        `;
        searchResultsList.insertAdjacentHTML('beforeend', html);
      });
    }

    groupNameInput.addEventListener('input', () => {
      if(groupNameInput.value.trim() === '') { selectedUsersForGroup = []; createInviteBtn.style.display = 'none'; }
      renderSearchResults();
    });

    window.handleUserSelect = function(targetUid, targetName) {
      const mode = createInviteBtn.dataset.mode;
      if (mode === 'new' && groupNameInput.value.trim() === '') {
        startDirectMessage(targetUid, targetName); searchModal.classList.remove('active');
      } else {
        if (selectedUsersForGroup.includes(targetUid)) selectedUsersForGroup = selectedUsersForGroup.filter(id => id !== targetUid);
        else selectedUsersForGroup.push(targetUid);
        createInviteBtn.style.display = selectedUsersForGroup.length > 0 ? 'block' : 'none'; renderSearchResults();
      }
    };

    createInviteBtn.addEventListener('click', async () => {
      const mode = createInviteBtn.dataset.mode;
      let roomId, roomName;
      
      if (mode === 'new') {
        roomName = groupNameInput.value.trim();
        roomId = `group_${Date.now()}_${currentUser.uid.substring(0,5)}`;
        addChannelToSidebar(roomId, roomName, true); switchRoom(roomId, roomName);
      } else {
        roomId = currentRoomId;
        roomName = document.getElementById('current-room-title').innerText;
      }

      for (const targetUid of selectedUsersForGroup) {
        await addDoc(collection(db, 'invites'), { targetUid: targetUid, senderId: currentUser.uid, senderName: currentUser.name, roomId: roomId, roomName: roomName, type: 'group', timestamp: serverTimestamp() });
      }
      searchModal.classList.remove('active');
    });

    window.startDirectMessage = async function(targetUid, targetName) {
      if (targetUid === currentUser.uid) return;
      const uids = [currentUser.uid, targetUid].sort();
      const dmRoomId = `dm_${uids[0]}_${uids[1]}`;
      
      addChannelToSidebar(dmRoomId, `@${targetName}`, true);
      switchRoom(dmRoomId, `@${targetName}`);
      if(window.innerWidth < 768) document.getElementById('right-sidebar').classList.add('hidden');

      // NEW: Send a Silent DM Invite to force notification on their end
      await addDoc(collection(db, 'invites'), {
        targetUid: targetUid, senderId: currentUser.uid, senderName: currentUser.name, 
        roomId: dmRoomId, roomName: `@${currentUser.name}`, type: 'dm', timestamp: serverTimestamp()
      });
    };

    function listenToInvites() {
      const q = query(collection(db, "invites"), where("targetUid", "==", currentUser.uid));
      onSnapshot(q, (snapshot) => {
        const invitesList = document.getElementById('invites-list'); const invitesSection = document.getElementById('invites-section');
        let visibleInvites = 0; invitesList.innerHTML = '';
        
        snapshot.docs.forEach(docSnap => {
          const invite = docSnap.data(); const inviteId = docSnap.id;
          
          // NEW: Auto-accept DMs for instant notifications
          if (invite.type === 'dm') {
            addChannelToSidebar(invite.roomId, invite.roomName, true);
            const sidebarItem = document.querySelector(`[data-room="${invite.roomId}"]`);
            if (sidebarItem && !sidebarItem.querySelector('.unread-dot') && currentRoomId !== invite.roomId) {
              sidebarItem.insertAdjacentHTML('beforeend', '<div class="unread-dot"></div>');
            }
            deleteDoc(doc(db, "invites", inviteId)); // Clean up silent invite
            return;
          }

          visibleInvites++;
          const html = `<div class="invite-item"><strong style="color:var(--text-main)">${invite.senderName}</strong> invited you to:<br><span style="font-weight:bold; color:var(--text-blue-pill)">#${invite.roomName}</span><div class="invite-actions"><button class="btn-small btn-accept" onclick="handleInvite('${inviteId}', '${invite.roomId}', '${invite.roomName}', true)">Accept</button><button class="btn-small btn-decline" onclick="handleInvite('${inviteId}', null, null, false)">Decline</button></div></div>`;
          invitesList.insertAdjacentHTML('beforeend', html);
        });
        invitesSection.style.display = visibleInvites > 0 ? 'block' : 'none';
      });
    }

    window.handleInvite = async function(inviteId, roomId, roomName, isAccepted) {
      if (isAccepted) { addChannelToSidebar(roomId, roomName, true); switchRoom(roomId, roomName); }
      await deleteDoc(doc(db, "invites", inviteId));
    };

    // 4. PRESENCE & UI
    async function setPresence(isOnline) {
      if (!currentUser.uid) return;
      try { await setDoc(doc(db, "presence", currentUser.uid), { online: isOnline, lastActive: serverTimestamp(), name: currentUser.name }, { merge: true }); } catch(e) {}
    }

    function startFailSafeHeartbeat() {
      setInterval(() => { if (!document.hidden) setPresence(true); }, 15000);
      document.addEventListener("visibilitychange", () => setPresence(document.visibilityState === 'visible'));
    }

    window.addEventListener('beforeunload', () => {
      setPresence(false);
      sendSystemMessage(`${currentUser.name} disconnected.`, 'leave');
    });

    function listenToPresence() {
      const q = query(collection(db, "presence"), where("online", "==", true));
      onSnapshot(q, async (snapshot) => {
        const listEl = document.getElementById('online-users-list'); listEl.innerHTML = '';
        let activeCount = 0; const now = new Date().getTime();

        for (const presenceDoc of snapshot.docs) {
          const data = presenceDoc.data();
          const lastActiveTime = data.lastActive ? data.lastActive.toDate().getTime() : now;
          if (now - lastActiveTime > 60000) continue; 
          activeCount++;
          const userSnap = await getDoc(doc(db, "users", presenceDoc.id));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const html = `<div class="online-user" onclick="startDirectMessage('${presenceDoc.id}', '${userData.name}')"><div class="avatar-wrapper"><img src="${userData.imageBase64}" class="avatar" style="width:32px;height:32px;"><div class="status-dot"></div></div><span class="name-tag">${userData.name}</span></div>`;
            listEl.insertAdjacentHTML('beforeend', html);
          }
        }
        document.getElementById('online-count').innerText = activeCount;
      });
    }

    function loadMessages(roomId) {
      if(unsubscribeMessages) unsubscribeMessages();
      msgContainer.innerHTML = ''; 
      const q = query(collection(db, `rooms/${roomId}/messages`), orderBy("timestamp", "asc"));
      
      unsubscribeMessages = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            
            // NEW: System Message Rendering
            if (data.isSystem) {
              const arrow = data.type === 'join' ? '→' : '←';
              const html = `
                <div class="msg-system ${data.type}">
                  <div class="msg-system-content">${arrow} ${data.text}</div>
                </div>
              `;
              msgContainer.insertAdjacentHTML('beforeend', html);
              msgContainer.scrollTop = msgContainer.scrollHeight;
              return;
            }

            // Normal Messages
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Now";
            const attachmentHtml = data.attachedImageBase64 ? `<img src="${data.attachedImageBase64}" class="msg-attached-image" onclick="window.open(this.src)">` : '';
            const isMentioned = data.text && currentUser.name && data.text.includes(`@${currentUser.name}`);
            const textHtml = data.text ? `<div class="message-content">${data.text}</div>` : '';
            const isSentByMe = data.senderId === currentUser.uid;
            const alignmentClass = isSentByMe ? 'sent' : 'received';

            const html = `
              <div class="message-wrapper ${alignmentClass}">
                <img src="${data.imageBase64}" class="avatar">
                <div class="message-box ${isMentioned ? 'mentioned' : ''}">
                  <div class="message-header">
                    <div class="user-info"><span class="name">${isSentByMe ? 'You' : data.senderName}</span></div>
                    <span class="timestamp">${time}</span>
                  </div>
                  ${textHtml}${attachmentHtml}
                </div>
              </div>
            `;
            msgContainer.insertAdjacentHTML('beforeend', html);
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }
        });
      });
    }

    function addChannelToSidebar(roomId, roomName, isCustom = false, skipSave = false) {
      if(document.querySelector(`[data-room="${roomId}"]`)) return; 
      const icon = roomId.startsWith('dm_') ? 'user' : 'hash';
      const containerId = isCustom ? 'channel-list-dms' : 'channel-list-public';
      const html = `<div class="channel-item" data-room="${roomId}"><div class="channel-icon"><i data-lucide="${icon}" size="14"></i></div><span>${roomName}</span></div>`;
      
      document.getElementById(containerId).insertAdjacentHTML('beforeend', html);
      lucide.createIcons();
      listenForUnread(roomId);
      if (isCustom && !skipSave) saveSidebarState();
    }

    document.querySelector('.sidebar-left').addEventListener('click', (e) => {
      const item = e.target.closest('.channel-item');
      if (item) switchRoom(item.dataset.room, item.querySelector('span').innerText);
    });

    function switchRoom(roomId, roomName) {
      currentRoomId = roomId; document.getElementById('current-room-title').innerText = roomName;
      document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
      
      const activeItem = document.querySelector(`[data-room="${roomId}"]`);
      if (activeItem) {
        activeItem.classList.add('active');
        const dot = activeItem.querySelector('.unread-dot');
        if (dot) dot.remove();
      }
      
      const isDM = roomId.startsWith('dm_');
      const isGroup = roomId.startsWith('group_');
      
      // Show/Hide Add Users button
      document.getElementById('add-to-group-btn').style.display = isGroup ? 'block' : 'none';

      document.getElementById('status-pill').style.background = isDM ? 'rgba(0, 122, 255, 0.2)' : 'var(--bg-green-pill)';
      document.querySelector('#status-pill .dot').style.background = isDM ? 'var(--accent-blue)' : 'var(--accent-green)';
      document.querySelector('#status-pill .dot').style.boxShadow = isDM ? '0 0 8px var(--accent-blue)' : '0 0 8px var(--accent-green)';
      loadMessages(roomId);
    }

    document.getElementById('toggle-users-btn').addEventListener('click', () => document.getElementById('right-sidebar').classList.toggle('hidden'));
    document.getElementById('close-right-sidebar').addEventListener('click', () => document.getElementById('right-sidebar').classList.add('hidden'));

