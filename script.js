// Global variables
let currentUser = null;
let users = JSON.parse(localStorage.getItem('users')) || [];
let products = [];
let seasons = {};

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/current-user', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.user) {
            currentUser = data.user;
            showUserInfo(data.user);
            await loadUserData();
        } else {
            // Allow access without authentication - use guest mode
            currentUser = null;
            console.log('Running in guest mode - no authentication required');
            showUserInfo(null);
            await loadUserData();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        // Allow access even if there's an error - guest mode
        currentUser = null;
        showUserInfo(null);
        await loadUserData();
    }
}

function showUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const username = document.getElementById('username');
    
    if (userInfo && username) {
        if (user) {
            username.textContent = `مرحباً، ${user.username}`;
            userInfo.style.display = 'flex';
        } else {
            // Guest mode - hide user info
            userInfo.style.display = 'none';
        }
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            currentUser = null;
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

async function loadUserData() {
    try {
        // Only load data if user is authenticated
        if (currentUser) {
            // Load user's products
            const productsResponse = await fetch('/api/products', {
                credentials: 'include'
            });
            if (productsResponse.ok) {
                const data = await productsResponse.json();
                products = data.products || [];
                console.log('Products loaded from server:', products.length, 'products');
                
                // إعادة عرض المنتجات إذا كان العنصر موجود
                if (productsGrid) {
                    // إعادة تطبيق الفلتر الحالي
            const activeTab = document.querySelector('.filter-tab.active');
            if (activeTab) {
                const currentFilter = activeTab.getAttribute('data-filter');
                filterProducts(currentFilter);
            } else {
                displayProducts(products);
            }
                }
            } else {
                console.error('Failed to load products:', productsResponse.status);
            }
            
            // Load seasons using the loadSeasons function
            await loadSeasons();
        } else {
            // Guest mode - initialize empty data
            products = [];
            seasons = {};
            console.log('Guest mode - no data loaded from server');
            
            // Display empty products grid
            if (productsGrid) {
                displayProducts(products);
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Debug: Log initial state
console.log('Script loaded. Initial products:', products);
console.log('Initial seasons:', seasons);

// Unified deleteProduct function available globally
window.deleteProduct = async function(productId) {
    console.log('deleteProduct called with ID:', productId, 'Type:', typeof productId);
    
    if (!productId) {
        console.error('Product ID is missing');
        showMessage('خطأ: معرف المنتج مفقود', 'error');
        return;
    }
    
    console.log('Current products before deletion:', products);
    
    // تحويل productId إلى رقم إذا كان نص
    const numericProductId = parseInt(productId);
    const stringProductId = String(productId);
    console.log('Converted productId to numeric:', numericProductId, 'and string:', stringProductId);
    
    // البحث عن المنتج باستخدام كل من النص والرقم
    let productExists = products.find(p => 
        p.id === productId || 
        p.id === numericProductId || 
        p.id === stringProductId ||
        String(p.id) === stringProductId ||
        parseInt(p.id) === numericProductId
    );
    
    if (!productExists) {
        console.error('Product not found with ID:', productId);
        console.log('Available product IDs:', products.map(p => ({id: p.id, type: typeof p.id, name: p.name})));
        
        // محاولة إعادة تحميل البيانات من الخادم
        console.log('Attempting to reload products from server...');
        await loadUserData();
        
        // البحث مرة أخرى بعد إعادة التحميل
        productExists = products.find(p => 
            p.id === productId || 
            p.id === numericProductId || 
            p.id === stringProductId ||
            String(p.id) === stringProductId ||
            parseInt(p.id) === numericProductId
        );
        
        if (!productExists) {
            showMessage('المنتج غير موجود. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
    }
    
    const confirmDelete = confirm(`هل أنت متأكد من حذف المنتج "${productExists.name}"؟`);
    console.log('User confirmation:', confirmDelete);
    
    if (confirmDelete) {
        console.log('User confirmed deletion');
        
        try {
            // حذف المنتج من قاعدة البيانات
            const response = await fetch(`/api/products/${numericProductId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // حذف المنتج من البيانات المحلية
                const originalLength = products.length;
                products = products.filter(p => 
                    p.id !== productId && 
                    p.id !== numericProductId && 
                    p.id !== stringProductId &&
                    String(p.id) !== stringProductId &&
                    parseInt(p.id) !== numericProductId
                );
                console.log('Products after filter:', products);
                console.log('Length changed from', originalLength, 'to', products.length);
                
                // إزالة المنتج من المواسم المحلية
                Object.keys(seasons).forEach(seasonName => {
                    if (seasons[seasonName]) {
                        seasons[seasonName] = seasons[seasonName].filter(p => 
                            p.id !== productId && 
                            p.id !== numericProductId && 
                            p.id !== stringProductId &&
                            String(p.id) !== stringProductId &&
                            parseInt(p.id) !== numericProductId
                        );
                    }
                });
                
                saveProducts(); // حفظ احتياطي في localStorage
                loadProducts(); // إعادة تحميل العرض
                showMessage('تم حذف المنتج بنجاح', 'success');
            } else {
                showMessage(data.error || 'خطأ في حذف المنتج', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showMessage('خطأ في الاتصال بالخادم', 'error');
        }
    } else {
        console.log('User cancelled deletion');
    }
};

// DOM elements
const heroSection = document.getElementById('hero-section');
const contentSections = document.querySelectorAll('.content-section');
const navLinks = document.querySelectorAll('.nav-link');
const ctaButton = document.querySelector('.cta-button');
const productForm = document.getElementById('product-form');
const productsGrid = document.getElementById('products-grid');
const seasonSelect = document.getElementById('season-select');
const seasonProductsGrid = document.getElementById('season-products-grid');
const filterTabs = document.querySelectorAll('.filter-tab');
const modal = document.getElementById('product-modal');
const modalContent = document.getElementById('modal-product-details');
const closeModal = document.querySelector('.close');

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Clear all seasons to start fresh
    localStorage.removeItem('seasons');
    seasons = {};
    localStorage.setItem('seasons', JSON.stringify(seasons));
    
    // Check authentication status first
    await checkAuthStatus();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    initializeNavigation();
    setupEventListeners();
    
    // Load products and seasons (now from database)
    loadProducts();
    loadSeasons();
    
    // Show hero section by default
    showSection('hero-section');
});

// Navigation Functions
function showSection(sectionId) {
    // Hide all content sections
    contentSections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show hero section or specific content section
    if (sectionId === 'hero-section') {
        if (heroSection) {
            heroSection.style.display = 'block';
            // Smooth scroll to top for hero section
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    } else {
        if (heroSection) {
            heroSection.style.display = 'none';
        }
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            // Add active class with slight delay for smooth transition
            setTimeout(() => {
                targetSection.classList.add('active');
            }, 10);
            
            // Enhanced smooth scroll to the section with better positioning
            setTimeout(() => {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
                
                // Additional scroll adjustment for better positioning
                setTimeout(() => {
                    const headerHeight = 80; // Adjust based on your header height
                    const elementPosition = targetSection.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }, 100);
            }, 50);
            
            // Load products if showing products list
            if (sectionId === 'products-list') {
                loadProducts();
            }
            
            // Load seasons if showing seasonal products
            if (sectionId === 'seasonal-products') {
                loadSeasons();
            }
        }
    }
    
    // Update navigation active state
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
}

// Smooth scroll utility function
function smoothScrollTo(elementId, offset = 80) {
    const element = document.getElementById(elementId);
    if (element) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Enhanced smooth scroll for any element
function smoothScrollToElement(element, offset = 80) {
    if (element) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Navigation
function initializeNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            if (targetSection) {
                showSection(targetSection);
            }
        });
    });
    
    // CTA button navigation
    if (ctaButton) {
        ctaButton.addEventListener('click', function(e) {
            e.preventDefault();
            showSection('add-product');
        });
    }
    
    // Mobile navigation toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking on nav links (after navigation)
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Small delay to allow navigation to complete first
            setTimeout(() => {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }, 100);
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        }
    });
}

// Event Listeners
// Add smooth scroll to all buttons and links
function addSmoothScrollToAllButtons() {
    // Add smooth scroll to all buttons with data-scroll attribute
    const scrollButtons = document.querySelectorAll('[data-scroll]');
    scrollButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-scroll');
            smoothScrollTo(targetId);
        });
    });
    
    // Add smooth scroll to CTA button
    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            showSection('add-product');
        });
    });
    
    // Add smooth scroll to any link with href starting with #
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            if (targetId) {
                smoothScrollTo(targetId);
            }
        });
    });
}

function setupEventListeners() {
    // Initialize smooth scroll for all buttons
    addSmoothScrollToAllButtons();
    
    const fetchProductBtn = document.getElementById('fetch-product');
    const addProductBtn = document.getElementById('add-product-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const addSeasonBtn = document.getElementById('add-season-btn');
    const deleteAllProductsBtn = document.getElementById('delete-all-products-btn');
    const seasonModal = document.getElementById('season-modal');
    const productUrlInput = document.getElementById('product-url');

    
    // CTA Button
    if (ctaButton) {
        ctaButton.addEventListener('click', () => {
            showSection('add-product');
        });
    }
    
    // Auto-fetch product info when URL is entered
    if (productUrlInput) {
        let debounceTimer;
        productUrlInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            const url = this.value.trim();
            
            // Check if URL is valid and complete
            if (isValidUrl(url)) {
                debounceTimer = setTimeout(() => {
                    fetchProductInfo();
                }, 1000); // Wait 1 second after user stops typing
            }
        });
        
        // Also trigger on paste
        productUrlInput.addEventListener('paste', function() {
            setTimeout(() => {
                const url = this.value.trim();
                if (isValidUrl(url)) {
                    fetchProductInfo();
                }
            }, 100);
        });
    }
    
    // Setup description action buttons
    setupDescriptionActionButtons();
    
    if (fetchProductBtn) {
        fetchProductBtn.addEventListener('click', fetchProductInfo);
    }

    // Add product button
    if (addProductBtn) {
        addProductBtn.addEventListener('click', addProduct);
    }
    
    // Product form submission
    if (productForm) {
        productForm.addEventListener('submit', addProduct);
    }
    
    // Filter tabs
    if (filterTabs) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = tab.getAttribute('data-filter');
                filterProducts(filter);
            });
        });
    }
    
    if (seasonSelect) {
        seasonSelect.addEventListener('change', function() {
            filterSeasonalProducts(this.value);
        });
    }
    
    if (addSeasonBtn) {
        addSeasonBtn.addEventListener('click', function() {
            if (seasonModal) {
                seasonModal.style.display = 'block';
            }
        });
    }
    
    // Change season button
    const changeSeasonBtn = document.getElementById('change-season-btn');
    if (changeSeasonBtn) {
        changeSeasonBtn.addEventListener('click', function() {
            showSection('seasonal-products');
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            if (seasonModal) {
                seasonModal.style.display = 'none';
            }
        });
    }
    

    
    // Modal close
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    window.addEventListener('click', function(e) {
        if (seasonModal && e.target === seasonModal) {
            seasonModal.style.display = 'none';
        }
        
        const editSeasonModal = document.getElementById('edit-season-modal');
        if (editSeasonModal && e.target === editSeasonModal) {
            editSeasonModal.style.display = 'none';
        }
    });
    
    // Delete all products button
    if (deleteAllProductsBtn) {
        deleteAllProductsBtn.addEventListener('click', deleteAllProducts);
    }
    
    // Close buttons for modals
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('close')) {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    });
}

// Delete all products function
async function deleteAllProducts() {
    if (confirm('هل أنت متأكد من حذف جميع المنتجات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        try {
            const response = await fetch('/api/delete_all_products', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                products = [];
                displayProducts(products);
                showMessage('تم حذف جميع المنتجات بنجاح', 'success');
            } else {
                throw new Error('فشل في حذف المنتجات');
            }
        } catch (error) {
            console.error('Error deleting all products:', error);
            showMessage('حدث خطأ أثناء حذف المنتجات', 'error');
        }
    }
}

// Product Functions
async function fetchProductInfo() {
    const productUrlInput = document.getElementById('product-url');
    const fetchProductBtn = document.getElementById('fetch-product');
    const productPreview = document.getElementById('product-preview');
    
    if (!productUrlInput) return;
    
    const url = productUrlInput.value.trim();
    if (!url) {
        showMessage('يرجى إدخال رابط المنتج', 'error');
        return;
    }
    
    // Show loading
    if (fetchProductBtn) {
        fetchProductBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحليل التلقائي...';
        fetchProductBtn.disabled = true;
    }
    
    // Add visual indicator to input field
    if (productUrlInput) {
        productUrlInput.style.borderColor = '#667eea';
        productUrlInput.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
    }
    
    try {
        // Simulate API call to fetch product info
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extract product data from URL
        const productData = {
            name: await extractProductName(url),
            description: generateProductDescription(url),
            image: await extractProductImage(url),
            price: await extractProductPrice(url),
            currency: detectCurrencyFromUrl(url),
            url: url
        };
        
        displayProductPreview(productData);
        showMessage('تم تحليل المنتج تلقائياً بنجاح!', 'success');
        
    } catch (error) {
        showMessage('حدث خطأ أثناء جلب معلومات المنتج', 'error');
    } finally {
        if (fetchProductBtn) {
            fetchProductBtn.innerHTML = '<i class="fas fa-magic"></i> جلب المعلومات';
            fetchProductBtn.disabled = false;
        }
        
        // Reset input field styling
        if (productUrlInput) {
            productUrlInput.style.borderColor = '';
            productUrlInput.style.boxShadow = '';
        }
    }
}





function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

async function extractProductName(url) {
    try {
        const domain = extractDomainFromUrl(url);
        
        // Extract product name based on URL patterns
        if (domain.includes('etsy.com')) {
            const match = url.match(/\/listing\/\d+\/([^?]+)/);
            if (match) {
                return decodeURIComponent(match[1].replace(/-/g, ' '));
            }

        } else if (domain.includes('ebay.')) {
            const match = url.match(/\/itm\/([^?\/]+)/);
            if (match) {
                return decodeURIComponent(match[1].replace(/-/g, ' '));
            }

        } else if (domain.includes('salla.sa') || domain.includes('.salla.me')) {
            const match = url.match(/\/product\/([^?\/]+)/) || url.match(/\/([^?\/]+)$/);
            if (match) {
                return decodeURIComponent(match[1].replace(/[-_]/g, ' '));
            }
        } else if (domain.includes('zid.sa') || domain.includes('.zid.store')) {
            const match = url.match(/\/products\/([^?\/]+)/) || url.match(/\/([^?\/]+)$/);
            if (match) {
                return decodeURIComponent(match[1].replace(/[-_]/g, ' '));
            }
        }
        
        // Fallback: try to extract from URL path
        const pathParts = new URL(url).pathname.split('/').filter(part => part.length > 0);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 3) {
            return decodeURIComponent(lastPart.replace(/[-_]/g, ' '));
        }
        
        return 'منتج من ' + domain;
    } catch {
        return 'منتج غير معروف';
    }
}

async function extractProductImage(url) {
    try {
        const domain = extractDomainFromUrl(url);
        
        // Try to fetch actual product images from the URL
        if (domain.includes('etsy.com')) {
            return await fetchEtsyProductImages(url);

        } else if (domain.includes('ebay.')) {
            return await fetchEbayProductImages(url);

        } else if (domain.includes('salla.sa') || domain.includes('.salla.me')) {
            return await fetchSallaProductImages(url);
        } else if (domain.includes('zid.sa') || domain.includes('.zid.store')) {
            return await fetchZidProductImages(url);
        } else {
            // Try generic web scraping for other sites
            return await fetchGenericWebImages(url);
        }
        
        // Fallback to generic product images
        return await fetchGenericProductImages(domain);
    } catch {
        return '/placeholder.svg';
    }
}

async function extractProductPrice(url) {
    try {
        const domain = extractDomainFromUrl(url);
        
        // Try to fetch actual product price from the URL
        if (domain.includes('etsy.com')) {
            return await fetchEtsyProductPrice(url);
        } else if (domain.includes('ebay.')) {
            return await fetchEbayProductPrice(url);
        } else if (domain.includes('amazon.')) {
            return await fetchAmazonProductPrice(url);
        } else if (domain.includes('salla.sa') || domain.includes('.salla.me')) {
            return await fetchSallaProductPrice(url);
        } else if (domain.includes('zid.sa') || domain.includes('.zid.store')) {
            return await fetchZidProductPrice(url);
        } else if (domain.includes('noon.com')) {
            return await fetchNoonProductPrice(url);
        } else {
            // Try generic price extraction
            return await fetchGenericProductPrice(url);
        }
    } catch (error) {
        console.log('Error extracting price:', error);
        return 0;
    }
}

async function fetchEtsyProductImages(url) {
    try {
        // Use a CORS proxy to fetch the actual page
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // Extract images from Etsy page
            const images = [];
            
            // Try different selectors for Etsy images
            const imageSelectors = [
                'img[data-src*="il_794xN"]',
                'img[src*="il_794xN"]',
                '.carousel-image img',
                '.listing-page-image img',
                'img[alt*="listing"]'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && src.includes('etsystatic.com') && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching Etsy images:', e);
    }
    return await fetchGenericProductImages('etsy.com');
}

async function fetchAmazonProductImages(url) {
    try {
        // Use a CORS proxy to fetch the actual page
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // Extract images from Amazon page
            const images = [];
            
            // Try different selectors for Amazon images
            const imageSelectors = [
                '#landingImage',
                '#imgBlkFront',
                '.a-dynamic-image',
                'img[data-src*="images/I/"]',
                'img[src*="images/I/"]',
                '.image.item img',
                '#altImages img'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('data-a-dynamic-image');
                    if (src) {
                        // Parse dynamic image data if it exists
                        if (src.startsWith('{')) {
                            try {
                                const imageData = JSON.parse(src);
                                const imageUrl = Object.keys(imageData)[0];
                                if (imageUrl && imageUrl.includes('images/I/') && !images.includes(imageUrl)) {
                                    images.push(imageUrl);
                                }
                            } catch (e) {}
                        } else if (src.includes('images/I/') && !images.includes(src)) {
                            images.push(src);
                        }
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching Amazon images:', e);
    }
    return await fetchGenericProductImages('amazon.com');
}

async function fetchEbayProductImages(url) {
    try {
        // Use a CORS proxy to fetch the actual page
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // Extract images from eBay page
            const images = [];
            
            // Try different selectors for eBay images
            const imageSelectors = [
                '#icImg',
                '#mainImgHldr img',
                '.ux-image-carousel-item img',
                '.ux-image-filmstrip-carousel-item img',
                'img[src*="ebayimg.com"]',
                '.img img',
                '#PicturePanel img'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && src.includes('ebayimg.com') && !images.includes(src)) {
                        // Convert to high resolution if possible
                        const highResSrc = src.replace(/s-l\d+/, 's-l1600');
                        images.push(highResSrc);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching eBay images:', e);
    }
    return await fetchGenericProductImages('ebay.com');
}

async function fetchShopifyProductImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            const images = [];
            const imageSelectors = [
                '.product__media img',
                '.product-single__photo img',
                '.product-photo-container img',
                'img[src*="cdn.shopify.com"]',
                '.product-image-main img',
                '.featured-image img'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && src.includes('shopify.com') && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching Shopify images:', e);
    }
    return await fetchGenericProductImages('shopify.com');
}

async function fetchAliExpressProductImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            const images = [];
            const imageSelectors = [
                '.images-view-item img',
                '.product-image img',
                'img[src*="alicdn.com"]',
                '.image-view img',
                '.main-image img'
            ];
            
            for (const selector of imageSelectors) {
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && src.includes('alicdn.com') && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching AliExpress images:', e);
    }
    return await fetchGenericProductImages('aliexpress.com');
}

async function fetchNoonProductImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            const images = [];
            const imageSelectors = [
                '.swiper-slide img',
                '.product-image img',
                'img[src*="noon.com"]',
                'img[src*="nooncdn.com"]',
                '.image-gallery img',
                '.product-gallery img',
                'img[alt*="product"]',
                'img[class*="product"]'
            ];
            
            // First try Open Graph image
            const ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage) {
                const content = ogImage.getAttribute('content');
                if (content) images.push(content);
            }
            
            for (const selector of imageSelectors) {
                if (selector.includes('meta')) continue;
                
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && (src.includes('noon.com') || src.includes('nooncdn.com') || src.startsWith('http')) && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching Noon images:', e);
    }
    return await fetchGenericProductImages('noon.com');
}

async function fetchSallaProductImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        const images = [];
        
        // Salla specific selectors
        const selectors = [
            '.product-gallery img',
            '.product-images img',
            '.gallery-item img',
            '.product-image img',
            '[data-src*="salla"]',
            'img[src*="salla"]',
            '.swiper-slide img',
            '.product-slider img'
        ];
        
        for (const selector of selectors) {
            const imgElements = doc.querySelectorAll(selector);
            imgElements.forEach(img => {
                const src = img.getAttribute('data-src') || img.getAttribute('src');
                if (src && (src.includes('salla') || src.startsWith('http')) && !images.includes(src)) {
                    images.push(src);
                }
            });
            if (images.length >= 5) break;
        }
        
        if (images.length > 0) {
            return images[0];
        }
        
        return await fetchGenericProductImages('salla.sa');
    } catch (error) {
        console.error('Error fetching Salla product images:', error);
        return await fetchGenericProductImages('salla.sa');
    }
}

async function fetchZidProductImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        const images = [];
        
        // Zid specific selectors
        const selectors = [
            '.product-gallery img',
            '.product-images img',
            '.gallery-item img',
            '.product-image img',
            '[data-src*="zid"]',
            'img[src*="zid"]',
            '.swiper-slide img',
            '.product-slider img',
            '.product-photos img'
        ];
        
        for (const selector of selectors) {
            const imgElements = doc.querySelectorAll(selector);
            imgElements.forEach(img => {
                const src = img.getAttribute('data-src') || img.getAttribute('src');
                if (src && (src.includes('zid') || src.startsWith('http')) && !images.includes(src)) {
                    images.push(src);
                }
            });
            if (images.length >= 5) break;
        }
        
        if (images.length > 0) {
            return images[0];
        }
        
        return await fetchGenericProductImages('zid.sa');
    } catch (error) {
        console.error('Error fetching Zid product images:', error);
        return await fetchGenericProductImages('zid.sa');
    }
}

async function fetchGenericWebImages(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            const images = [];
            
            // Generic selectors for product images
            const imageSelectors = [
                'meta[property="og:image"]',
                '.product-image img',
                '.product-photo img',
                '.main-image img',
                '.featured-image img',
                'img[alt*="product"]',
                'img[alt*="Product"]',
                'img[class*="product"]',
                'img[id*="product"]'
            ];
            
            // First try Open Graph image
            const ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage) {
                const content = ogImage.getAttribute('content');
                if (content) images.push(content);
            }
            
            // Then try other selectors
            for (const selector of imageSelectors) {
                if (selector.includes('meta')) continue; // Skip meta tags
                
                const imgElements = doc.querySelectorAll(selector);
                imgElements.forEach(img => {
                    const src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src && src.startsWith('http') && !images.includes(src)) {
                        images.push(src);
                    }
                });
                if (images.length >= 5) break;
            }
            
            if (images.length > 0) {
                return images.slice(0, 5);
            }
        }
    } catch (e) {
        console.log('Error fetching generic web images:', e);
    }
    
    // Fallback to domain-specific generic images
    const domain = extractDomainFromUrl(url);
    return await fetchGenericProductImages(domain);
}

async function fetchGenericProductImages(domain) {
    const randomId = Math.floor(Math.random() * 1000);
    const categories = {
        'etsy.com': 'handmade,craft,art',

        'ebay.com': 'vintage,collectible,antique',

        'salla.sa': 'fashion,accessories,lifestyle',
        'zid.sa': 'business,commerce,retail'
    };
    
    const category = categories[domain] || 'product,item,goods';
    
    return [
        `https://source.unsplash.com/400x300/?${category}&sig=${randomId}`,
        `https://source.unsplash.com/400x300/?${category}&sig=${randomId + 1}`,
        `https://source.unsplash.com/400x300/?${category}&sig=${randomId + 2}`,
        `https://source.unsplash.com/400x300/?${category}&sig=${randomId + 3}`,
        `https://source.unsplash.com/400x300/?${category}&sig=${randomId + 4}`
    ];
}

// دوال استخراج السعر من المواقع المختلفة
async function fetchEtsyProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في Etsy
            const priceSelectors = [
                '.currency-value',
                '.notranslate',
                '[data-test-id="price"]',
                '.shop2-review-review .currency-symbol + .currency-value',
                '.listing-page-title + .wt-mb-xs-2 .currency-value'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching Etsy price:', error);
    }
    return 0;
}

async function fetchEbayProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في eBay
            const priceSelectors = [
                '.notranslate',
                '.u-flL.condText',
                '.ux-textspans.notranslate',
                '[data-testid="x-price-primary"] .notranslate',
                '.display-price .notranslate'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching eBay price:', error);
    }
    return 0;
}

async function fetchAmazonProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في Amazon
            const priceSelectors = [
                '.a-price-whole',
                '.a-offscreen',
                '#priceblock_dealprice',
                '#priceblock_ourprice',
                '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
                '.a-price-range .a-offscreen'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching Amazon price:', error);
    }
    return 0;
}

async function fetchSallaProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في Salla
            const priceSelectors = [
                '.product-price',
                '.price',
                '.s-product-card-price',
                '[data-price]',
                '.product-details .price',
                '.product-info .price'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching Salla price:', error);
    }
    return 0;
}

async function fetchZidProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في Zid
            const priceSelectors = [
                '.product-price',
                '.price',
                '.product-details .price',
                '[data-price]',
                '.product-info .price',
                '.price-current'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching Zid price:', error);
    }
    return 0;
}

async function fetchNoonProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر في Noon
            const priceSelectors = [
                '.priceNow',
                '.price',
                '.product-price',
                '[data-qa="pdp-price"]',
                '.productPrice',
                '.price-current'
            ];
            
            for (const selector of priceSelectors) {
                const priceElement = doc.querySelector(selector);
                if (priceElement) {
                    const priceText = priceElement.textContent.trim();
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    if (!isNaN(price) && price > 0) {
                        return price;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching Noon price:', error);
    }
    return 0;
}

async function fetchGenericProductPrice(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            // محاولة العثور على السعر باستخدام محددات عامة
            const priceSelectors = [
                '.price',
                '.product-price',
                '.cost',
                '.amount',
                '[class*="price"]',
                '[id*="price"]',
                '.currency',
                '.money',
                '.value'
            ];
            
            for (const selector of priceSelectors) {
                const priceElements = doc.querySelectorAll(selector);
                for (const priceElement of priceElements) {
                    const priceText = priceElement.textContent.trim();
                    // البحث عن أرقام مع رموز العملة
                    const priceMatch = priceText.match(/[\d,]+\.?\d*/g);
                    if (priceMatch) {
                        const price = parseFloat(priceMatch[0].replace(/,/g, ''));
                        if (!isNaN(price) && price > 0) {
                            return price;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error fetching generic price:', error);
    }
    return 0;
}

function extractDomainFromUrl(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'موقع غير معروف';
    }
}

function generateProductDescription(url) {
    const domain = extractDomainFromUrl(url);
    
    // تحليل نوع المنتج من الرابط
    const productType = analyzeProductType(url);
    const productCategory = analyzeProductCategory(url);
    
    // وصف أساسي حسب المنصة
    const baseDescriptions = {
        'etsy.com': [
            '🎨 منتج يدوي فريد من نوعه، مصنوع بعناية فائقة ومواد عالية الجودة.',
            '✨ تصميم حصري وأنيق يناسب جميع الأذواق والمناسبات.',
            '🎁 مثالي للهدايا الخاصة أو لإضافة لمسة فنية للديكور المنزلي.',
            '🏺 صناعة يدوية تقليدية بلمسة عصرية مبتكرة.'
        ],

        'ebay.com': [
            '💰 منتج بسعر تنافسي وجودة مضمونة من بائع موثوق.',
            '✅ حالة ممتازة مع ضمان البائع وسياسة إرجاع مرنة.',
            '🚚 شحن آمن وسريع مع تتبع الشحنة خطوة بخطوة.',
            '⭐ فرصة رائعة للحصول على منتج مميز بقيمة استثنائية.'
        ],

        'salla.sa': [
            '🇸🇦 منتج حصري من متجر سلة السعودي المتخصص والمعتمد.',
            '🏆 جودة عالية مع ضمان المتجر وخدمة ما بعد البيع المتميزة.',
            '🚛 توصيل سريع داخل المملكة العربية السعودية في 24-48 ساعة.',
            '📞 دعم فني متميز باللغة العربية ومتاح على مدار الساعة.',
            '🛒 منتج مناسب للسوق السعودي والخليجي مع فهم عميق للثقافة المحلية.',
            '💳 أسعار منافسة مع إمكانية الدفع عند الاستلام والتقسيط المريح.'
        ],
        'zid.sa': [
            '🏪 منتج عالي الجودة من منصة زد التجارية الرائدة في المنطقة.',
            '📋 متجر موثوق ومعتمد مع سجل تجاري سعودي ومرخص رسمياً.',
            '📦 شحن آمن وسريع مع تتبع الطلبية وتأمين شامل.',
            '🔄 ضمان الجودة وإمكانية الإرجاع والاستبدال خلال 14 يوم.',
            '🎧 خدمة عملاء محترفة ومتاحة طوال أيام الأسبوع.',
            '🌍 منتج مصمم خصيصاً للعملاء في المنطقة العربية مع مراعاة المعايير المحلية.'
        ]
    };
    
    // تحليل ذكي للمنتج
    const smartAnalysis = generateSmartProductAnalysis(url, productType, productCategory);
    
    // تحليل السوق المحلي
    const marketAnalysis = [
        '\n\n📊 تحليل السوق والفرص التجارية:',
        '• طلب متزايد على هذا النوع من المنتجات في السوق السعودي',
        '• مناسب للثقافة والذوق المحلي مع إمكانيات تسويق واسعة',
        '• فرصة استثمارية ممتازة للمتاجر الإلكترونية والتجار',
        '• إمكانية تحقيق هوامش ربح جيدة مع استراتيجية تسويق صحيحة',
        '• يمكن استهداف شرائح عملاء متنوعة ومختلفة'
    ];
    
    // نصائح تسويقية
    const marketingTips = [
        '\n\n💡 نصائح تسويقية ذكية:',
        '• استخدم صور عالية الجودة تُظهر تفاصيل المنتج',
        '• اكتب وصف مفصل يركز على الفوائد والمميزات',
        '• حدد السعر بناءً على دراسة المنافسين في السوق',
        '• استهدف الكلمات المفتاحية المناسبة لمحركات البحث',
        '• قدم عروض وخصومات جذابة للعملاء الجدد'
    ];
    
    const domainDesc = baseDescriptions[domain] || [
        '🌐 منتج عالي الجودة متوفر عبر الإنترنت من مصدر موثوق.',
        '⚡ مواصفات ممتازة وسعر مناسب مع ضمان الجودة.',
        '🎯 مناسب للاستخدام الشخصي أو التجاري حسب احتياجاتك.',
        '🛡️ جودة مضمونة وخدمة موثوقة مع دعم فني متاح.'
    ];
    
    return domainDesc.join(' ') + '\n\n' + smartAnalysis + marketAnalysis.join('\n') + marketingTips.join('\n');
}

// دالة تحليل نوع المنتج من الرابط
function analyzeProductType(url) {
    const urlLower = url.toLowerCase();
    
    // تحليل الكلمات المفتاحية في الرابط
    if (urlLower.includes('clothing') || urlLower.includes('fashion') || urlLower.includes('shirt') || urlLower.includes('dress')) {
        return 'ملابس وأزياء';
    } else if (urlLower.includes('electronics') || urlLower.includes('phone') || urlLower.includes('laptop') || urlLower.includes('tech')) {
        return 'إلكترونيات وتقنية';
    } else if (urlLower.includes('home') || urlLower.includes('furniture') || urlLower.includes('decor') || urlLower.includes('kitchen')) {
        return 'منزل وديكور';
    } else if (urlLower.includes('beauty') || urlLower.includes('cosmetic') || urlLower.includes('skincare') || urlLower.includes('makeup')) {
        return 'جمال وعناية';
    } else if (urlLower.includes('jewelry') || urlLower.includes('watch') || urlLower.includes('accessory')) {
        return 'مجوهرات وإكسسوارات';
    } else if (urlLower.includes('book') || urlLower.includes('education') || urlLower.includes('learning')) {
        return 'كتب وتعليم';
    } else if (urlLower.includes('sport') || urlLower.includes('fitness') || urlLower.includes('gym')) {
        return 'رياضة ولياقة';
    } else if (urlLower.includes('toy') || urlLower.includes('game') || urlLower.includes('kids') || urlLower.includes('children')) {
        return 'ألعاب وأطفال';
    }
    
    return 'منتج متنوع';
}

// دالة تحليل فئة المنتج
function analyzeProductCategory(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('luxury') || urlLower.includes('premium') || urlLower.includes('exclusive')) {
        return 'فاخر';
    } else if (urlLower.includes('budget') || urlLower.includes('cheap') || urlLower.includes('affordable')) {
        return 'اقتصادي';
    } else if (urlLower.includes('handmade') || urlLower.includes('craft') || urlLower.includes('artisan')) {
        return 'يدوي';
    } else if (urlLower.includes('vintage') || urlLower.includes('antique') || urlLower.includes('retro')) {
        return 'كلاسيكي';
    } else if (urlLower.includes('new') || urlLower.includes('latest') || urlLower.includes('modern')) {
        return 'حديث';
    }
    
    return 'عام';
}

// دالة التحليل الذكي للمنتج
function generateSmartProductAnalysis(url, productType, productCategory) {
    const domain = extractDomainFromUrl(url);
    
    let analysis = `🔍 تحليل ذكي للمنتج:\n`;
    analysis += `• نوع المنتج: ${productType}\n`;
    analysis += `• فئة المنتج: ${productCategory}\n`;
    analysis += `• المنصة: ${domain}\n`;
    
    // تحليل مخصص حسب نوع المنتج
    const typeAnalysis = {
        'ملابس وأزياء': '👗 منتج أزياء يتطلب عرض مقاسات واضحة وصور متعددة الزوايا',
        'إلكترونيات وتقنية': '📱 منتج تقني يحتاج مواصفات فنية دقيقة وضمان واضح',
        'منزل وديكور': '🏠 منتج منزلي يركز على الجودة والتصميم والوظائف العملية',
        'جمال وعناية': '💄 منتج تجميل يتطلب معلومات عن المكونات وطريقة الاستخدام',
        'مجوهرات وإكسسوارات': '💎 منتج فاخر يحتاج صور عالية الجودة وتفاصيل المواد',
        'كتب وتعليم': '📚 منتج تعليمي يركز على المحتوى والفائدة المعرفية',
        'رياضة ولياقة': '🏃‍♂️ منتج رياضي يحتاج معلومات عن الأداء والمتانة',
        'ألعاب وأطفال': '🧸 منتج للأطفال يتطلب معايير أمان وجودة عالية'
    };
    
    analysis += `• ${typeAnalysis[productType] || '🔧 منتج متنوع يحتاج وصف شامل ومفصل'}\n`;
    
    return analysis;
}



function displayProductPreview(productData) {
    const productName = document.getElementById('product-name');
    const productDescription = document.getElementById('product-description');
    const productPreview = document.getElementById('product-preview');
    
    // Handle multiple images
    const images = Array.isArray(productData.image) ? productData.image : [productData.image];
    
    // Counter for loaded images
    let loadedImagesCount = 0;
    const totalImages = images.filter(img => img).length;
    
    // Update image elements with loading notifications
    for (let i = 1; i <= 5; i++) {
        const imgElement = document.getElementById(`preview-img-${i}`);
        if (imgElement) {
            if (images[i-1]) {
                // Add loading event listener
                imgElement.onload = function() {
                    loadedImagesCount++;
                    showImageLoadNotification(loadedImagesCount, totalImages);
                };
                
                // Add error event listener
                imgElement.onerror = function() {
                    showMessage(`فشل في تحميل الصورة ${i}`, 'warning');
                };
                
                imgElement.src = images[i-1];
                imgElement.style.display = 'block';
            } else {
                imgElement.style.display = 'none';
            }
        }
    }
    
    // Update indicators visibility
    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach((indicator, index) => {
        if (images[index]) {
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    });
    
    // Set up image gallery functionality
    setupImageGallery();
    
    if (productName) productName.value = productData.name;
    if (productDescription) productDescription.value = productData.description;
    
    // Set the product price
    const productPrice = document.getElementById('product-price');
    if (productPrice && productData.price) {
        productPrice.value = productData.price;
    }
    
    // Set the product currency
    const productCurrency = document.getElementById('product-currency');
    if (productCurrency && productData.currency) {
        productCurrency.value = productData.currency;
    }
    
    if (productPreview) productPreview.style.display = 'block';
    
    // Show initial notification
    if (totalImages > 0) {
        showMessage(`بدء تحميل ${totalImages} صورة للمنتج...`, 'info');
    }
}

function setupImageGallery() {
    const indicators = document.querySelectorAll('.indicator');
    const images = document.querySelectorAll('.preview-image');
    
    // Remove existing event listeners
    indicators.forEach(indicator => {
        indicator.replaceWith(indicator.cloneNode(true));
    });
    
    // Re-select after cloning
    const newIndicators = document.querySelectorAll('.indicator');
    
    newIndicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            // Remove active class from all
            newIndicators.forEach(ind => ind.classList.remove('active'));
            images.forEach(img => img.classList.remove('active'));
            
            // Add active class to clicked
            indicator.classList.add('active');
            const targetImage = document.getElementById(`preview-img-${index + 1}`);
            if (targetImage) {
                targetImage.classList.add('active');
            }
        });
    });
    
    // Auto-switch images every 3 seconds
    let currentImageIndex = 0;
    const visibleImages = Array.from(images).filter(img => img.style.display !== 'none');
    
    if (visibleImages.length > 1) {
        setInterval(() => {
            currentImageIndex = (currentImageIndex + 1) % visibleImages.length;
            
            // Remove active class from all
            newIndicators.forEach(ind => ind.classList.remove('active'));
            images.forEach(img => img.classList.remove('active'));
            
            // Add active class to current
            if (newIndicators[currentImageIndex]) {
                newIndicators[currentImageIndex].classList.add('active');
            }
            if (visibleImages[currentImageIndex]) {
                visibleImages[currentImageIndex].classList.add('active');
            }
        }, 3000);
    }
}

async function addProduct(event) {
    if (event) event.preventDefault();
    
    const productUrlInput = document.getElementById('product-url');
    const productName = document.getElementById('product-name');
    const productDescription = document.getElementById('product-description');
    const productPrice = document.getElementById('product-price');
    const productCurrency = document.getElementById('product-currency');
    const previewImg = document.getElementById('preview-img');
    const productPreview = document.getElementById('product-preview');
    
    const name = productName ? productName.value.trim() : '';
    const description = productDescription ? productDescription.value.trim() : '';
    const price = productPrice ? parseFloat(productPrice.value) || 0 : 0;
    const currency = productCurrency ? productCurrency.value : 'SAR';
    const url = productUrlInput ? productUrlInput.value.trim() : '';
    
    // Get all preview images
    const images = [];
    for (let i = 1; i <= 5; i++) {
        const img = document.getElementById(`preview-img-${i}`);
        if (img && img.src && img.style.display !== 'none' && !img.src.includes('placeholder')) {
            images.push(img.src);
        }
    }
    const image = images.length > 0 ? images : [previewImg ? previewImg.src : ''];
    
    if (!name || !description || !url) {
        showMessage('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                name,
                description,
                price,
                currency,
                url,
                images: image
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // إعادة تحميل المنتجات من الخادم
            await loadUserData();
            
            // مسح النموذج
            if (productName) productName.value = '';
            if (productDescription) productDescription.value = '';
            if (productPrice) productPrice.value = '';
            if (productCurrency) productCurrency.value = 'SAR';
            if (productUrlInput) productUrlInput.value = '';
            if (previewImg) previewImg.src = '';
            if (productPreview) productPreview.style.display = 'none';
            
            // مسح صور المعاينة
            for (let i = 1; i <= 5; i++) {
                const img = document.getElementById(`preview-img-${i}`);
                if (img) {
                    img.src = '';
                    img.style.display = 'none';
                }
            }
            
            showMessage('تم إضافة المنتج بنجاح!', 'success');
            
            // Refresh products list if currently viewing it
            loadProducts();
        } else {
            showMessage(data.error || 'خطأ في إضافة المنتج', 'error');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}



// Product Display and Management
function loadProducts() {
    console.log('Loading products...');
    console.log('Current products array:', products);
    
    // Apply default filter to show pending products
    const pendingProducts = products.filter(p => !p.status || p.status === 'pending');
    displayProducts(pendingProducts);
}

function displayProducts(productsToShow) {
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '';
    
    if (productsToShow.length === 0) {
        productsGrid.innerHTML = '<div class="no-products">لا توجد منتجات لعرضها</div>';
        return;
    }
    
    productsToShow.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
    
    // Update season dropdowns after creating product cards
    updateAllProductSeasonDropdowns();
}

function createProductCard(product) {
    console.log('Creating product card for:', product);
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Handle multiple images
    const images = Array.isArray(product.image) ? product.image : [product.image];
    const mainImage = images[0] || '/placeholder.svg';
    
    // Create image gallery HTML
    let imageGalleryHTML = '';
    if (images.length > 1) {
        const thumbnailsHTML = images.slice(0, 5).map((img, index) => 
            `<img src="${img}" alt="صورة ${index + 1}" class="thumbnail" onclick="changeMainImage(this, '${product.id}')" onerror="this.style.display='none'">`
        ).join('');
        
        imageGalleryHTML = `
            <div class="image-thumbnails">
                ${thumbnailsHTML}
            </div>
        `;
    }
    
    card.innerHTML = `
        ${product.season ? `<div class="season-name-display">${product.season}</div>` : ''}
        <div class="product-image">
            <img id="main-img-${product.id}" src="${mainImage}" alt="${product.name}" onerror="this.src='/placeholder.svg'">
            ${imageGalleryHTML}
            <div class="product-status-info">
                <div class="status-badge ${product.status === 'approved' ? 'status-approved' : 'status-pending'}">
                    ${getStatusText(product.status)}
                </div>
                ${product.season ? `<div class="current-season-badge">${product.season}</div>` : ''}
            </div>
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            ${product.price ? `<div class="product-price"><i class="fas fa-tag"></i> ${product.price} ${getCurrencySymbol(product.currency || 'SAR')}</div>` : ''}
            ${product.localSave ? `
                <div class="local-save-info">
                    <small style="color: #28a745; font-weight: bold;">
                        <i class="fas fa-folder"></i> محفوظ محلياً: ${product.localSave.saved_count} صورة
                    </small>
                </div>
            ` : ''}

            <div class="product-actions">
                <button class="btn-small btn-success approval-btn" onclick="toggleApproval('${product.id}')" data-product-id="${product.id}">
                    <i class="fas fa-${product.status === 'approved' ? 'times' : 'check'}"></i>
                    ${product.status === 'approved' ? 'إلغاء القبول' : 'قبول'}
                </button>
                <button class="btn-small btn-warning reject-btn" onclick="rejectProduct('${product.id}')" data-product-id="${product.id}">
                    <i class="fas fa-times"></i>
                    رفض
                </button>
                <button class="btn-small btn-primary" onclick="openProductUrl('${product.url}')">
                    <i class="fas fa-eye"></i>
                    عرض
                </button>
                <button class="btn-small btn-danger" onclick="deleteProduct('${product.id}')" data-product-id="${product.id}">
                    <i class="fas fa-trash"></i>
                    حذف
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners as backup
    const deleteBtn = card.querySelector('.btn-danger');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Delete button clicked via event listener');
            const productId = this.getAttribute('data-product-id');
            deleteProduct(productId);
        });
    }
    
    // Add event listener for approval button as backup
    const approvalBtn = card.querySelector('.approval-btn');
    if (approvalBtn) {
        approvalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Approval button clicked via event listener');
            const productId = this.getAttribute('data-product-id');
            console.log('Product ID from data attribute:', productId);
            toggleApproval(productId);
        });
    }
    
    console.log('Product card created successfully');
    return card;
}

// Function to change main image in product card
function changeMainImage(thumbnailImg, productId) {
    const mainImg = document.getElementById(`main-img-${productId}`);
    if (mainImg && thumbnailImg.src) {
        mainImg.src = thumbnailImg.src;
        
        // Add visual feedback
        const thumbnails = thumbnailImg.parentElement.querySelectorAll('.thumbnail');
        thumbnails.forEach(thumb => thumb.classList.remove('active'));
        thumbnailImg.classList.add('active');
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'غير معتمد',
        'approved': 'معتمد',
        'rejected': 'مرفوض'
    };
    return statusMap[status] || 'غير محدد';
}

// دالة تحديد العملة تلقائياً بناءً على الموقع
function detectCurrencyFromUrl(url) {
    try {
        const domain = extractDomainFromUrl(url);
        
        // تحديد العملة بناءً على النطاق (ترتيب الأولوية مهم)
        // المواقع السعودية أولاً
        if (domain.includes('.sa') || domain.includes('salla.sa') || domain.includes('zid.sa') || 
            domain.includes('salla.') || domain.includes('zid.')) {
            return 'SAR'; // ريال سعودي
        }
        // noon.com خاص بالسعودية والإمارات، لكن نعطي أولوية للسعودية
        else if (domain.includes('noon.com') || domain.includes('noon.sa')) {
            return 'SAR'; // ريال سعودي للسعودية
        }
        // باقي الدول العربية
        else if (domain.includes('.ae') || domain.includes('noon.ae')) {
            return 'AED'; // درهم إماراتي
        } else if (domain.includes('.kw')) {
            return 'KWD'; // دينار كويتي
        } else if (domain.includes('.qa')) {
            return 'QAR'; // ريال قطري
        } else if (domain.includes('.bh')) {
            return 'BHD'; // دينار بحريني
        } else if (domain.includes('.om')) {
            return 'OMR'; // ريال عماني
        } else if (domain.includes('.jo')) {
            return 'JOD'; // دينار أردني
        } else if (domain.includes('.eg')) {
            return 'EGP'; // جنيه مصري
        }
        // الدول الأوروبية
        else if (domain.includes('.uk') || domain.includes('.co.uk')) {
            return 'GBP'; // جنيه إسترليني
        } else if (domain.includes('.eu') || domain.includes('.de') || domain.includes('.fr') || domain.includes('.it') || domain.includes('.es')) {
            return 'EUR'; // يورو
        }
        // المواقع الأمريكية والعالمية (آخر أولوية)
        else if (domain.includes('amazon.') || domain.includes('ebay.') || domain.includes('etsy.') || 
                 domain.includes('.com') || domain.includes('.us')) {
            return 'USD'; // دولار أمريكي
        }
        
        // افتراضي: ريال سعودي
        return 'SAR';
    } catch {
        return 'SAR';
    }
}

function getCurrencySymbol(currency) {
    switch(currency) {
        case 'SAR': return 'ريال سعودي';
        case 'USD': return 'دولار أمريكي';
        case 'EUR': return 'يورو';
        case 'GBP': return 'جنيه إسترليني';
        case 'AED': return 'درهم إماراتي';
        case 'KWD': return 'دينار كويتي';
        case 'QAR': return 'ريال قطري';
        case 'BHD': return 'دينار بحريني';
        case 'OMR': return 'ريال عماني';
        case 'JOD': return 'دينار أردني';
        case 'EGP': return 'جنيه مصري';
        default: return currency || 'ريال سعودي';
    }
}

function filterProducts(filter) {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(btn => btn.classList.remove('active'));
    
    // Find and activate the correct tab
    const activeTab = document.querySelector(`.filter-tab[data-filter="${filter}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    let filteredProducts;
    if (filter === 'approved') {
        filteredProducts = products.filter(p => p.status === 'approved');
    } else if (filter === 'disapproved') {
        filteredProducts = products.filter(p => p.status === 'disapproved' || p.status === 'rejected');
    } else if (filter === 'pending') {
        filteredProducts = products.filter(p => p.status === 'pending' || !p.status);
    } else {
        filteredProducts = products;
    }
    
    displayProducts(filteredProducts);
}

// Product Actions
function openProductUrl(url) {
    window.open(url, '_blank');
}

function downloadImages(localPath, productId = null) {
    console.log('Download function called with:', { localPath, productId });
    
    // إذا كان هناك معرف منتج، ابحث عن المنتج وحمل صوره
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            downloadProductImages(product);
            return;
        }
    }
    
    showMessage('سيتم حفظ الصور محلياً', 'info');
}

// وظيفة جديدة لتحميل صور المنتج مباشرة
async function downloadProductImages(product) {
    console.log('Downloading images for product:', product);
    
    if (!product.image) {
        showMessage('لا توجد صور للتحميل', 'error');
        return;
    }
    
    const images = Array.isArray(product.image) ? product.image : [product.image];
    
    showMessage(`جاري إنشاء ملف مضغوط يحتوي على ${images.length} صورة...`, 'info');
    
    // حفظ الصور محلياً باسم المنتج
    saveImagesLocally(product, images);
    
    try {
        const zip = new JSZip();
        let processedCount = 0;
        
        // تحميل جميع الصور وإضافتها للملف المضغوط
        for (let index = 0; index < images.length; index++) {
            const imageUrl = images[index];
            
            try {
                const response = await fetch(imageUrl, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const fileName = `${product.name}_صورة_${index + 1}.jpg`;
                    zip.file(fileName, blob);
                    processedCount++;
                } else {
                    console.log(`فشل في تحميل الصورة ${index + 1}:`, response.status);
                }
            } catch (error) {
                console.log(`خطأ في تحميل الصورة ${index + 1}:`, error);
            }
        }
        
        if (processedCount === 0) {
            showMessage('فشل في تحميل جميع الصور', 'error');
            return;
        }
        
        // إنشاء الملف المضغوط وتحميله
        const zipBlob = await zip.generateAsync({type: 'blob'});
        const zipUrl = window.URL.createObjectURL(zipBlob);
        
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${product.name}_صور.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(zipUrl);
        
        showMessage(`تم تحميل ملف مضغوط يحتوي على ${processedCount} صورة بنجاح`, 'success');
        
    } catch (error) {
        console.error('خطأ في إنشاء الملف المضغوط:', error);
        showMessage('فشل في إنشاء الملف المضغوط', 'error');
    }
}



async function saveImagesLocally(product, imageUrls) {
    try {
        showMessage('بدء حفظ الصور محلياً...', 'info');
        
        const response = await fetch('/save-images-locally', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                product_name: product.name,
                image_urls: imageUrls,
                product_id: product.id,
                season: product.season || 'تم التحميل'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // تحديث معلومات الحفظ المحلي في المنتج
            product.localSave = {
                folder_path: result.folder_path,
                saved_count: result.saved_count,
                saved_at: new Date().toISOString()
            };
            saveProducts();
            loadProducts();
            showMessage(`تم حفظ ${result.saved_count} صورة محلياً في: ${result.folder_path}`, 'success');
        } else {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`فشل في حفظ الصور محلياً: ${response.status}`);
        }
    } catch (error) {
        console.error('Error saving images locally:', error);
        if (error.message.includes('fetch')) {
            showMessage('تعذر الاتصال بالخادم. تأكد من تشغيل الخادم.', 'error');
        } else {
            showMessage(`حدث خطأ أثناء حفظ الصور محلياً: ${error.message}`, 'error');
        }
    }
}

// وظيفة لتحميل جميع صور المنتجات المعتمدة
function downloadAllApprovedImages() {
    const approvedProducts = products.filter(p => p.status === 'approved');
    
    if (approvedProducts.length === 0) {
        showMessage('لا توجد منتجات معتمدة للتحميل', 'error');
        return;
    }
    
    const confirmDownload = confirm(`هل تريد تحميل صور جميع المنتجات المعتمدة؟ (${approvedProducts.length} منتج)`);
    
    if (confirmDownload) {
        showMessage(`بدء تحميل صور ${approvedProducts.length} منتج معتمد...`, 'info');
        
        approvedProducts.forEach((product, index) => {
            setTimeout(() => {
                downloadProductImages(product);
            }, index * 1000); // تأخير ثانية واحدة بين كل منتج
        });
    }
}

async function toggleApproval(productId) {
    console.log('toggleApproval called with productId:', productId);
    console.log('Current products array:', products);
    console.log('Looking for product with ID:', productId, 'Type:', typeof productId);
    
    // تحويل productId إلى رقم إذا كان نص
    const numericProductId = parseInt(productId);
    console.log('Converted productId to:', numericProductId);
    
    // البحث عن المنتج باستخدام كل من النص والرقم
    let product = products.find(p => p.id === productId || p.id === numericProductId);
    
    if (!product) {
        console.error('Product not found with ID:', productId);
        console.log('Available product IDs:', products.map(p => ({id: p.id, type: typeof p.id, name: p.name})));
        
        // محاولة إعادة تحميل البيانات من الخادم
        console.log('Attempting to reload products from server...');
        await loadUserData();
        
        // البحث مرة أخرى بعد إعادة التحميل
        product = products.find(p => p.id === productId || p.id === numericProductId);
        
        if (!product) {
            showMessage('المنتج غير موجود. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
    }
    
    const newStatus = product.status === 'approved' ? 'pending' : 'approved';
    console.log('Changing status from', product.status, 'to', newStatus);
    
    try {
        // تحديث المنتج في قاعدة البيانات
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                status: newStatus
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Server response:', data);
            
            // تحديث البيانات المحلية
            product.status = newStatus;
            saveProducts(); // حفظ احتياطي في localStorage
            
            // إعادة تطبيق الفلتر الحالي
            const activeTab = document.querySelector('.filter-tab.active');
            if (activeTab) {
                const currentFilter = activeTab.getAttribute('data-filter');
                filterProducts(currentFilter);
            } else {
                displayProducts(products);
            }
            
            // لا نغير الفلتر - نترك المستخدم في نفس الصفحة
            
            showMessage(`تم ${newStatus === 'approved' ? 'قبول' : 'إلغاء قبول'} المنتج بنجاح`, 'success');
        } else {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            showMessage(errorData.error || 'خطأ في تحديث حالة المنتج', 'error');
        }
    } catch (error) {
        console.error('Error updating product status:', error);
        
        // في حالة فشل الاتصال، قم بالتحديث محلياً فقط
        product.status = newStatus;
        saveProducts();
        displayProducts(products);
        
        // لا نغير الفلتر - نترك المستخدم في نفس الصفحة
        
        showMessage(`تم ${newStatus === 'approved' ? 'قبول' : 'إلغاء قبول'} المنتج محلياً (خطأ في الاتصال)`, 'warning');
    }
}

async function rejectProduct(productId) {
    console.log('rejectProduct called with productId:', productId);
    
    // تحويل productId إلى رقم إذا كان نص
    const numericProductId = parseInt(productId);
    
    // البحث عن المنتج
    let product = products.find(p => p.id === productId || p.id === numericProductId);
    
    if (!product) {
        console.error('Product not found with ID:', productId);
        
        // محاولة إعادة تحميل البيانات من الخادم
        await loadUserData();
        
        // البحث مرة أخرى بعد إعادة التحميل
        product = products.find(p => p.id === productId || p.id === numericProductId);
        
        if (!product) {
            showMessage('المنتج غير موجود. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }
    }
    
    const newStatus = 'disapproved';
    console.log('Changing status from', product.status, 'to', newStatus);
    
    try {
        // تحديث المنتج في قاعدة البيانات
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                status: newStatus
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Server response:', data);
            
            // تحديث البيانات المحلية
            product.status = newStatus;
            saveProducts();
            
            // إعادة تطبيق الفلتر الحالي
            const activeTab = document.querySelector('.filter-tab.active');
            if (activeTab) {
                const currentFilter = activeTab.getAttribute('data-filter');
                filterProducts(currentFilter);
            } else {
                displayProducts(products);
            }
            
            showMessage('تم رفض المنتج بنجاح', 'success');
        } else {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            showMessage(errorData.error || 'خطأ في رفض المنتج', 'error');
        }
    } catch (error) {
        console.error('Error rejecting product:', error);
        
        // في حالة فشل الاتصال، قم بالتحديث محلياً فقط
        product.status = newStatus;
        saveProducts();
        
        // إعادة تطبيق الفلتر الحالي
        const activeTab = document.querySelector('.filter-tab.active');
        if (activeTab) {
            const currentFilter = activeTab.getAttribute('data-filter');
            filterProducts(currentFilter);
        } else {
            displayProducts(products);
        }
        
        showMessage('تم رفض المنتج محلياً (خطأ في الاتصال)', 'warning');
    }
}

// الدالة المحلية محذوفة - نستخدم الدالة العامة window.deleteProduct فقط

function moveToSeason(productId) {
    const product = products.find(p => p.id === productId);
    if (product && Object.keys(seasons).length > 0) {
        // For demo, assign to first season
        const firstSeason = Object.keys(seasons)[0];
        seasons[firstSeason].push({...product});
        localStorage.setItem('seasons', JSON.stringify(seasons));
        loadSeasons();
        showMessage('تم نقل المنتج إلى المواسم', 'success');
    } else {
        showMessage('لا توجد مواسم متاحة', 'error');
    }
}

async function assignProductToSeason(productId, seasonName) {
    const product = products.find(p => p.id === productId);
    if (product) {
        try {
            // تحديث المنتج في قاعدة البيانات
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    season: seasonName
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Remove from previous season if exists
                if (product.season) {
                    const oldSeasonProducts = seasons[product.season];
                    if (oldSeasonProducts) {
                        const index = oldSeasonProducts.findIndex(p => p.id === productId);
                        if (index > -1) {
                            oldSeasonProducts.splice(index, 1);
                        }
                    }
                }
                
                // Update product season locally
                product.season = seasonName;
                
                // Add to new season if selected
                if (seasonName && seasonName.trim()) {
                    if (!seasons[seasonName]) {
                        seasons[seasonName] = [];
                    }
                    // Check if product is not already in the season
                    const existingProduct = seasons[seasonName].find(p => p.id === productId);
                    if (!existingProduct) {
                        seasons[seasonName].push({...product});
                    }
                }
                
                saveProducts();
                localStorage.setItem('seasons', JSON.stringify(seasons));
                displaySeasonalProducts();
                
                // تحديث العرض المرئي للمنتج فوراً
                displayProducts(products);
                
                showMessage(`تم تعيين المنتج للمناسبة: ${seasonName || 'بدون مناسبة'}`, 'success');
            } else {
                showMessage(data.error || 'خطأ في تحديث المنتج', 'error');
            }
        } catch (error) {
            console.error('Error updating product season:', error);
            showMessage('خطأ في الاتصال بالخادم', 'error');
        }
    }
}

// Seasonal Products Functions
async function loadSeasons() {
    try {
        const response = await fetch('/api/seasons', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update seasons object with data from server
            const serverSeasons = {};
            data.seasons.forEach(seasonName => {
                serverSeasons[seasonName] = seasons[seasonName] || [];
            });
            
            seasons = serverSeasons;
            localStorage.setItem('seasons', JSON.stringify(seasons));
        }
    } catch (error) {
        console.error('Error loading seasons:', error);
    }
    
    updateSeasonSelect();
    displaySeasonsList();
    displaySeasonalProducts();
}

function updateSeasonSelect() {
    if (!seasonSelect) return;
    
    // Clear all options and keep only the default option
    seasonSelect.innerHTML = '<option value="all">جميع المواسم</option>';
    
    // Add season options
    Object.keys(seasons).forEach(seasonName => {
        const option = document.createElement('option');
        option.value = seasonName;
        option.textContent = seasonName;
        seasonSelect.appendChild(option);
    });
}

function updateAllProductSeasonDropdowns() {
    const allSeasonDropdowns = document.querySelectorAll('.season-dropdown');
    
    allSeasonDropdowns.forEach(dropdown => {
        const currentValue = dropdown.value;
        // Clear all options and keep only the default option
        dropdown.innerHTML = '<option value="">اختر المناسبة</option>';
        
        // Add season options
        Object.keys(seasons).forEach(seasonName => {
            const option = document.createElement('option');
            option.value = seasonName;
            option.textContent = seasonName;
            dropdown.appendChild(option);
        });
        
        // Restore previous value if it still exists
        if (currentValue && seasons[currentValue]) {
            dropdown.value = currentValue;
        }
    });
}

function displaySeasonsList() {
    const seasonsList = document.getElementById('seasons-list');
    if (!seasonsList) return;
    
    seasonsList.innerHTML = '';
    
    if (Object.keys(seasons).length === 0) {
        seasonsList.innerHTML = '<div class="no-products">لا توجد مواسم محفوظة</div>';
        return;
    }
    
    Object.keys(seasons).forEach(seasonName => {
        const seasonItem = document.createElement('div');
        seasonItem.className = 'season-item';
        
        const productCount = seasons[seasonName].length;
        
        seasonItem.innerHTML = `
            <div class="season-name">${seasonName}</div>
            <div class="season-count">(${productCount} منتج)</div>
            <div class="season-actions">
                <button class="btn-edit" onclick="editSeason('${seasonName}')">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn-delete" onclick="deleteSeason('${seasonName}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        
        seasonsList.appendChild(seasonItem);
    });
}

let currentEditingSeason = null;

function editSeason(seasonName) {
    currentEditingSeason = seasonName;
    const editModal = document.getElementById('edit-season-modal');
    const editInput = document.getElementById('edit-season-name');
    
    if (editInput) {
        editInput.value = seasonName;
    }
    
    if (editModal) {
        editModal.style.display = 'block';
    }
}

async function saveEditedSeason() {
    const editInput = document.getElementById('edit-season-name');
    const editModal = document.getElementById('edit-season-modal');
    
    if (!editInput || !currentEditingSeason) return;
    
    const newName = editInput.value.trim();
    
    if (!newName) {
        showMessage('يرجى إدخال اسم الموسم الجديد', 'error');
        return;
    }
    
    if (newName === currentEditingSeason) {
        editModal.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/seasons/${encodeURIComponent(currentEditingSeason)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ new_name: newName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update season name locally
            seasons[newName] = seasons[currentEditingSeason];
            delete seasons[currentEditingSeason];
            
            // Update products that reference this season
            products.forEach(product => {
                if (product.season === currentEditingSeason) {
                    product.season = newName;
                }
            });
            
            localStorage.setItem('seasons', JSON.stringify(seasons));
            saveProducts();
            
            editInput.value = '';
            editModal.style.display = 'none';
            currentEditingSeason = null;
            
            updateSeasonSelect();
            updateAllProductSeasonDropdowns();
            displaySeasonsList();
            displaySeasonalProducts();
            
            showMessage('تم تعديل اسم الموسم بنجاح!', 'success');
        } else {
            showMessage(data.error || 'خطأ في تعديل الموسم', 'error');
        }
    } catch (error) {
        console.error('Error updating season:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteSeason(seasonName) {
    if (confirm(`هل أنت متأكد من حذف موسم "${seasonName}"؟\nسيتم إزالة جميع المنتجات من هذا الموسم.`)) {
        try {
            const response = await fetch(`/api/seasons/${encodeURIComponent(seasonName)}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Remove season reference from products locally
                products.forEach(product => {
                    if (product.season === seasonName) {
                        product.season = null;
                    }
                });
                
                // Delete the season locally
                delete seasons[seasonName];
                
                localStorage.setItem('seasons', JSON.stringify(seasons));
                saveProducts();
                
                updateSeasonSelect();
                updateAllProductSeasonDropdowns();
                displaySeasonsList();
                displaySeasonalProducts();
                
                showMessage('تم حذف الموسم بنجاح!', 'success');
            } else {
                showMessage(data.error || 'خطأ في حذف الموسم', 'error');
            }
        } catch (error) {
            console.error('Error deleting season:', error);
            showMessage('خطأ في الاتصال بالخادم', 'error');
        }
    }
}

// Make season functions globally available
window.deleteSeason = deleteSeason;
window.editSeason = editSeason;

function displaySeasonalProducts(selectedSeason = null) {
    if (!seasonProductsGrid) return;
    
    seasonProductsGrid.innerHTML = '';
    
    if (selectedSeason) {
        const seasonProducts = seasons[selectedSeason] || [];
        if (seasonProducts.length === 0) {
            seasonProductsGrid.innerHTML = '<div class="no-products">لا توجد منتجات في هذا الموسم</div>';
            return;
        }
        
        seasonProducts.forEach(product => {
            const productCard = createSeasonalProductCard(product, selectedSeason);
            seasonProductsGrid.appendChild(productCard);
        });
    } else {
        // Display all seasons
        Object.keys(seasons).forEach(seasonName => {
            if (seasons[seasonName].length > 0) {
                const seasonSection = document.createElement('div');
                seasonSection.className = 'season-section';
                seasonSection.innerHTML = `
                    <h3 class="season-title">${seasonName}</h3>
                    <div class="modern-grid"></div>
                `;
                
                const seasonProductsContainer = seasonSection.querySelector('.modern-grid');
                seasons[seasonName].forEach(product => {
                    const productCard = createSeasonalProductCard(product, seasonName);
                    seasonProductsContainer.appendChild(productCard);
                });
                
                seasonProductsGrid.appendChild(seasonSection);
            }
        });
        
        if (seasonProductsGrid.children.length === 0) {
            seasonProductsGrid.innerHTML = '<div class="no-products">لا توجد منتجات موسمية</div>';
        }
    }
}

function createSeasonalProductCard(product, seasonName) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    card.innerHTML = `
        <div class="product-image">
            <img src="${product.image}" alt="${product.name}" onerror="this.src='/placeholder.svg'">
            <div class="season-badge">${seasonName}</div>
            <div class="status-badge ${product.status === 'approved' ? 'status-approved' : 'status-pending'}">
                ${getStatusText(product.status)}
            </div>
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            ${product.price ? `<div class="product-price"><i class="fas fa-tag"></i> ${product.price} ${getCurrencySymbol(product.currency || 'SAR')}</div>` : ''}
            <div class="product-actions">
                <button class="btn-small btn-primary" onclick="openProductUrl('${product.url}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="btn-small btn-danger" onclick="removeFromSeason('${product.id}', '${seasonName}')">
                    <i class="fas fa-times"></i> إزالة
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function filterSeasonalProducts(seasonName) {
    displaySeasonalProducts(seasonName);
}

// Add new season
function addNewSeason(seasonName) {
    if (!seasons[seasonName]) {
        seasons[seasonName] = [];
        localStorage.setItem('seasons', JSON.stringify(seasons));
        updateSeasonSelect();
        showMessage('تم إضافة الموسم بنجاح', 'success');
    } else {
        showMessage('هذا الموسم موجود بالفعل', 'error');
    }
}

function removeFromSeason(productId, seasonName) {
    if (seasons[seasonName]) {
        seasons[seasonName] = seasons[seasonName].filter(p => p.id !== productId);
        localStorage.setItem('seasons', JSON.stringify(seasons));
        displaySeasonalProducts();
        showMessage('تم إزالة المنتج من الموسم', 'success');
    }
}

// Season Management
async function saveSeason() {
    const nameInput = document.getElementById('season-name');
    const seasonModal = document.getElementById('season-modal');
    
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    
    if (!name) {
        showMessage('يرجى إدخال اسم الموسم', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/seasons', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ name: name })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Add to local seasons object for immediate UI update
            seasons[name] = [];
            localStorage.setItem('seasons', JSON.stringify(seasons));
            
            // Reset form
            nameInput.value = '';
            
            if (seasonModal) {
                seasonModal.style.display = 'none';
            }
            
            updateSeasonSelect();
            updateAllProductSeasonDropdowns();
            displaySeasonsList();
            showMessage(`تم إضافة الموسم "${name}" بنجاح! يمكنك الآن رؤيته في صفحة المنتجات.`, 'success');
            
            // Show notification about new season in products page
            setTimeout(() => {
                showMessage('الموسم الجديد متاح الآن في صفحة المنتجات - استخدم زر "تغيير الموسم"', 'info');
            }, 2000);
        } else {
            showMessage(data.error || 'خطأ في إضافة الموسم', 'error');
        }
    } catch (error) {
        console.error('Error saving season:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

// Utility Functions
function saveProducts() {
    // حفظ نسخة احتياطية في localStorage للتوافق مع الكود الموجود
    console.log('Saving products to localStorage as backup:', products);
    try {
        localStorage.setItem('products', JSON.stringify(products));
        console.log('Products saved to localStorage as backup');
    } catch (error) {
        console.error('Error saving products to localStorage:', error);
    }
}

function showMessage(message, type) {
    // Remove existing messages of the same type (except for info messages)
    if (type !== 'info') {
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Add styles based on type
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
        margin-bottom: 10px;
    `;
    
    // Set background color based on type
    if (type === 'success') {
        messageDiv.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        messageDiv.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else if (type === 'warning') {
        messageDiv.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else if (type === 'info') {
        messageDiv.style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
    } else {
        messageDiv.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after specified time
    const timeout = type === 'info' ? 2000 : 3000;
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                messageDiv.remove();
            }, 300);
        }
    }, timeout);
}

