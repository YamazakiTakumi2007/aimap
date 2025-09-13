class MapApp {
    constructor() {
        this.map = null;
        this.pins = new Map();
        this.currentPinId = null;
        this.isEditing = false;

        this.init();
    }

    init() {
        this.initMap();
        this.loadPinsFromStorage();
        this.bindEvents();
        this.updatePinCount();
    }

    initMap() {
        this.map = L.map('map').setView([35.6762, 139.6503], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.map.on('click', (e) => {
            this.addPin(e.latlng.lat, e.latlng.lng);
        });
    }

    generateUniqueId() {
        return 'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addPin(lat, lng, data = null) {
        const pinId = data ? data.id : this.generateUniqueId();

        const marker = L.marker([lat, lng]).addTo(this.map);

        if (data) {
            marker.bindPopup(this.createPopupContent(data));
            this.pins.set(pinId, { ...data, marker });
            this.updateSidebar();
            this.updatePinCount();
        } else {
            this.currentPinId = pinId;
            this.showCommentModal(lat, lng);

            this.pins.set(pinId, {
                id: pinId,
                lat: lat,
                lng: lng,
                marker: marker,
                title: '',
                description: '',
                createdAt: new Date().toISOString()
            });
        }

        marker.on('click', () => {
            const pinData = this.pins.get(pinId);
            if (pinData.title) {
                this.showPinInfo(pinData);
            }
        });

        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            this.deletePin(pinId);
        });
    }

    createPopupContent(data) {
        return `
            <div class="popup-content">
                <h4>${data.title}</h4>
                <p>${data.description || '説明なし'}</p>
                <small>${this.formatDate(data.createdAt)}</small>
            </div>
        `;
    }

    showCommentModal(lat, lng, editData = null) {
        const modal = document.getElementById('commentModal');
        const title = document.getElementById('pinTitle');
        const description = document.getElementById('pinDescription');
        const modalTitle = document.getElementById('modalTitle');
        const modalLat = document.getElementById('modalLat');
        const modalLng = document.getElementById('modalLng');

        modalTitle.textContent = editData ? 'ピン情報を編集' : 'ピン情報を入力';
        title.value = editData ? editData.title : '';
        description.value = editData ? editData.description : '';
        modalLat.textContent = lat.toFixed(6);
        modalLng.textContent = lng.toFixed(6);

        this.isEditing = !!editData;

        modal.classList.add('show');
        title.focus();

        this.updateCharCount();
    }

    hideCommentModal() {
        const modal = document.getElementById('commentModal');
        modal.classList.remove('show');

        if (!this.isEditing && this.currentPinId) {
            const pinData = this.pins.get(this.currentPinId);
            if (pinData && !pinData.title) {
                this.deletePin(this.currentPinId);
            }
        }

        this.currentPinId = null;
        this.isEditing = false;
    }

    showPinInfo(pinData) {
        const modal = document.getElementById('pinInfoModal');
        const title = document.getElementById('infoPinTitle');
        const description = document.getElementById('infoPinDescription');
        const date = document.getElementById('infoPinDate');
        const location = document.getElementById('infoPinLocation');

        title.textContent = pinData.title;
        description.textContent = pinData.description || '説明なし';
        date.textContent = this.formatDate(pinData.createdAt);
        location.textContent = `${pinData.lat.toFixed(6)}, ${pinData.lng.toFixed(6)}`;

        this.currentPinId = pinData.id;
        modal.classList.add('show');
    }

    hidePinInfoModal() {
        const modal = document.getElementById('pinInfoModal');
        modal.classList.remove('show');
        this.currentPinId = null;
    }

    savePin(formData) {
        if (!this.currentPinId) return;

        const pinData = this.pins.get(this.currentPinId);
        if (!pinData) return;

        const updatedData = {
            ...pinData,
            title: formData.title,
            description: formData.description,
            updatedAt: new Date().toISOString()
        };

        this.pins.set(this.currentPinId, updatedData);

        updatedData.marker.bindPopup(this.createPopupContent(updatedData));

        this.savePinsToStorage();
        this.updateSidebar();
        this.hideCommentModal();
        this.showNotification('ピンが保存されました', 'success');
    }

    deletePin(pinId) {
        const pinData = this.pins.get(pinId);
        if (!pinData) return;

        if (confirm('このピンを削除しますか？')) {
            this.map.removeLayer(pinData.marker);
            this.pins.delete(pinId);
            this.savePinsToStorage();
            this.updateSidebar();
            this.updatePinCount();
            this.hidePinInfoModal();
            this.showNotification('ピンが削除されました', 'success');
        }
    }

    clearAllPins() {
        if (this.pins.size === 0) {
            this.showNotification('削除するピンがありません', 'info');
            return;
        }

        if (confirm(`すべてのピン（${this.pins.size}個）を削除しますか？`)) {
            this.pins.forEach(pinData => {
                this.map.removeLayer(pinData.marker);
            });
            this.pins.clear();
            this.savePinsToStorage();
            this.updateSidebar();
            this.updatePinCount();
            this.showNotification('すべてのピンが削除されました', 'success');
        }
    }

    editPin() {
        if (!this.currentPinId) return;

        const pinData = this.pins.get(this.currentPinId);
        if (!pinData) return;

        this.hidePinInfoModal();
        this.showCommentModal(pinData.lat, pinData.lng, pinData);
    }

    savePinsToStorage() {
        const pinsArray = Array.from(this.pins.values()).map(pin => ({
            id: pin.id,
            lat: pin.lat,
            lng: pin.lng,
            title: pin.title,
            description: pin.description,
            createdAt: pin.createdAt,
            updatedAt: pin.updatedAt
        }));

        try {
            localStorage.setItem('mapPins', JSON.stringify(pinsArray));
        } catch (error) {
            console.error('Failed to save pins to localStorage:', error);
            this.showNotification('データの保存に失敗しました', 'error');
        }
    }

    loadPinsFromStorage() {
        try {
            const savedPins = localStorage.getItem('mapPins');
            if (savedPins) {
                const pinsArray = JSON.parse(savedPins);
                pinsArray.forEach(pinData => {
                    this.addPin(pinData.lat, pinData.lng, pinData);
                });
            }
        } catch (error) {
            console.error('Failed to load pins from localStorage:', error);
            this.showNotification('データの読み込みに失敗しました', 'error');
        }
    }

    updateSidebar() {
        const pinList = document.getElementById('pinList');

        if (this.pins.size === 0) {
            pinList.innerHTML = '<p class="no-pins">まだピンが配置されていません</p>';
            return;
        }

        const pinsArray = Array.from(this.pins.values())
            .filter(pin => pin.title)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        pinList.innerHTML = pinsArray.map(pin => `
            <div class="pin-item" data-pin-id="${pin.id}">
                <h4>${pin.title}</h4>
                <p>${pin.description ? pin.description.substring(0, 50) + (pin.description.length > 50 ? '...' : '') : '説明なし'}</p>
                <small>${this.formatDate(pin.createdAt)}</small>
            </div>
        `).join('');

        pinList.querySelectorAll('.pin-item').forEach(item => {
            item.addEventListener('click', () => {
                const pinId = item.dataset.pinId;
                const pinData = this.pins.get(pinId);
                if (pinData) {
                    this.map.setView([pinData.lat, pinData.lng], 15);
                    pinData.marker.openPopup();
                }
            });
        });
    }

    searchPins() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        const pinItems = document.querySelectorAll('.pin-item');

        pinItems.forEach(item => {
            const title = item.querySelector('h4').textContent.toLowerCase();
            const description = item.querySelector('p').textContent.toLowerCase();

            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });

        if (searchTerm === '') {
            pinItems.forEach(item => {
                item.style.display = 'block';
            });
        }
    }

    updatePinCount() {
        const count = Array.from(this.pins.values()).filter(pin => pin.title).length;
        document.getElementById('pinCount').textContent = count;
    }

    updateCharCount() {
        const title = document.getElementById('pinTitle');
        const description = document.getElementById('pinDescription');
        const titleCount = document.getElementById('titleCount');
        const descCount = document.getElementById('descCount');

        if (title && titleCount) {
            titleCount.textContent = `${title.value.length}/50`;
        }
        if (description && descCount) {
            descCount.textContent = `${description.value.length}/200`;
        }
    }

    validateInput(data) {
        if (!data.title.trim()) {
            this.showNotification('タイトルを入力してください', 'error');
            return false;
        }
        if (data.title.length > 50) {
            this.showNotification('タイトルは50文字以内で入力してください', 'error');
            return false;
        }
        if (data.description.length > 200) {
            this.showNotification('説明は200文字以内で入力してください', 'error');
            return false;
        }
        return true;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    bindEvents() {
        const commentForm = document.getElementById('commentForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const editPinBtn = document.getElementById('editPinBtn');
        const deletePinBtn = document.getElementById('deletePinBtn');
        const closeInfoBtn = document.getElementById('closeInfoBtn');

        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                title: document.getElementById('pinTitle').value.trim(),
                description: document.getElementById('pinDescription').value.trim()
            };

            if (this.validateInput(formData)) {
                this.savePin(formData);
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.hideCommentModal();
        });

        clearAllBtn.addEventListener('click', () => {
            this.clearAllPins();
        });

        searchInput.addEventListener('input', () => {
            this.searchPins();
        });

        searchBtn.addEventListener('click', () => {
            this.searchPins();
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchPins();
            }
        });

        editPinBtn.addEventListener('click', () => {
            this.editPin();
        });

        deletePinBtn.addEventListener('click', () => {
            if (this.currentPinId) {
                this.deletePin(this.currentPinId);
            }
        });

        closeInfoBtn.addEventListener('click', () => {
            this.hidePinInfoModal();
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'pinTitle' || e.target.id === 'pinDescription') {
                this.updateCharCount();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    if (modal.id === 'commentModal') {
                        this.hideCommentModal();
                    } else if (modal.id === 'pinInfoModal') {
                        this.hidePinInfoModal();
                    }
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const commentModal = document.getElementById('commentModal');
                const infoModal = document.getElementById('pinInfoModal');

                if (commentModal.classList.contains('show')) {
                    this.hideCommentModal();
                } else if (infoModal.classList.contains('show')) {
                    this.hidePinInfoModal();
                }
            }
        });

        window.addEventListener('click', (e) => {
            const commentModal = document.getElementById('commentModal');
            const infoModal = document.getElementById('pinInfoModal');

            if (e.target === commentModal) {
                this.hideCommentModal();
            } else if (e.target === infoModal) {
                this.hidePinInfoModal();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MapApp();
});