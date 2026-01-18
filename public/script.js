const searchInput = document.getElementById('main-search');
const searchBtn = document.getElementById('main-search-btn');
const loginBtn = document.getElementById('login-btn');
const folderToggles = document.querySelectorAll('.folder-toggle');

const appLayout = document.querySelector('.app-layout'); // Main layout
const mainNavbar = document.querySelector('.navbar'); // Main navbar

const categoryItems = document.querySelectorAll('.category-item');

// Auth Switchers
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');

// Portal Elements
const portalNavItems = document.querySelectorAll('.nav-item[data-target]');
const portalViews = document.querySelectorAll('.portal-view');
const navAdminDashboard = document.getElementById('nav-admin-dashboard');
const dashTabs = document.querySelectorAll('.dash-tab');
const dashPanels = document.querySelectorAll('.dashboard-panel');

const fileList = document.getElementById('file-list');
const currentPath = document.getElementById('current-path');
const currentSubtext = document.getElementById('current-subtext');

const viewerCanvas = document.getElementById('viewer-canvas');
const viewerFilename = document.getElementById('viewer-filename');
const zoomLevelText = document.getElementById('zoom-level');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const printBtn = document.getElementById('print-btn');
const downloadBtn = document.getElementById('download-btn');

// Summary Elements
const viewerSummaryPanel = document.getElementById('viewer-summary-panel');
const viewerSummaryContainer = document.getElementById('viewer-summary-container');

let currentZoom = 100;
let allDocuments = []; // Global state for searchable documents
let currentFilteredDocs = [];
let isGlobalSearch = false;
let currentOpenDoc = null;
let currentSortOrder = 'desc'; // Default: Newest first
let selectedFiles = [];
let currentUser = null;

// Portal & Upload Elements
const uploadPage = document.getElementById('upload-page');
const logoutBtn = document.getElementById('logout-btn');
const uploadBox = document.getElementById('upload-box');
const fileInput = document.getElementById('file-input');
const uploadFileList = document.getElementById('upload-file-list');
const uploadSummary = document.getElementById('upload-summary');
const fileCount = document.getElementById('file-count');
const totalSize = document.getElementById('total-size');
const uploadBtn = document.getElementById('upload-btn');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const ocrConfirm = document.getElementById('ocr-confirm-checkbox');
const toastContainer = document.getElementById('toast-container');

// Login Modal Elements
const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.getElementById('close-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const modalTabs = document.querySelectorAll('.modal-tab');
const tabViews = document.querySelectorAll('.tab-view');

// Admin Panel Elements
const adminPanel = document.getElementById('admin-panel');
const userTableBody = document.getElementById('user-table-body');
const portalBackBtn = document.getElementById('portal-back-btn');
const mainLogoutBtn = document.getElementById('main-logout-btn');
const mainPortalBtn = document.getElementById('main-portal-btn');
const globalUserDisplay = document.getElementById('global-user-display');
const globalUserName = document.getElementById('global-user-name');
const portalUserName = document.getElementById('current-user-name');
const adminTabs = document.querySelectorAll('.admin-tab');
const adminTabViews = document.querySelectorAll('.admin-tab-view');
const adminDocTableBody = document.getElementById('admin-doc-table-body');
const adminPagination = document.getElementById('admin-doc-pagination');
const adminYearSelect = document.getElementById('admin-year-select');
let adminDocsPage = 1;
let adminDocsFiltered = [];
const adminDocsLimit = 10;
let currentAdminCategory = 'all';

function mapDocData(doc) {
    // Priority 1: Extract year from RPO number (source of truth for organization)
    let docYear = null;
    if (doc.rpo_number) {
        const rpoYearMatch = doc.rpo_number.match(/20\d{2}/);
        if (rpoYearMatch) docYear = rpoYearMatch[0];
    }

    // Priority 2: Use database doc_year if RPO extraction failed
    if (!docYear && doc.doc_year) {
        docYear = doc.doc_year.toString();
    }

    // Priority 3: Extract from filename
    if (!docYear && doc.original_filename) {
        const fileNameYearMatch = doc.original_filename.match(/20\d{2}/);
        if (fileNameYearMatch) docYear = fileNameYearMatch[0];
    }

    // Final Fallback: Use upload date
    if (!docYear) {
        docYear = new Date(doc.upload_date).getFullYear().toString();
    }

    // Use extracted content summary if available, otherwise fallback to metadata description
    let displayContent = doc.content_summary || `Uploaded by ${doc.uploaded_by || 'Unknown'}.`;

    let docSubject = doc.subject || 'Official DOH Document';

    return {
        id: doc.id,
        name: doc.original_filename,
        filename: doc.filename,
        year: docYear,
        category: doc.filetype || 'unsorted',
        filetype: doc.filetype || 'unsorted',
        date: new Date(doc.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        size: formatFileSize(doc.file_size),
        rpo_number: doc.rpo_number,
        subject: docSubject,
        content_summary: doc.content_summary,
        url: `/files/${doc.filename}`,
        content: displayContent,
        timestamp: new Date(doc.upload_date).getTime()
    };
}

function getCategoryDisplayLabel(cat) {
    if (!cat || cat === 'unsorted') return 'Untagged';
    if (cat === 'rpo') return 'RPO';
    if (cat === 'advisory') return 'Advisory';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
}

async function initGlobalRepository() {
    // Load REAL documents from database
    await loadUploadedDocuments();

    // Re-apply current view to ensure UI is in sync with data
    if (isGlobalSearch && searchInput.value.trim()) {
        performMainSearch();
    } else {
        const activeItem = document.querySelector('.category-item.active');
        if (activeItem) {
            const year = activeItem.closest('.folder-item').dataset.year;
            const category = activeItem.dataset.category;
            filterByFolder(year, category);
        }
    }

    // Clean up viewer if the document we were looking at is gone
    if (currentOpenDoc) {
        const docExists = allDocuments.some(d => d.id === currentOpenDoc.id);
        if (!docExists) {
            currentOpenDoc = null;
            viewerCanvas.innerHTML = `
                <div class="viewer-placeholder">
                    <i class="fa-solid fa-file-invoice"></i>
                    <p>Select a document to preview</p>
                </div>
            `;
            viewerFilename.textContent = 'No document selected';
            viewerSummaryPanel.classList.add('hidden');
        }
    }
}

async function loadUploadedDocuments() {
    try {
        const response = await fetch('/api/documents');
        const result = await response.json();

        if (result.success && result.data) {
            allDocuments = result.data.map(mapDocData);
            console.log(`✅ Repository loaded: ${allDocuments.length} documents from database`);

            // Real-time update: Refresh dashboard stats if they exist
            if (typeof loadStats === 'function') {
                const docStat = document.getElementById('stat-total-docs');
                if (docStat) docStat.textContent = allDocuments.length;
            }

            // Sync the sidebar folders with current documents
            renderSidebarFolders();
        }
    } catch (error) {
        console.error('Failed to load real documents:', error);
    }
}

// Redundant call removed

// DYNAMIC SIDEBAR RENDERING
function renderSidebarFolders() {
    const yearList = document.getElementById('year-list');
    if (!yearList) return;

    // Get unique years from all documents
    let years = [...new Set(allDocuments.map(d => d.year))];

    // Explicitly ensure 2025 and 2026 are present as requested
    if (!years.includes('2025')) years.push('2025');
    if (!years.includes('2026')) years.push('2026');

    // Sort years descending
    years.sort((a, b) => b - a);

    // Remember which years were expanded
    const expandedYears = Array.from(document.querySelectorAll('.folder-item.expanded')).map(el => el.dataset.year);
    const activeState = {
        year: document.querySelector('.category-item.active')?.closest('.folder-item')?.dataset.year,
        category: document.querySelector('.category-item.active')?.querySelector('span')?.textContent.toLowerCase()
    };

    yearList.innerHTML = years.map(year => {
        // Get categories present in this year
        const categoriesInYear = [...new Set(allDocuments.filter(d => String(d.year) === String(year)).map(d => d.category))];

        // Ensure 'rpo' is always shown if year is 2025/2026? Or just show what exists.
        // Let's show categories that exist + 'rpo' by default for empty years
        if (categoriesInYear.length === 0) categoriesInYear.push('rpo');

        const subfoldersHtml = categoriesInYear.map(cat => {
            const displayLabel = getCategoryDisplayLabel(cat);

            return `
                <li class="category-item ${activeState.year === year && activeState.category === cat ? 'active' : ''}" data-category="${cat}">
                    <i class="fa-solid fa-folder"></i>
                    <span>${displayLabel}</span>
                </li>
            `;
        }).join('');

        return `
            <li class="folder-item ${expandedYears.includes(year) ? 'expanded' : ''}" data-year="${year}">
                <div class="folder-toggle">
                    <i class="fa-solid fa-chevron-right toggle-icon"></i>
                    <i class="fa-solid fa-folder"></i>
                    <span>${year}</span>
                </div>
                <ul class="sub-folder">
                    ${subfoldersHtml}
                </ul>
            </li>
        `;
    }).join('');

    // Re-bind listeners
    yearList.querySelectorAll('.folder-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const parent = toggle.parentElement;
            parent.classList.toggle('expanded');
        });
    });

    yearList.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const year = item.closest('.folder-item').dataset.year;
            const category = item.dataset.category;
            const displayLabel = item.querySelector('span').textContent;

            currentPath.textContent = `${year} > ${displayLabel}`;
            currentSubtext.textContent = `Viewing resources for ${displayLabel} in ${year}`;

            isGlobalSearch = false;
            searchInput.value = '';
            filterByFolder(year, category);
        });
    });
}

