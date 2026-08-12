/**
 * API client to communicate with the Node.js Express backend.
 * Reads configurations dynamically.
 */
const API_BASE = window.ENV?.API_URL || 
  ((window.location.origin === 'null' || window.location.protocol === 'file:') 
    ? 'http://localhost:3000' 
    : window.location.origin);

// Helper to make fetch requests with cookie credentials
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  // Set credentials to 'include' so httpOnly cookies are sent and stored
  options.credentials = 'include';
  
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, options);
  
  if (response.status === 401) {
    // If unauthorized, redirect to appropriate login dynamically on the frontend
    const hash = window.location.hash;
    if (hash.startsWith('#/admin') && hash !== '#/admin/login') {
      window.location.hash = '#/admin/login';
    } else if (hash.startsWith('#/dashboard')) {
      window.location.hash = '#/login';
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  // Handle file downloads
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/pdf')) {
    return await response.blob();
  }

  return await response.json().catch(() => ({}));
}

window.API = {
  // --- METADATA SEEDS ---
  async getLocalities() {
    return await apiFetch('/api/localities');
  },
  async getRoomTypes() {
    return await apiFetch('/api/room-types');
  },
  async getJobCategories() {
    return await apiFetch('/api/job-categories');
  },

  // --- SETTINGS ---
  async getAdminWhatsappNumber() {
    return await apiFetch('/api/settings/whatsapp-number');
  },
  async getAdminQrCode() {
    return await apiFetch('/api/settings/qr-code');
  },

  // --- LISTINGS ---
  async getListings(filters = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    return await apiFetch(`/api/listings?${query.toString()}`);
  },
  async getListing(id) {
    return await apiFetch(`/api/listings/${id}`);
  },

  // --- APPLICATION FLOW ---
  async submitApplication(formData) {
    // formData must be an instance of FormData for multipart file upload
    return await apiFetch('/api/applications', {
      method: 'POST',
      body: formData,
    });
  },

  // --- MEMBER AUTHENTICATION ---
  async loginMember(email, password) {
    return await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },
  async logoutMember() {
    return await apiFetch('/api/auth/logout', { method: 'POST' });
  },
  async getMemberMe() {
    return await apiFetch('/api/auth/me');
  },

  // --- MEMBER DASHBOARD ---
  async getMemberApplications() {
    return await apiFetch('/api/member/applications');
  },
  async getMemberNotifications() {
    return await apiFetch('/api/member/notifications');
  },

  // --- ADMIN AUTHENTICATION ---
  async loginAdmin(email, password) {
    return await apiFetch('/api/admin/login', {
      method: 'POST',
      body: { email, password },
    });
  },
  async logoutAdmin() {
    return await apiFetch('/api/admin/logout', { method: 'POST' });
  },
  async getAdminMe() {
    return await apiFetch('/api/admin/auth/me');
  },
  async forgotAdminPassword(email) {
    return await apiFetch('/api/admin/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },
  async verifyAdminOtp(email, code) {
    return await apiFetch('/api/admin/verify-otp', {
      method: 'POST',
      body: { email, code },
    });
  },
  async resetAdminPassword(email, code, newPassword) {
    return await apiFetch('/api/admin/reset-password', {
      method: 'POST',
      body: { email, code, newPassword },
    });
  },

  // --- ADMIN DASHBOARD ---
  async getAdminApplications(search = '', filter = 'all') {
    const query = new URLSearchParams({ search, filter });
    return await apiFetch(`/api/admin/applications?${query.toString()}`);
  },
  async updateApplicationStatus(id, status) {
    return await apiFetch(`/api/admin/applications/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },
  async revokeApplicationAccess(id) {
    return await apiFetch(`/api/admin/applications/${id}/revoke`, {
      method: 'PATCH',
    });
  },
  async deleteApplication(id) {
    return await apiFetch(`/api/admin/applications/${id}`, {
      method: 'DELETE',
    });
  },
  async downloadApplicationPdf(id) {
    const blob = await apiFetch(`/api/admin/applications/${id}/pdf`);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `application_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  },
  
  // --- ADMIN LISTINGS ---
  async getAdminListings(type = 'room') {
    return await apiFetch(`/api/admin/listings?type=${type}`);
  },
  async createListing(formData) {
    // formData must be FormData
    return await apiFetch('/api/admin/listings', {
      method: 'POST',
      body: formData,
    });
  },
  async updateListing(id, formData) {
    // formData must be FormData
    return await apiFetch(`/api/admin/listings/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },
  async deleteListing(id) {
    return await apiFetch(`/api/admin/listings/${id}`, {
      method: 'DELETE',
    });
  },
  async permanentlyDeleteListing(id) {
    return await apiFetch(`/api/admin/listings/${id}/permanent`, {
      method: 'DELETE',
    });
  },

  // --- ADMIN SETTINGS ---
  async updateAdminSettings(whatsappNumber) {
    return await apiFetch('/api/admin/settings', {
      method: 'PATCH',
      body: { whatsapp_number: whatsappNumber },
    });
  },
  async uploadAdminQrCode(file) {
    const formData = new FormData();
    formData.append('qr_code', file);
    return await apiFetch('/api/admin/settings/qr-code', {
      method: 'POST',
      body: formData,
    });
  },
  async getAdminStorageUsage() {
    return await apiFetch('/api/admin/storage');
  },

  // --- PLATFORM CATEGORIES ---
  async addLocality(name) {
    return await apiFetch('/api/admin/localities', {
      method: 'POST',
      body: { name },
    });
  },
  async deleteLocality(name) {
    return await apiFetch(`/api/admin/localities/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
  async addJobCategory(name) {
    return await apiFetch('/api/admin/job-categories', {
      method: 'POST',
      body: { name },
    });
  },
  async deleteJobCategory(name) {
    return await apiFetch(`/api/admin/job-categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
  async addRoomType(name) {
    return await apiFetch('/api/admin/room-types', {
      method: 'POST',
      body: { name },
    });
  },
  async deleteRoomType(name) {
    return await apiFetch(`/api/admin/room-types/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },

  // --- GHAR/JAGGA INQUIRIES ---
  async submitGharJaggaInquiry(listingId, fullName, phone, message) {
    return await apiFetch('/api/ghar-jagga/inquiries', {
      method: 'POST',
      body: { listing_id: listingId, full_name: fullName, phone, message }
    });
  },
  async getAdminGharJaggaInquiries() {
    return await apiFetch('/api/admin/ghar-jagga/inquiries');
  },
};
