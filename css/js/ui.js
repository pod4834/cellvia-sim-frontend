// frontend/css/js/ui.js
// 🌟 위젯 드래그 및 UI 상태 제어 모듈 (웹 배포 반응형/터치/화면이탈 방지 보강)

let activeDragEl = null, dragStartX = 0, dragStartY = 0, initX = 0, initY = 0;

// 전역 변수 안전망 초기화 (스크립트 로드 순서 무관하게 에러 방지)
window.currentWidgetZ = window.currentWidgetZ || 100;
window.minimizedWidgets = window.minimizedWidgets || new Set();

document.addEventListener('pointerdown', function(e) {
    // 마우스 우클릭 드래그 방지
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const header = e.target.closest('.widget-header, .perf-header, .edit-modal-header');
    if (
        !header ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'A'
    ) return;

    activeDragEl = header.closest('.widget, .perf-widget, .edit-modal');
    if (!activeDragEl) return;

    e.preventDefault();
    header.style.touchAction = 'none';

    if (window.currentWidgetZ > 900) window.currentWidgetZ = 100;
    window.currentWidgetZ++;
    activeDragEl.style.zIndex = window.currentWidgetZ;

    const rect = activeDragEl.getBoundingClientRect();
    initX = rect.left;
    initY = rect.top < 48 ? 48 : rect.top;

    activeDragEl.style.width = rect.width + 'px';
    if (['perfWidget', 'matchingDetailBox', 'filterWidget'].includes(activeDragEl.id)) {
        activeDragEl.style.height = rect.height + 'px';
    }

    activeDragEl.style.bottom = 'auto';
    activeDragEl.style.right = 'auto';
    activeDragEl.style.margin = '0';
    activeDragEl.style.left = initX + 'px';
    activeDragEl.style.setProperty('top', initY + 'px', 'important');

    dragStartX = e.clientX;
    dragStartY = e.clientY;
}, { passive: false });

document.addEventListener('pointermove', function(e) {
    if (!activeDragEl) return;
    e.preventDefault();

    let newX = initX + (e.clientX - dragStartX);
    let newY = initY + (e.clientY - dragStartY);

    // 🌟 [웹 배포 보강] 다양한 해상도에서 위젯이 화면 밖으로 사라지지 않도록 경계 제한
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const elWidth = activeDragEl.offsetWidth || 300;

    const minX = -(elWidth - 80); // 최소 80px은 화면 왼쪽에 걸쳐 있도록 보장
    const maxX = Math.max(0, vw - 80); // 최소 80px은 화면 오른쪽에 보이도록 보장
    const minY = 48; // 상단 헤더(48px) 침범 방지
    const maxY = Math.max(minY, vh - 48); // 하단 밖으로 완전히 내려가지 않도록 보장

    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;
    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    activeDragEl.style.left = newX + 'px';
    activeDragEl.style.setProperty('top', newY + 'px', 'important');
}, { passive: false });

function endWidgetDrag() {
    activeDragEl = null;
}

document.addEventListener('pointerup', endWidgetDrag);
document.addEventListener('pointercancel', endWidgetDrag);
window.addEventListener('blur', endWidgetDrag);

// 🌟 브라우저 창 크기가 줄어들 때 열려 있는 위젯이 화면 밖으로 밀려나지 않도록 자동 보정
window.addEventListener('resize', function() {
    const widgets = document.querySelectorAll('.widget, .perf-widget, .edit-modal');
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    widgets.forEach(w => {
        if (!w.style.left || w.style.display === 'none') return;
        const rect = w.getBoundingClientRect();
        if (rect.left > vw - 60) {
            w.style.left = Math.max(0, vw - Math.min(rect.width, vw)) + 'px';
        }
        if (rect.top > vh - 48) {
            w.style.setProperty('top', Math.max(48, vh - 80) + 'px', 'important');
        }
    });
});

window.toggleDarkMode = function() {
    document.body.classList.toggle('light-mode');
};

window.closeWidgetGlobal = function(e, widgetId, chkId) {
    if (e) e.stopPropagation();
    const w = document.getElementById(widgetId);
    if (w) w.style.display = 'none';
    const chk = document.getElementById(chkId);
    if (chk) chk.checked = false;
    if (window.minimizedWidgets) window.minimizedWidgets.delete(widgetId);
    if (typeof window.renderTaskbar === 'function') window.renderTaskbar();
};

window.minimizeWidget = function(e, widgetId) {
    if (e) e.stopPropagation();
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    widget.style.display = 'none';
    if (window.minimizedWidgets) window.minimizedWidgets.add(widgetId);
    if (typeof window.renderTaskbar === 'function') window.renderTaskbar();
};

window.renderTaskbar = function() {
    const tb = document.getElementById('taskbar');
    if (!tb) return;
    tb.innerHTML = '';
    if (!window.minimizedWidgets || window.minimizedWidgets.size === 0) {
        tb.style.display = 'none';
        return;
    }
    tb.style.display = 'flex';
    const titles = {
        'perfWidget': '📊 실적 집계',
        'aiWidget': '🧭 내비게이터',
        'filterWidget': '🔎 검색'
    };
    window.minimizedWidgets.forEach(id => {
        if (!titles[id]) return;
        const btn = document.createElement('div');
        btn.className = 'taskbar-item';
        btn.innerHTML = `<span>${titles[id]}</span>`;
        btn.onclick = () => {
            const w = document.getElementById(id);
            if (w) {
                w.style.display = 'flex';
                window.minimizedWidgets.delete(id);
                window.renderTaskbar();
            }
        };
        tb.appendChild(btn);
    });
};