// Function to show image loading notifications
function showImageLoadNotification(loadedCount, totalCount) {
    if (loadedCount === totalCount) {
        showMessage(`تم تحميل جميع الصور بنجاح! (${totalCount}/${totalCount})`, 'success');
    } else {
        showMessage(`تم تحميل ${loadedCount} من ${totalCount} صور`, 'info');
    }
}

// Add CSS for season badge and notifications
const style = document.createElement('style');
style.textContent = `
    .season-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(102, 126, 234, 0.9);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 15px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    .product-image {
        position: relative;
    }
    
    .no-products {
        text-align: center;
        padding: 3rem;
        color: #666;
        font-size: 1.1rem;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Demo Data
function loadDemoData() {
    const demoProducts = [
        {
            id: '1',
            name: 'فستان صيفي أنيق',
            description: 'فستان صيفي مريح ومناسب للمناسبات اليومية، مصنوع من قماش قطني عالي الجودة',
            url: 'https://example.com/dress1',
            image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&h=200&fit=crop',
            status: 'pending',
            approved: false,
            driveLink: 'https://drive.google.com/drive/folders/demo1',
            dateAdded: new Date().toLocaleDateString('ar-SA')
        },
        {
            id: '2',
            name: 'حقيبة يد عصرية',
            description: 'حقيبة يد أنيقة مناسبة للعمل والمناسبات الرسمية، مصنوعة من الجلد الطبيعي',
            url: 'https://example.com/bag1',
            image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=200&fit=crop',
            status: 'approved',
            approved: true,
            driveLink: 'https://drive.google.com/drive/folders/demo2',
            dateAdded: new Date().toLocaleDateString('ar-SA')
        },
        {
            id: '3',
            name: 'حذاء رياضي مريح',
            description: 'حذاء رياضي عالي الجودة مناسب للجري والأنشطة الرياضية المختلفة',
            url: 'https://example.com/shoes1',
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop',
            status: 'pending',
            approved: false,
            driveLink: 'https://drive.google.com/drive/folders/demo3',
            dateAdded: new Date().toLocaleDateString('ar-SA')
        },
        {
            id: '4',
            name: 'ساعة ذكية متطورة',
            description: 'ساعة ذكية بتقنيات متقدمة لتتبع الصحة واللياقة البدنية',
            url: 'https://example.com/watch1',
            image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=200&fit=crop',
            status: 'approved',
            approved: true,
            driveLink: 'https://drive.google.com/drive/folders/demo4',
            dateAdded: new Date().toLocaleDateString('ar-SA')
        }
    ];
    
    products.push(...demoProducts);
    saveProducts();
    
    // No predefined seasons - user will add them manually
    localStorage.setItem('seasons', JSON.stringify(seasons));
}

// Setup description action buttons functionality
function setupDescriptionActionButtons() {
    const regenerateBtn = document.getElementById('regenerate-description');
    const summarizeBtn = document.getElementById('summarize-description');
    const enhanceBtn = document.getElementById('enhance-description');
    const translateBtn = document.getElementById('translate-description');
    
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', regenerateDescription);
    }
    
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', summarizeDescription);
    }
    
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', enhanceDescription);
    }
    
    if (translateBtn) {
        translateBtn.addEventListener('click', translateDescription);
    }
}

// Regenerate product description
async function regenerateDescription() {
    const urlInput = document.getElementById('product-url');
    const descriptionTextarea = document.getElementById('product-description');
    const regenerateBtn = document.getElementById('regenerate-description');
    
    if (!urlInput.value.trim()) {
        showMessage('يرجى إدخال رابط المنتج أولاً', 'error');
        return;
    }
    
    // Show loading state
    regenerateBtn.classList.add('loading');
    regenerateBtn.disabled = true;
    
    try {
        const newDescription = generateProductDescription(urlInput.value.trim());
        descriptionTextarea.value = newDescription;
        showMessage('تم إعادة توليد الوصف بنجاح', 'success');
    } catch (error) {
        console.error('Error regenerating description:', error);
        showMessage('حدث خطأ في إعادة توليد الوصف', 'error');
    } finally {
        regenerateBtn.classList.remove('loading');
        regenerateBtn.disabled = false;
    }
}

// Summarize current description
async function summarizeDescription() {
    const descriptionTextarea = document.getElementById('product-description');
    const summarizeBtn = document.getElementById('summarize-description');
    
    if (!descriptionTextarea.value.trim()) {
        showMessage('لا يوجد وصف لتلخيصه', 'error');
        return;
    }
    
    // Show loading state
    summarizeBtn.classList.add('loading');
    summarizeBtn.disabled = true;
    
    try {
        const currentDescription = descriptionTextarea.value.trim();
        const summarized = summarizeText(currentDescription);
        descriptionTextarea.value = summarized;
        showMessage('تم تلخيص الوصف بنجاح', 'success');
    } catch (error) {
        console.error('Error summarizing description:', error);
        showMessage('حدث خطأ في تلخيص الوصف', 'error');
    } finally {
        summarizeBtn.classList.remove('loading');
        summarizeBtn.disabled = false;
    }
}

// Enhance current description
async function enhanceDescription() {
    const descriptionTextarea = document.getElementById('product-description');
    const enhanceBtn = document.getElementById('enhance-description');
    
    if (!descriptionTextarea.value.trim()) {
        showMessage('لا يوجد وصف لتحسينه', 'error');
        return;
    }
    
    // Show loading state
    enhanceBtn.classList.add('loading');
    enhanceBtn.disabled = true;
    
    try {
        const currentDescription = descriptionTextarea.value.trim();
        const enhanced = enhanceText(currentDescription);
        descriptionTextarea.value = enhanced;
        showMessage('تم تحسين الوصف بنجاح', 'success');
    } catch (error) {
        console.error('Error enhancing description:', error);
        showMessage('حدث خطأ في تحسين الوصف', 'error');
    } finally {
        enhanceBtn.classList.remove('loading');
        enhanceBtn.disabled = false;
    }
}

// Translate description
async function translateDescription() {
    const descriptionTextarea = document.getElementById('product-description');
    const translateBtn = document.getElementById('translate-description');
    
    if (!descriptionTextarea.value.trim()) {
        showMessage('لا يوجد وصف للترجمة', 'error');
        return;
    }
    
    // Show loading state
    translateBtn.classList.add('loading');
    translateBtn.disabled = true;
    
    try {
        const currentDescription = descriptionTextarea.value.trim();
        const translated = translateText(currentDescription);
        descriptionTextarea.value = translated;
        showMessage('تم ترجمة الوصف بنجاح', 'success');
    } catch (error) {
        console.error('Error translating description:', error);
        showMessage('حدث خطأ في ترجمة الوصف', 'error');
    } finally {
        translateBtn.classList.remove('loading');
        translateBtn.disabled = false;
    }
}

// Helper function to summarize text
function summarizeText(text) {
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 3) {
        return text; // Already short enough
    }
    
    // Take first sentence, middle sentence, and last sentence
    const firstSentence = sentences[0].trim();
    const middleIndex = Math.floor(sentences.length / 2);
    const middleSentence = sentences[middleIndex].trim();
    const lastSentence = sentences[sentences.length - 1].trim();
    
    return `${firstSentence}. ${middleSentence}. ${lastSentence}.`;
}

// Helper function to enhance text
function enhanceText(text) {
    // Add marketing enhancements
    const enhancements = [
        '✨ منتج عالي الجودة',
        '🚀 توصيل سريع',
        '💎 تصميم أنيق ومميز',
        '🔥 عرض محدود',
        '⭐ تقييم ممتاز من العملاء',
        '🎯 مناسب للسوق السعودي',
        '💯 ضمان الجودة'
    ];
    
    // Add random enhancements
    const selectedEnhancements = enhancements
        .sort(() => 0.5 - Math.random())
        .slice(0, 2)
        .join(' | ');
    
    return `${text}\n\n${selectedEnhancements}\n\nمميزات إضافية:\n• جودة عالية ومضمونة\n• مناسب للاستخدام اليومي\n• تصميم عصري يناسب جميع الأذواق`;
}

// Helper function to translate text (basic implementation)
function translateText(text) {
    // Simple translation patterns (Arabic to English and vice versa)
    const translations = {
        // Arabic to English
        'منتج': 'Product',
        'جودة عالية': 'High Quality',
        'تصميم أنيق': 'Elegant Design',
        'توصيل سريع': 'Fast Delivery',
        'السوق السعودي': 'Saudi Market',
        'عرض محدود': 'Limited Offer',
        'ضمان الجودة': 'Quality Guarantee',
        
        // English to Arabic
        'Product': 'منتج',
        'High Quality': 'جودة عالية',
        'Elegant Design': 'تصميم أنيق',
        'Fast Delivery': 'توصيل سريع',
        'Saudi Market': 'السوق السعودي',
        'Limited Offer': 'عرض محدود',
        'Quality Guarantee': 'ضمان الجودة'
    };
    
    let translatedText = text;
    
    // Apply translations
    Object.entries(translations).forEach(([from, to]) => {
        const regex = new RegExp(from, 'gi');
        translatedText = translatedText.replace(regex, to);
    });
    
    // If no translation occurred, detect language and provide appropriate message
    if (translatedText === text) {
        const isArabic = /[\u0600-\u06FF]/.test(text);
        if (isArabic) {
            translatedText = `English Translation: ${text}\n\n(Note: This is a basic translation. For professional translation, please use specialized services.)`;
        } else {
            translatedText = `الترجمة العربية: ${text}\n\n(ملاحظة: هذه ترجمة أساسية. للترجمة المهنية، يرجى استخدام خدمات متخصصة.)`;
        }
    }
    
    return translatedText;
}