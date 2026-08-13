// ============================================================
// KOTHA JAGIR SOLUTION PRIVATE LIMITED - COMPLETE APP
// Vanilla JS SPA with Hash Router & Glassmorphism UI (Backend Wired)
// ============================================================

// // APP STATE //""""""""""""""""""""""""""""""""""""""""""""""
const State = {
  route: '',
  routeParams: {},
  mode: 'rooms',
  
  // Metadata & Settings (Loaded from backend)
  localities: [],
  jobCategories: [],
  roomTypes: [],
  roomFeatures: [],
  adminWhatsapp: '9779841234567',
  adminQrCode: '',
  storageUsedGB: 0.0,
  storageTotalGB: 10.0,

  // Cache for dynamic collections
  listings: null,      // null = loading
  applications: null,  // null = loading
  notifications: null, // null = loading
  inquiries: null,     // null = loading
  currentListing: null,// null = loading

  // Filter forms
  roomFilters: { locality: '', budget: 35000, roomType: '', parking: 'any', suitableFor: '' },
  jobFilters: { locality: '', salary: 60000, category: '', jobType: '', experience: '' },
  gharJaggaFilters: { locality: '', category: '', type: '' },

  // Auth Status
  memberLoggedIn: false,
  currentMember: null,
  adminLoggedIn: false,
  currentAdmin: null,

  // UI States
  adminSection: 'requests',
  adminListingTab: 'room',
  adminAppSearch: '',
  adminAppFilter: 'all',
  notifOpen: false,
  pushEnabled: false,
  applyStep: 1,
  applyListingId: null,
  applyFormData: {},
  applyGeneratedId: '',
  toasts: [],
  gallery: {},        // photoIdx per listing id
  galleryMode: {},    // 'video' | 'photo' per listing id
  showCreateModal: false,
  showDeleteModal: false,
  deleteTarget: null,
  showAppModal: false,
  appModalData: null,
  showAdminPreviewModal: false,
  adminPreviewListing: null,
  adminSidebarOpen: false,  // mobile sidebar toggle

  // Async States
  loading: {},
  errors: {}
};

// // CONSTANTS //""""""""""""""""""""""""""""""""""""""""""""""
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract'];
const EXPERIENCE_LEVELS = ['Entry', 'Experienced', 'Any'];
const SUITABLE_FOR = ['Family', 'Student', 'Bachelor', 'Office'];
const AMENITIES_LIST = ['Wifi', 'Parking', 'Furnished', 'Water Supply', 'Electricity Backup', 'CCTV', 'Elevator', 'Balcony', 'Kitchen', 'AC'];
const JOB_REQUIREMENTS = ['English Speaking', 'Experience Required', 'Uniform Provided', 'Meals Included', 'Accommodation', 'Training', 'Insurance', '2-Wheeler'];

