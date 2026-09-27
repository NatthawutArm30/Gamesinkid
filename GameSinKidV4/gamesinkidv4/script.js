// ============================================================
// GameSinKid Frontend - Connected to Supabase via Backend API
// VERSION 2.0 — Uses /api/ endpoints, NOT localStorage
// ============================================================
console.log('%c🔌 GameSinKid v2.0 — API Mode (Supabase)', 'color: #00ff88; font-size: 14px; font-weight: bold;');

const API_BASE = window.location.origin; // e.g. http://localhost:5000

const STORAGE = {
    token: "gamesinkidToken",
    user: "gamesinkidUser",
    draft: "gamesinkidDraft"
};

// ==================== API Helper ====================

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem(STORAGE.token);
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }
        return data;
    } catch (err) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
            throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่");
        }
        throw err;
    }
}

// ==================== Auth Helpers ====================

function getToken() {
    return localStorage.getItem(STORAGE.token);
}

function getCachedUser() {
    try {
        const data = localStorage.getItem(STORAGE.user);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function saveAuth(token, user) {
    localStorage.setItem(STORAGE.token, token);
    localStorage.setItem(STORAGE.user, JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem(STORAGE.token);
    localStorage.removeItem(STORAGE.user);
}

function isLoggedIn() {
    return !!getToken() && !!getCachedUser();
}

function getCurrentUser() {
    if (!isLoggedIn()) return null;
    return getCachedUser();
}

// ==================== Utility Functions ====================

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
}

function getInitials(name) {
    return String(name || "GS").trim().substring(0, 2).toUpperCase();
}

function getRoleName(role) {
    if (role === "admin") return "ผู้ดูแลระบบ (Admin)";
    if (role === "dev" || role === "developer") return "Developer";
    return "ผู้ใช้ทั่วไป";
}

function getCoverClass(category) {
    return {
        Action: "cover-blue",
        Adventure: "cover-green",
        RPG: "cover-purple",
        Horror: "cover-red",
        Other: "cover-orange"
    }[category] || "cover-purple";
}

function readJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ==================== Navbar ====================

function updateNavbar() {
    const navActions = document.getElementById("navActions");
    if (!navActions) return;

    const user = getCurrentUser();

    if (!user) {
        navActions.innerHTML = `
            <a href="upload.html" class="btn btn-primary">+ ฝากเกม</a>
            <a href="login.html" class="btn btn-outline">เข้าสู่ระบบ</a>
            <a href="register.html" class="btn btn-primary">สมัครสมาชิก</a>
        `;
        return;
    }

    const isAdmin = user.role === "admin";
    const isDev = user.role === "dev" || user.role === "developer";

    navActions.innerHTML = `
        <a href="${isAdmin ? 'admin.html' : 'profile.html'}" class="account-link">
            <span class="mini-avatar ${isAdmin ? 'avatar-admin' : ''}">${escapeHtml(getInitials(user.username))}</span>
            <span>${escapeHtml(user.username)}</span>
            <small class="${isAdmin ? 'role-tag-admin' : ''}">${escapeHtml(getRoleName(user.role))}</small>
        </a>
        ${isAdmin ? '<a href="admin.html" class="btn btn-admin-nav">🛡️ จัดการระบบ</a>' : ''}
        ${isDev || isAdmin ? '<a href="upload.html" class="btn btn-primary">+ ฝากเกม</a>' : ''}
        <button class="logout-button" id="logoutButton">ออกจากระบบ</button>
    `;

    document.getElementById("logoutButton")?.addEventListener("click", logout);
}

// ==================== Register (API) ====================

function handleRegister() {
    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const role = form.querySelector("input[name='role']:checked")?.value || "user";

        if (!firstName || !lastName || !username || !email || !password) {
            alert("กรุณากรอกข้อมูลให้ครบ");
            return;
        }
        if (password.length < 6) {
            alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
            return;
        }
        if (password !== confirmPassword) {
            alert("รหัสผ่านไม่ตรงกัน");
            return;
        }

        const submitBtn = form.querySelector("button[type='submit']");
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "กำลังสมัคร... ⏳";
        }

        try {
            const data = await apiRequest("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ firstName, lastName, username, email, password, role })
            });

            // Save token and user data
            saveAuth(data.token, data.user);
            alert(`สมัครสมาชิกแบบ ${getRoleName(role)} สำเร็จ!`);
            window.location.href = data.user.role === "dev" || data.user.role === "developer" ? "profile.html" : "games.html";
        } catch (err) {
            alert(`สมัครไม่สำเร็จ: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });
}

// ==================== Login (API) ====================

function handleLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const login = document.getElementById("loginUser").value.trim();
        const password = document.getElementById("loginPassword").value;

        if (!login || !password) {
            alert("กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน");
            return;
        }

        const submitBtn = form.querySelector("button[type='submit']");
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "กำลังเข้าสู่ระบบ... ⏳";
        }

        try {
            const data = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ login, password })
            });

            // Save token and user data
            saveAuth(data.token, data.user);
            alert("เข้าสู่ระบบสำเร็จ");
            window.location.href = data.user.role === "dev" || data.user.role === "developer" ? "profile.html" : "games.html";
        } catch (err) {
            alert(`เข้าสู่ระบบไม่สำเร็จ: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });

    document.getElementById("forgotPassword")?.addEventListener("click", event => {
        event.preventDefault();
        alert("ระบบตัวอย่าง: กรุณาติดต่อผู้ดูแลระบบเพื่อเปลี่ยนรหัสผ่าน");
    });
}

