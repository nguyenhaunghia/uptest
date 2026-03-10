const API_URL = 'https://script.google.com/macros/s/AKfycbx5XX2B1axnps6JpIGhhFQM6EHOpDf_13NOvs04CZbQCsTRD7cmiXdeuUgBz4Sjx6R6/exec'; 

let appState = {
    allData: {}
};

const ICONS = {
    'Năm học': '🗓️',
    'Kỳ': '📂',
    'Môn': '📘',
    'Khối': '🏗️',
    'Đối tượng': '👥',
    'Giáo viên': '👤'
};

// ============================================================
// 1. CÁC HÀM UI CƠ BẢN
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

    toast.innerHTML = `<i>${icon}</i><span class="toast-message">${message}</span><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- SYSTEM MODAL (CHỈ DÙNG ĐỂ XÁC NHẬN) ---
function initSystemModal() {
    if (document.getElementById('sys-modal')) return;
    const modalHtml = `
    <div id="sys-modal" class="modal" style="z-index: 99999;">
        <div class="sys-modal-box">
            <div id="sys-icon" class="sys-modal-icon-box sys-type-warning">❓</div>
            <h3 id="sys-title" class="sys-modal-title">Xác nhận</h3>
            <p id="sys-msg" class="sys-modal-msg">...</p>
            <div class="sys-modal-actions">
                <button id="sys-btn-cancel" class="btn btn-secondary">Hủy bỏ</button>
                <button id="sys-btn-ok" class="btn btn-primary">Đồng ý</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
initSystemModal();

function sysConfirm(title, msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById('sys-modal');
        const titleEl = document.getElementById('sys-title');
        const msgEl = document.getElementById('sys-msg');
        const btnOk = document.getElementById('sys-btn-ok');
        const btnCancel = document.getElementById('sys-btn-cancel');

        titleEl.innerText = title;
        msgEl.innerHTML = msg;
        
        modal.classList.add('show');

        btnOk.onclick = () => { modal.classList.remove('show'); resolve(true); };
        btnCancel.onclick = () => { modal.classList.remove('show'); resolve(false); };
    });
}

// ============================================================
// 2. HELPER & AUTH
// ============================================================

function createAccordion(title, label, level) {
    const div = document.createElement('div');
    div.className = `level-group level-${level}`;
    const icon = ICONS[label] || label; 
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

function checkAuth() {
    const userStr = localStorage.getItem('upfile_user');
    if (!userStr) {
        if (!window.location.pathname.includes('login.html')) window.location.href = 'login.html';
        return;
    }
    const user = JSON.parse(userStr);
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
// 3. ACTIONS (Index 1 & 2)
// ============================================================

function triggerDirectUpload(profileID) {
    const hiddenInput = document.getElementById('currentProfileID');
    if(hiddenInput) hiddenInput.value = profileID;
    const fileInput = document.getElementById('globalFileInput');
    if(fileInput) { fileInput.value = ''; fileInput.click(); } 
    else { showToast('Lỗi: Không tìm thấy input file hệ thống!', 'error'); }
}

async function handleFileSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const profileID = document.getElementById('currentProfileID').value;
        const user = JSON.parse(localStorage.getItem('upfile_user'));

        showLoading(`Đang nộp: ${file.name}...`);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async function() {
                const base64 = reader.result.split(',')[1]; 
                const payload = {
                    action: 'uploadFile', ProfileID: profileID,
                    fileName: file.name, mimeType: file.type,
                    data: base64, ActorID: user.UserID
                };
                const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
                const result = await response.json();
                hideLoading();
                if (result.status === 'success') {
                    showToast('Đã nộp xong!', 'success'); loadDashboardData(); 
                } else { showToast('Lỗi: ' + result.message, 'error'); }
            };
        } catch (e) { hideLoading(); showToast('Lỗi đọc file.', 'error'); }
    }
}

