
const API_URL = "https://script.google.com/macros/s/AKfycbzAvo8s2ROG1Rns8pZkTaU_ZcWZMm11_WfBuN7S99T-wltF1kf5fcRiJSIFEUoqB3LI/exec"; 


const app = {
    callAPI: async function(action, params = {}) {
        const payload = { action: action, ...params };
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error("Lỗi API:", error); // Xem lỗi trong Console (F12)
            alert("Lỗi kết nối: " + error);
            return { success: false };
        }
    },

    checkAuth: function() {
        const u = localStorage.getItem('upfile_user');
        if (!u) { window.location.href = 'login.html'; return null; }
        return JSON.parse(u);
    },

    logout: function() {
        localStorage.removeItem('upfile_user');
        window.location.href = 'login.html';
    },

    // Hàm an toàn để so sánh ID (Chuyển hết về String)
    safeString: function(val) {
        if (val === null || val === undefined) return "";
        return String(val).trim();
    },

    formatDate: function(d) {
        if (!d) return '';
        const date = new Date(d);
        return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
    }
};

const ui = {
    loading: (show) => document.getElementById('loading').classList.toggle('hidden', !show),
    showModal: (id) => document.getElementById(id).classList.remove('hidden'),
    closeModal: (id) => document.getElementById(id).classList.add('hidden')
};