// ==================== Logout ====================

function logout() {
    clearAuth();
    window.location.href = "index.html";
}

// ==================== Require Developer or Admin ====================

function requireDeveloper() {
    const user = getCurrentUser();
    if (!user) {
        alert("กรุณาเข้าสู่ระบบก่อนฝากเกม");
        window.location.href = "login.html";
        return null;
    }
    if (user.role !== "dev" && user.role !== "developer" && user.role !== "admin") {
        alert("บัญชีผู้ใช้ทั่วไปไม่สามารถฝากเกมได้ กรุณาสมัครบัญชี Developer หรือ Admin");
        window.location.href = "profile.html";
        return null;
    }
    return user;
}

// ==================== Render Games (API) ====================

function renderGames() {
    const gameGrid = document.getElementById("gameGrid");
    if (!gameGrid) return;

    const searchInput = document.getElementById("gameSearch");
    const emptyState = document.getElementById("emptyState");
    const filters = document.querySelectorAll(".filter");
    let selectedCategory = "all";
    let allGames = [];

    async function fetchAndRender() {
        try {
            const params = new URLSearchParams();
            if (searchInput?.value?.trim()) {
                params.set("search", searchInput.value.trim());
            }
            const queryStr = params.toString() ? `?${params.toString()}` : "";
            const data = await apiRequest(`/api/games${queryStr}`);
            allGames = data.games || [];
        } catch (err) {
            console.error("Failed to fetch games:", err);
            allGames = [];
        }
        render();
    }

    function render() {
        const keyword = (searchInput?.value || "").toLowerCase().trim();
        const filteredGames = allGames.filter(game => {
            const text = `${game.name || game.title} ${game.developer} ${game.description} ${game.tags || ""}`.toLowerCase();
            return (selectedCategory === "all" || (game.category || "").toLowerCase() === selectedCategory.toLowerCase()) && text.includes(keyword);
        });

        gameGrid.innerHTML = "";

        if (!allGames.length || !filteredGames.length) {
            if (emptyState) {
                emptyState.innerHTML = !allGames.length ? `
                    <div>🎮</div><h3>ยังไม่มีเกมในระบบ</h3>
                    <p>เมื่อ Developer ฝากเกมและได้รับการอนุมัติ เกมจะปรากฏที่หน้านี้</p>
                    <a href="register.html" class="btn btn-primary">สมัครเป็น Developer</a>
                ` : `<div>⌕</div><h3>ไม่พบเกม</h3><p>ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>`;
                emptyState.style.display = "block";
            }
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        filteredGames.forEach(game => {
            const gameName = game.name || game.title;
            const coverClass = getCoverClass(game.category);
            const card = document.createElement("article");
            card.className = "game-card";
            const cover = game.cover
                ? `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(gameName)}">`
                : escapeHtml(getInitials(gameName));
            card.innerHTML = `
                <div class="game-cover ${escapeHtml(coverClass)}">${cover}</div>
                <div class="game-content">
                    <span class="game-tag">${escapeHtml(game.category)}</span>
                    <h3>${escapeHtml(gameName)}</h3>
                    <p>${escapeHtml(game.description)}</p>
                    <div class="game-bottom">
                        <span>by <a href="profile.html?user=${encodeURIComponent(game.developer)}">${escapeHtml(game.developer)}</a></span>
                        <a href="detail.html?game=${encodeURIComponent(game.id)}">ดูรายละเอียด →</a>
                    </div>
                </div>`;
            gameGrid.appendChild(card);
        });
    }

    // Debounce search
    let searchTimeout;
    searchInput?.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchAndRender, 300);
    });

    filters.forEach(filter => filter.addEventListener("click", () => {
        filters.forEach(item => item.classList.remove("active"));
        filter.classList.add("active");
        selectedCategory = filter.dataset.category;
        render();
    }));

    fetchAndRender();
}

// ==================== Render Detail (API) ====================