function filterByFolder(year, category) {
    currentFilteredDocs = allDocuments.filter(doc =>
        String(doc.year) === String(year) && String(doc.category) === String(category)
    );
    renderDocuments(currentFilteredDocs);
}

function renderDocuments(docs) {
    fileList.innerHTML = '';
    if (docs.length === 0) {
        fileList.innerHTML = `
                <div class="empty-state search-empty">
                    <div class="empty-icon">
                        <i class="fa-solid fa-circle-exclamation"></i>
                    </div>
                    <h3>No documents found</h3>
                    <p>No RPO documents matched your criteria.</p>
                </div>
            `;
        return;
    }

    // Apply Sorting
    const sortedDocs = [...docs].sort((a, b) => {
        if (currentSortOrder === 'desc') {
            return b.timestamp - a.timestamp;
        } else {
            return a.timestamp - b.timestamp;
        }
    });

    sortedDocs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'file-card';
        const contextLabel = isGlobalSearch ? `<div style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600; margin-bottom: 4px;">${doc.year} > ${getCategoryDisplayLabel(doc.category)}</div>` : '';

        card.innerHTML = `
                <i class="fa-solid fa-file-pdf"></i>
                <div class="file-info">
                    ${contextLabel}
                    <span class="file-name" style="font-weight: 700; color: var(--text-main); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">
                        ${doc.subject || doc.name}
                    </span>
                    <span class="file-meta" style="margin-top: 6px; display: block;">
                        ${doc.rpo_number ? `<span style="color: var(--primary-color); font-weight: 700;">${doc.rpo_number}</span> • ` : ''}
                        ${doc.name} • ${doc.size}
                    </span>
                    <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 500; margin-top: 6px;">
                        Uploaded: ${doc.date}
                    </div>
                </div>
            `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.file-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            openDocument(doc);
        });
        fileList.appendChild(card);
    });
}

