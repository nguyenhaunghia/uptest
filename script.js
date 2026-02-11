const API_URL = 'https://script.google.com/macros/s/AKfycbxmPYkeDUa1p62OW1QjJNho6HU1y8XvQ3eUDk7p5rKYKLtA6GEh3yQ1411KAH9bzaxh/exec'; 

let appState = {
    allData: {}
};

const ICONS = {
    'Năm học': '🗓️',  // Calendar
    'Kỳ': '📂',      // Folder
    'Môn': '📘',      // Book
    'Khối': '🏗️',     // Building/Block
    'Đối tượng': '👥',// Group
    'Giáo viên': '👤' // Person
};

// ============================================================
// 1. CÁC HÀM UI CƠ BẢN (Loading, Toast, Accordion)
// ============================================================

function showLoading(msg = 'Đang xử lý...') {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `<div class="spinner"></div><div class="loading-text" id="loadingText"></div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('loadingText').innerText = msg;
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <i>${icon}</i>
        <span class="toast-message">${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function createAccordion(title, label, level) {
    const div = document.createElement('div');
    div.className = `level-group level-${level}`;
    
    // Lấy icon từ map, nếu không có thì dùng label cũ
    const icon = ICONS[label] || label; 
    
    // Giao diện: Icon + Title (Bỏ chữ label dài dòng)
    div.innerHTML = `
        <div class="level-header" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('show')">
            <span style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.2rem;">${icon}</span> 
                <span>${title}</span>
            </span>
            <small>▼</small>
        </div>
        <div class="level-content"></div>
    `;
    return div;
}

// ============================================================
// 2. AUTH & DATA FETCHING
// ============================================================

function checkAuth() {
    const userStr = localStorage.getItem('upfile_user');
    if (!userStr) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    const user = JSON.parse(userStr);
    
    // Hiển thị Header Info
    const nameEl = document.getElementById('displayUserName');
    if(nameEl) nameEl.innerText = user.Name;
    
    const roleEl = document.getElementById('displayUserRole');
    if (roleEl) {
        roleEl.innerText = user.Permissions;
        roleEl.className = user.Permissions === 'Admin' ? 'user-role-badge admin' : 'user-role-badge';
    }

    const avatarEl = document.getElementById('userAvatar');
    if(avatarEl) avatarEl.innerText = user.Name ? user.Name.charAt(0).toUpperCase() : 'U';

    const btnAssign = document.getElementById('btnAssign');
    if (btnAssign) {
        btnAssign.style.display = user.Permissions === 'Admin' ? 'inline-block' : 'none';
    }
}

function logout() {
    localStorage.removeItem('upfile_user');
    window.location.href = 'login.html';
}

async function fetchData() {
    try {
        const response = await fetch(API_URL + '?action=getData');
        return await response.json();
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        showToast("Không thể tải dữ liệu.", "error");
        return null;
    }
}

// ============================================================
// 3. XỬ LÝ ACTIONS (Upload, Download, Delete) - NO CONFIRM
// ============================================================

// --- Upload Direct ---
function triggerDirectUpload(profileID) {
    // 1. Lưu ProfileID vào hidden input
    const hiddenInput = document.getElementById('currentProfileID');
    if(hiddenInput) hiddenInput.value = profileID;
    
    // 2. Tìm input file ẩn và kích hoạt click
    const fileInput = document.getElementById('globalFileInput');
    if(fileInput) {
        fileInput.value = ''; // Reset để sự kiện onchange luôn kích hoạt
        fileInput.click();
    } else {
        alert('Lỗi: Không tìm thấy input file hệ thống!');
    }
}

async function handleFileSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const profileID = document.getElementById('currentProfileID').value;
        const user = JSON.parse(localStorage.getItem('upfile_user'));

        // Upload ngay lập tức (Không Confirm)
        showLoading(`Đang nộp: ${file.name}...`);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async function() {
                const base64 = reader.result.split(',')[1]; 
                
                const payload = {
                    action: 'uploadFile',
                    ProfileID: profileID,
                    fileName: file.name,
                    mimeType: file.type,
                    data: base64,
                    ActorID: user.UserID // Gửi ID người thực hiện để log
                };

                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                hideLoading();

                if (result.status === 'success') {
                    showToast('Đã nộp xong!', 'success');
                    loadDashboardData(); 
                } else {
                    showToast('Lỗi: ' + result.message, 'error');
                }
            };
        } catch (e) {
            hideLoading();
            showToast('Lỗi đọc file.', 'error');
        }
    }
}

// --- Download ---
async function downloadFile(fileId, profileID) {
    if (!fileId) return;
    
    // Gửi log về server
    const user = JSON.parse(localStorage.getItem('upfile_user'));
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'logClientAction',
            userID: user.UserID,
            act: 'DOWNLOAD',
            note: `Tải file ID: ${fileId} | ProfileID: ${profileID}`
        })
    });

    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    window.open(url, '_blank');
}

// --- Admin Delete (No Confirm) ---
async function adminDeleteRow(profileID) {
    showLoading("Đang xóa dòng...");
    const user = JSON.parse(localStorage.getItem('upfile_user'));
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'adminDeleteRow', 
                ProfileID: profileID,
                ActorID: user.UserID
            })
        });
        const res = await response.json();
        hideLoading();
        
        if(res.status === 'success') {
            showToast("Đã xóa dòng!", "success");
            loadDashboardData();
        } else {
            showToast("Lỗi: " + res.message, "error");
        }
    } catch(e) { 
        hideLoading(); 
        showToast("Lỗi kết nối", "error"); 
    }
}

async function adminDeleteFile(profileID) {
    showLoading("Đang xóa file...");
    const user = JSON.parse(localStorage.getItem('upfile_user'));
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'adminDeleteFile', 
                ProfileID: profileID, 
                ActorID: user.UserID
            })
        });
        const res = await response.json();
        hideLoading();
        
        if(res.status === 'success') {
            showToast("Đã xóa file!", "success");
            loadDashboardData();
        } else {
            showToast("Lỗi: " + res.message, "error");
        }
    } catch(e) { 
        hideLoading(); 
        showToast("Lỗi kết nối", "error"); 
    }
}

// ============================================================
// 4. RENDER DASHBOARD & LEVEL 7 (ICON BUTTONS)
// ============================================================

async function loadDashboardData() {
    const container = document.getElementById('dashboardContent');
    if (!container) return; 

    showLoading('Đang tải dữ liệu hồ sơ...');

    const rawData = await fetchData();
    hideLoading();

    if (!rawData) {
        container.innerHTML = '<div style="text-align:center; color:red;">Lỗi kết nối server!</div>';
        return;
    }
    
    appState.allData = rawData;
    renderDashboard(rawData);
}

function renderDashboard(data) {
    const { Profile, SchoolYear, Folder, Subject, Block, Object: ObjectList, DocType, User } = data;
    const currentUser = JSON.parse(localStorage.getItem('upfile_user'));
    const isAdmin = currentUser.Permissions === 'Admin';
    const container = document.getElementById('dashboardContent');
    
    container.innerHTML = ''; 

    // Join Dữ liệu
    let enrichedData = Profile.map(p => {
        if (!isAdmin && p.AccountUpdate != currentUser.UserID) return null;

        const folderObj = Folder.find(f => f.FolderID == p.FolderID);

        return {
            ...p,
            SchoolYearName: findName(SchoolYear, 'SchoolYearID', p.SchoolYearID, 'SchoolYearName'),
            FolderName: findName(Folder, 'FolderID', p.FolderID, 'FolderName'),
            SubjectName: findName(Subject, 'SubjectID', p.SubjectID, 'SubjectName'),
            BlockName: findName(Block, 'BlockID', p.BlockID, 'BlockName'),
            ObjectName: findName(ObjectList, 'ObjectID', p.ObjectID, 'ObjectName'),
            DocTypeName: findName(DocType, 'DocTypeID', p.DocTypeID, 'DocTypeName'),
            UserName: findName(User, 'UserID', p.AccountUpdate, 'Name'),
            isUploaded: p.FileID && p.FileID !== "",
            Deadline: folderObj && folderObj.Deadline ? folderObj.Deadline : null
        };
    }).filter(item => item !== null);

    updateStats(enrichedData);

    // Gom nhóm
    const groups = groupBy(enrichedData, 'SchoolYearName');
    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px;">Không có dữ liệu hiển thị.</div>';
        return;
    }

    // Render Accordion Nested
    for (const [year, yearItems] of Object.entries(groups)) {
        const lv1 = createAccordion(year, 'Năm học', 1);
        const folderGroups = groupBy(yearItems, 'FolderName');
        
        for (const [folder, folderItems] of Object.entries(folderGroups)) {
            const lv2 = createAccordion(folder, 'Kỳ', 2);
            const subjectGroups = groupBy(folderItems, 'SubjectName');
            
            for (const [sub, subItems] of Object.entries(subjectGroups)) {
                const lv3 = createAccordion(sub, 'Môn', 3);
                const blockGroups = groupBy(subItems, 'BlockName');
                
                for (const [block, blockItems] of Object.entries(blockGroups)) {
                    const lv4 = createAccordion(block, 'Khối', 4);
                    const objectGroups = groupBy(blockItems, 'ObjectName');
                    
                    for (const [obj, objItems] of Object.entries(objectGroups)) {
                        const lv5 = createAccordion(obj, 'Đối tượng', 5);
                        
                        if (isAdmin) {
                            const userGroups = groupBy(objItems, 'UserName');
                            for (const [usr, usrItems] of Object.entries(userGroups)) {
                                const lv6 = createAccordion(usr, 'Giáo viên', 6);
                                lv6.querySelector('.level-content').appendChild(renderLevel7(usrItems));
                                lv5.querySelector('.level-content').appendChild(lv6);
                            }
                        } else {
                            lv5.querySelector('.level-content').appendChild(renderLevel7(objItems));
                        }
                        
                        lv4.querySelector('.level-content').appendChild(lv5);
                    }
                    lv3.querySelector('.level-content').appendChild(lv4);
                }
                lv2.querySelector('.level-content').appendChild(lv3);
            }
            lv1.querySelector('.level-content').appendChild(lv2);
        }
        container.appendChild(lv1);
    }
}

// HÀM RENDER ITEM CUỐI CÙNG (CÓ NÚT ICON)
function renderLevel7(items) {
    const div = document.createElement('div');
    div.className = 'level-7-list';
    
    items.sort((a, b) => a.DocTypeID - b.DocTypeID);

    const currentUser = JSON.parse(localStorage.getItem('upfile_user'));
    const isAdmin = currentUser.Permissions === 'Admin';

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'doc-item';
        
        // Check Deadline
        let isExpired = false;
        if (item.Deadline) {
            const deadlineDate = new Date(item.Deadline);
            const today = new Date();
            deadlineDate.setHours(23, 59, 59);
            if (today > deadlineDate) isExpired = true;
        }

        const isUploaded = item.isUploaded;
        let infoHtml = ''; 
        let actionBtn = ''; 

        // 1. INFO HTML
        if (isUploaded) {
            const timeStr = formatDateTimeFull(item.TimeUpdate); 
            infoHtml = `<span class="status-text-small" style="color:#00b09b">✔ Đã nộp: ${timeStr}</span>`;
        } else {
            infoHtml = `<span class="status-text-small" style="color:#e74c3c">⏳ Chưa nộp</span>`;
        }
        
        // 2. ACTION BUTTONS (Icon Only)
        const downloadBtn = isUploaded 
            ? `<button class="btn-icon download" title="Tải về máy" onclick="downloadFile('${item.FileID}', '${item.ProfileID}')">📥</button>` 
            : '';

        if (isAdmin) {
            // ADMIN
            actionBtn += downloadBtn;
            if (isUploaded) {
                actionBtn += `<button class="btn-icon delete-file" title="Xóa file" onclick="adminDeleteFile('${item.ProfileID}')">🗑</button>`;
            }
            actionBtn += `<button class="btn-icon delete-row" title="Xóa dòng" onclick="adminDeleteRow('${item.ProfileID}')">✕</button>`;
        } 
        else {
            // USER
            if (isExpired) {
                if (isUploaded) {
                    actionBtn = `${downloadBtn} <span class="status-expired">⛔ Đã khóa</span>`;
                } else {
                    actionBtn = `<span class="status-expired">⛔ Quá hạn</span>`;
                }
            } else {
                if (isUploaded) {
                    // Đã nộp: Download + Edit
                    actionBtn = `
                        ${downloadBtn}
                        <button class="btn-icon edit" title="Thay thế file khác" onclick="triggerDirectUpload('${item.ProfileID}')">✎</button>
                    `;
                } else {
                    // Chưa nộp: Upload
                    actionBtn = `
                        <button class="btn-icon upload" title="Nộp file ngay" onclick="triggerDirectUpload('${item.ProfileID}')">📤</button>
                    `;
                }
            }
        }

        row.innerHTML = `
            <div style="flex: 1;">
                <div class="doc-info-title">
                    📄 ${item.DocTypeName} ${infoHtml}
                </div>
                <div style="font-size: 0.8rem; margin-top: 4px; color: #666;">
                    ${item.Note ? `<span>📝 ${item.Note}</span> • ` : ''}
                    ${item.Deadline ? `<span>📅 Hạn: ${formatDate(item.Deadline)}</span>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                ${actionBtn}
            </div>
        `;
        div.appendChild(row);
    });
    return div;
}

