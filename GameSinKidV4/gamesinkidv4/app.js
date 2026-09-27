const express = require('express');
const cors = require('cors');
const { resolveEnv, createAdminClient } = require('@supabase/server/core');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
//ประกาศ required ของแต่ละ library

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'gamesinkid_default_secret_key_2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log all requests so we can debug
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

const staticOptions = {
    etag: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
};

// Serve static files with NO CACHE (forces browser to load fresh script.js)
app.use(express.static(__dirname, staticOptions));
app.use(express.static(path.join(__dirname, 'html'), staticOptions));

// Supabase Client Setup via @supabase/server (ตัวเชื่อมต่อระบบ Login Register)
const { data: supabaseEnv, error: envError } = resolveEnv();

let supabase = null;
let supabaseConfigured = false;

if (envError) {
    console.warn('⚠️ Supabase environment error:', envError.message);
} else {
    try {
        supabase = createAdminClient(supabaseEnv);
        supabaseConfigured = true;
        console.log('✅ Supabase admin client created via @supabase/server');
        seedMasterAdmin();
    } catch (err) {
        console.warn('⚠️ Supabase client initialization warning:', err.message);
    }
}

// Seed or ensure Master Admin account exists
async function seedMasterAdmin() {
    if (!supabase || !supabaseConfigured) return;
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@gamesinkid.com';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

        const { data: existingAdmin } = await supabase
            .from('users')
            .select('id, email, display_name, role')
            .or(`email.eq.${adminEmail},display_name.eq.${adminUsername}`)
            .maybeSingle();

        if (existingAdmin) {
            if (existingAdmin.role !== 'admin') {
                await supabase
                    .from('users')
                    .update({ role: 'admin' })
                    .eq('id', existingAdmin.id);
                console.log(`🛡️ Updated existing user "${existingAdmin.display_name}" to Admin role`);
            }
        } else {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(adminPassword, salt);
            const { error: createError } = await supabase
                .from('users')
                .insert([
                    {
                        name: 'Master Admin',
                        display_name: adminUsername,
                        email: adminEmail,
                        password_hash: passwordHash,
                        role: 'admin'
                    }
                ]);

            if (!createError) {
                console.log(`👑 Master Admin account initialized (User: ${adminUsername} / Pass: ${adminPassword})`);
            }
        }
    } catch (err) {
        console.warn('⚠️ Master admin seed notice:', err.message);
    }
}

const isSupabaseConfigured = () => supabaseConfigured;

// Check Database Connection
const checkDbConnection = (req, res, next) => {
    if (!supabase || !isSupabaseConfigured()) {
        return res.status(503).json({
            error: 'Database not configured yet',
            message: 'กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SECRET_KEY ในไฟล์ .env ก่อนเรียกใช้งาน'
        });
    }
    next();
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = decoded;
        next();
    });
};

// Middleware for track users
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (!err) {
                req.user = decoded;
            }
            next();
        });
    } else {
        next();
    }
};

// Check Role
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
            return res.status(403).json({ error: `Permission denied. Required role: ${role}` });
        }
        next();
    };
};

const formatUser = (u) => ({
    id: u.id,
    name: u.name,
    username: u.display_name || u.name,
    email: u.email,
    role: u.role === 'developer' ? 'dev' : u.role,
    dbRole: u.role,
    avatar: u.avatar || null,
    bio: u.bio || '',
    website: u.website || '',
    createdAt: u.created_at
});

// root API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'GameSinKid API',
        version: '1.0.0',
        supabaseConfigured: isSupabaseConfigured(),
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send('GameSinKid Backend API is running. Access endpoints via /api/...');
});