function renderDetail() {
    const detailName = document.getElementById("detailName");
    if (!detailName) return;

    const gameId = new URLSearchParams(location.search).get("game");
    if (!gameId) {
        detailName.textContent = "ไม่พบเกม";
        return;
    }

    (async () => {
        try {
            const data = await apiRequest(`/api/games/${gameId}`);
            const game = data.game;

            if (!game) {
                detailName.textContent = "ไม่พบเกม";
                document.getElementById("detailDescription").textContent = "ไม่พบข้อมูลเกมนี้";
                return;
            }

            const gameName = game.name || game.title;
            document.title = `GameSinkid | ${gameName}`;
            document.getElementById("detailCategory").textContent = game.category;
            detailName.textContent = gameName;
            document.getElementById("detailDeveloper").textContent = game.developer;
            document.getElementById("detailDescription").textContent = game.description;
            document.getElementById("sideCategory").textContent = game.category;
            document.getElementById("sideDeveloper").textContent = game.developer;
            document.getElementById("longDescription").textContent = game.description;

            const detailCover = document.getElementById("detailCover");
            const coverClass = getCoverClass(game.category);
            detailCover.className = `detail-cover ${coverClass}`;
            detailCover.innerHTML = game.cover
                ? `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(gameName)}">`
                : escapeHtml(getInitials(gameName));

            // Favorite button
            const user = getCurrentUser();
            const favoriteButton = document.getElementById("favoriteButton");

            if (favoriteButton && user) {
                try {
                    const favData = await apiRequest("/api/favorites");
                    const isFavorited = (favData.favorites || []).some(f => f.id == game.id);
                    favoriteButton.textContent = isFavorited ? "★ เอาออกจากรายการโปรด" : "☆ เพิ่มรายการโปรด";
                } catch {
                    favoriteButton.textContent = "☆ เพิ่มรายการโปรด";
                }

                favoriteButton.addEventListener("click", () => toggleFavorite(game.id));
            } else if (favoriteButton) {
                favoriteButton.addEventListener("click", () => {
                    alert("กรุณาเข้าสู่ระบบเพื่อเพิ่มรายการโปรด");
                    window.location.href = "login.html";
                });
            }

            // Open game button
            document.getElementById("openGameButton")?.addEventListener("click", async () => {
                if (!game.link) return alert("เกมนี้ยังไม่มีลิงก์");

                try {
                    await apiRequest(`/api/games/${game.id}/click`, { method: "POST" });
                } catch (err) {
                    console.warn("Click tracking failed:", err);
                }

                let url = game.link;
                if (!/^https?:\/\//i.test(url)) url = "https://" + url;
                window.open(url, "_blank", "noopener,noreferrer");
            });

        } catch (err) {
            detailName.textContent = "ไม่พบเกม";
            console.error("Detail error:", err);
        }
    })();
}

// ==================== Toggle Favorite (API) ====================

async function toggleFavorite(gameId) {
    const user = getCurrentUser();
    if (!user) {
        alert("กรุณาเข้าสู่ระบบเพื่อเพิ่มรายการโปรด");
        window.location.href = "login.html";
        return;
    }
    if (user.role === "dev" || user.role === "developer") {
        alert("Developer สามารถดูเกมและสถิติของตัวเองได้จากโปรไฟล์");
        return;
    }

    try {
        const data = await apiRequest("/api/favorites/toggle", {
            method: "POST",
            body: JSON.stringify({ gameId })
        });

        const favoriteButton = document.getElementById("favoriteButton");
        if (favoriteButton) {
            favoriteButton.textContent = data.favorited ? "★ เอาออกจากรายการโปรด" : "☆ เพิ่มรายการโปรด";
        }
        alert(data.message);
    } catch (err) {
        alert(`เกิดข้อผิดพลาด: ${err.message}`);
    }
}

// ==================== Upload / Publish Game (API) ====================

function handleUpload() {
    const form = document.getElementById("uploadForm");
    if (!form) return;
    const currentUser = requireDeveloper();
    if (!currentUser) return;

    const image = document.getElementById("gameImage");
    const fileName = document.getElementById("fileName");
    image?.addEventListener("change", () => {
        if (fileName) fileName.textContent = image.files.length ? `ไฟล์ที่เลือก: ${image.files[0].name}` : "ยังไม่ได้เลือกไฟล์";
    });

    // Draft save
    document.getElementById("draftButton")?.addEventListener("click", () => {
        const draft = {
            name: document.getElementById("gameName").value.trim(),
            category: document.getElementById("gameCategory").value,
            link: document.getElementById("gameLink").value.trim(),
            description: document.getElementById("gameDescription").value.trim(),
            tags: document.getElementById("gameTags")?.value.trim() || "",
            screenshotLink: document.getElementById("screenshotLink")?.value.trim() || ""
        };
        if (!draft.name) return alert("กรุณากรอกชื่อเกมก่อน");
        saveJSON(STORAGE.draft, draft);
        alert("บันทึกฉบับร่างแล้ว");
    });

    // Load draft if exists
    const draft = readJSON(STORAGE.draft, null);
    if (draft) {
        const fields = { gameName: draft.name, gameCategory: draft.category, gameLink: draft.link, gameDescription: draft.description, gameTags: draft.tags, screenshotLink: draft.screenshotLink };
        Object.entries(fields).forEach(([id, value]) => { const field = document.getElementById(id); if (field && value) field.value = value; });
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("gameName").value.trim();
        const category = document.getElementById("gameCategory").value;
        const link = document.getElementById("gameLink").value.trim();
        const description = document.getElementById("gameDescription").value.trim();
        const tags = document.getElementById("gameTags")?.value.trim() || "";
        const screenshotLink = document.getElementById("screenshotLink")?.value.trim() || "";

        if (!name || !category || !link || !description) return alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
        if (!/^https?:\/\//i.test(link)) return alert("ลิงก์เกมต้องขึ้นต้นด้วย http:// หรือ https://");

        const submitBtn = form.querySelector("button[type='submit']");
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "กำลังส่งข้อมูล... ⏳";
        }

        // Read cover image if provided
        const imageFile = image?.files?.[0];
        let coverData = screenshotLink || "";

        if (imageFile) {
            coverData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve("");
                reader.readAsDataURL(imageFile);
            });
        }

        try {
            const data = await apiRequest("/api/games", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    title: name,
                    category,
                    link,
                    description,
                    tags,
                    cover_image: coverData
                })
            });

            localStorage.removeItem(STORAGE.draft);

            alert(`ส่งเกม "${data.game?.title || name}" เรียบร้อยแล้ว!\n\nสถานะ: ⏳ รอการอนุมัติ (Pending Review)\n\nเกมนี้จะถูกส่งไปให้ผู้ดูแลระบบ (Admin) ตรวจสอบก่อน และจะยังไม่ปรากฏบนหน้าเว็บจนกว่าจะได้รับการอนุมัติ`);

            if (currentUser.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "profile.html";
            }
        } catch (err) {
            alert(`ไม่สำเร็จ: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });
}

// ==================== Delete Game (API) ====================

async function deleteGame(gameId, callback) {
    const user = getCurrentUser();
    if (!user || (user.role !== "dev" && user.role !== "developer" && user.role !== "admin")) {
        alert("คุณไม่มีสิทธิ์ลบเกมนี้");
        return;
    }

    const confirmed = confirm("ต้องการลบเกมนี้ใช่หรือไม่?\n\nข้อมูลเกมและสถิติของเกมนี้จะถูกลบออกจากระบบอย่างถาวร");
    if (!confirmed) return;

    try {
        const endpoint = user.role === "admin" ? `/api/admin/games/${gameId}` : `/api/games/${gameId}`;
        const data = await apiRequest(endpoint, { method: "DELETE" });
        alert(data.message || "ลบเกมเรียบร้อยแล้ว");
        if (typeof callback === "function") {
            callback();
        } else {
            renderProfile();
        }
    } catch (err) {
        alert(`ลบเกมไม่สำเร็จ: ${err.message}`);
    }
}

// Helper for status badge HTML
function getStatusBadge(status) {
    const s = String(status || "published").toLowerCase();
    if (s === "pending_review" || s === "pending") {
        return '<span class="status-badge badge-pending">⏳ รออนุมัติ</span>';
    } else if (s === "published") {
        return '<span class="status-badge badge-published">✅ เผยแพร่แล้ว</span>';
    } else if (s === "rejected") {
        return '<span class="status-badge badge-rejected">❌ ถูกปฏิเสธ</span>';
    } else {
        return `<span class="status-badge">${escapeHtml(s)}</span>`;
    }
}

// ==================== Render Profile (API) ====================

function renderProfile() {
    const page = document.getElementById("profilePage");
    if (!page) return;

    const loggedUser = getCurrentUser();
    const target = new URLSearchParams(location.search).get("user");
    const profileUsername = target || loggedUser?.username;

    if (!profileUsername) {
        page.innerHTML = `<section class="profile-empty"><h2>กรุณาเข้าสู่ระบบ</h2><p>เข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ</p><a href="login.html" class="btn btn-primary">เข้าสู่ระบบ</a></section>`;
        return;
    }

    // Show loading
    page.innerHTML = `<section class="profile-empty"><h2>กำลังโหลด...</h2><p>กำลังดึงข้อมูลโปรไฟล์</p></section>`;

    (async () => {
        try {
            const data = await apiRequest(`/api/profile/${encodeURIComponent(profileUsername)}`);
            const user = data.user;
            const stats = data.stats || {};
            const isOwner = loggedUser?.username === user.username;
            const isDev = user.dbRole === "developer" || user.role === "dev" || user.role === "developer" || user.role === "admin";

            if (isDev) {
                const games = data.games || [];
                const totalViews = stats.totalViews || 0;
                const totalClicks = stats.totalClicks || 0;
                const engagementRate = stats.engagementRate || 0;
                const roleBadgeClass = user.role === "admin" ? "admin" : "dev";
                const roleBadgeText = user.role === "admin" ? "ADMINISTRATOR" : "DEVELOPER";

                page.innerHTML = `
                    <section class="profile-hero ${roleBadgeClass}-profile">
                        <div class="profile-avatar ${user.role === 'admin' ? 'avatar-admin' : ''}">${escapeHtml(getInitials(user.username))}</div>
                        <div class="profile-main">
                            <span class="role-badge ${roleBadgeClass}">${roleBadgeText}</span>
                            <h1>${escapeHtml(user.username)}</h1>
                            <p>${escapeHtml(user.name || "")} · ${escapeHtml(user.email)}</p>
                            <small>สมาชิกตั้งแต่ ${new Date(user.createdAt || Date.now()).toLocaleDateString("th-TH")}</small>
                        </div>
                        <div class="profile-actions">
                            ${isOwner && user.role === 'admin' ? '<a href="admin.html" class="btn btn-admin-nav">🛡️ แดชบอร์ด Admin</a>' : ''}
                            ${isOwner ? '<a href="upload.html" class="btn btn-primary">+ ฝากเกม</a>' : ''}
                        </div>
                    </section>
                    <section class="stats-grid">
                        <div class="stat-card"><span>เกมทั้งหมด</span><strong>${stats.gamesCount || games.length}</strong><small>ผลงานที่สร้าง</small></div>
                        <div class="stat-card"><span>การเข้าชม</span><strong>${totalViews}</strong><small>รวมทุกเกม</small></div>
                        <div class="stat-card"><span>คลิกลิงก์เกม</span><strong>${totalClicks}</strong><small>ผู้ที่กดไปยังเกม</small></div>
                        <div class="stat-card"><span>การมีส่วนร่วม</span><strong>${engagementRate}%</strong><small>Click / View</small></div>
                    </section>
                    <section class="profile-section">
                        <div class="section-heading compact">
                            <span class="eyebrow">${roleBadgeText} GAMES</span>
                            <h2>เกมของ ${escapeHtml(user.username)}</h2>
                            <p>ดูผลงาน สถานะการอนุมัติ และสถิติของแต่ละเกม</p>
                        </div>
                        <div class="dev-game-list">
                            ${games.length ? games.map(game => {
                                const gameName = game.name || game.title;
                                const coverClass = getCoverClass(game.category);
                                const statusBadge = getStatusBadge(game.status);
                                return `
                                    <article class="dev-game-row">
                                        <div class="dev-game-cover ${escapeHtml(coverClass)}">
                                            ${game.cover ? `<img src="${escapeHtml(game.cover)}" alt="">` : escapeHtml(getInitials(gameName))}
                                        </div>
                                        <div class="dev-game-info">
                                            <div class="dev-game-title-row">
                                                <h3>${escapeHtml(gameName)}</h3>
                                                ${statusBadge}
                                            </div>
                                            <span>${escapeHtml(game.category)}</span>
                                            <p>${escapeHtml(game.description)}</p>
                                        </div>
                                        <div class="game-metrics">
                                            <strong>${Number(game.views || 0)}</strong><small>Views</small>
                                            <strong>${Number(game.clicks || 0)}</strong><small>Clicks</small>
                                        </div>
                                        <div class="dev-game-actions">
                                            <a class="btn btn-outline" href="detail.html?game=${encodeURIComponent(game.id)}">ดูเกม</a>
                                            ${isOwner || loggedUser?.role === 'admin' ? `<button type="button" class="btn btn-danger delete-game-button" data-game-id="${escapeHtml(game.id)}">ลบเกม</button>` : ''}
                                        </div>
                                    </article>`;
                            }).join("") : `
                                <div class="profile-empty">
                                    <h3>ยังไม่มีเกม</h3>
                                    <p>เริ่มฝากเกมแรกของคุณได้เลย</p>
                                    ${isOwner ? '<a href="upload.html" class="btn btn-primary">+ ฝากเกม</a>' : ''}
                                </div>
                            `}
                        </div>
                    </section>`;

                page.querySelectorAll(".delete-game-button").forEach(button => {
                    button.addEventListener("click", () => {
                        deleteGame(Number(button.dataset.gameId));
                    });
                });

            } else {
                // Regular user profile
                const favorites = data.favorites || [];

                page.innerHTML = `
                    <section class="profile-hero user-profile">
                        <div class="profile-avatar">${escapeHtml(getInitials(user.username))}</div>
                        <div class="profile-main">
                            <span class="role-badge user">USER</span>
                            <h1>${escapeHtml(user.username)}</h1>
                            <p>${escapeHtml(user.name || "")} · ${escapeHtml(user.email)}</p>
                            <small>สมาชิกตั้งแต่ ${new Date(user.createdAt || Date.now()).toLocaleDateString("th-TH")}</small>
                        </div>
                    </section>
                    <section class="stats-grid user-stats">
                        <div class="stat-card"><span>รายการโปรด</span><strong>${stats.favoritesCount || favorites.length}</strong><small>เกมที่บันทึกไว้</small></div>
                        <div class="stat-card"><span>ประเภทบัญชี</span><strong>USER</strong><small>ผู้ใช้ทั่วไป</small></div>
                    </section>
                    <section class="profile-section">
                        <div class="section-heading compact">
                            <span class="eyebrow">MY FAVORITES</span>
                            <h2>เกมที่ชอบ</h2>
                            <p>เกมที่คุณกดเพิ่มไว้ในรายการโปรด</p>
                        </div>
                        <div class="game-grid profile-game-grid">
                            ${favorites.length ? favorites.map(game => {
                                const gameName = game.name || game.title;
                                const coverClass = getCoverClass(game.category);
                                return `
                                    <article class="game-card">
                                        <div class="game-cover ${escapeHtml(coverClass)}">
                                            ${game.cover ? `<img src="${escapeHtml(game.cover)}" alt="">` : escapeHtml(getInitials(gameName))}
                                        </div>
                                        <div class="game-content">
                                            <span class="game-tag">${escapeHtml(game.category)}</span>
                                            <h3>${escapeHtml(gameName)}</h3>
                                            <p>${escapeHtml(game.description)}</p>
                                            <div class="game-bottom">
                                                <span>by ${escapeHtml(game.developer)}</span>
                                                <a href="detail.html?game=${encodeURIComponent(game.id)}">ดูรายละเอียด →</a>
                                            </div>
                                        </div>
                                    </article>`;
                            }).join("") : `
                                <div class="profile-empty">
                                    <h3>ยังไม่มีเกมในรายการโปรด</h3>
                                    <p>ไปหน้าเกมทั้งหมดเพื่อเลือกเกมที่คุณสนใจ</p>
                                    <a href="games.html" class="btn btn-primary">ดูเกมทั้งหมด</a>
                                </div>
                            `}
                        </div>
                    </section>`;
            }

        } catch (err) {
            page.innerHTML = `<section class="profile-empty"><h2>เกิดข้อผิดพลาด</h2><p>${escapeHtml(err.message)}</p><a href="index.html" class="btn btn-primary">กลับหน้าแรก</a></section>`;
        }
    })();
}

// ==================== Render Admin Page (API) ====================

function renderAdminPage() {
    const adminPage = document.getElementById("adminPage");
    if (!adminPage) return;

    const user = getCurrentUser();
    const loadingEl = document.getElementById("adminAuthLoading");
    const contentEl = document.getElementById("adminContent");
    const deniedEl = document.getElementById("adminDeniedCard");

    if (!user || user.role !== "admin") {
        if (loadingEl) loadingEl.style.display = "none";
        if (contentEl) contentEl.style.display = "none";
        if (deniedEl) deniedEl.style.display = "block";
        return;
    }

    if (loadingEl) loadingEl.style.display = "none";
    if (deniedEl) deniedEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";

    let allAdminGames = [];
    let allAdminUsers = [];
    let currentStatusFilter = "all";
    let currentCategoryFilter = "all";

    const gamesContainer = document.getElementById("adminGamesContainer");
    const gamesEmpty = document.getElementById("adminGamesEmpty");
    const searchInput = document.getElementById("adminGameSearch");
    const categorySelect = document.getElementById("adminCategoryFilter");
    const statusPills = document.querySelectorAll(".status-pill");

    // Modal elements
    const deleteModal = document.getElementById("deleteModal");
    const deleteModalText = document.getElementById("deleteModalText");
    const btnCancelDelete = document.getElementById("btnCancelDelete");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    let pendingDeleteId = null;

    if (btnCancelDelete && deleteModal) {
        btnCancelDelete.addEventListener("click", () => {
            deleteModal.style.display = "none";
            pendingDeleteId = null;
        });
    }

    if (btnConfirmDelete && deleteModal) {
        btnConfirmDelete.addEventListener("click", async () => {
            if (!pendingDeleteId) return;
            const targetId = pendingDeleteId;
            btnConfirmDelete.disabled = true;
            btnConfirmDelete.textContent = "กำลังลบ... ⏳";
            try {
                const res = await apiRequest(`/api/admin/games/${targetId}`, { method: "DELETE" });
                alert(res.message || "ลบเกมสำเร็จ");
                deleteModal.style.display = "none";
                pendingDeleteId = null;
                await loadAllData();
            } catch (err) {
                alert(`ลบเกมไม่สำเร็จ: ${err.message}`);
            } finally {
                btnConfirmDelete.disabled = false;
                btnConfirmDelete.textContent = "ลบเกมทันที";
            }
        });
    }

    async function loadStats() {
        try {
            const data = await apiRequest("/api/admin/stats");
            const s = data.stats || {};
            document.getElementById("valTotalGames").textContent = s.totalGames || 0;
            document.getElementById("valPendingGames").textContent = s.pendingGames || 0;
            document.getElementById("valPublishedGames").textContent = s.publishedGames || 0;
            document.getElementById("valRejectedGames").textContent = s.rejectedGames || 0;
            document.getElementById("valTotalDevs").textContent = s.totalDevs || 0;
            document.getElementById("valTotalViews").textContent = Number(s.totalViews || 0).toLocaleString();
            document.getElementById("valTotalClicks").textContent = Number(s.totalClicks || 0).toLocaleString();

            document.getElementById("badgePendingCount").textContent = s.pendingGames || 0;
            document.getElementById("badgePublishedCount").textContent = s.publishedGames || 0;
            document.getElementById("badgeRejectedCount").textContent = s.rejectedGames || 0;
            document.getElementById("tabGamesCount").textContent = s.totalGames || 0;

            // If there are pending games waiting, automatically filter to pending tab
            if ((s.pendingGames || 0) > 0 && currentStatusFilter === "all") {
                currentStatusFilter = "pending_review";
                statusPills.forEach(p => p.classList.toggle("active", p.dataset.status === "pending_review"));
            }
        } catch (err) {
            console.error("Failed to load admin stats:", err);
        }
    }

    async function loadGames() {
        try {
            const data = await apiRequest("/api/admin/games");
            allAdminGames = data.games || [];
            renderGamesList();
        } catch (err) {
            console.error("Failed to load admin games:", err);
            allAdminGames = [];
            renderGamesList();
        }
    }

    async function loadUsers() {
        try {
            const data = await apiRequest("/api/admin/users");
            allAdminUsers = data.users || [];
            document.getElementById("tabUsersCount").textContent = allAdminUsers.length;
            renderUsersList();
        } catch (err) {
            console.error("Failed to load admin users:", err);
            allAdminUsers = [];
            renderUsersList();
        }
    }

    function renderGamesList() {
        if (!gamesContainer) return;
        const keyword = (searchInput?.value || "").toLowerCase().trim();

        const filtered = allAdminGames.filter(game => {
            const matchesStatus = (currentStatusFilter === "all") || (game.status === currentStatusFilter);
            const matchesCategory = (currentCategoryFilter === "all") || (game.category.toLowerCase() === currentCategoryFilter.toLowerCase());
            const text = `${game.name || game.title} ${game.developer} ${game.developerEmail || ""} ${game.description}`.toLowerCase();
            const matchesKeyword = text.includes(keyword);
            return matchesStatus && matchesCategory && matchesKeyword;
        });

        gamesContainer.innerHTML = "";

        if (!filtered.length) {
            if (gamesEmpty) gamesEmpty.style.display = "block";
            return;
        }

        if (gamesEmpty) gamesEmpty.style.display = "none";

        filtered.forEach(game => {
            const gameName = game.name || game.title;
            const coverClass = getCoverClass(game.category);
            const statusBadge = getStatusBadge(game.status);
            const card = document.createElement("article");
            card.className = `admin-game-card status-border-${game.status || 'published'}`;

            const formattedDate = new Date(game.createdAt || Date.now()).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            card.innerHTML = `
                <div class="admin-game-row">
                    <div class="admin-game-media ${escapeHtml(coverClass)}">
                        ${game.cover ? `<img src="${escapeHtml(game.cover)}" alt="">` : escapeHtml(getInitials(gameName))}
                    </div>

                    <div class="admin-game-main">
                        <div class="admin-game-header">
                            <div>
                                <span class="admin-cat-pill">${escapeHtml(game.category)}</span>
                                <h3 class="admin-game-title">${escapeHtml(gameName)}</h3>
                            </div>
                            <div class="admin-status-wrapper">
                                ${statusBadge}
                            </div>
                        </div>

                        <div class="admin-meta-info">
                            <span>🧑‍💻 โดย: <strong>${escapeHtml(game.developer)}</strong> ${game.developerEmail ? `(${escapeHtml(game.developerEmail)})` : ''}</span>
                            <span>📅 ส่งเมื่อ: ${formattedDate}</span>
                        </div>

                        <p class="admin-game-desc">${escapeHtml(game.description)}</p>

                        <div class="admin-game-stats-row">
                            <span class="stat-pill">👁️ <strong>${game.views || 0}</strong> Views</span>
                            <span class="stat-pill">🔗 <strong>${game.clicks || 0}</strong> Clicks</span>
                            ${game.link ? `<a href="${escapeHtml(game.link)}" target="_blank" rel="noopener" class="btn-test-link">🔗 ทดสอบเปิดลิงก์เกม ↗</a>` : '<span class="text-muted">ไม่มีลิงก์</span>'}
                        </div>
                    </div>

                    <div class="admin-game-controls">
                        ${game.status !== 'published' ? `
                            <button class="btn-adm btn-approve" data-id="${game.id}" data-name="${escapeHtml(gameName)}">
                                🟢 อนุมัติ (Publish)
                            </button>
                        ` : ''}

                        ${game.status !== 'rejected' ? `
                            <button class="btn-adm btn-reject" data-id="${game.id}" data-name="${escapeHtml(gameName)}">
                                ❌ ปฏิเสธ (Reject)
                            </button>
                        ` : ''}

                        ${game.status === 'published' ? `
                            <button class="btn-adm btn-revert" data-id="${game.id}" data-name="${escapeHtml(gameName)}">
                                ⏳ พักการเผยแพร่
                            </button>
                        ` : ''}

                        <a href="detail.html?game=${encodeURIComponent(game.id)}" class="btn-adm btn-preview" target="_blank">
                            🔍 ดูหน้าเกม
                        </a>

                        <button class="btn-adm btn-delete-danger" data-id="${game.id}" data-name="${escapeHtml(gameName)}">
                            🗑️ ลบเกม
                        </button>
                    </div>
                </div>
            `;

            gamesContainer.appendChild(card);
        });

        // Attach action event listeners
        gamesContainer.querySelectorAll(".btn-approve").forEach(btn => {
            btn.addEventListener("click", () => updateGameStatus(btn.dataset.id, "published", btn.dataset.name));
        });

        gamesContainer.querySelectorAll(".btn-reject").forEach(btn => {
            btn.addEventListener("click", () => updateGameStatus(btn.dataset.id, "rejected", btn.dataset.name));
        });

        gamesContainer.querySelectorAll(".btn-revert").forEach(btn => {
            btn.addEventListener("click", () => updateGameStatus(btn.dataset.id, "pending_review", btn.dataset.name));
        });

        gamesContainer.querySelectorAll(".btn-delete-danger").forEach(btn => {
            btn.addEventListener("click", () => {
                pendingDeleteId = btn.dataset.id;
                if (deleteModalText) {
                    deleteModalText.textContent = `คุณแน่ใจหรือไม่ว่าต้องการลบเกม "${btn.dataset.name}" ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`;
                }
                if (deleteModal) deleteModal.style.display = "flex";
            });
        });
    }

    async function updateGameStatus(gameId, newStatus, gameTitle) {
        const statusText = {
            published: "อนุมัติให้เผยแพร่",
            rejected: "ปฏิเสธการเผยแพร่",
            pending_review: "ส่งกลับไปรอการตรวจสอบ"
        }[newStatus] || newStatus;

        const confirmed = confirm(`ยืนยันการ${statusText}เกม "${gameTitle}" ใช่หรือไม่?`);
        if (!confirmed) return;

        try {
            const res = await apiRequest(`/api/admin/games/${gameId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });

            alert(res.message || `อัปเดตสถานะเกมเป็น "${statusText}" สำเร็จ`);
            await loadAllData();
        } catch (err) {
            alert(`เกิดข้อผิดพลาด: ${err.message}`);
        }
    }

    function renderUsersList() {
        const tbody = document.getElementById("adminUsersTableBody");
        const emptyEl = document.getElementById("adminUsersEmpty");
        const userSearch = document.getElementById("adminUserSearch");
        if (!tbody) return;

        const keyword = (userSearch?.value || "").toLowerCase().trim();
        const filtered = allAdminUsers.filter(u => {
            const text = `${u.name || ""} ${u.username || ""} ${u.email || ""} ${u.role || ""}`.toLowerCase();
            return text.includes(keyword);
        });

        tbody.innerHTML = "";

        if (!filtered.length) {
            if (emptyEl) emptyEl.style.display = "block";
            return;
        }

        if (emptyEl) emptyEl.style.display = "none";

        filtered.forEach(u => {
            const tr = document.createElement("tr");
            const roleBadge = u.role === "admin"
                ? '<span class="role-badge admin">ADMIN</span>'
                : (u.role === "developer" ? '<span class="role-badge dev">DEVELOPER</span>' : '<span class="role-badge user">USER</span>');

            const joinDate = new Date(u.createdAt || Date.now()).toLocaleDateString("th-TH");

            tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <span class="mini-avatar ${u.role === 'admin' ? 'avatar-admin' : ''}">${escapeHtml(getInitials(u.username))}</span>
                        <div>
                            <strong>${escapeHtml(u.username)}</strong>
                            <small>${escapeHtml(u.name || "")}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(u.email)}</td>
                <td>${roleBadge}</td>
                <td><strong>${u.gamesCount || 0}</strong> เกม</td>
                <td>${joinDate}</td>
                <td>
                    <a href="profile.html?user=${encodeURIComponent(u.username)}" class="btn-table-action" target="_blank">
                        ดูโปรไฟล์ →
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function loadAllData() {
        await Promise.all([loadStats(), loadGames(), loadUsers()]);
    }

    // Event: Search game input
    let gameSearchTimer;
    searchInput?.addEventListener("input", () => {
        clearTimeout(gameSearchTimer);
        gameSearchTimer = setTimeout(renderGamesList, 250);
    });

    // Event: User search input
    let userSearchTimer;
    document.getElementById("adminUserSearch")?.addEventListener("input", () => {
        clearTimeout(userSearchTimer);
        userSearchTimer = setTimeout(renderUsersList, 250);
    });

    // Event: Category filter select
    categorySelect?.addEventListener("change", () => {
        currentCategoryFilter = categorySelect.value;
        renderGamesList();
    });

    // Event: Status filter pills
    statusPills.forEach(pill => {
        pill.addEventListener("click", () => {
            statusPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentStatusFilter = pill.dataset.status;
            renderGamesList();
        });
    });

    // Event: KPI card quick click filter
    document.getElementById("kpiPendingGames")?.addEventListener("click", () => {
        statusPills.forEach(p => p.classList.toggle("active", p.dataset.status === "pending_review"));
        currentStatusFilter = "pending_review";
        renderGamesList();
    });

    document.getElementById("kpiPublishedGames")?.addEventListener("click", () => {
        statusPills.forEach(p => p.classList.toggle("active", p.dataset.status === "published"));
        currentStatusFilter = "published";
        renderGamesList();
    });

    document.getElementById("kpiRejectedGames")?.addEventListener("click", () => {
        statusPills.forEach(p => p.classList.toggle("active", p.dataset.status === "rejected"));
        currentStatusFilter = "rejected";
        renderGamesList();
    });

    document.getElementById("kpiTotalGames")?.addEventListener("click", () => {
        statusPills.forEach(p => p.classList.toggle("active", p.dataset.status === "all"));
        currentStatusFilter = "all";
        renderGamesList();
    });

    // Event: Refresh button
    document.getElementById("btnRefreshData")?.addEventListener("click", async () => {
        const btn = document.getElementById("btnRefreshData");
        if (btn) btn.textContent = "กำลังรีเฟรช... ⏳";
        await loadAllData();
        if (btn) btn.textContent = "🔄 รีเฟรชข้อมูล";
    });

    // Event: Main Tab navigation (Games vs Users)
    const adminTabs = document.querySelectorAll(".admin-tab");
    adminTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            adminTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const targetTab = tab.dataset.tab;

            document.getElementById("paneGames").style.display = targetTab === "games" ? "block" : "none";
            document.getElementById("paneUsers").style.display = targetTab === "users" ? "block" : "none";
        });
    });

    // Initial load
    loadAllData();
}