async function downloadFile(fileId, profileID) {
    if (!fileId) return;
    const user = JSON.parse(localStorage.getItem('upfile_user'));

    // Bật Loading vì chuyển Base64 sẽ mất vài giây
    showLoading('Đang lấy dữ liệu file từ Server...'); 
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'downloadFile', 
                fileId: fileId, 
                userID: user.UserID, 
                profileID: profileID 
            })
        });
        
        const result = await response.json();
        hideLoading();

        if (result.status === 'success') {
            
            // =========================================================
            // [UPDATE] XỬ LÝ ĐỔI TÊN FILE TỰ ĐỘNG
            // =========================================================
            let finalFileName = result.fileName; // Mặc định lấy tên gốc nếu không tìm thấy dữ liệu
            
            if (typeof appState !== 'undefined' && appState.allData && appState.allData.Profile) {
                const data = appState.allData;
                const profile = data.Profile.find(p => p.ProfileID === profileID);
                
                if (profile) {
                    // Ánh xạ dữ liệu theo đúng cấu trúc bạn yêu cầu
                    const syName = findName(data.SchoolYear, 'SchoolYearID', profile.SchoolYearID, 'SchoolYearName') || '';
                    const fdNick = findName(data.Folder, 'FolderID', profile.FolderID, 'FolderNickName') || '';
                    const dtNick = findName(data.DocType, 'DocTypeID', profile.DocTypeID, 'DocTypeNickName') || '';
                    const subNick = findName(data.Subject, 'SubjectID', profile.SubjectID, 'SubjectNickName') || '';
                    const blkNick = findName(data.Block, 'BlockID', profile.BlockID, 'BlockNickName') || '';
                    const objNick = findName(data.Object, 'ObjectID', profile.ObjectID, 'ObjectNickName') || '';
                    const remName = findName(data.User, 'UserID', profile.AccountUpdate, 'ReminiscentName') || '';

                    // Lấy phần đuôi mở rộng của file gốc (VD: .pdf, .docx, .png)
                    let extension = "";
                    const dotIndex = result.fileName.lastIndexOf('.');
                    if (dotIndex !== -1) extension = result.fileName.substring(dotIndex);
                    
                    // Ghép chuỗi theo đúng Format: SchoolYear FolderNickName-DocTypeNickName-SubjectNickName-BlockNickName-ObjectNickName-ReminiscentName
                    //let newName = `${syName} ${fdNick} - ${dtNick} - ${subNick} ${blkNick}.${objNick} - ${remName}`;
                
                    let newName = `${dtNick} - ${subNick} ${blkNick}.${objNick} - ${remName.toUpperCase()}`;
                    // Xóa các ký tự đặc biệt không được phép đặt tên file trong Windows/Mac
                    newName = newName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
                    
                    finalFileName = newName + extension;
                }
            }
            // =========================================================

            // Dịch ngược Base64 thành file
            const byteCharacters = atob(result.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: result.mimeType});

            // Tạo link ảo và tự động click để tải về máy
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = finalFileName; // <-- Thay tên gốc bằng tên đã được format
            document.body.appendChild(a);
            a.click();
            
            // Dọn dẹp
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            showToast('Lỗi tải file: ' + result.message, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('Lỗi kết nối khi tải file', 'error');
    }
}






async function adminDeleteRow(profileID) {
    const isAgree = await sysConfirm('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa dòng dữ liệu này?<br>File đính kèm cũng sẽ bị xóa.');
    if (!isAgree) return;

    showLoading("Đang xóa dòng...");
    const user = JSON.parse(localStorage.getItem('upfile_user'));
    try {
        const response = await fetch(API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'adminDeleteRow', ProfileID: profileID, ActorID: user.UserID })
        });
        const res = await response.json();
        hideLoading();
        if(res.status === 'success') { showToast("Đã xóa dòng!", "success"); loadDashboardData(); } 
        else { showToast("Lỗi: " + res.message, "error"); }
    } catch(e) { hideLoading(); showToast("Lỗi kết nối", "error"); }
}

async function adminDeleteFile(profileID) {
    const isAgree = await sysConfirm('Xác nhận xóa file', 'Bạn có chắc chắn muốn xóa file đính kèm này?');
    if (!isAgree) return;

    showLoading("Đang xóa file...");
    const user = JSON.parse(localStorage.getItem('upfile_user'));
    try {
        const response = await fetch(API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'adminDeleteFile', ProfileID: profileID, ActorID: user.UserID })
        });
        const res = await response.json();
        hideLoading();
        if(res.status === 'success') { showToast("Đã xóa file!", "success"); loadDashboardData(); } 
        else { showToast("Lỗi: " + res.message, "error"); }
    } catch(e) { hideLoading(); showToast("Lỗi kết nối", "error"); }
}

// ============================================================
// 4. RENDER DASHBOARD
// ============================================================

async function loadDashboardData() {
    const container = document.getElementById('dashboardContent');
    if (!container) return; 
    showLoading('Đang tải dữ liệu hồ sơ...');
    const rawData = await fetchData();
    hideLoading();
    if (!rawData) { container.innerHTML = '<div style="text-align:center; color:red;">Lỗi kết nối server!</div>'; return; }
    appState.allData = rawData;
    renderDashboard(rawData);
}