function renderSmartSummary(content) {
    if (!viewerSummaryContainer || !currentOpenDoc) return;

    // Clear and reset scroll
    viewerSummaryContainer.innerHTML = '';
    viewerSummaryPanel.scrollTop = 0;

    const card = document.createElement('div');
    card.className = 'smart-summary-card';

    // 1. PREMIUM HEADER (Subject & RPO Meta)
    const isAdvisory = currentOpenDoc.filetype === 'advisory';
    const tag1 = isAdvisory ? 'Official Advisory' : 'Official Order';
    const tag2 = isAdvisory ? `Date: ${currentOpenDoc.date}` : `RPO: ${currentOpenDoc.rpo_number || 'NONE'}`;

    card.innerHTML = `
        <div class="smart-summary-header">
            <div class="summary-icon-circle"><i class="fa-solid fa-bolt"></i></div>
            <span>SMART SUMMARY</span>
        </div>
        <div class="summary-doc-identity" style="padding: 1.5rem 1.5rem 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border); background: var(--surface-white);">
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.75rem;">
                <span class="summary-tag-primary">${tag1}</span>
                <span class="summary-tag-neutral">${tag2}</span>
            </div>
            <h3 style="font-size: 1.1rem; color: var(--text-main); font-weight: 700; line-height: 1.4; margin: 0;">
                ${currentOpenDoc.subject || (isAdvisory ? 'Official Health Advisory' : 'Official Regional Personnel Order')}
            </h3>
        </div>
        <div class="summary-sections-container" id="summary-sections-root"></div>
    `;

    const sectionsRoot = card.querySelector('#summary-sections-root');
    const sections = [];

    // 2. OVERVIEW (From Database Summary)
    if (currentOpenDoc.content_summary) {
        const overviewEl = document.createElement('div');
        overviewEl.className = 'summary-section';
        overviewEl.style.marginBottom = '2rem';
        overviewEl.innerHTML = `
            <div class="summary-section-title">
                <div class="summary-section-dot"></div>
                <span>Overview</span>
            </div>
            <p class="summary-text">
                ${currentOpenDoc.content_summary}
            </p>
        `;
        sectionsRoot.appendChild(overviewEl);
    } else if (content && content.length > 20) {
        // Fallback to parsing content if no explicit summary exists
        const pattern = /(Context:|Subject:|Event Information:|Location:|Schedule:)/gi;
        const parts = content.split(pattern);

        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i += 2) {
                const title = parts[i].trim();
                const body = parts[i + 1] ? parts[i + 1].trim() : '';
                if (title.toLowerCase().includes('subject')) continue;
                if (body) sections.push({ title, body });
            }
        } else {
            sections.push({ title: 'Context:', body: content });
        }
    }

    // Sort sections: Event Info, then Location
    const order = ['Event Information:', 'Location:'];
    sections.sort((a, b) => {
        let indexA = order.indexOf(a.title);
        let indexB = order.indexOf(b.title);
        if (indexA === -1) indexA = 99;
        if (indexB === -1) indexB = 99;
        return indexA - indexB;
    });

    sections.forEach(sec => {
        const secEl = document.createElement('div');
        secEl.className = 'summary-section';
        secEl.style.marginBottom = '2rem';

        const isContext = sec.title.toLowerCase().includes('context');

        // SPECIAL RENDERING FOR CONTEXT: Paragraph style
        if (isContext) {
            secEl.innerHTML = `
                <div class="summary-section-title">
                    <div class="summary-section-dot"></div>
                    <span>Overview</span>
                </div>
                <p class="summary-text">
                    ${sec.body}
                </p>
            `;
        } else {
            // LIST RENDERING FOR OTHERS
            let items = sec.body.split(/\n|•/).map(t => t.trim()).filter(t => t.length > 5);
            if (items.length === 0) items = [sec.body];

            const listItemsHtml = items.map(item => {
                // Formatting for keys like "Dates:" or "Authorized Personnel:"
                const formattedItem = item.replace(/^([\w\s]{2,30}:)/, '<strong style="color: var(--text-main);">$1</strong>');
                return `<li class="summary-list-item">${formattedItem}</li>`;
            }).join('');

            secEl.innerHTML = `
                <div class="summary-section-title">
                    <div class="summary-section-dot" style="background: var(--text-muted);"></div>
                    <span>${sec.title.replace(':', '')}</span>
                </div>
                <ul class="summary-list">
                    ${listItemsHtml}
                </ul>
            `;
        }
        sectionsRoot.appendChild(secEl);
    });

    // Add "Refer to document" note if summary seems cut off or just as a general guidance
    const fullText = (currentOpenDoc.content_summary || '').trim();
    const isTruncated = fullText.length > 0 && !fullText.endsWith('.') && !fullText.endsWith('!') && !fullText.endsWith('?');

    const footerNote = document.createElement('div');
    footerNote.style.marginTop = '1rem';
    footerNote.style.padding = '1.25rem';
    footerNote.style.background = 'rgba(0, 122, 255, 0.04)';
    footerNote.style.border = '1px solid rgba(0, 122, 255, 0.1)';
    footerNote.style.borderRadius = '12px';
    footerNote.style.display = 'flex';
    footerNote.style.gap = '1rem';
    footerNote.style.alignItems = 'flex-start';

    footerNote.innerHTML = `
        <i class="fa-solid fa-circle-info" style="color: var(--primary-color); margin-top: 2px;"></i>
        <div style="flex: 1;">
            <p style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Note</p>
            <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; font-weight: 500;">
                ${isTruncated ? 'Summary appears truncated. ' : ''}Please refer to the original document on the right for full details and authentication.
            </p>
        </div>
    `;
    card.appendChild(footerNote);

    viewerSummaryContainer.appendChild(card);
}

function openDocument(doc) {
    currentOpenDoc = doc;
    viewerFilename.textContent = doc.name;

    // Update Summary Panel
    if (doc.content) {
        renderSmartSummary(doc.content);
        viewerSummaryPanel.classList.remove('hidden');
    } else {
        viewerSummaryPanel.classList.add('hidden');
    }

    if (doc.url) {
        // Display REAL PDF
        viewerCanvas.style.padding = '0';
        viewerCanvas.style.maxWidth = '900px';
        viewerCanvas.innerHTML = `
                <iframe src="${doc.url}#toolbar=0" 
                        width="100%" 
                        height="1100px" 
                        style="border: none; display: block; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                </iframe>
            `;
    } else {
        // Display MOCK Document
        viewerCanvas.style.padding = '4rem';
        viewerCanvas.style.maxWidth = '750px';
        viewerCanvas.innerHTML = `
                <div class="doc-content-mockup">
                    <p style="color: var(--primary-color); font-weight: 700; text-transform: uppercase; margin-bottom: 2rem;">Official Health Document</p>
                    <h1>${doc.year} ${getCategoryDisplayLabel(doc.category).toUpperCase()} Summary</h1>
                    <p style="font-size: 1.1rem; border-left: 4px solid var(--primary-color); padding-left: 1rem; color: var(--text-muted);">${doc.date}</p>
                    <div class="doc-skeleton medium"></div>
                    <div class="doc-skeleton"></div>
                    <br>
                    <h3>Executive Overview</h3>
                    <p>${doc.content}</p>
                    <br>
                    <div class="doc-skeleton medium"></div>
                    <div class="doc-skeleton"></div>
                    <div class="doc-skeleton"></div>
                    <div class="doc-skeleton medium"></div>
                </div>
            `;
    }

    currentZoom = 100;
    updateZoom();
}

// Search Logic with Global SQL Scope
async function performMainSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        isGlobalSearch = false;
        const activeItem = document.querySelector('.category-item.active');
        if (activeItem) {
            const year = activeItem.closest('.folder-item').dataset.year;
            const category = activeItem.querySelector('span').textContent.toLowerCase();
            filterByFolder(year, category);
        } else {
            renderDocuments([]);
        }
        return;
    }

    isGlobalSearch = true;
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();

        if (result.success) {
            currentFilteredDocs = result.data.map(mapDocData);
            renderDocuments(currentFilteredDocs);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Trigger search on button click
searchBtn.addEventListener('click', performMainSearch);

// Trigger search on Enter key
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performMainSearch();
    }
});

