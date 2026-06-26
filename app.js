/**
 * Barrier-Free Map Web App (app.js)
 * Core application logic with Leaflet Map, Geolocation, and Firebase/LocalStorage DB Service.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, limit } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// --- CONFIGURATION & CONSTANTS ---
const DEFAULT_CENTER = [35.0039, 128.0642]; // Sacheon-si City Hall (사천시청 주변)
const DEFAULT_ZOOM = 16;

// Path Colors & Styles
const PATH_STYLES = {
  convenient: {
    color: '#10B981',       // Emerald Green
    weight: 7,
    opacity: 0.85,
    label: '🟢 편리한 길 (유모차/휠체어 이동 편리)',
    popupText: '<strong>편리한 길</strong><br>턱이 없고 경사가 완만하여 휠체어나 유모차가 이동하기 편리합니다.'
  },
  caution: {
    color: '#F59E0B',       // Amber Yellow
    weight: 7,
    opacity: 0.85,
    label: '🟡 주의가 필요한 길 (경사/노면 불량)',
    popupText: '<strong>주의가 필요한 길</strong><br>가파른 경사나 낮은 턱이 있어 주의해서 이동해야 합니다.'
  },
  inaccessible: {
    color: '#EF4444',       // Crimson Red
    weight: 7,
    opacity: 0.85,
    label: '🔴 이동 불가능한 길 (계단/단차)',
    popupText: '<strong>이동 불가능한 길</strong><br>높은 단차나 계단이 있어 휠체어/유모차 이동이 어렵습니다.'
  }
};

// Mock Initial Data (Sacheon-si City Hall vicinity)
const MOCK_PATHS = [
  {
    coordinates: [[35.0032, 128.0625], [35.0035, 128.0640], [35.0042, 128.0645]],
    rating: 'convenient',
    createdAt: new Date().toISOString()
  },
  {
    coordinates: [[35.0042, 128.0645], [35.0055, 128.0655]],
    rating: 'caution',
    createdAt: new Date().toISOString()
  },
  {
    coordinates: [[35.0055, 128.0655], [35.0062, 128.0650]],
    rating: 'inaccessible',
    createdAt: new Date().toISOString()
  }
];

// --- STATE MANAGEMENT ---
let map = null;
let userMarker = null;
let db = null;
let isFirebaseConnected = false;

// Recording State
let recordState = {
  active: false,
  startPoint: null,
  endPoint: null,
  tempStartMarker: null,
  tempEndMarker: null,
  tempPolyline: null,
  tempDashedLine: null
};

// UI Elements
const dbStatusBadge = document.getElementById('db-status-badge');
const dbStatusText = dbStatusBadge.querySelector('.status-text');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settings-modal');
const firebaseConfigForm = document.getElementById('firebase-config-form');
const resetConfigBtn = document.getElementById('resetConfigBtn');

const locateBtn = document.getElementById('locateBtn');
const recordToggleBtn = document.getElementById('recordToggleBtn');
const recordInstructionPanel = document.getElementById('record-instruction-panel');
const instructionText = document.getElementById('instruction-text');
const cancelRecordBtn = document.getElementById('cancelRecordBtn');

const ratingPanel = document.getElementById('rating-panel');
const cancelRatingBtn = document.getElementById('cancelRatingBtn');
const ratingOptionButtons = document.querySelectorAll('.rating-option-btn');

const legendPanel = document.getElementById('legend-panel');
const legendToggleBtn = document.getElementById('legendToggleBtn');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');

// --- DATABASE SERVICE LAYER ---
const DatabaseService = {
  // Initialize Database
  init() {
    let config = null;
    const savedConfig = localStorage.getItem('firebase_config');
    
    if (savedConfig) {
      try {
        config = JSON.parse(savedConfig);
      } catch (e) {
        console.error("Failed to parse stored Firebase config:", e);
      }
    }

    // Default configuration (User's Firebase credentials)
    if (!config) {
      config = {
        apiKey: "AIzaSyB46_ftRZ01Psd3fo4d5R36a-zlgQJXxmc",
        authDomain: "barrier-free-map-da8a7.firebaseapp.com",
        projectId: "barrier-free-map-da8a7",
        storageBucket: "barrier-free-map-da8a7.firebasestorage.app",
        messagingSenderId: "643426179252",
        appId: "1:643426179252:web:88735322da53f8c94a1fe1",
        measurementId: "G-FB20RMBWEB"
      };
    }

    // Check if configuration is present and valid
    if (config && config.apiKey && config.projectId) {
      try {
        const app = initializeApp(config);
        db = getFirestore(app);
        isFirebaseConnected = true;
        
        // Update badge UI
        dbStatusBadge.className = 'status-badge firestore';
        dbStatusText.textContent = 'Firebase';
        
        // Pre-fill form inputs
        Object.keys(config).forEach(key => {
          const input = document.getElementById(key);
          if (input) input.value = config[key];
        });
      } catch (err) {
        console.warn("Firebase failed to initialize:", err);
        this.fallbackToLocal();
      }
    } else {
      this.fallbackToLocal();
    }
  },

  fallbackToLocal() {
    db = null;
    isFirebaseConnected = false;
    dbStatusBadge.className = 'status-badge local';
    dbStatusText.textContent = '로컬 저장소';
    
    // Seed initial mock data if LocalStorage is completely empty
    if (!localStorage.getItem('barrier_free_paths')) {
      localStorage.setItem('barrier_free_paths', JSON.stringify(MOCK_PATHS));
    }
  },

  // Fetch all paths
  async getPaths() {
    if (isFirebaseConnected && db) {
      try {
        const pathsCollection = collection(db, 'paths');
        // Limit query to prevent loading too many routes at once, keep it responsive
        const q = query(pathsCollection, limit(200));
        const querySnapshot = await getDocs(q);
        const paths = [];
        querySnapshot.forEach(doc => {
          paths.push(doc.data());
        });
        return paths;
      } catch (err) {
        console.error("Error fetching from Firestore, loading local data:", err);
        showToast("원격 데이터를 불러오지 못했습니다. 로컬 데이터를 불러옵니다.");
      }
    }
    
    // LocalStorage Fallback
    return JSON.parse(localStorage.getItem('barrier_free_paths') || '[]');
  },

  // Save new path
  async savePath(coordinates, rating) {
    const newPath = {
      coordinates: coordinates.map(latlng => [latlng.lat, latlng.lng]),
      rating: rating,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
      try {
        const pathsCollection = collection(db, 'paths');
        await addDoc(pathsCollection, newPath);
        showToast("길 상태 정보가 Firebase DB에 저장되었습니다!");
        return newPath;
      } catch (err) {
        console.error("Error saving to Firestore, saving locally instead:", err);
        showToast("서버 저장 실패! 웹 브라우저(로컬)에 저장합니다.");
      }
    }

    // LocalStorage fallback
    const localPaths = JSON.parse(localStorage.getItem('barrier_free_paths') || '[]');
    localPaths.push(newPath);
    localStorage.setItem('barrier_free_paths', JSON.stringify(localPaths));
    showToast("길 상태 정보가 브라우저에 임시 저장되었습니다.");
    return newPath;
  }
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  // Initialize Database Service
  DatabaseService.init();
  
  // Initialize Leaflet Map
  initMap();
  
  // Register Event Listeners
  setupEventListeners();
  
  // Load and Render Existing Paths
  loadAndRenderPaths();
  
  // Automatically locate user on startup
  locateUser();
});

// --- MAP FUNCTIONS ---
function initMap() {
  // Initialize map object, disabling default zoom control to position custom controls
  map = L.map('map', {
    zoomControl: false,
    maxZoom: 19,
    minZoom: 6
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Load OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add Leaflet zoom control at custom location
  L.control.zoom({
    position: 'topleft'
  }).addTo(map);
}

// Fetch paths from database and draw on the map
async function loadAndRenderPaths() {
  // Clear existing non-user vector layers
  map.eachLayer(layer => {
    if (layer instanceof L.Polyline && !(layer === recordState.tempPolyline) && !(layer === recordState.tempDashedLine)) {
      map.removeLayer(layer);
    }
  });

  const paths = await DatabaseService.getPaths();
  paths.forEach(path => {
    renderPathOnMap(path);
  });
}

// Render a single path polyline on the map
function renderPathOnMap(path) {
  if (!path.coordinates || path.coordinates.length < 2) return;
  
  const style = PATH_STYLES[path.rating] || PATH_STYLES.caution;
  const polyline = L.polyline(path.coordinates, {
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  // Add information popup
  const dateStr = path.createdAt ? new Date(path.createdAt).toLocaleDateString('ko-KR') : '알 수 없음';
  polyline.bindPopup(`
    <div class="map-popup-content">
      ${style.popupText}
      <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted);">제보일: ${dateStr}</div>
    </div>
  `);
}

// --- RECORD STATE MACHINE ---

function startRecordMode() {
  recordState.active = true;
  recordState.startPoint = null;
  recordState.endPoint = null;

  // UI state change
  recordToggleBtn.parentElement.classList.add('hidden');
  recordInstructionPanel.classList.remove('hidden');
  instructionText.innerHTML = '지도에서 길의 <strong>시작점</strong>을 터치해 주세요.';
  recordInstructionPanel.querySelector('.instruction-step-num').textContent = 'Step 1';
  
  // Map cursor change
  map.getContainer().style.cursor = 'crosshair';

  // Attach Map Clicks
  map.on('click', onMapClick);
}

function onMapClick(e) {
  if (!recordState.active) return;

  if (!recordState.startPoint) {
    // First Click: Set Start Point
    recordState.startPoint = e.latlng;
    
    // Create Custom Start Pin Marker
    const startIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="pin-circle start"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    recordState.tempStartMarker = L.marker(recordState.startPoint, { icon: startIcon }).addTo(map);
    
    // Transition to Step 2
    instructionText.innerHTML = '지도에서 길의 <strong>끝점</strong>을 터치해 주세요.';
    recordInstructionPanel.querySelector('.instruction-step-num').textContent = 'Step 2';
    
    // Track mouse movement to draw a dashed preview line
    map.on('mousemove', onMapMouseMove);
  } else if (!recordState.endPoint) {
    // Second Click: Set End Point
    recordState.endPoint = e.latlng;

    // Remove Mouse Move Preview
    map.off('mousemove', onMapMouseMove);
    if (recordState.tempDashedLine) {
      map.removeLayer(recordState.tempDashedLine);
      recordState.tempDashedLine = null;
    }

    // Create Custom End Pin Marker
    const endIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div class="pin-circle end"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    recordState.tempEndMarker = L.marker(recordState.endPoint, { icon: endIcon }).addTo(map);

    // Draw temporary solid line
    recordState.tempPolyline = L.polyline([recordState.startPoint, recordState.endPoint], {
      color: '#4F46E5', // Neutral blue-indigo
      weight: 6,
      dashArray: '5, 10',
      opacity: 0.8
    }).addTo(map);

    // Hide instruction, show rating panel
    recordInstructionPanel.classList.add('hidden');
    ratingPanel.classList.remove('hidden');
    
    // Change map cursor back to normal
    map.getContainer().style.cursor = '';
    
    // Turn off map click listening
    map.off('click', onMapClick);
  }
}

function onMapMouseMove(e) {
  if (!recordState.startPoint) return;
  
  const currentLatLng = e.latlng;
  
  if (recordState.tempDashedLine) {
    recordState.tempDashedLine.setLatLngs([recordState.startPoint, currentLatLng]);
  } else {
    recordState.tempDashedLine = L.polyline([recordState.startPoint, currentLatLng], {
      color: '#94A3B8',
      weight: 4,
      dashArray: '5, 8',
      opacity: 0.6
    }).addTo(map);
  }
}

// Cancel segment recording process and clean up temporary markers
function cancelRecordMode() {
  recordState.active = false;
  
  // Clean map click and movement events
  map.off('click', onMapClick);
  map.off('mousemove', onMapMouseMove);
  
  // Remove temporary map layers
  if (recordState.tempStartMarker) map.removeLayer(recordState.tempStartMarker);
  if (recordState.tempEndMarker) map.removeLayer(recordState.tempEndMarker);
  if (recordState.tempPolyline) map.removeLayer(recordState.tempPolyline);
  if (recordState.tempDashedLine) map.removeLayer(recordState.tempDashedLine);
  
  recordState.tempStartMarker = null;
  recordState.tempEndMarker = null;
  recordState.tempPolyline = null;
  recordState.tempDashedLine = null;
  recordState.startPoint = null;
  recordState.endPoint = null;
  
  // Restore map cursor
  map.getContainer().style.cursor = '';

  // UI state restore
  recordToggleBtn.parentElement.classList.remove('hidden');
  recordInstructionPanel.classList.add('hidden');
  ratingPanel.classList.add('hidden');
}

// Complete recording and save rating
async function saveRecord(rating) {
  if (!recordState.startPoint || !recordState.endPoint) {
    cancelRecordMode();
    return;
  }

  const coords = [recordState.startPoint, recordState.endPoint];
  
  // Save to DB (Firestore / LocalStorage fallback)
  const savedPath = await DatabaseService.savePath(coords, rating);
  
  // Render new path directly to map
  renderPathOnMap(savedPath);
  
  // Clean and reset
  cancelRecordMode();
}

// --- GPS / GEOLOCATION ---
function locateUser() {
  if (!navigator.geolocation) {
    showToast("이 브라우저에서는 GPS 위치 확인을 지원하지 않습니다.");
    return;
  }

  showToast("현재 내 위치를 확인하는 중입니다...");
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      const userLatLng = [lat, lng];

      // Pan to user location
      map.flyTo(userLatLng, DEFAULT_ZOOM + 1, {
        animate: true,
        duration: 1.5
      });

      // Update or create user location marker (pulsing circle)
      if (userMarker) {
        userMarker.setLatLng(userLatLng);
      } else {
        const userIcon = L.divIcon({
          className: 'gps-pulse-marker',
          html: '<div class="gps-pulse"></div><div class="gps-dot"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        userMarker = L.marker(userLatLng, { icon: userIcon }).addTo(map);
      }
      
      // Bind location accuracy popup
      userMarker.bindPopup(`<strong>내 현재 위치</strong><br>오차범위: 약 ${Math.round(accuracy)}m`).openPopup();
    },
    (error) => {
      console.warn("Geolocation error:", error);
      let errorMsg = "내 위치를 가져오지 못했습니다.";
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = "위치 정보 권한이 거부되었습니다. 설정에서 위치 서비스를 켜주세요.";
      }
      showToast(errorMsg);
      
      // Fallback: Fly to default center (Sacheon-si)
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
        animate: true,
        duration: 1.2
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// --- EVENT LISTENERS REGISTRATION ---
function setupEventListeners() {
  // Settings Button - Open Modal
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  // Settings Close Button - Close Modal
  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  // Modal Backdrop Click - Close Modal
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  // Settings Save - Form Submit
  firebaseConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      apiKey: document.getElementById('apiKey').value.trim(),
      authDomain: document.getElementById('authDomain').value.trim(),
      projectId: document.getElementById('projectId').value.trim(),
      storageBucket: document.getElementById('storageBucket').value.trim(),
      messagingSenderId: document.getElementById('messagingSenderId').value.trim(),
      appId: document.getElementById('appId').value.trim()
    };

    // Check if configuration has contents
    if (config.apiKey && config.projectId) {
      localStorage.setItem('firebase_config', JSON.stringify(config));
      showToast("Firebase 설정이 저장되었습니다. 연결을 위해 앱을 다시 로드합니다...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showToast("올바른 API Key와 Project ID를 입력해주세요.");
    }
  });

  // Settings Reset (Fallback to local mode)
  resetConfigBtn.addEventListener('click', () => {
    localStorage.removeItem('firebase_config');
    showToast("Firebase 설정을 초기화했습니다. 로컬 모드로 전환하기 위해 다시 로드합니다...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });

  // GPS Click
  locateBtn.addEventListener('click', locateUser);

  // Record Toggle Click
  recordToggleBtn.addEventListener('click', startRecordMode);

  // Cancel Record Click
  cancelRecordBtn.addEventListener('click', cancelRecordMode);

  // Cancel Rating Panel Click
  cancelRatingBtn.addEventListener('click', () => {
    // Return to recording state but reset end point to re-click it
    ratingPanel.classList.add('hidden');
    recordInstructionPanel.classList.remove('hidden');
    
    if (recordState.tempEndMarker) map.removeLayer(recordState.tempEndMarker);
    if (recordState.tempPolyline) map.removeLayer(recordState.tempPolyline);
    
    recordState.tempEndMarker = null;
    recordState.tempPolyline = null;
    recordState.endPoint = null;
    
    instructionText.innerHTML = '지도에서 길의 <strong>끝점</strong>을 터치해 주세요.';
    recordInstructionPanel.querySelector('.instruction-step-num').textContent = 'Step 2';
    
    map.getContainer().style.cursor = 'crosshair';
    map.on('click', onMapClick);
    map.on('mousemove', onMapMouseMove);
  });

  // Rating option buttons selection
  ratingOptionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = btn.getAttribute('data-rating');
      saveRecord(rating);
    });
  });

  // Legend Toggle Click
  legendToggleBtn.addEventListener('click', () => {
    legendPanel.classList.toggle('active');
  });
}

// --- UTILITIES ---
let toastTimeout = null;
function showToast(message) {
  clearTimeout(toastTimeout);
  toastMessageEl.textContent = message;
  toastEl.classList.remove('hidden');
  
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3500);
}
