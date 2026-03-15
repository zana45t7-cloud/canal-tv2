const state = {
    current: null,
    next: [],
    isAdmin: false,
    sessionToken: '',
    ytPlayer: null,
    ytReady: false,
    playerType: null, // 'html5', 'youtube', 'okru'
    pollInterval: 5000
};

// DOM Elements
const el = {
    adminToggle: document.getElementById('admin-toggle'),
    adminPanel: document.getElementById('admin-panel'),
    adminClose: document.getElementById('admin-close'),
    adminLoginView: document.getElementById('admin-login-view'),
    adminContentView: document.getElementById('admin-content-view'),
    adminPass: document.getElementById('admin-pass'),
    adminLoginBtn: document.getElementById('admin-login-btn'),
    
    playerContainer: document.getElementById('player-container'),
    ytTarget: document.getElementById('yt-player-target'),
    h5Container: document.getElementById('h5-player-container'),
    okContainer: document.getElementById('ok-player-container'),
    
    currentTitle: document.getElementById('current-title'),
    clock: document.getElementById('clock'),
    ticker: document.getElementById('ticker'),
    
    schedTitle: document.getElementById('sched-title'),
    schedUrl: document.getElementById('sched-url'),
    schedTime: document.getElementById('sched-time'),
    addSchedBtn: document.getElementById('add-schedule-btn'),
    scheduleItems: document.getElementById('schedule-items')
};

async function init() {
    setupEventListeners();
    updateClock();
    setInterval(updateClock, 1000);
    
    // YouTube API Callback
    window.onYouTubeIframeAPIReady = () => {
        state.ytReady = true;
        console.log('YouTube API Ready');
    };

    // Check for saved admin session
    const savedToken = localStorage.getItem('_gda_id');
    if (savedToken) {
        state.sessionToken = savedToken;
        state.isAdmin = true;
        el.adminLoginView.classList.add('hidden');
        el.adminContentView.classList.remove('hidden');
        fetchAdminSchedule();
    }
    
    // Start syncing loop
    syncState();
    setInterval(syncState, state.pollInterval);

    // Set default time to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el.schedTime.value = now.toISOString().slice(0, 16);
}

function setupEventListeners() {
    el.adminToggle.addEventListener('click', () => el.adminPanel.classList.remove('hidden'));
    el.adminClose.addEventListener('click', () => el.adminPanel.classList.add('hidden'));
    
    el.adminLoginBtn.addEventListener('click', async () => {
        const pass = el.adminPass.value;
        const data = await attemptLogin(pass);
        if (data && data.token) {
            state.sessionToken = data.token;
            localStorage.setItem('_gda_id', data.token);
        } else {
            alert('ACCESO DENEGADO - CÓDIGO INCORRECTO');
        }
    });

    el.addSchedBtn.addEventListener('click', addSchedule);
}

async function attemptLogin(password) {
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            const data = await res.json();
            state.isAdmin = true;
            el.adminLoginView.classList.add('hidden');
            el.adminContentView.classList.remove('hidden');
            fetchAdminSchedule();
            return data;
        }
    } catch (e) {}
    return null;
}

async function syncState() {
    try {
        const res = await fetch('/api/state');
        const data = await res.json();
        
        const prevId = state.current ? state.current.id : null;
        state.current = data.current;
        state.next = data.next;
        
        updateUI();
        
        if (state.current) {
            if (state.current.id !== prevId) {
                loadVideo(state.current);
            } else {
                syncPlayer(state.current.seekTime);
            }
        } else {
            stopPlayer();
        }
    } catch (e) {
        console.error('Sync failed', e);
    }
}

function updateUI() {
    if (state.current) {
        el.currentTitle.innerText = state.current.title;
        const nextTitle = state.next.length > 0 ? state.next[0].title : "FIN DE TRANSMISIÓN";
        el.ticker.innerText = `SINTONIZADO: ${state.current.title} || SIGUIENTE: ${nextTitle} || GDA GLOBAL BROADCAST SYSTEM || `;
    } else {
        el.currentTitle.innerText = "FUERA DEL AIRE";
        el.ticker.innerText = "NO HAY PROGRAMACIÓN ACTUAL || USE EL PANEL DE ADMIN PARA SUBIR CONTENIDO || ";
        if (!state.current && state.playerType) stopPlayer();
    }
}

