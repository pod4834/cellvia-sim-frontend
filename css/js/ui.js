// frontend/css/js/ui.js
// 🌟 위젯 드래그 및 UI 상태 제어 모듈 (데스크톱 & 모바일/태블릿 반응형·터치·화면이탈 방지 완성본)

let activeDragEl = null;
let activePointerId = null;
let dragStartX = 0, dragStartY = 0;
let initX = 0, initY = 0;

// 전역 변수 안전망 초기화 (스크립트 로드 순서 무관하게 에러 방지)
window.currentWidgetZ = window.currentWidgetZ || 100;
window.minimizedWidgets = window.minimizedWidgets || new Set();

// ============================================================================
// [1] 뷰포트 크기 및 반응형 헤더 높이 동적 계산 헬퍼
// ============================================================================
window.getResponsiveViewportInfo = function() {
    const vw = (window.visualViewport ? window.visualViewport.width : window.innerWidth) || document.documentElement.clientWidth || 360;
    const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) || document.documentElement.clientHeight || 640;

    // 모바일/태블릿에서 상단 헤더가 2줄로 줄바꿈될 때 실제 높이를 반영하여 침범 방지
    const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
    const headerH = headerEl ? Math.max(48, Math.round(headerEl.getBoundingClientRect().height)) : 48;

    return {
        vw,
        vh,
        headerH,
        isMobile: vw <= 768,
        isTablet: vw > 768 && vw <= 1024,
        isTouchViewport: vw <= 1024
    };
};

// ============================================================================
// [2] 포인터(마우스 & 터치) 기반 플로팅 위젯 드래그 제어
// ============================================================================
document.addEventListener('pointerdown', function(e) {
    // 마우스 우클릭 또는 멀티터치(두 번째 손가락 이상) 드래그 무시
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.isPrimary === false) return;

    const header = e.target.closest('.widget-header, .perf-header, .edit-modal-header');
    if (
        !header ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('button') ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'LABEL' ||
        e.target.tagName === 'A' ||
        e.target.closest('.icon-btn-mac')
    ) return;

    const candidateEl = header.closest('.widget, .perf-widget, .edit-modal, #bonusDetailModal, #memberEditModal');
    if (!candidateEl) return;

    // 🌟 [핵심 보호] 좌측 매출/구독 슬라이드 패널(#salesWidget)과 하단 실적/수당 독 패널(#perfWidget)은
    // 고정형 슬라이드/접기 구조이므로 자유 드래그 대상에서 제외 (모바일/데스크톱 레이아웃 붕괴 방지)
    if (
        candidateEl.id === 'salesWidget' ||
        candidateEl.id === 'perfWidget' ||
        candidateEl.classList.contains('perf-widget') ||
        candidateEl.getAttribute('data-minimized') === 'true'
    ) {
        return;
    }

    // 모바일(768px 이하)에서 전체 화면에 가깝게 꽉 차는 모달은 불필요한 드래그 흔들림 방지
    const { vw, vh, headerH, isMobile } = window.getResponsiveViewportInfo();
    const rect = candidateEl.getBoundingClientRect();
    if (isMobile && rect.width >= vw * 0.92) {
        return;
    }

    activeDragEl = candidateEl;
    activePointerId = e.pointerId;

    e.preventDefault();
    header.style.touchAction = 'none';

    // 레이어 최상단 전환 (main.js의 bringWidgetToFront와 호환)
    if (typeof window.bringWidgetToFront === 'function') {
        window.bringWidgetToFront(activeDragEl);
    } else {
        if (window.currentWidgetZ > 900) window.currentWidgetZ = 100;
        window.currentWidgetZ++;
        activeDragEl.style.zIndex = window.currentWidgetZ;
    }

    // 🌟 translate(-50%, -50%)로 중앙 정렬되어 있던 모달(#memberEditModal 등)의 드래그 점핑 원천 차단
    activeDragEl.style.setProperty('transform', 'none', 'important');
    activeDragEl.style.setProperty('transition', 'none', 'important');

    initX = rect.left;
    initY = rect.top < headerH ? headerH : rect.top;

    // 화면 폭을 초과하지 않도록 안전 너비 고정
    const clampedWidth = Math.min(rect.width, vw - 12);
    activeDragEl.style.width = clampedWidth + 'px';

    if (['matchingDetailBox', 'filterWidget', 'bonusDetailModal'].includes(activeDragEl.id)) {
        const clampedHeight = Math.min(rect.height, vh - headerH - 12);
        activeDragEl.style.height = clampedHeight + 'px';
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
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    e.preventDefault();

    let newX = initX + (e.clientX - dragStartX);
    let newY = initY + (e.clientY - dragStartY);

    const { vw, vh, headerH, isTouchViewport } = window.getResponsiveViewportInfo();
    const elWidth = activeDragEl.offsetWidth || 300;

    // 🌟 모바일/태블릿에서는 위젯이 화면 좌우 밖으로 잘리지 않도록 엄격히 클램핑,
    // 데스크톱에서는 최소 80px의 손잡이 영역이 화면 안에 남도록 허용
    let minX, maxX;
    if (isTouchViewport) {
        minX = 6;
        maxX = Math.max(6, vw - elWidth - 6);
    } else {
        minX = -(elWidth - 80);
        maxX = Math.max(0, vw - 80);
    }

    const minY = headerH;
    const maxY = Math.max(minY, vh - 48);

    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;
    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    activeDragEl.style.left = Math.round(newX) + 'px';
    activeDragEl.style.setProperty('top', Math.round(newY) + 'px', 'important');
}, { passive: false });