// // ROUTER //""""""""""""""""""""""""""""""""""""""""""""""""
function parseRoute() {
  const hash = location.hash.replace('#', '').replace(/^\//, '') || '';
  if (!hash || hash === '/') return { path: '/', params: {}, full: hash };

  const segments = hash.split('/').filter(Boolean);
  const params = {};

  if (segments[0] === 'room') {
    if (segments[1]) params.id = segments[1];
    if (segments[2]) params.sub = segments[2];
    return { path: '/room', params, full: hash };
  }
  if (segments[0] === 'jobs') {
    if (segments[1]) params.id = segments[1];
    if (segments[2]) params.sub = segments[2];
    return { path: '/jobs', params, full: hash };
  }
  if (segments[0] === 'ghar-jagga') {
    if (segments[1]) params.id = segments[1];
    if (segments[2]) params.sub = segments[2];
    return { path: '/ghar-jagga', params, full: hash };
  }
  if (segments[0] === 'apply') {
    if (segments[1]) params.id = segments[1];
    return { path: '/apply', params, full: hash };
  }
  if (segments[0] === 'admin') {
    if (segments[1] === 'dashboard') return { path: '/admin', params: { sub: 'dashboard' }, full: hash };
    return { path: '/admin', params: {}, full: hash };
  }
  if (segments[0] === 'login') return { path: '/login', params, full: hash };
  if (segments[0] === 'dashboard') return { path: '/dashboard', params, full: hash };

  return { path: '/' + segments[0], params, full: hash };
}

function navigate(to) {
  location.hash = to;
}

window.addEventListener('hashchange', () => {
  // Clear details/listings page-specific caches
  State.currentListing = null;
  State.errors = {};
  render();
});

// // ICONS (inline SVG) //""""""""""""""""""""""""""""""""""""
const Icon = {
  bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  map: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  lock: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  Nepal: `<span style="font-weight:700; color:var(--primary); font-size:1.1rem; line-height:1">🇳🇵</span>`
};

function amenityIcon(a) {
  const map = { 'Wifi': '[W]', 'Parking': '[P]', 'Furnished': '[F]', 'Water Supply': '[H2O]', 'Balcony': '[B]', 'AC': '[AC]', 'CCTV': '[CC]', 'Elevator': '[Lift]', 'Kitchen': '[Kitch]', 'Electricity Backup': '[Pwr]', 'English Speaking': '[Eng]', 'Experience Required': '[Exp]', 'Uniform Provided': '[Unif]', 'Meals Included': '[Meal]', 'Accommodation': '[Stay]', 'Training': '[Train]', 'Insurance': '[Ins]', '2-Wheeler': '[Bike]' };
  return map[a] || '[OK]';
}

// // TOAST MESSAGES //""""""""""""""""""""""""""""""""""""""""
function showToast(msg, type = 'success') {
  const id = Date.now();
  State.toasts.push({ id, msg, type });
  renderToasts();
  setTimeout(() => {
    State.toasts = State.toasts.filter(t => t.id !== id);
    renderToasts();
  }, 4000);
}

function renderToasts() {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = State.toasts.map(t => `<div class="toast ${t.type}">${t.msg}</div>`).join('');
}

// // LAYOUT PARTS //""""""""""""""""""""""""""""""""""""""""""
function renderNavbar() {
  const unreadNotifs = State.notifications ? State.notifications.filter(n => !n.read).length : 0;

  return `
  <nav class="navbar" id="main-navbar">
    <div class="container navbar-inner">
      <a class="navbar-brand" href="#/" aria-label="Kotha Jagir Solution home">
        <img src="logo.jpeg" alt="Kotha Jagir Logo" class="brand-logo" />
        <span class="brand-name">Kotha Jagir<br>Solution</span>
      </a>

      <div class="navbar-tabs" role="tablist">
        <button class="nav-tab ${State.mode === 'rooms' ? 'active' : ''}" onclick="setMode('rooms')" role="tab" aria-selected="${State.mode === 'rooms'}">Rooms</button>
        <button class="nav-tab ${State.mode === 'jobs' ? 'active' : ''}" onclick="setMode('jobs')" role="tab" aria-selected="${State.mode === 'jobs'}">Jobs</button>
        <button class="nav-tab ${State.mode === 'ghar-jagga' ? 'active' : ''}" onclick="setMode('ghar-jagga')" role="tab" aria-selected="${State.mode === 'ghar-jagga'}">Ghar/Jagga</button>
      </div>

      <div class="navbar-right">
        ${State.memberLoggedIn ? `
          <div class="notification-bell" id="notif-btn" onclick="toggleNotif()" aria-label="Notifications" aria-expanded="${State.notifOpen}" tabindex="0">
            ${Icon.bell}
            ${unreadNotifs > 0 ? `<span class="notification-badge" aria-label="${unreadNotifs} unread notifications"></span>` : ''}
            <div class="notif-dropdown glass ${State.notifOpen ? 'open' : ''}" id="notif-dropdown" role="menu">
              <div class="notif-header">Notifications (${unreadNotifs} new)</div>
              ${!State.notifications || State.notifications.length === 0 ? `
                <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">No notifications yet</div>
              ` : State.notifications.map(n => `
                <div class="notif-item" role="menuitem">
                  <div class="notif-text" style="font-weight:${n.read ? '400' : '600'}">${n.text}</div>
                  <div class="notif-time">${n.time}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="member-avatar" onclick="navigate('#/dashboard')" style="width:44px; height:44px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.15rem; cursor:pointer; text-transform:uppercase; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.12);" title="My Account Dashboard">
            ${(State.currentMember?.email || 'M').charAt(0)}
          </div>
        ` : `
          <a href="#/login" class="btn btn-sm btn-ghost">Member Login</a>
        `}
      </div>
    </div>
  </nav>

  <!-- Mobile bottom nav tabs (Rooms / Jobs / Ghar/Jagga) -->
  ${!State.route.startsWith('/admin') && !State.route.startsWith('/apply') ? `
  <div class="mobile-nav-tabs" role="tablist" aria-label="Browse mode">
    <button class="mobile-nav-tab ${State.mode === 'rooms' ? 'active' : ''}" onclick="setMode('rooms')" role="tab" aria-selected="${State.mode === 'rooms'}" id="mobile-tab-rooms">🏠 Rooms</button>
    <button class="mobile-nav-tab ${State.mode === 'jobs' ? 'active' : ''}" onclick="setMode('jobs')" role="tab" aria-selected="${State.mode === 'jobs'}" id="mobile-tab-jobs">💼 Jobs</button>
    <button class="mobile-nav-tab ${State.mode === 'ghar-jagga' ? 'active' : ''}" onclick="setMode('ghar-jagga')" role="tab" aria-selected="${State.mode === 'ghar-jagga'}" id="mobile-tab-ghar-jagga">🏡 Ghar/Jagga</button>
  </div>
  ` : ''}`;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand-name">Kotha Jagir solution private limited</div>
          <p class="footer-desc">Kathmandu's trusted dual marketplace for room and flat rentals, and job opportunities - all in one place.</p>
          <div style="margin-top:16px;display:flex;gap:8px;align-items:center;font-size:0.85rem;color:var(--text-muted)">
            ${Icon.Nepal} Serving the Kathmandu Valley since 2080 B.S.
          </div>
        </div>
        <div>
          <div class="footer-heading">Quick Links</div>
          <ul class="footer-links">
            <li><a href="#/">Browse Rooms</a></li>
            <li><a href="#/" onclick="setMode('jobs')">Browse Jobs</a></li>
            <li><a href="#/login">Member Login</a></li>
            ${State.adminLoggedIn ? `
              <li><a href="#/admin/dashboard" style="font-weight:600;color:var(--primary)">Admin Panel</a></li>
            ` : `
              <li><a href="#/admin">Admin Login</a></li>
            `}
          </ul>
        </div>
        <div>
          <div class="footer-heading">Contact</div>
          <ul class="footer-links">
            <li><a href="https://maps.app.goo.gl/TGED8soknA4d8DcE6" target="_blank" rel="noopener noreferrer">${Icon.map} Location</a></li>
            <li><a href="tel:9813822333">9813822333</a></li>
            <li><a href="tel:9819897468">9819897468</a></li>
            <li><a href="tel:97144499122">97144499122</a></li>
            <li><a href="mailto:sadikshyapokhrel1777@gmail.com">sadikshyapokhrel1777@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span class="footer-copy">© 2080 B.S. Kotha Jagir Solution Private Limited. All rights reserved.</span>
        <span class="footer-copy" style="display:flex;align-items:center;gap:6px;">${Icon.shield} Secure platform</span>
      </div>
    </div>
  </footer>`;
}

function renderFilterBar() {
  const isJobs = State.mode === 'jobs';
  const isGharJagga = State.mode === 'ghar-jagga';
  
  if (isJobs) {
    const f = State.jobFilters;
    return `
    <div class="filter-bar-wrap container">
      <div class="filter-bar glass">
        <div class="filter-group">
          <label for="jf-loc">Location</label>
          <select id="jf-loc" class="filter-select" onchange="updateJobFilter('locality', this.value)">
            <option value="">All Areas</option>
            ${State.localities.map(l => `<option value="${l}" ${f.locality === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="jf-cat">Category</label>
          <select id="jf-cat" class="filter-select" onchange="updateJobFilter('category', this.value)">
            <option value="">All Categories</option>
            ${State.jobCategories.map(c => `<option value="${c}" ${f.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="range-wrap">
          <label>Salary (NPR)</label>
          <span class="range-display">Up to Rs. ${f.salary.toLocaleString()}</span>
          <input type="range" min="10000" max="100000" step="2000" value="${f.salary}" oninput="updateJobFilter('salary', +this.value)" aria-label="Max salary">
        </div>
        <div class="filter-group">
          <label for="jf-type">Job Type</label>
          <select id="jf-type" class="filter-select" onchange="updateJobFilter('jobType', this.value)">
            <option value="">Any Type</option>
            ${JOB_TYPES.map(t => `<option value="${t}" ${f.jobType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="jf-exp">Experience</label>
          <select id="jf-exp" class="filter-select" onchange="updateJobFilter('experience', this.value)">
            <option value="">Any</option>
            ${EXPERIENCE_LEVELS.map(e => `<option value="${e}" ${f.experience === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <button class="filter-clear" onclick="clearJobFilters()">Clear All</button>
      </div>
    </div>`;
  } else if (isGharJagga) {
    const f = State.gharJaggaFilters || { locality: '', category: '', type: '' };
    return `
    <div class="filter-bar-wrap container">
      <div class="filter-bar glass">
        <div class="filter-group">
          <label for="gjf-loc">Location</label>
          <select id="gjf-loc" class="filter-select" onchange="updateGharJaggaFilter('locality', this.value)">
            <option value="">All Areas</option>
            ${State.localities.map(l => `<option value="${l}" ${f.locality === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label for="gjf-cat">Category</label>
          <select id="gjf-cat" class="filter-select" onchange="updateGharJaggaFilter('category', this.value)">
            <option value="">All (Sale/Rent)</option>
            <option value="For Sale" ${f.category === 'For Sale' ? 'selected' : ''}>For Sale</option>
            <option value="For Rent" ${f.category === 'For Rent' ? 'selected' : ''}>For Rent</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="gjf-type">Type</label>
          <select id="gjf-type" class="filter-select" onchange="updateGharJaggaFilter('type', this.value)">
            <option value="">Land & House</option>
            <option value="land" ${f.type === 'land' ? 'selected' : ''}>Land Only</option>
            <option value="house" ${f.type === 'house' ? 'selected' : ''}>House Only</option>
          </select>
        </div>
        <button class="filter-clear" onclick="clearGharJaggaFilters()">Clear All</button>
      </div>
    </div>`;
  } else {
    const f = State.roomFilters;
    return `
    <div class="filter-bar-wrap container">
      <div class="filter-bar glass">
        <div class="filter-group">
          <label for="rf-loc">Location</label>
          <select id="rf-loc" class="filter-select" onchange="updateRoomFilter('locality', this.value)">
            <option value="">All Areas</option>
            ${State.localities.map(l => `<option value="${l}" ${f.locality === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="range-wrap">
          <label>Budget (NPR)</label>
          <span class="range-display">Up to Rs. ${f.budget.toLocaleString()}</span>
          <input type="range" min="5000" max="50000" step="1000" value="${f.budget}" oninput="updateRoomFilter('budget', +this.value)" aria-label="Max budget">
        </div>
        <div class="filter-group">
          <label for="rf-type">Room Type</label>
          <select id="rf-type" class="filter-select" onchange="updateRoomFilter('roomType', this.value)">
            <option value="">Any Type</option>
            ${State.roomTypes.map(t => `<option value="${t}" ${f.roomType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>Parking</label>
          <div class="filter-toggle">
            ${['any', 'yes', 'no'].map(v => `<button class="filter-toggle-btn ${f.parking === v ? 'active' : ''}" onclick="updateRoomFilter('parking','${v}')">${v.charAt(0).toUpperCase() + v.slice(1)}</button>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <label for="rf-suit">Suitable For</label>
          <select id="rf-suit" class="filter-select" onchange="updateRoomFilter('suitableFor', this.value)">
            <option value="">Anyone</option>
            ${SUITABLE_FOR.map(s => `<option value="${s}" ${f.suitableFor === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="filter-clear" onclick="clearRoomFilters()">Clear All</button>
      </div>
    </div>`;
  }
}

function renderListingCard(item) {
  const isRoom = item.type === 'room';
  const isJob = item.type === 'job';
  const isGharJagga = item.type === 'land' || item.type === 'house';

  let detailRoute = '';
  if (isRoom) detailRoute = `#/room/${item.id}`;
  else if (isJob) detailRoute = `#/jobs/${item.id}`;
  else if (isGharJagga) detailRoute = `#/ghar-jagga/${item.id}`;

  let bookedRoute = '';
  if (isRoom) bookedRoute = `#/room/${item.id}/booked`;
  else if (isJob) bookedRoute = `#/jobs/${item.id}/filled`;
  else if (isGharJagga) bookedRoute = `#/ghar-jagga/${item.id}/booked`;

  return `
  <div class="listing-card" tabindex="${item.booked ? '-1' : '0'}" 
    ${item.booked ? '' : `onclick="navigate('${detailRoute}')" onkeydown="if(event.key==='Enter')navigate('${detailRoute}')"`}
    role="${item.booked ? 'presentation' : 'article'}"
    aria-label="${item.title}">
    <div class="card-img-wrap">
      <img src="${item.images[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'}" alt="${item.title}" loading="lazy" />
      <div class="card-locality-chip">${Icon.map} ${item.locality}</div>
      <div class="card-type-chip">${isRoom ? (item.roomType || 'Room') : item.category}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${item.title}</div>
      <div class="card-price">
        ${isGharJagga ? `<span style="font-size:0.85rem;color:var(--primary);font-weight:600;">Contact for further information</span>` : `
          ${item.priceLabel || item.salaryLabel} <span>${isRoom ? '/month' : item.jobType ? ` ${item.jobType}` : ''}</span>
        `}
      </div>
      <div class="card-badges">
        ${isRoom ? `
          ${item.furnished ? `<span class="badge badge-outline">Furnished</span>` : ''}
          ${item.parking ? `<span class="badge badge-outline">Parking</span>` : ''}
          ${item.suitableFor ? `<span class="badge badge-gold">${item.suitableFor}</span>` : ''}
        ` : isJob ? `
          <span class="badge badge-outline">${item.experience} Level</span>
          <span class="badge badge-gold">${item.jobType}</span>
        ` : `
          <span class="badge badge-gold" style="text-transform: capitalize;">${item.type}</span>
          ${item.attributes?.landArea ? `<span class="badge badge-outline">${item.attributes.landArea}</span>` : ''}
          ${item.attributes?.roadAccess ? `<span class="badge badge-outline">${item.attributes.roadAccess}</span>` : ''}
          ${item.attributes?.houseFloors ? `<span class="badge badge-outline">${item.attributes.houseFloors} Floors</span>` : ''}
        `}
      </div>
      <div class="card-footer-row">
        <span style="font-size:0.75rem;color:var(--text-muted)">Posted ${item.postedDate}</span>
        <span class="card-cta">${isRoom ? 'View Room' : isJob ? 'View Job' : 'View Details'} ${Icon.arrow}</span>
      </div>
    </div>
    ${item.booked ? `
      <div class="card-booked-overlay" onclick="navigate('${bookedRoute}')" style="cursor:pointer" role="link" tabindex="0" aria-label="${isRoom ? 'Already booked' : isJob ? 'Position filled' : 'Already Booked'}">
        <div class="booked-label">${isRoom ? "Already Booked" : isJob ? "Position Filled" : "Already Booked"}</div>
        <div class="booked-sub">Tap to view details</div>
      </div>
    ` : ''}
  </div>`;
}

// // PAGES RENDER LOGIC //""""""""""""""""""""""""""""""""""""""

// 1. HOMEPAGE
function renderHomePage() {
  // Trigger listings fetch
  if (State.listings === null && !State.loading['listings'] && !State.errors['listings']) {
    State.loading['listings'] = true;
    const filters = State.mode === 'rooms' ? State.roomFilters : (State.mode === 'jobs' ? State.jobFilters : State.gharJaggaFilters);
    const { type: filterType, ...restFilters } = filters;
    let fetchType = 'room';
    if (State.mode === 'jobs') fetchType = 'job';
    else if (State.mode === 'ghar-jagga') fetchType = filterType || 'ghar-jagga';
    API.getListings({ type: fetchType, ...restFilters })
      .then(res => {
        State.listings = res;
        State.loading['listings'] = false;
        render();
      })
      .catch(err => {
        State.errors['listings'] = err.message;
        State.loading['listings'] = false;
        render();
      });
  }

  const isJobs = State.mode === 'jobs';
  const isGharJagga = State.mode === 'ghar-jagga';
  let bodyContentHtml = '';

  if (State.loading['listings']) {
    bodyContentHtml = `
      <div class="container" style="padding: 60px 0; text-align: center;">
        <div class="spinner" style="margin: 0 auto 20px;"></div>
        <p style="color: var(--text-muted);">Fetching listings from Kathmandu Valley...</p>
      </div>
    `;
  } else if (State.errors['listings']) {
    bodyContentHtml = `
      <div class="container text-center" style="padding: 60px 0;">
        <p style="color: var(--danger); font-weight: 600; margin-bottom: 16px;">Failed to load listings: ${State.errors['listings']}</p>
        <button class="btn btn-primary" onclick="State.listings=null;State.errors={};render();">Retry Connection</button>
      </div>
    `;
  } else if (!State.listings || State.listings.length === 0) {
    bodyContentHtml = `
      <div class="container text-center" style="padding: 80px 0;">
        <div class="empty-state">
          <div style="font-size:3rem; margin-bottom:12px;">🔍</div>
          <div class="empty-state-text" style="font-size:1.2rem; font-weight:600; color:var(--text-dark);">No active listings found</div>
          <p style="color:var(--text-muted); font-size:0.88rem; margin-top:8px; max-width:400px; margin-left:auto; margin-right:auto;">
            We couldn't find any ${isJobs ? 'jobs' : isGharJagga ? 'properties' : 'rooms'} matching your settings. Check back later or try clearing your filters.
          </p>
          <button class="btn btn-outline" style="margin-top:20px" onclick="${isJobs ? 'clearJobFilters()' : isGharJagga ? 'clearGharJaggaFilters()' : 'clearRoomFilters()'}">Clear Filters</button>
        </div>
      </div>
    `;
  } else {
    bodyContentHtml = `
      <div class="container listings-section">
        <div class="section-header">
          <h2>${isJobs ? "Job Listings" : isGharJagga ? "Ghar / Jagga (Land & House)" : "Room & Flat Listings"}</h2>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="results-count">${State.listings.filter(i => !i.booked).length} active</span>
            ${State.listings.filter(i => i.booked).length > 0 ? `<span class="results-count" style="background:rgba(178,58,58,0.08);border-color:rgba(178,58,58,0.2);color:var(--danger)">${State.listings.filter(i => i.booked).length} booked</span>` : ''}
          </div>
        </div>
        <div class="listings-grid">${State.listings.map(renderListingCard).join('')}</div>
      </div>
    `;
  }

  return `
  ${renderNavbar()}
  <section class="hero">
    <img src="logo2.jpeg" alt="Kotha Jagir Banner" class="hero-img" />
  </section>

  <div style="background:#F6F1EA;padding-bottom:40px; min-height:60vh;">
    ${renderFilterBar()}
    ${bodyContentHtml}
  </div>

  <!-- ABOUT KOTHA JAGIR SEO SECTION -->
  <section class="section" style="padding: 40px 0 0 0;">
    <div class="container text-center">
      <div style="max-width: 800px; margin: 0 auto; padding: 28px; border-radius: 16px; background: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.03);">
        <h2 style="font-family: var(--font-heading); font-size: 1.4rem; margin-bottom: 12px; color: var(--text-dark); font-weight: 600;">Welcome to Kotha Jagir</h2>
        <p class="text-muted" style="font-size: 0.92rem; line-height: 1.7; margin: 0;">
          Kotha Jagir helps you find rooms for rent, flats for rent, and kotha bhada across Kathmandu — including Koteshwor, New Baneshwor, Kalanki, Chabahil, Lazimpat, Maharajgunj, Thamel, and Pepsicola. We also list job vacancies (jagir) and ghar jagga (land and house) across Kathmandu Valley.
        </p>
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="section bg-glass-section">
    <div class="container">
      <div class="text-center mb-8">
        <h2>How It Works</h2>
        <p class="text-muted" style="margin-top:8px;max-width:520px;margin-left:auto;margin-right:auto">Finding a room or job through Kotha Jagir is simple, transparent, and secure.</p>
      </div>
      <div class="how-grid">
        <div class="how-card glass" style="position:relative">
          <div class="numbered-badge">01</div>
          <h3>Browse Listings</h3>
          <p class="text-muted" style="font-size:0.88rem;margin-top:8px">Search rooms and jobs across Kathmandu localities with our verified filter systems.</p>
        </div>
        <div class="how-card glass" style="position:relative">
          <div class="numbered-badge">02</div>
          <h3>Submit Application</h3>
          <p class="text-muted" style="font-size:0.88rem;margin-top:8px">Fill out details and upload files to trigger an automatic WhatsApp admin query verification.</p>
        </div>
        <div class="how-card glass" style="position:relative">
          <div class="numbered-badge">03</div>
          <h3>Get Confirmed</h3>
          <p class="text-muted" style="font-size:0.88rem;margin-top:8px">Admin approves your membership, instantly unlocking detailed addresses and credentials.</p>
        </div>
      </div>

      <!-- Membership Policy Banner -->
      <div class="glass" style="margin-top:40px; padding:24px; border-radius:16px; border:1px solid rgba(212,162,76,0.3); background:rgba(212,162,76,0.04); text-align:left;">
        <h3 style="color:var(--primary); font-family:var(--font-heading); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-size:1.1rem;">
          🔑 Verified Membership Terms & Service Charge Policy
        </h3>
        <div class="policy-cols">
          <div class="policy-col policy-col-left">
            <strong style="color:var(--text-dark); font-size:0.9rem; display:block; margin-bottom:6px;">🏠 Room &amp; Flat Seekers</strong>
            Your membership is valid for <strong>1 month</strong>. You can view as many flats/rooms as you want until you find one you like. If you haven't seen any rooms within the month, you can request to extend the period. Upon final confirmation, you will pay a service charge to the agent who showed you the rooms.
          </div>
          <div class="policy-col">
            <strong style="color:var(--text-dark); font-size:0.9rem; display:block; margin-bottom:6px;">💼 Job Seekers</strong>
            Your membership is valid for <strong>1 month</strong>. You can apply for jobs and request coordinates as many times as you need until you secure a job. If you haven't visited any jobs within the month, you can request to extend the period. Upon final employment confirmation, you will pay a service charge to the coordinating agent.
          </div>
        </div>
      </div>
    </div>
  </section>

  ${renderFooter()}
  `;
}

// 2. DETAIL PAGE
function renderDetailPage(id) {
  if (State.currentListing === null && !State.loading['listing_' + id] && !State.errors['listing_' + id]) {
    State.loading['listing_' + id] = true;
    API.getListing(id)
      .then(res => {
        State.currentListing = res;
        State.loading['listing_' + id] = false;
        render();
      })
      .catch(err => {
        State.errors['listing_' + id] = err.message;
        State.loading['listing_' + id] = false;
        render();
      });
  }

  if (State.loading['listing_' + id]) {
    return `
      ${renderNavbar()}
      <div class="container" style="padding: 100px 0; text-align: center;">
        <div class="spinner" style="margin: 0 auto 20px;"></div>
        <p style="color: var(--text-muted);">Loading listing details...</p>
      </div>
      ${renderFooter()}
    `;
  }

  if (State.errors['listing_' + id]) {
    return `
      ${renderNavbar()}
      <div class="container text-center" style="padding: 100px 0;">
        <p style="color: var(--danger); font-weight: 600; margin-bottom:16px;">Listing detail load failed: ${State.errors['listing_' + id]}</p>
        <a href="#/" class="btn btn-primary">Back to Listings</a>
      </div>
      ${renderFooter()}
    `;
  }

  const item = State.currentListing;
  if (!item) return renderNotFound();

  if (item.type === 'room') {
    document.title = `${item.title} - Room for Rent in ${item.locality} | Kotha Jagir`;
  } else if (item.type === 'job') {
    document.title = `${item.title} - Job Vacancy in ${item.locality} | Kotha Jagir`;
  } else if (item.type === 'land' || item.type === 'house') {
    document.title = `${item.title} - Land/House for Sale in ${item.locality} | Kotha Jagir`;
  }

  const isRoom = item.type === 'room';
  const isJob = item.type === 'job';
  const isGharJagga = item.type === 'land' || item.type === 'house';

  return `
  ${renderNavbar()}
  <div class="page-wrap">
    ${renderMediaGallery(item, id)}

    <div class="container">
      <div class="detail-layout">
        <!-- Main content -->
        <div class="detail-main">
          <div class="glass" style="border-radius:16px;padding:24px;margin-bottom:20px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
              <div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                  <span class="badge badge-gold">${item.locality}</span>
                  <span class="badge badge-outline">${isRoom ? (item.roomType || 'Room') : item.category}</span>
                  ${isRoom && item.parking ? `<span class="badge badge-outline">Parking</span>` : ''}
                  ${isRoom && item.furnished ? `<span class="badge badge-green">Furnished</span>` : ''}
                </div>
                <h1 style="font-size:1.5rem;margin-bottom:6px">${item.title}</h1>
                <div style="font-size:0.82rem;color:var(--text-muted)">Posted ${item.postedDate}</div>
              </div>
              <div>
                ${isGharJagga ? `
                  <div style="font-family:var(--font-heading);font-size:1.25rem;font-weight:700;color:var(--primary);text-align:right">Contact for further information</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);text-align:right">Information on request</div>
                ` : `
                  <div style="font-family:var(--font-heading);font-size:1.8rem;font-weight:700;color:var(--primary)">${item.priceLabel || item.salaryLabel}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);text-align:right">${isRoom ? 'per month' : item.jobType}</div>
                `}
              </div>
            </div>
            <div class="divider"></div>
            <p style="font-size:0.95rem;line-height:1.8;color:var(--text-body)">${item.desc}</p>
          </div>

          <!-- Features / Requirements / Property Attributes -->
          <div class="glass" style="border-radius:16px;padding:24px;margin-bottom:20px">
            <h3>${isRoom ? "Features" : isJob ? "Requirements & Benefits" : "Property Attributes"}</h3>
            ${isGharJagga ? `
              <div class="amenities-grid">
                ${item.attributes?.landArea ? `
                  <div class="amenity-item">
                    <span class="amenity-icon">📐</span>
                    <span><strong>Land Area:</strong> ${item.attributes.landArea}</span>
                  </div>
                ` : ''}
                ${item.attributes?.roadAccess ? `
                  <div class="amenity-item">
                    <span class="amenity-icon">🛣️</span>
                    <span><strong>Road Access:</strong> ${item.attributes.roadAccess}</span>
                  </div>
                ` : ''}
                ${item.attributes?.houseFloors ? `
                  <div class="amenity-item">
                    <span class="amenity-icon">🏢</span>
                    <span><strong>Floors:</strong> ${item.attributes.houseFloors}</span>
                  </div>
                ` : ''}
                ${(item.type === 'house' && item.attributes?.parking !== undefined) ? `
                  <div class="amenity-item">
                    <span class="amenity-icon">🚗</span>
                    <span><strong>Parking:</strong> ${item.attributes.parking ? 'Available' : 'Not Available'}</span>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="amenities-grid">
                ${(isRoom ? item.amenities : item.requirements).length === 0 ? `
                  <div style="color:var(--text-muted); font-size:0.88rem;">No explicit features/requirements declared</div>
                ` : (isRoom ? item.amenities : item.requirements).map(a => `
                  <div class="amenity-item">
                    <span class="amenity-icon">${amenityIcon(a)}</span>
                    <span>${a}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar">
          <div class="glass" style="border-radius:16px;padding:20px;margin-bottom:16px">
            <h3 style="font-size:1rem;margin-bottom:14px">Location</h3>
            <div class="verified-map-box" style="background:#e8f4ec; border:1px solid #a3cfb4; padding:16px; border-radius:12px; text-align:center;">
              <div style="font-size:1.5rem; margin-bottom:8px;">📍</div>
              <div style="font-weight:700; color:#145a32; font-size:0.9rem;">Location Details</div>
              <div style="font-size:0.8rem; color:#1e6b3f; margin-top:4px;">Address: ${item.locality}, Kathmandu Valley</div>
            </div>
          </div>

          <!-- Trust badges -->
          <div class="glass" style="border-radius:16px;padding:18px;margin-bottom:16px">
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;align-items:center;gap:10px;font-size:0.85rem">
                <span style="color:var(--success);font-weight:700;">✓</span>
                <div><div style="font-weight:600;color:var(--text-dark)">Verified Listing</div><div style="color:var(--text-muted);font-size:0.75rem">Checked by our team</div></div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;font-size:0.85rem">
                <span style="color:var(--accent-gold);font-weight:700;">★</span>
                <div><div style="font-weight:600;color:var(--text-dark)">Secure Application</div><div style="color:var(--text-muted);font-size:0.75rem">Your data is safe with us</div></div>
              </div>
            </div>
          </div>

          ${isGharJagga ? `
            <div id="inquiry-container">
              ${State.inquirySubmitted === item.id ? `
                <div class="glass" style="border-radius:16px;padding:20px;border:1px solid var(--success);background:rgba(46,204,113,0.05);margin-bottom:16px">
                  <div style="font-size:2.5rem;margin-bottom:12px;text-align:center;">✅</div>
                  <h3 style="text-align:center;color:var(--success);margin-bottom:8px">Inquiry Sent</h3>
                  <p style="font-size:0.82rem;color:var(--text-body);line-height:1.6;margin-bottom:16px;text-align:center">
                    Submitted! Contact our administrator directly via WhatsApp or phone.
                  </p>
                  <div style="display:flex;flex-direction:column;gap:10px">
                    <a href="https://wa.me/${State.adminWhatsapp}?text=${encodeURIComponent(`Hi, I'm interested in the land/house listing "${item.title}" (${item.locality}). I just submitted an inquiry form. Could you share the rate and further details?`)}" target="_blank" class="btn btn-success w-full" style="display:flex;align-items:center;justify-content:center;gap:8px">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm5.835-3.279c1.614.957 3.513 1.463 5.461 1.465 5.75.003 10.429-4.675 10.432-10.43.001-2.788-1.084-5.409-3.056-7.382C16.758 2.395 14.138 1.3 11.348 1.3c-5.748 0-10.428 4.677-10.43 10.432-.001 1.86.486 3.68 1.41 5.295L1.31 22.7l5.63-1.478.021-.001zM17.65 19.3c-.3-.15-1.785-.88-2.065-.98-.28-.1-.49-.15-.69.15-.2.3-.77.98-.95 1.18-.18.2-.35.23-.65.08-1.02-.51-1.785-1.01-2.485-1.63-.52-.46-.8-.85-1.01-1.22-.21-.37-.02-.57.17-.72.17-.13.37-.43.56-.65.2-.22.26-.37.4-.63.14-.27.07-.49-.03-.7-.1-.2-.89-2.14-1.22-2.94-.32-.78-.65-.68-.89-.69-.23-.01-.49-.01-.75-.01-.26 0-.69.1-1.05.49-.36.39-1.39 1.36-1.39 3.32c0 1.96 1.43 3.85 1.63 4.12.2.27 2.8 4.28 6.79 6c.95.41 1.69.66 2.27.85.96.3 1.84.26 2.53.16.77-.11 2.38-.97 2.72-1.92.34-.95.34-1.76.24-1.93-.11-.17-.4-.27-.7-.42z"/></svg>
                      Contact via WhatsApp
                    </a>
                    <a href="tel:${State.adminWhatsapp}" class="btn btn-outline w-full" style="display:flex;align-items:center;justify-content:center;gap:8px">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      Call Admin
                    </a>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;text-align:center">
                    Admin Phone: <strong>${State.adminWhatsapp}</strong>
                  </div>
                </div>
              ` : `
                <div class="glass" style="border-radius:16px;padding:20px;margin-bottom:16px">
                  <h3 style="font-size:1.1rem;margin-bottom:14px">Inquire About Property</h3>
                  
                  <div style="font-size:0.8rem;color:var(--text-muted);background:rgba(212,162,76,0.06);border:1px solid rgba(212,162,76,0.2);padding:10px;border-radius:8px;margin-bottom:16px;line-height:1.5">
                    ℹ️ You can view location, photos, and video here. For rental/sale rate and fee details, please submit this form or contact us directly via WhatsApp/phone — no account or ID verification is needed to inquire.
                  </div>

                  <form onsubmit="submitGharJaggaInquiry(event, '${item.id}')">
                    <div class="form-group">
                      <label for="gji-name" style="font-size:0.8rem;">Full Name <span class="required">*</span></label>
                      <input id="gji-name" class="form-control" type="text" placeholder="Your Name" required style="font-size:0.85rem;" />
                    </div>
                    <div class="form-group">
                      <label for="gji-phone" style="font-size:0.8rem;">Phone Number <span class="required">*</span></label>
                      <input id="gji-phone" class="form-control" type="tel" placeholder="98XXXXXXXX" required pattern="[0-9]{10}" style="font-size:0.85rem;" />
                    </div>
                    <div class="form-group">
                      <label for="gji-msg" style="font-size:0.8rem;">Message (Optional)</label>
                      <textarea id="gji-msg" class="form-control" rows="3" placeholder="I'm interested in this property..." style="font-size:0.85rem;"></textarea>
                    </div>
                    <button type="submit" id="gji-submit-btn" class="btn btn-primary w-full" style="padding:12px;font-size:0.9rem">Submit Inquiry</button>
                  </form>
                </div>
              `}
            </div>
          ` : `
            ${!State.memberLoggedIn ? `
              <button class="btn btn-primary w-full" style="font-size:1rem;padding:14px" onclick="navigate('#/apply/${item.id}')">Apply Now ${Icon.arrow}</button>
              <p style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:10px">Secure payment via eSewa / Khalti</p>
            ` : ''}
          `}
        </div>
      </div>
    </div>
  </div>

  ${renderFooter()}
  `;
}

// 3. ARCHIVED PAGE
function renderArchivedPage(id, type) {
  // Simple view containing basic locked details for reference
  return `
  ${renderNavbar()}
  <div class="archived-page" style="padding: 80px 0; background: #F6F1EA; min-height: 80vh; display: flex; align-items: center; justify-content: center;">
    <div class="archived-card glass" style="max-width: 480px; width: 100%; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
      <div style="font-size:3.5rem;margin-bottom:16px">${type === 'room' ? '🏠' : '💼'}</div>
      <h2 style="margin-bottom:12px; font-family: var(--font-heading);">${type === 'room' ? 'Already Booked' : 'Position Filled'}</h2>
      <p class="text-muted" style="margin-bottom:16px; font-size:0.9rem; line-height:1.6;">
        This ${type === 'room' ? 'rental flat/room' : 'job position'} has been successfully filled. The listing is archived and kept online temporarily for application auditing reference.
      </p>
      <a href="#/" class="btn btn-primary" style="margin-top:14px;">Browse Other Listings ${Icon.arrow}</a>
    </div>
  </div>
  ${renderFooter()}`;
}

// 4. APPLICATION WIZARD FLOW
function renderApplyFlow(listingId) {
  if (State.currentListing === null && !State.loading['listing_' + listingId] && !State.errors['listing_' + listingId]) {
    State.loading['listing_' + listingId] = true;
    API.getListing(listingId)
      .then(res => {
        State.currentListing = res;
        State.loading['listing_' + listingId] = false;
        render();
      })
      .catch(err => {
        State.errors['listing_' + listingId] = err.message;
        State.loading['listing_' + listingId] = false;
        render();
      });
  }

  if (State.errors['listing_' + listingId]) {
    return `
      ${renderNavbar()}
      <div class="container text-center" style="padding: 100px 0;">
        <p style="color: var(--danger); font-weight: 600; margin-bottom: 16px;">Failed to load listing for application: ${State.errors['listing_' + listingId]}</p>
        <a href="#/" class="btn btn-primary">Back to Listings</a>
      </div>
      ${renderFooter()}
    `;
  }

  if (State.loading['listing_' + listingId]) {
    return `
      ${renderNavbar()}
      <div class="container" style="padding: 100px 0; text-align: center;">
        <div class="spinner" style="margin: 0 auto 20px;"></div>
        <p style="color: var(--text-muted);">Configuring application flow...</p>
      </div>
      ${renderFooter()}
    `;
  }

  const item = State.currentListing;
  if (!item) return renderNotFound();
  const step = State.applyStep;
  let wizardContentHtml = '';

  if (!State.applyFormData.idtype) {
    State.applyFormData.idtype = 'citizenship';
  }
  const isPassport = State.applyFormData.idtype === 'passport';

  if (step === 1) {
    wizardContentHtml = `
      <form onsubmit="submitApplyStep1(event)">
        <h3 style="margin-bottom:20px; font-family:var(--font-heading);">Submit Details (Step 1)</h3>
        
        <div class="form-group">
          <label for="ap-name">Full Name <span class="required">*</span></label>
          <input id="ap-name" class="form-control" type="text" placeholder="Ramesh Shrestha" required value="${State.applyFormData.name || ''}" oninput="State.applyFormData.name=this.value" />
        </div>
        
        <div class="form-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group">
            <label for="ap-phone">Mobile Phone Number <span class="required">*</span></label>
            <input id="ap-phone" class="form-control" type="tel" placeholder="98XXXXXXXX" required pattern="[0-9]{10}" value="${State.applyFormData.phone || ''}" oninput="State.applyFormData.phone=this.value" />
          </div>
          <div class="form-group">
            <label for="ap-email">Email Address <span class="required">*</span></label>
            <input id="ap-email" class="form-control" type="email" placeholder="your@email.com" required value="${State.applyFormData.email || ''}" oninput="State.applyFormData.email=this.value" />
          </div>
        </div>

        <div class="form-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group">
            <label for="ap-occ">Current Occupation <span class="required">*</span></label>
            <input id="ap-occ" class="form-control" type="text" placeholder="e.g. Student, Accountant" required value="${State.applyFormData.occ || ''}" oninput="State.applyFormData.occ=this.value" />
          </div>
          <div class="form-group">
            <label for="ap-idtype">Verification ID Type</label>
            <select id="ap-idtype" class="form-control" onchange="State.applyFormData.idtype=this.value; if(this.value==='passport'){ delete State.applyFormData.citBack; delete State.applyFormData.citBackFile; } render();">
              <option value="citizenship" ${State.applyFormData.idtype === 'citizenship' ? 'selected' : ''}>Citizenship Certificate</option>
              <option value="passport" ${State.applyFormData.idtype === 'passport' ? 'selected' : ''}>National Passport</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="ap-date">Preferred Moving / Start Date</label>
          <input id="ap-date" class="form-control" type="date" min="${new Date().toISOString().split('T')[0]}" value="${State.applyFormData.date || ''}" onchange="State.applyFormData.date=this.value" />
        </div>

        <div class="form-group">
          <label for="ap-msg">Message/Cover Statement <span class="required">*</span></label>
          <textarea id="ap-msg" class="form-control" rows="3" placeholder="Briefly describe your requirements..." required oninput="State.applyFormData.msg=this.value">${State.applyFormData.msg || ''}</textarea>
        </div>

        <div style="background:rgba(255,255,255,0.6);border:1px solid rgba(200,185,175,0.4);border-radius:12px;padding:16px;margin-bottom:20px">
          <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;color:var(--primary);margin-bottom:6px;">
            🔒 Secure Identity Verification
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">
            Upload your document. It is stored securely and only reviewed by Kotha Jagir administrators to verify your profile and prevent fraud.
          </p>
          
          ${isPassport ? `
            <div class="form-group">
              <label for="ap-citfront" style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Passport Information / Bio Page image <span class="required">*</span></label>
              <input id="ap-citfront" type="file" accept="image/*" class="form-control" onchange="handleCitUpload('front', this)" ${State.applyFormData.citFront ? '' : 'required'} />
              ${State.applyFormData.citFront ? `<img src="${State.applyFormData.citFront}" alt="Passport Bio Page review" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-top:8px;" />` : ''}
            </div>
          ` : `
            <div class="form-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div>
                <label for="ap-citfront" style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Citizenship front side image <span class="required">*</span></label>
                <input id="ap-citfront" type="file" accept="image/*" class="form-control" onchange="handleCitUpload('front', this)" ${State.applyFormData.citFront ? '' : 'required'} />
                ${State.applyFormData.citFront ? `<img src="${State.applyFormData.citFront}" alt="Front review" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-top:8px;" />` : ''}
              </div>
              <div>
                <label for="ap-citback" style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Citizenship back side image <span class="required">*</span></label>
                <input id="ap-citback" type="file" accept="image/*" class="form-control" onchange="handleCitUpload('back', this)" ${State.applyFormData.citBack ? '' : 'required'} />
                ${State.applyFormData.citBack ? `<img src="${State.applyFormData.citBack}" alt="Back review" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-top:8px;" />` : ''}
              </div>
            </div>
          `}
        </div>

        <div class="modal-footer" style="padding-top:10px;">
          <button type="button" class="btn btn-ghost" onclick="cancelApply()">Cancel</button>
          <button type="submit" class="btn btn-primary">Proceed to Payment ${Icon.arrow}</button>
        </div>
      </form>
    `;
  } else if (step === 2) {
    wizardContentHtml = `
      <div>
        <h3 style="margin-bottom:16px; font-family:var(--font-heading);">Submit Application Payment (Step 2)</h3>
        <p style="font-size:0.88rem;line-height:1.6;color:var(--text-body);margin-bottom:20px;">
          To verify your profile and listing connection, please make a payment of <strong>Rs. 500</strong>. This helps prevent spam listings and supports administrative checkups.
        </p>

        <div class="payment-wizard-grid">
          <div class="payment-qr-container">
            <img src="${State.adminQrCode || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80'}" alt="Payment QR Code" />
            <div class="payment-qr-label">eSewa / Khalti scan QR</div>
          </div>
          <div class="payment-details-container">
            <h4 style="margin-bottom:8px">Payment details</h4>
            <ul style="font-size:0.85rem;line-height:1.7;padding-left:16px;color:var(--text-body);margin-bottom:16px;">
              <li>Account Owner: <strong>Kotha Jagir Solution Pvt Ltd</strong></li>
              <li>Scan the QR code and transfer the fee</li>
              <li>Take a screenshot of your successful QR payment</li>
              <li>Share the payment proof screenshot on WhatsApp with us</li>
              <li><em style="color:var(--accent-gold);">Note: If your application is rejected, you will be allowed to refill the form and try again.</em></li>
            </ul>
            <div class="form-group">
              <label for="ap-pass" style="font-weight:700">Set Account Password <span class="required">*</span></label>
              <div style="position:relative; max-width:280px;">
                <input id="ap-pass" type="password" class="form-control" placeholder="Min 6 characters" style="padding-right:45px" />
                <button type="button" onclick="togglePasswordVisibility('ap-pass', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;font-weight:600;padding:5px;">Show</button>
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted);display:block;margin-top:4px">You will use this password to access unlocked listing addresses on approval.</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick="State.applyStep=1;render();">Back</button>
          <button type="button" class="btn btn-primary" onclick="submitApplyStep2()">Submit & Confirm on WhatsApp</button>
        </div>
      </div>
    `;
  } else if (step === 3) {
    wizardContentHtml = `
      <div style="text-align:center;padding:20px 10px">
        <div style="font-size:4rem;margin-bottom:18px;">✅</div>
        <h2 style="margin-bottom:12px;font-family:var(--font-heading);">Application Submitted!</h2>
        <p class="text-muted" style="max-width:440px;margin:0 auto 24px;font-size:0.9rem;line-height:1.6">
          Your application ID is <strong style="color:var(--text-dark);font-family:monospace">${State.applyGeneratedId}</strong>.<br>
          We sent a notification request to the administrators. You will be redirected to WhatsApp to present payment proof screenshot.
        </p>
        <div style="background:rgba(212,162,76,0.06);border:1px solid rgba(212,162,76,0.25);border-radius:10px;padding:14px;max-width:400px;margin:0 auto 24px;font-size:0.85rem;line-height:1.6">
          🔐 <strong>Pending Review</strong><br>
          Once verified, log in with your email <strong style="font-family:monospace">${State.applyFormData.email}</strong> and chosen password.
        </div>
        <button class="btn btn-primary" onclick="navigate('#/')">Return to Homepage</button>
      </div>
    `;
  }

  return `
  ${renderNavbar()}
  <div class="page-wrap" style="background:#F6F1EA;padding:40px 0; min-height:85vh; display:flex; align-items:center;">
    <div class="container apply-wrap" style="max-width: 600px; width:100%;">
      <div style="text-align:center;margin-bottom:24px">
        <div class="badge badge-gold" style="margin-bottom:10px;display:inline-flex">${item.title}</div>
        <p class="text-muted" style="font-size:0.85rem">${item.locality} • ${item.priceLabel || item.salaryLabel} • Posted ${item.postedDate}</p>
      </div>

      <!-- Step Indicator -->
      <div class="step-indicator" role="progressbar" aria-valuenow="${step}" aria-valuemin="1" aria-valuemax="3">
        ${[['Form', 'Personal details'], ['Payment', 'Scan QR'], ['Finish', 'Done']].map(([label, sub], i) => {
          const n = i + 1;
          const cl = n < step ? 'completed' : n === step ? 'active' : '';
          return `
            <div class="step-item ${cl}">
              <div class="step-circle">${n < step ? "✓" : n}</div>
              <div class="step-label">${label}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="glass" style="border-radius:16px;padding:32px;box-shadow: 0 12px 32px rgba(0,0,0,0.06)">
        ${wizardContentHtml}
      </div>
    </div>
  </div>
  ${renderFooter()}
  `;
}

// 5. MEMBER LOGIN
function renderMemberLogin() {
  return `
  ${renderNavbar()}
  <div class="page-wrap" style="background:#F6F1EA;padding:80px 0;min-height:85vh;display:flex;align-items:center;justify-content:center;">
    <div class="glass" style="max-width:380px;width:100%;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.06)">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="font-family:var(--font-heading);color:var(--text-dark)">Member Sign In</h2>
        <p class="text-muted" style="font-size:0.82rem;margin-top:6px">Access unlocked listings, applications, and updates</p>
      </div>
      <form onsubmit="memberLogin(event)">
        <div class="form-group">
          <label for="ml-email">Registered Email or Application ID</label>
          <input id="ml-email" class="form-control" type="text" placeholder="yourname@gmail.com or GK-2026-XXXXX" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="ml-pass">Account Password</label>
          <div style="position:relative">
            <input id="ml-pass" class="form-control" type="password" placeholder="••••••••" required autocomplete="current-password" style="padding-right:45px" />
            <button type="button" onclick="togglePasswordVisibility('ml-pass', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;font-weight:600;padding:5px;">Show</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary w-full" style="padding:12px;font-size:0.95rem;margin-top:20px">Sign In ${Icon.arrow}</button>
      </form>
      <div class="divider" style="margin:20px 0"></div>
      <p style="font-size:0.78rem;color:var(--text-muted);text-align:center">
        No active account? Scan the verified listing application flows to register credentials automatically.
      </p>
    </div>
  </div>
  ${renderFooter()}
  `;
}

// 6. MEMBER DASHBOARD
function renderMemberDashboard() {
  if (!State.memberLoggedIn) {
    setTimeout(() => navigate('#/login'), 50);
    return '';
  }

  // Trigger cache loads
  if (State.applications === null && !State.loading['applications'] && !State.errors['applications']) {
    State.loading['applications'] = true;
    API.getMemberApplications()
      .then(res => {
        State.applications = res;
        State.loading['applications'] = false;
        render();
      })
      .catch(err => {
        State.errors['applications'] = err.message;
        State.loading['applications'] = false;
        render();
      });
  }

  if (State.notifications === null && !State.loading['notifications']) {
    State.loading['notifications'] = true;
    API.getMemberNotifications()
      .then(res => {
        State.notifications = res;
        State.loading['notifications'] = false;
        render();
      })
      .catch(err => {
        State.loading['notifications'] = false;
        render();
      });
  }

  let bodyHtml = '';

  if (State.loading['applications']) {
    bodyHtml = `
      <div style="text-align:center; padding:60px 0;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
        <p style="color:var(--text-muted)">Connecting dashboard data...</p>
      </div>
    `;
  } else if (State.errors['applications']) {
    bodyHtml = `
      <div style="text-align:center; padding:60px 0; color:var(--danger)">
        <p>Dashboard load failed: ${State.errors['applications']}</p>
        <button class="btn btn-primary mt-4" onclick="State.applications=null;State.errors={};render();">Retry</button>
      </div>
    `;
  } else {
    bodyHtml = `
      <div style="display:grid; grid-template-columns:1fr; gap:28px;">
        <!-- Push Consent -->
        ${!State.pushEnabled ? `
          <div class="glass" id="push-prompt" style="border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(212,162,76,0.3); background:rgba(212,162,76,0.04)">
            <div>
              <h4 style="margin-bottom:4px;">Stay Updated!</h4>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Enable desktop push notifications for immediate listing alerts and application actions.</p>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-ghost btn-sm" onclick="blockPush()">Ignore</button>
              <button class="btn btn-primary btn-sm" onclick="enablePush()">Enable Notifications</button>
            </div>
          </div>
        ` : ''}

        <!-- Applications List -->
        <div class="glass" style="border-radius:16px; padding:24px;">
          <h3 style="margin-bottom:16px; font-family:var(--font-heading);">Your Verified Applications</h3>
          
          ${State.applications.length === 0 ? `
            <div class="empty-state" style="padding: 40px 20px;">
              <div style="font-size:2.5rem; margin-bottom:12px;">📋</div>
              <div class="empty-state-text" style="font-weight:600; color:var(--text-dark);">No applications submitted</div>
              <p style="color:var(--text-muted); font-size:0.82rem; margin-top:6px;">Go back to the homepage to apply for listing units.</p>
            </div>
          ` : `
            <div class="glass-table-wrap">
              <table class="glass-table">
                <thead>
                  <tr><th>ID</th><th>Listing Unit</th><th>Target Type</th><th>Submitted Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  ${State.applications.map(app => `
                    <tr>
                      <td><code style="font-family:monospace; background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px;">${app.id}</code></td>
                      <td style="font-weight:600;">${app.listingTitle}</td>
                      <td><span class="badge ${app.type === 'Room' ? 'badge-gold' : 'badge-outline'}">${app.type}</span></td>
                      <td style="color:var(--text-muted); font-size:0.82rem;">${app.timestamp}</td>
                      <td><span class="status-badge ${app.status}" style="font-size:0.7rem;">${app.status}</span></td>
                      <td>
                        <button class="btn btn-ghost btn-sm" onclick="navigate('#/${app.type === 'Room' ? 'room' : 'jobs'}/${app.listingId}')">View Listing</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  return `
  ${renderNavbar()}
  <div class="page-wrap" style="background:#F6F1EA; padding:40px 0; min-height:85vh;">
    <div class="container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 style="font-size:1.8rem; font-family:var(--font-heading); margin-bottom:4px;">Welcome, ${State.currentMember?.full_name || 'Member'}</h1>
          <p style="color:var(--text-muted); font-size:0.85rem;">Account: ${State.currentMember?.email || ''} • Status: <span class="status-badge approved">${State.currentMember?.status || 'member'}</span></p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="memberLogout()">Log Out</button>
      </div>

      ${bodyHtml}
    </div>
  </div>
  ${renderFooter()}
  `;
}

// 7. ADMIN LOGIN
function renderAdminLogin() {
  const isOtpState = !!State.errors['admin_otp_sent'];

  let loginCardHtml = '';
  if (!isOtpState) {
    loginCardHtml = `
      <form onsubmit="adminLogin(event)">
        <div class="form-group">
          <label for="ad-email">Admin Email</label>
          <input id="ad-email" class="form-control" type="email" placeholder="admin@kothajagir.com.np" required />
        </div>
        <div class="form-group">
          <label for="ad-pass">Admin Password</label>
          <div style="position:relative">
            <input id="ad-pass" class="form-control" type="password" placeholder="••••••••" required style="padding-right:45px" />
            <button type="button" onclick="togglePasswordVisibility('ad-pass', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;font-weight:600;padding:5px;">Show</button>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button type="button" onclick="triggerAdminForgot()" style="font-size:0.8rem;color:var(--primary);cursor:pointer;background:none;border:none;">Forgot password?</button>
        </div>
        <button type="submit" class="btn btn-primary w-full" style="padding:12px;font-size:0.95rem;">Verify Credentials ${Icon.arrow}</button>
      </form>
    `;
  } else {
    loginCardHtml = `
      <form onsubmit="verifyAdminOtp(event)">
        <div style="background:rgba(212,162,76,0.06); border:1px solid rgba(212,162,76,0.3); padding:12px; border-radius:8px; font-size:0.82rem; line-height:1.5; margin-bottom:16px;">
          An OTP validation code has been dispatched to your email. Check your mail inbox.
        </div>
        <div class="form-group">
          <label for="ad-otp">Enter 6-Digit OTP Code</label>
          <input id="ad-otp" class="form-control" type="text" placeholder="XXXXXX" required maxlength="6" pattern="[0-9]{6}" style="text-align:center; font-size:1.5rem; letter-spacing:8px;" />
        </div>
        <div class="form-group" style="margin-top:15px">
          <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" id="ad-reset-toggle" onchange="const p=document.getElementById('ad-new-pass-wrap'); if(this.checked) p.style.display='block'; else p.style.display='none';" />
            <span>Also reset my password</span>
          </label>
        </div>
        <div id="ad-new-pass-wrap" style="display:none; margin-top:15px;">
          <div class="form-group">
            <label for="ad-new-pass">Set New Admin Password</label>
            <div style="position:relative">
              <input id="ad-new-pass" class="form-control" type="password" placeholder="••••••••" style="padding-right:45px" />
              <button type="button" onclick="togglePasswordVisibility('ad-new-pass', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;font-weight:600;padding:5px;">Show</button>
            </div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary w-full" style="padding:12px; font-size:0.95rem; margin-top:15px;">Verify OTP & Action</button>
        <button type="button" class="btn btn-ghost w-full" style="margin-top:10px" onclick="State.errors['admin_otp_sent']=false;render();">Back to Password</button>
      </form>
    `;
  }

  return `
  ${renderNavbar()}
  <div class="page-wrap" style="background:#F6F1EA;padding:80px 0;min-height:85vh;display:flex;align-items:center;justify-content:center;">
    <div class="glass" style="max-width:380px;width:100%;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.06)">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="font-family:var(--font-heading);color:var(--text-dark)">Admin Portal</h2>
        <p class="text-muted" style="font-size:0.82rem;margin-top:6px">Access audit configurations and listing controls</p>
      </div>
      ${loginCardHtml}
    </div>
  </div>
  ${renderFooter()}
  `;
}

// 8. ADMIN DASHBOARD
function renderAdminDashboard() {
  if (!State.adminLoggedIn) {
    setTimeout(() => navigate('#/admin'), 50);
    return '';
  }

  // Load section-specific lists
  if (State.adminSection === 'requests' || State.adminSection === 'applications') {
    if (State.applications === null && !State.loading['admin_apps'] && !State.errors['admin_apps']) {
      State.loading['admin_apps'] = true;
      API.getAdminApplications(State.adminAppSearch, State.adminAppFilter)
        .then(res => {
          State.applications = res;
          State.loading['admin_apps'] = false;
          render();
        })
        .catch(err => {
          State.errors['admin_apps'] = err.message;
          State.loading['admin_apps'] = false;
          render();
        });
    }
  }

  if (State.adminSection === 'listings') {
    if (State.listings === null && !State.loading['admin_listings'] && !State.errors['admin_listings']) {
      State.loading['admin_listings'] = true;
      API.getAdminListings(State.adminListingTab)
        .then(res => {
          State.listings = res;
          State.loading['admin_listings'] = false;
          render();
        })
        .catch(err => {
          State.errors['admin_listings'] = err.message;
          State.loading['admin_listings'] = false;
          render();
        });
    }
  }

  if (State.adminSection === 'inquiries') {
    if (State.inquiries === null && !State.loading['admin_inquiries'] && !State.errors['admin_inquiries']) {
      State.loading['admin_inquiries'] = true;
      API.getAdminGharJaggaInquiries()
        .then(res => {
          State.inquiries = res;
          State.loading['admin_inquiries'] = false;
          render();
        })
        .catch(err => {
          State.errors['admin_inquiries'] = err.message;
          State.loading['admin_inquiries'] = false;
          render();
        });
    }
  }

  if (State.adminSection === 'settings') {
    if (State.storageUsedGB === 0.0 && !State.loading['admin_storage'] && !State.errors['admin_storage']) {
      State.loading['admin_storage'] = true;
      API.getAdminStorageUsage()
        .then(res => {
          State.storageUsedGB = res.gb;
          State.loading['admin_storage'] = false;
          render();
        })
        .catch(err => {
          State.errors['admin_storage'] = err.message;
          State.loading['admin_storage'] = false;
          render();
        });
    }
  }

  let dashboardBodyContent = '';
  if (State.adminSection === 'requests') dashboardBodyContent = renderAdminRequests();
  if (State.adminSection === 'listings') dashboardBodyContent = renderAdminListings();
  if (State.adminSection === 'categories') dashboardBodyContent = renderAdminCategories();
  if (State.adminSection === 'applications') dashboardBodyContent = renderAdminApplications();
  if (State.adminSection === 'inquiries') dashboardBodyContent = renderAdminInquiries();
  if (State.adminSection === 'settings') dashboardBodyContent = renderAdminSettings();

  return `
  ${renderNavbar()}
  <!-- Admin sidebar overlay (mobile) -->
  <div class="admin-sidebar-overlay ${State.adminSidebarOpen ? 'visible' : ''}" onclick="State.adminSidebarOpen=false;render()" aria-hidden="true"></div>

  <div class="admin-layout" style="background:#F6F1EA;min-height:90vh;">
    <!-- Admin Sidebar -->
    <div class="admin-sidebar ${State.adminSidebarOpen ? 'open' : ''}" id="admin-sidebar" style="background:#2B2724;border-right:1px solid rgba(255,255,255,0.12);padding:24px 16px;flex-direction:column;justify-content:space-between">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:0.75rem;font-weight:700;color:rgba(246, 241, 234, 0.4);text-transform:uppercase;letter-spacing:0.06em;padding:0 12px;margin-bottom:12px">Control Panel</div>
        <button class="sidebar-nav-item ${State.adminSection === 'requests' ? 'active' : ''}" onclick="setAdminSection('requests')">Payment Requests</button>
        <button class="sidebar-nav-item ${State.adminSection === 'listings' ? 'active' : ''}" onclick="setAdminSection('listings')">Listings Manager</button>
        <button class="sidebar-nav-item ${State.adminSection === 'inquiries' ? 'active' : ''}" onclick="setAdminSection('inquiries')">Ghar/Jagga Inquiries</button>
        <button class="sidebar-nav-item ${State.adminSection === 'categories' ? 'active' : ''}" onclick="setAdminSection('categories')">Locations &amp; Seeds</button>
        <button class="sidebar-nav-item ${State.adminSection === 'applications' ? 'active' : ''}" onclick="setAdminSection('applications')">Audits &amp; Candidates</button>
        <button class="sidebar-nav-item ${State.adminSection === 'settings' ? 'active' : ''}" onclick="setAdminSection('settings')">Platform Settings</button>
      </div>
      <div style="padding-top:40px; border-top:1px solid rgba(255,255,255,0.1); margin-top:20px; text-align:center;">
        <button class="btn btn-outline btn-sm w-full" style="color:#F6F1EA; border-color:rgba(255,255,255,0.3);" onclick="adminLogout()">Log Out</button>
      </div>
    </div>

    <!-- Admin Content -->
    <div class="admin-content" style="flex:1;overflow-x:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:4px">
          <!-- Hamburger toggle (visible on mobile only) -->
          <button class="admin-hamburger" onclick="State.adminSidebarOpen=!State.adminSidebarOpen;render()" aria-label="Toggle navigation menu" aria-expanded="${State.adminSidebarOpen}">
            ${State.adminSidebarOpen ? '✕' : '☰'}
          </button>
          <div>
            <h1 style="font-size:1.8rem;font-family:var(--font-heading);">${State.adminSection === 'requests' ? 'Payment Requests' : State.adminSection === 'listings' ? 'Listings Manager' : State.adminSection === 'inquiries' ? 'Ghar / Jagga Inquiries' : State.adminSection === 'categories' ? 'Locations &amp; Categories' : State.adminSection === 'settings' ? 'Platform Settings' : 'All Applications'}</h1>
            <p style="color:var(--text-muted);font-size:0.82rem;margin-top:4px;">Secure verification console • Admin: ${State.currentAdmin?.email || ''}</p>
          </div>
        </div>
        ${State.adminSection === 'listings' ? `
          <button class="btn btn-primary btn-sm" onclick="State.showCreateModal=true;render()">+ Add New Listing</button>
        ` : ''}
      </div>

      ${dashboardBodyContent}
    </div>
  </div>

  ${State.showCreateModal ? renderCreateModal() : ''}
  ${State.showDeleteModal ? renderDeleteModal() : ''}
  ${State.showAppModal ? renderAppModal() : ''}
  ${State.showAdminPreviewModal ? renderAdminPreviewModal() : ''}

  ${renderFooter()}
  `;
}

function renderAdminRequests() {
  if (State.loading['admin_apps']) {
    return `<div class="text-center" style="padding: 40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  }
  const pending = State.applications ? State.applications.filter(a => a.status === 'pending') : [];
  const approved = State.applications ? State.applications.filter(a => a.status === 'approved') : [];
  const rejected = State.applications ? State.applications.filter(a => a.status === 'rejected') : [];

  return `
  <div class="admin-stats-grid">
    ${[['Pending Requests', pending.length, 'warning'], ['Approved Members', approved.length, 'success'], ['Rejected Trans', rejected.length, 'danger']].map(([label, count, type]) => `
      <div class="glass" style="border-radius:14px;padding:18px">
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">${label}</div>
        <div style="font-family:var(--font-heading);font-size:2rem;font-weight:700;color:var(--${type})">${count}</div>
      </div>
    `).join('')}
  </div>

  <div class="glass-table-wrap">
    <table class="glass-table">
      <thead>
        <tr><th>Verification ID</th><th>Applicant</th><th>Listing</th><th>Target</th><th>Submitted</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${!State.applications || State.applications.length === 0 ? `
          <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No request records found</td></tr>
        ` : State.applications.map(app => `
          <tr>
            <td><code style="font-size:0.8rem;font-family:monospace;background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;white-space:nowrap">${app.id}</code></td>
            <td style="font-weight:600">${app.name}</td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${app.listingTitle}</td>
            <td><span class="badge ${app.type === 'Room' ? 'badge-gold' : 'badge-outline'}">${app.type}</span></td>
            <td style="color:var(--text-muted);font-size:0.8rem">${app.timestamp}</td>
            <td><span class="status-badge ${app.status}" style="font-size:0.72rem">${app.status}</span></td>
            <td>
              <div style="display:flex;gap:6px;align-items:center;">
                ${app.status === 'pending' ? `
                  <button class="btn btn-success btn-sm" onclick="approveApp('${app.id}')" aria-label="Approve ${app.id}">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="rejectApp('${app.id}')" aria-label="Reject ${app.id}">Reject</button>
                ` : `<span style="font-size:0.8rem;color:var(--text-muted)">Done</span>`}
                <button class="btn btn-ghost btn-icon" style="color:var(--danger)" title="Delete Request" onclick="deleteApplication('${app.id}')" aria-label="Delete request ${app.id}">${Icon.trash}</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderAdminListings() {
  if (State.loading['admin_listings']) {
    return `<div class="text-center" style="padding: 40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  }
  const isRoom = State.adminListingTab === 'room';
  const isJob = State.adminListingTab === 'job';
  const isLand = State.adminListingTab === 'land';
  const isHouse = State.adminListingTab === 'house';
  const items = State.listings || [];

  return `
  <div class="tabs" style="margin-bottom:20px">
    <button class="tab-btn ${isRoom ? 'active' : ''}" onclick="State.adminListingTab='room';State.listings=null;render()">Rooms</button>
    <button class="tab-btn ${isJob ? 'active' : ''}" onclick="State.adminListingTab='job';State.listings=null;render()">Jobs</button>
    <button class="tab-btn ${isLand ? 'active' : ''}" onclick="State.adminListingTab='land';State.listings=null;render()">Land</button>
    <button class="tab-btn ${isHouse ? 'active' : ''}" onclick="State.adminListingTab='house';State.listings=null;render()">House</button>
  </div>

  <div class="glass-table-wrap">
    <table class="glass-table">
      <thead>
        <tr><th>Cover</th><th>Title</th><th>Locality</th><th>Category/Type</th><th>Rate/Price/Salary</th><th>Created</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `
          <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No active listings created</td></tr>
        ` : items.map(item => `
          <tr>
            <td><img src="${item.images[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'}" alt="${item.title}" style="width:56px;height:40px;border-radius:7px;object-fit:cover" /></td>
            <td style="font-weight:600;max-width:180px">${item.title}</td>
            <td>${item.locality}</td>
            <td>${isRoom ? (item.roomType || 'Room') : item.category}</td>
            <td style="font-weight:700;color:var(--primary)">${(isLand || isHouse) ? 'Rate on request' : (item.priceLabel || item.salaryLabel)}</td>
            <td style="font-size:0.82rem;color:var(--text-muted)">${item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'N/A'}</td>
            <td><span class="status-badge ${item.status === 'archived' ? 'rejected' : 'confirmed'}" style="font-size:0.7rem">${item.status === 'archived' ? (isRoom ? 'Booked' : isJob ? 'Filled' : 'Archived') : 'Active'}</span></td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-icon" title="Preview Media" aria-label="Preview ${item.title}" onclick="showAdminPreview('${item.id}')">${Icon.eye}</button>
                <button class="btn btn-ghost btn-icon" title="Delete/Archive listing" aria-label="Delete ${item.title}" onclick="confirmDelete('${item.id}')">${Icon.trash}</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderAdminApplications() {
  if (State.loading['admin_apps']) {
    return `<div class="text-center" style="padding: 40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  }
  const apps = State.applications || [];

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div class="search-input-wrap" style="max-width:280px">
        <span class="icon">${Icon.search}</span>
        <input type="text" placeholder="Search applicant email, listing..." value="${State.adminAppSearch}" oninput="State.adminAppSearch=this.value;State.applications=null;render()" aria-label="Search applications" />
      </div>
      <div class="tabs">
        ${[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([v, l]) => `
          <button class="tab-btn ${State.adminAppFilter === v ? 'active' : ''}" onclick="State.adminAppFilter='${v}';State.applications=null;render()">${l}</button>
        `).join('')}
      </div>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);background:rgba(212,162,76,0.1);padding:6px 12px;border-radius:8px;border:1px solid rgba(212,162,76,0.3)">
      🔒 Permanent Records — Audit Compliant
    </div>
  </div>

  <div class="glass-table-wrap">
    <table class="glass-table">
      <thead>
        <tr><th>ID / Email</th><th>Name</th><th>Phone</th><th>Listing</th><th>Type</th><th>Status</th><th>Login Access</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${apps.length === 0 ? `
          <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No matching records found</td></tr>
        ` : apps.map(app => `
          <tr>
            <td>
              <code style="font-size:0.78rem;font-family:monospace;background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;white-space:nowrap">${app.id}</code>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${app.email}</div>
            </td>
            <td style="font-weight:600">${app.name}</td>
            <td style="font-size:0.82rem">${app.phone}</td>
            <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.82rem">${app.listingTitle}</td>
            <td><span class="badge ${app.type === 'Room' ? 'badge-gold' : 'badge-outline'}">${app.type}</span></td>
            <td><span class="status-badge ${app.status}" style="font-size:0.7rem">${app.status}</span></td>
            <td>
              ${app.accessRevoked ? `
                <span class="badge badge-outline" style="font-size:0.7rem;color:var(--danger);border-color:rgba(178,58,58,0.3)">Visitor (Revoked)</span>
              ` : `
                <span class="badge badge-green" style="font-size:0.7rem">Member Active</span>
              `}
            </td>
            <td>
              <div style="display:flex;gap:5px;align-items:center;">
                <button class="btn btn-ghost btn-icon" title="View details & Citizenship cards" onclick="openAppModal('${app.id}')" aria-label="Open application ${app.id}">${Icon.eye}</button>
                <button class="btn btn-ghost btn-icon" title="Download PDF" onclick="downloadPDF('${app.id}')" aria-label="Download PDF for ${app.id}">${Icon.download}</button>
                ${!app.accessRevoked ? `
                  <button class="btn btn-ghost btn-sm" style="font-size:0.72rem;color:var(--danger)" title="Revoke member login access" onclick="revokeAccess('${app.id}')">Revoke Access</button>
                ` : ''}
                <button class="btn btn-ghost btn-icon" style="color:var(--danger)" title="Delete Application" onclick="deleteApplication('${app.id}')" aria-label="Delete application ${app.id}">${Icon.trash}</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderAdminCategories() {
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;">
    <!-- Manage Locations -->
    <div class="glass" style="border-radius:16px;padding:24px">
      <h3 style="margin-bottom:6px">📍 Manage Locations</h3>
      <form onsubmit="event.preventDefault(); const inp=document.getElementById('new-loc-input'); addLocality(inp.value); inp.value='';" style="display:flex;gap:8px;margin-bottom:18px">
        <input id="new-loc-input" class="form-control" type="text" placeholder="e.g. Pepsi Chowk" required style="font-size:0.85rem;" />
        <button type="submit" class="btn btn-primary btn-sm">+ Add Area</button>
      </form>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px">
        ${State.localities.map(loc => `
          <div class="badge badge-gold" style="padding:6px 12px;font-size:0.82rem;display:flex;align-items:center;gap:6px">
            <span>${loc}</span>
            <button type="button" onclick="deleteLocality('${loc}')" style="color:var(--danger);font-weight:bold;cursor:pointer;background:none;border:none;padding:0 2px" title="Delete location">&times;</button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Manage Job Categories -->
    <div class="glass" style="border-radius:16px;padding:24px">
      <h3 style="margin-bottom:6px">💼 Manage Job Categories</h3>
      <form onsubmit="event.preventDefault(); const inp=document.getElementById('new-cat-input'); addJobCategory(inp.value); inp.value='';" style="display:flex;gap:8px;margin-bottom:18px">
        <input id="new-cat-input" class="form-control" type="text" placeholder="e.g. IT & Software" required style="font-size:0.85rem;" />
        <button type="submit" class="btn btn-primary btn-sm">+ Add Category</button>
      </form>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px">
        ${State.jobCategories.map(cat => `
          <div class="badge badge-outline" style="padding:6px 12px;font-size:0.82rem;display:flex;align-items:center;gap:6px">
            <span>${cat}</span>
            <button type="button" onclick="deleteJobCategory('${cat}')" style="color:var(--danger);font-weight:bold;cursor:pointer;background:none;border:none;padding:0 2px" title="Delete category">&times;</button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Manage Room Types -->
    <div class="glass" style="border-radius:16px;padding:24px">
      <h3 style="margin-bottom:6px">🏠 Manage Room Types</h3>
      <form onsubmit="event.preventDefault(); const inp=document.getElementById('new-rtype-input'); addRoomType(inp.value); inp.value='';" style="display:flex;gap:8px;margin-bottom:18px">
        <input id="new-rtype-input" class="form-control" type="text" placeholder="e.g. Penthouse" required style="font-size:0.85rem;" />
        <button type="submit" class="btn btn-primary btn-sm">+ Add Type</button>
      </form>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px">
        ${State.roomTypes.map(rt => `
          <div class="badge badge-green" style="padding:6px 12px;font-size:0.82rem;display:flex;align-items:center;gap:6px">
            <span>${rt}</span>
            <button type="button" onclick="deleteRoomType('${rt}')" style="color:var(--danger);font-weight:bold;cursor:pointer;background:none;border:none;padding:0 2px" title="Delete type">&times;</button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Manage Room Features -->
    <div class="glass" style="border-radius:16px;padding:24px">
      <h3 style="margin-bottom:6px">✨ Manage Room Features</h3>
      <form onsubmit="event.preventDefault(); const inp=document.getElementById('new-rfeature-input'); addRoomFeature(inp.value); inp.value='';" style="display:flex;gap:8px;margin-bottom:18px">
        <input id="new-rfeature-input" class="form-control" type="text" placeholder="e.g. Swimming Pool" required style="font-size:0.85rem;" />
        <button type="submit" class="btn btn-primary btn-sm">+ Add Feature</button>
      </form>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px">
        ${State.roomFeatures.map(rf => `
          <div class="badge badge-gold" style="padding:6px 12px;font-size:0.82rem;display:flex;align-items:center;gap:6px;background:rgba(212,162,76,0.1);color:#a87d2a;border-color:rgba(212,162,76,0.3)">
            <span>${rf}</span>
            <button type="button" onclick="deleteRoomFeature('${rf}')" style="color:var(--danger);font-weight:bold;cursor:pointer;background:none;border:none;padding:0 2px" title="Delete feature">&times;</button>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}

function renderAdminSettings() {
  const percent = ((State.storageUsedGB / State.storageTotalGB) * 100).toFixed(1);
  const color = State.storageUsedGB > 9.5 ? 'var(--danger)' : State.storageUsedGB > 8.0 ? 'var(--accent-gold)' : 'var(--success)';

  return `
  <div style="max-width:640px;">
    <div class="glass" style="border-radius:16px;padding:28px">
      <h3 style="margin-bottom:6px">⚙️ Platform Settings</h3>
      <p class="text-muted" style="font-size:0.85rem;margin-bottom:24px">Manage operational parameters and contact details for Kotha Jagir Solution.</p>
      
      <form onsubmit="saveAdminSettings(event)">
        <div class="form-group">
          <label for="set-whatsapp">Admin WhatsApp Number <span class="required">*</span></label>
          <input id="set-whatsapp" class="form-control" type="text" value="${State.adminWhatsapp}" required placeholder="9779841234567" />
        </div>

        <button type="submit" class="btn btn-primary btn-sm" style="margin-top:10px;">Save Whatsapp Setting</button>
      </form>

      <div class="divider" style="margin:24px 0"></div>
      
      <!-- Upload QR code file -->
      <div class="form-group">
        <label>Verification Payment QR Code</label>
        <div style="display:flex; gap:16px; align-items:center; margin-top:8px;">
          ${State.adminQrCode ? `<img src="${State.adminQrCode}" alt="QR code" style="width:100px;height:100px;object-fit:contain;border:1px solid #ddd;border-radius:8px;" />` : ''}
          <div>
            <input type="file" id="settings-qr-file" class="form-control" accept="image/*" onchange="uploadQrCode(this)" style="font-size:0.85rem;" />
            <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:6px;">Upload a scan-to-pay QR image (eSewa, Khalti, or Fonepay) for candidate payment steps.</span>
          </div>
        </div>
      </div>

      <div class="divider" style="margin:24px 0"></div>

      <div class="form-group">
        <label>Cloudflare R2 Bucket Storage Size</label>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; font-weight:600; margin-bottom:8px;">
          <span>Bucket Metrics</span>
          <span style="color:${color}">${State.storageUsedGB.toFixed(3)} GB / ${State.storageTotalGB.toFixed(1)} GB (${percent}%)</span>
        </div>
        <div style="width:100%; height:8px; background:rgba(0,0,0,0.06); border-radius:4px; overflow:hidden; margin-bottom:8px;">
          <div style="width:${percent}%; height:100%; background:${color}; border-radius:4px; transition:width var(--trans-medium);"></div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted)">
          Metrics are computed live from R2 bucket file list descriptors and refreshed periodically.
        </div>
      </div>
    </div>
  </div>`;
}

function renderAdminInquiries() {
  if (State.loading['admin_inquiries']) {
    return `<div class="text-center" style="padding: 40px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  }
  const items = State.inquiries || [];

  return `
  <div class="glass-table-wrap">
    <table class="glass-table">
      <thead>
        <tr><th>Timestamp</th><th>Applicant Name</th><th>Phone</th><th>Listing</th><th>Message</th></tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `
          <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No inquiries submitted yet</td></tr>
        ` : items.map(inq => `
          <tr>
            <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${new Date(inq.created_at).toLocaleString()}</td>
            <td style="font-weight:600">${inq.full_name}</td>
            <td><a href="tel:${inq.phone}" style="font-weight:600;color:var(--primary);">${inq.phone}</a></td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              <a href="#/ghar-jagga/${inq.listing_id}" target="_blank" style="color:inherit;text-decoration:underline;">${inq.listing_title || 'Unknown Listing'}</a>
            </td>
            <td style="font-size:0.85rem;line-height:1.4;max-width:300px;word-wrap:break-word;">${inq.message || '<em style="color:var(--text-muted)">No message</em>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

// // MODALS MARKUP //""""""""""""""""""""""""""""""""""""""""""
function renderCreateModal() {
  const isRoom = State.adminListingTab === 'room';
  const isJob = State.adminListingTab === 'job';
  const isLand = State.adminListingTab === 'land';
  const isHouse = State.adminListingTab === 'house';

  return `
  <div class="modal-overlay" onclick="if(event.target===this){State.showCreateModal=false;render()}" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="create-modal-title">${Icon.plus} Create New Listing</h3>
        <button class="modal-close" onclick="State.showCreateModal=false;render()" aria-label="Close modal">${Icon.x}</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div class="tabs" style="margin-bottom:20px">
          <button class="tab-btn ${isRoom ? 'active' : ''}" onclick="State.adminListingTab='room';render()">Room</button>
          <button class="tab-btn ${isJob ? 'active' : ''}" onclick="State.adminListingTab='job';render()">Job</button>
          <button class="tab-btn ${isLand ? 'active' : ''}" onclick="State.adminListingTab='land';render()">Land</button>
          <button class="tab-btn ${isHouse ? 'active' : ''}" onclick="State.adminListingTab='house';render()">House</button>
        </div>
        
        <div class="form-group">
          <label for="lc-title">Title <span class="required">*</span></label>
          <input id="lc-title" class="form-control" type="text" placeholder="e.g. 4 Aana Land in Pepsi Chowk" required />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group">
            <label for="lc-locality">Locality</label>
            <select id="lc-locality" class="form-control">
              ${State.localities.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="lc-category">${isRoom ? 'Room Type' : isJob ? 'Job Category' : 'Category (Sale/Rent)'}</label>
            <select id="lc-category" class="form-control">
              ${isRoom ? State.roomTypes.map(t => `<option value="${t}">${t}</option>`).join('') :
                isJob ? State.jobCategories.map(t => `<option value="${t}">${t}</option>`).join('') :
                `<option value="For Sale">For Sale</option><option value="For Rent">For Rent</option>`
              }
            </select>
          </div>
          ${(isLand || isHouse) ? '' : `
            <div class="form-group">
              <label for="lc-price">${isRoom ? 'Price (NPR/month) *' : 'Salary (NPR/month) *'}</label>
              <input id="lc-price" class="form-control" type="number" placeholder="${isRoom ? '15000' : '25000'}" required />
            </div>
          `}
          ${isJob ? `
            <div class="form-group">
              <label for="lc-jobtype">Job Type</label>
              <select id="lc-jobtype" class="form-control">${JOB_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
            </div>
          ` : (isRoom || isHouse) ? `
            <div class="form-group">
              <label for="lc-parking">Parking</label>
              <select id="lc-parking" class="form-control"><option value="Yes">Yes</option><option value="No">No</option></select>
            </div>
          ` : ''}
          ${(isLand || isHouse) ? `
            <div class="form-group">
              <label for="lc-landarea">Land Area (e.g. 4 Aana, 1 Ropani)</label>
              <input id="lc-landarea" class="form-control" type="text" placeholder="e.g. 4 Aana" />
            </div>
            <div class="form-group">
              <label for="lc-roadaccess">Road Access (e.g. 16 ft road)</label>
              <input id="lc-roadaccess" class="form-control" type="text" placeholder="e.g. 16 ft road" />
            </div>
            ${isHouse ? `
              <div class="form-group">
                <label for="lc-housefloors">House Floors (e.g. 2.5 Floors)</label>
                <input id="lc-housefloors" class="form-control" type="text" placeholder="e.g. 2.5" />
              </div>
            ` : ''}
          ` : ''}
        </div>

        <div class="form-group">
          <label for="lc-desc">Description</label>
          <textarea id="lc-desc" class="form-control" rows="3" placeholder="Describe the listing..."></textarea>
        </div>

        <div class="form-group">
          <label for="lc-cover">Cover Photo Upload (Optional)</label>
          <input type="file" id="lc-cover" class="form-control" accept="image/*" />
        </div>

        <div class="form-group">
          <label for="lc-gallery">Gallery Photos Upload (Optional, Select Multiple)</label>
          <input type="file" id="lc-gallery" class="form-control" accept="image/*" multiple />
        </div>

        <div class="form-group">
          <label for="lc-video">Walkthrough Video Upload (Optional)</label>
          <input type="file" id="lc-video" class="form-control" accept="video/*" />
        </div>

        ${(isRoom || isJob) ? `
          <div class="form-group">
            <label style="color:var(--text-body);font-weight:600;">${isRoom ? 'Features' : 'Requirements'}</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${(isRoom ? State.roomFeatures : JOB_REQUIREMENTS).map(a => `
                <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer;padding:4px 10px;border-radius:8px;background:#fff;border:1px solid rgba(0,0,0,0.06)">
                  <input type="checkbox" name="lc-amenity" value="${a}" /> ${amenityIcon(a)} ${a}
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="State.showCreateModal=false;render()">Cancel</button>
        <button class="btn btn-primary" onclick="publishListing()">Publish Listing</button>
      </div>
    </div>
  </div>`;
}

function renderDeleteModal() {
  const item = State.listings ? State.listings.find(l => l.id === State.deleteTarget) : null;
  const isArchived = item && item.status === 'archived';

  return `
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="delete-modal-title">${isArchived ? 'Delete Listing Permanently' : 'Archive Listing'}</h3>
        <button class="modal-close" onclick="State.showDeleteModal=false;State.deleteTarget=null;render()">${Icon.x}</button>
      </div>
      <div class="modal-body">
        ${isArchived ? `
          <div style="background:rgba(178,58,58,0.08);border:1px solid rgba(178,58,58,0.3);border-radius:10px;padding:14px;margin-bottom:16px;font-size:0.85rem;color:var(--danger)">
            <strong>This listing will be permanently deleted!</strong>
          </div>
          <p style="font-size:0.88rem;color:var(--text-body);line-height:1.7">
            It will be completely removed from all searches, the admin list, and database indexes. This action cannot be undone.
          </p>
        ` : `
          <div style="background:rgba(212,162,76,0.08);border:1px solid rgba(212,162,76,0.3);border-radius:10px;padding:14px;margin-bottom:16px;font-size:0.85rem">
            <strong>This listing will be marked as Booked/Filled.</strong>
          </div>
          <p style="font-size:0.88rem;color:var(--text-body);line-height:1.7">
            The listing will appear with a booked overlay to public visitors for <strong>30 days</strong>. All other detailed media will be archived.
          </p>
        `}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="State.showDeleteModal=false;State.deleteTarget=null;render()">Cancel</button>
        <button class="btn btn-danger" onclick="deleteListing()">${isArchived ? 'Confirm Permanent Delete' : 'Confirm Archive'}</button>
      </div>
    </div>
  </div>`;
}

function renderAppModal() {
  const app = State.applications ? State.applications.find(a => a.id === State.appModalData) : null;
  if (!app) return '';

  return `
  <div class="modal-overlay" onclick="if(event.target===this){State.showAppModal=false;render()}" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
    <div class="modal-box" style="max-width:680px">
      <div class="modal-header">
        <h3 id="app-modal-title">Application Details (${app.id})</h3>
        <button class="modal-close" onclick="State.showAppModal=false;render()">${Icon.x}</button>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          ${[['Applicant ID', app.id], ['Name', app.name], ['Phone', app.phone], ['Email', app.email], ['Status', app.status], ['Submitted Date', app.timestamp]].map(([k, v]) => `
            <div>
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:3px">${k}</div>
              <div style="font-weight:600;font-size:0.88rem">${k === 'Status' ? `<span class="status-badge ${v}" style="font-size:0.72rem">${v}</span>` : v}</div>
            </div>
          `).join('')}
        </div>

        <div style="background:rgba(212,162,76,0.08);border:1px solid rgba(212,162,76,0.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:0.82rem;display:flex;align-items:center;justify-content:space-between">
          <div>
            <strong>Member Login Status:</strong> ${app.accessRevoked ? '<span style="color:var(--danger);font-weight:700">Access Revoked (Visitor Status)</span>' : '<span style="color:var(--success);font-weight:700">Active Member Login</span>'}
          </div>
        </div>

        <div class="divider"></div>
        <div style="margin-bottom:14px">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:4px">Listing Applied For</div>
          <div style="font-weight:600">${app.listingTitle}</div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:4px">Applicant Message</div>
          <div style="background:#fff;border-radius:8px;padding:12px;font-size:0.85rem;line-height:1.6;border:1px solid rgba(0,0,0,0.08)">${app.message}</div>
        </div>

        <!-- Citizenship Document Section -->
        <div style="background:rgba(255,255,255,0.6);border:1px solid rgba(200,185,175,0.4);border-radius:12px;padding:16px;margin-top:16px">
          <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--primary);margin-bottom:10px;display:flex;align-items:center;gap:6px">
            🔒 Identity Verification documents (Admin Only View)
          </div>
          <div style="display:grid;grid-template-columns:${app.id_type === 'passport' ? '1fr' : '1fr 1fr'};gap:12px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">
                ${app.id_type === 'passport' ? 'Passport Information / Bio Page' : 'Card Front View'}
              </div>
              <img src="${app.citizenshipFront || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80'}" alt="Document Front" style="width:100%;height:180px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.15)" />
            </div>
            ${app.id_type !== 'passport' ? `
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Card Back View</div>
              <img src="${app.citizenshipBack || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80'}" alt="Document Back" style="width:100%;height:180px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.15)" />
            </div>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="downloadPDF('${app.id}')">${Icon.download} Download PDF</button>
        <button class="btn btn-ghost" onclick="State.showAppModal=false;render()">Close</button>
        ${app.status === 'pending' ? `
          <button class="btn btn-danger btn-sm" onclick="rejectApp('${app.id}');State.showAppModal=false;">Reject</button>
          <button class="btn btn-success btn-sm" onclick="approveApp('${app.id}');State.showAppModal=false;">Approve</button>
        ` : ''}
      </div>
    </div>
  </div>`;
}

function renderNotFound() {
  return `
  ${renderNavbar()}
  <div style="padding: 100px 0; text-align: center; background: #F6F1EA; min-height: 80vh; display: flex; align-items: center; justify-content: center;">
    <div>
      <h1 style="font-size: 3rem; margin-bottom: 12px; font-family: var(--font-heading);">404</h1>
      <p style="color: var(--text-muted); margin-bottom: 20px;">Page or listing not found.</p>
      <a href="#/" class="btn btn-primary">Return Home</a>
    </div>
  </div>
  ${renderFooter()}
  `;
}

// // STATE & METADATA BINDINGS //""""""""""""""""""""""""""""""
window.setMode = function (m) {
  State.mode = m;
  State.listings = null;
  
  let targetHash = '#/rooms';
  if (m === 'ghar-jagga') targetHash = '#/ghar-jagga';
  else if (m === 'jobs') targetHash = '#/jobs';
  
  const currentHash = location.hash;
  if (currentHash === targetHash) {
    render();
  } else {
    navigate(targetHash);
  }
};

window.setGallery = function (id, idx) {
  State.gallery[id] = idx;
  render();
};

// New gallery control functions for cover-first UX
window.setGalleryVideo = function (id) {
  if (!State.galleryMode) State.galleryMode = {};
  State.galleryMode[id] = 'video';
  render();
  // hls.js attachment happens after render via attachHlsPlayer()
};

window.setGalleryPhoto = function (id, idx) {
  if (!State.galleryMode) State.galleryMode = {};
  State.galleryMode[id] = 'photo';
  State.gallery[id] = idx;
  render();
};

window.toggleNotif = function () {
  State.notifOpen = !State.notifOpen;
  render();
};

window.updateRoomFilter = function (key, val) {
  State.roomFilters[key] = val;
  State.listings = null;
  render();
};

window.clearRoomFilters = function () {
  State.roomFilters = { locality: '', budget: 35000, roomType: '', parking: 'any', suitableFor: '' };
  State.listings = null;
  render();
};

window.updateJobFilter = function (key, val) {
  State.jobFilters[key] = val;
  State.listings = null;
  render();
};

window.clearJobFilters = function () {
  State.jobFilters = { locality: '', salary: 60000, category: '', jobType: '', experience: '' };
  State.listings = null;
  render();
};

window.updateGharJaggaFilter = function (key, val) {
  if (!State.gharJaggaFilters) State.gharJaggaFilters = { locality: '', category: '', type: '' };
  State.gharJaggaFilters[key] = val;
  State.listings = null;
  render();
};

window.clearGharJaggaFilters = function () {
  State.gharJaggaFilters = { locality: '', category: '', type: '' };
  State.listings = null;
  render();
};

// Application upload listener
window.handleCitUpload = function (type, input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (type === 'front') State.applyFormData.citFrontFile = file;
    if (type === 'back') State.applyFormData.citBackFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
      if (type === 'front') State.applyFormData.citFront = e.target.result;
      if (type === 'back') State.applyFormData.citBack = e.target.result;
      render();
    };
    reader.readAsDataURL(file);
    showToast(`Identity file ${type} loaded.`);
  }
};

window.submitApplyStep1 = function (e) {
  e.preventDefault();
  const name = document.getElementById('ap-name').value;
  const phone = document.getElementById('ap-phone').value;
  const email = document.getElementById('ap-email').value;
  const occ = document.getElementById('ap-occ').value;
  const idtype = document.getElementById('ap-idtype').value;
  const date = document.getElementById('ap-date').value;
  const msg = document.getElementById('ap-msg').value;

  if (idtype === 'passport') {
    if (!State.applyFormData.citFrontFile && !State.applyFormData.citFront) {
      showToast('Please upload your Passport Bio Page image.', 'error');
      return;
    }
  } else {
    if ((!State.applyFormData.citFrontFile && !State.applyFormData.citFront) || 
        (!State.applyFormData.citBackFile && !State.applyFormData.citBack)) {
      showToast('Please upload both Front and Back images of your Citizenship Certificate.', 'error');
      return;
    }
  }

  State.applyFormData = {
    ...State.applyFormData,
    name, phone, email, occ, idtype, date, msg
  };
  State.applyStep = 2;
  render();
};

window.submitApplyStep2 = async function () {
  const pass = document.getElementById('ap-pass');
  if (!pass || !pass.value || pass.value.length < 6) {
    showToast('Please set a password (min 6 characters)', 'error');
    return;
  }

  const btn = document.querySelector('button[onclick="submitApplyStep2()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Submitting Application...';
  }

  try {
    const form = new FormData();
    form.append('listing_id', State.applyListingId);
    form.append('full_name', State.applyFormData.name);
    form.append('phone', State.applyFormData.phone);
    form.append('email', State.applyFormData.email);
    form.append('occupation', State.applyFormData.occ);
    form.append('id_type', State.applyFormData.idtype);
    form.append('preferred_date', State.applyFormData.date || '');
    form.append('message', State.applyFormData.msg);
    form.append('password', pass.value);

    if (State.applyFormData.citFrontFile) {
      form.append('citizenship_front', State.applyFormData.citFrontFile);
    }
    if (State.applyFormData.idtype !== 'passport' && State.applyFormData.citBackFile) {
      form.append('citizenship_back', State.applyFormData.citBackFile);
    }

    const res = await API.submitApplication(form);
    State.applyGeneratedId = res.id;

    showToast('Redirecting to WhatsApp to send payment proof screenshot...', 'warning');

    setTimeout(() => {
      const waUrl = `https://wa.me/${State.adminWhatsapp}?text=` + encodeURIComponent(
        `Hi Kotha Jagir, I paid Rs. 500 for application ID ${State.applyGeneratedId}. Email: ${State.applyFormData.email}`
      );
      window.open(waUrl, '_blank');
      State.applyStep = 3;
      render();
    }, 1200);

  } catch (err) {
    showToast(`Submission failed: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Submit & Confirm on WhatsApp';
    }
  }
};

window.cancelApply = function () {
  State.applyStep = 1;
  State.applyFormData = {};
  navigate('#/');
};

window.submitGharJaggaInquiry = async function (e, listingId) {
  e.preventDefault();
  const name = document.getElementById('gji-name').value.trim();
  const phone = document.getElementById('gji-phone').value.trim();
  const msg = document.getElementById('gji-msg').value.trim();

  const btn = document.getElementById('gji-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Submitting...';
  }

  try {
    await API.submitGharJaggaInquiry(listingId, name, phone, msg);
    State.inquirySubmitted = listingId;
    showToast('Inquiry submitted successfully!');
    render();
  } catch (err) {
    showToast(`Inquiry submission failed: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Submit Inquiry';
    }
  }
};

// Member Login
window.memberLogin = async function (e) {
  e.preventDefault();
  const email = document.getElementById('ml-email').value.trim();
  const pass = document.getElementById('ml-pass').value;

  try {
    const res = await API.loginMember(email, pass);
    State.memberLoggedIn = true;
    State.currentMember = res;
    State.applications = null; // reload
    State.notifications = null; // reload
    showToast(`Signed in successfully as ${res.name}!`);
    navigate('#/');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.memberLogout = async function () {
  await API.logoutMember().catch(() => {});
  State.memberLoggedIn = false;
  State.currentMember = null;
  State.applications = null;
  State.notifications = null;
  showToast('Logged out successfully.');
  navigate('#/');
};

// Admin Login & OTP Flows
window.adminLogin = async function (e) {
  e.preventDefault();
  const email = document.getElementById('ad-email').value.trim();
  const pass = document.getElementById('ad-pass').value;

  try {
    const res = await API.loginAdmin(email, pass);
    State.adminLoggedIn = true;
    State.currentAdmin = res;
    State.applications = null; // reload
    State.listings = null; // reload
    showToast('Access authorized! Welcome to Admin Panel.');
    navigate('#/admin/dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.triggerAdminForgot = async function () {
  const email = document.getElementById('ad-email').value.trim();
  if (!email) {
    showToast('Please specify your Admin Email address to verify OTP', 'error');
    return;
  }
  showToast('Sending OTP email code...', 'warning');
  try {
    await API.forgotAdminPassword(email);
    showToast('OTP sent successfully to email!');
    State.errors['admin_otp_sent'] = true;
    State.adminEmailRequest = email; // Save requested email
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.verifyAdminOtp = async function (e) {
  e.preventDefault();
  const email = State.adminEmailRequest || '';
  const code = document.getElementById('ad-otp').value.trim();
  const resetToggle = document.getElementById('ad-reset-toggle');
  const isResetting = resetToggle ? resetToggle.checked : false;

  try {
    if (isResetting) {
      const newPassInput = document.getElementById('ad-new-pass');
      const newPassword = newPassInput ? newPassInput.value : '';
      if (!newPassword || newPassword.length < 6) {
        showToast('Please set a password (min 6 characters)', 'error');
        return;
      }
      await API.resetAdminPassword(email, code, newPassword);
      showToast('Password reset and logged in successfully!');
    } else {
      await API.verifyAdminOtp(email, code);
      showToast('OTP verified and logged in successfully!');
    }
    State.adminLoggedIn = true;
    State.errors['admin_otp_sent'] = false;
    State.applications = null;
    State.listings = null;
    navigate('#/admin/dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.adminLogout = async function () {
  await API.logoutAdmin().catch(() => {});
  State.adminLoggedIn = false;
  State.currentAdmin = null;
  State.applications = null;
  State.listings = null;
  showToast('Logged out of Admin Portal.');
  navigate('#/');
};

// Admin Action Triggers
window.setAdminSection = function (s) {
  State.adminSection = s;
  State.adminSidebarOpen = false; // close sidebar on mobile after selecting section
  State.applications = null;
  State.listings = null;
  State.storageUsedGB = 0.0;
  render();
};

window.approveApp = async function (id) {
  try {
    await API.updateApplicationStatus(id, 'approved');
    showToast(`Approved application ${id}`);
    State.applications = null; // reload list
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.rejectApp = async function (id) {
  try {
    await API.updateApplicationStatus(id, 'rejected');
    showToast(`Rejected application ${id}`, 'warning');
    State.applications = null; // reload list
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.revokeAccess = async function (id) {
  try {
    await API.revokeApplicationAccess(id);
    showToast(`Revoked Member credentials for application ${id}`, 'warning');
    State.applications = null;
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteApplication = async function (id) {
  if (!confirm('Are you sure you want to permanently delete this application record and all its files? This action cannot be undone.')) {
    return;
  }
  try {
    await API.deleteApplication(id);
    showToast(`Permanently deleted application ${id}`, 'success');
    State.applications = null; // reload list
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.downloadPDF = async function (id) {
  showToast(`Generating and downloading PDF report for ${id}...`, 'warning');
  try {
    await API.downloadApplicationPdf(id);
    showToast('PDF downloaded successfully!');
  } catch (err) {
    showToast(`PDF download error: ${err.message}`, 'error');
  }
};

window.openAppModal = function (id) {
  State.showAppModal = true;
  State.appModalData = id;
  render();
};

window.showAdminPreview = function (id) {
  const item = State.listings.find(l => l.id === id);
  if (item) {
    State.adminPreviewListing = item;
    State.showAdminPreviewModal = true;
    render();
  }
};

function renderAdminPreviewModal() {
  const item = State.adminPreviewListing;
  if (!item) return '';
  
  return `
  <div class="modal-overlay" onclick="if(event.target===this){State.showAdminPreviewModal=false;State.adminPreviewListing=null;render()}" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
    <div class="modal-box" style="max-width:800px; padding:0; overflow:hidden;">
      <div class="modal-header" style="padding:16px 24px; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
        <h3 id="preview-modal-title" style="margin:0;">Media Preview: ${item.title}</h3>
        <button class="modal-close" onclick="State.showAdminPreviewModal=false;State.adminPreviewListing=null;render()">${Icon.x}</button>
      </div>
      <div class="modal-body" style="padding:0;">
        ${renderMediaGallery(item, item.id)}
      </div>
      <div class="modal-footer" style="padding:16px 24px; border-top:1px solid rgba(0,0,0,0.06); display:flex; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="State.showAdminPreviewModal=false;State.adminPreviewListing=null;render()">Close Preview</button>
      </div>
    </div>
  </div>`;
}

window.renderMediaGallery = function (item, id) {
  // Build ordered media items:
  const coverUrl = item.images && item.images.length > 0 ? item.images[0] : null;
  const extraPhotos = item.images && item.images.length > 1 ? item.images.slice(1) : [];

  // Log URLs to browser console as requested by Task 1 (point 3)
  console.log(`[DEBUG] Gallery urls for listing ${id}:`, {
    cover_photo: coverUrl,
    video: item.video_url,
    extra_photos: extraPhotos
  });

  const photoItems = [];
  if (coverUrl) photoItems.push({ type: 'image', url: coverUrl, label: 'Cover Photo' });
  extraPhotos.forEach((url, i) => photoItems.push({ type: 'image', url, label: `Photo ${i + 2}` }));

  const stripItems = [];
  if (item.video_url) stripItems.push({ type: 'video', url: item.video_url, label: 'Video Tour' });
  photoItems.forEach((p, i) => stripItems.push({ ...p, photoIdx: i }));

  let gIdx = State.gallery[id] !== undefined ? State.gallery[id] : 0;
  const activeMode = State.galleryMode && State.galleryMode[id];
  const showingVideo = activeMode === 'video' && item.video_url;
  const activePhoto = showingVideo ? null : (photoItems[gIdx] || photoItems[0]);

  let mediaDisplayHtml = '';
  if (showingVideo) {
    const posterImage = coverUrl || '';
    const isHls = item.video_url && item.video_url.endsWith('.m3u8');
    mediaDisplayHtml = `
      <div class="detail-hero video-active">
        ${posterImage ? `<div class="video-bg-blur" style="background-image: url('${posterImage}');"></div>` : ''}
        <div class="portrait-video-wrapper">
          <div class="video-loading-spinner" id="video-spinner" style="display: none;"></div>
          ${isHls ? `<div class="hls-quality-badge" id="hls-quality-badge" style="display:none"></div>` : ''}
          <video
            id="detail-video-player"
            crossorigin="anonymous"
            controls
            playsinline
            preload="metadata"
            class="portrait-video"
            onwaiting="document.getElementById('video-spinner').style.display='block'"
            onplaying="document.getElementById('video-spinner').style.display='none'"
            onloadeddata="document.getElementById('video-spinner').style.display='none'"
            onloadedmetadata="if(this.videoWidth>this.videoHeight){this.style.objectFit='contain';}else{this.style.objectFit='cover';} document.getElementById('video-spinner').style.display='none';"
          ></video>
          ${isHls ? `
          <div class="hls-quality-selector-container" id="hls-quality-selector-container">
            <label for="hls-quality-selector">Quality</label>
            <select id="hls-quality-selector">
              <option value="-1">Auto</option>
            </select>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (activePhoto) {
    mediaDisplayHtml = `
      <div class="detail-hero">
        <div class="video-bg-blur" style="background-image: url('${activePhoto.url}');"></div>
        <img src="${activePhoto.url}" alt="${item.title} - ${activePhoto.label}" style="position: relative; z-index: 2; object-fit: contain; width: 100%; height: 100%;" />
        <div class="detail-hero-scrim" style="z-index: 3;"></div>
      </div>
    `;
  } else {
    mediaDisplayHtml = `
      <div class="detail-hero">
        <div style="background:#111;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;">No Media Provided</div>
      </div>
    `;
  }

  return `
    ${mediaDisplayHtml}
    ${stripItems.length > 0 ? `
    <div style="background:#fff;border-bottom:1px solid rgba(255,255,255,0.3);">
      <div class="container">
        <div class="gallery-strip">
          ${stripItems.map((media) => {
            if (media.type === 'video') {
              const isActive = showingVideo;
              return `
                <div class="gallery-thumb video-thumb ${isActive ? 'active' : ''}" onclick="setGalleryVideo('${id}')" tabindex="0" role="button" aria-label="View video walkthrough" aria-pressed="${isActive}">
                  <div class="video-thumb-overlay">
                    <span class="play-icon-svg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                    </span>
                    <span class="video-thumb-label">Video</span>
                  </div>
                  ${coverUrl ? `<img src="${coverUrl}" alt="Walkthrough preview" />` : ''}
                </div>
              `;
            } else {
              const pIdx = media.photoIdx;
              const isActive = !showingVideo && gIdx === pIdx;
              return `
                <div class="gallery-thumb ${isActive ? 'active' : ''}" onclick="setGalleryPhoto('${id}',${pIdx})" tabindex="0" role="button" aria-label="View ${media.label}" aria-pressed="${isActive}">
                  <img src="${media.url}" alt="${media.label}" loading="lazy" />
                </div>
              `;
            }
          }).join('')}
        </div>
      </div>
    </div>
    ` : ''}
  `;
};

window.confirmDelete = function (id) {
  State.showDeleteModal = true;
  State.deleteTarget = id;
  render();
};

window.deleteListing = async function () {
  try {
    const item = State.listings ? State.listings.find(l => l.id === State.deleteTarget) : null;
    if (item && item.status === 'archived') {
      await API.permanentlyDeleteListing(State.deleteTarget);
      showToast('Listing permanently deleted.');
    } else {
      await API.deleteListing(State.deleteTarget);
      showToast('Listing marked as booked/filled successfully.');
    }
    State.showDeleteModal = false;
    State.deleteTarget = null;
    State.listings = null; // reload list
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.publishListing = async function () {
  const title = document.getElementById('lc-title').value.trim();
  const locality = document.getElementById('lc-locality').value;
  const category = document.getElementById('lc-category').value;
  const priceInput = document.getElementById('lc-price');
  const price = priceInput ? priceInput.value : '';
  const desc = document.getElementById('lc-desc').value.trim();
  const coverFile = document.getElementById('lc-cover').files[0];
  const galleryFiles = document.getElementById('lc-gallery').files;
  const videoFile = document.getElementById('lc-video').files[0];

  const type = State.adminListingTab; // 'room' | 'job' | 'land' | 'house'
  const isRoomOrJob = type === 'room' || type === 'job';

  if (!title || (!price && isRoomOrJob)) {
    showToast('Please specify all required fields (Title and Price/Salary)', 'error');
    return;
  }

  // Get selected checkboxes
  const checkboxes = document.querySelectorAll('input[name="lc-amenity"]:checked');
  const checkedAmenities = Array.from(checkboxes).map(cb => cb.value);

  const btn = document.querySelector('button[onclick="publishListing()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Uploading assets...';
  }

  try {
    const form = new FormData();
    form.append('type', type);
    form.append('title', title);
    form.append('description', desc);
    if (price) {
      form.append('price_or_salary', price);
    }
    form.append('locality', locality);
    form.append('category', category);

    const attributes = {};
    if (type === 'room') {
      const parkingVal = document.getElementById('lc-parking').value;
      attributes.parking = parkingVal === 'Yes';
      attributes.furnished = true;
      attributes.suitableFor = 'Family';
      attributes.amenities = checkedAmenities;
    } else if (type === 'job') {
      const jobtypeVal = document.getElementById('lc-jobtype').value;
      attributes.jobType = jobtypeVal;
      attributes.experience = 'Entry';
      attributes.requirements = checkedAmenities;
    } else {
      // Land or House
      attributes.landArea = document.getElementById('lc-landarea').value.trim();
      attributes.roadAccess = document.getElementById('lc-roadaccess').value.trim();
      if (type === 'house') {
        const parkingVal = document.getElementById('lc-parking').value;
        attributes.parking = parkingVal === 'Yes';
        attributes.houseFloors = document.getElementById('lc-housefloors').value.trim();
      }
    }

    form.append('attributes', JSON.stringify(attributes));
    if (coverFile) {
      form.append('cover_photo', coverFile);
    }
    for (let i = 0; i < galleryFiles.length; i++) {
      form.append('gallery_photos', galleryFiles[i]);
    }
    if (videoFile) {
      form.append('video', videoFile);
    }

    await API.createListing(form);
    showToast('Listing successfully created!');
    State.showCreateModal = false;
    State.listings = null; // invalidate
    render();
  } catch (err) {
    showToast(`Listing creation failed: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Publish Listing';
    }
  }
};

window.saveAdminSettings = async function (e) {
  e.preventDefault();
  const whatsapp = document.getElementById('set-whatsapp').value.trim();
  try {
    await API.updateAdminSettings(whatsapp);
    State.adminWhatsapp = whatsapp;
    showToast('Whatsapp settings saved successfully.');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.uploadQrCode = async function (input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    showToast('Uploading new payment QR image...', 'warning');
    try {
      const res = await API.uploadAdminQrCode(file);
      State.adminQrCode = res.qr_code;
      showToast('QR code update applied successfully.');
      render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// Platform Seeds Managers
window.addLocality = async function (name) {
  if (!name.trim()) return;
  try {
    await API.addLocality(name.trim());
    State.localities.push(name.trim());
    showToast(`Added location area: ${name}`);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteLocality = async function (name) {
  try {
    await API.deleteLocality(name);
    State.localities = State.localities.filter(l => l !== name);
    showToast(`Removed location area: ${name}`, 'warning');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.addJobCategory = async function (name) {
  if (!name.trim()) return;
  try {
    await API.addJobCategory(name.trim());
    State.jobCategories.push(name.trim());
    showToast(`Added job category: ${name}`);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteJobCategory = async function (name) {
  try {
    await API.deleteJobCategory(name);
    State.jobCategories = State.jobCategories.filter(c => c !== name);
    showToast(`Removed job category: ${name}`, 'warning');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.addRoomType = async function (name) {
  if (!name.trim()) return;
  try {
    await API.addRoomType(name.trim());
    State.roomTypes.push(name.trim());
    showToast(`Added room type: ${name}`);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteRoomType = async function (name) {
  try {
    await API.deleteRoomType(name);
    State.roomTypes = State.roomTypes.filter(rt => rt !== name);
    showToast(`Removed room type: ${name}`, 'warning');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.addRoomFeature = async function (name) {
  if (!name.trim()) return;
  try {
    await API.addRoomFeature(name.trim());
    State.roomFeatures.push(name.trim());
    showToast(`Added room feature: ${name}`);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteRoomFeature = async function (name) {
  try {
    await API.deleteRoomFeature(name);
    State.roomFeatures = State.roomFeatures.filter(rf => rf !== name);
    showToast(`Removed room feature: ${name}`, 'warning');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Push alert actions
window.blockPush = function () {
  const prompt = document.getElementById('push-prompt');
  if (prompt) prompt.style.display = 'none';
};

window.enablePush = async function () {
  try {
    if (!('Notification' in window)) {
      showToast('Push alerts not supported in this browser', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      State.pushEnabled = true;
      showToast('Push alert messaging enabled.');
      const prompt = document.getElementById('push-prompt');
      if (prompt) prompt.style.display = 'none';
      render();
    } else {
      showToast('Desktop push notifications blocked.', 'warning');
    }
  } catch (e) {
    showToast(`Push enable failed: ${e.message}`, 'error');
  }
};

// // MAIN INITIALIZATION ROUTINE //""""""""""""""""""""""""""""
let isInitialized = false;
async function initializeApp() {
  try {
    const [localities, roomTypes, jobCategories, roomFeatures, waRes, qrRes] = await Promise.all([
      API.getLocalities().catch(() => []),
      API.getRoomTypes().catch(() => []),
      API.getJobCategories().catch(() => []),
      API.getRoomFeatures().catch(() => []),
      API.getAdminWhatsappNumber().catch(() => ({ whatsapp_number: '9779841234567' })),
      API.getAdminQrCode().catch(() => ({ qr_code: '' }))
    ]);

    State.localities = localities;
    State.roomTypes = roomTypes;
    State.jobCategories = jobCategories;
    State.roomFeatures = roomFeatures;
    State.adminWhatsapp = waRes.whatsapp_number;
    State.adminQrCode = qrRes.qr_code;

    // Check sessions
    const member = await API.getMemberMe().catch(() => null);
    if (member) {
      State.memberLoggedIn = true;
      State.currentMember = member;
    }

    const admin = await API.getAdminMe().catch(() => null);
    if (admin) {
      State.adminLoggedIn = true;
      State.currentAdmin = admin;
    }

    isInitialized = true;
  } catch (err) {
    console.error('Core app initialization failed:', err);
  } finally {
    render();
  }
}

// // MAIN RENDER ROUTE BOOTSTRAP //"""""""""""""""""""""""""""""
let lastHash = null;
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (!isInitialized) {
    app.innerHTML = `
      <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#F6F1EA; font-family:sans-serif;">
        <div class="spinner" style="margin-bottom:20px;"></div>
        <div style="color:#2b2724; font-weight:600; font-size:1.1rem; letter-spacing:0.5px;">Loading Kotha Jagir Solution...</div>
      </div>
    `;
    return;
  }

  document.title = "Kotha Jagir - Room Finder & Job Finder in Kathmandu, Nepal | Kotha Bhada";

  const { path, params } = parseRoute();
  State.route = path;
  State.routeParams = params;

  let html = '';

  if (path === '/' || path === '' || path === '/rooms') {
    State.mode = 'rooms';
    html = renderHomePage();
  } else if (path === '/jobs' && !params.id) {
    State.mode = 'jobs';
    html = renderHomePage();
  } else if (path === '/ghar-jagga') {
    if (params.id) {
      if (params.sub === 'booked') {
        html = renderArchivedPage(params.id, 'ghar-jagga');
      } else {
        html = renderDetailPage(params.id);
      }
    } else {
      State.mode = 'ghar-jagga';
      html = renderHomePage();
    }
  } else if (path === '/room' && params.id && params.sub === 'booked') {
    html = renderArchivedPage(params.id, 'room');
  } else if (path === '/jobs' && params.id && params.sub === 'filled') {
    html = renderArchivedPage(params.id, 'job');
  } else if (path === '/room' && params.id) {
    html = renderDetailPage(params.id);
  } else if (path === '/jobs' && params.id) {
    html = renderDetailPage(params.id);
  } else if (path === '/apply' && params.id) {
    if (State.applyListingId !== params.id) {
      State.applyListingId = params.id;
      State.applyStep = 1;
      State.applyFormData = {};
    }
    html = renderApplyFlow(params.id);
  } else if (path === '/login') {
    html = renderMemberLogin();
  } else if (path === '/dashboard') {
    html = renderMemberDashboard();
  } else if (path === '/admin') {
    if (params.sub === 'dashboard') {
      html = renderAdminDashboard();
    } else {
      html = renderAdminLogin();
    }
  } else {
    html = renderNotFound();
  }

  app.innerHTML = html;
  
  const currentHash = location.hash || '#/';
  if (lastHash !== currentHash) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    lastHash = currentHash;
  }

  // Attach hls.js to video element after render if needed
  attachHlsPlayer();
}

// Password visibility toggler
window.togglePasswordVisibility = function (id, btn) {
  const input = document.getElementById(id);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerText = 'Hide';
    } else {
      input.type = 'password';
      btn.innerText = 'Show';
    }
  }
};

// =============================================================================
// HLS PLAYER ATTACHMENT
// Called after every render(). Checks if a video element exists in the DOM and
// if the listing has an HLS (.m3u8) source — if so, attaches hls.js for
// adaptive bitrate streaming. Falls back to native src="" for plain mp4.
// =============================================================================
let _hlsInstance = null; // keep a reference to destroy on re-renders

function setupQualitySelector(hls) {
  const selector = document.getElementById('hls-quality-selector');
  if (!selector) return;

  // Clear existing options
  selector.innerHTML = '';

  // Add Auto option
  const autoOpt = document.createElement('option');
  autoOpt.value = '-1';
  autoOpt.textContent = 'Auto';
  selector.appendChild(autoOpt);

  // Add options for each level
  hls.levels.forEach((level, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    const heights = [360, 480, 720];
    const h = level.height || heights[index] || `Level ${index}`;
    opt.textContent = `${h}p`;
    selector.appendChild(opt);
  });

  // Set the selected value to current level
  selector.value = hls.currentLevel;

  // Listen for changes
  selector.onchange = (e) => {
    const newLevel = parseInt(e.target.value, 10);
    hls.currentLevel = newLevel;
  };
}

function playHlsVideo(videoElement, url) {
  if (!url) return;
  
  if (_hlsInstance) {
    _hlsInstance.destroy();
    _hlsInstance = null;
  }

  if (url.endsWith('.m3u8')) {
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url; // Safari native HLS support
      videoElement.load();
    } else if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        abrEwmaDefaultEstimate: 500000,
        startLevel: -1,
        autoStartLoad: true,
      });

      hls.loadSource(url);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.currentLevel = 0; // default to lowest quality (360p)
        document.getElementById('video-spinner') && (document.getElementById('video-spinner').style.display = 'none');
        setupQualitySelector(hls);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const badge = document.getElementById('hls-quality-badge');
        if (!badge) return;
        const level = hls.levels[data.level];
        if (level) {
          const heights = [360, 480, 720];
          const h = level.height || heights[data.level] || '?';
          badge.textContent = `${h}p`;
          badge.style.display = 'block';
        }
        const selector = document.getElementById('hls-quality-selector');
        if (selector) {
          selector.value = data.level;
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS playback error:', data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            _hlsInstance = null;
          }
        }
      });

      _hlsInstance = hls;
    } else {
      console.error('HLS not supported and hls.js failed to load.');
    }
  } else {
    videoElement.src = url; // direct video file fallback (non-HLS upload path)
    videoElement.load();
  }
}

function attachHlsPlayer() {
  const videoEl = document.getElementById('detail-video-player');
  if (!videoEl) {
    if (_hlsInstance) { _hlsInstance.destroy(); _hlsInstance = null; }
    return;
  }

  const item = State.currentListing || State.adminPreviewListing;
  if (!item || !item.video_url) return;

  const videoUrl = item.video_url;
  
  playHlsVideo(videoEl, videoUrl);
}

// Run application
initializeApp();