// ============================================================
// 5. HELPER FUNCTIONS
// ============================================================

function updateStats(data) {
    const total = data.length;
    const done = data.filter(i => i.isUploaded).length;
    
    if(document.getElementById('statTotal')) document.getElementById('statTotal').innerText = total;
    if(document.getElementById('statDone')) document.getElementById('statDone').innerText = done;
    if(document.getElementById('statPending')) document.getElementById('statPending').innerText = total - done;
}

function groupBy(xs, key) {
    return xs.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}

function findName(arr, idKey, idVal, nameKey) {
    if(!arr) return '';
    const f = arr.find(x => x[idKey] == idVal);
    return f ? f[nameKey] : `(${idVal})`;
}

function formatDate(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}

function formatDateTimeFull(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
}

// ============================================================
// 6. LOGIN PAGE LOGIC
// ============================================================

function handleLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    if (localStorage.getItem('upfile_user')) window.location.href = 'index.html';

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();

        showLoading('Đang xác thực...');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', username: u, password: p })
            });
            const result = await response.json();
            hideLoading();

            if (result.status === 'success') {
                const user = result.user;
                showToast(`Xin chào ${user.Name}`, 'success');

                if (user.Password === 'A12345678!') {
                    document.getElementById('changePassModal').classList.add('show');
                    localStorage.setItem('temp_user_id', user.UserID);
                } else {
                    localStorage.setItem('upfile_user', JSON.stringify(user));
                    setTimeout(() => window.location.href = 'index.html', 1000);
                }
            } else {
                showToast(result.message || 'Đăng nhập thất bại', 'error');
            }
        } catch (err) {
            hideLoading();
            showToast('Lỗi kết nối server!', 'error');
        }
    });

    const changeForm = document.getElementById('changePassForm');
    if (changeForm) {
        changeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Chức năng đổi mật khẩu cần gọi API (Chưa cài đặt Backend).');
            // Logic gọi API đổi pass tương tự login
        });
    }
}