// Keep live search but with a longer debounce for better UX
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performMainSearch, 500);
});

// Viewer Actions
function updateZoom() {
    zoomLevelText.textContent = `${currentZoom}%`;
    viewerCanvas.style.transform = `scale(${currentZoom / 100})`;
}

zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 200) {
        currentZoom += 10;
        updateZoom();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 50) {
        currentZoom -= 10;
        updateZoom();
    }
});

printBtn.addEventListener('click', () => {
    if (currentOpenDoc && currentOpenDoc.url) {
        // Create a hidden iframe to print the raw PDF file
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.src = currentOpenDoc.url;

        document.body.appendChild(printFrame);

        printFrame.onload = () => {
            try {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                // Remove the frame after a delay to allow print dialog to open
                setTimeout(() => {
                    document.body.removeChild(printFrame);
                }, 1000);
            } catch (e) {
                console.error('Direct PDF print failed, falling back', e);
                window.open(currentOpenDoc.url, '_blank');
            }
        };
    } else {
        window.print();
    }
});

downloadBtn.addEventListener('click', () => {
    if (currentOpenDoc) {
        // If it's a real uploaded document with a backend filename
        if (currentOpenDoc.filename) {
            window.location.href = `/api/download/${currentOpenDoc.filename}`;
            showToast('Download Started', `Downloading ${currentOpenDoc.name}`, 'info');
        }
        // Fallback for mock documents or documents with only a URL
        else if (currentOpenDoc.url) {
            const link = document.createElement('a');
            link.href = currentOpenDoc.url;
            link.download = currentOpenDoc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Download Started', `Downloading ${currentOpenDoc.name}`, 'info');
        }
    } else {
        showToast('Download Unavailable', 'No document is currently open', 'error');
    }
});

// Login and Upload Functionality
// Initialization and Session Restoration
function restoreSession() {
    const savedUser = localStorage.getItem('doh_portal_user');
    console.log('Restoring session, found:', savedUser ? 'User data' : 'None');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            syncUserDisplay();
        } catch (e) {
            console.error('Session restore failed:', e);
            localStorage.removeItem('doh_portal_user');
        }
    }
}

// Global Start
document.addEventListener('DOMContentLoaded', () => {
    // Global Error Catcher for Debugging
    window.onerror = function (message, source, lineno, colno, error) {
        showToast('System Error', `Line ${lineno}: ${message}`, 'error');
        return false;
    };

    restoreSession();
    initGlobalRepository();

    // Expose critical functions to window for the dynamically generated buttons
    window.deleteDocument = deleteDocument;
    window.deleteYearFolder = deleteYearFolder;
    window.deleteUser = deleteUser;
    window.updateUserStatus = updateUserStatus;
    window.updateUserRole = updateUserRole;

    // Sorting functionality
    const docSort = document.getElementById('doc-sort');
    if (docSort) {
        docSort.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            renderDocuments(currentFilteredDocs);
        });
    }

    // Theme Management
    const themeToggles = ['theme-toggle', 'portal-theme-toggle'];
    const savedTheme = localStorage.getItem('doh_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateAllThemeIcons(savedTheme);

    themeToggles.forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('doh_theme', newTheme);
                updateAllThemeIcons(newTheme);
            });
        }
    });

    function updateAllThemeIcons(theme) {
        themeToggles.forEach(id => {
            const toggle = document.getElementById(id);
            if (!toggle) return;
            const icon = toggle.querySelector('i');
            const text = toggle.querySelector('span'); // For the portal toggle text

            if (theme === 'dark') {
                icon.className = 'fa-solid fa-sun';
                if (text && id === 'portal-theme-toggle') text.textContent = 'Light Mode';
            } else {
                icon.className = 'fa-solid fa-moon';
                if (text && id === 'portal-theme-toggle') text.textContent = 'Dark Mode';
            }
        });
    }
});

function syncUserDisplay() {
    if (!currentUser) {
        // Revert main header
        globalUserDisplay.classList.add('hidden');
        mainLogoutBtn.classList.add('hidden');
        mainPortalBtn.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        return;
    }

    // Toggle Navbar Visibility
    globalUserDisplay.classList.remove('hidden');
    mainLogoutBtn.classList.remove('hidden');
    mainPortalBtn.classList.remove('hidden');
    loginBtn.classList.add('hidden');

    // Toggle Main Layout vs Portal
    document.getElementById('global-user-name').textContent = currentUser.username;
    document.getElementById('current-user-name').textContent = currentUser.username;
    document.getElementById('current-user-role').textContent = currentUser.role;

    // Manage Portal State
    const isPortalActive = !uploadPage.classList.contains('hidden');
    if (isPortalActive) {
        document.body.classList.add('portal-active');
        // Start live polling for stats when in portal
        if (!window.statsInterval) {
            loadStats(); // Initial load
            window.statsInterval = setInterval(loadStats, 10000); // Poll every 10s
        }
    } else {
        document.body.classList.remove('portal-active');
        // Stop polling when leaving portal
        if (window.statsInterval) {
            clearInterval(window.statsInterval);
            window.statsInterval = null;
        }
    }

    // Show/Hide Admin Nav Item (Admins and Uploaders can see dashboard)
    if (currentUser.role === 'admin' || currentUser.role === 'uploader') {
        navAdminDashboard.classList.remove('hidden');

        // Control internal tabs
        const userTab = document.getElementById('tab-user-mgmt');
        const docTab = document.getElementById('tab-doc-mgmt');

        if (currentUser.role === 'uploader') {
            if (userTab) userTab.classList.add('hidden');
            // Force panel visibility for uploaders
            const userPanel = document.getElementById('user-mgmt-view');
            const docPanel = document.getElementById('doc-mgmt-view');
            if (userPanel) userPanel.classList.add('hidden');
            if (docPanel) {
                // Ensure correct view for uploaders
                docPanel.classList.remove('hidden');
                if (docTab) docTab.classList.add('active');
                if (userTab) userTab.classList.remove('active');
            }
        } else {
            if (userTab) userTab.classList.remove('hidden');
            // If admin is in admin dashboard, ensure at least one panel is visible
            const adminView = document.getElementById('view-admin');
            if (adminView && !adminView.classList.contains('hidden')) {
                const userPanel = document.getElementById('user-mgmt-view');
                const docPanel = document.getElementById('doc-mgmt-view');
                if (userPanel && userPanel.classList.contains('hidden') && docPanel && docPanel.classList.contains('hidden')) {
                    if (userTab) userTab.click();
                }
            }
        }
    } else {
        navAdminDashboard.classList.add('hidden');
    }
}


