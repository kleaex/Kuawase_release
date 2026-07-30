/* 管理パネル タブ表示レイアウト（オプトイン）の初期化。
   #admin-tabnav / .admin-tab-btn / .admin-tab-panel / #admin-tabnav-toggle が
   すべて存在するページでのみ動作する。タブの種類・個数はページ側のHTML
   （data-tab-target / data-tab-panel）が決めるため、このモジュール自体は
   特定のタブ構成を前提としない。 */
function initAdminTabNav() {
    const toggle = document.getElementById('admin-tabnav-toggle');
    const tabnav = document.getElementById('admin-tabnav');
    if (!toggle || !tabnav) return;
    const tabBtns = Array.from(tabnav.querySelectorAll('.admin-tab-btn'));
    const panels = Array.from(document.querySelectorAll('#admin-panel > .admin-tab-panel'));
    const validTabNames = tabBtns.map(btn => btn.dataset.tabTarget);
    function activateTab(tabName) {
        tabBtns.forEach(btn => {
            const active = btn.dataset.tabTarget === tabName;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
            btn.tabIndex = active ? 0 : -1;
        });
        panels.forEach(panel => panel.classList.toggle('active', panel.dataset.tabPanel === tabName));
        localStorage.setItem('admin-tabnav-active', tabName);
    }
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tabTarget));
    });
    tabnav.addEventListener('keydown', (e) => {
        const currentIndex = tabBtns.findIndex(btn => btn === document.activeElement);
        if (currentIndex === -1) return;
        let nextIndex = null;
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + tabBtns.length) % tabBtns.length;
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % tabBtns.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = tabBtns.length - 1;
                break;
            default:
                return;
        }
        e.preventDefault();
        const nextBtn = tabBtns[nextIndex];
        nextBtn.focus();
        activateTab(nextBtn.dataset.tabTarget);
    });
    const storedTab = localStorage.getItem('admin-tabnav-active');
    const savedTab = validTabNames.includes(storedTab) ? storedTab : tabBtns[0]?.dataset.tabTarget;
    if (savedTab) activateTab(savedTab);

    const savedMode = localStorage.getItem('admin-tabnav-mode') === 'true';
    if (savedMode) {
        document.body.classList.add('admin-tabnav-mode');
    }
    toggle.checked = savedMode;
    toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        document.body.classList.toggle('admin-tabnav-mode', enabled);
        localStorage.setItem('admin-tabnav-mode', enabled);
    });
}

if (typeof window !== "undefined") {
    window.initAdminTabNav = initAdminTabNav;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { initAdminTabNav };
}
