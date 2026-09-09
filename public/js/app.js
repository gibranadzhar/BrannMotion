        // -------------------------------------------------------------
        // Anti-DevTools & Client Security Protection (Upgraded)
        // -------------------------------------------------------------
        (function() {
            // Bypass security if '?bypass_dev=true' is in the query params (for dev verification)
            if (window.location.search.includes('bypass_dev=true')) {
                return;
            }

            // Create and append the blocker overlay to the body
            const blocker = document.createElement('div');
            blocker.id = 'devtools-blocker-overlay';
            blocker.style.cssText = `
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(17, 24, 37, 0.98);
                color: #FF5701;
                font-family: 'Inter', sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
                z-index: 9999999;
                backdrop-filter: blur(10px);
            `;
            blocker.innerHTML = `
                <div style="background: rgba(255, 87, 1, 0.1); border: 1px solid #FF5701; border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; animation: pulse 2s infinite;">
                    <i class="ti ti-alert-triangle" style="font-size: 40px; color: #FF5701;"></i>
                </div>
                <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 12px 0; color: #ffffff;">Akses Ditangguhkan</h1>
                <p style="color: #9CA3AF; font-size: 16px; max-width: 450px; line-height: 1.6; margin: 0 0 24px 0;">
                    Developer Tools terdeteksi aktif. Silakan <strong>menutup kembali Developer Tools (F12)</strong> Anda agar kamu bisa mengakses kembali website BrannMotion.
                </p>
                <div style="font-family: monospace; font-size: 12px; color: #FF5701; border: 1px dashed rgba(255, 87, 1, 0.3); padding: 8px 16px; border-radius: 4px; background: rgba(17, 24, 37, 0.5);">
                    STATUS: MENUNGGU PENUTUPAN DEVTOLS...
                </div>
                <style>
                    @keyframes pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 87, 1, 0.4); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(255, 87, 1, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 87, 1, 0); }
                    }
                </style>
            `;
            
            // Append blocker as soon as DOM is ready or instantly if body already exists
            if (document.body) {
                document.body.appendChild(blocker);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    document.body.appendChild(blocker);
                });
            }

            let isBlocked = false;

            function showBlocker() {
                if (!isBlocked) {
                    isBlocked = true;
                    blocker.style.display = 'flex';
                }
            }

            function hideBlocker() {
                if (isBlocked) {
                    isBlocked = false;
                    blocker.style.display = 'none';
                }
            }

            // Keyboard shortcut & right click preventions
            document.addEventListener('contextmenu', e => {
                if (!window.location.search.includes('bypass_dev=true')) {
                    e.preventDefault();
                }
            });
            document.addEventListener('keydown', e => {
                if (window.location.search.includes('bypass_dev=true')) return;

                if (
                    e.key === 'F12' ||
                    (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) ||
                    (e.ctrlKey && ['u','U','s','S'].includes(e.key))
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    showBlocker();
                    return false;
                }
            });

            // Perform check every 500ms
            setInterval(() => {
                if (window.location.search.includes('bypass_dev=true')) return;

                let devtoolsIsOpen = false;

                // 1. Viewport size changes detection (DevTools docking)
                const threshold = 160;
                const widthDev = window.outerWidth - window.innerWidth > threshold;
                const heightDev = window.outerHeight - window.innerHeight > threshold;
                if (widthDev || heightDev) {
                    devtoolsIsOpen = true;
                }

                if (devtoolsIsOpen) {
                    showBlocker();
                } else {
                    hideBlocker();
                }
            }, 500);
        })();

        function escapeHTML(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // State variables
        let appState = {
            accounts: [],
            settings: {
                global_note: '',
                login_steps: []
            },
            recentPurchases: [],
            adminPurchases: [],
            adminUsers: [],
            stockCount: 0,
            activeView: 'landing',
            activeAdminSubpage: 'dashboard',
            activeQrisInterval: null,
            activeQrisTimeout: null,
            activeQrisRef: null,
            activeQrisApiKey: null,
            tempParsedAccounts: [],
            lastPurchasedData: null
        };

        // Initialize App on window load
        window.addEventListener('DOMContentLoaded', () => {
            fetchSettings();
            fetchPurchases();
            fetchTopBuyers();
            fetchStock(); // Public stock fetch

            // Set up a recurring fetch for recent purchases to keep the social proof fresh
            setInterval(() => {
                fetchPurchases();
                fetchTopBuyers();
                fetchStock();
                if (appState.activeView === 'admin' && appState.activeAdminSubpage === 'riwayat-pembelian') {
                    fetchAdminPurchases();
                }
                if (appState.activeView === 'admin' && appState.activeAdminSubpage === 'users') {
                    fetchAdminUsers();
                }
            }, 30000);
        });

        // -------------------------------------------------------------
        // Core View Swapping
        // -------------------------------------------------------------
        function switchView(viewName) {
            const currentView = document.querySelector('.app-view.active');
            const targetView = document.getElementById(`view-${viewName}`);
            
            if (!targetView || currentView === targetView) return;

            // Trigger transition opacity animation
            currentView.style.opacity = '0';
            
            setTimeout(() => {
                currentView.classList.remove('active');
                targetView.classList.add('active');
                
                // Force a repaint
                targetView.offsetHeight;
                
                targetView.style.opacity = '1';
                appState.activeView = viewName;
                
                // Show/hide floating WhatsApp contact button based on active view
                const ownerWaBtn = document.getElementById('owner-wa-button');
                if (ownerWaBtn) {
                    if (viewName === 'admin') {
                        ownerWaBtn.style.display = 'none';
                    } else {
                        ownerWaBtn.style.display = 'flex';
                    }
                }
                
                // Fetch fresh values when going to admin
                if (viewName === 'admin') {
                    const passcode = sessionStorage.getItem('admin_passcode');
                    if (!passcode) {
                        showToast("Silakan login terlebih dahulu.", "warning");
                        currentView.classList.add('active');
                        targetView.classList.remove('active');
                        currentView.style.opacity = '1';
                        appState.activeView = 'landing';
                        openAdminAuthModal();
                        return;
                    }
                    fetchAccounts();
                    fetchSettings();
                    fetchAdminPurchases();
                } else {
                    document.getElementById('view-success-delivery').classList.remove('active');
                }
            }, 150);
        }

        function switchAdminSubpage(subpageId, navElement = null) {
            // Update active subpage view
            const subpages = document.querySelectorAll('.admin-subpage');
            subpages.forEach(p => p.classList.remove('active'));
            
            const targetSubpage = document.getElementById(`subpage-${subpageId}`);
            if (targetSubpage) {
                targetSubpage.classList.add('active');
            }

             // Update active sidebar nav link style
             if (navElement) {
                 const navLinks = document.querySelectorAll('.sidebar-link');
                 navLinks.forEach(link => link.classList.remove('active'));
                 navElement.classList.add('active');
             } else {
                 // Find and highlight matching sidebar link manually
                 const navLinks = document.querySelectorAll('.sidebar-link');
                 navLinks.forEach(link => {
                     const text = link.textContent.trim().toLowerCase();
                     if (text.includes(subpageId.replace('-', ' '))) {
                         link.classList.add('active');
                     } else {
                         link.classList.remove('active');
                     }
                 });
             }

             // Sync with Mobile Scrollable Tab Bar if it exists
             const mobTabs = document.querySelectorAll('.admin-mob-tab');
             mobTabs.forEach(tab => {
                 if (tab.id === `mob-tab-${subpageId}`) {
                     tab.classList.add('active');
                     // Scroll the tab into view inside the tab bar container
                     tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                 } else {
                     tab.classList.remove('active');
                 }
             });

            if (subpageId === 'riwayat-pembelian') {
                fetchAdminPurchases();
            } else if (subpageId === 'users') {
                fetchAdminUsers();
            }

            // Update header title text
            const titleMap = {
                'dashboard': 'Dashboard Overview',
                'tambah-akun': 'Tambah Akun Lisensi',
                'daftar-akun': 'Daftar Akun Database',
                'riwayat-pembelian': 'Riwayat Transaksi Penjualan',
                'catatan-global': 'Kelola Catatan Pembeli',
                'tata-cara': 'Tata Cara Aktivasi Login',
                'users': 'Daftar Pengguna Terdaftar'
            };
            document.getElementById('admin-header-title').textContent = titleMap[subpageId] || 'Admin Panel';
            appState.activeAdminSubpage = subpageId;
        }

        function resetToLandingPage() {
            document.getElementById('view-success-delivery').classList.remove('active');
            switchView('landing');
        }

        function switchCardTab(tabName, btnElement) {
            const card = btnElement.closest('.checkout-container-card');
            const tabBtns = card.querySelectorAll('.card-tab-btn');
            tabBtns.forEach(btn => btn.classList.remove('active'));
            btnElement.classList.add('active');

            const panes = card.querySelectorAll('.card-tab-pane');
            panes.forEach(pane => pane.classList.remove('active'));
            
            const targetPane = document.getElementById(`card-tab-${tabName}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        }

        // -------------------------------------------------------------
        // Data Fetching from MongoDB Express Server
        // -------------------------------------------------------------
        async function fetchSettings() {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (response.ok) {
                    appState.settings = data;
                    
                    // Render settings preview elements with safety checks
                    const noteTextEl = document.getElementById('dashboard-note-text');
                    const noteTextareaEl = document.getElementById('global-note-textarea');
                    const notePreviewEl = document.getElementById('note-preview-display');
                    const deliveryNoteEl = document.getElementById('delivery-note');
                    
                    if (noteTextEl) noteTextEl.textContent = data.global_note || 'Tidak ada catatan global';
                    if (noteTextareaEl) noteTextareaEl.value = data.global_note || '';
                    if (notePreviewEl) notePreviewEl.textContent = data.global_note || 'Tidak ada catatan global';
                    if (deliveryNoteEl) deliveryNoteEl.textContent = data.global_note || '';
                    
                    renderStepsPreview();
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
                showToast("Gagal mengambil data konfigurasi dari server.", "danger");
            }
        }

        async function fetchPurchases() {
            try {
                const response = await fetch('/api/purchases');
                const list = await response.json();
                if (response.ok) {
                    appState.recentPurchases = list;
                    renderRecentPurchases();
                }
            } catch (err) {
                console.error("Error fetching purchases:", err);
            }
        }

        async function fetchAccounts() {
            try {
                const passcode = sessionStorage.getItem('admin_passcode');
                const response = await fetch('/api/accounts', {
                    headers: { 'X-Admin-Key': passcode || '' }
                });
                
                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                const list = await response.json();
                if (response.ok) {
                    appState.accounts = list;
                    updateDashboardStats();
                    renderRecentAccountsTable();
                    renderDaftarAkunTable();
                }
            } catch (err) {
                console.error("Error fetching accounts:", err);
                showToast("Gagal menyinkronkan data akun dari database.", "danger");
            }
        }

        function handleAdminUnauthorized() {
            showToast("Sesi admin berakhir atau kunci salah. Silakan login kembali.", "danger");
            sessionStorage.removeItem('admin_passcode');
            switchView('landing');
            openAdminAuthModal();
        }

        async function fetchStock() {
            try {
                const response = await fetch('/api/accounts/stock');
                const data = await response.json();
                if (response.ok) {
                    const stock = data.count || 0;
                    appState.stockCount = stock;
                    
                    const badge = document.querySelector('.landing-nav .pill-badge');
                    const ctaBtn = document.querySelector('.btn-cta');
                    
                    if (badge) {
                        if (stock > 0) {
                            badge.className = 'pill-badge pill-success';
                            badge.innerHTML = '<i class="ti ti-circle-filled"></i> STATUS: ONLINE';
                        } else {
                            badge.className = 'pill-badge pill-danger';
                            badge.innerHTML = '<i class="ti ti-circle-filled"></i> STATUS: STOK HABIS';
                        }
                    }
                    
                    if (ctaBtn) {
                        if (stock > 0) {
                            ctaBtn.disabled = false;
                            ctaBtn.innerHTML = 'Beli Sekarang <i class="ti ti-arrow-right"></i>';
                        } else {
                            ctaBtn.disabled = true;
                            ctaBtn.innerHTML = 'Stok Habis';
                        }
                    }

                    const pricePreview = document.getElementById('bulk-price-preview');
                    const qtyInput = document.getElementById('purchase-qty');
                    const stockStatus = document.getElementById('purchase-stock-status');

                    if (stockStatus) {
                        if (stock > 0) {
                            stockStatus.textContent = `Stok: ${stock}`;
                            stockStatus.style.color = 'var(--color-success)';
                            stockStatus.style.borderColor = 'rgba(46, 213, 115, 0.2)';
                            stockStatus.style.background = 'rgba(46, 213, 115, 0.05)';
                        } else {
                            stockStatus.textContent = `Stok Habis`;
                            stockStatus.style.color = 'var(--color-danger)';
                            stockStatus.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                            stockStatus.style.background = 'rgba(239, 68, 68, 0.05)';
                        }
                    }

                    if (qtyInput) {
                        const currentQty = parseInt(qtyInput.value) || 1;
                        const totalPrice = 3000 * currentQty;
                        if (pricePreview) {
                            pricePreview.innerHTML = `Rp ${totalPrice.toLocaleString('id-ID')}`;
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching stock:", err);
            }
        }

        // -------------------------------------------------------------
        // Social Proof Renderer
        // -------------------------------------------------------------
        function renderRecentPurchases() {
            const listEl = document.getElementById('recent-buyers-list');
            if (!listEl) return;
            
            if (appState.recentPurchases.length === 0) {
                listEl.innerHTML = '<div class="buyer-row"><span class="buyer-email">Belum ada pembelian.</span></div>';
                return;
            }

            // Render only top 3 items
            const displayItems = appState.recentPurchases.slice(0, 3);
            listEl.innerHTML = displayItems.map(item => `
                <div class="buyer-row">
                    <span class="buyer-email">${escapeHTML(item.email)}</span>
                    <span class="buyer-time">${escapeHTML(item.time)}</span>
                </div>
            `).join('');
        }

        // -------------------------------------------------------------
        // Checkout & QRIS Functions
        // -------------------------------------------------------------
        async function handleCheckout(e) {
            e.preventDefault();
            const emailInput = document.getElementById('customer-email').value.trim();
            const phoneInput = document.getElementById('customer-phone').value.trim();
            const quantityInput = document.getElementById('purchase-qty').value;
            if (!emailInput || !phoneInput) { showToast("Harap lengkapi semua isian formulir!", "warning"); return; }

            const ctaBtn = document.querySelector('.btn-cta');
            ctaBtn.disabled = true;
            ctaBtn.innerHTML = 'Membuat QRIS... <div class="qris-spinner" style="border-top-color: white; margin-left: 8px;"></div>';
            try {
                const response = await fetch('/api/payment/create-qris', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, whatsapp: phoneInput, quantity: quantityInput })
                });
                const resData = await response.json();
                if (response.ok && resData.success) {
                    openPaymentModal(resData.qr_url, resData.ref_no, resData.amount, null);
                } else {
                    showToast(resData.error || "Gagal membuat QRIS.", "danger");
                }
            } catch (err) {
                console.error("Checkout transaction error:", err);
                showToast("Koneksi gagal. Silakan coba lagi.", "danger");
            } finally {
                ctaBtn.disabled = false;
                ctaBtn.innerHTML = 'Beli Sekarang <i class="ti ti-arrow-right"></i>';
            }
        }

        function openPaymentModal(qrUrl, refNo, amount, paymentLink) {
            const modal = document.getElementById('modal-payment');
            document.getElementById('qris-image-render').src = qrUrl;
            document.getElementById('pay-ref').textContent = refNo;
            document.getElementById('pay-amount').textContent = `Rp ${Number(amount).toLocaleString('id-ID')}`;
            
            appState.activeQrisRef = refNo;
            openModal('modal-payment');

            // Countdown timer (30 minutes)
            let durationSeconds = 30 * 60;
            const timerDisplay = document.getElementById('qris-timer');
            
            // Clear any existing countdown
            if (window.qrisTimerInterval) clearInterval(window.qrisTimerInterval);
            
            window.qrisTimerInterval = setInterval(() => {
                let minutes = Math.floor(durationSeconds / 60);
                let seconds = durationSeconds % 60;
                
                minutes = minutes < 10 ? '0' + minutes : minutes;
                seconds = seconds < 10 ? '0' + seconds : seconds;
                
                timerDisplay.textContent = `${minutes}:${seconds}`;
                
                if (--durationSeconds < 0) {
                    cancelPayment();
                    showToast("Batas waktu pembayaran habis.", "warning");
                }
            }, 1000);

            // Start polling transaction status
            startStatusPolling(refNo);
        }

        function startStatusPolling(refNo) {
            if (appState.activeQrisInterval) clearInterval(appState.activeQrisInterval);
            if (appState.activeQrisTimeout) clearTimeout(appState.activeQrisTimeout);

            // Poll every 5 seconds
            appState.activeQrisInterval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/payment/check-status/${refNo}`);
                    const checkData = await response.json();

                    if (checkData.status === 'success') {
                        completeCheckoutFlow(checkData);
                    } else if (checkData.status === 'success_out_of_stock') {
                        cancelPayment();
                        showToast(checkData.message, "warning");
                    } else if (checkData.status === 'expired') {
                        cancelPayment();
                        showToast("QRIS sudah kedaluwarsa. Silakan buat transaksi baru.", "warning");
                    }
                } catch (err) {
                    console.warn("Polling payment:", err.message);
                }
            }, 5000);

            // Auto timeout polling after 30 minutes
            appState.activeQrisTimeout = setTimeout(() => {
                cancelPayment();
            }, 30 * 60 * 1000);
        }

        function cancelPayment() {
            if (appState.activeQrisInterval) clearInterval(appState.activeQrisInterval);
            if (appState.activeQrisTimeout) clearTimeout(appState.activeQrisTimeout);
            if (window.qrisTimerInterval) clearInterval(window.qrisTimerInterval);
            
            closeModal('modal-payment');
            appState.activeQrisRef = null;
            appState.activeQrisApiKey = null;
            showToast("Pembayaran dibatalkan/ditutup.", "warning");
        }



        function completeCheckoutFlow(data) {
            // Clean intervals
            if (appState.activeQrisInterval) clearInterval(appState.activeQrisInterval);
            if (appState.activeQrisTimeout) clearTimeout(appState.activeQrisTimeout);
            if (window.qrisTimerInterval) clearInterval(window.qrisTimerInterval);
            
            closeModal('modal-payment');
            
            // Store data for download
            appState.lastPurchasedData = data;
            
            // Hide landing and open success delivery panel
            document.getElementById('view-landing').classList.remove('active');
            
            // Set details
            const accountsList = data.accounts && data.accounts.length > 0 
                ? data.accounts 
                : [{ gmail: data.gmail, link_akses: data.link_akses }];
                
            const wrapper = document.getElementById('delivery-accounts-wrapper');
            wrapper.innerHTML = accountsList.map((acc, index) => {
                const escapedGmail = escapeHTML(acc.gmail);
                const escapedLink = escapeHTML(acc.link_akses);
                
                return `
                    <div class="delivery-credentials-card" style="margin-top: 16px; text-align: left;">
                        ${accountsList.length > 1 ? `<div style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--color-primary); margin-bottom: 12px; border-bottom: 1px dashed rgba(17,24,39,0.08); padding-bottom: 6px;">AKUN #${index + 1}</div>` : ''}
                        <div class="credential-item">
                            <div class="credential-label">Gmail Akun</div>
                            <div class="credential-value-wrapper">
                                <span class="credential-val-text">${escapedGmail}</span>
                                <button class="btn-credential-copy" onclick="copyValueToClipboard(decodeURIComponent('${encodeURIComponent(acc.gmail)}'), 'Gmail Akun #${index + 1}')"><i class="ti ti-copy"></i></button>
                            </div>
                        </div>
                        <div class="credential-item" style="margin-top: 12px;">
                            <div class="credential-label">Link Akses / Aktivasi</div>
                            <div class="credential-value-wrapper">
                                <span class="credential-val-text">${escapedLink}</span>
                                <button class="btn-credential-copy" onclick="copyValueToClipboard(decodeURIComponent('${encodeURIComponent(acc.link_akses)}'), 'Link Akses #${index + 1}')"><i class="ti ti-copy"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('delivery-note').textContent = appState.settings.global_note;
            
            // Render instructions
            const stepsListEl = document.getElementById('delivery-steps-list');
            if (appState.settings.login_steps && appState.settings.login_steps.length > 0) {
                stepsListEl.innerHTML = appState.settings.login_steps.map((step, idx) => `
                    <div class="tata-cara-mock-step">
                        <div class="step-circle">${idx + 1}</div>
                        <div>
                            <h4 class="step-mock-title">${escapeHTML(step.title)}</h4>
                            <p class="step-mock-desc">${escapeHTML(step.description)}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                stepsListEl.innerHTML = '<p style="font-size:12px; color:var(--color-text-muted);">Tidak ada panduan login khusus.</p>';
            }

            document.getElementById('view-success-delivery').classList.add('active');
            showToast("Pembayaran diverifikasi! Kredensial telah dikirim.", "success");
            
            // Refresh counts
            fetchAccounts();
            fetchPurchases();
        }

        function downloadAccountsTxt() {
            if (!appState.lastPurchasedData) {
                showToast("Tidak ada data akun yang siap diunduh.", "warning");
                return;
            }

            const data = appState.lastPurchasedData;
            const accountsList = data.accounts && data.accounts.length > 0 
                ? data.accounts 
                : [{ gmail: data.gmail, link_akses: data.link_akses }];
            
            const refNo = data.ref_no || appState.activeQrisRef || 'UNKNOWN';

            let txtContent = `DETAIL AKUN ALIGHT MOTION PREMIUM Anda\n`;
            txtContent += `===========================================\n`;
            txtContent += `Reference ID : ${refNo}\n`;
            txtContent += `Tanggal      : ${new Date().toLocaleString('id-ID')}\n\n`;

            accountsList.forEach((acc, index) => {
                txtContent += `AKUN #${index + 1}\n`;
                txtContent += `Gmail      : ${acc.gmail}\n`;
                txtContent += `Link Akses : ${acc.link_akses}\n`;
                txtContent += `-------------------------------------------\n`;
            });

            if (appState.settings && appState.settings.global_note) {
                txtContent += `Catatan Khusus:\n${appState.settings.global_note}\n\n`;
            }

            if (appState.settings && appState.settings.login_steps && appState.settings.login_steps.length > 0) {
                txtContent += `Tata Cara Login:\n`;
                appState.settings.login_steps.forEach((step, idx) => {
                    txtContent += `${idx + 1}. ${step.title}\n   ${step.description}\n`;
                });
            }

            txtContent += `===========================================\n`;
            txtContent += `Terima kasih telah berbelanja di BrannMotion!\n`;
            txtContent += `BrannMotion — Transaksi instan otomatis 24/7\n`;

            const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `BrannMotion_Akun_${refNo}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("File akun berhasil diunduh!", "success");
        }

        // -------------------------------------------------------------
        // Admin Auth Flow
        // -------------------------------------------------------------
        function openAdminAuthModal() {
            document.getElementById('admin-username').value = '';
            document.getElementById('admin-password').value = '';
            openModal('modal-admin-auth');
        }

        async function handleAdminAuth(e) {
            e.preventDefault();
            const username = document.getElementById('admin-username').value.trim();
            const password = document.getElementById('admin-password').value;

            try {
                const response = await fetch('/api/admin/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();

                if (response.ok && result.success && result.token) {
                    sessionStorage.setItem('admin_passcode', result.token);
                    closeModal('modal-admin-auth');
                    showToast("Login admin berhasil!", "success");
                    switchView('admin');
                    switchAdminSubpage('dashboard');
                } else {
                    showToast(result.error || "Username atau password admin salah!", "danger");
                }
            } catch (err) {
                console.error("Auth error:", err);
                showToast("Gagal melakukan otentikasi.", "danger");
            }
        }

        // -------------------------------------------------------------
        // Stats and Tables Renderer
        // -------------------------------------------------------------
        function updateDashboardStats() {
            const total = appState.accounts.length;
            const tersedia = appState.accounts.filter(a => a.status === 'Aktif').length;
            const terpakai = appState.accounts.filter(a => a.status === 'Terpakai').length;

            document.getElementById('stat-total').textContent = total;
            document.getElementById('stat-tersedia').textContent = tersedia;
            document.getElementById('stat-terpakai').textContent = terpakai;
        }

        function renderRecentAccountsTable() {
            const tbody = document.getElementById('dashboard-recent-table');
            if (!tbody) return;

            // Render top 5 accounts
            const topAccounts = appState.accounts.slice(0, 5);
            if (topAccounts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted)">Belum ada data akun.</td></tr>';
                return;
            }

            tbody.innerHTML = topAccounts.map(acc => {
                let statusPill = `<span class="pill-badge pill-success">Aktif</span>`;
                if (acc.status === 'Terpakai') statusPill = `<span class="pill-badge pill-danger">Terpakai</span>`;
                if (acc.status === 'Pending') statusPill = `<span class="pill-badge pill-warning">Pending</span>`;

                return `
                    <tr>
                        <td class="account-gmail-cell">${escapeHTML(acc.gmail)}</td>
                        <td class="account-link-cell">${escapeHTML(acc.link_akses)}</td>
                        <td>${statusPill}</td>
                        <td>
                            <button class="btn-action-icon" title="Lihat di Daftar" onclick="switchAdminSubpage('daftar-akun')">
                                <i class="ti ti-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function renderDaftarAkunTable() {
            const tbody = document.getElementById('daftar-akun-table-body');
            if (!tbody) return;

            const searchQuery = document.getElementById('search-accounts').value.toLowerCase();
            const filterValue = document.getElementById('filter-status').value;

            // Filter list
            const filtered = appState.accounts.filter(acc => {
                const matchesSearch = acc.gmail.toLowerCase().includes(searchQuery);
                const matchesFilter = filterValue === 'all' || acc.status === filterValue;
                return matchesSearch && matchesFilter;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted)">Tidak ada data akun yang cocok.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(acc => {
                const isAktifSelected = acc.status === 'Aktif' ? 'selected' : '';
                const isTerpakaiSelected = acc.status === 'Terpakai' ? 'selected' : '';
                const isPendingSelected = acc.status === 'Pending' ? 'selected' : '';

                // Escape values for secure rendering
                const escapedGmail = escapeHTML(acc.gmail);
                const escapedLink = escapeHTML(acc.link_akses);

                return `
                    <tr>
                        <td class="account-gmail-cell">${escapedGmail}</td>
                        <td class="account-link-cell" title="${escapedLink}">${escapedLink}</td>
                        <td>
                            <select class="filter-select" style="padding: 4px 8px; font-size: 12px;" onchange="updateAccountStatus('${acc._id}', this.value)">
                                <option value="Aktif" ${isAktifSelected}>Aktif</option>
                                <option value="Terpakai" ${isTerpakaiSelected}>Terpakai</option>
                                <option value="Pending" ${isPendingSelected}>Pending</option>
                            </select>
                        </td>
                        <td>
                            <div class="actions-flex">
                                <button class="btn-action-icon" title="Salin Link Akses" onclick="copyValueToClipboard(decodeURIComponent('${encodeURIComponent(acc.link_akses)}'), 'Link Akses')">
                                    <i class="ti ti-link"></i>
                                </button>
                                <button class="btn-action-icon" title="Salin Info Lengkap" onclick="copyFullAccountInfo('${acc._id}')">
                                    <i class="ti ti-share"></i>
                                </button>
                                <button class="btn-action-icon btn-delete" title="Hapus Akun" onclick="deleteAccount('${acc._id}')">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // -------------------------------------------------------------
        // Account Mutations (Add, Delete, Status Edit)
        // -------------------------------------------------------------
        async function submitManualAccount(e) {
            e.preventDefault();
            const gmail = document.getElementById('manual-gmail').value;
            const link_akses = document.getElementById('manual-link').value;
            const catatan_khusus = document.getElementById('manual-note').value;

            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/accounts', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': passcode || ''
                    },
                    body: JSON.stringify({ gmail, link_akses, status: 'Aktif', catatan_khusus })
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                if (response.ok) {
                    showToast("Akun baru berhasil disimpan!", "success");
                    // Reset Form
                    document.getElementById('form-add-manual').reset();
                    fetchAccounts();
                    switchAdminSubpage('daftar-akun');
                } else {
                    const err = await response.json();
                    showToast(err.error || "Gagal menyimpan akun.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal. Gagal menyimpan akun.", "danger");
            }
        }

        async function updateAccountStatus(id, newStatus) {
            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch(`/api/accounts/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': passcode || ''
                    },
                    body: JSON.stringify({ status: newStatus })
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                if (response.ok) {
                    showToast(`Status akun berhasil diperbarui ke ${newStatus}!`, "success");
                    fetchAccounts();
                } else {
                    showToast("Gagal memperbarui status akun.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal.", "danger");
            }
        }

        async function deleteAccount(id) {
            if (!confirm("Apakah Anda yakin ingin menghapus akun ini dari database?")) return;

            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch(`/api/accounts/${id}`, {
                    method: 'DELETE',
                    headers: { 'X-Admin-Key': passcode || '' }
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                if (response.ok) {
                    showToast("Akun berhasil dihapus dari database.", "success");
                    fetchAccounts();
                } else {
                    showToast("Gagal menghapus akun.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal.", "danger");
            }
        }

        // -------------------------------------------------------------
        // Bulk File Import Operations
        // -------------------------------------------------------------
        function handleFileImport(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const text = evt.target.result;
                const rows = text.split(/\r?\n/);
                const parsed = [];
                
                rows.forEach((row, index) => {
                    // Skip header row if matches exact pattern
                    if (index === 0 && row.toLowerCase().includes('gmail')) return;
                    
                    const cols = row.split(',');
                    if (cols.length >= 2 && cols[0].includes('@')) {
                        parsed.push({
                            gmail: cols[0].trim(),
                            link_akses: cols[1].trim()
                        });
                    }
                });

                if (parsed.length > 0) {
                    appState.tempParsedAccounts = parsed;
                    
                    // Render preview
                    document.getElementById('import-count').textContent = parsed.length;
                    const previewTbody = document.getElementById('import-preview-table');
                    
                    previewTbody.innerHTML = parsed.map(item => `
                        <tr>
                            <td class="account-gmail-cell">${escapeHTML(item.gmail)}</td>
                            <td class="account-link-cell" title="${escapeHTML(item.link_akses)}">${escapeHTML(item.link_akses)}</td>
                        </tr>
                    `).join('');
                    
                    document.getElementById('import-preview-box').style.display = 'block';
                    showToast(`Parsed ${parsed.length} akun dari file.`, "success");
                } else {
                    showToast("Format file salah atau tidak ada baris yang valid.", "danger");
                }
            };

            reader.readAsText(file);
        }

        async function confirmBulkImport() {
            if (appState.tempParsedAccounts.length === 0) return;

            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/accounts/import', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': passcode || ''
                    },
                    body: JSON.stringify({ items: appState.tempParsedAccounts })
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                const res = await response.json();

                if (response.ok && res.success) {
                    showToast(`Berhasil menambahkan ${res.count} akun baru!`, "success");
                    // Reset tab
                    document.getElementById('import-file-input').value = '';
                    document.getElementById('import-preview-box').style.display = 'none';
                    appState.tempParsedAccounts = [];
                    
                    fetchAccounts();
                    switchAdminSubpage('daftar-akun');
                } else {
                    showToast(res.error || "Gagal mengimpor file.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal saat mengimpor file.", "danger");
            }
        }

        // -------------------------------------------------------------
        // Global Note Operations
        // -------------------------------------------------------------
        async function submitGlobalNote(e) {
            e.preventDefault();
            const noteContent = document.getElementById('global-note-textarea').value;

            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/settings/global-note', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': passcode || ''
                    },
                    body: JSON.stringify({ note: noteContent })
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                if (response.ok) {
                    showToast("Catatan global berhasil disimpan!", "success");
                    fetchSettings();
                } else {
                    showToast("Gagal menyimpan catatan.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal.", "danger");
            }
        }

        // -------------------------------------------------------------
        // Tata Cara Login Steps Operations
        // -------------------------------------------------------------
        function renderStepsPreview() {
            const previewEl = document.getElementById('steps-preview-display');
            if (!previewEl) return;

            const steps = appState.settings.login_steps || [];
            
            // Build visual layout
            if (steps.length === 0) {
                previewEl.innerHTML = '<p style="font-size:12px; color:var(--color-text-muted);">Belum ada tata cara login yang dibuat.</p>';
            } else {
                previewEl.innerHTML = steps.map((step, idx) => `
                    <div class="tata-cara-mock-step">
                        <div class="step-circle">${idx + 1}</div>
                        <div>
                            <h4 class="step-mock-title" style="font-family: var(--font-display);">${escapeHTML(step.title)}</h4>
                            <p class="step-mock-desc" style="font-family: var(--font-mono);">${escapeHTML(step.description)}</p>
                        </div>
                    </div>
                `).join('');
            }

            // Build rows editor
            const rowsContainer = document.getElementById('step-rows-container');
            if (rowsContainer) {
                if (steps.length === 0) {
                    rowsContainer.innerHTML = '<p style="color:var(--color-text-muted); font-size:13px; text-align:center; padding:16px 0;">Belum ada langkah. Klik tombol Tambah Langkah.</p>';
                } else {
                    rowsContainer.innerHTML = steps.map((step, idx) => `
                        <div class="step-row-editor" id="step-row-${idx}">
                            <div class="step-editor-fields">
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="form-label-mono">Judul Langkah #${idx + 1}</label>
                                    <input type="text" class="form-input step-title-input" value="${escapeHTML(step.title)}" placeholder="Judul langkah" required>
                                </div>
                                <div class="form-group" style="margin-bottom:0;">
                                    <label class="form-label-mono">Keterangan / Deskripsi</label>
                                    <input type="text" class="form-input step-desc-input" value="${escapeHTML(step.description)}" placeholder="Keterangan cara login" required>
                                </div>
                            </div>
                            <div class="step-editor-actions">
                                <button class="btn-action-icon" title="Geser ke Atas" onclick="shiftStep(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
                                    <i class="ti ti-arrow-up"></i>
                                </button>
                                <button class="btn-action-icon" title="Geser ke Bawah" onclick="shiftStep(${idx}, 1)" ${idx === steps.length - 1 ? 'disabled' : ''}>
                                    <i class="ti ti-arrow-down"></i>
                                </button>
                                <button class="btn-action-icon btn-delete" title="Hapus Langkah" onclick="removeStep(${idx})">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        function addNewStepField() {
            if (!appState.settings.login_steps) appState.settings.login_steps = [];
            
            // Add a blank placeholder step
            appState.settings.login_steps.push({
                id: (Date.now()).toString(),
                title: 'Langkah Baru',
                description: 'Keterangan lengkap tentang langkah ini...'
            });
            renderStepsPreview();
        }

        function removeStep(index) {
            appState.settings.login_steps.splice(index, 1);
            renderStepsPreview();
        }

        function shiftStep(index, offset) {
            const targetIndex = index + offset;
            if (targetIndex < 0 || targetIndex >= appState.settings.login_steps.length) return;

            const temp = appState.settings.login_steps[index];
            appState.settings.login_steps[index] = appState.settings.login_steps[targetIndex];
            appState.settings.login_steps[targetIndex] = temp;
            
            renderStepsPreview();
        }

        async function saveLoginSteps() {
            // Read inputs directly from DOM to reflect changes
            const stepRows = document.querySelectorAll('.step-row-editor');
            const newSteps = [];

            stepRows.forEach((row, idx) => {
                const titleVal = row.querySelector('.step-title-input').value;
                const descVal = row.querySelector('.step-desc-input').value;
                newSteps.push({
                    id: (idx + 1).toString(),
                    title: titleVal,
                    description: descVal
                });
            });

            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/settings/login-steps', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Key': passcode || ''
                    },
                    body: JSON.stringify({ steps: newSteps })
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                if (response.ok) {
                    showToast("Tata cara login berhasil diperbarui!", "success");
                    fetchSettings();
                } else {
                    showToast("Gagal menyimpan tata cara login.", "danger");
                }
            } catch (err) {
                console.error(err);
                showToast("Koneksi gagal.", "danger");
            }
        }

        // -------------------------------------------------------------
        // Helper Utility Functions
        // -------------------------------------------------------------
        function copyText(elementId, labelName = 'Data') {
            const text = document.getElementById(elementId).textContent;
            copyValueToClipboard(text, labelName);
        }

        function copyValueToClipboard(text, labelName) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(`${labelName} berhasil disalin ke clipboard!`, "success");
            }).catch(err => {
                showToast("Gagal menyalin teks.", "danger");
            });
        }

        function copyFullAccountInfo(accId) {
            const acc = appState.accounts.find(a => a._id === accId);
            if (!acc) return;

            const note = appState.settings.global_note || '';
            const stepsText = (appState.settings.login_steps || []).map((step, idx) => {
                return `${idx + 1}. ${step.title}: ${step.description}`;
            }).join('\n');

            const fullText = `Detail Akun Alight Motion Premium Anda:
-------------------------------------------
Gmail: ${acc.gmail}
Link Akses: ${acc.link_akses}

Catatan Khusus:
${note}

Langkah Aktivasi:
${stepsText}
-------------------------------------------
BrannMotion — Instant Purchase Store`;

            copyValueToClipboard(fullText, "Informasi lengkap akun");
        }

        function exportCSV() {
            if (appState.accounts.length === 0) {
                showToast("Tidak ada data akun untuk diekspor.", "warning");
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Gmail,Link Akses,Status,Catatan Khusus\n";

            appState.accounts.forEach(acc => {
                const row = [
                    acc.gmail,
                    acc.link_akses,
                    acc.status,
                    (acc.catatan_khusus || '').replace(/,/g, ';').replace(/\n/g, ' ')
                ].join(',');
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `daftar_akun_brannmotion_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Berhasil mengekspor database akun ke CSV!", "success");
        }

        // -------------------------------------------------------------
        // Modal State Controller
        // -------------------------------------------------------------
        function openModal(modalId) {
            const overlay = document.getElementById(modalId);
            overlay.classList.add('active');
        }

        function closeModal(modalId) {
            const overlay = document.getElementById(modalId);
            overlay.classList.remove('active');
        }

        // -------------------------------------------------------------
        // Tabs Controller (Inside Admin Panel)
        // -------------------------------------------------------------
        function switchTab(tabId, btnElement) {
            const tabContainer = btnElement.closest('.admin-card');
            
            // Toggle active btn class
            const tabBtns = tabContainer.querySelectorAll('.tab-btn');
            tabBtns.forEach(btn => btn.classList.remove('active'));
            btnElement.classList.add('active');

            // Toggle active pane class
            const tabPanes = tabContainer.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            const targetPane = document.getElementById(tabId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        }

        // -------------------------------------------------------------
        // Toast Notification Engine
        // -------------------------------------------------------------
        function showToast(message, type = 'success') {
            const root = document.getElementById('toast-root');
            
            const toast = document.createElement('div');
            toast.className = `toast-item ${type}`;
            
            let icon = '<i class="ti ti-circle-check"></i>';
            if (type === 'danger') icon = '<i class="ti ti-circle-x"></i>';
            if (type === 'warning') icon = '<i class="ti ti-alert-triangle"></i>';

            toast.innerHTML = `${icon}<span>${message}</span>`;
            root.appendChild(toast);

            // Trigger auto timeout dismiss
            setTimeout(() => {
                toast.classList.add('fade-out');
                // Remove from DOM after transition completes
                setTimeout(() => {
                    toast.remove();
                }, 250);
            }, 2500);
        }

        // -------------------------------------------------------------
        // Bulk Quantity Adjuster
        // -------------------------------------------------------------
        function adjustQty(offset) {
            const qtyInput = document.getElementById('purchase-qty');
            let currentQty = parseInt(qtyInput.value) || 1;
            
            // Count active stock
            const availableStock = appState.stockCount;
            if (availableStock === 0) {
                showToast("Stok lisensi aktif kosong.", "warning");
                return;
            }

            let targetQty = currentQty + offset;
            
            if (targetQty < 1) targetQty = 1;
            if (targetQty > 10) {
                targetQty = 10;
                showToast("Maksimal pembelian 10 akun sekaligus.", "warning");
            }
            if (targetQty > availableStock) {
                targetQty = Math.max(1, availableStock);
                showToast(`Stok hanya tersedia ${availableStock} akun.`, "warning");
            }
            
            qtyInput.value = targetQty;
            
            // Update price preview
            const totalPrice = 3000 * targetQty;
            const pricePreview = document.getElementById('bulk-price-preview');
            if (pricePreview) {
                pricePreview.innerHTML = `Rp ${totalPrice.toLocaleString('id-ID')}`;
            }
            
            const stockStatus = document.getElementById('purchase-stock-status');
            if (stockStatus) {
                stockStatus.textContent = `Stok: ${availableStock}`;
            }
        }

        // -------------------------------------------------------------
        // Leaderboard (Top Buyers) Fetch & Render
        // -------------------------------------------------------------
        async function fetchTopBuyers() {
            try {
                const response = await fetch('/api/purchases/top');
                const list = await response.json();
                if (response.ok) {
                    renderTopBuyers(list);
                }
            } catch (err) {
                console.error("Error fetching top buyers:", err);
            }
        }

        function renderTopBuyers(list) {
            const listEl = document.getElementById('top-buyers-list');
            if (!listEl) return;

            if (list.length === 0) {
                listEl.innerHTML = '<div class="buyer-row"><span class="buyer-email">Belum ada data peringkat.</span></div>';
                return;
            }

            listEl.innerHTML = list.map((item, idx) => {
                let crownColor = '#9CA3AF'; // Silver/gray
                if (idx === 0) crownColor = '#FFD700'; // Gold
                if (idx === 1) crownColor = '#C0C0C0'; // Silver
                if (idx === 2) crownColor = '#CD7F32'; // Bronze
                
                return `
                    <div class="buyer-row">
                        <span class="buyer-email" style="display: flex; align-items: center; gap: 6px;">
                            <i class="ti ti-crown" style="color: ${crownColor}; font-size: 14px;"></i>
                            ${escapeHTML(item.email)}
                        </span>
                        <span class="buyer-time" style="font-weight: 700; color: var(--color-primary);">${item.count} Akun</span>
                    </div>
                `;
            }).join('');
        }

        function makeHistoryAccountHtml(acc, index, showHeader) {
            const escapedGmail = escapeHTML(acc.gmail);
            const escapedLink = escapeHTML(acc.link_akses);

            return `
                <div class="credential-card">
                    ${showHeader ? `<div class="credential-card-header">AKUN #${index + 1}</div>` : ''}
                    <div class="credential-fields-container">
                        <div class="credential-field">
                            <div class="credential-field-label"><i class="ti ti-mail"></i> Gmail Akun</div>
                            <div class="credential-field-value-row">
                                <span class="credential-value">${escapedGmail}</span>
                                <button class="btn-credential-copy" onclick="copyValueToClipboard(decodeURIComponent('${encodeURIComponent(acc.gmail)}'), 'Gmail')" title="Salin Gmail"><i class="ti ti-copy"></i></button>
                            </div>
                        </div>
                        
                        <div class="credential-field">
                            <div class="credential-field-label"><i class="ti ti-link"></i> Link Akses / Aktivasi</div>
                            <div class="credential-field-value-row">
                                <span class="credential-value link-value" title="${escapedLink}">${escapedLink}</span>
                                <button class="btn-credential-copy" onclick="copyValueToClipboard(decodeURIComponent('${encodeURIComponent(acc.link_akses)}'), 'Link Akses')" title="Salin Link"><i class="ti ti-copy"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        async function lookupPurchaseHistory() {
            const searchVal = document.getElementById('history-search-input').value.trim();
            if (!searchVal) {
                showToast("Harap masukkan email atau Ref ID Anda!", "warning");
                return;
            }

            const resultsWrapper = document.getElementById('history-results-wrapper');
            resultsWrapper.style.display = 'block';
            resultsWrapper.innerHTML = `
                <div style="text-align: center; padding: 12px 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted);">
                    <span class="qris-spinner" style="display: inline-block; margin-bottom: 6px;"></span>
                    <div>Mencari data transaksi...</div>
                </div>
            `;

            try {
                const response = await fetch(`/api/purchases/history?search=${encodeURIComponent(searchVal)}`);
                const list = await response.json();

                if (!response.ok) {
                    resultsWrapper.innerHTML = `<div style="font-family: var(--font-mono); font-size: 12px; color: var(--color-danger); text-align: center; padding: 8px 0;">${list.error || 'Terjadi kesalahan.'}</div>`;
                    return;
                }

                if (list.length === 0) {
                    resultsWrapper.innerHTML = `
                        <div style="font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 8px 0;">
                            Tidak ditemukan transaksi sukses untuk "${searchVal}".
                        </div>
                    `;
                    return;
                }

                // Render matching transaction credential cards
                resultsWrapper.innerHTML = list.map(tx => {
                    const accountsList = tx.accounts_assigned && tx.accounts_assigned.length > 0 
                        ? tx.accounts_assigned 
                        : [{ gmail: tx.gmail_assigned, link_akses: tx.link_assigned }];
                    
                    const dateText = new Date(tx.timestamp).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const accountsHtml = accountsList.map((acc, index) => 
                        makeHistoryAccountHtml(acc, index, accountsList.length > 1)
                    ).join('');

                    return `
                        <div class="license-ticket-item">
                            <div class="ticket-header">
                                <span class="ticket-ref"><i class="ti ti-ticket"></i> ${tx.ref_no}</span>
                                <span class="ticket-date">${dateText}</span>
                            </div>
                            ${accountsHtml}
                        </div>
                    `;
                }).join('');

            } catch (err) {
                console.error("Lookup error:", err);
                resultsWrapper.innerHTML = `<div style="font-family: var(--font-mono); font-size: 12px; color: var(--color-danger); text-align: center; padding: 8px 0;">Koneksi gagal. Silakan coba lagi.</div>`;
            }
        }

        async function fetchAdminPurchases() {
            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/admin/purchases', {
                    headers: { 'X-Admin-Key': passcode || '' }
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                const list = await response.json();
                if (response.ok) {
                    appState.adminPurchases = list;
                    renderRiwayatPembelianTable();
                }
            } catch (err) {
                console.error("Error fetching admin purchases:", err);
                showToast("Gagal mengambil riwayat transaksi.", "danger");
            }
        }

        function renderRiwayatPembelianTable() {
            const tbody = document.getElementById('riwayat-pembelian-table-body');
            if (!tbody) return;

            const searchQuery = document.getElementById('search-purchases').value.toLowerCase();

            const filtered = (appState.adminPurchases || []).filter(tx => {
                const matchesSearch = tx.email.toLowerCase().includes(searchQuery) || tx.ref_no.toLowerCase().includes(searchQuery);
                return matchesSearch;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted)">Tidak ada riwayat pembelian.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(tx => {
                const accountsList = tx.accounts_assigned && tx.accounts_assigned.length > 0 
                    ? tx.accounts_assigned 
                    : [{ gmail: tx.gmail_assigned, link_akses: tx.link_assigned }];
                
                const accountsHtml = accountsList.map(acc => {
                    if (!acc.gmail) return '<span style="color:var(--color-text-muted); font-style:italic;">Belum dialokasikan</span>';
                    return `
                        <div style="margin-bottom: 6px; font-family: var(--font-mono); font-size:12px;">
                            <strong>Gmail:</strong> ${escapeHTML(acc.gmail)}<br/>
                            <span style="color:var(--color-text-muted); font-size:11px;">Link: ${escapeHTML(acc.link_akses)}</span>
                        </div>
                    `;
                }).join('');

                const dateText = new Date(tx.timestamp).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                return `
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--color-primary);">${escapeHTML(tx.ref_no)}</td>
                        <td>${escapeHTML(tx.email)}</td>
                        <td style="font-family: var(--font-mono); font-weight: 700;">${tx.quantity || 1} Akun</td>
                        <td style="font-family: var(--font-mono);">Rp ${(tx.amount || 0).toLocaleString('id-ID')}</td>
                        <td>${accountsHtml}</td>
                        <td>${dateText}</td>
                    </tr>
                `;
            }).join('');
        }



        // -------------------------------------------------------------
        // Admin Users Panel API & Renders
        // -------------------------------------------------------------
        async function fetchAdminUsers() {
            const passcode = sessionStorage.getItem('admin_passcode');
            try {
                const response = await fetch('/api/admin/users', {
                    headers: { 'X-Admin-Key': passcode || '' }
                });

                if (response.status === 401) {
                    handleAdminUnauthorized();
                    return;
                }

                const list = await response.json();
                if (response.ok) {
                    appState.adminUsers = list;
                    renderAdminUsersTable();
                }
            } catch (err) {
                console.error("Error fetching admin users:", err);
                showToast("Gagal mengambil data user terdaftar.", "danger");
            }
        }

        function renderAdminUsersTable() {
            const tbody = document.getElementById('users-table-body');
            if (!tbody) return;

            const searchQuery = document.getElementById('search-users').value.toLowerCase();

            const filtered = (appState.adminUsers || []).filter(u => {
                return u.email.toLowerCase().includes(searchQuery);
            });

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted)">Tidak ada user terdaftar.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(u => {
                const dateText = new Date(u.created_at).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                return `
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: 700;">${escapeHTML(u.email)}</td>
                        <td style="font-family: var(--font-mono);">${escapeHTML(u.phone || '-')}</td>
                        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--color-primary);">${u.total_purchases || 0} Kali</td>
                        <td style="font-family: var(--font-mono); font-weight: 700;">${u.total_qty || 0} Akun</td>
                        <td>${dateText}</td>
                    </tr>
                `;
            }).join('');
        }