// Portal Navigation Logic
portalNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetId = item.dataset.target;

        // Update Active Nav State
        portalNavItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Switch Views
        portalViews.forEach(view => {
            if (view.id === targetId) {
                view.classList.add('active');
                view.classList.remove('hidden');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
            }
        });

        // Load data if switching to admin
        if (targetId === 'view-admin') {
            if (currentUser.role === 'uploader') {
                document.getElementById('tab-doc-mgmt').click();
            } else {
                document.getElementById('tab-user-mgmt').click();
            }
            loadUsers();
            loadAdminDocs();
        }
    });
});

// Dashboard Internal Tabs (User vs Doc Mgmt)
dashTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        dashTabs.forEach(t => t.classList.remove('active'));
        dashPanels.forEach(p => p.classList.add('hidden'));

        tab.classList.add('active');
        const targetPanel = document.getElementById(`${tab.dataset.tab}-view`);
        targetPanel.classList.remove('hidden');
    });
});

async function loadStats() {
    try {
        // Document count from global state
        document.getElementById('stat-total-docs').textContent = allDocuments.length;

        // Initial user load to trigger count update
        loadUsers();
    } catch (e) {
        console.error('Stats load error', e);
    }
}

// Toast Notification System
function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info'
    };

    toast.innerHTML = `
            <i class="fa-solid ${iconMap[type]} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

    toastContainer.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
        removeToast(toast);
    }, 5000);
}

function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

// Auth Switching Logic
// Auth Switching Logic
// Variables moved to top of file
if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
        // Auto-focus the registration username
        setTimeout(() => {
            document.getElementById('reg-username').focus();
        }, 50);
    });
}

if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.classList.add('hidden');
        loginView.classList.remove('hidden');
        // Auto-focus the login username
        setTimeout(() => {
            document.getElementById('username').focus();
        }, 50);
    });
}

// Tab Switching Logic
modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        modalTabs.forEach(t => t.classList.remove('active'));
        tabViews.forEach(v => v.classList.remove('active'));

        tab.classList.add('active');
        const viewId = `${tab.dataset.tab}-view`;
        document.getElementById(viewId).classList.add('active');
    });
});

// Show login modal
loginBtn.addEventListener('click', () => {
    loginModal.classList.add('visible');
    loginForm.reset();
    registerForm.reset();
    loginError.textContent = '';
    registerError.textContent = '';
    // Reset to login view by default
    loginView.classList.remove('hidden');
    registerView.classList.add('hidden');

    // Auto-focus the username input when modal opens
    // Added a small delay to ensure modal visibility transition is captured
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 100);
});

// Close modal
closeModalBtn.addEventListener('click', () => {
    loginModal.classList.remove('visible');
});

// Close modal on background click
loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.classList.remove('visible');
    }
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            currentUser = result.user;
            // Persist session to LocalStorage
            localStorage.setItem('doh_portal_user', JSON.stringify(currentUser));

            loginModal.classList.remove('visible');
            uploadPage.classList.remove('hidden');

            syncUserDisplay();

            // Show admin panel if role is admin
            if (currentUser.role === 'admin') {
                // navigate to admin view by default or just show nav?
                // let's stay on upload view but show nav item
            }
        } else {
            loginError.textContent = result.message;
        }
    } catch (error) {
        loginError.textContent = 'Connection error. Please check your server.';
    }
});

// Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const doh_id = document.getElementById('reg-doh-id').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
        registerError.textContent = 'Passwords do not match';
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, doh_id })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Success', result.message, 'success');
            // Switch back to login view
            registerView.classList.add('hidden');
            loginView.classList.remove('hidden');
            loginForm.reset();
        } else {
            registerError.textContent = result.message;
        }
    } catch (error) {
        registerError.textContent = 'Connection error. Please try again.';
    }
});

// Dashboard Search Logic
const adminUserSearch = document.querySelector('#user-mgmt-view .panel-search');
const adminDocSearch = document.getElementById('admin-doc-search');

adminUserSearch.addEventListener('input', (e) => {
    loadUsers(e.target.value);
});

adminDocSearch.addEventListener('input', (e) => {
    loadAdminDocs(e.target.value);
});

// Refresh Logic
window.refreshUsers = () => {
    adminUserSearch.value = '';
    loadUsers();
};

window.refreshDocs = () => {
    adminDocSearch.value = '';
    loadAdminDocs();
};

// Load users for admin panel
async function loadUsers(query = '') {
    // Only admins should load user data
    if (!currentUser || currentUser.role !== 'admin') {
        userTableBody.innerHTML = '';
        // If an uploader somehow triggers this, force them to the docs tab
        const docTab = document.getElementById('tab-doc-mgmt');
        if (docTab) docTab.click();
        return;
    }

    try {
        const response = await fetch('/api/users');
        const result = await response.json();

        if (result.success) {
            userTableBody.innerHTML = '';
            const allUsers = result.data;
            const searchLower = query.toLowerCase();

            // Filter users based on query with null safety
            const filteredUsers = allUsers.filter(user => {
                const uName = (user.username || '').toLowerCase();
                const uDoh = (user.doh_id || '').toLowerCase();
                return uName.includes(searchLower) || uDoh.includes(searchLower);
            });

            // Update the statistic card (include all users)
            const totalUsersSpan = document.getElementById('stat-total-users');
            if (totalUsersSpan) {
                totalUsersSpan.textContent = allUsers.length;
            }

            filteredUsers.forEach(user => {
                // Prevent editing yourself
                if (currentUser && user.id === currentUser.id) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                        <td>${user.username}</td>
                        <td>${user.doh_id}</td>
                        <td>
                            <select class="role-select" onchange="updateUserRole(${user.id}, this.value)">
                                <option value="uploader" ${user.role === 'uploader' ? 'selected' : ''}>Uploader</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                        <td><span class="status-badge ${user.status || 'pending'}">${(user.status || 'pending').toUpperCase()}</span></td>
                        <td style="display: flex; gap: 0.5rem;" class="user-actions-cell">
                        </td>
                    `;

                const actionsCell = tr.querySelector('.user-actions-cell');
                if (!actionsCell) return;

                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'btn-activate';

                if (user.status === 'pending') {
                    toggleBtn.innerHTML = `<i class="fa-solid fa-user-check" style="pointer-events: none"></i> <span style="pointer-events: none">Activate</span>`;
                    toggleBtn.style.background = 'var(--primary-color)';
                    toggleBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateUserStatus(user.id, 'active');
                    });
                } else {
                    toggleBtn.style.background = '#64748b';
                    toggleBtn.innerHTML = `<i class="fa-solid fa-user-slash" style="pointer-events: none"></i> <span style="pointer-events: none">Deactivate</span>`;
                    toggleBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateUserStatus(user.id, 'pending');
                    });
                }

                const deleteUserBtn = document.createElement('button');
                deleteUserBtn.type = 'button';
                deleteUserBtn.className = 'btn-danger';
                deleteUserBtn.innerHTML = `<i class="fa-solid fa-trash-can" style="pointer-events: none"></i> <span style="pointer-events: none">Delete</span>`;
                deleteUserBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteUser(user.id, user.username);
                });

                actionsCell.appendChild(toggleBtn);
                actionsCell.appendChild(deleteUserBtn);
                userTableBody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Failed to load users');
    }
}

