/* ========================================
   App Core — Navigation & Utilities
   ======================================== */

// --- Tab Navigation ---
function switchTab(tabId) {
  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navItem) navItem.classList.add('active');

  // Update sections
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  const section = document.getElementById('section-' + tabId);
  if (section) section.classList.add('active');

  // Close mobile menu
  closeMobileMenu();

  // Initialize section-specific content
  if (tabId === 'block') updateSingleBlock();
  if (tabId === 'blockchain') initBlockchain();
  if (tabId === 'consensus' && typeof updatePosNetworkState === 'function') {
      updatePosNetworkState();
      poaSimulateRound();
  }
  if (tabId === 'distributed' && typeof initDistributed === 'function') initDistributed();
  if (tabId === 'contracts') initContracts();
  if (tabId === 'tokenomics' && typeof initTokenomics === 'function') initTokenomics();
  if (tabId === 'nft' && typeof initNFT === 'function') initNFT();
  if (tabId === 'defi' && typeof initDeFi === 'function') initDeFi();
  if (tabId === 'dao' && typeof initDAO === 'function') initDAO();
}

// --- Mobile Menu ---
function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('mobileMenuBtn');
  sidebar.classList.toggle('mobile-open');
  btn.textContent = sidebar.classList.contains('mobile-open') ? '✕' : '☰';
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('mobileMenuBtn');
  sidebar.classList.remove('mobile-open');
  if (btn) btn.textContent = '☰';
}

// --- Toast Notification ---
function showToast(message, duration) {
  duration = duration || 3000;
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function () {
    toast.classList.remove('show');
  }, duration);
}

// --- Theme Toggle ---
function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('bcdemo-theme', next);
  var btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'light' ? '🌙' : '☀️';
}

function restoreTheme() {
  var saved = localStorage.getItem('bcdemo-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = saved === 'light' ? '🌙' : '☀️';
  }
}

// --- Shared SHA-256 (using Web Crypto API) ---
async function sha256(message) {
  var msgBuffer = new TextEncoder().encode(message);
  var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// --- Hex Utilities ---
function bytesToHex(bytes) {
  return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function hexToBytes(hex) {
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
}

function generateHex(length) {
  var arr = new Uint8Array(length / 2);
  window.crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

// --- Difficulty prefix ---
var DIFFICULTY = '0000';

// --- Initialize ---
document.addEventListener('DOMContentLoaded', function () {
  restoreTheme();
  updateHash(); // Show empty hash on load
  if (typeof initContracts === 'function') initContracts();
});