function renderDashboard(data) {
    const { Profile, SchoolYear, Folder, Subject, Block, Object: ObjectList, DocType, User } = data;
    const currentUser = JSON.parse(localStorage.getItem('upfile_user'));
    const isAdmin = currentUser.Permissions === 'Admin';
    const container = document.getElementById('dashboardContent');
    container.innerHTML = ''; 

    // --- BỔ SUNG YÊU CẦU: Phân quyền Supervisor (AccountPreview) ---
    let enrichedData = Profile.map(p => {
        let isUploader = p.AccountUpdate == currentUser.UserID;
        let isPreviewer = p.AccountPreview && p.AccountPreview.toString().split(',').includes(String(currentUser.UserID));
        
        let roleContext = isAdmin ? 'admin' : (isUploader ? 'uploader' : (isPreviewer ? 'previewer' : 'none'));

        if (roleContext === 'none') return null; // Không có quyền thì không hiển thị

        const folderObj = Folder.find(f => f.FolderID == p.FolderID);
        return {
            ...p,
            RoleContext: roleContext, // Lưu lại quyền để dùng lúc vẽ nút
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
    const groups = groupBy(enrichedData, 'SchoolYearName');
    if (Object.keys(groups).length === 0) { container.innerHTML = '<div style="text-align:center; padding:50px;">Không có dữ liệu hiển thị.</div>'; return; }

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

function renderLevel7(items) {
    const div = document.createElement('div');
    div.className = 'level-7-list';
    items.sort((a, b) => a.DocTypeID - b.DocTypeID);

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'doc-item';
        let isExpired = false;
        if (item.Deadline) {
            const deadlineDate = new Date(item.Deadline);
            const today = new Date();
            deadlineDate.setHours(23, 59, 59);
            if (today > deadlineDate) isExpired = true;
        }
        const isUploaded = item.isUploaded;
        let infoHtml = ''; let actionBtn = ''; 

        if (isUploaded) {
            const timeStr = formatDateTimeFull(item.TimeUpdate); 
            infoHtml = `<span class="status-text-small" style="color:#00b09b">✔ Đã nộp: ${timeStr}</span>`;
        } else {
            infoHtml = `<span class="status-text-small" style="color:#e74c3c">⏳ Chưa nộp</span>`;
        }
        
        const downloadBtn = isUploaded ? `<button class="btn-icon download" title="Tải về máy" onclick="downloadFile('${item.FileID}', '${item.ProfileID}')">📥</button>` : '';

        // --- BỔ SUNG YÊU CẦU: Render Action Btn theo RoleContext ---
        if (item.RoleContext === 'admin') {
            actionBtn += downloadBtn;
            if (isUploaded) actionBtn += `<button class="btn-icon delete-file" title="Xóa file" onclick="adminDeleteFile('${item.ProfileID}')">🗑</button>`;
            actionBtn += `<button class="btn-icon delete-row" title="Xóa dòng" onclick="adminDeleteRow('${item.ProfileID}')">✕</button>`;
        } 
        else if (item.RoleContext === 'uploader') {
            if (isExpired) {
                if (isUploaded) actionBtn = `${downloadBtn} <span class="status-expired">⛔ Đã khóa</span>`;
                else actionBtn = `<span class="status-expired">⛔ Quá hạn</span>`;
            } else {
                if (isUploaded) actionBtn = `${downloadBtn} <button class="btn-icon edit" title="Thay thế file khác" onclick="triggerDirectUpload('${item.ProfileID}')">✎</button>`;
                else actionBtn = `<button class="btn-icon upload" title="Nộp file ngay" onclick="triggerDirectUpload('${item.ProfileID}')">📤</button>`;
            }
        }
        else if (item.RoleContext === 'previewer') {
            actionBtn = isUploaded ? downloadBtn : `<span class="status-text-small" style="color:#aaa;">Chưa có file</span>`;
        }

        row.innerHTML = `
            <div style="flex: 1;">
                <div class="doc-info-title">📄 ${item.DocTypeName} ${infoHtml}</div>
                <div style="font-size: 0.8rem; margin-top: 4px; color: #666;">
                    ${item.Note ? `<span>📝 ${item.Note}</span> • ` : ''}
                    ${item.Deadline ? `<span>📅 Hạn: ${formatDate(item.Deadline)}</span>` : ''}
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">${actionBtn}</div>
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
function groupBy(xs, key) { return xs.reduce(function(rv, x) { (rv[x[key]] = rv[x[key]] || []).push(x); return rv; }, {}); }
function findName(arr, idKey, idVal, nameKey) { if(!arr) return ''; const f = arr.find(x => x[idKey] == idVal); return f ? f[nameKey] : `(${idVal})`; }
function formatDate(dateStr) { if(!dateStr) return ''; const d = new Date(dateStr); return d.toLocaleDateString('vi-VN'); }
function formatDateTimeFull(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; }

// ============================================================
// 6. LOGIN LOGIC
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
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: u, password: p }) });
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
            } else { showToast(result.message || 'Đăng nhập thất bại', 'error'); }
        } catch (err) { hideLoading(); showToast('Lỗi kết nối server!', 'error'); }
    });

    const changeForm = document.getElementById('changePassForm');
    if (changeForm) {
        changeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Chức năng đổi mật khẩu cần gọi API (Chưa cài đặt Backend).');
        });
    }
}

async function handleCredentialResponse(response) {
    showLoading('Đang xác thực Google...');
    try {
        const apiResponse = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'googleLogin', token: response.credential }) });
        const result = await apiResponse.json();
        hideLoading();
        if (result.status === 'success') {
            const user = result.user;
            showToast(`Xin chào ${user.Name}`, 'success');
            localStorage.setItem('upfile_user', JSON.stringify(user));
            setTimeout(() => window.location.href = 'index.html', 1000);
        } else { showToast(result.message, 'error'); }
    } catch (err) { hideLoading(); showToast('Lỗi kết nối server!', 'error'); }
}

// ============================================================
// 7. LOGIC TRANG PHÂN CÔNG (ASSIGN.HTML)
// ============================================================

async function initAssignPage() {
    checkAuth();
    showLoading('Đang tải dữ liệu...');
    
    const data = await fetchData();
    hideLoading();
    if (!data) return;

    fillSelect('selYear', data.SchoolYear, 'SchoolYearID', 'SchoolYearName');
    fillSelect('selFolder', data.Folder, 'FolderID', 'FolderName');
    fillSelect('selSubject', data.Subject, 'SubjectID', 'SubjectName');
    fillSelect('selBlock', data.Block, 'BlockID', 'BlockName');
    fillSelect('selObject', data.Object, 'ObjectID', 'ObjectName');

    const teachers = data.User.filter(u => u.Permissions !== 'Admin');
    const docTypes = data.DocType;

    renderTeacherTable(teachers, docTypes);

    document.querySelectorAll('.required-select').forEach(sel => {
        sel.addEventListener('change', checkPart1Status);
    });
    document.getElementById('teacherBody').addEventListener('change', checkPart2Status);
}

function checkPart1Status() {
    const year = document.getElementById('selYear').value;
    const folder = document.getElementById('selFolder').value;
    const subject = document.getElementById('selSubject').value;
    const block = document.getElementById('selBlock').value;
    const object = document.getElementById('selObject').value;
    const part2 = document.getElementById('part2Container');
    const btnSave = document.getElementById('btnSave');

    if (year && folder && subject && block && object) {
        part2.classList.remove('section-disabled');
    } else {
        part2.classList.add('section-disabled');
        btnSave.disabled = true;
    }
}

function checkPart2Status() {
    const btnSave = document.getElementById('btnSave');
    let hasSelection = false;
    const rows = document.querySelectorAll('#teacherBody tr');

    for (let row of rows) {
        const teacherChk = row.querySelector('.chk-teacher-row');
        if (teacherChk && teacherChk.checked) {
            const docChecked = row.querySelector('.chk-doctype:checked');
            if (docChecked) {
                hasSelection = true; break;
            }
        }
    }
    btnSave.disabled = !hasSelection;
}

function fillSelect(elementId, dataArray, valueKey, textKey) {
    const sel = document.getElementById(elementId);
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Chọn --</option>';
    if(dataArray) {
        dataArray.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item[valueKey]; opt.innerText = item[textKey];
            sel.appendChild(opt);
        });
    }
}

// --- BỔ SUNG YÊU CẦU: Thêm Cột Chọn Người Giám Sát Dạng Dropdown Multi-Select ---
function renderTeacherTable(teachers, docTypes) {
    const tbody = document.getElementById('teacherBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    teachers.forEach(t => {
        const tr = document.createElement('tr');
        
        // Render DocType
        let docTypeHtml = `<div class="doctype-grid">`;
        docTypes.forEach(dt => {
            const uniqueID = `chk-${t.UserID}-${dt.DocTypeID}`;
            docTypeHtml += `
                <div class="doctype-chip">
                    <input type="checkbox" id="${uniqueID}" class="chk-doctype" value="${dt.DocTypeID}" data-teacher="${t.UserID}">
                    <label for="${uniqueID}">${dt.DocTypeName}</label>
                </div>
            `;
        });
        docTypeHtml += `</div>`;

        // Render Người Giám Sát
        let supervisorHtml = `
            <div class="multi-select-container">
                <div class="multi-select-btn" onclick="this.nextElementSibling.classList.toggle('show'); event.stopPropagation();">
                    <span class="sel-text">Chọn GS...</span> <span>▼</span>
                </div>
                <div class="multi-select-dropdown" onclick="event.stopPropagation();">
        `;
        teachers.forEach(gs => {
            if (gs.UserID !== t.UserID) { // Khóa không cho tự giám sát bản thân
                const chkId = `gs-${t.UserID}-${gs.UserID}`;
                supervisorHtml += `
                    <label class="multi-select-item" for="${chkId}">
                        <input type="checkbox" id="${chkId}" class="chk-supervisor" value="${gs.UserID}">
                        ${gs.Name}
                    </label>
                `;
            }
        });
        supervisorHtml += `</div></div>`;

        // ĐÃ SỬA TẠI ĐÂY: Đổi vị trí docTypeHtml lên trước supervisorHtml
        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="chk-teacher-row" value="${t.UserID}">
            </td>
            <td>
                <div style="font-weight:600; color:var(--primary);">${t.Name}</div>
                <div class="text-muted" style="font-size:0.8rem;">${t.Account}</div>
            </td>
            <td>${docTypeHtml}</td>
            <td>${supervisorHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    // Bắt sự kiện check row tự động check doctype
    document.querySelectorAll('.chk-teacher-row').forEach(chk => {
        chk.addEventListener('change', function() {
            const row = this.closest('tr');
            const docChecks = row.querySelectorAll('.chk-doctype');
            docChecks.forEach(d => d.checked = this.checked);
            checkPart2Status();
        });
    });

    // Cập nhật text hiển thị số lượng khi chọn giám sát
    document.querySelectorAll('.chk-supervisor').forEach(chk => {
        chk.addEventListener('change', function() {
            const container = this.closest('.multi-select-container');
            const checked = container.querySelectorAll('.chk-supervisor:checked');
            const textSpan = container.querySelector('.sel-text');
            textSpan.innerHTML = checked.length === 0 ? 'Chọn GS...' : `<b style="color:var(--primary)">Đã chọn (${checked.length})</b>`;
        });
    });

    // Ẩn dropdown khi click ra ngoài
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown.show').forEach(d => d.classList.remove('show'));
        }
    });
}

// --- BỔ SUNG YÊU CẦU: Thu thập AccountPreview khi lưu ---
async function handleSaveAssign() {
    const year = document.getElementById('selYear').value;
    const folder = document.getElementById('selFolder').value;
    const subject = document.getElementById('selSubject').value;
    const block = document.getElementById('selBlock').value;
    const object = document.getElementById('selObject').value;

    let assignments = [];
    const rows = document.querySelectorAll('#teacherBody tr');

    rows.forEach(row => {
        const teacherChk = row.querySelector('.chk-teacher-row');
        if (teacherChk && teacherChk.checked) {
            const teacherID = teacherChk.value;
            const docTypeChks = row.querySelectorAll('.chk-doctype:checked');
            
            // Lấy danh sách ID người giám sát
            const supervisorChks = row.querySelectorAll('.chk-supervisor:checked');
            const previewers = Array.from(supervisorChks).map(c => c.value).join(',');

            docTypeChks.forEach(dt => {
                assignments.push({
                    SchoolYearID: year, FolderID: folder,
                    SubjectID: subject, BlockID: block,
                    ObjectID: object, TeacherID: teacherID,
                    DocTypeID: dt.value,
                    AccountPreview: previewers // Chuyển chuỗi ID giám sát về backend
                });
            });
        }
    });

    if (assignments.length === 0) { 
        showToast('Chưa chọn giáo viên hoặc nội dung nào!', 'error'); 
        return; 
    }

    const isAgree = await sysConfirm(
        "Xác nhận Lưu",
        `Bạn sắp phân công <b>${assignments.length}</b> nhiệm vụ cho giáo viên.<br>Dữ liệu sẽ được ghi nhận vào hệ thống.`
    );

    if (!isAgree) return; 

    showLoading('Đang lưu phân công...');
    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'assignTasks', assignments: assignments }) });
        const result = await response.json();
        hideLoading();
        if (result.status === 'success') {
            showToast(`Đã tạo thành công ${result.count} mục phân công!`, 'success');
            document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
            // Reset text dropdown giám sát
            document.querySelectorAll('.sel-text').forEach(el => el.innerHTML = 'Chọn GS...');
            checkPart2Status();
        } else { 
            showToast('Lỗi: ' + result.message, 'error'); 
        }
    } catch (e) { 
        hideLoading(); 
        showToast('Lỗi kết nối server', 'error'); 
    }
}