// Global function for user activation (called from inline onclick)
// User activation definition moved

// Admin Tab Switching
adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active'));
        adminTabViews.forEach(v => v.classList.add('hidden'));

        tab.classList.add('active');
        const target = tab.dataset.tab;
        const targetView = document.getElementById(`${target}-view`);
        if (targetView) targetView.classList.remove('hidden');

        if (target === 'doc-mgmt') loadAdminDocs();
        if (target === 'user-mgmt') loadUsers();
    });
});

// Admin Document Category Sub-tabs
document.addEventListener('click', (e) => {
    const subTab = e.target.closest('.sub-tab');
    if (subTab) {
        // Update active state
        document.querySelectorAll('.sub-tab').forEach(st => st.classList.remove('active'));
        subTab.classList.add('active');

        // Update category and reload
        currentAdminCategory = subTab.dataset.type;
        const searchInput = document.getElementById('admin-doc-search');
        loadAdminDocs(searchInput ? searchInput.value : '', 1);
    }
});

// Load documents for admin management with Pagination
async function loadAdminDocs(query = '', page = 1) {
    try {
        const response = await fetch('/api/documents');
        const result = await response.json();

        if (result.success) {
            const allDocs = result.data.map(mapDocData);
            const searchLower = (query || "").toLowerCase();

            // Filter docs based on query AND Category
            adminDocsFiltered = allDocs.filter(doc => {
                const matchesSearch = doc.name.toLowerCase().includes(searchLower) ||
                    (doc.rpo_number && doc.rpo_number.toLowerCase().includes(searchLower)) ||
                    (doc.subject && doc.subject.toLowerCase().includes(searchLower));

                const matchesCategory = currentAdminCategory === 'all' || doc.filetype === currentAdminCategory;

                return matchesSearch && matchesCategory;
            });

            // Update Year Select Choices
            if (adminYearSelect) {
                const years = [...new Set(allDocs.map(d => d.year))].sort((a, b) => b - a);
                const currentVal = adminYearSelect.value;
                adminYearSelect.innerHTML = '<option value="">Select Year...</option>' +
                    years.map(y => `<option value="${y}" ${y === currentVal ? 'selected' : ''}>${y}</option>`).join('');
            }

            adminDocsPage = page;
            renderAdminDocsPage();
        }
    } catch (error) {
        console.error('Load admin docs error:', error);
    }
}

function renderAdminDocsPage() {
    if (!adminDocTableBody) return;

    const start = (adminDocsPage - 1) * adminDocsLimit;
    const end = start + adminDocsLimit;
    const pageDocs = adminDocsFiltered.slice(start, end);
    const totalPages = Math.ceil(adminDocsFiltered.length / adminDocsLimit);

    adminDocTableBody.innerHTML = '';

    // Reset select all checkbox
    const selectAllCheck = document.getElementById('admin-doc-select-all');
    if (selectAllCheck) selectAllCheck.checked = false;
    updateBulkDeleteVisibility();

    if (pageDocs.length === 0) {
        adminDocTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No documents found</td></tr>';
        adminPagination.innerHTML = '';
        return;
    }

    pageDocs.forEach(doc => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="doc-row-select" data-id="${doc.id}" onclick="updateBulkDeleteVisibility()">
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 1.2rem;"></i>
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <span style="font-weight: 700; color: #1e293b; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 400px;" title="${doc.subject}">
                            ${doc.subject}
                        </span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">${doc.name}</span>
                    </div>
                </div>
            </td>
            <td><span class="badge" style="background: #f1f5f9; color: #475569;">${doc.year}</span></td>
            <td><span class="badge" style="background: #f1f5f9; color: #475569;">${getCategoryDisplayLabel(doc.filetype).toUpperCase()}</span></td>
            <td><span style="font-family: monospace; font-weight: 700; color: var(--primary-color);">${doc.rpo_number || '---'}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 24px; height: 24px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                        ${(doc.uploaded_by || 'A').charAt(0).toUpperCase()}
                    </div>
                    <span style="font-size: 0.85rem; font-weight: 500;">${doc.uploaded_by || 'Admin'}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;" class="doc-actions">
                    <button class="btn-icon-only view-doc-btn" title="View">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn btn-danger delete-doc-btn" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </td>
        `;

        // Direct event listeners to handle quotes safely
        row.querySelector('.view-doc-btn').addEventListener('click', () => window.open(doc.url, '_blank'));
        row.querySelector('.delete-doc-btn').addEventListener('click', () => deleteDocument(doc.id, doc.name));

        adminDocTableBody.appendChild(row);
    });

    // Render Pagination Controls
    renderAdminPagination(totalPages);
}

function renderAdminPagination(totalPages) {
    if (!adminPagination) return;

    if (totalPages <= 1) {
        adminPagination.innerHTML = '';
        return;
    }

    let html = `
        <div class="pagination-info">
            Showing <strong>${Math.min(adminDocsFiltered.length, (adminDocsPage - 1) * adminDocsLimit + 1)}-${Math.min(adminDocsFiltered.length, adminDocsPage * adminDocsLimit)}</strong> of <strong>${adminDocsFiltered.length}</strong>
        </div>
        <div class="pagination-buttons">
            <button class="pag-btn ${adminDocsPage === 1 ? 'disabled' : ''}" onclick="changeAdminPage(${adminDocsPage - 1})" ${adminDocsPage === 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-left"></i>
            </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= adminDocsPage - 1 && i <= adminDocsPage + 1)) {
            html += `<button class="pag-btn ${i === adminDocsPage ? 'active' : ''}" onclick="changeAdminPage(${i})">${i}</button>`;
        } else if (i === adminDocsPage - 2 || i === adminDocsPage + 2) {
            html += `<span class="pag-dots">...</span>`;
        }
    }

    html += `
            <button class="pag-btn ${adminDocsPage === totalPages ? 'disabled' : ''}" onclick="changeAdminPage(${adminDocsPage + 1})" ${adminDocsPage === totalPages ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    `;

    adminPagination.innerHTML = html;
}

