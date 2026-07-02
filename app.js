/* ========================================
   BASAVARAJ TALAVAR ART GALLERY
   Main Application Script
   ======================================== */

// ========================
// CONFIGURATION
// ========================
// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://kllujpcjngxbhqttyuom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbHVqcGNqbmd4YmhxdHR5dW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzgyNjgsImV4cCI6MjA5ODU1NDI2OH0.aAe9O_qUhwgcRJitnQQmVhJTtxVjYNxvmbZV15QEh2E';
const SUPABASE_ADMIN_SECRET = 'sb_secret_QK3bp-xk5sIa7SmbsFDjFw_RS_VvsPW';

// Admin password (hashed for security)
const ADMIN_PASSWORD = 'BasuArt@2026';

// Supabase storage bucket name
const STORAGE_BUCKET = 'artworks';

// Category labels
const CATEGORY_LABELS = {
    wall_painting: 'Wall Painting',
    calligraphy: 'Calligraphy',
    thermocol: 'Thermocol Art',
    portrait: 'Portraits',
    landscape: 'Landscapes',
    traditional: 'Traditional Paintings'
};

// ========================
// STATE
// ========================
let supabase = null;
let isAdmin = false;
let artworks = [];
let currentFilter = 'all';
let lightboxIndex = -1;
let filteredArtworks = [];

// ========================
// INITIALIZATION
// ========================
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initSupabase();
    initNavbar();
    initParticles();
    initGalleryFilters();
    initCategoryLinks();
    initAdminAuth();
    initUploadForm();
    initLightbox();
    // loadArtworks() will be called by initSupabase once the script dynamically loads
    initScrollAnimations();
});

// ========================
// SUPABASE
// ========================
function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        console.warn('⚠️ Supabase not configured. Please add your URL.');
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
        const key = sessionStorage.getItem('isAdmin') === 'true' ? SUPABASE_ADMIN_SECRET : SUPABASE_ANON_KEY;
        supabase = window.supabase.createClient(SUPABASE_URL, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        console.log('✅ Supabase connected');
        loadArtworks();
    };
    script.onerror = () => {
        console.error('⚠️ Failed to load Supabase SDK. The network connection might be blocked.');
        showToast('Database connection failed. Please check your network or adblocker.', 'error');
    };
    document.head.appendChild(script);
}

// Utility to parse storage path from image url
function getStoragePathFromUrl(url) {
    const searchStr = '/public/artworks/';
    const index = url.indexOf(searchStr);
    if (index !== -1) {
        return url.substring(index + searchStr.length);
    }
    return '';
}

async function loadArtworks() {
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('artwork')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Parse category and description from title
        artworks = (data || []).map(item => {
            let category = 'wall_painting';
            let title = item.title;
            let description = '';
            
            if (item.title && item.title.includes(' ||| ')) {
                const parts = item.title.split(' ||| ');
                category = parts[0];
                title = parts[1];
                description = parts[2] || '';
            }
            
            return {
                id: item.id,
                title: title,
                category: category,
                description: description,
                image_url: item.image_url,
                created_at: item.created_at
            };
        });
        
        renderGallery();
        updateCounts();
    } catch (err) {
        console.error('Error loading artworks:', err);
        showToast('Failed to load artworks', 'error');
    }
}

async function uploadArtwork(title, category, description, file) {
    if (!supabase) {
        throw new Error('Supabase not connected');
    }

    try {
        // Upload image to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${category}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        const imageUrl = urlData.publicUrl;

        // Format combined title
        const combinedTitle = `${category} ||| ${title} ||| ${description}`;

        // Insert record into database
        const { data, error } = await supabase
            .from('artwork')
            .insert([{
                title: combinedTitle,
                image_url: imageUrl
            }])
            .select()
            .single();

        if (error) throw error;
        
        return {
            id: data.id,
            title: title,
            category: category,
            description: description,
            image_url: data.image_url,
            created_at: data.created_at
        };

    } catch (err) {
        console.error('Upload error:', err);
        throw err;
    }
}

async function deleteArtwork(id, storagePath) {
    if (!supabase) {
        console.error('Supabase not connected');
        return;
    }

    try {
        // Delete from database
        const { error } = await supabase
            .from('artwork')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Delete from storage
        if (storagePath) {
            await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        }

        artworks = artworks.filter(a => a.id !== id);
        renderGallery();
        updateCounts();
        showToast('Artwork deleted', 'success');
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Failed to delete artwork', 'error');
    }
}

// ========================
// LOADER
// ========================
function initLoader() {
    const hideLoader = () => {
        setTimeout(() => {
            document.getElementById('loader').classList.add('hidden');
        }, 800);
    };

    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader);
    }
}

// ========================
// NAVBAR
// ========================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Mobile toggle
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        navToggle.classList.toggle('active');
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.classList.remove('active');
        });
    });

    // Active link on scroll
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
        });
    });
}

