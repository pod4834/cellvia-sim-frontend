// ui.js
// 🌟 드래그 로직
let activeDragEl = null, dragStartX = 0, dragStartY = 0, initX = 0, initY = 0;

document.addEventListener('pointerdown', function(e) {
    const header = e.target.closest('.widget-header, .perf-header, .edit-modal-header');
    if (!header || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    e.preventDefault();
    activeDragEl = header.closest('.widget, .perf-widget, .edit-modal');
    if (!activeDragEl) return;

    if (window.currentWidgetZ > 900) window.currentWidgetZ = 100;
    window.currentWidgetZ++;
    activeDragEl.style.zIndex = window.currentWidgetZ;

    const rect = activeDragEl.getBoundingClientRect();
    initX = rect.left; initY = rect.top < 48 ? 48 : rect.top;
    
    activeDragEl.style.width = rect.width + 'px';
    if (['perfWidget', 'matchingDetailBox', 'filterWidget'].includes(activeDragEl.id)) activeDragEl.style.height = rect.height + 'px';
    
    activeDragEl.style.bottom = 'auto'; activeDragEl.style.right = 'auto'; activeDragEl.style.margin = '0';
    activeDragEl.style.left = initX + 'px'; activeDragEl.style.setProperty('top', initY + 'px', 'important');

    dragStartX = e.clientX; dragStartY = e.clientY;
}, { passive: false });

document.addEventListener('pointermove', function(e) {
    if (!activeDragEl) return;
    e.preventDefault();
    let newX = initX + (e.clientX - dragStartX);
    let newY = initY + (e.clientY - dragStartY);
    if (newY < 48) newY = 48;
    activeDragEl.style.left = newX + 'px';
    activeDragEl.style.setProperty('top', newY + 'px', 'important');
}, { passive: false });

document.addEventListener('pointerup', () => { activeDragEl = null; });

window.toggleDarkMode = function() { document.body.classList.toggle('light-mode'); };

window.closeWidgetGlobal = function(e, widgetId, chkId) {
    if (e) e.stopPropagation();
    const w = document.getElementById(widgetId);
    if (w) w.style.display = 'none';
    const chk = document.getElementById(chkId);
    if (chk) chk.checked = false;
    window.minimizedWidgets.delete(widgetId); window.renderTaskbar();
};

window.minimizeWidget = function(e, widgetId) {
    if(e) e.stopPropagation();
    const widget = document.getElementById(widgetId);
    if(!widget) return;
    widget.style.display = 'none'; 
    window.minimizedWidgets.add(widgetId); 
    window.renderTaskbar();
};

window.renderTaskbar = function() {
    const tb = document.getElementById('taskbar'); if(!tb) return;
    tb.innerHTML = '';
    if(window.minimizedWidgets.size === 0) { tb.style.display = 'none'; return; }
    tb.style.display = 'flex';
    const titles = { 'perfWidget': '📊 실적 집계', 'aiWidget': '🧭 내비게이터', 'filterWidget': '🔎 검색' };
    window.minimizedWidgets.forEach(id => {
        if(!titles[id]) return;
        const btn = document.createElement('div'); btn.className = 'taskbar-item';
        btn.innerHTML = `<span>${titles[id]}</span>`;
        btn.onclick = () => {
            const w = document.getElementById(id);
            if(w) { w.style.display = 'flex'; window.minimizedWidgets.delete(id); window.renderTaskbar(); }
        };
        tb.appendChild(btn);
    });
};