function changeAdminPage(newPage) {
    adminDocsPage = newPage;
    renderAdminDocsPage();
}

window.changeAdminPage = changeAdminPage;

function handleYearArchive() {
    const year = adminYearSelect.value;
    if (!year) {
        showToast('Selection Required', 'Please select a year to download', 'info');
        return;
    }
    downloadYearArchive(year);
}

function handleYearDelete() {
    const year = adminYearSelect.value;
    if (!year) {
        showToast('Selection Required', 'Please select a year to delete', 'info');
        return;
    }
    deleteYearFolder(year);
}

// Custom Confirmation Modal Helper
function customConfirm(title, message, isDanger = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const cancelBtn = document.getElementById('confirm-cancel');
        const proceedBtn = document.getElementById('confirm-proceed');

        titleEl.textContent = title;
        messageEl.textContent = message;

        if (isDanger) {
            proceedBtn.className = 'btn btn-danger';
            proceedBtn.textContent = 'Yes, Delete';
        } else {
            proceedBtn.className = 'btn btn-portal';
            proceedBtn.textContent = 'Confirm';
        }

        modal.classList.add('visible');

        const cleanup = (result) => {
            modal.classList.remove('visible');
            cancelBtn.removeEventListener('click', onCancel);
            proceedBtn.removeEventListener('click', onProceed);
            resolve(result);
        };

        const onCancel = () => cleanup(false);
        const onProceed = () => cleanup(true);

        cancelBtn.addEventListener('click', onCancel);
        proceedBtn.addEventListener('click', onProceed);
    });
}

// Bulk Selection Logic
function toggleSelectAllDocs(checked) {
    const checkboxes = document.querySelectorAll('.doc-row-select');
    checkboxes.forEach(cb => cb.checked = checked);
    updateBulkDeleteVisibility();
}

function updateBulkDeleteVisibility() {
    const bulkBtn = document.getElementById('bulk-delete-btn');
    if (!bulkBtn) return;

    const checkboxes = document.querySelectorAll('.doc-row-select:checked');
    if (checkboxes.length > 0) {
        bulkBtn.style.display = 'inline-flex';
        bulkBtn.querySelector('span').textContent = `Delete Selected (${checkboxes.length})`;
    } else {
        bulkBtn.style.display = 'none';
    }
}

async function bulkDeleteDocuments() {
    const selectedCheckboxes = document.querySelectorAll('.doc-row-select:checked');
    const ids = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));

    if (ids.length === 0) return;

    const confirmed = await customConfirm(
        'Bulk Delete',
        `Are you sure you want to delete ${ids.length} selected documents? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
        const response = await fetch('/api/documents/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Deleted', result.message, 'success');
            loadAdminDocs();
            initGlobalRepository();
        } else {
            showToast('Error', result.message || 'Bulk delete failed', 'error');
        }
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Error', 'Bulk deletion error', 'error');
    }
}

// Global document delete
async function deleteDocument(id, name) {
    const confirmed = await customConfirm(
        'Delete Document',
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            showToast('Deleted', 'Document removed successfully', 'success');
            loadAdminDocs();
            initGlobalRepository(); // Refresh main view
        } else {
            showToast('Error', result.message || 'Failed to delete document', 'error');
        }
    } catch (error) {
        showToast('Error', 'Failed to delete document', 'error');
    }
}

// Global year delete
async function deleteYearFolder(year) {
    const confirmed = await customConfirm(
        'Delete Year Folder',
        `CRITICAL: You are about to delete ALL documents from the year ${year}. This action is permanent. Do you wish to proceed?`
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/documents/year/${year}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            showToast('Deleted', result.message, 'success');
            loadAdminDocs();
            initGlobalRepository(); // Refresh main view
        } else {
            showToast('Error', result.message || 'Failed to delete folder content', 'error');
        }
    } catch (error) {
        showToast('Error', 'Failed to delete folder content', 'error');
    }
}

async function downloadYearArchive(year) {
    showToast('Preparing Archive', `Gathering documents for ${year}...`, 'info');
    try {
        const url = `/api/archive/year/${year}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `Archive_${year}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        showToast('Error', 'Failed to start archive download', 'error');
    }
}

// Global function for user deletion
async function deleteUser(userId, username) {
    const confirmed = await customConfirm(
        'Delete User',
        `Are you sure you want to delete user "${username}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
            showToast('Deleted', result.message, 'success');
            loadUsers();
        } else {
            showToast('Error', result.message, 'error');
        }
    } catch (error) {
        showToast('Error', 'Failed to delete user', 'error');
    }
}

async function updateUserStatus(userId, status) {
    try {
        const response = await fetch(`/api/users/${userId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Updated', result.message, 'success');
            loadUsers();
        } else {
            showToast('Error', result.message || 'Failed to update user', 'error');
        }
    } catch (error) {
        console.error('Update fetch error:', error);
        showToast('Error', 'Failed to update user status', 'error');
    }
}

async function updateUserRole(userId, role) {
    try {
        const response = await fetch(`/api/users/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Updated', result.message, 'success');
            loadUsers();
        } else {
            showToast('Error', result.message || 'Failed to update role', 'error');
        }
    } catch (error) {
        showToast('Error', 'Failed to update role', 'error');
    }
}

// Logout logic
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('doh_portal_user');

    document.body.classList.remove('portal-active');
    uploadPage.classList.add('hidden');
    syncUserDisplay();

    // Reset portal state
    selectedFiles = [];
    fileInput.value = '';

    // Reset file list to empty state
    renderFileList();

    ocrConfirm.checked = false;
    ocrConfirm.disabled = true;
    uploadBtn.disabled = true;
    uploadProgress.classList.add('hidden');
    progressFill.style.width = '0%';

    showToast('Logged Out', 'You have been successfully logged out', 'info');
}

logoutBtn.addEventListener('click', handleLogout);
mainLogoutBtn.addEventListener('click', handleLogout);

// Back to Explorer (Keep login)
portalBackBtn.addEventListener('click', () => {
    uploadPage.classList.add('hidden');
    syncUserDisplay();
});