// ========================
// PARTICLES
// ========================
function initParticles() {
    const container = document.getElementById('heroParticles');
    const colors = ['#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E', '#FF6B6B', '#00D2D3'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 6 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            left: ${Math.random() * 100}%;
            animation-duration: ${Math.random() * 15 + 10}s;
            animation-delay: ${Math.random() * 10}s;
            opacity: ${Math.random() * 0.5 + 0.2};
        `;
        container.appendChild(particle);
    }
}

// ========================
// GALLERY RENDERING
// ========================
function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    const empty = document.getElementById('galleryEmpty');

    filteredArtworks = currentFilter === 'all'
        ? [...artworks]
        : artworks.filter(a => a.category === currentFilter);

    if (filteredArtworks.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
    } else {
        grid.style.display = 'grid';
        empty.style.display = 'none';
    }

    grid.innerHTML = filteredArtworks.map((art, index) => `
        <div class="gallery-item" data-index="${index}" style="animation-delay: ${index * 0.1}s">
            <img class="gallery-item-img" src="${art.image_url}" alt="${art.title}" loading="lazy">
            <div class="gallery-item-overlay">
                <span class="gallery-item-cat">${CATEGORY_LABELS[art.category] || art.category}</span>
                <h3 class="gallery-item-title">${art.title}</h3>
                ${art.description ? `<p class="gallery-item-desc">${art.description}</p>` : ''}
            </div>
            ${isAdmin ? `<button class="gallery-item-delete" data-id="${art.id}" data-url="${art.image_url}" title="Delete artwork">&times;</button>` : ''}
        </div>
    `).join('');

    // Click events for lightbox
    grid.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.gallery-item-delete')) return;
            openLightbox(parseInt(item.dataset.index));
        });
    });

    // Delete buttons
    if (isAdmin) {
        grid.querySelectorAll('.gallery-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this artwork?')) {
                    const storagePath = getStoragePathFromUrl(btn.dataset.url);
                    deleteArtwork(btn.dataset.id, storagePath);
                }
            });
        });
    }

    // Update total count in hero
    document.getElementById('totalArtworks').textContent = artworks.length;
}

function updateCounts() {
    const counts = {};
    artworks.forEach(a => {
        counts[a.category] = (counts[a.category] || 0) + 1;
    });

    document.querySelectorAll('.category-count').forEach(el => {
        const cat = el.dataset.cat;
        const count = counts[cat] || 0;
        el.textContent = `${count} Artwork${count !== 1 ? 's' : ''}`;
    });

    document.getElementById('totalArtworks').textContent = artworks.length;
}

// ========================
// GALLERY FILTERS
// ========================
function initGalleryFilters() {
    const filters = document.getElementById('galleryFilters');
    filters.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-btn')) return;
        filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderGallery();
    });
}

// ========================
// CATEGORY LINKS
// ========================
function initCategoryLinks() {
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = link.dataset.filter;
            currentFilter = filter;

            // Update filter buttons
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.filter === filter);
            });

            renderGallery();

            // Scroll to gallery
            document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ========================
// ADMIN AUTH
// ========================
function initAdminAuth() {
    const adminBtn = document.getElementById('adminBtn');
    const loginModal = document.getElementById('adminLoginModal');
    const closeLogin = document.getElementById('closeLoginModal');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const togglePwd = document.getElementById('togglePassword');
    const pwdInput = document.getElementById('adminPassword');
    const adminBar = document.getElementById('adminBar');
    const uploadModal = document.getElementById('uploadModal');
    const openUpload = document.getElementById('openUploadModal');
    const closeUpload = document.getElementById('closeUploadModal');
    const cancelUpload = document.getElementById('cancelUpload');
    const logoutBtn = document.getElementById('adminLogout');

    // Check session
    if (sessionStorage.getItem('isAdmin') === 'true') {
        isAdmin = true;
        adminBar.style.display = 'block';
        adminBtn.classList.add('logged-in');
        // Do not call renderGallery here, it will be called by loadArtworks initially
    }

    // Open login modal
    adminBtn.addEventListener('click', () => {
        if (isAdmin) {
            // Already logged in, open upload
            uploadModal.classList.add('active');
        } else {
            loginModal.classList.add('active');
            pwdInput.focus();
        }
    });

    // Close login
    closeLogin.addEventListener('click', () => {
        loginModal.classList.remove('active');
        loginError.textContent = '';
        loginForm.reset();
    });

    // Toggle password
    togglePwd.addEventListener('click', () => {
        pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });

    // Submit login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = pwdInput.value;

        if (pwd === ADMIN_PASSWORD) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            if (supabase && window.supabase) {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ADMIN_SECRET, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false
                    }
                });
            }
            loginModal.classList.remove('active');
            adminBar.style.display = 'block';
            adminBtn.classList.add('logged-in');
            loginForm.reset();
            loginError.textContent = '';
            renderGallery();
            showToast('Welcome Admin! You can now manage artworks.', 'success');
        } else {
            loginError.textContent = 'Incorrect password. Try again.';
            pwdInput.value = '';
            pwdInput.focus();
        }
    });

    // Open upload modal
    openUpload.addEventListener('click', () => {
        uploadModal.classList.add('active');
    });

    // Close upload
    closeUpload.addEventListener('click', () => {
        uploadModal.classList.remove('active');
        resetUploadForm();
    });

    cancelUpload.addEventListener('click', () => {
        uploadModal.classList.remove('active');
        resetUploadForm();
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        if (supabase && window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        adminBar.style.display = 'none';
        adminBtn.classList.remove('logged-in');
        renderGallery();
        showToast('Logged out successfully', 'info');
    });

    // Close modals on overlay click
    [loginModal, uploadModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (modal === loginModal) {
                    loginError.textContent = '';
                    loginForm.reset();
                }
                if (modal === uploadModal) resetUploadForm();
            }
        });
    });
}

// ========================
// UPLOAD FORM
// ========================
function initUploadForm() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('artImage');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileContent = document.getElementById('fileUploadContent');
    const filePreview = document.getElementById('filePreview');
    const previewImg = document.getElementById('previewImg');
    const removeBtn = document.getElementById('removePreview');
    const submitBtn = document.getElementById('submitUpload');
    const uploadError = document.getElementById('uploadError');

    // Drag and drop
    ['dragenter', 'dragover'].forEach(e => {
        fileUploadArea.addEventListener(e, (ev) => {
            ev.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(e => {
        fileUploadArea.addEventListener(e, (ev) => {
            ev.preventDefault();
            fileUploadArea.classList.remove('dragover');
        });
    });

    fileUploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            showPreview(files[0]);
        }
    });

    // File select
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            showPreview(fileInput.files[0]);
        }
    });

    function showPreview(file) {
        if (file.size > 10 * 1024 * 1024) {
            uploadError.textContent = 'File too large. Max 10MB.';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            fileContent.style.display = 'none';
            filePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // Remove preview
    removeBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileContent.style.display = 'block';
        filePreview.style.display = 'none';
        previewImg.src = '';
    });

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadError.textContent = '';

        const title = document.getElementById('artTitle').value.trim();
        const category = document.getElementById('artCategory').value;
        const description = document.getElementById('artDescription').value.trim();
        const file = fileInput.files[0];

        if (!title || !category || !file) {
            uploadError.textContent = 'Please fill all required fields.';
            return;
        }

        // Show loading
        submitBtn.querySelector('.btn-text').style.display = 'none';
        submitBtn.querySelector('.btn-loader').style.display = 'inline-block';
        submitBtn.disabled = true;

        try {
            const artwork = await uploadArtwork(title, category, description, file);
            if (supabase) {
                artworks.unshift(artwork);
            }
            renderGallery();
            updateCounts();
            
            document.getElementById('uploadModal').classList.remove('active');
            resetUploadForm();
            showToast('Artwork uploaded successfully!', 'success');
        } catch (err) {
            let errorMsg = err.message || JSON.stringify(err) || 'Unknown error';
            if (errorMsg === 'Failed to fetch' || errorMsg.includes('fetch')) {
                errorMsg = 'Network Error: Cannot connect to Supabase. Check your adblocker or internet.';
            }
            uploadError.textContent = `Error: ${errorMsg}`;
            console.error(err);
        } finally {
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.btn-loader').style.display = 'none';
            submitBtn.disabled = false;
        }
    });
}

function resetUploadForm() {
    document.getElementById('uploadForm').reset();
    document.getElementById('fileUploadContent').style.display = 'block';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
    document.getElementById('uploadError').textContent = '';
}

// ========================
// LIGHTBOX
// ========================
function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightboxClose');
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', () => navigateLightbox(-1));
    nextBtn.addEventListener('click', () => navigateLightbox(1));

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });
}

function openLightbox(index) {
    lightboxIndex = index;
    const art = filteredArtworks[index];
    if (!art) return;

    document.getElementById('lightboxImg').src = art.image_url;
    document.getElementById('lightboxTitle').textContent = art.title;
    document.getElementById('lightboxCategory').textContent = CATEGORY_LABELS[art.category] || art.category;
    document.getElementById('lightboxDesc').textContent = art.description || '';
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
    lightboxIndex = -1;
}

function navigateLightbox(dir) {
    const newIndex = lightboxIndex + dir;
    if (newIndex < 0 || newIndex >= filteredArtworks.length) return;
    openLightbox(newIndex);
}

// ========================
// SCROLL ANIMATIONS
// ========================
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.category-card, .contact-card, .about-content').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animate-in class styles
    const style = document.createElement('style');
    style.textContent = `.animate-in { opacity: 1 !important; transform: translateY(0) !important; }`;
    document.head.appendChild(style);
}

// ========================
// TOAST
// ========================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