// ==================== Initialization ====================

document.addEventListener("DOMContentLoaded", () => {
    updateNavbar();
    handleRegister();
    handleLogin();
    handleUpload();
    renderGames();
    renderDetail();
    renderProfile();
    renderAdminPage();
});

// ==================== Translations ====================

const TRANSLATIONS = {
    en: {
        nav_home: "Home",
        nav_games: "All Games",
        nav_about: "About Us",
        nav_how: "How It Works",
        btn_upload: "+ Submit Game",
        btn_login: "Log In",
        btn_register: "Register",
        btn_logout: "Log Out",
        btn_profile: "Profile",
        hero_eyebrow: "GAME PUBLISHING PLATFORM",
        hero_title_1: "Publish Your Game",
        hero_title_2: "To The World",
        hero_desc: "GameSinkid is a platform for game developers to showcase their work, share game details, and link to external publishing platforms.",
        hero_btn_explore: "Explore Games →",
        hero_btn_start: "Start Publishing",
        search_placeholder: "Search games...",
        filter_all: "All",
        role_user: "User",
        role_dev: "Developer"
    },
    th: {
        nav_home: "หน้าแรก",
        nav_games: "เกมทั้งหมด",
        nav_about: "เกี่ยวกับเรา",
        nav_how: "วิธีใช้งาน",
        btn_upload: "+ ฝากเกม",
        btn_login: "เข้าสู่ระบบ",
        btn_register: "สมัครสมาชิก",
        btn_logout: "ออกจากระบบ",
        btn_profile: "โปรไฟล์",
        hero_eyebrow: "GAME PUBLISHING PLATFORM",
        hero_title_1: "ฝากเกมของคุณ",
        hero_title_2: "ให้โลกได้รู้จัก",
        hero_desc: "GameSinkid คือพื้นที่สำหรับนักพัฒนาเกม ใช้เผยแพร่ผลงาน แสดงรายละเอียดเกม และแชร์ลิงก์ไปยังแพลตฟอร์มที่เกมถูกเผยแพร่",
        hero_btn_explore: "ดูเกมทั้งหมด →",
        hero_btn_start: "เริ่มฝากเกม",
        search_placeholder: "ค้นหาเกม...",
        filter_all: "ทั้งหมด",
        role_user: "ผู้ใช้ทั่วไป",
        role_dev: "Developer"
    }
};