// Go to Portal from main page
mainPortalBtn.addEventListener('click', () => {
    uploadPage.classList.remove('hidden');
    syncUserDisplay();
});


// Upload box click
uploadBox.addEventListener('click', () => {
    fileInput.click();
});

// File selection (batch upload)
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    // Validate files
    const validFiles = [];
    let hasError = false;

    for (const file of files) {
        if (file.type !== 'application/pdf') {
            showToast('Invalid File', `${file.name} is not a PDF file`, 'error');
            hasError = true;
            continue;
        }
        if (file.size > 50 * 1024 * 1024) {
            showToast('File Too Large', `${file.name} exceeds 50MB limit`, 'error');
            hasError = true;
            continue;
        }
        validFiles.push(file);
    }

    if (validFiles.length > 0) {
        // Append and deduplicate by filename
        const newFiles = validFiles.filter(vf => !selectedFiles.some(sf => sf.name === vf.name));

        if (newFiles.length === 0 && validFiles.length > 0) {
            showToast('Duplicate File', 'File(s) already in the upload list', 'info');
        } else {
            selectedFiles = [...selectedFiles, ...newFiles];
            renderFileList();
            ocrConfirm.disabled = false;
            ocrConfirm.checked = false;
            uploadBtn.disabled = true;

            if (newFiles.length === 1) {
                showToast('File Added', `${newFiles[0].name} added to list`, 'info');
            } else {
                showToast('Files Added', `${newFiles.length} files added to list`, 'info');
            }
        }
    }

    fileInput.value = ''; // Reset input
});

// OCR Checkbox validation - enable upload only when checked
ocrConfirm.addEventListener('change', () => {
    if (selectedFiles.length > 0 && ocrConfirm.checked) {
        uploadBtn.disabled = false;
    } else {
        uploadBtn.disabled = true;
    }
});

// Render file list
function renderFileList() {
    uploadFileList.innerHTML = '';

    if (selectedFiles.length === 0) {
        uploadFileList.innerHTML = `
            <div class="empty-list-state">
                No files selected
            </div>
        `;
        fileCount.textContent = '0';
        return;
    }

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const innerContent = document.createElement('div');
        innerContent.style.display = 'flex';
        innerContent.style.alignItems = 'center';
        innerContent.style.gap = '0.75rem';
        innerContent.style.overflow = 'hidden';

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-file-pdf';
        icon.style.color = '#ef4444';
        icon.style.flexShrink = '0';

        const info = document.createElement('div');
        info.className = 'file-item-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-item-name';
        nameSpan.textContent = file.name;

        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'file-item-size';
        sizeSpan.textContent = formatFileSize(file.size);

        info.appendChild(nameSpan);
        info.appendChild(sizeSpan);
        innerContent.appendChild(icon);
        innerContent.appendChild(info);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-item-remove';
        removeBtn.dataset.index = index;
        removeBtn.innerHTML = '&times;';

        fileItem.appendChild(innerContent);
        fileItem.appendChild(removeBtn);
        uploadFileList.appendChild(fileItem);
    });

    // Update count badge
    fileCount.textContent = selectedFiles.length;

    // Add remove listeners
    document.querySelectorAll('.file-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            selectedFiles.splice(index, 1);
            renderFileList();

            if (selectedFiles.length === 0) {
                uploadBtn.disabled = true;
            }
        });
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}


// Upload files (batch upload)
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showToast('Error', 'Please select files to upload', 'error');
        return;
    }

    uploadBtn.disabled = true;
    uploadProgress.classList.remove('hidden');

    const totalFiles = selectedFiles.length;
    let uploadedCount = 0;
    let failedCount = 0;
    const failedFiles = [];

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        progressText.textContent = `Uploading ${i + 1} of ${totalFiles}: ${file.name}`;

        try {
            const formData = new FormData();
            formData.append('document', file);
            if (currentUser) {
                formData.append('uploadedBy', currentUser.username);
            }

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                uploadedCount++;
                const progress = Math.round(((i + 1) / totalFiles) * 100);
                progressFill.style.width = `${progress}%`;
            } else {
                failedCount++;
                failedFiles.push(file.name);
            }
        } catch (error) {
            console.error('Upload error:', error);
            failedCount++;
            failedFiles.push(file.name);
        }
    }

    // Show completion status
    progressFill.classList.add('success');
    progressText.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${uploadedCount} file${uploadedCount > 1 ? 's' : ''} uploaded successfully!`;

    uploadBtn.innerHTML = '<span>Upload Successful</span><i class="fa-solid fa-check"></i>';
    uploadBtn.classList.add('btn-success');

    setTimeout(async () => {
        if (uploadedCount > 0) {
            showToast(
                'Upload Successful',
                `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} added to database`,
                'success'
            );
        }

        if (failedCount > 0) {
            showToast(
                'Upload Failed',
                `${failedCount} file${failedCount > 1 ? 's' : ''} failed: ${failedFiles.join(', ')}`,
                'error'
            );
        }

        // Clear selection after successful upload
        if (uploadedCount > 0 && failedCount === 0) {
            selectedFiles = [];
            renderFileList();
            ocrConfirm.checked = false;
            ocrConfirm.disabled = true;
            uploadBtn.disabled = true;
            uploadProgress.classList.add('hidden');
            progressFill.classList.remove('success');
            progressFill.style.width = '0%';

            // Reset button after delay
            setTimeout(() => {
                uploadBtn.innerHTML = '<span>Start Upload</span><i class="fa-solid fa-arrow-right"></i>';
                uploadBtn.classList.remove('btn-success');
            }, 3000);
        }

        // Refresh the document repository to show new files
        // (This now handles updating the filtered list/search as well)
        await initGlobalRepository();
    }, 1500);
});

// Keyboard shortcut for search
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
});

// Expose global functions
window.deleteDocument = deleteDocument;
window.bulkDeleteDocuments = bulkDeleteDocuments;
window.toggleSelectAllDocs = toggleSelectAllDocs;
window.updateBulkDeleteVisibility = updateBulkDeleteVisibility;
window.deleteYearFolder = deleteYearFolder;
window.deleteUser = deleteUser;
window.updateUserStatus = updateUserStatus;
window.updateUserRole = updateUserRole;
window.handleYearArchive = handleYearArchive;
window.handleYearDelete = handleYearDelete;
window.refreshUsers = refreshUsers;
window.refreshDocs = refreshDocs;
window.handleLogout = handleLogout;
window.openDocument = openDocument;