// Register
app.post('/api/auth/register', checkDbConnection, async (req, res) => {
    try {
        const { firstName, lastName, username, email, password, role } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedUsername = username.trim();
        const fullName = `${firstName || ''} ${lastName || ''}`.trim() || normalizedUsername;
        const mappedRole = role === 'dev' || role === 'developer' ? 'developer' : 'user';

        // Check if user already exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, email, display_name')
            .or(`email.eq.${normalizedEmail},display_name.eq.${normalizedUsername}`)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            return res.status(500).json({ error: checkError.message });
        }

        if (existingUser) {
            if (existingUser.email === normalizedEmail) {
                return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
            }
            return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                {
                    name: fullName,
                    display_name: normalizedUsername,
                    email: normalizedEmail,
                    password_hash: passwordHash,
                    role: mappedRole
                }
            ])
            .select()
            .single();

        if (insertError) {
            return res.status(500).json({ error: insertError.message });
        }

        const token = jwt.sign(
            { id: newUser.id, username: newUser.display_name, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'สมัครสมาชิกสำเร็จ',
            token,
            user: formatUser(newUser)
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
});

// Login
app.post('/api/auth/login', checkDbConnection, async (req, res) => {
    try {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน' });
        }

        const cleanLogin = login.trim().toLowerCase();

        // Search user by email or display_name
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('*')
            .or(`email.ilike.${cleanLogin},display_name.ilike.${cleanLogin}`)
            .maybeSingle();

        if (findError || !user) {
            return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้หรืออีเมลนี้' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.display_name, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: formatUser(user)
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});
// api login กับ register ก็คือ รับค่าที่เป็น token มาก่อนแล้วก็ตรวจสอบผ่าน middleware แล้วก็ check user โดยการ query เข้าไปใน database เพื่อให้รู้ว่าusername นั้นใช้ไปยังและมีอยู่แล้วมั๊ย ถ้าหาไม่เจอ ก็จะแสดง error 401 ออกมา
// Get Current User Profile
app.get('/api/auth/me', checkDbConnection, authenticateToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
        }

        res.json({ user: formatUser(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/categories', checkDbConnection, async (req, res) => {
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        res.json({ categories: categories || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Games (With Search and Category Filters)
app.get('/api/games', checkDbConnection, async (req, res) => {
    try {
        const { search, category, developer } = req.query;

        let query = supabase
            .from('games')
            .select(`
                id,
                title,
                description,
                cover_image,
                download_url,
                link,
                views,
                clicks,
                price,
                status,
                created_at,
                category:categories(id, name),
                developer:users(id, name, display_name)
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: games, error } = await query;
        if (error) throw error;

        // Transform data to match frontend structure
        let formattedGames = (games || []).map(g => ({
            id: g.id,
            name: g.title,
            title: g.title,
            description: g.description,
            category: g.category?.name || 'Other',
            categoryId: g.category?.id || null,
            developer: g.developer?.display_name || g.developer?.name || 'Unknown',
            developerId: g.developer?.id,
            cover: g.cover_image || '',
            link: g.link || g.download_url || '',
            views: g.views || 0,
            clicks: g.clicks || 0,
            createdAt: g.created_at
        }));

        if (category && category !== 'all') {
            formattedGames = formattedGames.filter(g => g.category.toLowerCase() === category.toLowerCase());
        }

        if (developer) {
            formattedGames = formattedGames.filter(g => g.developer.toLowerCase() === developer.toLowerCase());
        }

        res.json({ games: formattedGames });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Game by ID (and Increment View Count)
app.get('/api/games/:id', checkDbConnection, optionalAuth, async (req, res) => {
    try {
        const gameId = req.params.id;

        const { data: game, error } = await supabase
            .from('games')
            .select(`
                id,
                title,
                description,
                cover_image,
                download_url,
                link,
                views,
                clicks,
                price,
                status,
                created_at,
                developer_id,
                category:categories(id, name),
                developer:users(id, name, display_name)
            `)
            .eq('id', gameId)
            .single();

        if (error || !game) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลเกม' });
        }

        // If game is not published, only allow developer owner or admin to view
        if (game.status !== 'published') {
            const isOwner = req.user && req.user.id == game.developer_id;
            const isAdmin = req.user && req.user.role === 'admin';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ 
                    error: 'เกมนี้อยู่ระหว่างรอการตรวจสอบและอนุมัติจาก Admin จึงยังไม่เปิดให้เข้าชมสู่สาธารณะ' 
                });
            }
        }

        // Increment views in DB
        const newViews = (game.views || 0) + 1;
        await supabase
            .from('games')
            .update({ views: newViews })
            .eq('id', gameId);

        const formattedGame = {
            id: game.id,
            name: game.title,
            title: game.title,
            description: game.description,
            category: game.category?.name || 'Other',
            categoryId: game.category?.id || null,
            developer: game.developer?.display_name || game.developer?.name || 'Unknown',
            developerId: game.developer?.id,
            cover: game.cover_image || '',
            link: game.link || game.download_url || '',
            status: game.status || 'published',
            views: newViews,
            clicks: game.clicks || 0,
            createdAt: game.created_at
        };

        res.json({ game: formattedGame });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create / Publish Game for developer (MUST go through Admin approval first)
app.post('/api/games', checkDbConnection, authenticateToken, requireRole('developer'), async (req, res) => {
    try {
        const { name, title, description, category, categoryId, link, download_url, cover, cover_image, tags } = req.body;
        const gameTitle = title || name;
        const gameLink = link || download_url;
        const gameCover = cover_image || cover;

        if (!gameTitle || !description || !gameLink) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อเกม รายละเอียด และลิงก์เกมให้ครบถ้วน' });
        }

        // Resolve Category ID
        let resolvedCatId = categoryId;
        if (!resolvedCatId && category) {
            const { data: cat } = await supabase
                .from('categories')
                .select('id')
                .ilike('name', category)
                .maybeSingle();
            resolvedCatId = cat?.id || null;
        }

        // ทุกเกมที่ส่งมาต้องเริ่มต้นที่สถานะ 'pending_review' (รอ Admin อนุมัติ) เสมอ
        const initialStatus = 'pending_review';

        const { data: newGame, error: insertError } = await supabase
            .from('games')
            .insert([
                {
                    developer_id: req.user.id,
                    title: gameTitle,
                    description,
                    category_id: resolvedCatId,
                    cover_image: gameCover || null,
                    link: gameLink,
                    download_url: gameLink,
                    status: initialStatus,
                    views: 0,
                    clicks: 0
                }
            ])
            .select()
            .single();

        if (insertError) throw insertError;

        res.status(201).json({
            message: `ส่งเกม "${newGame.title}" เรียบร้อยแล้ว ขณะนี้อยู่ในสถานะ "รอการอนุมัติจาก Admin"`,
            game: newGame
        });
    } catch (err) {
        console.error('Create game error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Game (Developer Owner Only)
app.delete('/api/games/:id', checkDbConnection, authenticateToken, requireRole('developer'), async (req, res) => {
    try {
        const gameId = req.params.id;

        // Check ownership
        const { data: game, error: checkError } = await supabase
            .from('games')
            .select('id, developer_id, title')
            .eq('id', gameId)
            .single();

        if (checkError || !game) {
            return res.status(404).json({ error: 'ไม่พบเกมที่ต้องการลบ' });
        }

        if (game.developer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบเกมนี้' });
        }

        const { error: deleteError } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);

        if (deleteError) throw deleteError;

        res.json({ message: `ลบเกม "${game.title}" เรียบร้อยแล้ว` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Increment Game Click Count
app.post('/api/games/:id/click', checkDbConnection, async (req, res) => {
    try {
        const gameId = req.params.id;

        const { data: game, error: findError } = await supabase
            .from('games')
            .select('clicks')
            .eq('id', gameId)
            .single();

        if (findError || !game) {
            return res.status(404).json({ error: 'ไม่พบเกม' });
        }

        const newClicks = (game.clicks || 0) + 1;
        await supabase
            .from('games')
            .update({ clicks: newClicks })
            .eq('id', gameId);

        res.json({ message: 'Click recorded', clicks: newClicks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. FAVORITES ENDPOINTS
// ==========================================

// Get User's Favorites
app.get('/api/favorites', checkDbConnection, authenticateToken, async (req, res) => {
    try {
        const { data: favorites, error } = await supabase
            .from('favorites')
            .select(`
                game_id,
                game:games(
                    id,
                    title,
                    description,
                    cover_image,
                    views,
                    clicks,
                    category:categories(name),
                    developer:users(display_name, name)
                )
            `)
            .eq('user_id', req.user.id);

        if (error) throw error;

        const formattedList = (favorites || []).map(f => ({
            id: f.game.id,
            name: f.game.title,
            description: f.game.description,
            cover: f.game.cover_image,
            category: f.game.category?.name || 'Other',
            developer: f.game.developer?.display_name || f.game.developer?.name || 'Unknown'
        }));

        res.json({ favorites: formattedList });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Favorite (Add/Remove)
app.post('/api/favorites/toggle', checkDbConnection, authenticateToken, async (req, res) => {
    try {
        const { game_id, gameId } = req.body;
        const targetGameId = game_id || gameId;

        if (!targetGameId) {
            return res.status(400).json({ error: 'กรุณาระบุ game_id' });
        }

        // Check if already favorited
        const { data: existing, error: checkError } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('game_id', targetGameId)
            .maybeSingle();

        if (existing) {
            // Remove favorite
            await supabase.from('favorites').delete().eq('id', existing.id);
            return res.json({ favorited: false, message: 'นำออกจากรายการโปรดแล้ว' });
        } else {
            // Add favorite
            await supabase.from('favorites').insert([{ user_id: req.user.id, game_id: targetGameId }]);
            return res.json({ favorited: true, message: 'เพิ่มลงในรายการโปรดแล้ว' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profile/:username', checkDbConnection, async (req, res) => {
    try {
        const username = req.params.username;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, display_name, email, role, avatar, bio, website, created_at')
            .or(`display_name.ilike.${username},name.ilike.${username}`)
            .maybeSingle();

        if (userError || !user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้นี้ในระบบ' });
        }

        const isDev = user.role === 'developer' || user.role === 'admin';

        if (isDev) {
            // Fetch developer games (or admin's own uploaded games)
            const { data: games, error: gamesError } = await supabase
                .from('games')
                .select(`
                    id,
                    title,
                    description,
                    cover_image,
                    link,
                    download_url,
                    status,
                    views,
                    clicks,
                    created_at,
                    category:categories(name)
                `)
                .eq('developer_id', user.id)
                .order('created_at', { ascending: false });

            const formattedGames = (games || []).map(g => ({
                id: g.id,
                name: g.title,
                description: g.description,
                category: g.category?.name || 'Other',
                cover: g.cover_image,
                link: g.link || g.download_url,
                status: g.status || 'published',
                views: g.views || 0,
                clicks: g.clicks || 0,
                createdAt: g.created_at
            }));

            const totalViews = formattedGames.reduce((acc, g) => acc + (g.views || 0), 0);
            const totalClicks = formattedGames.reduce((acc, g) => acc + (g.clicks || 0), 0);
            const engagementRate = totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0;

            return res.json({
                user: formatUser(user),
                stats: {
                    gamesCount: formattedGames.length,
                    totalViews,
                    totalClicks,
                    engagementRate
                },
                games: formattedGames
            });
        } else {
            // Fetch regular user favorites count and favorites list
            const { data: favorites } = await supabase
                .from('favorites')
                .select(`
                    game:games(
                        id,
                        title,
                        description,
                        cover_image,
                        category:categories(name),
                        developer:users(display_name, name)
                    )
                `)
                .eq('user_id', user.id);

            const formattedFavorites = (favorites || []).map(f => ({
                id: f.game.id,
                name: f.game.title,
                description: f.game.description,
                cover: f.game.cover_image,
                category: f.game.category?.name || 'Other',
                developer: f.game.developer?.display_name || f.game.developer?.name || 'Unknown'
            }));

            return res.json({
                user: formatUser(user),
                stats: {
                    favoritesCount: formattedFavorites.length
                },
                favorites: formattedFavorites
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

// 1. Get Admin Platform Stats
app.get('/api/admin/stats', checkDbConnection, authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        // Fetch all games
        const { data: games, error: gamesError } = await supabase
            .from('games')
            .select('id, status, views, clicks');

        if (gamesError) throw gamesError;

        // Fetch all users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, role');

        if (usersError) throw usersError;

        const allGames = games || [];
        const allUsers = users || [];

        const totalGames = allGames.length;
        const pendingGames = allGames.filter(g => g.status === 'pending_review').length;
        const publishedGames = allGames.filter(g => g.status === 'published').length;
        const rejectedGames = allGames.filter(g => g.status === 'rejected').length;

        const totalUsers = allUsers.length;
        const totalDevs = allUsers.filter(u => u.role === 'developer').length;
        const totalAdmins = allUsers.filter(u => u.role === 'admin').length;

        const totalViews = allGames.reduce((acc, g) => acc + (g.views || 0), 0);
        const totalClicks = allGames.reduce((acc, g) => acc + (g.clicks || 0), 0);

        res.json({
            stats: {
                totalGames,
                pendingGames,
                publishedGames,
                rejectedGames,
                totalUsers,
                totalDevs,
                totalAdmins,
                totalViews,
                totalClicks
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Get All Games for Admin (all statuses with filter & search)
app.get('/api/admin/games', checkDbConnection, authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { status, search, category } = req.query;

        let query = supabase
            .from('games')
            .select(`
                id,
                title,
                description,
                cover_image,
                download_url,
                link,
                views,
                clicks,
                price,
                status,
                created_at,
                updated_at,
                category:categories(id, name),
                developer:users(id, name, display_name, email)
            `)
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: games, error } = await query;
        if (error) throw error;

        let formattedGames = (games || []).map(g => ({
            id: g.id,
            name: g.title,
            title: g.title,
            description: g.description,
            category: g.category?.name || 'Other',
            categoryId: g.category?.id || null,
            developer: g.developer?.display_name || g.developer?.name || 'Unknown',
            developerEmail: g.developer?.email || '',
            developerId: g.developer?.id,
            cover: g.cover_image || '',
            link: g.link || g.download_url || '',
            status: g.status || 'published',
            views: g.views || 0,
            clicks: g.clicks || 0,
            createdAt: g.created_at,
            updatedAt: g.updated_at
        }));

        if (category && category !== 'all') {
            formattedGames = formattedGames.filter(g => g.category.toLowerCase() === category.toLowerCase());
        }

        res.json({ games: formattedGames });
    } catch (err) {
        console.error('Admin games error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Update Game Status (Approve / Reject)
app.patch('/api/admin/games/:id/status', checkDbConnection, authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const gameId = req.params.id;
        const { status } = req.body;

        const validStatuses = ['published', 'pending_review', 'rejected', 'draft', 'suspended'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: `สถานะไม่ถูกต้อง กรุณาเลือกสถานะ: ${validStatuses.join(', ')}`
            });
        }

        const { data: updatedGame, error } = await supabase
            .from('games')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', gameId)
            .select(`
                id,
                title,
                status,
                developer:users(display_name, name, email)
            `)
            .single();

        if (error || !updatedGame) {
            return res.status(404).json({ error: 'ไม่พบเกมที่ต้องการอัปเดตสถานะ' });
        }

        const statusLabels = {
            published: 'อนุมัติให้เผยแพร่แล้ว (Published)',
            rejected: 'ปฏิเสธการเผยแพร่ (Rejected)',
            pending_review: 'ส่งกลับไประงับรอตรวจสอบ (Pending Review)'
        };

        res.json({
            message: `อัปเดตสถานะเกม "${updatedGame.title}" เป็น ${statusLabels[status] || status} สำเร็จ`,
            game: updatedGame
        });
    } catch (err) {
        console.error('Update game status error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Delete Game by Admin
app.delete('/api/admin/games/:id', checkDbConnection, authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const gameId = req.params.id;

        const { data: game, error: findError } = await supabase
            .from('games')
            .select('id, title')
            .eq('id', gameId)
            .single();

        if (findError || !game) {
            return res.status(404).json({ error: 'ไม่พบเกมที่ต้องการลบ' });
        }

        const { error: deleteError } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);

        if (deleteError) throw deleteError;

        res.json({ message: `ลบเกม "${game.title}" เรียบร้อยแล้วโดยผู้ดูแลระบบ` });
    } catch (err) {
        console.error('Admin delete game error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Get Users list for Admin
app.get('/api/admin/users', checkDbConnection, authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, name, display_name, email, role, avatar, bio, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Count games per user
        const { data: games } = await supabase
            .from('games')
            .select('developer_id');

        const gamesCountMap = {};
        (games || []).forEach(g => {
            gamesCountMap[g.developer_id] = (gamesCountMap[g.developer_id] || 0) + 1;
        });

        const formattedUsers = (users || []).map(u => ({
            id: u.id,
            name: u.name,
            username: u.display_name || u.name,
            email: u.email,
            role: u.role,
            displayRole: u.role === 'admin' ? 'Admin' : (u.role === 'developer' ? 'Developer' : 'User'),
            gamesCount: gamesCountMap[u.id] || 0,
            createdAt: u.created_at
        }));

        res.json({ users: formattedUsers });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 GameSinKid API Server running on port ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📡 Supabase Configured: ${isSupabaseConfigured() ? '✅ YES' : '⚠️  NO (Pending .env configuration)'}`);
    console.log(`=========================================`);
});