function loadVideo(video) {
    const isYoutube = video.url.includes('youtube.com') || video.url.includes('youtu.be');
    const isOkRu = video.url.includes('ok.ru');
    
    console.log('Switching to:', video.title, 'URL:', video.url);
    
    // Clear other players
    el.h5Container.innerHTML = '';
    el.okContainer.innerHTML = '';
    el.ytTarget.style.display = 'none';

    if (isYoutube) {
        const videoId = extractYoutubeId(video.url);
        if (!videoId) return;
        
        state.playerType = 'youtube';
        el.ytTarget.style.display = 'block';

        if (state.ytPlayer && state.ytReady) {
            state.ytPlayer.loadVideoById({
                videoId: videoId,
                startSeconds: Math.floor(video.seekTime)
            });
            state.ytPlayer.mute(); 
            state.ytPlayer.playVideo();
        } else if (window.YT && window.YT.Player) {
            state.ytPlayer = new YT.Player('yt-player-target', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'autoplay': 1,
                    'mute': 1,
                    'start': Math.floor(video.seekTime),
                    'controls': 1,
                    'rel': 0
                },
                events: {
                    'onReady': (e) => {
                        state.ytReady = true;
                        e.target.playVideo();
                    }
                }
            });
        }
    } 
    else if (isOkRu) {
        const okMatch = video.url.match(/video\/(\d+)/);
        if (okMatch) {
            state.playerType = 'okru';
            el.okContainer.innerHTML = `
                <iframe width="100%" height="100%" 
                src="https://ok.ru/videoembed/${okMatch[1]}?autoplay=1" 
                frameborder="0" allow="autoplay; encrypted-media; fullscreen" 
                allowfullscreen></iframe>`;
        }
    }
    else {
        state.playerType = 'html5';
        el.h5Container.innerHTML = `
            <video id="h5-player" width="100%" height="100%" autoplay controls>
                <source src="${video.url}" type="video/mp4">
            </video>`;
        const v = document.getElementById('h5-player');
        if (v) {
            v.currentTime = video.seekTime;
            v.play().catch(() => {
                v.muted = true;
                v.play();
            });
        }
    }
}

function syncPlayer(seekTime) {
    if (state.playerType === 'html5') {
        const v = document.getElementById('h5-player');
        if (v && !v.paused && Math.abs(v.currentTime - seekTime) > 5) {
            v.currentTime = seekTime;
        }
    } else if (state.playerType === 'youtube' && state.ytPlayer && state.ytReady) {
        const curTime = state.ytPlayer.getCurrentTime();
        if (Math.abs(curTime - seekTime) > 10) {
            state.ytPlayer.seekTo(seekTime, true);
        }
    }
}

function stopPlayer() {
    el.h5Container.innerHTML = '';
    el.okContainer.innerHTML = '';
    el.ytTarget.style.display = 'none';
    if (state.ytPlayer && state.ytReady) state.ytPlayer.stopVideo();
    state.playerType = null;
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function updateClock() {
    const now = new Date();
    el.clock.innerText = now.toLocaleTimeString();
}

// Admin Functions
async function addSchedule() {
    const title = el.schedTitle.value;
    const url = el.schedUrl.value;
    const startTime = Math.floor(new Date(el.schedTime.value).getTime() / 1000);

    if (!title || !url || !startTime) return alert('COMPLETE LOS DATOS');

    try {
        const res = await fetch('/api/admin/schedule', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': state.sessionToken
            },
            body: JSON.stringify({ title, url, startTime })
        });
        
        if (res.ok) {
            el.schedTitle.value = '';
            el.schedUrl.value = '';
            fetchAdminSchedule();
            syncState();
        }
    } catch (e) {
        alert('Error al programar');
    }
}

async function fetchAdminSchedule() {
    if (!state.isAdmin) return;
    try {
        const res = await fetch('/api/admin/schedule', {
            headers: { 'x-admin-token': state.sessionToken }
        });
        const data = await res.json();
        renderAdminSchedule(data);
    } catch (e) {}
}

function renderAdminSchedule(items) {
    el.scheduleItems.innerHTML = items.map(item => {
        const date = new Date(item.start_time * 1000).toLocaleString();
        return `
            <div class="sched-item">
                <div class="item-info">
                    <strong>${item.title}</strong><br>
                    <small>${date}</small>
                </div>
                <button class="btn-delete" onclick="deleteItem(${item.id})">ELIMINAR</button>
            </div>
        `;
    }).join('');
}

window.deleteItem = async (id) => {
    if (!confirm('¿CONFIRMAR ELIMINACIÓN?')) return;
    try {
        const res = await fetch(`/api/admin/schedule/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': state.sessionToken }
        });
        if (res.ok) fetchAdminSchedule();
    } catch (e) {}
};

init();