function endWidgetDrag(e) {
    if (!activeDragEl) return;
    if (e && activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;

    activeDragEl = null;
    activePointerId = null;
}

document.addEventListener('pointerup', endWidgetDrag);
document.addEventListener('pointercancel', endWidgetDrag);
window.addEventListener('blur', () => {
    activeDragEl = null;
    activePointerId = null;
});

// ============================================================================
// [3] 화면 리사이즈 & 모바일/태블릿 기기 회전(Orientation) 시 자동 위치/크기 보정
// ============================================================================
window.clampAllFloatingWidgetsToViewport = function() {
    const { vw, vh, headerH, isMobile, isTouchViewport } = window.getResponsiveViewportInfo();
    const widgets = document.querySelectorAll('.widget, .filter-widget, .edit-modal, #bonusDetailModal, #memberEditModal');

    widgets.forEach(w => {
        if (!w || w.id === 'salesWidget' || w.id === 'perfWidget') return;
        const comp = window.getComputedStyle(w);
        if (comp.display === 'none' || comp.visibility === 'hidden') return;
        if (w.getAttribute('data-minimized') === 'true') return;

        const rect = w.getBoundingClientRect();

        // 1) 모바일/태블릿에서 위젯 너비가 화면보다 넓으면 화면 폭에 맞게 축소
        if (rect.width > vw - 12) {
            w.style.width = Math.max(260, vw - 12) + 'px';
        }
        if (rect.height > vh - headerH - 12) {
            w.style.height = Math.max(220, vh - headerH - 12) + 'px';
        }

        // 2) 중앙 정렬(transform) 상태가 아닌 절대 좌표 위젯들의 화면 이탈 복귀
        if (w.style.left) {
            const updatedRect = w.getBoundingClientRect();
            let targetLeft = updatedRect.left;
            let targetTop = updatedRect.top;

            if (isMobile) {
                targetLeft = Math.max(6, Math.round((vw - updatedRect.width) / 2));
            } else if (isTouchViewport) {
                if (targetLeft + updatedRect.width > vw - 6) {
                    targetLeft = Math.max(6, vw - updatedRect.width - 6);
                }
                if (targetLeft < 6) targetLeft = 6;
            } else {
                if (targetLeft > vw - 60) {
                    targetLeft = Math.max(0, vw - Math.min(updatedRect.width, vw));
                }
                if (targetLeft + updatedRect.width < 60) {
                    targetLeft = 10;
                }
            }

            if (targetTop > vh - 48) {
                targetTop = Math.max(headerH, vh - 80);
            }
            if (targetTop < headerH) {
                targetTop = headerH;
            }

            w.style.left = Math.round(targetLeft) + 'px';
            w.style.setProperty('top', Math.round(targetTop) + 'px', 'important');
        }
    });
};

window.addEventListener('resize', window.clampAllFloatingWidgetsToViewport);
window.addEventListener('orientationchange', () => {
    setTimeout(window.clampAllFloatingWidgetsToViewport, 150);
    setTimeout(window.clampAllFloatingWidgetsToViewport, 350);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', window.clampAllFloatingWidgetsToViewport);
}

// ============================================================================
// [4] 테마 전환, 위젯 닫기/최소화 및 반응형 하단 태스크바 제어
// ============================================================================
window.toggleDarkMode = function() {
    document.body.classList.toggle('light-mode');
};

window.closeWidgetGlobal = function(e, widgetId, chkId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 매출 기간 검색 팝업 연동 호환
    if (widgetId === 'filterWidget' && typeof window.toggleSalesSearchPopup === 'function') {
        window.toggleSalesSearchPopup(false);
    }

    const w = document.getElementById(widgetId);
    if (w) w.style.setProperty('display', 'none', 'important');

    const chk = document.getElementById(chkId);
    if (chk) chk.checked = false;

    if (window.minimizedWidgets) window.minimizedWidgets.delete(widgetId);
    if (typeof window.renderTaskbar === 'function') window.renderTaskbar();
};

window.minimizeWidget = function(e, widgetId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    widget.style.setProperty('display', 'none', 'important');
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
    tb.style.flexWrap = 'wrap';
    tb.style.gap = '6px';
    tb.style.maxWidth = '94vw';

    const titles = {
        'perfWidget': '📊 실적 집계',
        'aiWidget': '🧭 내비게이터',
        'filterWidget': '🔎 검색'
    };

    window.minimizedWidgets.forEach(id => {
        if (!titles[id]) return;
        const btn = document.createElement('div');
        btn.className = 'taskbar-item';
        btn.style.touchAction = 'manipulation';
        btn.innerHTML = `<span>${titles[id]}</span>`;
        btn.onclick = () => {
            const w = document.getElementById(id);
            if (w) {
                w.style.display = 'flex';
                window.minimizedWidgets.delete(id);
                window.renderTaskbar();
                setTimeout(window.clampAllFloatingWidgetsToViewport, 30);
            }
        };
        tb.appendChild(btn);
    });
};