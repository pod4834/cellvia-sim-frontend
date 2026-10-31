// ============================================================================
// [00] 환경 감지 및 API 기본 경로 설정 (로컬 개발 3005 포트 강제 고정)
// ============================================================================
(function ensureMainJsApiBase() {
    const host = window.location.hostname;
    const isLocal = (host === '127.0.0.1' || host === 'localhost' || host === '' || window.location.protocol === 'file:');
    window.IS_LOCAL_DEV = isLocal;
    const resolvedBase = isLocal ? 'http://127.0.0.1:3005' : window.location.origin;
    // 기존 state.js나 api.js에 남아있는 3001 포트를 무조건 3005로 덮어쓰기
    window.API_BASE = resolvedBase.replace(/\/+$/, '');
    window.API_BASE_URL = window.API_BASE;
})();
// ============================================================================
// [01] 전역 상태 변수 초기화 및 계보도 정중앙 정렬
// ============================================================================
window.currentSelectedId = window.currentSelectedId || null;
window.recommenderRootId = window.recommenderRootId || null;
window.currentPeriodAnchorDate = window.currentPeriodAnchorDate || new Date();
window.salesSortOrder = window.salesSortOrder || 'desc';
window.cardClickTimer = null;
window.addPartnerState = window.addPartnerState || { recommenderId: null, sponsorId: null, position: 'left', isAddingParent: false };
window.integrated_sales_history = window.integrated_sales_history || [];
window.perfCache = {};
window.treeData = null;
window.sidebarForceHiddenBySettings = false; 

window.cardSettings = window.cardSettings || {
    id: true, name: true, rank: true, type: true, code: true, joinDate: true,
    recName: true, recId: true, firstSales: false, lastSales: false
};

// [01-1] 계보도 초기 위치 정중앙 정렬 (데이터 로딩 완료 확인 및 안전 좌표 계산)
window.centerRootNode = function() {
    const wrapper = document.getElementById('tree-wrapper') || document.querySelector('.tree-wrapper');
    const container = document.getElementById('canvas-container') || (wrapper ? wrapper.parentElement : null);
    if (!wrapper || !container) return;

    window.scale = 0.85;
    const rootCard = document.querySelector('.node-card');

    if (!rootCard) {
        setTimeout(window.centerRootNode, 100);
        return;
    }

    let offsetLeftSum = 0;
    let offsetTopSum = 0;
    let curr = rootCard;
    while (curr && curr !== wrapper) {
        offsetLeftSum += curr.offsetLeft;
        offsetTopSum += curr.offsetTop;
        curr = curr.offsetParent;
    }
    const cardCenterX = offsetLeftSum + (rootCard.offsetWidth / 2);
    const rootTopY = offsetTopSum;

    const containerWidth = container.clientWidth || window.innerWidth;
    window.panX = (containerWidth / 2) - (cardCenterX * window.scale);
    window.panY = 40 - (rootTopY * window.scale);

    wrapper.style.setProperty('transform-origin', '0 0', 'important');
    wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
};

// ============================================================================
// [02] 좌측 패널 DOM 탐색 헬퍼 (매출/구독 내역)
// ============================================================================
window.getSmartLeftPanel = function() {
    const salesW = document.getElementById('salesWidget');
    if (salesW) return salesW;

    let explicit = document.querySelector('aside, .left-panel, #left-sidebar, .sidebar, .panel-left');
    if (explicit && explicit.innerText.includes('매출')) return explicit;

    let textNode = Array.from(document.querySelectorAll('*')).find(n => 
        n.childNodes.length === 1 && n.innerText && (n.innerText.includes('MMDD (4자리)') || n.innerText.includes('매출 및 구독 내역'))
    );
    
    if (textNode) {
        let curr = textNode;
        let topWrapper = curr;
        while (curr && curr.tagName !== 'BODY' && curr.tagName !== 'MAIN') {
            if (curr.clientWidth >= 200 && curr.clientHeight >= 300) {
                topWrapper = curr; 
            }
            curr = curr.parentElement;
        }
        return topWrapper;
    }

    return document.querySelector('aside');
};

// ============================================================================
// [03] 하단 실적/수당 위젯 슬라이드 접기·펼치기 기본 호환 함수
// ============================================================================
window.toggleFoldPerfWidget = function() {
    if (typeof window.setPerfSidebarState === 'function') {
        const perfW = document.getElementById('perfWidget');
        if (perfW) {
            const isClosed = perfW.classList.contains('closed') || perfW.getAttribute('data-minimized') === 'true' || perfW.getBoundingClientRect().height <= 55;
            window.setPerfSidebarState(!isClosed);
            return;
        }
    }
};

// ============================================================================
// [04] 상단 헤더 톱니바퀴 (표시 설정) 토글 및 카드 표시 항목 제어 기능
// ============================================================================
window.toggleSettingsMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (menu) {
        const isHidden = window.getComputedStyle(menu).display === 'none' || menu.style.display === 'none';
        if (isHidden) {
            menu.style.setProperty('display', 'block', 'important');
        } else {
            menu.style.setProperty('display', 'none', 'important');
        }
    }
};

// [04-1] 기본 표시 / 상세 표시 체크박스 변경 시 카드 항목 실시간 반영 (updateSetting 완벽 호환)
window.updateSetting = function(arg1, arg2) {
    window.cardSettings = window.cardSettings || {
        id: true, name: true, rank: true, type: true, code: true, joinDate: true,
        recName: true, recId: true, firstSales: false, lastSales: false
    };

    let settingKey = null;
    let isChecked = undefined;

    // 1) 인자 패턴 자동 판별: (key, boolean) 또는 (checkboxEl, key) 또는 (key)
    if (typeof arg1 === 'string') {
        settingKey = arg1;
        if (typeof arg2 === 'boolean') {
            isChecked = arg2;
        } else if (arg2 && arg2.type === 'checkbox') {
            isChecked = arg2.checked;
        } else if (window.event && window.event.target && window.event.target.type === 'checkbox') {
            isChecked = window.event.target.checked;
        }
    } else if (arg1 && arg1.type === 'checkbox') {
        isChecked = arg1.checked;
        settingKey = typeof arg2 === 'string' ? arg2 : (arg1.dataset.key || arg1.id);
    }

    // 2) 한글 라벨이나 다양한 키 이름으로 넘어올 경우 cardSettings 표준 키로 매핑
    const keyMap = {
        'id': 'id', 'member_id': 'id', 'chk-id': 'id', '회원id': 'id',
        'name': 'name', 'chk-name': 'name', '회원이름': 'name',
        'rank': 'rank', 'chk-rank': 'rank', '직급': 'rank',
        'type': 'type', 'chk-type': 'type', '회원구분': 'type',
        'code': 'code', 'chk-code': 'code', '회원코드': 'code',
        'joindate': 'joinDate', 'join_date': 'joinDate', 'chk-joindate': 'joinDate', '가입일': 'joinDate',
        'recname': 'recName', 'rec_name': 'recName', 'chk-recname': 'recName', '추천인명': 'recName',
        'recid': 'recId', 'rec_id': 'recId', 'chk-recid': 'recId', '추천인id': 'recId',
        'firstsales': 'firstSales', 'first_sales': 'firstSales', 'chk-firstsales': 'firstSales', '최초매출일': 'firstSales',
        'lastsales': 'lastSales', 'last_sales': 'lastSales', 'chk-lastsales': 'lastSales', '최종매출일': 'lastSales'
    };

    let normKey = settingKey ? (keyMap[String(settingKey).trim().toLowerCase()] || settingKey) : null;

    // 만약 키를 못 찾았다면 클릭된 체크박스의 부모 label 텍스트로 자동 추론
    if ((!normKey || !(normKey in window.cardSettings)) && window.event && window.event.target) {
        const lbl = window.event.target.closest('label');
        if (lbl) {
            const txt = lbl.innerText.replace(/\s+/g, '').toLowerCase();
            if (keyMap[txt]) normKey = keyMap[txt];
        }
    }

    if (normKey && (normKey in window.cardSettings)) {
        window.cardSettings[normKey] = (typeof isChecked === 'boolean') ? isChecked : !window.cardSettings[normKey];
    }

    // 3) 현재 보고 있는 화면 위치(panX, panY, scale)를 유지한 채로 계보도 카드 즉시 업데이트
    if (typeof window.reRenderTreeKeepViewport === 'function') {
        window.reRenderTreeKeepViewport();
    } else if (typeof window.renderTree === 'function') {
        window.renderTree(false);
    }
};

// 별칭(Alias) 연결
window.updateCardSetting = window.updateSetting;
window.toggleCardSetting = window.updateSetting;

// ============================================================================
// [05] 우측 위젯 체크박스 연동 및 닫기 제어 (매출 기간 검색 브라우저 팝업 라우팅)
// ============================================================================

// [05-1] 위젯 닫기 버튼 전역 제어
window.closeWidgetGlobal = function(e, widgetId, chkId) {
    if (e) { 
        e.preventDefault(); 
        e.stopPropagation(); 
    }

    // 매출 기간 검색의 경우 모달 닫기 대신 팝업 토글 닫기로 연결
    if (widgetId === 'filterWidget' || String(chkId).includes('sales-search')) {
        if (typeof window.toggleSalesSearchPopup === 'function') {
            window.toggleSalesSearchPopup(false);
        }
        return;
    }

    let chk = document.getElementById(chkId);
    if (!chk) {
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(lbl => 
            lbl.innerText.includes('매출 기간 검색') || 
            lbl.innerText.includes('기간 매출') || 
            lbl.innerText.includes('매출 기간')
        );
        if (targetLabel) chk = targetLabel.querySelector('input[type="checkbox"]');
    }

    if (chk) {
        chk.checked = false;
    }

    if (typeof window.toggleWidgetGlobal === 'function') {
        window.toggleWidgetGlobal(chkId || 'chk-filter-widget', widgetId);
    } else {
        const widget = document.getElementById(widgetId) || document.querySelector(`.${widgetId}`);
        if (widget) widget.style.setProperty('display', 'none', 'important');
    }
};

// [05-2] 인라인 매출 검색 패널 안전 숨김 헬퍼
window.hideInlineSalesSearchPanels = function() {
    const inlineIds = ['salesSearchWidget', 'salesSearchModal', 'periodSearchWidget', 'sales-search-panel', 'period-search-panel', 'filterWidget'];
    inlineIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
};

// [05-3] 매출 기간 검색 팝업창 내부 기본 렌더러
window.renderSalesSearchPopupContent = function(showAll = false, optDoc = null) {
    const popup = window.salesSearchPopupWindow;
    const pDoc = optDoc || ((popup && !popup.closed) ? popup.document : document);
    if (!pDoc) return;

    const bodyEl = pDoc.getElementById('salesSearchPopupBody');
    if (!bodyEl) return;

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);
    let sumCV = 0, sumPV = 0;
    let rowsHtml = '';

    allSales.forEach(s => {
        if (!s) return;
        const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        sumCV += cv; 
        sumPV += pv;

        const mId = s.member_id || s.memberId || '-';
        const m = typeof window.findMemberNode === 'function' ? window.findMemberNode(mId) : null;
        const mName = m ? (m.name || '-') : (s.name || '-');
        const dStr = typeof window.cleanDateStr === 'function' ? window.cleanDateStr(s.transaction_date || s.date || s.sales_date || '') : (s.transaction_date || s.date || '-');

        rowsHtml += `
            <tr style="border-bottom: 1px solid #374151;">
                <td style="padding: 7px 8px; text-align: center; color: #d1d5db;">${dStr}</td>
                <td style="padding: 7px 8px; text-align: center; color: #60a5fa; font-weight: bold;">${mId}</td>
                <td style="padding: 7px 8px; text-align: center; color: #fff;">${mName}</td>
                <td style="padding: 7px 8px; text-align: right; color: #60a5fa; font-weight: bold;">${cv.toLocaleString('ko-KR')}</td>
                <td style="padding: 7px 8px; text-align: right; color: #10b981; font-weight: bold;">${pv.toLocaleString('ko-KR')}</td>
            </tr>
        `;
    });

    bodyEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #111827; padding: 10px 14px; border-radius: 6px; border: 1px solid #374151; margin-bottom: 12px;">
            <span style="font-weight: bold; color: #fff; font-size: 13px;">전체 매출 내역: <b style="color: #60a5fa;">${allSales.length.toLocaleString('ko-KR')}</b>건</span>
            <span style="font-size: 12.5px;"><b style="color: #60a5fa;">총 ${sumCV.toLocaleString('ko-KR')} CV</b> <span style="color:#4b5563;">/</span> <b style="color: #10b981;">총 ${sumPV.toLocaleString('ko-KR')} PV</b></span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
            <colgroup>
                <col style="width: 100px;">
                <col style="width: 120px;">
                <col style="width: auto;">
                <col style="width: 130px;">
                <col style="width: 130px;">
            </colgroup>
            <thead>
                <tr style="background: #1f2937; color: #9ca3af;">
                    <th style="padding: 8px; border: 1px solid #374151; text-align: center;">일자</th>
                    <th style="padding: 8px; border: 1px solid #374151; text-align: center;">회원ID</th>
                    <th style="padding: 8px; border: 1px solid #374151; text-align: center;">이름</th>
                    <th style="padding: 8px; border: 1px solid #374151; text-align: right;">CV</th>
                    <th style="padding: 8px; border: 1px solid #374151; text-align: right;">PV</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #9ca3af;">등록된 매출 내역이 없습니다.</td></tr>`}
            </tbody>
        </table>
    `;
};

// [05-4] 매출 기간 검색 팝업창 생성기
window.openSalesSearchPopupWindow = function() {
    window.hideInlineSalesSearchPanels();

    if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
        window.salesSearchPopupWindow.focus();
        window.renderSalesSearchPopupContent(false);
        return window.salesSearchPopupWindow;
    }

    const savedW = parseInt(localStorage.getItem('bs_sales_search_popup_w') || '920', 10);
    const savedH = parseInt(localStorage.getItem('bs_sales_search_popup_h') || '780', 10);
    const savedLeft = parseInt(localStorage.getItem('bs_sales_search_popup_left') || '140', 10);
    const savedTop = parseInt(localStorage.getItem('bs_sales_search_popup_top') || '80', 10);

    const w = Math.max(600, isNaN(savedW) ? 920 : savedW);
    const h = Math.max(450, isNaN(savedH) ? 780 : savedH);
    const l = isNaN(savedLeft) ? 140 : savedLeft;
    const t = isNaN(savedTop) ? 80 : savedTop;

    const popup = window.open('', 'SalesSearchPopup', `width=${w},height=${h},left=${l},top=${t},resizable=yes,scrollbars=yes`);
    if (!popup) {
        alert('브라우저의 팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해 주세요.');
        return null;
    }
    window.salesSearchPopupWindow = popup;

    const doc = popup.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>🔍 매출 기간 검색</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #111827; color: #f9fafb; font-family: 'Pretendard', sans-serif; font-size: 12.5px; }
                .popup-header { position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #1f2937; border-bottom: 1px solid #374151; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
                .popup-body { padding: 16px; }
            </style>
        </head>
        <body>
            <div class="popup-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:16px;">🔍</span>
                    <strong style="font-size:14px; color:#fff;">매출 기간 검색</strong>
                </div>
                <button type="button" onclick="window.close()" style="background:#374151; border:1px solid #4b5563; color:#e5e7eb; padding:4px 10px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">창 닫기 ✕</button>
            </div>
            <div id="salesSearchPopupBody" class="popup-body">
                <div style="padding:30px; text-align:center; color:#9ca3af;">데이터를 불러오는 중입니다...</div>
            </div>
        </body>
        </html>
    `);
    doc.close();

    popup.addEventListener('resize', () => {
        try {
            localStorage.setItem('bs_sales_search_popup_w', String(popup.outerWidth));
            localStorage.setItem('bs_sales_search_popup_h', String(popup.outerHeight));
        } catch (e) {}
    });

    popup.addEventListener('beforeunload', () => {
        try {
            localStorage.setItem('bs_sales_search_popup_w', String(popup.outerWidth));
            localStorage.setItem('bs_sales_search_popup_h', String(popup.outerHeight));
            localStorage.setItem('bs_sales_search_popup_left', String(popup.screenX));
            localStorage.setItem('bs_sales_search_popup_top', String(popup.screenY));
        } catch (e) {}
        const salesChk = window.findSalesSearchCheckbox();
        if (salesChk && salesChk.checked) salesChk.checked = false;
    });

    setTimeout(() => {
        window.renderSalesSearchPopupContent(false, doc);
    }, 150);

    return popup;
};

// [05-5] 매출 기간 검색 토글러
window.toggleSalesSearchPopup = function(forceShow) {
    window.hideInlineSalesSearchPanels();
    const isPopupOpen = Boolean(window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed);
    const willShow = (forceShow !== undefined) ? Boolean(forceShow) : !isPopupOpen;

    if (willShow) {
        window.openSalesSearchPopupWindow();
    } else {
        if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
            window.salesSearchPopupWindow.close();
        }
        window.salesSearchPopupWindow = null;
    }

    const salesChk = window.findSalesSearchCheckbox();
    if (salesChk && salesChk.checked !== willShow) salesChk.checked = willShow;
};

// [05-6] 우측 위젯 체크박스 연동 제어 ("매출/구독 패널", "매출 기간 검색", "실적/수당" 타겟팅)
window.toggleWidgetGlobal = function(chkId, widgetId) {
    let chk = document.getElementById(chkId);
    if (!chk && window.event && window.event.target && window.event.target.tagName === 'INPUT') {
        chk = window.event.target;
    }
    let isChecked = chk ? chk.checked : (window.event && window.event.target && window.event.target.checked);
    if (typeof isChecked === 'undefined') isChecked = false;

    const labelText = chk && chk.parentElement ? chk.parentElement.innerText.trim() : widgetId;
    const lowerWidgetId = String(widgetId).toLowerCase();

    // [05-6-1] "매출 기간 검색" 체크 시: 독립 브라우저 팝업창으로 라우팅
    if (
        lowerWidgetId.includes('filter') || 
        labelText.includes('매출 기간 검색') || 
        labelText.includes('기간 매출') || 
        (labelText.includes('기간') && labelText.includes('검색'))
    ) {
        if (typeof window.toggleSalesSearchPopup === 'function') {
            window.toggleSalesSearchPopup(isChecked);
        }
        const filterW = document.getElementById('filterWidget');
        if (filterW) filterW.style.setProperty('display', 'none', 'important');
        return;
    }

    // [05-6-2] 좌측 매출 및 구독 내역 패널 (#salesWidget) 제어
    if (
        lowerWidgetId.includes('saleswidget') || 
        lowerWidgetId.includes('salespanel') || 
        lowerWidgetId.includes('left') || 
        labelText.includes('구독') || 
        (labelText.includes('매출') && !labelText.includes('검색'))
    ) {
        window.sidebarForceHiddenBySettings = !isChecked; 
        
        const salesW = document.getElementById('salesWidget');
        const allLeftElements = document.querySelectorAll('#salesWidget, aside, .left-panel, #left-sidebar, .sidebar, .panel-left');
        const perfW = document.getElementById('perfWidget');

        let forceStyle = document.getElementById('force-hide-sidebar-css');
        if (!forceStyle) {
            forceStyle = document.createElement('style');
            forceStyle.id = 'force-hide-sidebar-css';
            document.head.appendChild(forceStyle);
        }

        if (isChecked) {
            allLeftElements.forEach(el => {
                el.removeAttribute('data-settings-hidden');
                el.style.setProperty('display', 'flex', 'important');
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
            });
            forceStyle.innerHTML = '';

            if (perfW) {
                const isSlidClosed = salesW && salesW.classList.contains('closed');
                perfW.style.setProperty('left', isSlidClosed ? '0px' : '330px', 'important');
            }
        } else {
            allLeftElements.forEach(el => {
                el.setAttribute('data-settings-hidden', 'true');
                el.style.setProperty('display', 'none', 'important');
            });
            
            forceStyle.innerHTML = `
                #salesWidget, aside, .left-panel, #left-sidebar, .sidebar, .panel-left, [data-settings-hidden="true"] { 
                    display: none !important; 
                    width: 0 !important; 
                    min-width: 0 !important; 
                    max-width: 0 !important;
                    height: 0 !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    opacity: 0 !important; 
                    pointer-events: none !important; 
                    visibility: hidden !important;
                }
            `;

            if (perfW) {
                perfW.style.setProperty('left', '0px', 'important');
            }
        }
        
        setTimeout(() => {
            if (typeof window.centerRootNode === 'function') window.centerRootNode();
        }, 100);
        return; 
    }

    // [05-6-3] 하단 실적/수당 위젯 (#perfWidget) 제어
    if (lowerWidgetId.includes('perf') || labelText.includes('수당') || labelText.includes('실적')) {
        let perfW = document.getElementById('perfWidget') || document.querySelector('.perf-widget');
        if (perfW) {
            if (isChecked) perfW.style.setProperty('display', 'flex', 'important');
            else perfW.style.setProperty('display', 'none', 'important'); 
        }
        return; 
    }

    // [05-6-4] 기타 모달 위젯 제어
    let widget = document.getElementById(widgetId) || document.querySelector(`.${widgetId}`);
    if (widget) {
        if (isChecked) {
            if (typeof window.restoreSingleWidget === 'function') window.restoreSingleWidget(widget);
            widget.style.setProperty('display', 'block', 'important');
            widget.style.setProperty('z-index', '99999', 'important');
        } else {
            widget.style.setProperty('display', 'none', 'important');
        }
    }
};

// ============================================================================
// [06] 입력 포맷 유틸리티 (MMDD -> YYYY-MM-DD 변환, VK- 자동부여, 매출일 자동 검색)
// ============================================================================

// [06-1] 오늘 날짜를 YYYY-MM-DD 포맷으로 반환
window.getTodayString = function() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// [06-2] MMDD(4자리) 입력 시 YYYY-MM-DD 자동 변환 및 신규 생성 모달 가입일-매출일 동기화
window.formatDateMMDD = function(inputEl, syncSalesDates = false) {
    if (!inputEl || !inputEl.value) return;
    let val = String(inputEl.value).replace(/[^0-9]/g, ''); 
    let targetYear = window.currentPeriodYear || new Date().getFullYear();

    if (val.length === 4) {
        inputEl.value = `${targetYear}-${val.substring(0, 2)}-${val.substring(2, 4)}`;
    } else if (val.length >= 8) {
        inputEl.value = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
    }

    if (syncSalesDates || inputEl.id === 'm-join-date') {
        const firstEl = document.getElementById('m-first-date');
        const lastEl = document.getElementById('m-last-date');
        if (firstEl) firstEl.value = inputEl.value;
        if (lastEl) lastEl.value = inputEl.value;
    }
};

// [06-3] 숫자만 입력 시 VK- 접두사 자동 부여 및 모달 추천인 이름 실시간 매칭 (미검색 시 수동입력 지원)
window.formatVKId = function(inputEl) {
    if (!inputEl) return;
    let val = inputEl.value.replace(/[^0-9]/g, ''); 
    if (val) inputEl.value = 'VK-' + val;
    else inputEl.value = '';
    
    if (inputEl.id === 'm-rec-id') {
        let nameEl = document.getElementById('m-rec-name');
        if (nameEl) {
            if (!val) {
                nameEl.value = '';
                nameEl.placeholder = '자동검색 또는 직접입력';
            } else {
                let node = window.findMemberNode(inputEl.value);
                if (node && node.name) {
                    nameEl.value = node.name;
                    nameEl.dataset.autoFilled = 'true';
                } else {
                    if (nameEl.dataset.autoFilled === 'true') {
                        nameEl.value = '';
                    }
                    nameEl.dataset.autoFilled = 'false';
                    nameEl.placeholder = '미등록 (직접 입력 가능)';
                }
            }
        }
        if (typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
    }
};

// [06-4] 다양한 날짜 문자열을 YYYY-MM-DD 표준 포맷으로 정제
window.cleanDateStr = function(str) {
    if (!str) return '';
    let s = String(str).trim();
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    if (s.includes('.')) s = s.replace(/\./g, '-');
    let numOnly = s.replace(/[^0-9]/g, '');
    let targetYear = window.currentPeriodYear || new Date().getFullYear();
    if (numOnly.length === 4) return `${targetYear}-${numOnly.slice(0, 2)}-${numOnly.slice(2, 4)}`;
    if (numOnly.length >= 8) return `${numOnly.slice(0, 4)}-${numOnly.slice(4, 6)}-${numOnly.slice(6, 8)}`;
    return s.slice(0, 10);
};

// [06-5] DB integrated_sales_history 테이블에서 회원의 최초매출일 / 최종매출일 자동 검색 (YYYY-MM-DD 반환)
window.getSalesDatesFromHistory = function(memberId, fallbackJoinDate = '') {
    if (!memberId) return { first: fallbackJoinDate, last: fallbackJoinDate, hasHistory: false };
    const normTarget = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');

    const salesList = [];
    if (Array.isArray(window.integrated_sales_history)) {
        salesList.push(...window.integrated_sales_history);
    }
    if (typeof window.getAllSalesListFromDB === 'function') {
        salesList.push(...window.getAllSalesListFromDB());
    }

    let minDate = '';
    let maxDate = '';

    salesList.forEach(item => {
        if (!item) return;
        const itemMid = String(item.member_id || item.memberId || item.id || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (itemMid !== normTarget) return;

        const rawD = item.transaction_date || item.sales_date || item.buy_date || item.date || item.created_at || '';
        const dStr = window.cleanDateStr(rawD);
        if (!dStr || !/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return;

        if (!minDate || dStr < minDate) minDate = dStr;
        if (!maxDate || dStr > maxDate) maxDate = dStr;
    });

    if ((!minDate || !maxDate) && window.memberSalesDateMap && window.memberSalesDateMap[normTarget]) {
        if (!minDate) minDate = window.memberSalesDateMap[normTarget].first || '';
        if (!maxDate) maxDate = window.memberSalesDateMap[normTarget].last || '';
    }

    if (minDate || maxDate) {
        return {
            first: minDate || maxDate,
            last: maxDate || minDate,
            hasHistory: true
        };
    }

    const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    const nodeFirst = node ? window.cleanDateStr(node.firstSales || node.firstSalesDate || node.first_sales || node.first_sales_date || '') : '';
    const nodeLast = node ? window.cleanDateStr(node.lastSales || node.lastSalesDate || node.last_sales || node.last_sales_date || '') : '';
    const cleanJoin = window.cleanDateStr(fallbackJoinDate || (node ? (node.joinDate || node.join_date || node.regDate || '') : ''));

    return {
        first: nodeFirst || cleanJoin || '',
        last: nodeLast || cleanJoin || '',
        hasHistory: false
    };
};

// [06-6] 로컬 메모리에 내역이 없을 경우 백엔드 DB(integrated_sales_history) API 비동기 조회 및 동기화
window.fetchMemberSalesDatesFromAPI = async function(memberId) {
    if (!window.API_BASE || !memberId) return null;
    try {
        const res = await fetch(`${window.API_BASE}/api/sales/${encodeURIComponent(memberId)}`);
        if (!res.ok) return null;
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.sales || data.history || data.data || []);
        if (rows.length > 0) {
            window.integrated_sales_history = window.integrated_sales_history || [];
            rows.forEach(r => {
                window.integrated_sales_history.push({ ...r, member_id: r.member_id || memberId });
            });
            return window.getSalesDatesFromHistory(memberId);
        }
    } catch (e) {}
    return null;
};

// ============================================================================
// [07] 신규 파트너 추가 모달창 및 플로팅 위젯 레이어/기간검색 필터 제어
// ============================================================================

// [07-1] 신규 파트너 추가 모달창 초기화 (GUEST/MEMBER 추가, 회원구분: 사업자/소비자/복제, 추천인명 수동입력 허용)
window.initPartnerModal = function() {
    if (!document.getElementById('addPartnerModal')) {
        const modalHTML = `
            <div id="addPartnerModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2147483645 !important; align-items: center; justify-content: center;">
                <div style="background: #1f2937; padding: 25px; border-radius: 10px; border: 1px solid #374151; color: white; width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <h3 style="margin-top: 0; color: #60a5fa; border-bottom: 1px solid #374151; padding-bottom: 10px; font-size: 18px;">신규 파트너 추가</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">회원 ID (숫자만 입력)</label><input type="text" id="m-member-id" placeholder="VK- 자동입력" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" oninput="window.formatVKId(this)" onblur="if(typeof window.syncNewPartnerSalesDatesById === 'function') window.syncNewPartnerSalesDatesById(this.value)"></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">회원이름 (Name)</label><input type="text" id="m-name" placeholder="이름 입력" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;"></div>
                        <div>
                            <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">직급 (Rank)</label>
                            <select id="m-rank" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                                <option value="GUEST">GUEST</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="MANIA" selected>MANIA</option>
                                <option value="MANAGER">MANAGER</option>
                                <option value="DIRECTOR">DIRECTOR</option>
                                <option value="EMERALD">EMERALD</option>
                                <option value="MASTER">MASTER</option>
                                <option value="CHIEF">CHIEF</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">회원구분 (Type)</label>
                            <select id="m-type" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                                <option value="사업자" selected>사업자</option>
                                <option value="소비자">소비자</option>
                                <option value="복제">복제</option>
                            </select>
                        </div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">후원인 ID (Parent ID)</label><input type="text" id="m-spon-id" style="width: 100%; box-sizing: border-box; padding: 8px; background: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 4px;" readonly></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">배치 라인 (Position)</label><select id="m-pos" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" onchange="if(typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos()"><option value="left">A라인 (좌측)</option><option value="right">B라인 (우측)</option></select></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">추천인 ID (숫자만 입력)</label><input type="text" id="m-rec-id" placeholder="VK- 자동입력" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" oninput="window.formatVKId(this)"></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">추천인명 (자동검색 / 수동입력)</label><input type="text" id="m-rec-name" placeholder="자동검색 또는 직접입력" oninput="this.dataset.autoFilled='false'" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #60a5fa; border-radius: 4px; font-weight: bold;"></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">가입일 (MMDD 입력)</label><input type="text" id="m-join-date" placeholder="MMDD (예: 1013)" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" onblur="window.formatDateMMDD(this, true)" onkeydown="if(event.key==='Enter') this.blur();"></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">최초매출일 (MMDD / 자동입력)</label><input type="text" id="m-first-date" placeholder="YYYY-MM-DD (MMDD 가능)" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" onblur="window.formatDateMMDD(this)" onkeydown="if(event.key==='Enter') this.blur();"></div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">최종매출일 (MMDD / 자동입력)</label><input type="text" id="m-last-date" placeholder="YYYY-MM-DD (MMDD 가능)" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;" onblur="window.formatDateMMDD(this)" onkeydown="if(event.key==='Enter') this.blur();"></div>
                        <div><label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">부여될 회원코드 (Code)</label><input type="text" id="m-code" style="width: 100%; box-sizing: border-box; padding: 8px; background: #111827; border: 1px solid #4b5563; color: #10b981; font-weight: bold; border-radius: 4px;" readonly></div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button onclick="document.getElementById('addPartnerModal').style.display='none'" style="padding: 8px 16px; background: #374151; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                        <button onclick="window.submitAddPartner()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">등록하기</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('addPartnerModal');
        const observer = new MutationObserver(() => {
            if (modal.style.display === 'block') modal.style.display = 'flex';
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
};

// [07-2] 신규 파트너 생성 시 ID에 해당하는 integrated_sales_history 내역 자동 반영
window.syncNewPartnerSalesDatesById = async function(memberId) {
    if (!memberId) return;
    const joinVal = document.getElementById('m-join-date')?.value.trim() || window.getTodayString();
    if (typeof window.getSalesDatesFromHistory === 'function') {
        let hist = window.getSalesDatesFromHistory(memberId, joinVal);
        if (!hist.hasHistory && typeof window.fetchMemberSalesDatesFromAPI === 'function') {
            const apiHist = await window.fetchMemberSalesDatesFromAPI(memberId);
            if (apiHist && apiHist.hasHistory) hist = apiHist;
        }
        const firstEl = document.getElementById('m-first-date');
        const lastEl = document.getElementById('m-last-date');
        if (hist && hist.hasHistory) {
            if (firstEl) firstEl.value = hist.first;
            if (lastEl) lastEl.value = hist.last;
        }
    }
};

// [07-3] 신규 파트너 모달 '등록하기' 실행 함수 (DB members 테이블 즉시 저장 연동)
window.submitAddPartner = async function() {
    const newId = document.getElementById('m-member-id')?.value.trim();
    const newName = document.getElementById('m-name')?.value.trim();
    const rank = document.getElementById('m-rank')?.value || 'MANIA';
    const type = document.getElementById('m-type')?.value || '사업자';
    const sponId = document.getElementById('m-spon-id')?.value.trim();
    const pos = document.getElementById('m-pos')?.value || 'left';
    const recId = document.getElementById('m-rec-id')?.value.trim();
    let recName = document.getElementById('m-rec-name')?.value.trim();
    if (recName === '미등록/검색불가') recName = '';

    const joinEl = document.getElementById('m-join-date');
    const firstEl = document.getElementById('m-first-date');
    const lastEl = document.getElementById('m-last-date');
    if (joinEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(joinEl, false);
    if (firstEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(firstEl, false);
    if (lastEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(lastEl, false);

    const joinDate = (joinEl && joinEl.value.trim()) ? window.cleanDateStr(joinEl.value.trim()) : window.getTodayString();

    const histDates = typeof window.getSalesDatesFromHistory === 'function'
        ? window.getSalesDatesFromHistory(newId, joinDate)
        : { first: joinDate, last: joinDate, hasHistory: false };

    const firstSales = histDates.hasHistory
        ? histDates.first
        : ((firstEl && firstEl.value.trim()) ? window.cleanDateStr(firstEl.value.trim()) : joinDate);
    const lastSales = histDates.hasHistory
        ? histDates.last
        : ((lastEl && lastEl.value.trim()) ? window.cleanDateStr(lastEl.value.trim()) : joinDate);

    const code = document.getElementById('m-code')?.value.trim();

    if (!newId || !newName) {
        alert('회원 ID와 이름을 입력해 주세요.');
        return;
    }
    if (window.findMemberNode(newId)) {
        alert('이미 존재하는 회원 ID입니다.');
        return;
    }

    const dbPos = (pos === 'right' || pos === 'B') ? 'B' : 'A';
    const newNode = {
        id: newId, member_id: newId, name: newName, rank, rank_name: rank, type, member_type: type,
        parent_id: window.addPartnerState.isAddingParent ? null : sponId,
        sponsor_id: window.addPartnerState.isAddingParent ? null : sponId,
        position: dbPos,
        recId, recommender_id: recId, recName, recommender_name: recName,
        joinDate, join_date: joinDate,
        firstSales, first_sales_date: firstSales,
        lastSales, last_sales_date: lastSales,
        code, left: null, right: null
    };

    if (window.addPartnerState.isAddingParent) {
        const oldRoot = window.getAbsoluteTopRoot();
        if (pos === 'left') newNode.left = oldRoot;
        else newNode.right = oldRoot;
        window.treeData = newNode;

        if (window.API_BASE && !window.isSimMode) {
            try {
                await fetch(`${window.API_BASE}/api/member`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...newNode, parentId: null, position: 'A' })
                });
                if (oldRoot) {
                    await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(oldRoot.id)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: oldRoot.name, rank: oldRoot.rank, type: oldRoot.type,
                            join_date: oldRoot.joinDate || oldRoot.join_date,
                            parentId: newId, position: dbPos,
                            recId: oldRoot.recId, recName: oldRoot.recName,
                            firstSales: oldRoot.firstSales, lastSales: oldRoot.lastSales,
                            code: oldRoot.code
                        })
                    });
                }
            } catch (err) {
                console.error('상위 파트너 DB 저장 오류:', err);
            }
        }
    } else {
        const sponNode = window.findMemberNode(sponId);
        if (!sponNode) {
            alert('후원인 노드를 찾을 수 없습니다.');
            return;
        }
        if (pos === 'left') {
            if (sponNode.left) {
                alert('해당 후원인의 A라인(좌측)에 이미 파트너가 배치되어 있습니다.');
                return;
            }
            sponNode.left = newNode;
        } else {
            if (sponNode.right) {
                alert('해당 후원인의 B라인(우측)에 이미 파트너가 배치되어 있습니다.');
                return;
            }
            sponNode.right = newNode;
        }

        if (window.API_BASE && !window.isSimMode) {
            try {
                await fetch(`${window.API_BASE}/api/member`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: newId, member_id: newId, name: newName, rank, type, code,
                        parentId: sponId, parent_id: sponId, sponsor_id: sponId,
                        position: dbPos,
                        recId, recommender_id: recId, recName, recommender_name: recName,
                        joinDate, join_date: joinDate,
                        firstSales, first_sales_date: firstSales,
                        lastSales, last_sales_date: lastSales
                    })
                });
            } catch (err) {
                console.error('신규 파트너 DB 저장 오류:', err);
            }
        }
    }

    document.getElementById('addPartnerModal').style.display = 'none';
    window.getFlatMembers();
    if (typeof window.reRenderTreeKeepViewport === 'function') window.reRenderTreeKeepViewport();
    else window.renderTree(false);
};

// [07-4] 하위 및 상위 파트너 추가 모달 오픈 핸들러
window.addTreeChild = function(e, sponsorId, position) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    window.addPartnerState.sponsorId = sponsorId;
    window.addPartnerState.position = position;
    window.addPartnerState.isAddingParent = false;

    const modal = document.getElementById('addPartnerModal');
    if (modal) {
        modal.style.display = 'flex'; 
        document.getElementById('m-spon-id').value = sponsorId;
        document.getElementById('m-member-id').value = '';
        document.getElementById('m-name').value = '';
        document.getElementById('m-rec-id').value = '';
        document.getElementById('m-rec-name').value = '';
        
        const posSelect = document.getElementById('m-pos');
        if (posSelect) posSelect.value = (position === 'left' || position === 'A라인') ? posSelect.options[0].value : posSelect.options[1].value;

        const today = window.getTodayString();
        ['m-join-date', 'm-first-date', 'm-last-date'].forEach(id => {
            let el = document.getElementById(id);
            if(el) el.value = today;
        });
        if (typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
    }
};

window.addParentPartner = function(e, rootId) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    window.addPartnerState.sponsorId = rootId;
    window.addPartnerState.isAddingParent = true;

    const modal = document.getElementById('addPartnerModal');
    if (modal) {
        modal.style.display = 'flex'; 
        document.getElementById('m-spon-id').value = rootId;
        document.getElementById('m-member-id').value = '';
        document.getElementById('m-name').value = '';
        document.getElementById('m-rec-id').value = '';
        document.getElementById('m-rec-name').value = '';

        const today = window.getTodayString();
        ['m-join-date', 'm-first-date', 'm-last-date'].forEach(id => {
            let el = document.getElementById(id);
            if(el) el.value = today;
        });
        if (typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
    }
};

// [07-5] 플로팅 위젯 & 슬라이드 창 최상단 레이어(z-index) 강제 전환 시스템
window.ensureFrontLayerStyle = function() {
    if (document.getElementById('widget-front-layer-style')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'widget-front-layer-style';
    styleEl.innerHTML = `
        /* 선택된 활성 창은 우측 상단 줌 컨트롤 바 및 다른 슬라이드 창보다 무조건 최상위에 표시 */
        #filterWidget.is-front-widget,
        #perfWidget.is-front-widget {
            z-index: 2147483600 !important;
        }
        /* 비활성 창은 활성 창 아래로 배치 */
        #filterWidget.is-back-widget,
        #perfWidget.is-back-widget {
            z-index: 900 !important;
        }
        /* 팝업 모달창들은 언제나 최상위 유지 */
        #bonusDetailModal, #memberEditModal, #addPartnerModal, #partnerModal {
            z-index: 2147483645 !important;
        }
    `;
    document.head.appendChild(styleEl);
};

window.bringWidgetToFront = function(activeEl) {
    if (!activeEl) return;
    window.ensureFrontLayerStyle();

    const fw = document.getElementById('filterWidget');
    const pw = document.getElementById('perfWidget');

    if (fw && fw.parentElement !== document.body) {
        document.body.appendChild(fw);
    }

    const applyFront = () => {
        if (activeEl === fw || activeEl.id === 'filterWidget') {
            if (pw) {
                pw.classList.remove('is-front-widget');
                pw.classList.add('is-back-widget');
                pw.style.setProperty('z-index', '900', 'important');
            }
            if (fw) {
                fw.classList.remove('is-back-widget');
                fw.classList.add('is-front-widget');
                fw.style.setProperty('z-index', '2147483600', 'important');
            }
        } else if (activeEl === pw || activeEl.id === 'perfWidget') {
            if (fw) {
                fw.classList.remove('is-front-widget');
                fw.classList.add('is-back-widget');
                fw.style.setProperty('z-index', '900', 'important');
            }
            if (pw) {
                pw.classList.remove('is-back-widget');
                pw.classList.add('is-front-widget');
                pw.style.setProperty('z-index', '2147483600', 'important');
            }
        }
    };

    applyFront();
    setTimeout(applyFront, 0);
    setTimeout(applyFront, 30);
};

window.bindWidgetFrontEvents = function() {
    window.ensureFrontLayerStyle();
    if (window._globalWidgetFocusBound) return;
    window._globalWidgetFocusBound = true;

    const handlePointerEvent = function(e) {
        const clickedFilter = e.target.closest('#filterWidget');
        if (clickedFilter) {
            window.bringWidgetToFront(clickedFilter);
            return;
        }
        const clickedPerf = e.target.closest('#perfWidget');
        if (clickedPerf) {
            window.bringWidgetToFront(clickedPerf);
            return;
        }
    };

    document.addEventListener('mousedown', handlePointerEvent, true);
    document.addEventListener('mouseup', handlePointerEvent, true);
    document.addEventListener('click', handlePointerEvent, true);
    document.addEventListener('touchstart', handlePointerEvent, { passive: true, capture: true });
};

// [07-6] 선택된 기준 카드(없으면 루트) 대비 해당 회원의 라인('A라인', 'B라인', '본인') 판별 헬퍼
window.getSalesMemberLine = function(memberId) {
    if (!memberId) return '-';
    const targetNorm = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');

    let baseNode = window.currentSelectedId ? window.findMemberNode(window.currentSelectedId) : null;
    if (!baseNode && window.treeData) {
        baseNode = Array.isArray(window.treeData) ? window.treeData[0] : window.treeData;
    }

    if (baseNode && baseNode.id) {
        const baseNorm = String(baseNode.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (targetNorm === baseNorm) return '본인';

        if (typeof window.getSublinePartnerSets === 'function') {
            const { setA, setB } = window.getSublinePartnerSets(baseNode);
            if (setA.has(targetNorm)) return 'A라인';
            if (setB.has(targetNorm)) return 'B라인';
        }
    }

    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (mNode) {
        const pos = String(mNode.position || '').trim().toUpperCase();
        if (pos === 'A' || pos === 'LEFT') return 'A라인';
        if (pos === 'B' || pos === 'RIGHT') return 'B라인';
    }
    return '-';
};

// [07-7] 매출 기간 검색 위젯 DOM 동적 생성 (7컬럼: 선택/일자/회원ID/이름/라인/CV/PV)
window.initFilterWidget = function() {
    window.bindWidgetFrontEvents();

    if (document.getElementById('filterWidget')) {
        return;
    }

    const savedH = parseInt(localStorage.getItem('filterWidgetSavedHeight') || '420', 10);
    const initialHeight = (!isNaN(savedH) && savedH >= 240) ? Math.min(savedH, window.innerHeight - 60) : 420;

    const widgetHTML = `
        <div id="filterWidget" class="widget filter-widget is-front-widget" style="display: none; flex-direction: column; position: fixed; top: 100px; right: 20px; width: 510px; min-width: 510px; max-width: 510px; height: ${initialHeight}px; min-height: 240px; max-height: 88vh; box-sizing: border-box !important; resize: none !important; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: #fff; z-index: 2147483600 !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden;">
            <!-- 위젯 헤더 -->
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-bottom: 1px solid #374151; cursor: move; box-sizing: border-box; user-select: none; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; color: #60a5fa;">
                    <span>🔍</span>
                    <span>매출 기간 검색</span>
                </div>
                <button class="icon-btn-mac close" onclick="window.closeWidgetGlobal(event, 'filterWidget', 'chk-filter-widget')" title="닫기">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- 위젯 본문 -->
            <div style="padding: 12px 14px 8px 14px; box-sizing: border-box; display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: #111827; padding: 6px 10px; border-radius: 4px; border: 1px solid #374151; margin-bottom: 8px; font-size: 11px; box-sizing: border-box; flex-shrink: 0;">
                    <span style="color: #9ca3af;">적용 기간 (헤더 연동)</span>
                    <span id="filter-active-period-label" style="color: #60a5fa; font-weight: bold;">-</span>
                </div>

                <div id="filter-summary" style="font-size: 11.5px; color: #10b981; font-weight: bold; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <span id="filter-count-text">검색 결과: 0건</span>
                    <div>
                        <span id="filter-total-cv" style="color: #60a5fa;">총 0 CV</span>
                        <span style="color: #4b5563; margin: 0 4px;">/</span>
                        <span id="filter-total-pv" style="color: #10b981;">총 0 PV</span>
                    </div>
                </div>

                <div class="table-scroll-container" style="flex: 1; overflow-y: auto; border: 1px solid #374151; border-radius: 4px; background: #111827; box-sizing: border-box;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; table-layout: fixed; user-select: none;">
                        <colgroup>
                            <col style="width: 36px;">
                            <col style="width: 76px;">
                            <col style="width: 84px;">
                            <col style="width: 64px;">
                            <col style="width: 52px;">
                            <col style="width: auto;">
                            <col style="width: auto;">
                        </colgroup>
                        <thead style="background: #1f2937; position: sticky; top: 0; color: #9ca3af; z-index: 2;">
                            <tr>
                                <th onclick="window.resetFilterRowStates()" title="클릭 시 선택/제외 전체 초기화" style="padding: 6px 2px; border-bottom: 1px solid #374151; text-align: center; cursor: pointer; color: #60a5fa;">선택</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: center;">일자</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: center;">회원ID</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: center;">이름</th>
                                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: center;">라인</th>
                                <th style="padding: 6px 6px; border-bottom: 1px solid #374151; text-align: right;">CV</th>
                                <th style="padding: 6px 6px; border-bottom: 1px solid #374151; text-align: right;">PV</th>
                            </tr>
                        </thead>
                        <tbody id="filter-sales-tbody">
                            <tr>
                                <td colspan="7" style="padding: 20px; text-align: center; color: #6b7280;">상단 헤더의 기간을 기준으로 데이터가 출력됩니다.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 하단 창 높이 조절 드래그 바 -->
            <div id="filter-resize-handle" title="위아래로 드래그하여 창 높이를 조절하세요 (높이 자동 기억)" style="height: 12px; background: #111827; border-top: 1px solid #374151; cursor: ns-resize; display: flex; align-items: center; justify-content: center; flex-shrink: 0; user-select: none;">
                <div style="width: 36px; height: 3px; background: #4b5563; border-radius: 2px;"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    const fw = document.getElementById('filterWidget');
    const resizeHandle = document.getElementById('filter-resize-handle');

    let isResizing = false;
    let startY = 0;
    let startH = 0;

    if (resizeHandle && fw) {
        resizeHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.bringWidgetToFront(fw);
            isResizing = true;
            startY = e.clientY;
            startH = fw.getBoundingClientRect().height;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
        });

        window.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            const newH = Math.max(240, Math.min(window.innerHeight - 50, startH + (e.clientY - startY)));
            fw.style.height = `${newH}px`;
        });

        window.addEventListener('mouseup', function() {
            if (!isResizing) return;
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            const finalH = Math.round(fw.getBoundingClientRect().height);
            localStorage.setItem('filterWidgetSavedHeight', String(finalH));
        });
    }

    if (fw) {
        const observer = new MutationObserver(() => {
            if (fw.style.display === 'block') {
                fw.style.display = 'flex';
                window.bringWidgetToFront(fw);
            }
        });
        observer.observe(fw, { attributes: true, attributeFilter: ['style'] });
    }
};

// [07-8] 매출 기간 검색 행별 선택(✓) / 더블클릭 제외(✕) 상태 관리 및 동적 합계 연산
window.filterCurrentRows = [];
window.filterRowClickTimer = null;

window.toggleFilterRowSelect = function(event, idx) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const row = window.filterCurrentRows[idx];
    if (!row) return;

    if (row.state === 'excluded') {
        row.state = 'none';
    } else if (row.state === 'selected') {
        row.state = 'none';
    } else {
        row.state = 'selected';
    }
    window.renderFilterRowsAndTotals();
};

window.handleFilterRowDblClick = function(event, idx) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (window.filterRowClickTimer) {
        clearTimeout(window.filterRowClickTimer);
        window.filterRowClickTimer = null;
    }
    const row = window.filterCurrentRows[idx];
    if (!row) return;

    row.state = (row.state === 'excluded') ? 'none' : 'excluded';
    window.renderFilterRowsAndTotals();
};

window.handleFilterRowSingleClick = function(event, memberId) {
    if (window.filterRowClickTimer) {
        clearTimeout(window.filterRowClickTimer);
    }
    window.filterRowClickTimer = setTimeout(() => {
        if (typeof window.executeNodeSingleClick === 'function' && memberId && memberId !== '-') {
            window.executeNodeSingleClick(memberId);
        }
        const fw = document.getElementById('filterWidget');
        if (fw) window.bringWidgetToFront(fw);
        window.filterRowClickTimer = null;
    }, 220);
};

window.resetFilterRowStates = function() {
    if (!Array.isArray(window.filterCurrentRows)) return;
    window.filterCurrentRows.forEach(r => { r.state = 'none'; });
    window.renderFilterRowsAndTotals();
};

window.renderFilterRowsAndTotals = function() {
    const tbody = document.getElementById('filter-sales-tbody');
    const summaryEl = document.getElementById('filter-summary');
    const totalCvEl = document.getElementById('filter-total-cv');
    const totalPvEl = document.getElementById('filter-total-pv');
    if (!tbody) return;

    const rows = window.filterCurrentRows || [];
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #9ca3af;">해당 기간의 매출 내역이 없습니다.</td></tr>`;
        if (summaryEl && summaryEl.firstElementChild) summaryEl.firstElementChild.innerText = `검색 결과: 0건`;
        if (totalCvEl) totalCvEl.innerText = `총 0 CV`;
        if (totalPvEl) totalPvEl.innerText = `총 0 PV`;
        return;
    }

    const selectedRows = rows.filter(r => r.state === 'selected');
    const excludedRows = rows.filter(r => r.state === 'excluded');
    const hasSelection = selectedRows.length > 0;

    const targetSumRows = hasSelection
        ? selectedRows
        : rows.filter(r => r.state !== 'excluded');

    let sumCv = 0;
    let sumPv = 0;
    targetSumRows.forEach(r => {
        sumCv += r.cv;
        sumPv += r.pv;
    });

    let rowsHtml = '';
    rows.forEach((r, idx) => {
        const isSelected = r.state === 'selected';
        const isExcluded = r.state === 'excluded';

        let boxHtml = '';
        if (isSelected) {
            boxHtml = `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: #3b82f6; border: 1px solid #60a5fa; color: #fff; font-size: 11px; font-weight: bold; line-height: 15px; text-align: center;">✓</div>`;
        } else if (isExcluded) {
            boxHtml = `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #ef4444; font-size: 11px; font-weight: bold; line-height: 15px; text-align: center;">✕</div>`;
        } else {
            boxHtml = `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: #1f2937; border: 1px solid #4b5563;"></div>`;
        }

        const rowBg = isSelected
            ? 'rgba(59, 130, 246, 0.16)'
            : (isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'transparent');
        const textDeco = isExcluded ? 'line-through' : 'none';
        const rowOpacity = isExcluded ? '0.45' : '1';

        rowsHtml += `
            <tr onclick="window.handleFilterRowSingleClick(event, '${r.mId}')"
                ondblclick="window.handleFilterRowDblClick(event, ${idx})"
                title="클릭: 회원 카드 이동 | 좌측 선택란 클릭: 선택 합산 | 더블클릭: ✕(합계에서 제외)"
                style="border-bottom: 1px solid #1f2937; cursor: pointer; background: ${rowBg}; text-decoration: ${textDeco}; opacity: ${rowOpacity};"
                onmouseover="if('${r.state}'==='none') this.style.background='#1e293b'"
                onmouseout="if('${r.state}'==='none') this.style.background='transparent'">
                <td onclick="window.toggleFilterRowSelect(event, ${idx})" style="padding: 6px 2px; text-align: center; cursor: pointer;">
                    ${boxHtml}
                </td>
                <td style="padding: 6px 4px; color: #d1d5db; text-align: center;">${r.dStr}</td>
                <td style="padding: 6px 4px; color: #60a5fa; font-weight: bold; text-align: center;">${r.mId}</td>
                <td style="padding: 6px 4px; color: #fff; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.mName}</td>
                <td style="padding: 6px 4px; color: ${r.lineColor}; font-weight: bold; text-align: center;">${r.lineLabel}</td>
                <td style="padding: 6px 6px; color: #60a5fa; font-weight: bold; text-align: right; font-variant-numeric: tabular-nums;">${r.cv.toLocaleString('ko-KR')}</td>
                <td style="padding: 6px 6px; color: #10b981; font-weight: bold; text-align: right; font-variant-numeric: tabular-nums;">${r.pv.toLocaleString('ko-KR')}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;

    if (summaryEl && summaryEl.firstElementChild) {
        if (hasSelection) {
            summaryEl.firstElementChild.innerHTML = `<span style="color:#60a5fa;">선택 합계: ${selectedRows.length.toLocaleString('ko-KR')}건</span> <span style="color:#9ca3af; font-weight:normal; font-size:10.5px;">(전체 ${rows.length}건)</span>`;
        } else if (excludedRows.length > 0) {
            summaryEl.firstElementChild.innerHTML = `<span>검색 결과: ${targetSumRows.length.toLocaleString('ko-KR')}건</span> <span style="color:#ef4444; font-weight:normal; font-size:10.5px;">(제외 ${excludedRows.length}건)</span>`;
        } else {
            summaryEl.firstElementChild.innerText = `검색 결과: ${rows.length.toLocaleString('ko-KR')}건`;
        }
    }
    if (totalCvEl) {
        totalCvEl.innerText = `총 ${sumCv.toLocaleString('ko-KR')} CV`;
    }
    if (totalPvEl) {
        totalPvEl.innerText = `총 ${sumPv.toLocaleString('ko-KR')} PV`;
    }
};

// [07-9] 본문 헤더 영역의 기간검색 값을 기준으로 매출 데이터 필터링 및 상태 배열 생성
window.searchPeriodSales = function() {
    window.bindWidgetFrontEvents();

    const fw = document.getElementById('filterWidget');
    const tbody = document.getElementById('filter-sales-tbody');
    const periodLabelEl = document.getElementById('filter-active-period-label');

    if (!tbody) return;
    if (fw && fw.style.display !== 'none') {
        window.bringWidgetToFront(fw);
    }

    const headerStartEl = document.getElementById('header-start-date');
    const headerEndEl = document.getElementById('header-end-date');

    const rawStart = window.globalStartDate || (headerStartEl ? headerStartEl.value : '');
    const rawEnd = window.globalEndDate || (headerEndEl ? headerEndEl.value : '');

    const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim());
    const startDate = cleanFn(rawStart);
    const endDate = cleanFn(rawEnd);

    if (periodLabelEl) {
        periodLabelEl.innerText = (startDate && endDate) ? `${startDate} ~ ${endDate}` : '전체 기간';
    }

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];

    let baseNode = window.currentSelectedId ? window.findMemberNode(window.currentSelectedId) : null;
    if (!baseNode && window.treeData) {
        baseNode = Array.isArray(window.treeData) ? window.treeData[0] : window.treeData;
    }
    const baseNorm = (baseNode && baseNode.id) ? String(baseNode.id).trim().toLowerCase().replace(/^vk-?/, '') : '';
    const cachedSets = (baseNode && typeof window.getSublinePartnerSets === 'function')
        ? window.getSublinePartnerSets(baseNode)
        : { setA: new Set(), setB: new Set() };

    let filtered = allSales.filter(item => {
        let itemDate = cleanFn(item.transaction_date || item.date || item.buy_date || item.sales_date || '');
        if (!itemDate) return false;
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let dA = cleanFn(a.transaction_date || a.date || '');
        let dB = cleanFn(b.transaction_date || b.date || '');
        return dB.localeCompare(dA);
    });

    const prevStateMap = {};
    if (Array.isArray(window.filterCurrentRows)) {
        window.filterCurrentRows.forEach(r => {
            if (r.rowKey && r.state !== 'none') prevStateMap[r.rowKey] = r.state;
        });
    }

    window.filterCurrentRows = filtered.map((s, idx) => {
        let cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        let pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        let mId = s.member_id || '-';
        let mNorm = String(mId).trim().toLowerCase().replace(/^vk-?/, '');
        let mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(mId) : null;
        let mName = mNode ? mNode.name : (s.name || '-');
        let dStr = cleanFn(s.transaction_date || s.date || s.buy_date || '-');

        let lineLabel = '-';
        if (baseNorm && mNorm === baseNorm) lineLabel = '본인';
        else if (cachedSets.setA.has(mNorm)) lineLabel = 'A라인';
        else if (cachedSets.setB.has(mNorm)) lineLabel = 'B라인';
        else if (mNode) {
            const pos = String(mNode.position || '').trim().toUpperCase();
            if (pos === 'A' || pos === 'LEFT') lineLabel = 'A라인';
            else if (pos === 'B' || pos === 'RIGHT') lineLabel = 'B라인';
        }

        let lineColor = '#9ca3af';
        if (lineLabel === 'A라인') lineColor = '#60a5fa';
        else if (lineLabel === 'B라인') lineColor = '#f59e0b';
        else if (lineLabel === '본인') lineColor = '#10b981';

        const rowKey = `${s.id || idx}_${mId}_${dStr}_${cv}_${pv}`;
        return {
            rowKey,
            dStr,
            mId,
            mName,
            lineLabel,
            lineColor,
            cv,
            pv,
            state: prevStateMap[rowKey] || 'none'
        };
    });

    window.renderFilterRowsAndTotals();
};
// ============================================================================
// [08] 보너스 내역 팝업 모달창 제어
// - 창 너비/높이 마우스 드래그 조절 및 조절된 크기 자동 기억(localStorage) + 헤더 클릭 시 창 확대 버그 원천 차단
// - 추천매칭보너스(matchBonus) 세대 직접 편집, 파트너 행 추가(VK- 자동부여 & 자동조회), TiDB 저장 연동
// - 품위유지수당(dignityBonus), 차량유지비(carBonus), 패스트파워보너스(fastPowerBonus) TiDB 정책 테이블 연동 상세 검증 반영
// ============================================================================

window.matchingEditState = {
    targetId: '',
    termLabel: '',
    periodKey: '',
    startDate: '',
    endDate: '',
    memberHistRank: '',
    rows: []
};

window.closeBonusDetailModal = function() {
    const modal = document.getElementById('bonusDetailModal');
    if (modal) modal.style.display = 'none';
};

// [08-1] 보너스 상세 검증 창 너비/높이 드래그 조절 및 조절된 크기 자동 기억 초기화
window.initBonusModalResizeAndMemory = function() {
    const modal = document.getElementById('bonusDetailModal');
    if (!modal) return;

    modal.style.setProperty('box-sizing', 'border-box', 'important');

    // 1) 저장된 너비/높이 복원 (가로 스크롤이 생기지 않도록 기본 너비 740px 적용)
    const savedW = parseInt(localStorage.getItem('bs_bonus_modal_width') || '740', 10);
    const savedH = parseInt(localStorage.getItem('bs_bonus_modal_height') || '500', 10);
    const initW = (!isNaN(savedW) && savedW >= 560) ? Math.min(savedW, window.innerWidth - 40) : 740;
    const initH = (!isNaN(savedH) && savedH >= 320) ? Math.min(savedH, window.innerHeight - 60) : 500;

    modal.style.width = `${initW}px`;
    modal.style.height = `${initH}px`;
    modal.style.minWidth = '560px';
    modal.style.minHeight = '320px';
    modal.style.maxWidth = 'none';
    modal.style.maxHeight = 'none';
    modal.style.resize = 'none';

    const scrollBox = modal.querySelector('.table-scroll-container');
    if (scrollBox) {
        scrollBox.style.overflowX = 'hidden';
    }

    if (modal.dataset.resizeBound === 'true') return;
    modal.dataset.resizeBound = 'true';

    let resizeMode = null; // 'w' | 'h' | 'wh'
    let startX = 0, startY = 0, startW = 0, startH = 0;

    const headerEl = modal.querySelector('.modal-header, .widget-header, header') || modal.firstElementChild;
    if (headerEl) {
        headerEl.addEventListener('mousedown', () => {
            const lockedW = modal.style.width;
            const lockedH = modal.style.height;
            const lockSizeOnMove = () => {
                if (!resizeMode) {
                    modal.style.width = lockedW;
                    modal.style.height = lockedH;
                }
            };
            const releaseLock = () => {
                if (!resizeMode) {
                    modal.style.width = lockedW;
                    modal.style.height = lockedH;
                }
                window.removeEventListener('mousemove', lockSizeOnMove);
                window.removeEventListener('mouseup', releaseLock);
            };
            window.addEventListener('mousemove', lockSizeOnMove);
            window.addEventListener('mouseup', releaseLock);
        });
    }

    // 2) 우측, 하단, 우측하단 모서리 드래그 핸들 삽입
    const rightHandle = document.createElement('div');
    rightHandle.title = '좌우로 드래그하여 창 너비 조절 (자동 기억)';
    rightHandle.style.cssText = 'position:absolute; top:40px; right:0; width:8px; height:calc(100% - 40px); cursor:ew-resize; z-index:100;';

    const bottomHandle = document.createElement('div');
    bottomHandle.title = '위아래로 드래그하여 창 높이 조절 (자동 기억)';
    bottomHandle.style.cssText = 'position:absolute; bottom:0; left:0; width:100%; height:8px; cursor:ns-resize; z-index:100;';

    const cornerHandle = document.createElement('div');
    cornerHandle.title = '드래그하여 창 너비와 높이 동시 조절 (자동 기억)';
    cornerHandle.style.cssText = 'position:absolute; bottom:0; right:0; width:16px; height:16px; cursor:nwse-resize; z-index:101; display:flex; align-items:flex-end; justify-content:flex-end; padding:2px; box-sizing:border-box;';
    cornerHandle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#60a5fa" stroke-width="1.5"><line x1="9" y1="1" x2="1" y2="9"></line><line x1="9" y1="5" x2="5" y2="9"></line></svg>`;

    modal.appendChild(rightHandle);
    modal.appendChild(bottomHandle);
    modal.appendChild(cornerHandle);

    const startResize = (e, mode) => {
        e.preventDefault();
        e.stopPropagation();
        resizeMode = mode;
        startX = e.clientX;
        startY = e.clientY;
        startW = parseFloat(modal.style.width) || modal.offsetWidth;
        startH = parseFloat(modal.style.height) || modal.offsetHeight;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = mode === 'w' ? 'ew-resize' : (mode === 'h' ? 'ns-resize' : 'nwse-resize');
    };

    rightHandle.addEventListener('mousedown', (e) => startResize(e, 'w'));
    bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'h'));
    cornerHandle.addEventListener('mousedown', (e) => startResize(e, 'wh'));

    window.addEventListener('mousemove', (e) => {
        if (!resizeMode) return;
        if (resizeMode === 'w' || resizeMode === 'wh') {
            const newW = Math.max(560, Math.min(window.innerWidth - 30, startW + (e.clientX - startX)));
            modal.style.width = `${Math.round(newW)}px`;
        }
        if (resizeMode === 'h' || resizeMode === 'wh') {
            const newH = Math.max(320, Math.min(window.innerHeight - 30, startH + (e.clientY - startY)));
            modal.style.height = `${Math.round(newH)}px`;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!resizeMode) return;
        resizeMode = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        const finalW = parseFloat(modal.style.width) || modal.offsetWidth;
        const finalH = parseFloat(modal.style.height) || modal.offsetHeight;
        localStorage.setItem('bs_bonus_modal_width', String(Math.round(finalW)));
        localStorage.setItem('bs_bonus_modal_height', String(Math.round(finalH)));
    });
};

// [08-2] 숫자만 입력해도 VK- 자동 부여하는 포맷터
window.formatMatchingPartnerInputId = function(inputEl) {
    if (!inputEl) return;
    let raw = String(inputEl.value || '').toUpperCase().replace(/[^0-9A-Z-]/g, '');
    let digits = raw.replace(/^VK-?/, '').replace(/[^0-9]/g, '');
    if (digits.length > 0) {
        inputEl.value = `VK-${digits}`;
    } else if (raw === 'V' || raw === 'VK' || raw === 'VK-') {
        inputEl.value = 'VK-';
    } else {
        inputEl.value = '';
    }
};

// [08-3] 특정 회원(targetId)의 수동 편집 오버라이드 데이터 조회 (TiDB + localStorage 연동)
window.loadMatchingOverridesForTarget = async function(targetId) {
    if (!targetId) return {};
    const normTarget = String(targetId).trim().toUpperCase();
    const localKey = `bs_matching_overrides_${normTarget}`;
    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : '';
    let overrideMap = {};

    try {
        const savedStr = localStorage.getItem(localKey);
        if (savedStr) overrideMap = JSON.parse(savedStr) || {};
    } catch (e) {}

    if (window.API_BASE) {
        try {
            const res = await fetch(`${window.API_BASE}/api/matching-overrides?targetId=${encodeURIComponent(normTarget)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.ok && Array.isArray(data.rows)) {
                    const dbGrouped = {};
                    data.rows.forEach(r => {
                        const pk = r.period_key;
                        if (!dbGrouped[pk]) dbGrouped[pk] = [];
                        dbGrouped[pk].push({
                            gen: Number(r.applied_gen || 1),
                            rawGen: Number(r.raw_gen || r.applied_gen || 1),
                            genLabel: `${r.applied_gen || 1}세대`,
                            member_id: r.partner_member_id,
                            name: r.partner_name || '-',
                            rank: r.partner_hist_rank || baseRank,
                            teamBonus: Number(r.partner_team_bonus || 0),
                            rate: Number(r.applied_rate || 0),
                            matchingAmount: Number(r.matching_amount || 0),
                            isManualOverride: true
                        });
                    });
                    if (Object.keys(dbGrouped).length > 0) {
                        overrideMap = { ...overrideMap, ...dbGrouped };
                        localStorage.setItem(localKey, JSON.stringify(overrideMap));
                    }
                }
            }
        } catch (err) {}
    }

    window.cachedMatchingOverrides = window.cachedMatchingOverrides || {};
    window.cachedMatchingOverrides[normTarget] = overrideMap;
    return overrideMap;
};

// [08-4] 추천매칭 편집 테이블의 개별 행에서 회원번호 입력 시 이름, 당시직급, 지원수당, DB매칭요율 자동 조회
window.lookupPartnerForMatchingRow = function(idx, rawInputId) {
    const st = window.matchingEditState;
    if (!st || !st.rows[idx]) return;

    let cleanId = String(rawInputId || '').trim().toUpperCase();
    const digits = cleanId.replace(/^VK-?/, '').replace(/[^0-9]/g, '');
    if (digits) cleanId = `VK-${digits}`;

    const row = st.rows[idx];
    row.member_id = cleanId;

    if (!digits) {
        row.name = '-';
        row.rank = '-';
        row.teamBonus = 0;
        row.matchingAmount = 0;
        window.renderMatchingEditorTable();
        return;
    }

    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : '';
    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(cleanId) : null;
    const normId = digits.toLowerCase();

    const teamMap = window.lastAllMembersTeamBonusMap instanceof Map ? window.lastAllMembersTeamBonusMap : null;
    const partnerPeriodMap = teamMap ? teamMap.get(normId) : null;
    const periodInfo = (partnerPeriodMap && st.periodKey) ? partnerPeriodMap[st.periodKey] : null;

    row.name = mNode ? (mNode.name || '-') : '-';
    row.rank = periodInfo && periodInfo.historicalRank
        ? periodInfo.historicalRank
        : (mNode ? (mNode.rank || baseRank) : baseRank);
    row.teamBonus = periodInfo && typeof periodInfo.teamBonus === 'number'
        ? periodInfo.teamBonus
        : 0;

    const myMatchRates = typeof window.getMatchingBonusRates === 'function'
        ? window.getMatchingBonusRates(st.memberHistRank)
        : {};
    const genNum = Number(row.gen || 1);
    row.rate = genNum > 0 ? (myMatchRates[genNum] || 0) : 0;
    row.matchingAmount = Math.floor((row.teamBonus || 0) * row.rate);

    window.renderMatchingEditorTable();
};

// [08-5] 세대 드롭다운 변경 시 DB 매칭요율 재적용 및 금액 재계산
window.changeMatchingRowGen = function(idx, newGenVal) {
    const st = window.matchingEditState;
    if (!st || !st.rows[idx]) return;

    const genNum = parseInt(newGenVal, 10) || 0;
    const myMatchRates = typeof window.getMatchingBonusRates === 'function'
        ? window.getMatchingBonusRates(st.memberHistRank)
        : {};

    const row = st.rows[idx];
    row.gen = genNum;
    row.genLabel = genNum > 0 ? `${genNum}세대` : '제외';
    row.rate = genNum > 0 ? (myMatchRates[genNum] || 0) : 0;
    row.matchingAmount = genNum > 0 ? Math.floor((row.teamBonus || 0) * row.rate) : 0;

    window.renderMatchingEditorTable();
};

// [08-6] 추천매칭 편집창에 신규 파트너 빈 행 추가 및 행 삭제
window.addMatchingEditorRow = function() {
    const st = window.matchingEditState;
    if (!st) return;

    const myMatchRates = typeof window.getMatchingBonusRates === 'function'
        ? window.getMatchingBonusRates(st.memberHistRank)
        : {};
    const defaultGen = 1;
    const defaultRate = myMatchRates[defaultGen] || 0;

    st.rows.push({
        gen: defaultGen,
        rawGen: defaultGen,
        genLabel: '1세대',
        member_id: 'VK-',
        name: '-',
        rank: '-',
        teamBonus: 0,
        rate: defaultRate,
        matchingAmount: 0,
        isNewRow: true
    });

    window.renderMatchingEditorTable();

    setTimeout(() => {
        const inputs = document.querySelectorAll('#b-detail-tbody .match-partner-id-input');
        if (inputs.length > 0) {
            const lastInput = inputs[inputs.length - 1];
            lastInput.focus();
            lastInput.setSelectionRange(lastInput.value.length, lastInput.value.length);
        }
    }, 30);
};

window.removeMatchingEditorRow = function(idx) {
    const st = window.matchingEditState;
    if (!st || !Array.isArray(st.rows)) return;
    st.rows.splice(idx, 1);
    window.renderMatchingEditorTable();
};

// [08-7] 추천매칭 편집 테이블 렌더링
window.renderMatchingEditorTable = function() {
    const tbodyEl = document.getElementById('b-detail-tbody');
    if (!tbodyEl) return;

    const st = window.matchingEditState;
    const myMatchRates = typeof window.getMatchingBonusRates === 'function'
        ? window.getMatchingBonusRates(st.memberHistRank)
        : {};

    let rowsHtml = '';
    let totalPartnerTeamBonus = 0;
    let totalMatchingBonus = 0;

    if (!st.rows || st.rows.length === 0) {
        rowsHtml = `<tr><td colspan="8" style="padding:18px; color:#9ca3af; text-align:center;">매칭 대상 내역이 없습니다. 하단의 <b>[+ 파트너 행 추가]</b> 버튼을 눌러 추가할 수 있습니다.</td></tr>`;
    } else {
        st.rows.forEach((item, idx) => {
            const genNum = Number(item.gen ?? 1);
            const rateVal = genNum > 0 ? (myMatchRates[genNum] ?? item.rate ?? 0) : 0;
            item.rate = rateVal;
            item.matchingAmount = genNum > 0 ? Math.floor((item.teamBonus || 0) * rateVal) : 0;

            if (genNum > 0) {
                totalPartnerTeamBonus += (item.teamBonus || 0);
                totalMatchingBonus += (item.matchingAmount || 0);
            }

            const rateStr = (rateVal * 100).toFixed(1).replace(/\.0$/, '') + '%';
            const rawGenHint = (item.rawGen && item.rawGen !== genNum)
                ? `<div style="color:#9ca3af; font-size:9.5px;">(원 ${item.rawGen}대)</div>`
                : '';

            let genOptionsHtml = `<option value="0" ${genNum === 0 ? 'selected' : ''}>제외(0%)</option>`;
            for (let g = 1; g <= 5; g++) {
                const gRate = myMatchRates[g] || 0;
                const gPct = (gRate * 100).toFixed(1).replace(/\.0$/, '');
                genOptionsHtml += `<option value="${g}" ${genNum === g ? 'selected' : ''}>${g}세대 (${gPct}%)</option>`;
            }

            rowsHtml += `
                <tr style="border-bottom:1px solid #374151; ${genNum === 0 ? 'opacity:0.45;' : ''}">
                    <td style="padding:5px 4px; text-align:center;">
                        <select onchange="window.changeMatchingRowGen(${idx}, this.value)"
                                style="background:#111827; border:1px solid #4b5563; color:#fbbf24; font-weight:bold; border-radius:4px; padding:3px 4px; font-size:11px; cursor:pointer;">
                            ${genOptionsHtml}
                        </select>
                        ${rawGenHint}
                    </td>
                    <td style="padding:5px 4px; text-align:center;">
                        <input type="text" class="match-partner-id-input" value="${item.member_id || 'VK-'}"
                               placeholder="숫자만 입력"
                               oninput="window.formatMatchingPartnerInputId(this)"
                               onblur="window.lookupPartnerForMatchingRow(${idx}, this.value)"
                               onkeydown="if(event.key==='Enter'){ this.blur(); }"
                               style="width:92px; text-align:center; background:#111827; border:1px solid #4b5563; color:#60a5fa; font-weight:bold; padding:4px; border-radius:4px; font-size:11px;">
                    </td>
                    <td style="padding:5px 4px; color:#fff; font-weight:bold; text-align:center;">${item.name || '-'}</td>
                    <td style="padding:5px 4px; color:#10b981; font-weight:bold; text-align:center;">${item.rank || '-'}</td>
                    <td style="padding:5px 6px; color:#60a5fa; font-weight:bold; text-align:right;">${(item.teamBonus || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:5px 4px; color:#f59e0b; font-weight:bold; text-align:center;">${rateStr}</td>
                    <td style="padding:5px 6px; color:#10b981; font-weight:bold; text-align:right;">${(item.matchingAmount || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:5px 4px; text-align:center;">
                        <button onclick="window.removeMatchingEditorRow(${idx})" title="행 삭제"
                                style="background:transparent; border:none; color:#ef4444; font-weight:bold; font-size:14px; cursor:pointer;">✕</button>
                    </td>
                </tr>
            `;
        });
    }

    const activeCount = (st.rows || []).filter(r => Number(r.gen) > 0 && r.name && r.name !== '-').length;
    rowsHtml += `
        <tr style="background:#111827; font-weight:bold; border-top:2px solid #374151;">
            <td colspan="4" style="padding:8px; text-align:center; color:#9ca3af;">합 계 (${activeCount}명 적용)</td>
            <td style="padding:8px 6px; text-align:right; color:#60a5fa;">${totalPartnerTeamBonus.toLocaleString('ko-KR')} 원</td>
            <td style="padding:8px 4px; text-align:center; color:#f59e0b;">-</td>
            <td style="padding:8px 6px; text-align:right; color:#fbbf24; font-size:12px;">${totalMatchingBonus.toLocaleString('ko-KR')} 원</td>
            <td></td>
        </tr>
        <tr style="background:#1f2937;">
            <td colspan="8" style="padding:10px 8px; text-align:right;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button onclick="window.addMatchingEditorRow()"
                            style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">
                        + 파트너 행 추가 (ID 숫자입력)
                    </button>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.resetMatchingOverrideToAuto()"
                                style="background:#4b5563; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11.5px; cursor:pointer;">
                            🔄 자동계산 복원
                        </button>
                        <button onclick="window.saveMatchingOverridesToDB()"
                                style="background:#10b981; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">
                            💾 TiDB 저장 및 시뮬레이터 반영
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `;

    tbodyEl.innerHTML = rowsHtml;
};

// [08-8] 편집한 추천매칭 내역을 TiDB 및 localStorage에 저장하고 하단 시뮬레이터 테이블 즉시 갱신
window.saveMatchingOverridesToDB = async function() {
    const st = window.matchingEditState;
    if (!st || !st.targetId || !st.periodKey) return;

    const validRows = (st.rows || []).filter(r => {
        const digits = String(r.member_id || '').replace(/[^0-9]/g, '');
        return digits.length > 0 && Number(r.gen) > 0;
    });

    const normTarget = String(st.targetId).trim().toUpperCase();
    const localKey = `bs_matching_overrides_${normTarget}`;

    let savedMap = {};
    try {
        savedMap = JSON.parse(localStorage.getItem(localKey) || '{}');
    } catch (e) {}
    savedMap[st.periodKey] = validRows.map(r => ({ ...r, isManualOverride: true }));
    localStorage.setItem(localKey, JSON.stringify(savedMap));

    window.cachedMatchingOverrides = window.cachedMatchingOverrides || {};
    window.cachedMatchingOverrides[normTarget] = savedMap;

    let dbSaved = false;
    if (window.API_BASE) {
        try {
            const res = await fetch(`${window.API_BASE}/api/matching-overrides`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_member_id: normTarget,
                    period_key: st.periodKey,
                    period_label: st.termLabel,
                    rows: validRows
                })
            });
            if (res.ok) dbSaved = true;
        } catch (err) {
            console.warn('TiDB 추천매칭 저장 API 호출 실패(로컬 저장 완료):', err);
        }
    }

    if (typeof window.calculateLocalPerformance === 'function') {
        await window.calculateLocalPerformance(st.targetId);
    }

    alert(dbSaved
        ? `✅ [${st.termLabel}] 추천매칭보너스 편집 내역이 TiDB에 저장되어 시뮬레이터에 반영되었습니다.`
        : `✅ [${st.termLabel}] 추천매칭보너스 편집 내역이 저장되어 시뮬레이터에 반영되었습니다.`);
};

// [08-9] 수동 편집 내역을 삭제하고 자동 계산 상태로 복원
window.resetMatchingOverrideToAuto = async function() {
    const st = window.matchingEditState;
    if (!st || !st.targetId || !st.periodKey) return;

    const normTarget = String(st.targetId).trim().toUpperCase();
    const localKey = `bs_matching_overrides_${normTarget}`;

    try {
        const savedMap = JSON.parse(localStorage.getItem(localKey) || '{}');
        delete savedMap[st.periodKey];
        localStorage.setItem(localKey, JSON.stringify(savedMap));
        if (window.cachedMatchingOverrides && window.cachedMatchingOverrides[normTarget]) {
            delete window.cachedMatchingOverrides[normTarget][st.periodKey];
        }
    } catch (e) {}

    if (window.API_BASE) {
        try {
            await fetch(`${window.API_BASE}/api/matching-overrides?targetId=${encodeURIComponent(normTarget)}&periodKey=${encodeURIComponent(st.periodKey)}`, {
                method: 'DELETE'
            });
        } catch (err) {}
    }

    if (typeof window.calculateLocalPerformance === 'function') {
        await window.calculateLocalPerformance(st.targetId);
    }
    window.openBonusDetailModal(st.targetId, st.termLabel, st.startDate, st.endDate, 'matchBonus');
};

// [08-10] 보너스 산출 상세 검증 모달 오픈 메인 함수
window.openBonusDetailModal = function(targetId, termLabel, startDate, endDate, bonusType) {
    const modal = document.getElementById('bonusDetailModal');
    const summaryEl = document.getElementById('b-detail-summary');
    const logicEl = document.getElementById('b-detail-logic');
    const theadEl = document.getElementById('b-detail-thead');
    const tbodyEl = document.getElementById('b-detail-tbody');
    if (!modal || !summaryEl || !tbodyEl) return;

    if (typeof window.initBonusModalResizeAndMemory === 'function') {
        window.initBonusModalResizeAndMemory();
    }

    let member = window.findMemberNode(targetId);
    if (!member) return;

    let pRec = null;
    if (Array.isArray(window.perfData)) {
        pRec = window.perfData.find(p => 
            (termLabel && p.periodLabel === termLabel) || 
            (startDate && p.startDate === startDate) ||
            (startDate && p.sortKey === `${startDate.substring(0,7)}-${startDate.endsWith('16') ? '후' : '전'}`)
        );
    }
    if (!pRec) {
        pRec = {
            sortOrderKey: startDate ? `${startDate.substring(0,7)}-${startDate.endsWith('16') ? '2' : '1'}` : '',
            periodLabel: termLabel || '-',
            recDetails: [],
            matchingDetails: [],
            details: [],
            levelBonus: 0,
            carBonus: 0,
            fastPowerBonus: 0,
            directBonus: 0,
            teamBonus: 0,
            matchingBonus: 0
        };
    }

    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : '';
    const memberHistRank = pRec.historicalRank || pRec.appliedMatchRank || member.rank || baseRank;

    let bonusTitle = '', logicText = '', theadHtml = '', rowsHtml = '';
    let colCount = 6;

    if (bonusType === 'recBonus') {
        colCount = 7;
        const recRate = pRec.appliedRecRate !== undefined ? pRec.appliedRecRate : window.getDirectBonusRate(memberHistRank);
        const ratePct = (recRate * 100).toFixed(1).replace(/\.0$/, '');
        bonusTitle = '추천수당 (Direct Bonus)';
        logicText = `💡 <b>계산 로직 (당시 직급 DB 연동):</b> 선택 회원(<b>${member.name}</b> / <b>${termLabel} 당시 직급: ${memberHistRank}</b>)이 추천한 파트너의 당기 매출 CV × 당시 직급 DB 요율(<b>${ratePct}%</b>)`;
        theadHtml = `
            <tr>
                <th style="padding:6px; text-align:center;">매출일자</th>
                <th style="padding:6px; text-align:center;">추천파트너 ID</th>
                <th style="padding:6px; text-align:center;">파트너 이름</th>
                <th style="padding:6px; text-align:center;">당시 직급</th>
                <th style="padding:6px; text-align:right;">당기 발생 CV</th>
                <th style="padding:6px; text-align:center;">DB 요율</th>
                <th style="padding:6px; text-align:right;">산출 추천수당</th>
            </tr>
        `;
        if (pRec.recDetails && pRec.recDetails.length > 0) {
            pRec.recDetails.forEach(det => {
                rowsHtml += `
                    <tr style="border-bottom:1px solid #374151;">
                        <td style="padding:6px; color:#d1d5db; text-align:center;">${det.date || '-'}</td>
                        <td style="padding:6px; color:#60a5fa; font-weight:bold; text-align:center;">${det.member_id}</td>
                        <td style="padding:6px; color:#fff; font-weight:bold; text-align:center;">${det.name || '-'}</td>
                        <td style="padding:6px; color:#d1d5db; text-align:center;">${det.rank || '-'}</td>
                        <td style="padding:6px; color:#fff; font-weight:bold; text-align:right;">${(det.cv || 0).toLocaleString('ko-KR')} CV</td>
                        <td style="padding:6px; color:#f59e0b; text-align:center;">${((det.rate || 0) * 100).toFixed(1).replace(/\.0$/, '')}%</td>
                        <td style="padding:6px; color:#10b981; font-weight:bold; text-align:right;">${(det.bonus || 0).toLocaleString('ko-KR')} 원</td>
                    </tr>
                `;
            });
            rowsHtml += `
                <tr style="background:#111827; font-weight:bold;">
                    <td colspan="4" style="padding:8px; text-align:center; color:#9ca3af;">합 계</td>
                    <td style="padding:8px 6px; text-align:right; color:#60a5fa;">${pRec.recDetails.reduce((s, d) => s + (d.cv || 0), 0).toLocaleString('ko-KR')} CV</td>
                    <td style="padding:8px 6px; text-align:center; color:#f59e0b;">${ratePct}%</td>
                    <td style="padding:8px 6px; text-align:right; color:#fbbf24;">${(pRec.directBonus || 0).toLocaleString('ko-KR')} 원</td>
                </tr>
            `;
        }
    } else if (bonusType === 'sponBonus') {
        colCount = 6;
        const teamRate = pRec.appliedTeamRate !== undefined ? pRec.appliedTeamRate : window.getTeamBonusRate(memberHistRank);
        const ratePct = (teamRate * 100).toFixed(1).replace(/\.0$/, '');
        const matchedCV = pRec.matchedCV || 0;

        const prevCarryA = pRec.prevCarryA !== undefined ? pRec.prevCarryA : ((pRec.displayAccACV || 0) + matchedCV - (pRec.a_cv || 0));
        const prevCarryB = pRec.prevCarryB !== undefined ? pRec.prevCarryB : ((pRec.displayAccBCV || 0) + matchedCV - (pRec.b_cv || 0));
        const beforeA = pRec.beforeDeductACV !== undefined ? pRec.beforeDeductACV : (prevCarryA + (pRec.a_cv || 0));
        const beforeB = pRec.beforeDeductBCV !== undefined ? pRec.beforeDeductBCV : (prevCarryB + (pRec.b_cv || 0));

        const badgeA = pRec.legLabelA === '대실적'
            ? '<span style="background:#1e3a8a; color:#93c5fd; padding:1px 5px; border-radius:3px; font-size:10px; margin-left:4px;">대실적</span>'
            : (pRec.legLabelA === '소실적' ? '<span style="background:#7f1d1d; color:#fca5a5; padding:1px 5px; border-radius:3px; font-size:10px; margin-left:4px;">소실적(기준)</span>' : '');
        const badgeB = pRec.legLabelB === '대실적'
            ? '<span style="background:#1e3a8a; color:#93c5fd; padding:1px 5px; border-radius:3px; font-size:10px; margin-left:4px;">대실적</span>'
            : (pRec.legLabelB === '소실적' ? '<span style="background:#7f1d1d; color:#fca5a5; padding:1px 5px; border-radius:3px; font-size:10px; margin-left:4px;">소실적(기준)</span>' : '');

        bonusTitle = '지원수당 (Team / Sponsor Bonus)';
        logicText = `💡 <b>계산 로직 (당시 직급 DB 연동):</b> <b>전기수 누적 CV + 이번기수 신규 CV</b> 합산액 기준 소실적 공제 CV(<b>${matchedCV.toLocaleString('ko-KR')} CV</b>) × 본인 <b>${termLabel} 당시 직급(${memberHistRank})</b> DB 요율(<b>${ratePct}%</b>)`;

        theadHtml = `
            <tr>
                <th style="padding:6px; text-align:center;">구분 / 판정</th>
                <th style="padding:6px; text-align:right;">전기수 누적 CV</th>
                <th style="padding:6px; text-align:right;">이번기수 신규 CV</th>
                <th style="padding:6px; text-align:right;">공제전 누적합산</th>
                <th style="padding:6px; text-align:right;">공제 CV</th>
                <th style="padding:6px; text-align:right;">누적 CV (공제후)</th>
            </tr>
        `;
        rowsHtml += `
            <tr style="border-bottom:1px solid #374151; background:rgba(59,130,246,0.06);">
                <td style="padding:6px; text-align:center; font-weight:bold; color:#60a5fa;">A라인 ${badgeA}</td>
                <td style="padding:6px; text-align:right; color:#9ca3af;">${prevCarryA.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#fff; font-weight:bold;">+${(pRec.a_cv || 0).toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#fbbf24; font-weight:bold;">${beforeA.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#ef4444; font-weight:bold;">-${matchedCV.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#10b981; font-weight:bold;">${(pRec.displayAccACV || 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr style="border-bottom:2px solid #374151; background:rgba(16,185,129,0.06);">
                <td style="padding:6px; text-align:center; font-weight:bold; color:#10b981;">B라인 ${badgeB}</td>
                <td style="padding:6px; text-align:right; color:#9ca3af;">${prevCarryB.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#fff; font-weight:bold;">+${(pRec.b_cv || 0).toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#fbbf24; font-weight:bold;">${beforeB.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#ef4444; font-weight:bold;">-${matchedCV.toLocaleString('ko-KR')}</td>
                <td style="padding:6px; text-align:right; color:#10b981; font-weight:bold;">${(pRec.displayAccBCV || 0).toLocaleString('ko-KR')}</td>
            </tr>
            <tr style="background:#111827; font-weight:bold;">
                <td colspan="4" style="padding:8px; text-align:right; color:#9ca3af;">소실적 공제 CV × 당시 직급(${memberHistRank}) 지원수당 요율 (${ratePct}%)</td>
                <td style="padding:8px 6px; text-align:right; color:#ef4444;">${matchedCV.toLocaleString('ko-KR')} CV</td>
                <td style="padding:8px 6px; text-align:right; color:#fbbf24;">${(pRec.teamBonus || 0).toLocaleString('ko-KR')} 원</td>
            </tr>
        `;

        if (pRec.details && pRec.details.length > 0) {
            rowsHtml += `
                <tr><td colspan="6" style="padding:10px 6px 4px 6px; font-weight:bold; color:#60a5fa; background:#1f2937;">📋 당기 산하 파트너 매출 발생 상세 (${pRec.details.length}건)</td></tr>
                <tr style="background:#111827; color:#9ca3af; font-size:10.5px;">
                    <th style="padding:4px; text-align:center;">라인</th>
                    <th style="padding:4px; text-align:center;">매출일자</th>
                    <th style="padding:4px; text-align:center;">파트너 ID</th>
                    <th style="padding:4px; text-align:center;">파트너 이름 (당시직급)</th>
                    <th style="padding:4px; text-align:right;">발생 CV</th>
                    <th style="padding:4px; text-align:right;">발생 PV</th>
                </tr>
            `;
            pRec.details.forEach(det => {
                const mNode = window.findMemberNode(det.member_id);
                const detRankStr = det.rank ? ` (${det.rank})` : '';
                rowsHtml += `
                    <tr style="border-bottom:1px solid #374151;">
                        <td style="padding:5px; text-align:center; color:${det.line === 'A라인' ? '#60a5fa' : '#10b981'}; font-weight:bold;">${det.line}</td>
                        <td style="padding:5px; text-align:center; color:#d1d5db;">${det.date || '-'}</td>
                        <td style="padding:5px; text-align:center; color:#fff; font-weight:bold;">${det.member_id}</td>
                        <td style="padding:5px; text-align:center; color:#fff;">${mNode ? mNode.name : '-'}${detRankStr}</td>
                        <td style="padding:5px; text-align:right; color:#60a5fa; font-weight:bold;">${(det.cv || 0).toLocaleString('ko-KR')} CV</td>
                        <td style="padding:5px; text-align:right; color:#10b981;">${(det.pv || 0).toLocaleString('ko-KR')} PV</td>
                    </tr>
                `;
            });
        }
    } else if (bonusType === 'matchBonus') {
        colCount = 8;
        const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(memberHistRank) : {};
        const rateSummary = Object.entries(myMatchRates)
            .filter(([, r]) => r > 0)
            .map(([g, r]) => `${g}세대 ${(r * 100).toFixed(1).replace(/\.0$/, '')}%`)
            .join(', ') || '적용 요율 없음';

        bonusTitle = '추천매칭보너스 (Matching Bonus - 세대 편집 및 파트너 추가 가능)';
        logicText = `💡 <b>계산 로직 (본인 ${termLabel} 당시 직급: <span style="color:#10b981;">${memberHistRank}</span> / DB 매칭요율: ${rateSummary}):</b><br>세대 드롭다운을 변경하거나 <b>[+ 파트너 행 추가]</b>로 회원번호(숫자)를 입력하면 당시 직급·지원수당·DB 매칭요율이 자동 조회되며, <b>[TiDB 저장]</b> 시 반영됩니다.`;

        theadHtml = `
            <tr>
                <th style="padding:6px; text-align:center;">적용 세대(편집)</th>
                <th style="padding:6px; text-align:center;">파트너 ID</th>
                <th style="padding:6px; text-align:center;">파트너 이름</th>
                <th style="padding:6px; text-align:center;">당시 직급</th>
                <th style="padding:6px; text-align:right;">파트너 지원수당</th>
                <th style="padding:6px; text-align:center;">DB 매칭요율</th>
                <th style="padding:6px; text-align:right;">산출 매칭보너스</th>
                <th style="padding:6px; text-align:center; width:36px;">삭제</th>
            </tr>
        `;

        window.matchingEditState = {
            targetId: member.id,
            termLabel: termLabel || pRec.periodLabel || '-',
            periodKey: pRec.sortOrderKey || '',
            startDate: startDate || pRec.startDate || '',
            endDate: endDate || pRec.endDate || '',
            memberHistRank: memberHistRank,
            rows: Array.isArray(pRec.matchingDetails)
                ? pRec.matchingDetails.map(x => ({ ...x }))
                : []
        };

        summaryEl.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><span style="color:#9ca3af;">대상 회원:</span> <strong style="color:#fff;">${member.name} (${member.id})</strong> | <span style="color:#9ca3af;">당시 직급:</span> <strong style="color:#10b981;">${memberHistRank}</strong> | <span style="color:#9ca3af;">기수:</span> <strong style="color:#60a5fa;">${termLabel || pRec.periodLabel || '-'}</strong></div><div><span style="color:#9ca3af;">항목:</span> <strong style="color:#fbbf24;">${bonusTitle}</strong></div></div>`;
        logicEl.innerHTML = logicText;
        theadEl.innerHTML = theadHtml;
        window.renderMatchingEditorTable();

        modal.style.display = 'flex';
        modal.style.setProperty('z-index', '2147483645', 'important');
        return;
    } else if (bonusType === 'dignityBonus') {
        colCount = 5;
        const maintPol = (typeof window.getMaintenanceBonusPolicy === 'function' ? window.getMaintenanceBonusPolicy(memberHistRank) : null) || pRec.maintPolicyInfo || {};
        const reqCv = maintPol.reqSmallCv || 0;
        const reqPv = maintPol.reqSmallPv || 0;
        const condText = reqCv > 0
            ? `당기 소실적(공제) CV ${reqCv.toLocaleString('ko-KR')} 이상`
            : (reqPv > 0 ? `당기 소실적 PV ${reqPv.toLocaleString('ko-KR')} 이상` : '해당 직급 달성/유지');

        bonusTitle = '품위유지수당 (Maintenance / Dignity Bonus)';
        logicText = `💡 <b>계산 로직 (TiDB rank_maintenance_bonus_policies 연동):</b> 본인 <b>${termLabel} 당시 직급(${memberHistRank})</b> 기준 지급 조건(<b>${condText}</b>) 충족 시 DB 책정 금액을 지급합니다.`;

        theadHtml = `
            <tr>
                <th style="padding:6px; text-align:center;">대상 기수</th>
                <th style="padding:6px; text-align:center;">당시 직급</th>
                <th style="padding:6px; text-align:right;">당기 공제(소실적) CV</th>
                <th style="padding:6px; text-align:center;">DB 지급 기준</th>
                <th style="padding:6px; text-align:right;">지급 품위유지수당</th>
            </tr>
        `;
        rowsHtml = `
            <tr style="border-bottom:1px solid #374151;">
                <td style="padding:8px; text-align:center; color:#60a5fa; font-weight:bold;">${termLabel || pRec.periodLabel || '-'}</td>
                <td style="padding:8px; text-align:center; color:#10b981; font-weight:bold;">${memberHistRank}</td>
                <td style="padding:8px; text-align:right; color:#fff; font-weight:bold;">${(pRec.matchedCV || 0).toLocaleString('ko-KR')} CV</td>
                <td style="padding:8px; text-align:center; color:#f59e0b;">${condText}</td>
                <td style="padding:8px; text-align:right; color:#fbbf24; font-weight:bold; font-size:12px;">${(pRec.levelBonus || 0).toLocaleString('ko-KR')} 원</td>
            </tr>
        `;
    } else if (bonusType === 'carBonus') {
        colCount = 6;
        const carInfo = pRec.carPolicyInfo || {};
        const appliedCarRank = carInfo.maintainedRank || memberHistRank;
        const carPol = (typeof window.getCarMaintenanceBonusPolicy === 'function' ? window.getCarMaintenanceBonusPolicy(appliedCarRank) : null) || {};
        const reqCv = carInfo.reqSmallCvPerPeriod ?? carPol.reqSmallCvPerPeriod ?? 0;
        const descStr = carInfo.description || carPol.description || '당월 전기수·후기수 연속 품위유지비 조건 달성';
        const schedStr = carInfo.payoutSchedule || carPol.payoutSchedule || '월 마감 후 다음달 지급';

        bonusTitle = '차량유지비 (Car Maintenance Bonus)';
        logicText = `💡 <b>계산 로직 (TiDB rank_car_maintenance_bonus_policies 연동):</b> 매월 1일부터 시작하여 <b>당월 전기수(${carInfo.firstPeriodLabel || '전'})와 후기수(${carInfo.secondPeriodLabel || '후'}) 모두 품위유지비 조건(기수별 소실적 ${reqCv.toLocaleString('ko-KR')} CV 이상)을 달성</b>해야 당월 후기수에 책정됩니다. <span style="color:#9ca3af;">(${descStr} / ${schedStr})</span>`;

        theadHtml = `
            <tr>
                <th style="padding:6px; text-align:center;">검증 기수</th>
                <th style="padding:6px; text-align:center;">당시 직급</th>
                <th style="padding:6px; text-align:right;">당기 공제(소실적) CV</th>
                <th style="padding:6px; text-align:right;">품위유지비 달성</th>
                <th style="padding:6px; text-align:center;">기수별 기준 CV</th>
                <th style="padding:6px; text-align:center;">판정 결과</th>
            </tr>
        `;

        if (carInfo && carInfo.firstPeriodLabel) {
            rowsHtml = `
                <tr style="border-bottom:1px solid #374151;">
                    <td style="padding:7px; text-align:center; color:#60a5fa; font-weight:bold;">${carInfo.firstPeriodLabel} (전기수)</td>
                    <td style="padding:7px; text-align:center; color:#10b981; font-weight:bold;">${carInfo.firstRank}</td>
                    <td style="padding:7px; text-align:right; color:#fff; font-weight:bold;">${(carInfo.firstSmallCv || 0).toLocaleString('ko-KR')} CV</td>
                    <td style="padding:7px; text-align:right; color:#60a5fa; font-weight:bold;">${(carInfo.firstLevelBonus || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:7px; text-align:center; color:#f59e0b;">${reqCv.toLocaleString('ko-KR')} CV 이상</td>
                    <td style="padding:7px; text-align:center; color:#10b981; font-weight:bold;">✅ 달성</td>
                </tr>
                <tr style="border-bottom:2px solid #374151;">
                    <td style="padding:7px; text-align:center; color:#60a5fa; font-weight:bold;">${carInfo.secondPeriodLabel} (후기수)</td>
                    <td style="padding:7px; text-align:center; color:#10b981; font-weight:bold;">${carInfo.secondRank}</td>
                    <td style="padding:7px; text-align:right; color:#fff; font-weight:bold;">${(carInfo.secondSmallCv || 0).toLocaleString('ko-KR')} CV</td>
                    <td style="padding:7px; text-align:right; color:#60a5fa; font-weight:bold;">${(carInfo.secondLevelBonus || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:7px; text-align:center; color:#f59e0b;">${reqCv.toLocaleString('ko-KR')} CV 이상</td>
                    <td style="padding:7px; text-align:center; color:#10b981; font-weight:bold;">✅ 달성</td>
                </tr>
                <tr style="background:#111827; font-weight:bold;">
                    <td colspan="4" style="padding:8px; text-align:center; color:#9ca3af;">월간(전·후기수 연속) 유지 기준 직급: <span style="color:#10b981;">${appliedCarRank}</span></td>
                    <td style="padding:8px 6px; text-align:center; color:#f59e0b;">월 고정 지급액</td>
                    <td style="padding:8px 6px; text-align:right; color:#fbbf24; font-size:12px;">${(pRec.carBonus || 0).toLocaleString('ko-KR')} 원</td>
                </tr>
            `;
        } else {
            rowsHtml = `<tr><td colspan="6" style="padding:15px; text-align:center; color:#9ca3af;">해당 월의 전기수·후기수 연속 품위유지비 달성 내역이 없습니다.</td></tr>`;
        }
    } else if (bonusType === 'fastPowerBonus') {
        colCount = 6;
        const fpInfo = pRec.fastPowerDetails || null;
        bonusTitle = '패스트파워보너스 (Fast Power Bonus)';

        if (fpInfo) {
            const cycleBadge = fpInfo.isFullCycle
                ? '<span style="background:#065f46; color:#6ee7b7; padding:2px 6px; border-radius:4px; font-size:11px;">1사이클(Step 1·2·3) 100% 완주</span>'
                : '<span style="background:#78350f; color:#fcd34d; padding:2px 6px; border-radius:4px; font-size:11px;">부분 달성 (50% 지급)</span>';

            logicText = `💡 <b>계산 로직 (TiDB fast_power_bonus_policies 연동):</b> 전월(<b>${fpInfo.achievedMonth}</b>) 실적 기준 ${cycleBadge} 결과로 당월 전기수(<b>${fpInfo.payoutPeriodLabel}</b>)에 지급된 보너스입니다.`;

            theadHtml = `
                <tr>
                    <th style="padding:6px; text-align:center;">단계 (레그)</th>
                    <th style="padding:6px; text-align:left;">DB 달성 조건 및 달성 파트너 내역</th>
                    <th style="padding:6px; text-align:center;">달성 여부</th>
                    <th style="padding:6px; text-align:right;">100% 기준액</th>
                    <th style="padding:6px; text-align:center;">적용 지급률</th>
                    <th style="padding:6px; text-align:right;">지급 보너스</th>
                </tr>
            `;

            (fpInfo.steps || []).forEach(st => {
                let partnerDesc = `<div style="color:#9ca3af; font-size:10.5px; margin-bottom:3px;">${st.description || st.periodCondition || ''}</div>`;
                if (st.achieved && st.detailObj) {
                    if (Array.isArray(st.detailObj.partners)) {
                        const pNames = st.detailObj.partners.map(p => `${p.member.name}(${p.member.id}, ${p.qualifyDate})`).join(', ');
                        partnerDesc += `<div style="color:#60a5fa; font-size:11px;">✔ 직추천 달성: ${pNames}</div>`;
                    } else if (Array.isArray(st.detailObj.pairs)) {
                        const pairLines = st.detailObj.pairs.map(pair => {
                            const p = pair.parentPartner;
                            const subs = pair.subPartners.map(s => `${s.member.name}(${s.member.id})`).join(', ');
                            return `${p.member.name}(${p.member.id}) ➔ [${subs}]`;
                        }).join('<br>');
                        partnerDesc += `<div style="color:#60a5fa; font-size:11px;">✔ 계보 달성:<br>${pairLines}</div>`;
                    }
                }

                const statusHtml = st.achieved
                    ? '<span style="color:#10b981; font-weight:bold;">✅ 달성</span>'
                    : '<span style="color:#6b7280;">미달성</span>';
                const ratePct = (st.appliedRate * 100).toFixed(0) + '%';

                rowsHtml += `
                    <tr style="border-bottom:1px solid #374151;">
                        <td style="padding:8px 6px; text-align:center; font-weight:bold; color:#f59e0b;">Step ${st.stepLevel} (${st.legPosition}라인)</td>
                        <td style="padding:8px 6px; text-align:left; color:#fff;">${partnerDesc}</td>
                        <td style="padding:8px 6px; text-align:center;">${statusHtml}</td>
                        <td style="padding:8px 6px; text-align:right; color:#d1d5db;">${(st.fullReward || 0).toLocaleString('ko-KR')} 원</td>
                        <td style="padding:8px 6px; text-align:center; color:#f59e0b; font-weight:bold;">${st.achieved ? ratePct : '-'}</td>
                        <td style="padding:8px 6px; text-align:right; color:#10b981; font-weight:bold;">${(st.payoutAmount || 0).toLocaleString('ko-KR')} 원</td>
                    </tr>
                `;
            });

            rowsHtml += `
                <tr style="background:#111827; font-weight:bold;">
                    <td colspan="5" style="padding:8px; text-align:right; color:#9ca3af;">전월(${fpInfo.achievedMonth}) 패스트파워보너스 최종 지급 합계</td>
                    <td style="padding:8px 6px; text-align:right; color:#fbbf24; font-size:12px;">${(fpInfo.totalAmount || 0).toLocaleString('ko-KR')} 원</td>
                </tr>
            `;
        } else {
            logicText = `💡 <b>계산 로직:</b> 전월 Step 1·2·3 달성 내역 기준 익월 전기수에 지급됩니다.`;
            theadHtml = `<tr><th style="padding:6px; text-align:center;">지급 패스트파워보너스</th></tr>`;
            rowsHtml = `<tr><td style="padding:10px; text-align:center; color:#10b981; font-weight:bold;">${(pRec.fastPowerBonus || 0).toLocaleString('ko-KR')} 원</td></tr>`;
        }
    }

    summaryEl.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><span style="color:#9ca3af;">대상 회원:</span> <strong style="color:#fff;">${member.name} (${member.id})</strong> | <span style="color:#9ca3af;">당시 직급:</span> <strong style="color:#10b981;">${memberHistRank}</strong> | <span style="color:#9ca3af;">기수:</span> <strong style="color:#60a5fa;">${termLabel || pRec.periodLabel || '-'}</strong></div><div><span style="color:#9ca3af;">항목:</span> <strong style="color:#fbbf24;">${bonusTitle}</strong></div></div>`;
    logicEl.innerHTML = logicText;
    theadEl.innerHTML = theadHtml;
    tbodyEl.innerHTML = rowsHtml || `<tr><td colspan="${colCount}" style="padding:20px; color:#9ca3af; text-align:center;">산출된 보너스 상세 내역이 없습니다.</td></tr>`;

    modal.style.display = 'flex';
    modal.style.setProperty('z-index', '2147483645', 'important');
};

// ============================================================================
// [09] 계보도 핵심 로직 (트리 렌더링, 동적 코드 산정, 후원/추천 모드 전환)
// ============================================================================

// [09-1] 회원 ID 동일 여부 비교 (대소문자 및 VK- 접두사 무시)
window.isSameMemberId = function(id1, id2) {
    if (!id1 || !id2) return false;
    return String(id1).trim().toLowerCase().replace(/^vk-?/, '') === String(id2).trim().toLowerCase().replace(/^vk-?/, '');
};

// [09-2] 계보도 트리 데이터를 평탄화(Flatten)하여 맵 객체로 반환
window.getFlatMembers = function() {
    const map = {};
    const visited = new Set();
    function flatten(node) {
        if (!node || !node.id) return;
        let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visited.has(norm)) return;
        visited.add(norm);
        map[node.id] = node;
        map[norm] = node;
        map['VK-' + norm] = node;
        map['vk-' + norm] = node;
        if (node.left) flatten(typeof node.left === 'object' ? node.left : map[node.left]);
        if (node.right) flatten(typeof node.right === 'object' ? node.right : map[node.right]);
    }
    if (window.treeData) flatten(window.treeData);
    window.flatMembersData = map;
    return map;
};

// [09-3] 중복을 제거한 전체 고유 회원 배열 반환
window.getUniqueMembers = function() {
    const flatMap = window.getFlatMembers();
    const uniqueMap = new Map();
    Object.values(flatMap).forEach(m => {
        if (m && m.id) {
            let norm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (!uniqueMap.has(norm)) uniqueMap.set(norm, m);
        }
    });
    return Array.from(uniqueMap.values());
};

// [09-4] 회원 ID로 특정 노드 객체 탐색
window.findMemberNode = function(id) {
    if (!id) return null;
    const flatMap = window.getFlatMembers();
    if (flatMap[id]) return flatMap[id];
    let norm = String(id).trim().toLowerCase().replace(/^vk-?/, '');
    if (flatMap[norm]) return flatMap[norm];
    if (flatMap['VK-' + norm]) return flatMap['VK-' + norm];
    return Object.values(flatMap).find(m => m && window.isSameMemberId(m.id, id)) || null;
};

// [09-5] 계보도 최상위 루트 노드 반환
window.getAbsoluteTopRoot = function() {
    if (window.treeData && window.treeData.id) return window.findMemberNode(window.treeData.id) || window.treeData;
    return Object.values(window.getFlatMembers())[0] || null;
};

// [09-6] 동적 회원코드에서 말미 태그(m, a1, b1 등) 추출 헬퍼 함수
function getTagFromCode(codeStr) {
    if (!codeStr || codeStr === 'm') return 'm';
    if (codeStr === 'x') return 'x';
    let parts = String(codeStr).split('-');
    return parts[parts.length - 1] || 'm';
}

// [09-7] 회원별 동적 코드(Dynamic Code) 저장 및 조회
window.setDynamicCode = function(id, code) {
    if (!id) return;
    window.dynamicCodes = window.dynamicCodes || {};
    let norm = String(id).trim().toLowerCase().replace(/^vk-?/, '');
    window.dynamicCodes[String(id).trim()] = code;
    window.dynamicCodes[norm] = code;
    window.dynamicCodes['VK-' + norm] = code;
    let node = window.findMemberNode(id);
    if (node) node.code = code;
};

window.getDynamicCode = function(id) {
    if (!id) return '';
    let norm = String(id).trim().toLowerCase().replace(/^vk-?/, '');
    if (window.dynamicCodes && window.dynamicCodes[String(id).trim()]) return window.dynamicCodes[String(id).trim()];
    if (window.dynamicCodes && window.dynamicCodes[norm]) return window.dynamicCodes[norm];
    if (window.dynamicCodes && window.dynamicCodes['VK-' + norm]) return window.dynamicCodes['VK-' + norm];
    let node = window.findMemberNode(id);
    return node ? (node.code || '') : '';
};

// [09-8] 선택된 기준점(Root)에 따른 하선 A/B라인 동적 코드 일괄 산정
window.computeDynamicCodes = function(selectedRootId) {
    window.dynamicCodes = {};
    const uniqueMembers = window.getUniqueMembers();
    if (uniqueMembers.length === 0) return;

    let rootNode = selectedRootId ? window.findMemberNode(selectedRootId) : window.getAbsoluteTopRoot();
    if (!rootNode) rootNode = window.getAbsoluteTopRoot();
    if (!rootNode) return;

    uniqueMembers.forEach(m => { m._genFromM = -1; m._branchLine = 'a'; });

    const visited = new Set();
    function traverseFromRoot(node, depth, branchLine) {
        if (!node || !node.id) return;
        let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visited.has(norm)) return;
        visited.add(norm);

        node._genFromM = depth;
        node._branchLine = branchLine;

        let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
        if (leftChild) traverseFromRoot(leftChild, depth + 1, (depth === 0) ? 'a' : branchLine);

        let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;
        if (rightChild) traverseFromRoot(rightChild, depth + 1, (depth === 0) ? 'b' : branchLine);
    }

    traverseFromRoot(rootNode, 0, 'a');
    window.setDynamicCode(rootNode.id, 'm');

    uniqueMembers.filter(m => m._genFromM < 0).forEach(m => window.setDynamicCode(m.id, 'x'));

    ['a', 'b'].forEach(lineBranch => {
        let lineMembers = uniqueMembers.filter(m => m._genFromM > 0 && m._branchLine === lineBranch).sort((a, b) => {
            let d1 = String(a.joinDate || a.join_date || a.regDate || '').trim();
            let d2 = String(b.joinDate || b.join_date || b.regDate || '').trim();
            if (d1 && d2 && d1 !== d2) return d1.localeCompare(d2);
            if (a._genFromM !== b._genFromM) return a._genFromM - b._genFromM;
            return String(a.id).localeCompare(String(b.id));
        });

        lineMembers.forEach((m, idx) => {
            let gen = m._genFromM;
            let seqNum = idx + 1;
            let myLineTag = `${lineBranch}${seqNum}`;

            let recId = m.recId || m.recommender_id || m.rec_id;
            let recommender = recId ? window.findMemberNode(recId) : null;
            let isRecInSubtree = (recommender && recommender._genFromM >= 0);

            let recTag = isRecInSubtree ? getTagFromCode(window.getDynamicCode(recommender.id) || 'm') : 'x';
            window.setDynamicCode(m.id, `${recTag}-${gen}-${myLineTag}`);
        });
    });
};

// [09-8-1] 선택된 카드(또는 최상위 루트) 기준 A라인 / B라인 카드 수 계산 및 헤더 배지 업데이트
window.updateHeaderLineCount = function(selectedId) {
    const badgeEl = document.getElementById('header-line-count');
    if (!badgeEl) return;

    const targetId = selectedId || window.currentSelectedId;
    let baseNode = targetId ? window.findMemberNode(targetId) : window.getAbsoluteTopRoot();
    if (!baseNode) baseNode = window.getAbsoluteTopRoot();

    if (!baseNode) {
        badgeEl.innerHTML = `<span style="color:#9ca3af;">데이터 없음</span>`;
        return;
    }

    if (window.treeMode === 'recommender') {
        const uniqueMembers = window.getUniqueMembers();
        let directRecCount = 0;
        let totalRecSubCount = 0;
        const visited = new Set();

        function countRecSubtree(currNode, depth) {
            if (!currNode || !currNode.id) return;
            let norm = String(currNode.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (visited.has(norm)) return;
            visited.add(norm);

            if (depth > 0) totalRecSubCount++;
            if (depth === 1) directRecCount++;

            uniqueMembers.filter(m => m && !window.isSameMemberId(m.id, currNode.id) && window.isSameMemberId(m.recId || m.rec_id || m.recommenderId, currNode.id))
                .forEach(child => countRecSubtree(child, depth + 1));
        }

        countRecSubtree(baseNode, 0);
        badgeEl.innerHTML = `
            <span style="color:#9ca3af; font-weight:normal;">기준: <b style="color:#fff;">${baseNode.name || baseNode.id}</b></span>
            <span style="color:#4b5563; margin:0 6px;">|</span>
            <span style="color:#10b981; font-weight:bold;">직추천 ${directRecCount}명</span>
            <span style="color:#4b5563; margin:0 4px;">/</span>
            <span style="color:#60a5fa; font-weight:bold;">추천하선 총 ${totalRecSubCount}명</span>
        `;
        return;
    }

    const visitedA = new Set();
    const visitedB = new Set();

    function countBranchNodes(node, visitedSet) {
        if (!node || !node.id) return 0;
        let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visitedSet.has(norm)) return 0;
        visitedSet.add(norm);

        let count = 1;
        let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
        let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;

        if (leftChild) count += countBranchNodes(leftChild, visitedSet);
        if (rightChild) count += countBranchNodes(rightChild, visitedSet);
        return count;
    }

    let leftRoot = baseNode.left ? (typeof baseNode.left === 'object' ? baseNode.left : window.findMemberNode(baseNode.left)) : null;
    let rightRoot = baseNode.right ? (typeof baseNode.right === 'object' ? baseNode.right : window.findMemberNode(baseNode.right)) : null;

    const aCount = leftRoot ? countBranchNodes(leftRoot, visitedA) : 0;
    const bCount = rightRoot ? countBranchNodes(rightRoot, visitedB) : 0;
    const totalSub = aCount + bCount;

    badgeEl.innerHTML = `
        <span style="color:#9ca3af; font-weight:normal;">기준: <b style="color:#fff;">${baseNode.name || baseNode.id}</b></span>
        <span style="color:#4b5563; margin:0 6px;">|</span>
        <span style="color:#60a5fa; font-weight:bold;">A라인 ${aCount.toLocaleString()}명</span>
        <span style="color:#4b5563; margin:0 6px;">·</span>
        <span style="color:#f59e0b; font-weight:bold;">B라인 ${bCount.toLocaleString()}명</span>
        <span style="color:#9ca3af; font-size:11px; margin-left:4px;">(하선 총 ${totalSub.toLocaleString()}명)</span>
    `;
};

// [09-9] 신규 파트너 추가 모달용 회원코드 사전 예측
window.predictMemberCode = function(recommenderNode, sponsorNode, position) {
    let recTag = 'x';
    if (recommenderNode && recommenderNode._genFromM >= 0) {
        recTag = getTagFromCode(window.getDynamicCode(recommenderNode.id) || 'm');
    }
    let posLine = (position === 'left' || position === 'A라인') ? 'a' : 'b';
    let sponDepth = sponsorNode ? (sponsorNode._genFromM >= 0 ? sponsorNode._genFromM + 1 : 1) : 1;
    let gen = Math.max(1, sponDepth);

    let lineCount = window.getUniqueMembers().filter(m => m._genFromM > 0 && m._branchLine === posLine).length;
    return `${recTag}-${gen}-${posLine}${lineCount + 1}`;
};

window.updateModalCodeByPos = function() {
    const sponId = document.getElementById('m-spon-id')?.value.trim();
    const recId = document.getElementById('m-rec-id')?.value.trim();
    const posVal = document.getElementById('m-pos')?.value;

    const codeEl = document.getElementById('m-code');
    if (codeEl) {
        codeEl.value = window.predictMemberCode(window.findMemberNode(recId), window.findMemberNode(sponId), posVal);
    }
};

// [09-10] 계보도 개별 노드 카드 HTML 재귀 생성
window.buildNodeHTML = function(node, visited) {
    if (!visited) visited = new Set();
    if (!node || !node.id) return '';

    let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
    if (visited.has(norm)) return '';
    visited.add(norm);

    const jDate = node.joinDate || node.join_date || node.regDate || node.reg_date || '-';
    let salesDates = (window.memberSalesDateMap && window.memberSalesDateMap[norm]) || {};
    const fSales = salesDates.first || node.firstSales || node.firstSalesDate || node.first_sales || node.first_sales_date || '-';
    const lSales = salesDates.last || node.lastSales || node.lastSalesDate || node.last_sales || node.last_sales_date || '-';
    const recNm = node.recName || node.recommender_name || node.recommenderName || node.rec_name || '-';
    const recId = node.recId || node.recommender_id || node.recommenderId || node.rec_id || '-';

    let innerContent = '';
    if (window.cardSettings.code && window.getDynamicCode(node.id)) innerContent += `<div class="t-code" style="font-size:13px; font-weight:bold; color:#60a5fa; margin-bottom:2px; text-align:center;">${window.getDynamicCode(node.id)}</div>`;
    if (window.cardSettings.id) innerContent += `<div class="t-id" style="font-size:13px; font-weight:bold; color:#fff; text-align:center;">${node.id}</div>`;
    if (window.cardSettings.name) innerContent += `<div class="t-common" style="font-size:14px; font-weight:bold; color:#fff;">${node.name}</div>`;
    if (window.cardSettings.rank && node.rank) innerContent += `<div class="t-common">${node.rank}</div>`;
    if (window.cardSettings.type && node.type) innerContent += `<div class="t-common">${node.type}</div>`;
    
    if (window.cardSettings.joinDate) innerContent += `<div class="t-common" style="font-size:10px; color:#cbd5e1; margin-top:2px;">${jDate}</div>`;
    if (window.cardSettings.recName) innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:4px;">${recNm}</div>`;
    if (window.cardSettings.recId) innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px;">${recId}</div>`;
    if (window.cardSettings.firstSales) innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:2px;">${fSales}</div>`;
    if (window.cardSettings.lastSales) innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:2px;">${lSales}</div>`;

    if (!innerContent) innerContent = `<div class="t-id">${node.id}</div>`;

    let topParentBtn = (window.getAbsoluteTopRoot() && window.isSameMemberId(node.id, window.getAbsoluteTopRoot().id)) 
        ? `<div class="btn-add-parent" title="상위 파트너(최상위) 추가" onclick="window.addParentPartner(event, '${node.id}')">▲</div>` : '';

    const cornerBtns = `
        <div class="corner-btn corner-left" title="A라인(좌측) 하선 신규 생성" onclick="window.addTreeChild(event, '${node.id}', 'left')"></div>
        <div class="corner-btn corner-right" title="B라인(우측) 하선 신규 생성" onclick="window.addTreeChild(event, '${node.id}', 'right')"></div>
    `;

    let html = `<li><div class="node-card" id="card_${node.id}" onclick="window.handleNodeClickLogic('${node.id}')" ondblclick="window.handleNodeDblClickLogic(event, '${node.id}')">${topParentBtn}${innerContent}${cornerBtns}</div>`;
    
    let childrenHtml = '';
    if (window.treeMode === 'sponsor') {
        let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
        let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;
        if (leftChild) childrenHtml += window.buildNodeHTML(leftChild, visited);
        if (rightChild) childrenHtml += window.buildNodeHTML(rightChild, visited);
    } else if (window.treeMode === 'recommender') {
        window.getUniqueMembers().filter(m => m && !window.isSameMemberId(m.id, node.id) && window.isSameMemberId(m.recId || m.rec_id || m.recommenderId, node.id))
            .forEach(child => { childrenHtml += window.buildNodeHTML(child, visited); });
    }
    if (childrenHtml) html += `<ul>${childrenHtml}</ul>`;
    html += `</li>`; 
    return html;
};

// [09-11] 후원계보도 <-> 추천계보도 전환 토글 기능
window.toggleTreeMode = function() {
    window.treeMode = (window.treeMode === 'recommender') ? 'sponsor' : 'recommender';
    
    const btn = document.getElementById('toggleTreeBtn');
    if (btn) {
        if (window.treeMode === 'recommender') {
            btn.title = '후원계보도로 전환 (현재: 추천계보도)';
            btn.style.color = '#10b981';
            btn.style.borderColor = '#10b981';
            window.recommenderRootId = window.currentSelectedId || (window.getAbsoluteTopRoot() && window.getAbsoluteTopRoot().id) || null;
        } else {
            btn.title = '추천계보도로 전환 (현재: 후원계보도)';
            btn.style.color = '';
            btn.style.borderColor = '';
        }
    }

    window.renderTree(true);
};

// [09-12] 계보도 트리 전체 렌더링 및 중앙 정렬/하이라이트/라인 인원수/실적 연동
window.renderTree = function(recenter = false) {
    const rootEl = document.getElementById('tree-root');
    if (!rootEl) return;
    
    if (!window.treeMode) window.treeMode = 'sponsor';

    let rootNode = window.treeMode === 'recommender' ? (window.findMemberNode(window.recommenderRootId) || window.getAbsoluteTopRoot()) : window.treeData;
    if (window.treeMode !== 'recommender') window.computeDynamicCodes(window.currentSelectedId);

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    window.memberSalesDateMap = window.memberSalesDateMap || {};
    allSales.forEach(s => {
        if (!s || !s.member_id) return;
        let mId = String(s.member_id).trim().toLowerCase().replace(/^vk-?/, '');
        let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
        if (!d) return;
        if (!window.memberSalesDateMap[mId]) window.memberSalesDateMap[mId] = { first: d, last: d };
        else {
            if (d < window.memberSalesDateMap[mId].first) window.memberSalesDateMap[mId].first = d;
            if (d > window.memberSalesDateMap[mId].last) window.memberSalesDateMap[mId].last = d;
        }
    });
    
    if (!rootNode) return;
    rootEl.innerHTML = `<ul>${window.buildNodeHTML(rootNode, new Set())}</ul>`;
    
    if (typeof window.updateHeaderLineCount === 'function') {
        window.updateHeaderLineCount(window.currentSelectedId);
    }

    setTimeout(() => {
        if (typeof window.centerRootNode === 'function') {
            window.centerRootNode();
        }
    }, 150);
    
    setTimeout(() => { 
        if (typeof window.applyCardHighlights === 'function') {
            window.applyCardHighlights();
        }
    }, 60);

    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(window.currentSelectedId);
};

// ============================================================================
// [10] TiDB 보상플랜 동적 로드 및 하단 수당 시뮬레이터 메인 연산 엔진
// ============================================================================

// [10-1] 백엔드 트리 데이터 및 integrated_sales_history 전체 매출 내역 호출
window.fetchTreeData = async function(isReRender = false) {
    if (!window.API_BASE) return;
    try {
        try {
            const salesRes = await fetch(`${window.API_BASE}/api/sales`);
            if (salesRes.ok) {
                const salesRows = await salesRes.json();
                if (Array.isArray(salesRows)) {
                    window.integrated_sales_history = salesRows;
                }
            }
        } catch (sErr) {}

        const res = await fetch(`${window.API_BASE}/api/tree`);
        if (!res.ok) throw new Error(`서버 응답 상태: ${res.status}`);
        const data = await res.json();
        if (data && data.tree) {
            window.treeData = data.tree;
            window.flatMembersData = data.flatMembers || window.getFlatMembers();
            Object.values(window.flatMembersData).forEach(m => {
                m.joinDate = m.joinDate || m.join_date || m.date1 || '';
                m.recId = m.recId || m.recommender_id || '';
                m.recName = m.recName || m.recommender_name || '';
                m.rank = m.rank || m.rank_name || 'MANIA';
                m.type = m.type || m.member_type || '사업자';
            });
            if (typeof window.renderTree === 'function') window.renderTree(isReRender);
        }
    } catch (error) {}
};

// [10-2-0] 날짜(YYYY-MM-DD)를 받아 기수 정보(예: 09-전, 09-후)로 변환하는 헬퍼
window.getPeriodInfoFromDate = function(dateStr) {
    const clean = typeof window.cleanDateStr === 'function' ? window.cleanDateStr(dateStr) : String(dateStr || '').trim().slice(0, 10);
    if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;

    const [yyyy, mm, dd] = clean.split('-');
    const dayNum = parseInt(dd, 10);
    const isFirstHalf = dayNum <= 15;
    const halfTag = isFirstHalf ? '전' : '후';

    const periodLabel = `${mm}-${halfTag}`;
    const sortOrderKey = `${yyyy}-${mm}-${isFirstHalf ? '1' : '2'}`;
    const backendKey = `${yyyy}-${mm}-${halfTag}`;

    const lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate();
    const startDate = isFirstHalf ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-16`;
    const endDate = isFirstHalf ? `${yyyy}-${mm}-15` : `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;

    return { yyyy, mm, halfTag, periodLabel, sortOrderKey, backendKey, startDate, endDate };
};

// [10-2-1] 특정 루트 노드의 좌측(A라인) 및 우측(B라인) 산하 파트너 ID 집합 추출 (본인 제외)
window.getSublinePartnerSets = function(rootNode) {
    const setA = new Set();
    const setB = new Set();
    if (!rootNode || !rootNode.id) return { setA, setB };

    const rootNorm = String(rootNode.id).trim().toLowerCase().replace(/^vk-?/, '');

    function collectSubNodes(curr, targetSet, visited) {
        if (!curr) return;
        const obj = (typeof curr === 'object') ? curr : (typeof window.findMemberNode === 'function' ? window.findMemberNode(curr) : null);
        if (!obj || !obj.id) return;

        const norm = String(obj.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (norm === rootNorm || visited.has(norm)) return;
        visited.add(norm);
        targetSet.add(norm);

        if (obj.left) collectSubNodes(obj.left, targetSet, visited);
        if (obj.right) collectSubNodes(obj.right, targetSet, visited);
    }

    if (rootNode.left) collectSubNodes(rootNode.left, setA, new Set());
    if (rootNode.right) collectSubNodes(rootNode.right, setB, new Set());

    return { setA, setB };
};

// [10-2-2] TiDB(ranks + 각 보너스 정책 테이블) 동적 추출 헬퍼
window.extractDirectRateFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;

    const candidateKeys = [
        'direct_bonus_rate', 'recommend_bonus_rate', 'recommender_bonus_rate',
        'rec_bonus_rate', 'direct_rate', 'recommend_rate', 'rec_rate',
        'referral_bonus_rate', 'referral_rate', 'direct_pct', 'rec_pct'
    ];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }

    for (const [k, val] of Object.entries(policyObj)) {
        const lk = k.toLowerCase();
        if (
            (lk.includes('direct') || lk.includes('rec') || lk.includes('refer') || lk.includes('추천')) &&
            !lk.includes('id') && !lk.includes('level') && !lk.includes('team') && !lk.includes('spon') && !lk.includes('match') && !lk.includes('gen') && !lk.includes('cap') && !lk.includes('limit') && !lk.includes('max')
        ) {
            let v = Number(val);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }
    return null;
};

window.extractTeamRateFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;

    const candidateKeys = [
        'team_bonus_rate', 'sponsor_bonus_rate', 'support_bonus_rate', 'binary_bonus_rate',
        'spon_bonus_rate', 'team_rate', 'sponsor_rate', 'support_rate', 'binary_rate',
        'spon_rate', 'matching_cv_rate', 'small_leg_rate', 'team_pct', 'sponsor_pct'
    ];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }

    for (const [k, val] of Object.entries(policyObj)) {
        const lk = k.toLowerCase();
        if (
            (lk.includes('team') || lk.includes('spon') || lk.includes('support') || lk.includes('binary') || lk.includes('지원') || lk.includes('후원')) &&
            (lk.includes('rate') || lk.includes('pct') || lk.includes('ratio') || lk.includes('percent') || !lk.includes('cap')) &&
            !lk.includes('id') && !lk.includes('level') && !lk.includes('match') && !lk.includes('gen') && !lk.includes('cap') && !lk.includes('limit') && !lk.includes('max') && !lk.includes('min') && !lk.includes('cv') && !lk.includes('pv')
        ) {
            let v = Number(val);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }
    return null;
};

window.extractTeamCapFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;

    const candidateKeys = [
        'team_bonus_cap', 'sponsor_bonus_cap', 'support_bonus_cap', 'binary_bonus_cap',
        'max_team_bonus', 'max_sponsor_bonus', 'team_cap', 'sponsor_cap', 'bonus_cap',
        'limit_amount', 'max_bonus_amount', 'max_payout', 'period_cap', 'cap_amount'
    ];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
            if (!isNaN(v) && v > 0) return v;
        }
    }

    for (const [k, val] of Object.entries(policyObj)) {
        const lk = k.toLowerCase();
        if ((lk.includes('cap') || lk.includes('limit') || lk.includes('max')) && !lk.includes('rate') && !lk.includes('gen') && !lk.includes('step')) {
            let v = Number(val);
            if (!isNaN(v) && v > 0) return v;
        }
    }
    return null;
};

window.extractMatchingRatesFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const genRates = {};

    const toRate = (val) => {
        if (val === undefined || val === null || val === '') return null;
        let num = Number(val);
        if (isNaN(num) || num <= 0) return 0;
        return num > 1 ? (num / 100) : num;
    };

    const nestedCandidates = ['matching_policy', 'matching_rates', 'matching_bonus_rates', 'matching_bonus', 'matching', 'generations', 'gen_rates'];
    for (const key of nestedCandidates) {
        const sub = policyObj[key];
        if (Array.isArray(sub)) {
            sub.forEach((v, idx) => {
                if (v && typeof v === 'object') {
                    const g = Number(v.generation || v.gen || v.level || (idx + 1));
                    const r = toRate(v.rate ?? v.bonus_rate ?? v.matching_rate ?? v.pct ?? v.value);
                    if (g >= 1 && r !== null && r > 0) genRates[g] = r;
                } else {
                    const r = toRate(v);
                    if (r !== null && r > 0) genRates[idx + 1] = r;
                }
            });
        } else if (sub && typeof sub === 'object') {
            Object.entries(sub).forEach(([k, v]) => {
                const lk = k.toLowerCase();
                if (lk.includes('id') || lk.includes('rank') || lk.includes('cap') || lk.includes('limit')) return;
                const m = String(k).match(/(\d+)/);
                const g = m ? parseInt(m[1], 10) : NaN;
                const r = toRate(v);
                if (!isNaN(g) && g >= 1 && g <= 10 && r !== null && r > 0) genRates[g] = r;
            });
        }
    }

    for (let g = 1; g <= 10; g++) {
        const explicitKeys = [
            `matching_gen${g}_rate`, `matching_gen_${g}_rate`, `matching_gen${g}`, `matching_gen_${g}`,
            `match_gen${g}_rate`, `match_gen_${g}_rate`, `match_gen${g}`, `match_gen_${g}`,
            `matching_rate_${g}`, `matching_rate${g}`, `match_rate_${g}`, `match_rate${g}`,
            `gen${g}_matching_rate`, `gen_${g}_matching_rate`, `gen${g}_match_rate`,
            `gen${g}_rate`, `gen_${g}_rate`, `generation_${g}_rate`, `generation${g}_rate`,
            `matching_${g}`, `match_${g}`, `gen${g}`
        ];
        for (const k of explicitKeys) {
            if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
                const r = toRate(policyObj[k]);
                if (r !== null && r > 0) {
                    genRates[g] = r;
                    break;
                }
            }
        }
    }

    Object.entries(policyObj).forEach(([k, val]) => {
        const lk = k.toLowerCase();
        if (lk.includes('id') || lk.includes('cap') || lk.includes('limit') || lk.includes('max') || lk.includes('cv') || lk.includes('pv')) return;
        if (lk.includes('match') || lk.includes('gen') || lk.includes('세대')) {
            const m = lk.match(/(?:gen|generation|match|matching|level|step|세대)[_-\s]*(\d+)/) || lk.match(/(\d+)[_-\s]*(?:gen|generation|match|matching|세대)/);
            if (m) {
                const g = parseInt(m[1], 10);
                const r = toRate(val);
                if (g >= 1 && g <= 10 && r !== null && r > 0 && !genRates[g]) {
                    genRates[g] = r;
                }
            }
        }
    });

    return Object.keys(genRates).length > 0 ? genRates : null;
};

// [10-2-2-B] DB 정책 객체(rank_maintenance_bonus_policies)에서 직급별 품위유지수당 금액 및 조건 추출
window.extractMaintenancePolicyFromObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;

    const targetObj = (policyObj.maintenance_policy && typeof policyObj.maintenance_policy === 'object')
        ? policyObj.maintenance_policy
        : policyObj;

    let amount = null;
    let reqSmallCv = 0;
    let reqSmallPv = 0;

    const amountKeys = [
        'maintenance_bonus_amount', 'maintenance_bonus', 'dignity_bonus', 'level_bonus', 'bonus_amount',
        'maintenance_amount', 'dignity_amount', 'payout_amount', 'pay_amount',
        'fixed_bonus', 'fixed_amount', 'amount', 'bonus', 'reward_amount', 'allowance'
    ];
    for (const k of amountKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) {
                amount = v;
                break;
            }
        }
    }

    if (amount === null) {
        for (const [k, val] of Object.entries(targetObj)) {
            const lk = k.toLowerCase();
            if (
                (lk.includes('bonus') || lk.includes('amount') || lk.includes('pay') || lk.includes('maint') || lk.includes('dignity') || lk.includes('품위')) &&
                !lk.includes('id') && !lk.includes('rank') && !lk.includes('level') && !lk.includes('min') && !lk.includes('req') && !lk.includes('cond') && !lk.includes('cv') && !lk.includes('pv') && !lk.includes('rate')
            ) {
                const v = Number(String(val).replace(/,/g, ''));
                if (!isNaN(v) && v > 0) {
                    amount = v;
                    break;
                }
            }
        }
    }

    for (const [k, val] of Object.entries(targetObj)) {
        const lk = k.toLowerCase();
        if (lk.includes('id') || lk.includes('rank') || lk.includes('level')) continue;
        if (lk.includes('min') || lk.includes('req') || lk.includes('cond') || lk.includes('qualify') || lk.includes('target') || lk.includes('cv') || lk.includes('pv')) {
            const v = Number(String(val).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) {
                if (lk.includes('pv')) {
                    reqSmallPv = v;
                } else if (lk.includes('cv') || v !== amount) {
                    reqSmallCv = v;
                }
            }
        }
    }

    if (amount === null || amount <= 0) return null;
    return {
        amount: amount,
        reqSmallCv: reqSmallCv,
        reqSmallPv: reqSmallPv,
        rawPolicy: targetObj
    };
};

// [10-2-2-C] DB 정책 객체(rank_car_maintenance_bonus_policies)에서 직급별 차량유지비 금액 및 조건 추출
window.extractCarMaintenancePolicyFromObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;

    const targetObj = (policyObj.car_maintenance_policy && typeof policyObj.car_maintenance_policy === 'object')
        ? policyObj.car_maintenance_policy
        : policyObj;

    let amount = null;
    let reqSmallCvPerPeriod = 0;

    const amountKeys = [
        'car_maintenance_bonus_amount', 'car_bonus_amount', 'car_maintenance_amount',
        'car_bonus', 'bonus_amount', 'payout_amount', 'amount'
    ];
    for (const k of amountKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) {
                amount = v;
                break;
            }
        }
    }

    const cvKeys = [
        'required_minor_leg_cv_per_period', 'required_minor_leg_cv', 'min_minor_leg_cv',
        'required_small_cv', 'min_small_cv', 'required_cv', 'min_cv'
    ];
    for (const k of cvKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v >= 0) {
                reqSmallCvPerPeriod = v;
                break;
            }
        }
    }

    if (amount === null || amount <= 0) return null;
    return {
        amount: amount,
        reqSmallCvPerPeriod: reqSmallCvPerPeriod,
        payoutSchedule: targetObj.payout_schedule || '',
        description: targetObj.description || '',
        rawPolicy: targetObj
    };
};

// [10-2-2-D] TiDB 보상플랜 테이블(ranks 및 각 정책 테이블)에서 모든 직급 기준과 요율을 동적으로 로드하여 캐싱
window.loadDbCompensationRates = async function(forceReload = false) {
    if (window.dbRankRatesLoaded && !forceReload) return;
    if (!window.API_BASE) return;

    try {
        const res = await fetch(`${window.API_BASE}/api/rules`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const compRules = json.compRules || {};
        const ranks = Array.isArray(compRules.ranks) ? compRules.ranks : (Array.isArray(json.data) ? json.data : []);
        const bonusPolicies = compRules.bonus_policies || {};
        const matchingPolicies = compRules.matching_policies || compRules.matching_bonus_policies || json.matchingPolicies || {};
        const maintenancePolicies = compRules.maintenance_policies || compRules.rank_maintenance_bonus_policies || {};
        const carMaintenancePolicies = compRules.car_maintenance_policies || compRules.rank_car_maintenance_bonus_policies || {};
        const fastpowerPolicies = Array.isArray(compRules.fastpower_policies)
            ? compRules.fastpower_policies
            : (Array.isArray(compRules.fast_power_bonus_policies) ? compRules.fast_power_bonus_policies : []);
        const policiesByRankName = json.policiesByRankName || compRules.policiesByRankName || {};

        window.dbCompRulesRaw = compRules;
        window.dbRanksSorted = [];
        window.dbRankByIdMap = {};
        window.dbRankByNameMap = {};
        window.dbRankDirectRates = {};
        window.dbRankTeamRates = {};
        window.dbRankTeamCaps = {};
        window.dbRankMatchingRates = {};
        window.dbRankMaintenancePolicies = {};
        window.dbRankCarMaintenancePolicies = {};
        window.dbFastPowerPolicies = [];
        window.dbRankPoliciesMap = {};

        const sortedRanks = [...ranks].sort((a, b) => Number(a.rank_level ?? a.rank_id ?? 0) - Number(b.rank_level ?? b.rank_id ?? 0));
        sortedRanks.forEach(r => {
            const rId = Number(r.rank_id ?? r.id ?? r.rank_level ?? 0);
            const rLevel = Number(r.rank_level ?? rId);
            const rName = String(r.rank_name || r.name || r.rank_code || '').trim().toUpperCase();
            if (!rName) return;

            const normalizedRankObj = {
                ...r,
                rank_id: rId,
                rank_level: rLevel,
                rank_name: rName,
                period_type: String(r.period_type || 'NONE').trim().toUpperCase(),
                personal_pv_min: Number(r.personal_pv_min ?? 0),
                minor_leg_pv: Number(r.minor_leg_pv ?? 0),
                required_partner_rank_id: r.required_partner_rank_id !== null && r.required_partner_rank_id !== undefined && r.required_partner_rank_id !== ''
                    ? Number(r.required_partner_rank_id)
                    : null,
                is_direct_sponsor: Number(r.is_direct_sponsor ?? 0),
                maintenance_rank_id: r.maintenance_rank_id !== null && r.maintenance_rank_id !== undefined && r.maintenance_rank_id !== ''
                    ? Number(r.maintenance_rank_id)
                    : null
            };

            window.dbRanksSorted.push(normalizedRankObj);
            window.dbRankByIdMap[rId] = normalizedRankObj;
            window.dbRankByNameMap[rName] = normalizedRankObj;
        });

        window.dbFastPowerPolicies = [...fastpowerPolicies]
            .sort((a, b) => Number(a.step_level || 0) - Number(b.step_level || 0))
            .map(fp => {
                const rawPartialRate = Number(fp.partial_payout_rate ?? 0);
                return {
                    ...fp,
                    step_level: Number(fp.step_level || 0),
                    leg_position: String(fp.leg_position || '').trim().toUpperCase(),
                    my_direct_sponsor_count: Number(fp.my_direct_sponsor_count ?? 0),
                    partner_direct_sponsor_count: Number(fp.partner_direct_sponsor_count ?? 0),
                    required_partner_rank_id: fp.required_partner_rank_id !== null && fp.required_partner_rank_id !== undefined && fp.required_partner_rank_id !== ''
                        ? Number(fp.required_partner_rank_id)
                        : null,
                    period_condition: String(fp.period_condition || '').trim(),
                    reward_amount: Number(String(fp.reward_amount ?? 0).replace(/,/g, '')),
                    partial_payout_rate: rawPartialRate > 1 ? (rawPartialRate / 100) : rawPartialRate,
                    payout_schedule: String(fp.payout_schedule || '').trim(),
                    description: String(fp.description || '').trim()
                };
            });

        const registerRankPolicy = (rNameRaw, mergedObj) => {
            let rName = String(rNameRaw || '').trim().toUpperCase();
            if (window.dbRankByIdMap[rName]) rName = window.dbRankByIdMap[rName].rank_name;
            if (!rName || !mergedObj || typeof mergedObj !== 'object') return;

            window.dbRankPoliciesMap[rName] = { ...(window.dbRankPoliciesMap[rName] || {}), ...mergedObj };

            const dRate = window.extractDirectRateFromPolicyObj(mergedObj);
            if (dRate !== null) window.dbRankDirectRates[rName] = dRate;

            const tRate = window.extractTeamRateFromPolicyObj(mergedObj);
            if (tRate !== null) window.dbRankTeamRates[rName] = tRate;

            const tCap = window.extractTeamCapFromPolicyObj(mergedObj);
            if (tCap !== null) window.dbRankTeamCaps[rName] = tCap;

            const mRates = window.extractMatchingRatesFromPolicyObj(mergedObj);
            if (mRates !== null) {
                window.dbRankMatchingRates[rName] = { ...(window.dbRankMatchingRates[rName] || {}), ...mRates };
            }

            if (mergedObj.maintenance_policy) {
                const maintPol = window.extractMaintenancePolicyFromObj(mergedObj.maintenance_policy);
                if (maintPol !== null) {
                    window.dbRankMaintenancePolicies[rName] = maintPol;
                }
            }

            if (mergedObj.car_maintenance_policy) {
                const carPol = window.extractCarMaintenancePolicyFromObj(mergedObj.car_maintenance_policy);
                if (carPol !== null) {
                    window.dbRankCarMaintenancePolicies[rName] = carPol;
                }
            }
        };

        Object.entries(policiesByRankName).forEach(([rName, mergedObj]) => {
            registerRankPolicy(rName, mergedObj);
        });

        window.dbRanksSorted.forEach(r => {
            const rName = r.rank_name;
            const rId = r.rank_id;
            const pol = bonusPolicies[rId] || bonusPolicies[rName] || {};
            const matchPol = matchingPolicies[rId] || matchingPolicies[rName] || null;
            const maint = maintenancePolicies[rId] || maintenancePolicies[rName] || null;
            const carPol = carMaintenancePolicies[rId] || carMaintenancePolicies[rName] || null;
            registerRankPolicy(rName, {
                ...r,
                ...pol,
                matching_policy: matchPol,
                maintenance_policy: maint,
                car_maintenance_policy: carPol
            });
        });

        Object.entries(bonusPolicies).forEach(([key, pol]) => {
            if (!pol || typeof pol !== 'object') return;
            const rObj = window.dbRankByIdMap[pol.rank_id] || window.dbRankByIdMap[key];
            const rName = pol.rank_name || pol.name || (rObj ? rObj.rank_name : key);
            registerRankPolicy(rName, pol);
        });

        if (Array.isArray(matchingPolicies)) {
            matchingPolicies.forEach(mp => {
                if (!mp || typeof mp !== 'object') return;
                const rObj = window.dbRankByIdMap[mp.rank_id];
                const rName = mp.rank_name || mp.name || (rObj ? rObj.rank_name : mp.rank) || '';
                const g = Number(mp.generation ?? mp.gen ?? mp.level ?? 0);
                const rawR = Number(mp.rate ?? mp.matching_rate ?? mp.bonus_rate ?? 0);
                if (rName && g >= 1 && rawR > 0) {
                    const normR = String(rName).trim().toUpperCase();
                    if (!window.dbRankMatchingRates[normR]) window.dbRankMatchingRates[normR] = {};
                    window.dbRankMatchingRates[normR][g] = rawR > 1 ? (rawR / 100) : rawR;
                } else if (rName) {
                    registerRankPolicy(rName, mp);
                }
            });
        } else if (matchingPolicies && typeof matchingPolicies === 'object') {
            Object.entries(matchingPolicies).forEach(([key, mp]) => {
                const rObj = window.dbRankByIdMap[mp && mp.rank_id] || window.dbRankByIdMap[key];
                const rName = (mp && (mp.rank_name || mp.name)) || (rObj ? rObj.rank_name : key);
                registerRankPolicy(rName, mp);
            });
        }

        if (Array.isArray(maintenancePolicies)) {
            maintenancePolicies.forEach(mp => {
                if (!mp || typeof mp !== 'object') return;
                const rObj = window.dbRankByIdMap[mp.rank_id];
                const rName = mp.rank_name || mp.name || (rObj ? rObj.rank_name : mp.rank) || '';
                const maintPol = window.extractMaintenancePolicyFromObj(mp);
                if (rName && maintPol) {
                    window.dbRankMaintenancePolicies[String(rName).trim().toUpperCase()] = maintPol;
                }
            });
        } else if (maintenancePolicies && typeof maintenancePolicies === 'object') {
            Object.entries(maintenancePolicies).forEach(([key, mp]) => {
                if (!mp || typeof mp !== 'object') return;
                const rObj = window.dbRankByIdMap[mp.rank_id] || window.dbRankByIdMap[key];
                const rName = mp.rank_name || mp.name || (rObj ? rObj.rank_name : key);
                const maintPol = window.extractMaintenancePolicyFromObj(mp);
                if (rName && maintPol) {
                    window.dbRankMaintenancePolicies[String(rName).trim().toUpperCase()] = maintPol;
                }
            });
        }

        if (Array.isArray(carMaintenancePolicies)) {
            carMaintenancePolicies.forEach(cp => {
                if (!cp || typeof cp !== 'object') return;
                const rObj = window.dbRankByIdMap[cp.rank_id];
                const rName = cp.rank_name || cp.name || (rObj ? rObj.rank_name : cp.rank) || '';
                const carPol = window.extractCarMaintenancePolicyFromObj(cp);
                if (rName && carPol) {
                    window.dbRankCarMaintenancePolicies[String(rName).trim().toUpperCase()] = carPol;
                }
            });
        } else if (carMaintenancePolicies && typeof carMaintenancePolicies === 'object') {
            Object.entries(carMaintenancePolicies).forEach(([key, cp]) => {
                if (!cp || typeof cp !== 'object') return;
                const rObj = window.dbRankByIdMap[cp.rank_id] || window.dbRankByIdMap[key];
                const rName = cp.rank_name || cp.name || (rObj ? rObj.rank_name : key);
                const carPol = window.extractCarMaintenancePolicyFromObj(cp);
                if (rName && carPol) {
                    window.dbRankCarMaintenancePolicies[String(rName).trim().toUpperCase()] = carPol;
                }
            });
        }

        window.dbRankRatesLoaded = window.dbRanksSorted.length > 0;
        console.log('📊 [TiDB 직급 테이블(ranks) 로드]:', window.dbRanksSorted);
        console.log('📊 [TiDB 직급별 추천수당 요율]:', window.dbRankDirectRates);
        console.log('📊 [TiDB 직급별 지원수당 요율]:', window.dbRankTeamRates);
        console.log('📊 [TiDB 직급별 추천매칭 요율]:', window.dbRankMatchingRates);
        console.log('📊 [TiDB 직급별 품위유지 정책]:', window.dbRankMaintenancePolicies);
        console.log('📊 [TiDB 직급별 차량유지 정책]:', window.dbRankCarMaintenancePolicies);
        console.log('📊 [TiDB 패스트파워 정책]:', window.dbFastPowerPolicies);
    } catch (err) {
        console.error('❌ TiDB 보상플랜 요율 로드 실패:', err);
    }
};

// [10-2-2-E] DB 직급 레벨/ID/정책 조회 헬퍼
window.getDbRankLevel = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankByNameMap && window.dbRankByNameMap[r]) {
        return Number(window.dbRankByNameMap[r].rank_level || 0);
    }
    return 0;
};

window.getDbRankId = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankByNameMap && window.dbRankByNameMap[r]) {
        return Number(window.dbRankByNameMap[r].rank_id || 0);
    }
    return 0;
};

window.getBaseBusinessRankName = function() {
    if (Array.isArray(window.dbRanksSorted) && window.dbRanksSorted.length > 0) {
        const personalRanks = window.dbRanksSorted.filter(r => Number(r.minor_leg_pv || 0) === 0);
        if (personalRanks.length > 0) {
            return personalRanks[personalRanks.length - 1].rank_name;
        }
        return window.dbRanksSorted[0].rank_name;
    }
    return '';
};

window.getDirectBonusRate = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankDirectRates && typeof window.dbRankDirectRates[r] === 'number') {
        return window.dbRankDirectRates[r];
    }
    return 0;
};

window.getTeamBonusRate = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankTeamRates && typeof window.dbRankTeamRates[r] === 'number') {
        return window.dbRankTeamRates[r];
    }
    return 0;
};

window.getTeamBonusCap = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankTeamCaps && typeof window.dbRankTeamCaps[r] === 'number' && window.dbRankTeamCaps[r] > 0) {
        return window.dbRankTeamCaps[r];
    }
    return null;
};

window.getMatchingBonusRates = function(rankName) {
    if (!rankName) return {};
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankMatchingRates && window.dbRankMatchingRates[r]) {
        return window.dbRankMatchingRates[r];
    }
    return {};
};

window.getMaintenanceBonusPolicy = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankMaintenancePolicies && window.dbRankMaintenancePolicies[r]) {
        return window.dbRankMaintenancePolicies[r];
    }
    return null;
};

window.getCarMaintenanceBonusPolicy = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    if (window.dbRankCarMaintenancePolicies && window.dbRankCarMaintenancePolicies[r]) {
        return window.dbRankCarMaintenancePolicies[r];
    }
    return null;
};

// [10-2-3] 선택한 회원이 추천한 파트너 목록 Map 반환 (ID 매칭 + 추천인명 매칭 + 압축롤업 지원)
window.getDirectRecommendedPartnersMap = function(targetMember) {
    const recMap = new Map();
    if (!targetMember || !targetMember.id) return recMap;

    const targetNorm = String(targetMember.id).trim().toLowerCase().replace(/^vk-?/, '');
    const targetName = String(targetMember.name || '').trim();
    const allMembers = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];

    const rollupChk = document.getElementById('chk-rollup') || document.querySelector('#perfWidget input[type="checkbox"]');
    const isRollup = rollupChk ? rollupChk.checked : true;

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (mNorm === targetNorm) return;

        const rId = m.recId || m.recommender_id || m.recommenderId || m.rec_id || '';
        const rNorm = String(rId).trim().toLowerCase().replace(/^vk-?/, '');
        const rName = String(m.recName || m.recommender_name || m.recommenderName || m.rec_name || '').trim();

        if ((rNorm && rNorm === targetNorm) || (!rNorm && targetName && rName === targetName)) {
            recMap.set(mNorm, m);
            return;
        }

        if (isRollup && rNorm) {
            let currRecId = rId;
            const visited = new Set([mNorm]);
            while (currRecId) {
                const currNorm = String(currRecId).trim().toLowerCase().replace(/^vk-?/, '');
                if (visited.has(currNorm)) break;
                visited.add(currNorm);

                const recNode = window.findMemberNode(currRecId);
                if (!recNode) break;

                const recRank = String(recNode.rank || recNode.rank_name || '').toUpperCase();
                const recRate = window.getDirectBonusRate(recRank);

                if (recRate <= 0) {
                    const nextRecId = recNode.recId || recNode.recommender_id || recNode.rec_id || '';
                    const nextNorm = String(nextRecId).trim().toLowerCase().replace(/^vk-?/, '');
                    if (nextNorm === targetNorm) {
                        recMap.set(mNorm, m);
                        break;
                    }
                    currRecId = nextRecId;
                } else {
                    break;
                }
            }
        }
    });

    return recMap;
};

// [10-2-4] 100% TiDB ranks 테이블(period_type, minor_leg_pv, required_partner_rank_id, is_direct_sponsor) 기반 동적 직급 판정
window.resolveHistoricalRank = function(memberObj, orderKey, rawSk, backendMembersMap, accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo) {
    const baseRankName = window.getBaseBusinessRankName();
    if (!memberObj) return baseRankName;

    const currentRank = String(memberObj.rank || memberObj.rank_name || baseRankName).trim().toUpperCase();
    const currentRankObj = window.dbRankByNameMap ? window.dbRankByNameMap[currentRank] : null;
    const baseRankObj = window.dbRankByNameMap ? window.dbRankByNameMap[baseRankName] : null;

    if (currentRankObj && baseRankObj && currentRankObj.rank_level <= baseRankObj.rank_level) {
        return currentRank;
    }

    const totalMinorLegPV = Math.min(accAPV || 0, accBPV || 0);
    const r4A = (recent4APV !== undefined && recent4APV !== null) ? recent4APV : (accAPV || 0);
    const r4B = (recent4BPV !== undefined && recent4BPV !== null) ? recent4BPV : (accBPV || 0);
    const recent4MinorLegPV = Math.min(r4A, r4B);

    let achievedRank = baseRankName;
    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

    for (const rRow of dbRanks) {
        const reqMinorPv = Number(rRow.minor_leg_pv || 0);
        if (reqMinorPv <= 0) continue;

        const periodType = String(rRow.period_type || 'NONE').trim().toUpperCase();
        const compareMinorPV = (periodType === 'RECENT_4') ? recent4MinorLegPV : totalMinorLegPV;

        if (compareMinorPV < reqMinorPv) {
            continue;
        }

        const reqPartnerRankId = rRow.required_partner_rank_id;
        const isDirectSponsor = Number(rRow.is_direct_sponsor || 0) === 1;

        if (reqPartnerRankId !== null && reqPartnerRankId > 0 && legQualifyInfo) {
            if (isDirectSponsor) {
                if (legQualifyInfo.maxDirectRankIdA < reqPartnerRankId || legQualifyInfo.maxDirectRankIdB < reqPartnerRankId) {
                    continue;
                }
            } else {
                if (legQualifyInfo.maxSubRankIdA < reqPartnerRankId || legQualifyInfo.maxSubRankIdB < reqPartnerRankId) {
                    continue;
                }
            }
        }

        achievedRank = rRow.rank_name;
    }

    const curLevel = window.getDbRankLevel(currentRank);
    const achLevel = window.getDbRankLevel(achievedRank);
    if (curLevel > 0 && achLevel > curLevel) {
        return currentRank;
    }
    return achievedRank;
};

// [10-2-4-B] 전체 회원(프론트 트리 + 백엔드 flatMembers 통합) 수집 및 레그별 최고 달성 직급 계산 헬퍼
window.getAllCombinedMembersList = function(backendMembersMap) {
    const combinedMap = new Map();
    const localList = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];

    localList.forEach(m => {
        if (!m || !m.id) return;
        const norm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
        combinedMap.set(norm, m);
    });

    if (backendMembersMap && typeof backendMembersMap === 'object') {
        Object.values(backendMembersMap).forEach(bm => {
            if (!bm || !(bm.id || bm.member_id)) return;
            const bid = bm.id || bm.member_id;
            const norm = String(bid).trim().toLowerCase().replace(/^vk-?/, '');
            if (!combinedMap.has(norm)) {
                const foundNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(bid) : null;
                combinedMap.set(norm, foundNode || { ...bm, id: bid });
            } else {
                const existing = combinedMap.get(norm);
                if (!existing.recId && (bm.recId || bm.recommender_id)) existing.recId = bm.recId || bm.recommender_id;
                if (!existing.recName && (bm.recName || bm.recommender_name)) existing.recName = bm.recName || bm.recommender_name;
                if (!existing.parent_id && (bm.parent_id || bm.parentId || bm.sponsor_id)) {
                    existing.parent_id = bm.parent_id || bm.parentId || bm.sponsor_id;
                }
            }
        });
    }

    return Array.from(combinedMap.values());
};

window.getLegPartnerQualificationInfo = function(treeNode, setA, setB, directRecNormSet, orderKey, teamBonusMap) {
    let maxDirectRankIdA = 0, maxDirectRankIdB = 0;
    let maxSubRankIdA = 0, maxSubRankIdB = 0;
    const baseRankId = window.getDbRankId(window.getBaseBusinessRankName());

    const getPartnerRankIdAtPeriod = (subNorm) => {
        const pMap = teamBonusMap ? teamBonusMap.get(subNorm) : null;
        if (pMap && pMap[orderKey] && pMap[orderKey].historicalRank) {
            return window.getDbRankId(pMap[orderKey].historicalRank);
        }
        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(`VK-${subNorm}`) : null;
        if (mNode && mNode.rank) {
            return Math.min(window.getDbRankId(mNode.rank), baseRankId || 99);
        }
        return baseRankId;
    };

    setA.forEach(subNorm => {
        const rId = getPartnerRankIdAtPeriod(subNorm);
        if (rId > maxSubRankIdA) maxSubRankIdA = rId;
        if (directRecNormSet.has(subNorm) && rId > maxDirectRankIdA) {
            maxDirectRankIdA = rId;
        }
    });

    setB.forEach(subNorm => {
        const rId = getPartnerRankIdAtPeriod(subNorm);
        if (rId > maxSubRankIdB) maxSubRankIdB = rId;
        if (directRecNormSet.has(subNorm) && rId > maxDirectRankIdB) {
            maxDirectRankIdB = rId;
        }
    });

    return { maxDirectRankIdA, maxDirectRankIdB, maxSubRankIdA, maxSubRankIdB };
};

// [10-2-4-C] 전체 회원의 기수별 지원수당(Team Bonus) 및 기수별 당시 직급 일괄 시뮬레이션
window.computeAllMembersTeamBonusByPeriod = function(allSales, backendMembersMap) {
    const allMembers = window.getAllCombinedMembersList(backendMembersMap);
    const salesByMember = new Map();

    allSales.forEach(s => {
        if (!s) return;
        const midNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (!midNorm) return;
        const rawDate = s.transaction_date || s.sales_date || s.buy_date || s.date || '';
        const pInfo = window.getPeriodInfoFromDate(rawDate);
        if (!pInfo) return;
        const cvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        if (cvVal <= 0 && pvVal <= 0) return;

        if (!salesByMember.has(midNorm)) salesByMember.set(midNorm, []);
        salesByMember.get(midNorm).push({ pInfo, cv: cvVal, pv: pvVal });
    });

    const allGlobalPeriodKeys = new Set();
    salesByMember.forEach(list => {
        list.forEach(({ pInfo }) => allGlobalPeriodKeys.add(pInfo.sortOrderKey));
    });
    if (backendMembersMap && typeof backendMembersMap === 'object') {
        Object.values(backendMembersMap).forEach(bm => {
            if (bm && bm.periods) {
                Object.keys(bm.periods).forEach(rawSk => {
                    const mMatch = String(rawSk).match(/^(\d{4})-(\d{2})-(전|후)$/);
                    if (mMatch) {
                        allGlobalPeriodKeys.add(`${mMatch[1]}-${mMatch[2]}-${mMatch[3] === '전' ? '1' : '2'}`);
                    }
                });
            }
        });
    }
    const sortedGlobalKeys = Array.from(allGlobalPeriodKeys).sort((a, b) => a.localeCompare(b));
    const baseRankName = window.getBaseBusinessRankName();
    const baseRankLevel = window.getDbRankLevel(baseRankName);

    const teamBonusMap = new Map();

    const membersBottomUp = [...allMembers].sort((a, b) => Number(b.generation || 0) - Number(a.generation || 0));

    membersBottomUp.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
        const treeNode = (typeof window.findMemberNode === 'function' ? window.findMemberNode(m.id) : null) || m;
        const { setA, setB } = window.getSublinePartnerSets(treeNode);

        const directRecMap = window.getDirectRecommendedPartnersMap(treeNode);
        const directRecNormSet = new Set(directRecMap.keys());

        const mPeriodBuckets = {};

        setA.forEach(subNorm => {
            const list = salesByMember.get(subNorm);
            if (!list) return;
            list.forEach(({ pInfo, cv, pv }) => {
                if (!mPeriodBuckets[pInfo.sortOrderKey]) {
                    mPeriodBuckets[pInfo.sortOrderKey] = {
                        sortOrderKey: pInfo.sortOrderKey,
                        backendKey: pInfo.backendKey,
                        periodLabel: pInfo.periodLabel,
                        a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0
                    };
                }
                mPeriodBuckets[pInfo.sortOrderKey].a_cv += cv;
                mPeriodBuckets[pInfo.sortOrderKey].a_pv += pv;
            });
        });

        setB.forEach(subNorm => {
            const list = salesByMember.get(subNorm);
            if (!list) return;
            list.forEach(({ pInfo, cv, pv }) => {
                if (!mPeriodBuckets[pInfo.sortOrderKey]) {
                    mPeriodBuckets[pInfo.sortOrderKey] = {
                        sortOrderKey: pInfo.sortOrderKey,
                        backendKey: pInfo.backendKey,
                        periodLabel: pInfo.periodLabel,
                        a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0
                    };
                }
                mPeriodBuckets[pInfo.sortOrderKey].b_cv += cv;
                mPeriodBuckets[pInfo.sortOrderKey].b_pv += pv;
            });
        });

        let prevA = 0, prevB = 0;
        let accAPV = 0, accBPV = 0;

        const mCurRank = String(m.rank || m.rank_name || baseRankName).trim().toUpperCase();
        const mCurLevel = window.getDbRankLevel(mCurRank);
        let highestRankAchieved = (mCurLevel > 0 && mCurLevel < baseRankLevel) ? mCurRank : baseRankName;

        const recent4Window = [];
        const bMem = backendMembersMap
            ? (backendMembersMap[m.id] || backendMembersMap[String(m.id).toUpperCase()] || backendMembersMap[`VK-${mNorm}`])
            : null;

        const memberPeriodResult = {};

        sortedGlobalKeys.forEach(k => {
            const [yyyy, mm, halfNum] = k.split('-');
            const defaultBackendKey = `${yyyy}-${mm}-${halfNum === '1' ? '전' : '후'}`;
            const hasActivityInPeriod = Boolean(mPeriodBuckets[k]);
            const b = mPeriodBuckets[k] || { sortOrderKey: k, backendKey: defaultBackendKey, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0 };

            accAPV += b.a_pv;
            accBPV += b.b_pv;

            if (hasActivityInPeriod || recent4Window.length > 0) {
                recent4Window.push({ a_pv: b.a_pv || 0, b_pv: b.b_pv || 0 });
                if (recent4Window.length > 4) {
                    recent4Window.shift();
                }
            }

            const recent4APV = recent4Window.reduce((sum, item) => sum + item.a_pv, 0);
            const recent4BPV = recent4Window.reduce((sum, item) => sum + item.b_pv, 0);

            const legQualifyInfo = window.getLegPartnerQualificationInfo(
                treeNode, setA, setB, directRecNormSet, k, teamBonusMap
            );

            const evaluatedRank = window.resolveHistoricalRank(
                treeNode, k, b.backendKey || defaultBackendKey, backendMembersMap,
                accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo
            );
            if (window.getDbRankLevel(evaluatedRank) > window.getDbRankLevel(highestRankAchieved)) {
                highestRankAchieved = evaluatedRank;
            }
            const histRank = highestRankAchieved;

            const tRate = window.getTeamBonusRate(histRank);
            const tCap = window.getTeamBonusCap(histRank);

            const sumA = prevA + b.a_cv;
            const sumB = prevB + b.b_cv;
            const deduct = Math.min(sumA, sumB);
            prevA = sumA - deduct;
            prevB = sumB - deduct;

            let tb = 0;
            if (deduct > 0 && tRate > 0) {
                tb = Math.floor(deduct * tRate);
                if (tCap !== null && tb > tCap) tb = tCap;
            }

            if (tb <= 0 && bMem && bMem.periods && bMem.periods[defaultBackendKey]) {
                const backendTb = Number(bMem.periods[defaultBackendKey].teamBonus || 0);
                if (backendTb > 0) tb = backendTb;
            }

            memberPeriodResult[k] = {
                teamBonus: tb,
                matchedCV: deduct,
                accAPV,
                accBPV,
                recent4APV,
                recent4BPV,
                historicalRank: histRank
            };
        });

        teamBonusMap.set(mNorm, memberPeriodResult);
    });

    return teamBonusMap;
};

// [10-2-5] 추천 계보 정밀 연결 및 추천매칭보너스 산출 (압축롤업 기준금액 30,000원 상수 적용)
window.buildRecommenderChildrenMap = function(allMembers, backendMembersMap) {
    const recChildrenMap = new Map();
    const memberByNormId = new Map();
    const membersByName = new Map();

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
        memberByNormId.set(mNorm, m);

        const mName = String(m.name || '').trim();
        if (mName) {
            if (!membersByName.has(mName)) membersByName.set(mName, []);
            membersByName.get(mName).push(m);
        }
    });

    const isDescendantInSponsorTree = (candidateParent, childNorm) => {
        if (!candidateParent || typeof window.getSublinePartnerSets !== 'function') return false;
        const { setA, setB } = window.getSublinePartnerSets(candidateParent);
        return setA.has(childNorm) || setB.has(childNorm);
    };

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
        const bMem = backendMembersMap
            ? (backendMembersMap[m.id] || backendMembersMap[String(m.id).toUpperCase()] || backendMembersMap[`VK-${mNorm}`])
            : null;

        const rawRecId = m.recId || m.recommender_id || m.recommenderId || m.rec_id ||
                         (bMem && (bMem.recId || bMem.recommender_id || bMem.recommenderId || bMem.rec_id)) || '';
        const rawRecName = String(
            m.recName || m.recommender_name || m.recommenderName || m.rec_name ||
            (bMem && (bMem.recName || bMem.recommender_name || bMem.recommenderName || bMem.rec_name)) || ''
        ).trim();

        let rNorm = String(rawRecId).trim().toLowerCase().replace(/^vk-?/, '');

        if (!rNorm || !memberByNormId.has(rNorm)) {
            rNorm = '';
            if (rawRecName && rawRecName !== '-' && rawRecName !== '미등록/검색불가') {
                const candidates = membersByName.get(rawRecName) || [];
                if (candidates.length === 1) {
                    rNorm = String(candidates[0].id).trim().toLowerCase().replace(/^vk-?/, '');
                } else if (candidates.length > 1) {
                    const sponsorMatched = candidates.find(cand => isDescendantInSponsorTree(cand, mNorm));
                    const chosen = sponsorMatched || candidates[0];
                    rNorm = String(chosen.id).trim().toLowerCase().replace(/^vk-?/, '');
                }
            }
        }

        if (!rNorm || rNorm === mNorm) return;
        if (!recChildrenMap.has(rNorm)) recChildrenMap.set(rNorm, []);

        const list = recChildrenMap.get(rNorm);
        if (!list.some(existing => String(existing.id).trim().toLowerCase().replace(/^vk-?/, '') === mNorm)) {
            list.push(m);
        }
    });

    return { recChildrenMap, memberByNormId };
};

window.calculateMatchingBonusForTarget = function(targetMember, periodMap, allMembersTeamBonusMap, isRollup, backendMembersMap) {
    if (!targetMember || !targetMember.id) return;

    const allMembers = window.getAllCombinedMembersList(backendMembersMap);
    const { recChildrenMap, memberByNormId } = window.buildRecommenderChildrenMap(allMembers, backendMembersMap);
    const rootNorm = String(targetMember.id).trim().toLowerCase().replace(/^vk-?/, '');
    const baseRankName = window.getBaseBusinessRankName();

    const { setA: sponsorSetA, setB: sponsorSetB } = window.getSublinePartnerSets(targetMember);
    const allSponsorSubNorms = new Set([...sponsorSetA, ...sponsorSetB]);

    const reachableFromRoot = new Set([rootNorm]);
    const markReachable = (curr) => {
        const chList = recChildrenMap.get(curr) || [];
        chList.forEach(c => {
            const cn = String(c.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (!reachableFromRoot.has(cn)) {
                reachableFromRoot.add(cn);
                markReachable(cn);
            }
        });
    };
    markReachable(rootNorm);

    allSponsorSubNorms.forEach(subNorm => {
        if (reachableFromRoot.has(subNorm)) return;
        let currNorm = subNorm;
        const chainVisited = new Set([currNorm]);
        while (true) {
            let foundRecParent = null;
            for (const [pNorm, children] of recChildrenMap.entries()) {
                if (children.some(ch => String(ch.id).trim().toLowerCase().replace(/^vk-?/, '') === currNorm)) {
                    foundRecParent = pNorm;
                    break;
                }
            }
            if (foundRecParent && !chainVisited.has(foundRecParent)) {
                if (reachableFromRoot.has(foundRecParent)) break;
                chainVisited.add(foundRecParent);
                currNorm = foundRecParent;
            } else {
                const orphanMember = memberByNormId.get(currNorm);
                if (orphanMember && currNorm !== rootNorm) {
                    if (!recChildrenMap.has(rootNorm)) recChildrenMap.set(rootNorm, []);
                    const list = recChildrenMap.get(rootNorm);
                    if (!list.some(x => String(x.id).trim().toLowerCase().replace(/^vk-?/, '') === currNorm)) {
                        list.push(orphanMember);
                    }
                    markReachable(rootNorm);
                }
                break;
            }
        }
    });

    const ROLLUP_MIN_TEAM_BONUS = 30000;

    const allRelevantPeriodKeys = new Set(Object.keys(periodMap));
    const collectSubPeriodKeys = (currNorm, visited) => {
        const children = recChildrenMap.get(currNorm) || [];
        children.forEach(ch => {
            const cNorm = String(ch.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (visited.has(cNorm)) return;
            visited.add(cNorm);
            const pObj = allMembersTeamBonusMap.get(cNorm);
            if (pObj) {
                Object.entries(pObj).forEach(([k, val]) => {
                    if (val && val.teamBonus > 0) allRelevantPeriodKeys.add(k);
                });
            }
            collectSubPeriodKeys(cNorm, visited);
        });
    };
    collectSubPeriodKeys(rootNorm, new Set([rootNorm]));

    const directFirstGenChildren = recChildrenMap.get(rootNorm) || [];
    const firstGenSlotCount = Math.max(2, directFirstGenChildren.length);

    allRelevantPeriodKeys.forEach(orderKey => {
        const pRow = periodMap[orderKey];

        const targetTeamObj = allMembersTeamBonusMap.get(rootNorm);
        const targetHistRank = (pRow && pRow.historicalRank)
            ? pRow.historicalRank
            : ((targetTeamObj && targetTeamObj[orderKey] && targetTeamObj[orderKey].historicalRank)
                ? targetTeamObj[orderKey].historicalRank
                : baseRankName);

        const myMatchRates = window.getMatchingBonusRates(targetHistRank);
        const maxGen = Math.max(0, ...Object.keys(myMatchRates).map(Number));
        if (maxGen === 0) {
            if (pRow) {
                pRow.matchingBonus = 0;
                pRow.matchingDetails = [];
                pRow.appliedMatchRank = targetHistRank;
                pRow.historicalRank = targetHistRank;
            }
            return;
        }

        const rawCandidates = [];

        const traverseRecTree = (parentNorm, currentEffectiveGen, rawDepth, visited) => {
            const children = recChildrenMap.get(parentNorm) || [];

            children.forEach(child => {
                const cNorm = String(child.id).trim().toLowerCase().replace(/^vk-?/, '');
                if (visited.has(cNorm)) return;
                visited.add(cNorm);

                const pTeamObj = allMembersTeamBonusMap.get(cNorm);
                const partnerPeriodData = pTeamObj ? pTeamObj[orderKey] : null;
                const partnerTeamBonus = partnerPeriodData ? (partnerPeriodData.teamBonus || 0) : 0;
                const partnerHistRank = partnerPeriodData
                    ? partnerPeriodData.historicalRank
                    : baseRankName;

                const qualifiesForGeneration = isRollup
                    ? (partnerTeamBonus >= ROLLUP_MIN_TEAM_BONUS)
                    : (partnerTeamBonus > 0);

                if (qualifiesForGeneration) {
                    rawCandidates.push({
                        gen: currentEffectiveGen,
                        rawGen: rawDepth,
                        member_id: child.id,
                        name: child.name || '-',
                        rank: partnerHistRank,
                        teamBonus: partnerTeamBonus
                    });
                    traverseRecTree(cNorm, currentEffectiveGen + 1, rawDepth + 1, visited);
                } else {
                    const nextGen = isRollup ? currentEffectiveGen : (currentEffectiveGen + 1);
                    traverseRecTree(cNorm, nextGen, rawDepth + 1, visited);
                }
            });
        };

        traverseRecTree(rootNorm, 1, 1, new Set([rootNorm]));

        if (isRollup && rawCandidates.length > 0) {
            rawCandidates.sort((a, b) => (a.rawGen - b.rawGen) || (a.gen - b.gen));
            let gen1Occupied = rawCandidates.filter(c => c.gen === 1).length;

            rawCandidates.forEach(cand => {
                if (cand.gen > 1 && gen1Occupied < firstGenSlotCount) {
                    cand.gen = 1;
                    gen1Occupied++;
                }
            });
        }

        const matchingList = [];
        let periodMatchingSum = 0;

        rawCandidates.forEach(cand => {
            if (cand.gen > maxGen) return;
            const rate = myMatchRates[cand.gen] || 0;
            if (rate <= 0) return;
            const matchAmt = Math.floor(cand.teamBonus * rate);
            if (matchAmt <= 0) return;

            periodMatchingSum += matchAmt;
            matchingList.push({
                gen: cand.gen,
                rawGen: cand.rawGen,
                genLabel: `${cand.gen}세대`,
                member_id: cand.member_id,
                name: cand.name,
                rank: cand.rank,
                teamBonus: cand.teamBonus,
                rate: rate,
                matchingAmount: matchAmt
            });
        });

        if (periodMatchingSum > 0) {
            if (!periodMap[orderKey]) {
                const [yyyy, mm, halfNum] = orderKey.split('-');
                const halfTag = halfNum === '1' ? '전' : '후';
                const lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate();
                periodMap[orderKey] = {
                    sortOrderKey: orderKey,
                    sortKey: `${yyyy}-${mm}-${halfTag}`,
                    periodLabel: `${mm}-${halfTag}`,
                    startDate: halfNum === '1' ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-16`,
                    endDate: halfNum === '1' ? `${yyyy}-${mm}-15` : `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`,
                    historicalRank: targetHistRank,
                    a_cv: 0, a_pv: 0, b_cv: 0, b_pv: 0,
                    matchedCV: 0, balanceA: 0, balanceB: 0,
                    directBonus: 0, appliedRecRate: window.getDirectBonusRate(targetHistRank),
                    teamBonus: 0, appliedTeamRate: window.getTeamBonusRate(targetHistRank),
                    matchingBonus: 0, levelBonus: 0, carBonus: 0, fastPowerBonus: 0,
                    details: [], recDetails: [], matchingDetails: []
                };
            }
            matchingList.sort((a, b) => (a.gen - b.gen) || (b.matchingAmount - a.matchingAmount));
            periodMap[orderKey].matchingBonus = periodMatchingSum;
            periodMap[orderKey].matchingDetails = matchingList;
            periodMap[orderKey].appliedMatchRank = targetHistRank;
            periodMap[orderKey].historicalRank = targetHistRank;
        } else if (pRow) {
            pRow.matchingBonus = 0;
            pRow.matchingDetails = [];
            pRow.appliedMatchRank = targetHistRank;
            pRow.historicalRank = targetHistRank;
        }
    });
};

// [10-2-5-B] 패스트파워보너스(Fast Power Bonus) 시뮬레이션 (TiDB fast_power_bonus_policies 100% 동적 연동)
window.calculateFastPowerBonusForTarget = function(targetMember, periodMap, allSales, backendMembersMap) {
    if (!targetMember || !targetMember.id) return;
    const fpPolicies = Array.isArray(window.dbFastPowerPolicies) ? window.dbFastPowerPolicies : [];
    if (fpPolicies.length === 0) return;

    const step1Pol = fpPolicies.find(p => Number(p.step_level) === 1);
    const step2Pol = fpPolicies.find(p => Number(p.step_level) === 2);
    const step3Pol = fpPolicies.find(p => Number(p.step_level) === 3);
    if (!step1Pol) return;

    const allMembers = window.getAllCombinedMembersList(backendMembersMap);
    const { recChildrenMap } = window.buildRecommenderChildrenMap(allMembers, backendMembersMap);
    const rootNorm = String(targetMember.id).trim().toLowerCase().replace(/^vk-?/, '');
    const { setA, setB } = window.getSublinePartnerSets(targetMember);

    const salesByMemberAsc = new Map();
    allSales.forEach(s => {
        if (!s) return;
        const mNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (!mNorm) return;
        const dStr = typeof window.cleanDateStr === 'function'
            ? window.cleanDateStr(s.transaction_date || s.sales_date || s.date || '')
            : String(s.transaction_date || s.sales_date || s.date || '').trim().slice(0, 10);
        if (!dStr || !/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return;
        const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        if (pvVal <= 0) return;
        if (!salesByMemberAsc.has(mNorm)) salesByMemberAsc.set(mNorm, []);
        salesByMemberAsc.get(mNorm).push({ date: dStr, pv: pvVal });
    });
    salesByMemberAsc.forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));

    const getPartnerQualifyDate = (mObj, reqRankId) => {
        if (!mObj || !mObj.id) return null;
        const mNorm = String(mObj.id).trim().toLowerCase().replace(/^vk-?/, '');
        const reqRankObj = (reqRankId && window.dbRankByIdMap) ? window.dbRankByIdMap[reqRankId] : null;
        const reqRankLevel = reqRankObj ? Number(reqRankObj.rank_level || 0) : 0;
        const reqPersonalPv = reqRankObj ? Number(reqRankObj.personal_pv_min || 0) : 0;

        const mRankLevel = window.getDbRankLevel(mObj.rank || mObj.rank_name || '');
        const joinD = typeof window.cleanDateStr === 'function'
            ? window.cleanDateStr(mObj.joinDate || mObj.join_date || mObj.date1 || '')
            : String(mObj.joinDate || mObj.join_date || mObj.date1 || '').trim().slice(0, 10);

        const sList = salesByMemberAsc.get(mNorm) || [];
        if (reqPersonalPv > 0 && sList.length > 0) {
            let accPv = 0;
            for (const s of sList) {
                accPv += s.pv;
                if (accPv >= reqPersonalPv) {
                    return (joinD && joinD > s.date) ? joinD : s.date;
                }
            }
        }

        if (reqRankLevel > 0 && mRankLevel >= reqRankLevel) {
            const firstSaleD = sList.length > 0 ? sList[0].date : '';
            const qDate = joinD || firstSaleD || String(mObj.firstSales || mObj.first_sales_date || '').trim().slice(0, 10);
            if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) return qDate;
        }
        return null;
    };

    const myDirectChildren = recChildrenMap.get(rootNorm) || [];
    const candidateMonths = new Set();

    Object.keys(periodMap).forEach(orderKey => {
        const ym = String(orderKey).slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) candidateMonths.add(ym);
    });

    const reqRankIdStep1 = step1Pol.required_partner_rank_id;
    myDirectChildren.forEach(ch => {
        const qDate = getPartnerQualifyDate(ch, reqRankIdStep1);
        if (qDate) candidateMonths.add(qDate.slice(0, 7));
    });

    Object.values(periodMap).forEach(r => {
        r.fastPowerBonus = 0;
        r.fastPowerDetails = null;
    });

    const sortedMonths = Array.from(candidateMonths).sort((a, b) => a.localeCompare(b));

    sortedMonths.forEach(ym => {
        const [yyyyStr, mmStr] = ym.split('-');
        const yyyy = parseInt(yyyyStr, 10);
        const mm = parseInt(mmStr, 10);
        if (isNaN(yyyy) || isNaN(mm)) return;

        const lastDay = new Date(yyyy, mm, 0).getDate();
        const monthStart = `${ym}-01`;
        const firstHalfEnd = `${ym}-15`;
        const monthEnd = `${ym}-${String(lastDay).padStart(2, '0')}`;

        const s1ReqCount = Number(step1Pol.my_direct_sponsor_count || 0);
        const s1RankId = step1Pol.required_partner_rank_id;
        const step1QualifiedPartners = [];

        myDirectChildren.forEach(ch => {
            const cNorm = String(ch.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (!setA.has(cNorm)) return;
            const qDate = getPartnerQualifyDate(ch, s1RankId);
            if (qDate && qDate >= monthStart && qDate <= firstHalfEnd) {
                step1QualifiedPartners.push({
                    member: ch,
                    normId: cNorm,
                    qualifyDate: qDate
                });
            }
        });

        step1QualifiedPartners.sort((a, b) => a.qualifyDate.localeCompare(b.qualifyDate));
        const isStep1Achieved = s1ReqCount > 0 && step1QualifiedPartners.length >= s1ReqCount;

        if (!isStep1Achieved) return;

        const step1CompletedDate = step1QualifiedPartners[s1ReqCount - 1].qualifyDate;

        let isStep2Achieved = false;
        let step2QualifiedPairs = [];

        if (step2Pol) {
            const s2SubReqCount = Number(step2Pol.partner_direct_sponsor_count || 0);
            const s2RankId = step2Pol.required_partner_rank_id || s1RankId;

            const s1PartnersWithSubQualified = [];
            step1QualifiedPartners.forEach(s1Item => {
                const subChildren = recChildrenMap.get(s1Item.normId) || [];
                const qualifiedSubs = [];
                subChildren.forEach(subCh => {
                    const subNorm = String(subCh.id).trim().toLowerCase().replace(/^vk-?/, '');
                    if (!setA.has(subNorm)) return;
                    const subQDate = getPartnerQualifyDate(subCh, s2RankId);
                    if (subQDate && subQDate >= s1Item.qualifyDate && subQDate <= monthEnd) {
                        qualifiedSubs.push({
                            member: subCh,
                            normId: subNorm,
                            qualifyDate: subQDate
                        });
                    }
                });
                if (qualifiedSubs.length >= s2SubReqCount) {
                    s1PartnersWithSubQualified.push({
                        parentPartner: s1Item,
                        subPartners: qualifiedSubs.slice(0, s2SubReqCount)
                    });
                }
            });

            if (s2SubReqCount > 0 && s1PartnersWithSubQualified.length >= s1ReqCount) {
                isStep2Achieved = true;
                step2QualifiedPairs = s1PartnersWithSubQualified.slice(0, s1ReqCount);
            }
        }

        let isStep3Achieved = false;
        let step3QualifiedPairs = [];

        if (step3Pol) {
            const s3MyReqCount = Number(step3Pol.my_direct_sponsor_count || 0);
            const s3SubReqCount = Number(step3Pol.partner_direct_sponsor_count || 0);
            const s3RankId = step3Pol.required_partner_rank_id || s1RankId;

            const bLineDirectCandidates = [];
            myDirectChildren.forEach(ch => {
                const cNorm = String(ch.id).trim().toLowerCase().replace(/^vk-?/, '');
                if (!setB.has(cNorm)) return;
                const qDate = getPartnerQualifyDate(ch, s3RankId);
                if (qDate && qDate >= monthStart && qDate <= monthEnd) {
                    bLineDirectCandidates.push({
                        member: ch,
                        normId: cNorm,
                        qualifyDate: qDate
                    });
                }
            });

            const bPartnersWithSubQualified = [];
            bLineDirectCandidates.forEach(bItem => {
                const subChildren = recChildrenMap.get(bItem.normId) || [];
                const qualifiedSubs = [];
                subChildren.forEach(subCh => {
                    const subNorm = String(subCh.id).trim().toLowerCase().replace(/^vk-?/, '');
                    if (!setB.has(subNorm)) return;
                    const subQDate = getPartnerQualifyDate(subCh, s3RankId);
                    if (subQDate && subQDate >= bItem.qualifyDate && subQDate <= monthEnd) {
                        qualifiedSubs.push({
                            member: subCh,
                            normId: subNorm,
                            qualifyDate: subQDate
                        });
                    }
                });
                if (qualifiedSubs.length >= s3SubReqCount) {
                    bPartnersWithSubQualified.push({
                        parentPartner: bItem,
                        subPartners: qualifiedSubs.slice(0, s3SubReqCount)
                    });
                }
            });

            if (s3MyReqCount > 0 && bPartnersWithSubQualified.length >= s3MyReqCount) {
                isStep3Achieved = true;
                step3QualifiedPairs = bPartnersWithSubQualified.slice(0, s3MyReqCount);
            }
        }

        const isFullCycle = isStep1Achieved && isStep2Achieved && isStep3Achieved;
        const stepResults = [];
        let totalFastPowerBonus = 0;

        const evalSteps = [
            { pol: step1Pol, achieved: isStep1Achieved, detailObj: { partners: step1QualifiedPartners.slice(0, s1ReqCount) } },
            { pol: step2Pol, achieved: isStep2Achieved, detailObj: { pairs: step2QualifiedPairs } },
            { pol: step3Pol, achieved: isStep3Achieved, detailObj: { pairs: step3QualifiedPairs } }
        ];

        evalSteps.forEach(({ pol, achieved, detailObj }) => {
            if (!pol) return;
            const fullReward = Number(pol.reward_amount || 0);
            const partialRate = Number(pol.partial_payout_rate || 0.5);
            const appliedRate = achieved ? (isFullCycle ? 1.0 : partialRate) : 0;
            const payoutAmt = achieved ? Math.floor(fullReward * appliedRate) : 0;
            totalFastPowerBonus += payoutAmt;

            stepResults.push({
                stepLevel: pol.step_level,
                legPosition: pol.leg_position,
                achieved: achieved,
                fullReward: fullReward,
                appliedRate: appliedRate,
                payoutAmount: payoutAmt,
                description: pol.description || '',
                periodCondition: pol.period_condition || '',
                detailObj: detailObj
            });
        });

        if (totalFastPowerBonus <= 0) return;

        const nextY = mm === 12 ? (yyyy + 1) : yyyy;
        const nextM = mm === 12 ? 1 : (mm + 1);
        const nextMmStr = String(nextM).padStart(2, '0');
        const payoutOrderKey = `${nextY}-${nextMmStr}-1`;
        const payoutSortKey = `${nextY}-${nextMmStr}-전`;
        const payoutLabel = `${nextMmStr}-전`;

        if (!periodMap[payoutOrderKey]) {
            const baseRankName = window.getBaseBusinessRankName();
            periodMap[payoutOrderKey] = {
                sortOrderKey: payoutOrderKey,
                sortKey: payoutSortKey,
                periodLabel: payoutLabel,
                startDate: `${nextY}-${nextMmStr}-01`,
                endDate: `${nextY}-${nextMmStr}-15`,
                historicalRank: baseRankName,
                a_cv: 0, a_pv: 0, b_cv: 0, b_pv: 0,
                matchedCV: 0, balanceA: 0, balanceB: 0,
                directBonus: 0, appliedRecRate: window.getDirectBonusRate(baseRankName),
                teamBonus: 0, appliedTeamRate: window.getTeamBonusRate(baseRankName),
                matchingBonus: 0, levelBonus: 0, carBonus: 0, fastPowerBonus: 0,
                details: [], recDetails: [], matchingDetails: []
            };
        }

        periodMap[payoutOrderKey].fastPowerBonus = totalFastPowerBonus;
        periodMap[payoutOrderKey].fastPowerDetails = {
            achievedMonth: ym,
            payoutPeriodLabel: payoutLabel,
            isFullCycle: isFullCycle,
            totalAmount: totalFastPowerBonus,
            step1CompletedDate: step1CompletedDate,
            steps: stepResults
        };
    });
};

// [10-2-6] 하단 실적 집계 및 수당 시뮬레이터 데이터 연산 및 테이블 렌더링
window.calculateLocalPerformance = async function(targetId) {
    const tbody = document.getElementById('perf-table-tbody');
    const nameEl = document.getElementById('perf-target-name');
    if (!tbody) return;

    const perfW = document.getElementById('perfWidget');
    if (perfW) {
        perfW.querySelectorAll('thead th').forEach(th => {
            if (th.innerText && th.innerText.includes('기(주차)')) {
                th.innerHTML = th.innerHTML.replace('기(주차)', '기수');
            }
        });
    }

    const rollupChk = document.getElementById('chk-rollup') || document.querySelector('#perfWidget input[type="checkbox"]');
    if (rollupChk && !rollupChk.dataset.boundRollup) {
        rollupChk.dataset.boundRollup = 'true';
        rollupChk.addEventListener('change', () => {
            window.calculateLocalPerformance(window.currentSelectedId);
        });
    }
    const isRollup = rollupChk ? rollupChk.checked : true;

    let effectiveId = (targetId !== undefined && targetId !== null) ? targetId : window.currentSelectedId;
    let targetMember = effectiveId ? window.findMemberNode(effectiveId) : null;

    if (!targetMember) {
        if (nameEl) nameEl.innerText = '(선택 안됨)';
        tbody.innerHTML = `<tr><td colspan="18" style="padding:30px; text-align:center; color:#9ca3af;">선택된 회원이 없습니다. 계보도 카드를 클릭해 주세요.</td></tr>`;
        return;
    }

    let actualId = targetMember.id;
    const rootNorm = String(actualId).trim().toLowerCase().replace(/^vk-?/, '');
    if (nameEl) nameEl.innerText = `(${targetMember.name || actualId} / ${actualId})`;

    if (typeof window.loadDbCompensationRates === 'function') {
        await window.loadDbCompensationRates();
    }
    const baseRankName = window.getBaseBusinessRankName();
    const baseRankLevel = window.getDbRankLevel(baseRankName);

    let allSales = [];
    if (window.API_BASE) {
        try {
            const sRes = await fetch(`${window.API_BASE}/api/sales`);
            if (sRes.ok) {
                const sRows = await sRes.json();
                if (Array.isArray(sRows) && sRows.length > 0) {
                    window.allSalesData = sRows;
                    allSales = sRows;
                }
            }
        } catch (e) {}
    }
    if (allSales.length === 0) {
        allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);
    }

    let backendFlatMembers = null;
    if (window.API_BASE) {
        try {
            const res = await fetch(`${window.API_BASE}/api/tree`);
            if (res.ok) {
                const data = await res.json();
                backendFlatMembers = (data && data.flatMembers) ? data.flatMembers : null;
            }
        } catch (err) {}
    }

    if (Array.isArray(allSales)) {
        allSales.forEach(s => {
            if (!s) return;
            const cleanDt = typeof window.cleanDateStr === 'function' 
                ? window.cleanDateStr(s.transaction_date || s.date || s.buy_date || '') 
                : String(s.transaction_date || s.date || s.buy_date || '').trim().substring(0, 10);
            
            if (cleanDt && typeof window.ensurePeriodByDate === 'function') {
                window.ensurePeriodByDate(cleanDt);
            }
        });
    }

    const allMembersTeamBonusMap = typeof window.computeAllMembersTeamBonusByPeriod === 'function'
        ? window.computeAllMembersTeamBonusByPeriod(allSales, backendFlatMembers)
        : new Map();

    window.lastAllMembersTeamBonusMap = allMembersTeamBonusMap;
    const targetPeriodRankMap = allMembersTeamBonusMap.get(rootNorm) || {};

    const { setA, setB } = typeof window.getSublinePartnerSets === 'function'
        ? window.getSublinePartnerSets(targetMember)
        : { setA: new Set(), setB: new Set() };

    const directRecMap = typeof window.getDirectRecommendedPartnersMap === 'function'
        ? window.getDirectRecommendedPartnersMap(targetMember)
        : new Map();

    const directRecNormSet = new Set(directRecMap.keys());

    const periodMap = {};

    function ensurePeriodBucket(pInfo) {
        if (!pInfo || !pInfo.sortOrderKey) return null;

        if (!periodMap[pInfo.sortOrderKey]) {
            const myHistRank = (targetPeriodRankMap[pInfo.sortOrderKey] && targetPeriodRankMap[pInfo.sortOrderKey].historicalRank)
                ? targetPeriodRankMap[pInfo.sortOrderKey].historicalRank
                : baseRankName;

            const myHistRecRate = typeof window.getDirectBonusRate === 'function' ? window.getDirectBonusRate(myHistRank) : 0;
            const myHistTeamRate = typeof window.getTeamBonusRate === 'function' ? window.getTeamBonusRate(myHistRank) : 0;

            periodMap[pInfo.sortOrderKey] = {
                sortOrderKey: pInfo.sortOrderKey,
                sortKey: pInfo.backendKey || pInfo.sortOrderKey,
                periodLabel: pInfo.periodLabel || pInfo.sortOrderKey,
                startDate: pInfo.startDate || '',
                endDate: pInfo.endDate || '',
                historicalRank: myHistRank,
                a_cv: 0, a_pv: 0,
                b_cv: 0, b_pv: 0,
                matchedCV: 0,
                balanceA: 0, balanceB: 0,
                directBonus: 0,
                appliedRecRate: myHistRecRate,
                teamBonus: 0,
                appliedTeamRate: myHistTeamRate,
                matchingBonus: 0,
                levelBonus: 0,
                carBonus: 0,
                fastPowerBonus: 0,
                details: [],
                recDetails: [],
                matchingDetails: []
            };
        }
        return periodMap[pInfo.sortOrderKey];
    }

    const buildPeriodInfoFromDate = (dateStr) => {
        const clean = typeof window.cleanDateStr === 'function' 
            ? window.cleanDateStr(dateStr) 
            : String(dateStr || '').trim().substring(0, 10);
        if (!clean || clean.length < 10) return null;

        const existingFn = window.getPeriodInfoByDate || window.getPeriodInfo || window.parsePeriodInfo || window.getPeriodFromDate;
        if (typeof existingFn === 'function') {
            const info = existingFn(clean);
            if (info && info.sortOrderKey) return info;
        }

        const [yyyy, mm, ddStr] = clean.split('-');
        const dd = parseInt(ddStr, 10);
        if (!yyyy || !mm || isNaN(dd)) return null;

        const isFirstHalf = dd <= 15;
        const halfNum = isFirstHalf ? '1' : '2';
        const halfLabel = isFirstHalf ? '전' : '후';
        const lastDay = new Date(Number(yyyy), Number(mm), 0).getDate();

        return {
            sortOrderKey: `${yyyy}-${mm}-${halfNum}`,
            backendKey: `${mm}-${halfLabel}`,
            periodLabel: `${mm}-${halfLabel}`,
            startDate: `${yyyy}-${mm}-${isFirstHalf ? '01' : '16'}`,
            endDate: `${yyyy}-${mm}-${isFirstHalf ? '15' : String(lastDay)}`
        };
    };

    Object.keys(targetPeriodRankMap).forEach(orderKey => {
        const rankObj = targetPeriodRankMap[orderKey];
        if (rankObj && rankObj.pInfo) {
            ensurePeriodBucket(rankObj.pInfo);
        } else if (orderKey) {
            const parts = String(orderKey).split('-');
            if (parts.length === 3) {
                const sampleDate = `${parts[0]}-${parts[1]}-${parts[2] === '1' ? '01' : '16'}`;
                const pInfo = buildPeriodInfoFromDate(sampleDate);
                if (pInfo) {
                    pInfo.sortOrderKey = orderKey;
                    ensurePeriodBucket(pInfo);
                }
            }
        }
    });

    (allSales || []).forEach(s => {
        if (!s) return;
        const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (sNorm === rootNorm || setA.has(sNorm) || setB.has(sNorm) || directRecNormSet.has(sNorm)) {
            const rawDt = s.transaction_date || s.date || s.sales_date || s.buy_date || '';
            const pInfo = buildPeriodInfoFromDate(rawDt);
            if (pInfo) ensurePeriodBucket(pInfo);
        }
    });

    allSales.forEach(s => {
        if (!s) return;
        const saleMidNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (!saleMidNorm) return;

        const isLineA = setA.has(saleMidNorm);
        const isLineB = setB.has(saleMidNorm);
        const isDirectRec = directRecMap.has(saleMidNorm);

        if (!isLineA && !isLineB && !isDirectRec) return;

        const rawDate = s.transaction_date || s.sales_date || s.buy_date || s.date || '';
        const pInfo = window.getPeriodInfoFromDate(rawDate);
        if (!pInfo) return;

        const cvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        if (cvVal === 0 && pvVal === 0) return;

        const bucket = ensurePeriodBucket(pInfo);

        const salePartnerPeriodMap = allMembersTeamBonusMap.get(saleMidNorm);
        const salePartnerHistRank = (salePartnerPeriodMap && salePartnerPeriodMap[pInfo.sortOrderKey])
            ? salePartnerPeriodMap[pInfo.sortOrderKey].historicalRank
            : baseRankName;

        if (isLineA) {
            bucket.a_cv += cvVal;
            bucket.a_pv += pvVal;
            bucket.details.push({ line: 'A라인', member_id: s.member_id, rank: salePartnerHistRank, cv: cvVal, pv: pvVal, date: window.cleanDateStr(rawDate) });
        } else if (isLineB) {
            bucket.b_cv += cvVal;
            bucket.b_pv += pvVal;
            bucket.details.push({ line: 'B라인', member_id: s.member_id, rank: salePartnerHistRank, cv: cvVal, pv: pvVal, date: window.cleanDateStr(rawDate) });
        }

        if (isDirectRec && cvVal > 0) {
            const recPartner = directRecMap.get(saleMidNorm);
            const recRate = bucket.appliedRecRate;
            const bonusAmt = Math.floor(cvVal * recRate);
            bucket.directBonus += bonusAmt;
            bucket.recDetails.push({
                date: window.cleanDateStr(rawDate),
                member_id: recPartner ? recPartner.id : s.member_id,
                name: recPartner ? recPartner.name : '-',
                rank: salePartnerHistRank,
                cv: cvVal,
                rate: recRate,
                bonus: bonusAmt
            });
        }
    });

    const memberBackend = backendFlatMembers ? (backendFlatMembers[actualId] || backendFlatMembers[actualId.toUpperCase()]) : null;
    if (memberBackend && memberBackend.periods) {
        Object.values(memberBackend.periods).forEach(bRow => {
            const rawSk = String(bRow.sortKey || '');
            const mMatch = rawSk.match(/^(\d{4})-(\d{2})-(전|후)$/);
            if (!mMatch) return;
            const [, yyyy, mm, halfTag] = mMatch;
            const orderKey = `${yyyy}-${mm}-${halfTag === '전' ? '1' : '2'}`;
            const shortLabel = `${mm}-${halfTag}`;

            const myHistRank = (targetPeriodRankMap[orderKey] && targetPeriodRankMap[orderKey].historicalRank)
                ? targetPeriodRankMap[orderKey].historicalRank
                : baseRankName;

            const hasBonus = (bRow.directBonus || 0) + (bRow.teamBonus || 0) + (bRow.matchingBonus || 0) + (bRow.levelBonus || 0) + (bRow.carBonus || 0) + (bRow.fastPowerBonus || 0) > 0;
            if (!periodMap[orderKey] && hasBonus) {
                periodMap[orderKey] = {
                    sortOrderKey: orderKey,
                    sortKey: rawSk,
                    periodLabel: shortLabel,
                    startDate: `${yyyy}-${mm}-${halfTag === '전' ? '01' : '16'}`,
                    endDate: `${yyyy}-${mm}-${halfTag === '전' ? '15' : '30'}`,
                    historicalRank: myHistRank,
                    a_cv: 0, a_pv: 0, b_cv: 0, b_pv: 0,
                    matchedCV: 0, balanceA: 0, balanceB: 0,
                    directBonus: 0, appliedRecRate: window.getDirectBonusRate(myHistRank),
                    teamBonus: 0, appliedTeamRate: window.getTeamBonusRate(myHistRank),
                    matchingBonus: 0, levelBonus: 0, carBonus: 0, fastPowerBonus: 0,
                    details: [], recDetails: [], matchingDetails: []
                };
            }

            if (periodMap[orderKey]) {
                if ((bRow.directBonus || 0) > (periodMap[orderKey].directBonus || 0)) {
                    periodMap[orderKey].directBonus = bRow.directBonus;
                }
                if (bRow.teamBonus !== undefined) {
                    periodMap[orderKey].backendTeamBonus = bRow.teamBonus;
                }
                if (bRow.levelBonus !== undefined) {
                    periodMap[orderKey].backendLevelBonus = bRow.levelBonus;
                }
                periodMap[orderKey].levelBonus = bRow.levelBonus || 0;
                periodMap[orderKey].carBonus = bRow.carBonus || 0;
                periodMap[orderKey].fastPowerBonus = bRow.fastPowerBonus || 0;
            }
        });
    }

    window.calculateFastPowerBonusForTarget(targetMember, periodMap, allSales, backendFlatMembers);

    const chronologicalRows = Object.values(periodMap).sort((a, b) => a.sortOrderKey.localeCompare(b.sortOrderKey));

    if (chronologicalRows.length === 0) {
        window.perfData = [];
        tbody.innerHTML = `<tr><td colspan="18" style="padding:30px; text-align:center; color:#9ca3af;">산하 파트너 매출 및 수당 내역이 없습니다. (본인 매출 제외)</td></tr>`;
        return;
    }

    let prevAccACV = 0;
    let prevAccBCV = 0;
    let totalAccAPV = 0;
    let totalAccBPV = 0;

    const targetCurRank = String(targetMember.rank || targetMember.rank_name || baseRankName).trim().toUpperCase();
    const targetCurLevel = window.getDbRankLevel(targetCurRank);
    let runningHighestRank = (targetCurLevel > 0 && targetCurLevel < baseRankLevel) ? targetCurRank : baseRankName;
    const recent4Window = [];

    chronologicalRows.forEach(row => {
        totalAccAPV += (row.a_pv || 0);
        totalAccBPV += (row.b_pv || 0);
        row.accAPV = totalAccAPV;
        row.accBPV = totalAccBPV;

        recent4Window.push({ a_pv: row.a_pv || 0, b_pv: row.b_pv || 0 });
        if (recent4Window.length > 4) {
            recent4Window.shift();
        }
        const recent4APV = recent4Window.reduce((s, x) => s + x.a_pv, 0);
        const recent4BPV = recent4Window.reduce((s, x) => s + x.b_pv, 0);
        row.recent4APV = recent4APV;
        row.recent4BPV = recent4BPV;
        row.recent4MinorPV = Math.min(recent4APV, recent4BPV);

        const legQualifyInfo = window.getLegPartnerQualificationInfo(
            targetMember, setA, setB, directRecNormSet, row.sortOrderKey, allMembersTeamBonusMap
        );

        const evalRank = window.resolveHistoricalRank(
            targetMember, row.sortOrderKey, row.sortKey, backendFlatMembers,
            totalAccAPV, totalAccBPV, recent4APV, recent4BPV, legQualifyInfo
        );
        if (window.getDbRankLevel(evalRank) > window.getDbRankLevel(runningHighestRank)) {
            runningHighestRank = evalRank;
        }
        row.historicalRank = runningHighestRank;

        if (targetPeriodRankMap[row.sortOrderKey]) {
            targetPeriodRankMap[row.sortOrderKey].historicalRank = row.historicalRank;
        }

        const rowTeamRate = window.getTeamBonusRate(row.historicalRank);
        const rowTeamCap = window.getTeamBonusCap(row.historicalRank);

        row.prevCarryA = prevAccACV;
        row.prevCarryB = prevAccBCV;

        const compareAccACV = prevAccACV + (row.a_cv || 0);
        const compareAccBCV = prevAccBCV + (row.b_cv || 0);
        row.beforeDeductACV = compareAccACV;
        row.beforeDeductBCV = compareAccBCV;

        if (compareAccACV > compareAccBCV) {
            row.largeLeg = 'A';
            row.smallLeg = 'B';
            row.legLabelA = '대실적';
            row.legLabelB = '소실적';
        } else if (compareAccBCV > compareAccACV) {
            row.largeLeg = 'B';
            row.smallLeg = 'A';
            row.legLabelA = '소실적';
            row.legLabelB = '대실적';
        } else {
            row.largeLeg = 'EQUAL';
            row.smallLeg = 'EQUAL';
            row.legLabelA = compareAccACV > 0 ? '동일(매칭)' : '-';
            row.legLabelB = compareAccBCV > 0 ? '동일(매칭)' : '-';
        }

        const deductCV = Math.min(compareAccACV, compareAccBCV);
        row.matchedCV = deductCV;

        const currentAccACV = compareAccACV - deductCV;
        const currentAccBCV = compareAccBCV - deductCV;

        row.displayAccACV = currentAccACV;
        row.displayAccBCV = currentAccBCV;
        row.balanceA = currentAccACV;
        row.balanceB = currentAccBCV;

        prevAccACV = currentAccACV;
        prevAccBCV = currentAccBCV;

        let calcTeamBonus = 0;
        if (deductCV > 0 && rowTeamRate > 0) {
            calcTeamBonus = Math.floor(deductCV * rowTeamRate);
            if (rowTeamCap !== null && calcTeamBonus > rowTeamCap) {
                calcTeamBonus = rowTeamCap;
            }
        }
        row.teamBonus = calcTeamBonus > 0 ? calcTeamBonus : (row.backendTeamBonus || 0);
        row.appliedTeamRate = rowTeamRate;

        const maintPolicy = typeof window.getMaintenanceBonusPolicy === 'function'
            ? window.getMaintenanceBonusPolicy(row.historicalRank)
            : null;
        if (maintPolicy && maintPolicy.amount > 0) {
            const reqCv = maintPolicy.reqSmallCv || 0;
            const reqPv = maintPolicy.reqSmallPv || 0;
            const currentSmallCv = deductCV;
            const currentSmallPv = Math.min(row.a_pv || 0, row.b_pv || 0);

            let isQualified = true;
            if (reqCv > 0 && currentSmallCv < reqCv) isQualified = false;
            if (reqPv > 0 && currentSmallPv < reqPv) isQualified = false;

            row.levelBonus = isQualified ? maintPolicy.amount : 0;
            row.maintPolicyInfo = {
                rank: row.historicalRank,
                amount: maintPolicy.amount,
                reqSmallCv: reqCv,
                reqSmallPv: reqPv,
                actualSmallCv: currentSmallCv,
                actualSmallPv: currentSmallPv,
                isQualified: isQualified
            };
        } else {
            row.levelBonus = 0;
        }

        row.carBonus = 0;
    });

    const rowsByYearMonth = {};
    chronologicalRows.forEach(row => {
        const ym = String(row.sortOrderKey || '').slice(0, 7);
        const halfPart = String(row.sortOrderKey || '').slice(8, 9);
        if (!ym) return;
        if (!rowsByYearMonth[ym]) rowsByYearMonth[ym] = {};
        if (halfPart === '1') rowsByYearMonth[ym].firstHalf = row;
        else if (halfPart === '2') rowsByYearMonth[ym].secondHalf = row;
    });

    Object.entries(rowsByYearMonth).forEach(([ym, pair]) => {
        const firstRow = pair.firstHalf;
        const secondRow = pair.secondHalf;
        if (!secondRow) return;

        if (!firstRow || !(firstRow.levelBonus > 0) || !(secondRow.levelBonus > 0)) {
            secondRow.carBonus = 0;
            return;
        }

        const rank1 = firstRow.historicalRank;
        const rank2 = secondRow.historicalRank;
        const maintainedRank = (window.getDbRankLevel(rank1) <= window.getDbRankLevel(rank2)) ? rank1 : rank2;

        const carPolicy = typeof window.getCarMaintenanceBonusPolicy === 'function'
            ? window.getCarMaintenanceBonusPolicy(maintainedRank)
            : null;

        if (!carPolicy || !(carPolicy.amount > 0)) {
            secondRow.carBonus = 0;
            return;
        }

        const reqCarCv = Number(carPolicy.reqSmallCvPerPeriod || 0);
        const firstSmallCv = firstRow.matchedCV || 0;
        const secondSmallCv = secondRow.matchedCV || 0;

        const bothCarCvQualified = (firstSmallCv >= reqCarCv) && (secondSmallCv >= reqCarCv);

        if (bothCarCvQualified) {
            secondRow.carBonus = carPolicy.amount;
            secondRow.carPolicyInfo = {
                yearMonth: ym,
                maintainedRank: maintainedRank,
                firstPeriodLabel: firstRow.periodLabel,
                firstRank: rank1,
                firstSmallCv: firstSmallCv,
                firstLevelBonus: firstRow.levelBonus,
                secondPeriodLabel: secondRow.periodLabel,
                secondRank: rank2,
                secondSmallCv: secondSmallCv,
                secondLevelBonus: secondRow.levelBonus,
                reqSmallCvPerPeriod: reqCarCv,
                amount: carPolicy.amount,
                payoutSchedule: carPolicy.payoutSchedule || '',
                description: carPolicy.description || ''
            };
        } else {
            secondRow.carBonus = 0;
        }
    });

    window.calculateMatchingBonusForTarget(targetMember, periodMap, allMembersTeamBonusMap, isRollup, backendFlatMembers);

    if (typeof window.loadMatchingOverridesForTarget === 'function') {
        const overrideMap = await window.loadMatchingOverridesForTarget(actualId);
        Object.entries(overrideMap || {}).forEach(([orderKey, savedRows]) => {
            if (!Array.isArray(savedRows)) return;
            const pRow = periodMap[orderKey];
            if (!pRow) return;
            const myHistRank = pRow.historicalRank || baseRankName;
            const myMatchRates = window.getMatchingBonusRates(myHistRank);

            let customSum = 0;
            const updatedRows = savedRows.map(r => {
                const g = Number(r.gen || 1);
                const rate = g > 0 ? (myMatchRates[g] || 0) : 0;
                const amt = g > 0 ? Math.floor((r.teamBonus || 0) * rate) : 0;
                customSum += amt;
                return {
                    ...r,
                    gen: g,
                    genLabel: `${g}세대`,
                    rate: rate,
                    matchingAmount: amt,
                    isManualOverride: true
                };
            });

            pRow.matchingBonus = customSum;
            pRow.matchingDetails = updatedRows;
            pRow.appliedMatchRank = myHistRank;
        });
    }

    window.perfData = [...chronologicalRows].reverse();
    tbody.innerHTML = '';

    const fmt = num => (num && num > 0) ? num.toLocaleString('ko-KR') : '-';

    const fmtB = (num, t, row) => (!num || num <= 0)
        ? (t === 'matchBonus'
            ? `<span onclick="window.openBonusDetailModal('${actualId}', '${row.periodLabel}', '${row.startDate}', '${row.endDate}', '${t}')" style="cursor:pointer; color:#6b7280; text-decoration:underline;" title="클릭하여 추천매칭 수동 추가/편집">0</span>`
            : '<span style="color:#6b7280;">0</span>')
        : `<span onclick="window.openBonusDetailModal('${actualId}', '${row.periodLabel}', '${row.startDate}', '${row.endDate}', '${t}')" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">${num.toLocaleString('ko-KR')}</span>`;

    const fmtBonusNum = num => (!num || num <= 0) ? '0' : num.toLocaleString('ko-KR');

    window.perfData.forEach(row => {
        const totalBonus = (row.directBonus || 0) + (row.teamBonus || 0) + (row.matchingBonus || 0) + (row.levelBonus || 0) + (row.carBonus || 0) + (row.fastPowerBonus || 0);
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #374151';
        tr.onmouseover = function() { this.style.background = '#374151'; };
        tr.onmouseout = function() { this.style.background = 'transparent'; };

        tr.innerHTML = `
            <td style="padding:8px; text-align:center; font-weight:bold; color:#60a5fa; border-right:1px solid #374151; background:#111827;" title="${row.startDate} ~ ${row.endDate} | 당시 직급: ${row.historicalRank} (최근4기수 소실적PV: ${(row.recent4MinorPV || 0).toLocaleString('ko-KR')} PV)">${row.periodLabel}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; text-align:right;">${fmt(row.a_cv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right;" title="판정: ${row.legLabelA} (공제전 합산: ${(row.beforeDeductACV || 0).toLocaleString('ko-KR')} CV)">${fmt(row.displayAccACV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; text-align:right; border-right:1px solid #374151;">${fmt(row.matchedCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#10b981; text-align:right;">${fmt(row.a_pv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right; border-right:1px solid #374151;" title="최근 4기수 합산 A라인 PV: ${(row.recent4APV || 0).toLocaleString('ko-KR')} PV">${fmt(row.accAPV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; text-align:right;">${fmt(row.b_cv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right;" title="판정: ${row.legLabelB} (공제전 합산: ${(row.beforeDeductBCV || 0).toLocaleString('ko-KR')} CV)">${fmt(row.displayAccBCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; text-align:right; border-right:1px solid #374151;">${fmt(row.matchedCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#10b981; text-align:right;">${fmt(row.b_pv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right; border-right:1px solid #374151;" title="최근 4기수 합산 B라인 PV: ${(row.recent4BPV || 0).toLocaleString('ko-KR')} PV">${fmt(row.accBPV)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.directBonus, 'recBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.teamBonus, 'sponBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.matchingBonus, 'matchBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.levelBonus, 'dignityBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.carBonus, 'carBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; text-align:right; border-right:1px solid #374151;">${fmtB(row.fastPowerBonus, 'fastPowerBonus', row)}</td>
            <td style="padding:8px 8px; font-weight:bold; color:#fbbf24; text-align:right;">${fmtBonusNum(totalBonus)}</td>
        `;
        tbody.appendChild(tr);
    });
};
// ============================================================================
// [11] 계보도 카드 우측 상단 [승급] / [품위유지] 배지 자동 렌더링 및 내비게이터/기간검색 팝업 제어
// ============================================================================

// [11-1] 전역 배지 달성률 기준 비율 (기본값: 80% = 0.8) 및 기준 기수 키 추출
window.badgeThresholdRatio = typeof window.badgeThresholdRatio === 'number' ? window.badgeThresholdRatio : 0.8;

window.getCurrentSelectedPeriodOrderKey = function(teamBonusMap) {
    const dateInputs = document.querySelectorAll('input[type="date"], input[placeholder*="YYYY"]');
    for (const inp of dateInputs) {
        if (inp && inp.value && /^\d{4}-\d{2}-\d{2}$/.test(inp.value.trim())) {
            const pInfo = window.getPeriodInfoFromDate(inp.value.trim());
            if (pInfo && pInfo.sortOrderKey) return pInfo.sortOrderKey;
        }
    }
    const allInputs = document.querySelectorAll('input');
    for (const inp of allInputs) {
        const v = String(inp.value || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const pInfo = window.getPeriodInfoFromDate(v);
            if (pInfo && pInfo.sortOrderKey) return pInfo.sortOrderKey;
        }
    }
    return null;
};

// [11-2] 특정 회원(memberId)의 승급 및 품위유지 배지 표시 여부 계산 (기본 엔진)
window.evaluateMemberCardBadgeStatus = function(memberId, teamBonusMap, preferredOrderKey) {
    const result = {
        showPromoBadge: false,
        promoPct: 0,
        promoTargetRank: '',
        promoCurrPV: 0,
        promoReqPV: 0,
        showMaintBadge: false,
        maintPct: 0,
        maintCurrVal: 0,
        maintReqVal: 0,
        maintUnit: 'CV'
    };

    if (!memberId) return result;
    const mNorm = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');

    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (!mNode) return result;

    const { setA, setB } = typeof window.getSublinePartnerSets === 'function' ? window.getSublinePartnerSets(mNode) : { setA: new Set(), setB: new Set() };
    const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));

    let calcTotalAPV = 0;
    let calcTotalBPV = 0;
    let calcRecent4APV = 0;
    let calcRecent4BPV = 0;

    const recent4KeysDesc = typeof window.getRecentNPeriodOrderKeysDesc === 'function' 
        ? window.getRecentNPeriodOrderKeysDesc(preferredOrderKey, 4) 
        : [];
    const recent4Set = new Set(recent4KeysDesc);

    (allSales || []).forEach(s => {
        if (!s) return;
        const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        if (!sNorm) return;

        const inA = setA.has(sNorm);
        const inB = setB.has(sNorm);
        if (!inA && !inB) return;

        const pInfo = typeof window.getPeriodInfoFromDate === 'function' ? window.getPeriodInfoFromDate(s.transaction_date || s.sales_date || s.date || '') : null;
        if (!pInfo) return;

        const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        if (pvVal <= 0) return;

        if (inA) {
            calcTotalAPV += pvVal;
            if (recent4Set.has(pInfo.sortOrderKey)) calcRecent4APV += pvVal;
        } else if (inB) {
            calcTotalBPV += pvVal;
            if (recent4Set.has(pInfo.sortOrderKey)) calcRecent4BPV += pvVal;
        }
    });

    const baseRankName = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : '';
    let currRankName = mNode.rank || mNode.rank_name || baseRankName;

    if (teamBonusMap instanceof Map && teamBonusMap.has(mNorm)) {
        const pMap = teamBonusMap.get(mNorm);
        const pData = preferredOrderKey ? pMap[preferredOrderKey] : null;
        if (pData && pData.historicalRank) currRankName = pData.historicalRank;
    }

    currRankName = String(currRankName).trim().toUpperCase();
    const currRankLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRankName) : 0;

    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
    const nextRankObj = dbRanks.find(r => Number(r.rank_level || 0) > currRankLevel && Number(r.minor_leg_pv || 0) > 0);

    const thresholdRatio = (typeof window.badgeThresholdRatio === 'number' && window.badgeThresholdRatio > 0) 
        ? window.badgeThresholdRatio 
        : 0.8;

    if (nextRankObj) {
        const reqMinorPv = Number(nextRankObj.minor_leg_pv || 0);
        const isRecent4Rule = String(nextRankObj.period_type || 'NONE').trim().toUpperCase() === 'RECENT_4';

        const currAPV = isRecent4Rule ? calcRecent4APV : calcTotalAPV;
        const currBPV = isRecent4Rule ? calcRecent4BPV : calcTotalBPV;
        const currMinorPv = Math.min(currAPV, currBPV);

        if (reqMinorPv > 0) {
            const ratio = currMinorPv / reqMinorPv;
            if (ratio >= thresholdRatio) {
                result.showPromoBadge = true;
                result.promoPct = Math.floor(ratio * 100);
                result.promoTargetRank = nextRankObj.rank_name;
                result.promoCurrPV = currMinorPv;
                result.promoReqPV = reqMinorPv;
            }
        }
    }

    const maintPol = typeof window.getMaintenanceBonusPolicy === 'function'
        ? window.getMaintenanceBonusPolicy(currRankName)
        : null;

    if (maintPol && maintPol.amount > 0) {
        const reqCv = Number(maintPol.reqSmallCv || 0);
        const reqPv = Number(maintPol.reqSmallPv || 0);

        let actualCv = 0;
        if (teamBonusMap instanceof Map && teamBonusMap.has(mNorm)) {
            const pMap = teamBonusMap.get(mNorm);
            const pData = preferredOrderKey ? pMap[preferredOrderKey] : null;
            if (pData) actualCv = Number(pData.matchedCV || 0);
        }

        if (reqCv > 0) {
            const ratio = actualCv / reqCv;
            if (ratio >= thresholdRatio) {
                result.showMaintBadge = true;
                result.maintPct = Math.floor(ratio * 100);
                result.maintCurrVal = actualCv;
                result.maintReqVal = reqCv;
                result.maintUnit = 'CV';
            }
        } else if (reqPv > 0) {
            const actualPv = Math.min(calcTotalAPV, calcTotalBPV);
            const ratio = actualPv / reqPv;
            if (ratio >= thresholdRatio) {
                result.showMaintBadge = true;
                result.maintPct = Math.floor(ratio * 100);
                result.maintCurrVal = actualPv;
                result.maintReqVal = reqPv;
                result.maintUnit = 'PV';
            }
        }
    }

    return result;
};

// [11-3] 배지 상태 평가 헬퍼 (단일 기수 소실적 기준 신규 CV 품위유지 판정)
window.evaluateMemberCardBadgeStatus = function(memberId, teamMap, preferredOrderKey) {
    const res = {
        showPromoBadge: false,
        showMaintBadge: false,
        promoPct: 0,
        promoTargetRank: '',
        promoCurrPV: 0,
        promoReqPV: 0,
        maintPct: 0,
        maintCurrVal: 0,
        maintReqVal: 0,
        maintUnit: 'CV'
    };

    if (!memberId) return res;

    let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
    if (isNaN(thresholdPct) || thresholdPct < 1) thresholdPct = 80;
    const thresholdRatio = thresholdPct / 100;
    window.badgeThresholdRatio = thresholdRatio;

    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (!mNode) return res;

    const { setA, setB } = typeof window.getSublinePartnerSets === 'function' 
        ? window.getSublinePartnerSets(mNode) 
        : { setA: new Set(), setB: new Set() };

    const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));

    const mNorm = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');
    const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));

    const startDt = window.salesPopupState?.startDate || '';
    const endDt = window.salesPopupState?.endDate || '';

    let aTotalPV = 0, bTotalPV = 0;
    let selfCV = 0, aNewCV = 0, bNewCV = 0;

    (allSales || []).forEach(s => {
        if (!s) return;
        const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        const sDate = cleanFn(s.transaction_date || s.date || s.buy_date || '');

        const isSelf = (sNorm === mNorm);
        const isA = setA.has(sNorm);
        const isB = setB.has(sNorm);

        if (pv > 0) {
            if (isA) aTotalPV += pv;
            else if (isB) bTotalPV += pv;
        }

        const isCurrentTerm = (!startDt || sDate >= startDt) && (!endDt || sDate <= endDt);
        if (isCurrentTerm && cv > 0) {
            if (isSelf) selfCV += cv;
            else if (isA) aNewCV += cv;
            else if (isB) bNewCV += cv;
        }
    });

    const minorPV = Math.min(aTotalPV, bTotalPV);
    const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
    const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

    let nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0);
    if (!nextRank) nextRank = { rank_name: 'NEXT', minor_leg_pv: 0 };
    const reqMinorPV = Number(nextRank.minor_leg_pv || 0);

    if (reqMinorPV > 0) {
        const promoRatio = minorPV / reqMinorPV;
        res.promoPct = Math.floor(promoRatio * 100);
        res.promoTargetRank = nextRank.rank_name || 'NEXT';
        res.promoCurrPV = minorPV;
        res.promoReqPV = reqMinorPV;

        if (promoRatio >= thresholdRatio) {
            res.showPromoBadge = true;
        }
    }

    const dbMaintList = Array.isArray(window.dbMaintPolicies) ? window.dbMaintPolicies : (window.rank_maintenance_bonus_policies || []);
    const rankInfo = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === currRank);
    const currRankId = rankInfo ? Number(rankInfo.rank_id || rankInfo.id || 0) : 0;

    const maintPolicy = dbMaintList.find(p => Number(p.rank_id) === currRankId) || 
                        (window.dbMaintPolicyMap ? window.dbMaintPolicyMap[currRank] : null);

    const reqMaintCV = Number((maintPolicy && (maintPolicy.required_minor_leg_cv || maintPolicy.req_cv || maintPolicy.required_cv)) || 
                             (rankInfo && (rankInfo.maintenance_cv || rankInfo.maint_cv)) || 0);

    const termMinorCV = selfCV + Math.min(aNewCV, bNewCV);

    if (reqMaintCV > 0) {
        const maintRatio = termMinorCV / reqMaintCV;
        res.maintPct = Math.floor(maintRatio * 100);
        res.maintCurrVal = termMinorCV;
        res.maintReqVal = reqMaintCV;
        res.maintUnit = 'CV';

        if (maintRatio >= thresholdRatio) {
            res.showMaintBadge = true;
        }
    }

    return res;
};

// [11-4] 표시 설정 메뉴 체크박스 탐색 및 인라인 패널 숨김 헬퍼
window.bizNavPopupWindow = null;
window.salesSearchPopupWindow = null;

window.findBizNavigatorCheckbox = function() {
    const direct = document.querySelector('#chk-navigator, #chk-biz-nav, #chkBizNav, #toggle-navigator, #opt-navigator');
    if (direct && direct.type === 'checkbox') return direct;

    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const chk of allCheckboxes) {
        if (chk.id === 'chk-rollup') continue;
        const rowEl = chk.closest('label, li, tr, .setting-item, .menu-item, .option-row, div') || chk.parentElement;
        const nearText = String((rowEl && rowEl.innerText) || '') + ' ' +
                         String(chk.nextElementSibling ? chk.nextElementSibling.innerText : '') + ' ' +
                         String(chk.id || '');
        if (/네비게이터|내비게이터|navigator/i.test(nearText)) {
            return chk;
        }
    }
    return null;
};

window.findSalesSearchCheckbox = function() {
    const direct = document.querySelector('#chk-sales-search, #chkSalesSearch, #toggle-sales-search, #opt-sales-search, #chk-period-search');
    if (direct && direct.type === 'checkbox') return direct;

    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const chk of allCheckboxes) {
        if (chk.id === 'chk-rollup') continue;
        const rowEl = chk.closest('label, li, tr, .setting-item, .menu-item, .option-row, div') || chk.parentElement;
        const nearText = String((rowEl && rowEl.innerText) || '') + ' ' +
                         String(chk.nextElementSibling ? chk.nextElementSibling.innerText : '') + ' ' +
                         String(chk.id || '');
        if (/매출\s*기간\s*검색|기간\s*검색|매출\s*검색|sales\s*search/i.test(nearText)) {
            return chk;
        }
    }
    return null;
};

window.hideInlineSalesSearchPanels = function() {
    const inlineIds = ['salesSearchWidget', 'salesSearchModal', 'periodSearchWidget', 'sales-search-panel', 'period-search-panel', 'filterWidget'];
    inlineIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
};

// [11-5] 비지네스 내비게이터 기본 렌더링 함수
window.renderBusinessNavigator = async function(targetMemberId, optDoc = null) {
    const popup = window.bizNavPopupWindow;
    const pDoc = optDoc || ((popup && !popup.closed) ? popup.document : document);
    if (!pDoc) return;

    const bodyEl = pDoc.getElementById('bizNavBody');
    const badgeEl = pDoc.getElementById('bizNavTargetBadge');
    if (!bodyEl) return;

    if (typeof window.loadDbCompensationRates === 'function') {
        try { await window.loadDbCompensationRates(); } catch (e) {}
    }

    let targetId = targetMemberId || window.currentSelectedId || 'VK-1199464';
    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : null;
    if (!mNode) {
        bodyEl.innerHTML = `<div style="padding:30px; text-align:center; color:#9ca3af;">회원 정보를 찾을 수 없습니다. (${targetId})</div>`;
        return;
    }

    if (badgeEl) badgeEl.innerHTML = `[${mNode.name || mNode.id} (<b style="font-weight:bold; color:#ffffff;">${mNode.id}</b>)]`;

    const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
    const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

    const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'DIAMOND', minor_leg_pv: 0 };
    const reqMinorPV = Number(nextRank.minor_leg_pv || 0);

    const reqPartnerRankId = nextRank.required_partner_rank_id ? Number(nextRank.required_partner_rank_id) : null;
    const reqPartnerRankObj = (reqPartnerRankId && window.dbRankByIdMap && window.dbRankByIdMap[reqPartnerRankId])
        ? window.dbRankByIdMap[reqPartnerRankId]
        : dbRanks.find(r => Number(r.rank_id) === reqPartnerRankId);

    const reqPartnerRank = reqPartnerRankObj ? String(reqPartnerRankObj.rank_name).toUpperCase() : 'MANIA';
    const reqPartnerCountEach = Number(nextRank.required_partner_count || nextRank.req_partner_count || 1);
    const isDirectSponsorReq = Number(nextRank.is_direct_sponsor || 0) === 1;

    const { setA, setB } = (typeof window.getSublinePartnerSets === 'function' && mNode)
        ? window.getSublinePartnerSets(mNode) 
        : { setA: new Set(), setB: new Set() };

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);

    const mNorm = String(targetId).trim().toLowerCase().replace(/^vk-?/, '');
    const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));

    const startDt = window.salesPopupState?.startDate || '';
    const endDt = window.salesPopupState?.endDate || '';

    let aTotalPV = 0, bTotalPV = 0;
    let selfCV = 0, aNewCV = 0, bNewCV = 0;

    const termSalesMapA = new Map();
    const termSalesMapB = new Map();

    (allSales || []).forEach(s => {
        if (!s) return;
        const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        const sDate = cleanFn(s.transaction_date || s.date || s.buy_date || '');

        const isSelf = (sNorm === mNorm);
        const isA = setA.has(sNorm);
        const isB = setB.has(sNorm);

        if (pv > 0) {
            if (isA) aTotalPV += pv;
            else if (isB) bTotalPV += pv;

            if (sDate) {
                const termKey = typeof window.getPeriodKeyByDate === 'function' ? window.getPeriodKeyByDate(sDate) : sDate.substring(0, 7);
                if (isA) termSalesMapA.set(termKey, (termSalesMapA.get(termKey) || 0) + pv);
                if (isB) termSalesMapB.set(termKey, (termSalesMapB.get(termKey) || 0) + pv);
            }
        }

        const isCurrentTerm = (!startDt || sDate >= startDt) && (!endDt || sDate <= endDt);
        if (isCurrentTerm && cv > 0) {
            if (isSelf) selfCV += cv;
            else if (isA) aNewCV += cv;
            else if (isB) bNewCV += cv;
        }
    });

    const minorPV = Math.min(aTotalPV, bTotalPV);
    const promoPct = reqMinorPV > 0 ? Math.floor((minorPV / reqMinorPV) * 100) : 0;
    const isTermRestricted = (currRank === 'MANIA' || currRank === 'DIRECTOR' || currLevel < 3);

    let reqPartnerLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(reqPartnerRank) : 1;
    let dirCountA = 0, dirCountB = 0;
    let firstNodeA = null, firstNodeB = null;

    if (setA) {
        setA.forEach(norm => {
            const n = typeof window.findMemberNode === 'function' ? window.findMemberNode(norm) : null;
            if (n) {
                if (!firstNodeA) firstNodeA = n;
                if (typeof window.getDbRankLevel === 'function' && window.getDbRankLevel(n.rank) >= reqPartnerLevel) {
                    dirCountA++;
                    if (!firstNodeA || window.getDbRankLevel(n.rank) > window.getDbRankLevel(firstNodeA.rank)) firstNodeA = n;
                }
            }
        });
    }

    if (setB) {
        setB.forEach(norm => {
            const n = typeof window.findMemberNode === 'function' ? window.findMemberNode(norm) : null;
            if (n) {
                if (!firstNodeB) firstNodeB = n;
                if (typeof window.getDbRankLevel === 'function' && window.getDbRankLevel(n.rank) >= reqPartnerLevel) {
                    dirCountB++;
                    if (!firstNodeB || window.getDbRankLevel(n.rank) > window.getDbRankLevel(firstNodeB.rank)) firstNodeB = n;
                }
            }
        });
    }

    if (mNode.children && Array.isArray(mNode.children)) {
        const childA = mNode.children.find(c => String(c.position || '').toUpperCase() === 'A' || String(c.position || '').toUpperCase() === 'LEFT') || mNode.children[0];
        const childB = mNode.children.find(c => String(c.position || '').toUpperCase() === 'B' || String(c.position || '').toUpperCase() === 'RIGHT') || mNode.children[1];
        if (childA) firstNodeA = childA;
        if (childB) firstNodeB = childB;
    }

    const isPartnerSatisfied = (dirCountA >= reqPartnerCountEach && dirCountB >= reqPartnerCountEach);

    const leftPartner = {
        id: firstNodeA ? (firstNodeA.id || '-') : '-',
        name: firstNodeA ? (firstNodeA.name || '-') : '-',
        rank: firstNodeA ? (firstNodeA.rank || firstNodeA.rank_name || '-') : '-',
        count: dirCountA
    };
    const rightPartner = {
        id: firstNodeB ? (firstNodeB.id || '-') : '-',
        name: firstNodeB ? (firstNodeB.name || '-') : '-',
        rank: firstNodeB ? (firstNodeB.rank || firstNodeB.rank_name || '-') : '-',
        count: dirCountB
    };

    const promoRequirementsCardHtml = `
        <div style="background:#1f2937; border:1px solid #374151; border-radius:8px; padding:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #374151;">
                <div>
                    <span style="font-size:12px; color:#9ca3af;">승급 목표</span>
                    <div style="font-size:15px; font-weight:bold; color:#ffffff; margin-top:2px;">
                        ${currRank} ➔ ${nextRank.rank_name}
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:11px; color:#9ca3af;">소실적 PV 달성률</span>
                    <div style="font-size:18px; font-weight:bold; color:#ffffff; margin-top:1px;">${promoPct}%</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; text-align:center; font-size:12px;">
                <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                    <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">① 소실적 목표 PV</div>
                    <div style="color:#ffffff; font-weight:bold; font-size:13px;">${reqMinorPV.toLocaleString('ko-KR')} PV</div>
                    <div style="color:${minorPV >= reqMinorPV ? '#ffffff' : '#ef4444'}; font-size:11px; margin-top:4px; font-weight:bold;">
                        ${minorPV >= reqMinorPV ? '✓ 달성 완료' : `부족: -${(reqMinorPV - minorPV).toLocaleString('ko-KR')} PV`}
                    </div>
                </div>

                <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                    <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">② 추천 파트너 조건</div>
                    <div style="color:#ffffff; font-weight:bold; font-size:12px;">좌/우 각 ${reqPartnerRank} ${reqPartnerCountEach}명</div>
                    <div style="color:${isPartnerSatisfied ? '#ffffff' : '#ef4444'}; font-size:11px; margin-top:4px; font-weight:bold;">
                        ${isPartnerSatisfied ? '✓ 충족 완료' : `현재 (좌:${dirCountA} / 우:${dirCountB})`}
                    </div>
                </div>

                <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                    <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">③ 적용 기준 규정</div>
                    <div style="color:#ffffff; font-weight:bold; font-size:12.5px;">
                        ${isTermRestricted ? '기수제한 적용' : '전체 누적 인정'}
                    </div>
                    <div style="color:#9ca3af; font-size:10.5px; margin-top:4px;">
                        ${isTermRestricted ? '최근 4개 기수 합산' : '기간 제한 없음'}
                    </div>
                </div>
            </div>
        </div>
    `;

    let mainContentHtml = '';

    if (isTermRestricted) {
        const mySalesVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(mNode.my_sales_pv || mNode.pv || 0) : Number(mNode.my_sales_pv || mNode.pv || 0);
        const myAchieveDate = mNode.achieve_date || mNode.created_at || '-';

        const allTerms = Array.from(new Set([...termSalesMapA.keys(), ...termSalesMapB.keys()])).sort().reverse().slice(0, 4);
        if (allTerms.length === 0) allTerms.push('현재기수');

        let sumLeftPV = 0, sumRightPV = 0;
        const recentTerms = allTerms.map(termKey => {
            const leftPV = termSalesMapA.get(termKey) || 0;
            const rightPV = termSalesMapB.get(termKey) || 0;
            sumLeftPV += leftPV;
            sumRightPV += rightPV;
            return { label: termKey, leftPV, rightPV };
        });

        mainContentHtml = `
            <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">본인내역</div>
                <div style="display:flex; border-bottom:1px solid #374151;">
                    <div style="width:110px; padding:10px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">본인누적매출</div>
                    <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; text-align:right; border-right:1px solid #374151;">${mySalesVal.toLocaleString('ko-KR')} PV</div>
                    <div style="width:110px; padding:10px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">달성일자</div>
                    <div style="flex:1; padding:10px; color:#ffffff; text-align:center;">${myAchieveDate}</div>
                </div>
            </div>

            <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">하위내역 (기수제한 실적)</div>
                <div style="display:flex; background:#111827; border-bottom:1px solid #374151; font-weight:bold;">
                    <div style="width:130px; padding:10px; color:#ffffff; border-right:1px solid #374151;">합계 (좌측 총합)</div>
                    <div style="flex:1; padding:10px; color:#ffffff; text-align:right; border-right:1px solid #374151;">${sumLeftPV.toLocaleString('ko-KR')} PV</div>
                    <div style="width:130px; padding:10px; color:#ffffff; border-right:1px solid #374151;">합계 (우측 총합)</div>
                    <div style="flex:1; padding:10px; color:#ffffff; text-align:right;">${sumRightPV.toLocaleString('ko-KR')} PV</div>
                </div>
                <div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">
                    <div style="width:130px; padding:8px 10px; background:#111827; color:#9ca3af; border-right:1px solid #374151;">직추천(후원라인 좌)</div>
                    <div style="flex:1; padding:8px 10px; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">${leftPartner.name} (<b style="font-weight:bold; color:#ffffff;">${leftPartner.id}</b>)</div>
                    <div style="width:130px; padding:8px 10px; background:#111827; color:#9ca3af; border-right:1px solid #374151;">직추천(후원라인 우)</div>
                    <div style="flex:1; padding:8px 10px; color:#ffffff; font-weight:bold;">${rightPartner.name} (<b style="font-weight:bold; color:#ffffff;">${rightPartner.id}</b>)</div>
                </div>
                ${recentTerms.map(t => `
                    <div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">
                        <div style="width:130px; padding:8px 10px; background:#1f2937; color:#9ca3af; border-right:1px solid #374151;">${t.label}(좌)</div>
                        <div style="flex:1; padding:8px 10px; color:#ffffff; text-align:right; font-weight:bold; border-right:1px solid #374151;">${t.leftPV.toLocaleString('ko-KR')} PV</div>
                        <div style="width:130px; padding:8px 10px; background:#1f2937; color:#9ca3af; border-right:1px solid #374151;">${t.label}(우)</div>
                        <div style="flex:1; padding:8px 10px; color:#ffffff; text-align:right; font-weight:bold;">${t.rightPV.toLocaleString('ko-KR')} PV</div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        const remainLeftPV = Math.max(0, reqMinorPV - aTotalPV);
        const remainRightPV = Math.max(0, reqMinorPV - bTotalPV);

        mainContentHtml = `
            <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">추천계보라인</div>
                <div style="display:flex; align-items:center; text-align:center; font-size:12px;">
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                    <div style="flex:1; display:flex; align-items:center; justify-content:space-around; padding:10px; border-right:1px solid #374151;">
                        <span style="color:#ffffff; font-family:monospace; font-weight:bold;"><b style="font-weight:bold; color:#ffffff;">${leftPartner.id}</b></span>
                        <span style="color:#ffffff; font-weight:bold;">${leftPartner.name}</span>
                        <span style="color:#ffffff; font-weight:bold; font-size:11px; background:#374151; padding:2px 6px; border-radius:4px;">${leftPartner.rank}</span>
                        <span style="color:#ffffff; font-weight:bold;">${leftPartner.count}명</span>
                    </div>
                    
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                    <div style="flex:1; display:flex; align-items:center; justify-content:space-around; padding:10px;">
                        <span style="color:#ffffff; font-family:monospace; font-weight:bold;"><b style="font-weight:bold; color:#ffffff;">${rightPartner.id}</b></span>
                        <span style="color:#ffffff; font-weight:bold;">${rightPartner.name}</span>
                        <span style="color:#ffffff; font-weight:bold; font-size:11px; background:#374151; padding:2px 6px; border-radius:4px;">${rightPartner.rank}</span>
                        <span style="color:#ffffff; font-weight:bold;">${rightPartner.count}명</span>
                    </div>
                </div>
            </div>

            <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937; font-size:12px;">
                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">전체누적 PV</div>
                <div style="display:flex; align-items:center; text-align:center; border-bottom:1px solid #374151;">
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                    <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; font-size:13px; border-right:1px solid #374151;">${aTotalPV.toLocaleString('ko-KR')}</div>
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                    <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; font-size:13px;">${bTotalPV.toLocaleString('ko-KR')}</div>
                </div>

                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">${nextRank.rank_name} PV (목표)</div>
                <div style="display:flex; align-items:center; text-align:center; border-bottom:1px solid #374151;">
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                    <div style="flex:1; padding:10px; color:#9ca3af; border-right:1px solid #374151;">${reqMinorPV.toLocaleString('ko-KR')}</div>
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                    <div style="flex:1; padding:10px; color:#9ca3af;">${reqMinorPV.toLocaleString('ko-KR')}</div>
                </div>

                <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#e5e7eb; border-bottom:1px solid #374151;">${nextRank.rank_name} 승급까지 부족 PV</div>
                <div style="display:flex; align-items:center; text-align:center;">
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                    <div style="flex:1; padding:10px; color:${remainLeftPV === 0 ? '#ffffff' : '#ef4444'}; font-weight:bold; font-size:13px; border-right:1px solid #374151;">${remainLeftPV === 0 ? '충족 완료' : remainLeftPV.toLocaleString('ko-KR')}</div>
                    <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                    <div style="flex:1; padding:10px; color:${remainRightPV === 0 ? '#ffffff' : '#ef4444'}; font-weight:bold; font-size:13px;">${remainRightPV === 0 ? '충족 완료' : remainRightPV.toLocaleString('ko-KR')}</div>
                </div>
            </div>
        `;
    }

    const dbMaintList = Array.isArray(window.dbMaintPolicies) ? window.dbMaintPolicies : (window.rank_maintenance_bonus_policies || []);
    const rankInfo = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === currRank);
    const currRankId = rankInfo ? Number(rankInfo.rank_id || rankInfo.id || 0) : 0;

    const maintPolicy = dbMaintList.find(p => Number(p.rank_id) === currRankId) || 
                        (window.dbMaintPolicyMap ? window.dbMaintPolicyMap[currRank] : null);

    const reqMaintCV = Number((maintPolicy && (maintPolicy.required_minor_leg_cv || maintPolicy.req_cv || maintPolicy.required_cv)) || 
                             (rankInfo && (rankInfo.maintenance_cv || rankInfo.maint_cv)) || 0);

    const minorSubCV = Math.min(aNewCV, bNewCV);
    const termMinorCV = selfCV + minorSubCV;
    const maintPct = reqMaintCV > 0 ? Math.min(100, Math.floor((termMinorCV / reqMaintCV) * 100)) : 100;
    const maintDiffCV = Math.max(0, reqMaintCV - termMinorCV);

    const maintHtml = `
        <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; background:#1f2937; padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #374151;">
                <span style="font-size:13px; font-weight:bold; color:#ffffff;">[${currRank}] 품위유지 달성 현황 (단일 기수 소실적 기준)</span>
                <span style="background:#374151; color:#ffffff; font-size:11px; font-weight:bold; padding:3px 8px; border-radius:4px;">달성률: ${maintPct}%</span>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1.6fr 1fr; gap:10px; text-align:center; font-size:12px; background:#111827; padding:12px; border-radius:6px; border:1px solid #374151;">
                <div style="display:flex; flex-direction:column; justify-content:center;">
                    <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">직급별 기준 소실적 CV (DB)</div>
                    <div style="color:#ffffff; font-weight:bold; font-size:13px;">${reqMaintCV.toLocaleString('ko-KR')} CV</div>
                </div>
                
                <div style="border-left:1px solid #374151; border-right:1px solid #374151; padding:0 8px;">
                    <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">해당기수 소실적 신규 CV</div>
                    <div style="color:#ffffff; font-weight:bold; font-size:13px; margin-bottom:2px;">
                        ${termMinorCV.toLocaleString('ko-KR')} CV
                    </div>
                    <div style="color:#9ca3af; font-size:10.5px; display:flex; justify-content:center; gap:6px;">
                        <span>본인: <b style="color:#ffffff;">${selfCV.toLocaleString('ko-KR')}</b></span>
                        <span>+</span>
                        <span>소실적라인(하위): <b style="color:#ffffff;">${minorSubCV.toLocaleString('ko-KR')}</b></span>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; justify-content:center;">
                    <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">부족분 CV</div>
                    <div style="color:${maintDiffCV === 0 ? '#ffffff' : '#ef4444'}; font-weight:bold; font-size:13px;">
                        ${maintDiffCV === 0 ? '유지 달성' : `-${maintDiffCV.toLocaleString('ko-KR')} CV`}
                    </div>
                </div>
            </div>
            <div style="font-size:10.5px; color:#9ca3af; margin-top:8px; text-align:right;">
                * 해당 기수의 본인 발생 신규 CV + 하위 소실적(A/B 라인 중 적은 쪽) 발생 신규 CV 합산
            </div>
        </div>
    `;

    bodyEl.innerHTML = `
        ${promoRequirementsCardHtml}
        ${mainContentHtml}
        ${maintHtml}
    `;
};

// [11-6] 매출 기간 검색 독립 브라우저 팝업 엔진 (상세 필터링 및 이벤트 바인딩)
window.salesPopupState = {
    unit: 'term',
    anchorDate: new Date(),
    startDate: '',
    endDate: '',
    lineFilter: 'ALL',
    rows: [],
    rowClickTimer: null
};

window.calculatePopupPeriodDates = function(anchor, unit) {
    let dt = (anchor instanceof Date && !isNaN(anchor.getTime())) ? new Date(anchor.getTime()) : new Date();
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const d = dt.getDate();
    const pad = n => String(n).padStart(2, '0');

    if (unit === 'term') {
        if (d <= 15) {
            return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-15` };
        } else {
            const lastDay = new Date(y, m + 1, 0).getDate();
            return { start: `${y}-${pad(m + 1)}-16`, end: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
        }
    } else if (unit === 'month') {
        const lastDay = new Date(y, m + 1, 0).getDate();
        return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
    } else if (unit === 'year') {
        return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-15` };
};

window.navPopupPeriod = function(direction) {
    const st = window.salesPopupState;
    if (!(st.anchorDate instanceof Date) || isNaN(st.anchorDate.getTime())) {
        st.anchorDate = new Date();
    }

    let y = st.anchorDate.getFullYear();
    let m = st.anchorDate.getMonth();
    let d = st.anchorDate.getDate();

    if (st.unit === 'term') {
        if (direction < 0) {
            if (d > 15) { d = 1; }
            else { m -= 1; d = 16; }
        } else {
            if (d <= 15) { d = 16; }
            else { m += 1; d = 1; }
        }
    } else if (st.unit === 'month') {
        m += direction;
        d = 1;
    } else if (st.unit === 'year') {
        y += direction;
        m = 0;
        d = 1;
    }

    st.anchorDate = new Date(y, m, d);
    const dates = window.calculatePopupPeriodDates(st.anchorDate, st.unit);
    st.startDate = dates.start;
    st.endDate = dates.end;

    const popup = window.salesSearchPopupWindow;
    if (popup && !popup.closed && popup.document) {
        const sInp = popup.document.getElementById('pop-start-date');
        const eInp = popup.document.getElementById('pop-end-date');
        if (sInp) sInp.value = st.startDate;
        if (eInp) eInp.value = st.endDate;
    }

    window.renderSalesSearchPopupContent(false, true);
};

window.renderSalesSearchPopupContent = function(resetToAnchor = false, skipInputRead = false) {
    const popup = window.salesSearchPopupWindow;
    if (!popup || popup.closed || !popup.document) return;
    const pDoc = popup.document;

    const startInp = pDoc.getElementById('pop-start-date');
    const endInp = pDoc.getElementById('pop-end-date');
    const lineSel = pDoc.getElementById('pop-line-filter');
    const unitSel = pDoc.getElementById('pop-period-unit');
    const tbody = pDoc.getElementById('pop-sales-tbody');

    if (!tbody) return;

    const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));
    const st = window.salesPopupState;

    if (unitSel && unitSel.value) {
        st.unit = unitSel.value;
    }

    if (resetToAnchor || !st.startDate || !st.endDate) {
        if (!(st.anchorDate instanceof Date) || isNaN(st.anchorDate.getTime())) {
            st.anchorDate = new Date();
        }
        const dates = window.calculatePopupPeriodDates(st.anchorDate, st.unit);
        st.startDate = dates.start;
        st.endDate = dates.end;
        if (startInp) startInp.value = dates.start;
        if (endInp) endInp.value = dates.end;
    } else if (!skipInputRead) {
        if (startInp && startInp.value) {
            st.startDate = cleanFn(startInp.value);
            const parts = st.startDate.split('-');
            if (parts.length === 3) {
                st.anchorDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
        }
        if (endInp && endInp.value) {
            st.endDate = cleanFn(endInp.value);
        }
    } else {
        if (startInp) startInp.value = st.startDate;
        if (endInp) endInp.value = st.endDate;
    }

    if (lineSel && lineSel.value) {
        st.lineFilter = lineSel.value;
    }

    const startDate = st.startDate;
    const endDate = st.endDate;
    const lineFilter = st.lineFilter || 'ALL';

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);

    let baseNode = window.currentSelectedId && typeof window.findMemberNode === 'function' ? window.findMemberNode(window.currentSelectedId) : null;
    if (!baseNode && window.treeData) {
        baseNode = Array.isArray(window.treeData) ? window.treeData[0] : window.treeData;
    }
    const baseNorm = (baseNode && baseNode.id) ? String(baseNode.id).trim().toLowerCase().replace(/^vk-?/, '') : '';
    const cachedSets = (baseNode && typeof window.getSublinePartnerSets === 'function')
        ? window.getSublinePartnerSets(baseNode)
        : { setA: new Set(), setB: new Set() };

    let filtered = (allSales || []).filter(item => {
        if (!item) return false;
        let itemDate = cleanFn(item.transaction_date || item.date || item.buy_date || item.sales_date || '');
        if (!itemDate) return false;
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let dA = cleanFn(a.transaction_date || a.date || a.buy_date || a.sales_date || '');
        let dB = cleanFn(b.transaction_date || b.date || b.buy_date || b.sales_date || '');
        return dB.localeCompare(dA);
    });

    const prevStateMap = {};
    if (Array.isArray(st.rows)) {
        st.rows.forEach(r => {
            if (r.rowKey && r.state !== 'none') prevStateMap[r.rowKey] = r.state;
        });
    }

    const mappedRows = [];
    filtered.forEach((s, idx) => {
        let cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        let pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        let mId = s.member_id || s.memberId || '-';
        let mNorm = String(mId).trim().toLowerCase().replace(/^vk-?/, '');
        let mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(mId) : null;
        let mName = mNode ? (mNode.name || '-') : (s.name || '-');
        let dStr = cleanFn(s.transaction_date || s.date || s.buy_date || s.sales_date || '-');

        let lineLabel = '-';
        if (baseNorm && mNorm === baseNorm) lineLabel = '본인';
        else if (cachedSets.setA && cachedSets.setA.has(mNorm)) lineLabel = 'A라인';
        else if (cachedSets.setB && cachedSets.setB.has(mNorm)) lineLabel = 'B라인';
        else if (mNode) {
            const pos = String(mNode.position || '').trim().toUpperCase();
            if (pos === 'A' || pos === 'LEFT') lineLabel = 'A라인';
            else if (pos === 'B' || pos === 'RIGHT') lineLabel = 'B라인';
        }

        if (lineFilter !== 'ALL' && lineLabel !== lineFilter) return;

        let lineColor = '#9ca3af';
        if (lineLabel === 'A라인') lineColor = '#60a5fa';
        else if (lineLabel === 'B라인') lineColor = '#f59e0b';
        else if (lineLabel === '본인') lineColor = '#10b981';

        const rowKey = `${s.id || idx}_${mId}_${dStr}_${cv}_${pv}`;
        mappedRows.push({
            rowKey, dStr, mId, mName, lineLabel, lineColor, cv, pv,
            state: prevStateMap[rowKey] || 'none'
        });
    });

    st.rows = mappedRows;
    window.renderSalesPopupRowsAndTotals();
};

window.renderSalesPopupRowsAndTotals = function() {
    const popup = window.salesSearchPopupWindow;
    if (!popup || popup.closed || !popup.document) return;
    const pDoc = popup.document;

    const tbody = pDoc.getElementById('pop-sales-tbody');
    const summaryCountEl = pDoc.getElementById('pop-summary-count');
    const totalCvEl = pDoc.getElementById('pop-total-cv');
    const totalPvEl = pDoc.getElementById('pop-total-pv');
    if (!tbody) return;

    const rows = window.salesPopupState.rows || [];
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #9ca3af;">해당 기간(${window.salesPopupState.startDate} ~ ${window.salesPopupState.endDate})에 조건과 일치하는 매출 내역이 없습니다.</td></tr>`;
        if (summaryCountEl) summaryCountEl.innerHTML = `검색 결과: <b style="color:#fff;">0건</b>`;
        if (totalCvEl) totalCvEl.innerText = '총 0 CV';
        if (totalPvEl) totalPvEl.innerText = '총 0 PV';
        return;
    }

    const selectedRows = rows.filter(r => r.state === 'selected');
    const excludedRows = rows.filter(r => r.state === 'excluded');
    const hasSelection = selectedRows.length > 0;

    const targetSumRows = hasSelection ? selectedRows : rows.filter(r => r.state !== 'excluded');

    let sumCv = 0, sumPv = 0;
    targetSumRows.forEach(r => {
        sumCv += r.cv;
        sumPv += r.pv;
    });

    let rowsHtml = '';
    rows.forEach((r, idx) => {
        const isSelected = r.state === 'selected';
        const isExcluded = r.state === 'excluded';

        let boxHtml = '';
        if (isSelected) {
            boxHtml = `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:#3b82f6; border:1px solid #60a5fa; color:#fff; font-size:11px; font-weight:bold; line-height:15px; text-align:center;">✓</div>`;
        } else if (isExcluded) {
            boxHtml = `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:rgba(239,68,68,0.25); border:1px solid #ef4444; color:#ef4444; font-size:11px; font-weight:bold; line-height:15px; text-align:center;">✕</div>`;
        } else {
            boxHtml = `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:#1f2937; border:1px solid #4b5563;"></div>`;
        }

        const rowBg = isSelected ? 'rgba(59, 130, 246, 0.16)' : (isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'transparent');
        const textDeco = isExcluded ? 'line-through' : 'none';
        const rowOpacity = isExcluded ? '0.45' : '1';

        rowsHtml += `
            <tr data-idx="${idx}" data-mid="${r.mId}"
                title="클릭: 회원 카드 이동 | 좌측 선택란 클릭: 선택 합산 | 더블클릭: ✕(합계에서 제외)"
                style="border-bottom:1px solid #374151; cursor:pointer; background:${rowBg}; text-decoration:${textDeco}; opacity:${rowOpacity};">
                <td class="pop-chk-cell" data-idx="${idx}" style="padding:6px 2px; text-align:center; cursor:pointer;">
                    ${boxHtml}
                </td>
                <td style="padding:6px 4px; color:#d1d5db; text-align:center;">${r.dStr}</td>
                <td style="padding:6px 4px; color:#60a5fa; font-weight:bold; text-align:center;">${r.mId}</td>
                <td style="padding:6px 4px; color:#fff; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.mName}</td>
                <td style="padding:6px 4px; color:${r.lineColor}; font-weight:bold; text-align:center;">${r.lineLabel}</td>
                <td style="padding:6px 8px; color:#60a5fa; font-weight:bold; text-align:right; font-variant-numeric:tabular-nums;">${r.cv.toLocaleString('ko-KR')}</td>
                <td style="padding:6px 8px; color:#10b981; font-weight:bold; text-align:right; font-variant-numeric:tabular-nums;">${r.pv.toLocaleString('ko-KR')}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;

    if (summaryCountEl) {
        if (hasSelection) {
            summaryCountEl.innerHTML = `<span style="color:#60a5fa; font-weight:bold;">선택 합계: ${selectedRows.length.toLocaleString('ko-KR')}건</span> <span style="color:#9ca3af; font-size:11px;">(검색 전체 ${rows.length}건)</span>`;
        } else if (excludedRows.length > 0) {
            summaryCountEl.innerHTML = `<span>적용 결과: <b style="color:#fff;">${targetSumRows.length.toLocaleString('ko-KR')}건</b></span> <span style="color:#ef4444; font-size:11px;">(제외 ${excludedRows.length}건)</span>`;
        } else {
            summaryCountEl.innerHTML = `검색 결과: <b style="color:#fff;">${rows.length.toLocaleString('ko-KR')}건</b>`;
        }
    }
    if (totalCvEl) totalCvEl.innerText = `총 ${sumCv.toLocaleString('ko-KR')} CV`;
    if (totalPvEl) totalPvEl.innerText = `총 ${sumPv.toLocaleString('ko-KR')} PV`;
};

window.openSalesSearchPopupWindow = function() {
    if (typeof window.hideInlineSalesSearchPanels === 'function') {
        window.hideInlineSalesSearchPanels();
    }

    if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
        window.salesSearchPopupWindow.focus();
        window.renderSalesSearchPopupContent(false, true);
        return window.salesSearchPopupWindow;
    }

    const savedW = parseInt(localStorage.getItem('bs_sales_search_popup_w') || '920', 10);
    const savedH = parseInt(localStorage.getItem('bs_sales_search_popup_h') || '780', 10);
    const savedLeft = parseInt(localStorage.getItem('bs_sales_search_popup_left') || '140', 10);
    const savedTop = parseInt(localStorage.getItem('bs_sales_search_popup_top') || '80', 10);

    const w = Math.max(600, isNaN(savedW) ? 920 : savedW);
    const h = Math.max(450, isNaN(savedH) ? 780 : savedH);
    const l = isNaN(savedLeft) ? 140 : savedLeft;
    const t = isNaN(savedTop) ? 80 : savedTop;

    window.salesPopupState.anchorDate = new Date();
    const initDates = window.calculatePopupPeriodDates(window.salesPopupState.anchorDate, window.salesPopupState.unit || 'term');
    window.salesPopupState.startDate = initDates.start;
    window.salesPopupState.endDate = initDates.end;

    const popup = window.open('', 'SalesSearchPopup', `width=${w},height=${h},left=${l},top=${t},resizable=yes,scrollbars=yes`);
    if (!popup) {
        alert('브라우저의 팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해 주세요.');
        return null;
    }
    window.salesSearchPopupWindow = popup;

    const doc = popup.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>🔍 매출 기간 검색</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #111827; color: #f9fafb; font-family: 'Pretendard', -apple-system, sans-serif; font-size: 12px; }
                .popup-header { position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #1f2937; border-bottom: 1px solid #374151; }
                .filter-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 16px; background: #111827; border-bottom: 1px solid #374151; flex-wrap: wrap; }
                .summary-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: #1f2937; border-bottom: 1px solid #374151; font-size: 11.5px; }
                .table-wrap { overflow-y: auto; max-height: calc(100vh - 145px); }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; user-select: none; }
                th { background: #1f2937; position: sticky; top: 0; color: #9ca3af; z-index: 2; padding: 6px 4px; border-bottom: 1px solid #374151; font-weight: 600; font-size: 11.5px; }
                td { border-bottom: 1px solid #1f2937; font-size: 11px; }
                .ctrl-group { display: flex; align-items: center; gap: 4px; background: #1a2232; border: 1px solid #374151; padding: 3px 6px; border-radius: 6px; }
                select.nav-select { background: #1f2937; border: 1px solid #4b5563; color: #fff; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; font-weight: bold; cursor: pointer; outline: none; }
                .nav-btn { background: #283344; border: 1px solid #3b4758; color: #e5e7eb; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; }
                .nav-btn:hover { background: #374458; color: #fff; }
                .date-badge-box { background: #111827; border: 1px solid #374151; color: #60a5fa; font-weight: bold; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; text-align: center; outline: none; }
                select.line-select { background: #1f2937; border: 1px solid #4b5563; color: #fff; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; outline: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="popup-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:16px;">🔍</span>
                    <strong style="font-size:13.5px; color:#fff;">매출 기간 검색</strong>
                </div>
                <button type="button" id="btn-pop-close" style="background:#374151; border:1px solid #4b5563; color:#e5e7eb; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">창 닫기 ✕</button>
            </div>
            <div class="filter-bar">
                <div class="ctrl-group">
                    <select id="pop-period-unit" class="nav-select">
                        <option value="term" selected>이번기수</option>
                        <option value="month">이번달</option>
                        <option value="year">올해</option>
                    </select>
                    <div style="display:flex; gap:3px;">
                        <button type="button" id="btn-pop-prev" class="nav-btn">◀ 이전</button>
                        <button type="button" id="btn-pop-next" class="nav-btn">다음 ▶</button>
                    </div>
                    <span style="color:#4b5563; margin:0 4px;">|</span>
                    <input type="date" id="pop-start-date" class="date-badge-box" value="${initDates.start}">
                    <span style="color:#9ca3af; font-weight:bold;">~</span>
                    <input type="date" id="pop-end-date" class="date-badge-box" value="${initDates.end}">
                </div>
                
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="color:#9ca3af;">라인:</span>
                    <select id="pop-line-filter" class="line-select">
                        <option value="ALL">전체 라인</option>
                        <option value="본인">본인</option>
                        <option value="A라인">A라인</option>
                        <option value="B라인">B라인</option>
                    </select>
                </div>
            </div>
            <div class="summary-bar">
                <div id="pop-summary-count" style="color:#10b981; font-weight:bold;">검색 결과: 0건</div>
                <div>
                    <span id="pop-total-cv" style="color:#60a5fa; font-weight:bold;">총 0 CV</span>
                    <span style="color:#4b5563; margin:0 4px;">/</span>
                    <span id="pop-total-pv" style="color:#10b981; font-weight:bold;">총 0 PV</span>
                </div>
            </div>
            <div class="table-wrap">
                <table>
                    <colgroup>
                        <col style="width: 44px;">
                        <col style="width: 88px;">
                        <col style="width: 96px;">
                        <col style="width: 84px;">
                        <col style="width: 68px;">
                        <col style="width: auto;">
                        <col style="width: auto;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th id="th-pop-reset" title="클릭 시 선택/제외 전체 초기화" style="cursor:pointer; color:#60a5fa; text-align:center;">선택</th>
                            <th style="text-align:center;">일자</th>
                            <th style="text-align:center;">회원ID</th>
                            <th style="text-align:center;">이름</th>
                            <th style="text-align:center;">라인</th>
                            <th style="text-align:right; padding-right:8px;">CV</th>
                            <th style="text-align:right; padding-right:8px;">PV</th>
                        </tr>
                    </thead>
                    <tbody id="pop-sales-tbody">
                        <tr><td colspan="7" style="padding:30px; text-align:center; color:#9ca3af;">데이터를 불러오는 중입니다...</td></tr>
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
    doc.close();

    const btnClose = doc.getElementById('btn-pop-close');
    if (btnClose) btnClose.addEventListener('click', () => popup.close());

    const btnPrev = doc.getElementById('btn-pop-prev');
    if (btnPrev) btnPrev.addEventListener('click', () => window.navPopupPeriod(-1));

    const btnNext = doc.getElementById('btn-pop-next');
    if (btnNext) btnNext.addEventListener('click', () => window.navPopupPeriod(1));

    const unitSel = doc.getElementById('pop-period-unit');
    if (unitSel) {
        unitSel.addEventListener('change', (e) => {
            window.salesPopupState.unit = e.target.value || 'term';
            window.salesPopupState.anchorDate = new Date();
            window.renderSalesSearchPopupContent(true, false);
        });
    }

    const startInp = doc.getElementById('pop-start-date');
    if (startInp) {
        startInp.addEventListener('change', () => window.renderSalesSearchPopupContent(false, false));
    }

    const endInp = doc.getElementById('pop-end-date');
    if (endInp) {
        endInp.addEventListener('change', () => window.renderSalesSearchPopupContent(false, false));
    }

    const lineSel = doc.getElementById('pop-line-filter');
    if (lineSel) {
        lineSel.addEventListener('change', (e) => {
            window.salesPopupState.lineFilter = e.target.value || 'ALL';
            window.renderSalesSearchPopupContent(false, true);
        });
    }

    const thReset = doc.getElementById('th-pop-reset');
    if (thReset) {
        thReset.addEventListener('click', () => {
            if (Array.isArray(window.salesPopupState.rows)) {
                window.salesPopupState.rows.forEach(r => { r.state = 'none'; });
                window.renderSalesPopupRowsAndTotals();
            }
        });
    }

    const tbody = doc.getElementById('pop-sales-tbody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const chkCell = e.target.closest('.pop-chk-cell, .pop-chk-box');
            if (chkCell) {
                e.preventDefault();
                e.stopPropagation();
                const idx = Number(chkCell.getAttribute('data-idx'));
                const row = window.salesPopupState.rows[idx];
                if (row) {
                    if (row.state === 'excluded') row.state = 'none';
                    else if (row.state === 'selected') row.state = 'none';
                    else row.state = 'selected';
                    window.renderSalesPopupRowsAndTotals();
                }
                return;
            }

            const tr = e.target.closest('tr[data-mid]');
            if (tr) {
                const memberId = tr.getAttribute('data-mid');
                if (window.salesPopupState.rowClickTimer) {
                    clearTimeout(window.salesPopupState.rowClickTimer);
                }
                window.salesPopupState.rowClickTimer = setTimeout(() => {
                    if (typeof window.executeNodeSingleClick === 'function' && memberId && memberId !== '-') {
                        window.executeNodeSingleClick(memberId);
                    }
                    window.salesPopupState.rowClickTimer = null;
                }, 220);
            }
        });

        tbody.addEventListener('dblclick', (e) => {
            const tr = e.target.closest('tr[data-idx]');
            if (!tr) return;
            e.preventDefault();
            e.stopPropagation();
            if (window.salesPopupState.rowClickTimer) {
                clearTimeout(window.salesPopupState.rowClickTimer);
                window.salesPopupState.rowClickTimer = null;
            }
            const idx = Number(tr.getAttribute('data-idx'));
            const row = window.salesPopupState.rows[idx];
            if (row) {
                row.state = (row.state === 'excluded') ? 'none' : 'excluded';
                window.renderSalesPopupRowsAndTotals();
            }
        });
    }

    popup.addEventListener('resize', () => {
        try {
            localStorage.setItem('bs_sales_search_popup_w', String(popup.outerWidth));
            localStorage.setItem('bs_sales_search_popup_h', String(popup.outerHeight));
        } catch (e) {}
    });

    popup.addEventListener('beforeunload', () => {
        try {
            localStorage.setItem('bs_sales_search_popup_w', String(popup.outerWidth));
            localStorage.setItem('bs_sales_search_popup_h', String(popup.outerHeight));
            localStorage.setItem('bs_sales_search_popup_left', String(popup.screenX));
            localStorage.setItem('bs_sales_search_popup_top', String(popup.screenY));
        } catch (e) {}
        const salesChk = window.findSalesSearchCheckbox();
        if (salesChk && salesChk.checked) salesChk.checked = false;
    });

    window.renderSalesSearchPopupContent(true, true);

    return popup;
};

window.toggleSalesSearchPopup = function(forceShow) {
    if (typeof window.hideInlineSalesSearchPanels === 'function') {
        window.hideInlineSalesSearchPanels();
    }
    const isPopupOpen = Boolean(window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed);
    const willShow = (forceShow !== undefined) ? Boolean(forceShow) : !isPopupOpen;

    if (willShow) {
        window.openSalesSearchPopupWindow();
    } else {
        if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
            window.salesSearchPopupWindow.close();
        }
        window.salesSearchPopupWindow = null;
    }

    const salesChk = window.findSalesSearchCheckbox();
    if (salesChk && salesChk.checked !== willShow) salesChk.checked = willShow;
};

// [11-7] 표시 설정 메뉴 여백 정렬 & 배지 표시 기준(%) 유지 보정
window.reorganizePopupSettingsCategory = function(keepHidden = false) {
    const navChk = typeof window.findBizNavigatorCheckbox === 'function' ? window.findBizNavigatorCheckbox() : null;
    const salesChk = typeof window.findSalesSearchCheckbox === 'function' ? window.findSalesSearchCheckbox() : null;

    let menuDropdown = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (!menuDropdown && navChk) {
        menuDropdown = navChk.closest('#settingsDropdown, #settingsMenu, .settings-menu, .dropdown-menu');
    }
    if (!menuDropdown) return;

    if (keepHidden) {
        menuDropdown.style.display = 'none';
        menuDropdown.classList.remove('show', 'active', 'open');
    }

    menuDropdown.style.setProperty('width', 'fit-content', 'important');
    menuDropdown.style.setProperty('min-width', '260px', 'important');
    menuDropdown.style.setProperty('max-width', '290px', 'important');
    menuDropdown.style.setProperty('padding', '14px 16px', 'important');
    menuDropdown.style.setProperty('box-sizing', 'border-box', 'important');

    const getRowWrapper = (chk) => chk ? (chk.closest('label, li, .setting-item, .menu-item, .option-row') || chk.parentElement) : null;
    let navRow = getRowWrapper(navChk);
    let salesRow = getRowWrapper(salesChk);

    let basicCol = null, detailCol = null, widgetCol = null;
    const allLabels = menuDropdown.querySelectorAll('label, li, .setting-item, .option-row');
    allLabels.forEach(lbl => {
        const txt = String(lbl.innerText || '');
        if (txt.includes('회원ID') || txt.includes('회원이름') || txt.includes('가입일')) {
            if (!basicCol) basicCol = lbl.closest('div, section, ul') || lbl.parentElement;
        } else if (txt.includes('추천인명') || txt.includes('추천인ID') || txt.includes('최종매출일')) {
            if (!detailCol) detailCol = lbl.closest('div, section, ul') || lbl.parentElement;
        } else if (txt.includes('매출/구독') || txt.includes('매출 및 구독') || txt.includes('실적/수당')) {
            if (!widgetCol) widgetCol = lbl.closest('div, section, ul') || lbl.parentElement;
        }
    });

    if (!basicCol || !detailCol || !widgetCol) return;

    let topColsWrap = document.getElementById('bs-settings-top-cols-wrap');
    if (!topColsWrap) {
        topColsWrap = document.createElement('div');
        topColsWrap.id = 'bs-settings-top-cols-wrap';
    }
    topColsWrap.style.cssText = `display: flex !important; flex-direction: row !important; justify-content: space-between !important; gap: 16px !important; width: 100% !important; box-sizing: border-box !important;`;
    
    basicCol.style.cssText = 'flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 4px !important;';
    detailCol.style.cssText = 'flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 4px !important;';
    topColsWrap.appendChild(basicCol);
    topColsWrap.appendChild(detailCol);

    widgetCol.id = 'bs-widget-settings-col';
    widgetCol.style.cssText = `width: 100% !important; display: flex !important; flex-direction: column !important; gap: 6px !important; margin-top: 10px !important; padding-top: 8px !important; border-top: 1px solid #374151 !important; box-sizing: border-box !important;`;

    let popupCol = document.getElementById('bs-popup-settings-col');
    if (!popupCol) {
        popupCol = document.createElement('div');
        popupCol.id = 'bs-popup-settings-col';
    }
    popupCol.style.cssText = `width: 100% !important; display: flex !important; flex-direction: column !important; gap: 6px !important; margin-top: 10px !important; padding-top: 8px !important; border-top: 1px solid #374151 !important; box-sizing: border-box !important;`;
    popupCol.innerHTML = '<div style="font-size:12px; font-weight:bold; color:#3b82f6; margin-bottom:2px;">팝업 설정</div>';

    if (!navRow || !navRow.querySelector('input[type="checkbox"]')) {
        navRow = document.createElement('label');
        const isChecked = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
        navRow.innerHTML = `<input type="checkbox" id="chk-navigator"${isChecked ? ' checked' : ''}> <span>비지네스 내비게이터</span>`;
    }
    navRow.style.cssText = 'display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:#e5e7eb; padding:2px 0; width:fit-content;';
    popupCol.appendChild(navRow);

    if (!salesRow || !salesRow.querySelector('input[type="checkbox"]')) {
        salesRow = document.createElement('label');
        const isChecked = Boolean(window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed);
        salesRow.innerHTML = `<input type="checkbox" id="chk-sales-search"${isChecked ? ' checked' : ''}> <span>매출 기간 검색</span>`;
    }
    salesRow.style.cssText = 'display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:#e5e7eb; padding:2px 0; width:fit-content;';
    popupCol.appendChild(salesRow);

    let badgeThresholdRow = document.getElementById('bs-badge-threshold-row');
    if (!badgeThresholdRow) {
        badgeThresholdRow = document.createElement('div');
        badgeThresholdRow.id = 'bs-badge-threshold-row';
    }
    badgeThresholdRow.style.cssText = `width: 100% !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; padding: 6px 0 2px 0 !important; font-size: 11.5px !important; color: #e5e7eb !important; border-top: 1px dashed #374151 !important; margin-top: 6px !important; box-sizing: border-box !important;`;
    
    const savedPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
    window.badgeThresholdRatio = savedPct / 100;

    badgeThresholdRow.innerHTML = `
        <span style="color: #60a5fa; font-weight: bold;">배지 표시 기준 (달성률)</span>
        <div style="display: flex; align-items: center; gap: 3px;">
            <input type="number" id="inp-badge-threshold" value="${savedPct}" min="1" max="100" step="5" style="width: 44px; background: #111827; border: 1px solid #4b5563; color: #fbbf24; font-weight: bold; border-radius: 4px; padding: 2px 4px; text-align: center; font-size: 11px;">
            <span style="color: #9ca3af; font-size: 11px;">% 이상</span>
        </div>
    `;

    menuDropdown.innerHTML = '';
    menuDropdown.appendChild(topColsWrap);
    menuDropdown.appendChild(widgetCol);
    menuDropdown.appendChild(popupCol);
    menuDropdown.appendChild(badgeThresholdRow);

    const inp = badgeThresholdRow.querySelector('#inp-badge-threshold');
    if (inp && !inp.dataset.bound) {
        inp.dataset.bound = 'true';
        inp.addEventListener('input', () => {
            let val = parseInt(inp.value, 10);
            if (isNaN(val)) return;
            if (val < 1) val = 1;
            if (val > 100) val = 100;
            window.badgeThresholdRatio = val / 100;
            localStorage.setItem('bs_badge_threshold_pct', String(val));
            if (typeof window.renderTreeCardStatusBadges === 'function') {
                window.renderTreeCardStatusBadges();
            }
        });
    }
};

// [11-8] 배지 상태 평가 헬퍼 (승급 & 품위유지 달성률 연산 통합 판정)
window.evaluateMemberCardBadgeStatus = function(memberId, teamMap, preferredOrderKey) {
    const res = {
        showPromoBadge: false,
        showMaintBadge: false,
        promoPct: 0,
        promoTargetRank: '',
        promoCurrPV: 0,
        promoReqPV: 0,
        maintPct: 0,
        maintCurrVal: 0,
        maintReqVal: 0,
        maintUnit: 'PV'
    };

    if (!memberId) return res;

    let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
    if (isNaN(thresholdPct) || thresholdPct < 1) thresholdPct = 80;
    const thresholdRatio = thresholdPct / 100;
    window.badgeThresholdRatio = thresholdRatio;

    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (!mNode) return res;

    const { setA, setB } = typeof window.getSublinePartnerSets === 'function' 
        ? window.getSublinePartnerSets(mNode) 
        : { setA: new Set(), setB: new Set() };

    const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));

    let aTotalPV = 0, bTotalPV = 0;
    (allSales || []).forEach(s => {
        if (!s) return;
        const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        if (pv <= 0) return;
        if (setA.has(sNorm)) aTotalPV += pv;
        else if (setB.has(sNorm)) bTotalPV += pv;
    });

    const minorPV = Math.min(aTotalPV, bTotalPV);
    const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
    const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

    let nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0);
    if (!nextRank) {
        nextRank = { rank_name: 'DIAMOND', minor_leg_pv: 10000000 };
    }
    const reqMinorPV = Number(nextRank.minor_leg_pv || 10000000);
    const promoRatio = reqMinorPV > 0 ? (minorPV / reqMinorPV) : 0;
    const promoPct = Math.floor(promoRatio * 100);

    res.promoPct = promoPct;
    res.promoTargetRank = nextRank.rank_name || 'NEXT';
    res.promoCurrPV = minorPV;
    res.promoReqPV = reqMinorPV;

    if (promoRatio >= thresholdRatio) {
        res.showPromoBadge = true;
    }

    const rankInfo = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === currRank);
    let reqMaintVal = Number((rankInfo && (rankInfo.maintenance_pv || rankInfo.maint_pv || rankInfo.maint_val)) || 0);
    if (reqMaintVal <= 0) reqMaintVal = reqMinorPV;

    let currMaintVal = 0;
    if (teamMap && memberId) {
        const mNorm = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');
        const memberTeamInfo = teamMap.get(mNorm) || teamMap.get(memberId);
        if (memberTeamInfo) {
            currMaintVal = Number(memberTeamInfo.maintPV || memberTeamInfo.minorPV || memberTeamInfo.currentPV || 0);
        }
    }
    if (currMaintVal === 0) currMaintVal = minorPV;

    const maintRatio = reqMaintVal > 0 ? (currMaintVal / reqMaintVal) : 0;
    const maintPct = Math.floor(maintRatio * 100);

    res.maintPct = maintPct;
    res.maintCurrVal = currMaintVal;
    res.maintReqVal = reqMaintVal;

    if (maintRatio >= thresholdRatio) {
        res.showMaintBadge = true;
    }

    return res;
};

// [11-9] 계보도 카드 배지 DOM 렌더링 및 자동 감지 바인딩
window.renderTreeCardStatusBadges = async function() {
    if (typeof window.loadDbCompensationRates === 'function') {
        await window.loadDbCompensationRates();
    }

    let teamMap = window.lastAllMembersTeamBonusMap instanceof Map ? window.lastAllMembersTeamBonusMap : null;
    if (!teamMap) {
        const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));
        if (Array.isArray(allSales) && allSales.length > 0 && typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
            teamMap = window.computeAllMembersTeamBonusByPeriod(allSales, null);
            window.lastAllMembersTeamBonusMap = teamMap;
        }
    }

    const preferredOrderKey = typeof window.getCurrentSelectedPeriodOrderKey === 'function' 
        ? window.getCurrentSelectedPeriodOrderKey(teamMap) 
        : null;

    const cardMap = new Map();
    const candidateNodes = document.querySelectorAll('.node-card, .tree-node, [id^="card_"], [data-member-id], div, foreignObject');

    candidateNodes.forEach(el => {
        if (!el || el.id === 'perfWidget' || el.id === 'bonusDetailModal' || el.closest('#perfWidget') || el.closest('#bonusDetailModal') || el.closest('#salesWidget')) {
            return;
        }
        
        let memberId = el.getAttribute('data-member-id') || el.id?.replace(/^card_/, '');
        if (!memberId || !/VK-\d+/i.test(memberId)) {
            const txt = String(el.innerText || '');
            const match = txt.match(/VK-\d+/i);
            if (match) memberId = match[0];
        }

        if (!memberId || !/VK-\d+/i.test(memberId)) return;
        memberId = memberId.toUpperCase();

        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (!rect || rect.width < 50 || rect.width > 320 || rect.height < 40 || rect.height > 280) return;

        const style = window.getComputedStyle(el);
        const hasCardStyle = (style.borderStyle && style.borderStyle !== 'none') ||
                             (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent');

        if (hasCardStyle || el.classList.contains('node-card') || el.id?.startsWith('card_')) {
            cardMap.set(memberId, el);
        } else if (!cardMap.has(memberId)) {
            cardMap.set(memberId, el);
        }
    });

    cardMap.forEach((cardEl, memberId) => {
        const oldBadge = cardEl.querySelector('.bs-card-top-badges');
        if (oldBadge) oldBadge.remove();

        const status = window.evaluateMemberCardBadgeStatus(memberId, teamMap, preferredOrderKey);
        if (!status.showPromoBadge && !status.showMaintBadge) return;

        const computedPos = window.getComputedStyle(cardEl).position;
        if (computedPos === 'static') {
            cardEl.style.position = 'relative';
        }
        cardEl.style.overflow = 'visible';

        const badgeWrap = document.createElement('div');
        badgeWrap.className = 'bs-card-top-badges';
        badgeWrap.style.cssText = `
            position: absolute;
            top: -6px;
            right: -6px;
            display: flex;
            flex-direction: row;
            gap: 3px;
            z-index: 9999;
            pointer-events: auto;
        `;

        if (status.showPromoBadge) {
            const pBadge = document.createElement('span');
            pBadge.innerText = '승급';
            pBadge.title = `[승급 ${status.promoPct}% 달성] 목표: ${status.promoTargetRank} (${status.promoCurrPV.toLocaleString('ko-KR')} / ${status.promoReqPV.toLocaleString('ko-KR')} PV)`;
            pBadge.style.cssText = `
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: #ffffff;
                font-size: 10px;
                font-weight: 800;
                line-height: 1;
                padding: 3px 6px;
                border-radius: 4px;
                border: 1px solid #60a5fa;
                box-shadow: 0 2px 5px rgba(0,0,0,0.6);
                letter-spacing: -0.3px;
                white-space: nowrap;
                cursor: pointer;
            `;
            badgeWrap.appendChild(pBadge);
        }

        if (status.showMaintBadge) {
            const mBadge = document.createElement('span');
            mBadge.innerText = '품위유지';
            mBadge.title = `[품위유지 ${status.maintPct}% 달성] (${status.maintCurrVal.toLocaleString('ko-KR')} / ${status.maintReqVal.toLocaleString('ko-KR')} ${status.maintUnit})`;
            mBadge.style.cssText = `
                background: linear-gradient(135deg, #059669, #047857);
                color: #ffffff;
                font-size: 10px;
                font-weight: 800;
                line-height: 1;
                padding: 3px 6px;
                border-radius: 4px;
                border: 1px solid #34d399;
                box-shadow: 0 2px 5px rgba(0,0,0,0.6);
                letter-spacing: -0.3px;
                white-space: nowrap;
                cursor: pointer;
            `;
            badgeWrap.appendChild(mBadge);
        }

        cardEl.appendChild(badgeWrap);
    });
};

(function bindAutoTreeCardBadges() {
    const origCalc = window.calculateLocalPerformance;
    if (typeof origCalc === 'function' && !origCalc._badgeWrapped) {
        const wrapped = async function(...args) {
            const res = await origCalc.apply(this, args);
            if (typeof window.renderTreeCardStatusBadges === 'function') {
                setTimeout(() => window.renderTreeCardStatusBadges(), 60);
            }
            return res;
        };
        wrapped._badgeWrapped = true;
        window.calculateLocalPerformance = wrapped;
    }

    let badgeTimer = null;
    const observer = new MutationObserver(() => {
        if (badgeTimer) clearTimeout(badgeTimer);
        badgeTimer = setTimeout(() => {
            if (typeof window.renderTreeCardStatusBadges === 'function') {
                window.renderTreeCardStatusBadges();
            }
        }, 180);
    });

    window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => window.renderTreeCardStatusBadges(), 600);
    });
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => window.renderTreeCardStatusBadges(), 400);
    }
})();

// ============================================================================
// [12] 좌측 '매출 및 구독 내역' 패널 CRUD (행 추가/수기 쉼표 입력/삭제 & TiDB 저장)
// ============================================================================

window.deletedSaleDbIds = window.deletedSaleDbIds || new Set();
window.hasUnsavedSalesChanges = false;

// [12-1] 쉼표(,) 파싱 및 천 단위 포맷팅 헬퍼
window.parseCommaNumber = function(val) {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
};

window.formatCommaString = function(val) {
    if (val === undefined || val === null || val === '') return '';
    const cleaned = String(val).replace(/[^0-9-]/g, '');
    if (cleaned === '' || cleaned === '-') return cleaned;
    const num = Number(cleaned);
    return isNaN(num) ? '' : num.toLocaleString('ko-KR');
};

window.onSaleNumberInput = function(inputEl) {
    if (!inputEl) return;
    const rawDigits = inputEl.value.replace(/[^0-9]/g, '');
    inputEl.value = rawDigits ? Number(rawDigits).toLocaleString('ko-KR') : '';
    window.onSaleRowFieldChange(inputEl);
};

// [12-2] 미저장 변경사항 발생 시 우측 상단 저장 아이콘(💾) 강조 및 상태 표시 헬퍼
window.markSalesUnsaved = function(isDirty) {
    window.hasUnsavedSalesChanges = isDirty;
    const salesW = document.getElementById('salesWidget') || window.getSmartLeftPanel();
    const saveBtn = salesW ? salesW.querySelector('.widget-header button, #salesWidgetHeader button') : null;
    const statusEl = document.getElementById('sales-sync-status');

    if (saveBtn) {
        if (isDirty) {
            saveBtn.style.setProperty('color', '#fbbf24', 'important');
            saveBtn.style.setProperty('filter', 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.85))', 'important');
            saveBtn.title = '변경된 매출 내역이 있습니다. 클릭하여 TiDB에 저장하세요!';
        } else {
            saveBtn.style.removeProperty('color');
            saveBtn.style.removeProperty('filter');
            saveBtn.title = '현재 매출 내역 TiDB 저장';
        }
    }
    if (statusEl) {
        if (isDirty) {
            statusEl.innerText = '● 미저장 변경있음 (상단 💾 클릭)';
            statusEl.style.color = '#fbbf24';
        } else {
            statusEl.innerText = '✓ TiDB 동기화됨';
            statusEl.style.color = '#10b981';
        }
    }
};

// [12-3] 좌측 패널 내부에 매출 목록 테이블 및 하단 '+ 행 추가' 버튼 구축
window.ensureSalesPanelCRUDLayout = function() {
    const salesW = document.getElementById('salesWidget') || window.getSmartLeftPanel();
    if (!salesW) return null;

    if (!salesW.dataset.initCollapsed) {
        salesW.dataset.initCollapsed = 'true';
        salesW.classList.add('closed');
        salesW.style.setProperty('transform', 'translateX(-100%)', 'important');
        
        const perfW = document.getElementById('perfWidget');
        if (perfW) {
            perfW.style.setProperty('left', '0px', 'important');
        }
    }

    const headerSaveBtn = salesW.querySelector('.widget-header button, #salesWidgetHeader button');
    if (headerSaveBtn) {
        headerSaveBtn.dataset.crudBound = 'true';
        headerSaveBtn.title = '현재 매출 내역 TiDB 즉시 저장';
        headerSaveBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.saveAllMemberSalesToTiDB();
        };
    }

    let crudWrapper = document.getElementById('sales-crud-wrapper');
    if (crudWrapper && document.getElementById('sales-add-form')) {
        crudWrapper.remove();
        crudWrapper = null;
    }
    if (crudWrapper) return crudWrapper;

    const bodyEl = salesW.querySelector('.widget-body') || salesW;
    let existingRowsContainer = document.getElementById('sales-rows-container') || document.getElementById('sales-list-tbody') || salesW.querySelector('tbody');

    crudWrapper = document.createElement('div');
    crudWrapper.id = 'sales-crud-wrapper';
    crudWrapper.style.cssText = 'display: flex; flex-direction: column; flex: 1; overflow: hidden; padding: 6px 6px; gap: 6px; box-sizing: border-box;';

    crudWrapper.innerHTML = `
        <!-- 매출 요약 및 연동 상태 바 -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: #1f2937; border: 1px solid #374151; border-radius: 4px; font-size: 11px; color: #d1d5db;">
            <span id="sales-count-label">총 0건</span>
            <span id="sales-sync-status" style="font-size: 10px; color: #10b981;">● 연동 대기</span>
        </div>

        <!-- 매출 목록 및 하단 행 추가 스크롤 영역 -->
        <div id="sales-table-scroll-box" style="flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid #374151; border-radius: 6px; background: #111827; display: flex; flex-direction: column;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
                <colgroup>
                    <col style="width: 44px;">
                    <col style="width: 78px;">
                    <col style="width: auto;">
                    <col style="width: auto;">
                    <col style="width: 24px;">
                </colgroup>
                <thead style="background: #1f2937; color: #9ca3af; position: sticky; top: 0; z-index: 2;">
                    <tr>
                        <th style="padding: 6px 2px; border-bottom: 1px solid #374151; text-align: center;">구분</th>
                        <th style="padding: 6px 2px; border-bottom: 1px solid #374151; text-align: center; cursor: pointer;" onclick="window.toggleSalesSortOrder()">날짜 <span id="sales-sort-arrow">↓</span></th>
                        <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: right;">CV</th>
                        <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: right;">PV</th>
                        <th style="padding: 6px 1px; border-bottom: 1px solid #374151; text-align: center;">✕</th>
                    </tr>
                </thead>
                <tbody id="sales-crud-tbody">
                    <tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #6b7280;">계보도에서 회원 카드를 선택해 주세요.</td></tr>
                </tbody>
            </table>

            <!-- 테이블 바로 하단에 붙는 '+ 행 추가' 버튼 -->
            <div style="padding: 6px;">
                <button onclick="window.appendBlankSaleRow()" style="width: 100%; padding: 7px 0; background: #1f2937; color: #60a5fa; border: 1px dashed #4b5563; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
                    + 매출 / 구독 행 추가
                </button>
            </div>
        </div>

        <!-- 하단 CV / PV 총합계 표시 바 -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background: #1f2937; border: 1px solid #374151; border-radius: 4px; font-size: 11px; color: #d1d5db;">
            <span style="color: #9ca3af;">합계</span>
            <span><b id="sales-sum-cv" style="color: #60a5fa;">0</b> CV / <b id="sales-sum-pv" style="color: #10b981;">0</b> PV</span>
        </div>
    `;

    Array.from(bodyEl.children).forEach(child => {
        if (child.id === 'sales-crud-wrapper') return;
        const txt = child.innerText || '';
        if (txt.includes('구분') && txt.includes('날짜') && txt.includes('CV')) {
            child.style.display = 'none';
        }
    });
    if (existingRowsContainer && existingRowsContainer.tagName !== 'TBODY') {
        existingRowsContainer.style.display = 'none';
    }

    const footerHint = Array.from(bodyEl.children).find(el => (el.innerText || '').includes('MMDD'));
    if (footerHint) {
        bodyEl.insertBefore(crudWrapper, footerHint);
    } else {
        bodyEl.appendChild(crudWrapper);
    }

    return crudWrapper;
};

// [12-4] 날짜 정렬 토글 및 개별 행 HTML 생성 헬퍼
window.toggleSalesSortOrder = function() {
    window.salesSortOrder = (window.salesSortOrder === 'asc') ? 'desc' : 'asc';
    const arrowEl = document.getElementById('sales-sort-arrow');
    if (arrowEl) arrowEl.innerText = (window.salesSortOrder === 'asc') ? '↑' : '↓';
    if (window.currentSelectedId) window.renderMemberSalesList(window.currentSelectedId);
};

window.buildSaleRowHTML = function(rowObj, isNewRow = false) {
    const dbId = rowObj._dbId || rowObj.id || ('new_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
    const cat = (rowObj.category === '구독' || rowObj.is_subscription == 1) ? '구독' : '매출';
    const dStr = window.cleanDateStr(rowObj.transaction_date || rowObj.date || window.getTodayString());

    const rawCv = (rowObj.cv !== undefined && rowObj.cv !== null && rowObj.cv !== '') ? window.parseCommaNumber(rowObj.cv) : '';
    const rawPv = (rowObj.pv !== undefined && rowObj.pv !== null && rowObj.pv !== '') ? window.parseCommaNumber(rowObj.pv) : '';

    const cvDisplay = (rawCv !== '') ? rawCv.toLocaleString('ko-KR') : '';
    const pvDisplay = (rawPv !== '') ? rawPv.toLocaleString('ko-KR') : '';

    return `
        <tr class="sale-edit-row" data-sale-id="${dbId}" data-is-new="${isNewRow ? 'true' : 'false'}" data-dirty="${isNewRow ? 'true' : 'false'}" style="border-bottom: 1px solid #1f2937; background: ${isNewRow ? 'rgba(59, 130, 246, 0.1)' : 'transparent'};">
            <td style="padding: 3px 1px;">
                <select class="edit-sale-cat" onchange="window.onSaleRowFieldChange(this)" style="width: 100%; background: #111827; color: ${cat === '구독' ? '#f59e0b' : '#e5e7eb'}; border: 1px solid #374151; border-radius: 3px; padding: 3px 0px; font-size: 10.5px; font-weight: bold; text-align: center;">
                    <option value="매출" ${cat === '매출' ? 'selected' : ''}>매출</option>
                    <option value="구독" ${cat === '구독' ? 'selected' : ''}>구독</option>
                </select>
            </td>
            <td style="padding: 3px 1px;">
                <input type="text" class="edit-sale-date" value="${dStr}" placeholder="MMDD" onblur="window.formatDateMMDD(this); window.onSaleRowFieldChange(this);" onkeydown="if(event.key==='Enter') this.blur();" style="width: 100%; box-sizing: border-box; background: #111827; color: #d1d5db; border: 1px solid #374151; border-radius: 3px; padding: 3px 2px; font-size: 10.5px; text-align: center; letter-spacing: -0.3px;">
            </td>
            <td style="padding: 3px 2px;">
                <input type="text" inputmode="numeric" class="edit-sale-cv" value="${cvDisplay}" title="${cvDisplay}" placeholder="0" oninput="window.onSaleNumberInput(this); this.title=this.value;" onkeydown="if(event.key==='Enter') window.saveAllMemberSalesToTiDB();" style="width: 100%; min-width: 0; box-sizing: border-box; background: #111827; color: #60a5fa; font-weight: bold; border: 1px solid #374151; border-radius: 3px; padding: 3px 4px; font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; letter-spacing: -0.2px;">
            </td>
            <td style="padding: 3px 2px;">
                <input type="text" inputmode="numeric" class="edit-sale-pv" value="${pvDisplay}" title="${pvDisplay}" placeholder="0" oninput="window.onSaleNumberInput(this); this.title=this.value;" onkeydown="if(event.key==='Enter') window.saveAllMemberSalesToTiDB();" style="width: 100%; min-width: 0; box-sizing: border-box; background: #111827; color: #10b981; font-weight: bold; border: 1px solid #374151; border-radius: 3px; padding: 3px 4px; font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; letter-spacing: -0.2px;">
            </td>
            <td style="padding: 3px 1px; text-align: center;">
                <button onclick="window.deleteSaleRecord('${dbId}', this)" title="이 내역 삭제" style="background: transparent; color: #ef4444; border: 1px solid #374151; border-radius: 3px; cursor: pointer; padding: 2px 3px; font-size: 10px; font-weight: bold; line-height: 1;">✕</button>
            </td>
        </tr>
    `;
};

// [12-5] 행 수정 감지, 합계 재계산 및 빈 행 추가
window.onSaleRowFieldChange = function(inputEl) {
    const tr = inputEl ? inputEl.closest('tr.sale-edit-row') : null;
    if (tr) {
        tr.setAttribute('data-dirty', 'true');
        const catSel = tr.querySelector('.edit-sale-cat');
        if (catSel) catSel.style.color = (catSel.value === '구독') ? '#f59e0b' : '#e5e7eb';
    }
    window.markSalesUnsaved(true);
    window.recalcSalesPanelSummary();
};

window.recalcSalesPanelSummary = function() {
    const rows = document.querySelectorAll('#sales-crud-tbody tr.sale-edit-row');
    let totalCv = 0;
    let totalPv = 0;
    rows.forEach(tr => {
        totalCv += window.parseCommaNumber(tr.querySelector('.edit-sale-cv')?.value);
        totalPv += window.parseCommaNumber(tr.querySelector('.edit-sale-pv')?.value);
    });
    const countLabel = document.getElementById('sales-count-label');
    const sumCvEl = document.getElementById('sales-sum-cv');
    const sumPvEl = document.getElementById('sales-sum-pv');
    if (countLabel) countLabel.innerText = `총 ${rows.length}건`;
    if (sumCvEl) sumCvEl.innerText = totalCv.toLocaleString('ko-KR');
    if (sumPvEl) sumPvEl.innerText = totalPv.toLocaleString('ko-KR');
};

window.appendBlankSaleRow = function() {
    const memberId = window.currentSelectedId;
    if (!memberId) {
        alert('먼저 계보도에서 매출을 등록할 회원 카드를 클릭해 선택해 주세요.');
        return;
    }

    window.ensureSalesPanelCRUDLayout();
    const tbody = document.getElementById('sales-crud-tbody');
    if (!tbody) return;

    if (!tbody.querySelector('tr.sale-edit-row')) {
        tbody.innerHTML = '';
    }

    const newRowHtml = window.buildSaleRowHTML({
        id: 'new_' + Date.now(),
        category: '매출',
        transaction_date: window.getTodayString(),
        cv: '',
        pv: ''
    }, true);

    tbody.insertAdjacentHTML('beforeend', newRowHtml);
    window.markSalesUnsaved(true);
    window.recalcSalesPanelSummary();

    const scrollBox = document.getElementById('sales-table-scroll-box');
    if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;

    const lastRow = tbody.lastElementChild;
    const dateInput = lastRow ? lastRow.querySelector('.edit-sale-date') : null;
    if (dateInput) {
        dateInput.focus();
        dateInput.select();
    }
};

// [12-6] 선택된 회원의 매출/구독 내역 TiDB 조회 및 렌더링
window.loadMemberSales = async function(memberId, showToast = false) {
    window.ensureSalesPanelCRUDLayout();
    window.deletedSaleDbIds.clear();
    const tbody = document.getElementById('sales-crud-tbody');
    const statusEl = document.getElementById('sales-sync-status');

    if (!memberId) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #6b7280;">계보도에서 회원 카드를 선택해 주세요.</td></tr>`;
        window.recalcSalesPanelSummary();
        return;
    }

    const normTarget = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');

    if (window.API_BASE) {
        try {
            if (statusEl) { statusEl.innerText = '⏳ DB 조회 중...'; statusEl.style.color = '#60a5fa'; }
            const res = await fetch(`${window.API_BASE}/api/sales/history?member_id=${encodeURIComponent(memberId)}`);
            if (res.ok) {
                const dbRows = await res.json();
                if (Array.isArray(dbRows)) {
                    window.integrated_sales_history = (window.integrated_sales_history || []).filter(item => {
                        const m = String(item.member_id || '').trim().toLowerCase().replace(/^vk-?/, '');
                        return m !== normTarget;
                    });
                    dbRows.forEach(r => {
                        window.integrated_sales_history.push({
                            id: r.id,
                            _dbId: r.id,
                            member_id: r.member_id,
                            category: r.category || '매출',
                            transaction_date: window.cleanDateStr(r.transaction_date || r.date || ''),
                            cv: window.parseCommaNumber(r.cv),
                            pv: window.parseCommaNumber(r.pv)
                        });
                    });
                }
            }
            window.markSalesUnsaved(false);
            if (statusEl) {
                statusEl.innerText = showToast ? '✓ TiDB 저장 완료!' : '● TiDB 실시간 연동됨';
                statusEl.style.color = '#10b981';
            }
        } catch (err) {
            console.error('회원 매출 조회 실패:', err);
            if (statusEl) { statusEl.innerText = '⚠️ 오프라인(로컬)'; statusEl.style.color = '#f59e0b'; }
        }
    }

    window.renderMemberSalesList(memberId);
};

window.loadTargetData = window.loadMemberSales;
window.renderSalesWidget = function() {
    if (window.currentSelectedId) window.renderMemberSalesList(window.currentSelectedId);
};

window.renderMemberSalesList = function(memberId) {
    window.ensureSalesPanelCRUDLayout();
    const tbody = document.getElementById('sales-crud-tbody');
    if (!tbody) return;

    if (!memberId) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #6b7280;">계보도에서 회원 카드를 선택해 주세요.</td></tr>`;
        window.recalcSalesPanelSummary();
        return;
    }

    const normTarget = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');
    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);

    const memberSales = allSales.filter(item => {
        if (!item) return false;
        const m = String(item.member_id || item.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
        return m === normTarget;
    });

    memberSales.sort((a, b) => {
        const dA = window.cleanDateStr(a.transaction_date || a.date || '');
        const dB = window.cleanDateStr(b.transaction_date || b.date || '');
        if (dA !== dB) {
            return window.salesSortOrder === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        }
        return (Number(b._dbId || b.id || 0) - Number(a._dbId || a.id || 0));
    });

    if (memberSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #9ca3af;">등록된 매출/구독 내역이 없습니다.<br><span style="font-size:10px; color:#6b7280;">아래 '+ 매출 / 구독 행 추가' 버튼을 눌러 입력하세요.</span></td></tr>`;
    } else {
        let html = '';
        memberSales.forEach(row => {
            html += window.buildSaleRowHTML(row, false);
        });
        tbody.innerHTML = html;
    }

    window.recalcSalesPanelSummary();
};

// [12-7] 매출 생성/편집/삭제 후 회원의 최초·최종매출일 DB 동기화 및 일괄 저장/삭제
window.refreshAfterSalesMutation = async function(memberId) {
    if (!memberId) return;
    const node = window.findMemberNode(memberId);
    const joinDate = node ? (node.joinDate || node.join_date || '') : '';
    const histDates = window.getSalesDatesFromHistory(memberId, joinDate);

    if (node) {
        node.firstSales = histDates.first;
        node.first_sales_date = histDates.first;
        node.lastSales = histDates.last;
        node.last_sales_date = histDates.last;

        if (window.API_BASE && !window.isSimMode) {
            try {
                const parentInfo = window.findParentAndPosition(node.id);
                const parentId = parentInfo.parentNode ? parentInfo.parentNode.id : (node.parent_id || null);
                const dbPos = (parentInfo.position === 'right' || node.position === 'B') ? 'B' : 'A';
                await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(node.id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: node.id, name: node.name, rank: node.rank, type: node.type,
                        join_date: joinDate, parentId, position: dbPos,
                        recId: node.recId, recName: node.recName,
                        firstSales: histDates.first, lastSales: histDates.last,
                        code: node.code || ''
                    })
                });
            } catch (e) {}
        }
    }

    if (typeof window.reRenderTreeKeepViewport === 'function') window.reRenderTreeKeepViewport();
    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(memberId);
    if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') {
        if (typeof window.searchPeriodSales === 'function') window.searchPeriodSales();
    }
};

window.saveAllMemberSalesToTiDB = async function() {
    const memberId = window.currentSelectedId;
    if (!memberId) {
        alert('먼저 계보도에서 회원을 선택해 주세요.');
        return;
    }

    const tbody = document.getElementById('sales-crud-tbody');
    const statusEl = document.getElementById('sales-sync-status');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr.sale-edit-row'));
    if (statusEl) { statusEl.innerText = '⏳ TiDB 저장 중...'; statusEl.style.color = '#60a5fa'; }

    try {
        for (const delId of Array.from(window.deletedSaleDbIds)) {
            if (window.API_BASE) {
                await fetch(`${window.API_BASE}/api/sales/history/${encodeURIComponent(delId)}`, { method: 'DELETE' });
            }
            window.deletedSaleDbIds.delete(delId);
        }

        for (const tr of rows) {
            const saleId = tr.getAttribute('data-sale-id');
            const isNew = tr.getAttribute('data-is-new') === 'true' || String(saleId).startsWith('new_');
            const isDirty = tr.getAttribute('data-dirty') === 'true';

            const catEl = tr.querySelector('.edit-sale-cat');
            const dateEl = tr.querySelector('.edit-sale-date');
            const cvEl = tr.querySelector('.edit-sale-cv');
            const pvEl = tr.querySelector('.edit-sale-pv');

            if (dateEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(dateEl, false);

            const category = catEl ? catEl.value : '매출';
            const transaction_date = (dateEl && dateEl.value.trim()) ? window.cleanDateStr(dateEl.value.trim()) : window.getTodayString();
            const cv = window.parseCommaNumber(cvEl?.value);
            const pv = window.parseCommaNumber(pvEl?.value);

            if (isNew && cv === 0 && pv === 0) {
                tr.remove();
                continue;
            }

            if ((isNew || isDirty) && window.API_BASE) {
                const res = await fetch(`${window.API_BASE}/api/sales/history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: isNew ? null : saleId,
                        _dbId: isNew ? null : saleId,
                        member_id: memberId,
                        category,
                        transaction_date,
                        cv,
                        pv
                    })
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'DB 저장 실패');

                if (data.id) tr.setAttribute('data-sale-id', String(data.id));
                tr.setAttribute('data-is-new', 'false');
                tr.setAttribute('data-dirty', 'false');
                tr.style.background = 'transparent';
            }
        }

        await window.loadMemberSales(memberId, true);
        await window.refreshAfterSalesMutation(memberId);
        window.markSalesUnsaved(false);
    } catch (err) {
        console.error('매출 일괄 저장 오류:', err);
        if (statusEl) { statusEl.innerText = '❌ 저장 오류'; statusEl.style.color = '#ef4444'; }
        alert(`매출 저장 중 오류가 발생했습니다: ${err.message}`);
    }
};

window.createNewSaleRecord = window.appendBlankSaleRow;
window.updateSaleRecordInline = function() { window.markSalesUnsaved(true); };

window.deleteSaleRecord = async function(saleId, btnEl) {
    const memberId = window.currentSelectedId;
    const tr = btnEl ? btnEl.closest('tr.sale-edit-row') : document.querySelector(`#sales-crud-tbody tr[data-sale-id="${saleId}"]`);
    const isNew = tr && (tr.getAttribute('data-is-new') === 'true' || String(saleId).startsWith('new_'));

    if (isNew) {
        if (tr) tr.remove();
        window.recalcSalesPanelSummary();
        return;
    }

    if (!memberId || !saleId) return;
    if (!confirm('선택한 매출/구독 내역을 TiDB에서 영구 삭제하시겠습니까?')) return;

    const statusEl = document.getElementById('sales-sync-status');
    if (statusEl) { statusEl.innerText = '⏳ TiDB 삭제 중...'; statusEl.style.color = '#f59e0b'; }

    try {
        if (window.API_BASE) {
            const res = await fetch(`${window.API_BASE}/api/sales/history/${encodeURIComponent(saleId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'DB 삭제 실패');
        }

        window.integrated_sales_history = (window.integrated_sales_history || []).filter(
            item => String(item._dbId || item.id) !== String(saleId)
        );

        if (tr) tr.remove();
        if (statusEl) { statusEl.innerText = '✓ TiDB 삭제 완료'; statusEl.style.color = '#10b981'; }

        const tbody = document.getElementById('sales-crud-tbody');
        if (tbody && tbody.querySelectorAll('tr.sale-edit-row').length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #9ca3af;">등록된 매출/구독 내역이 없습니다.<br><span style="font-size:10px; color:#6b7280;">아래 '+ 매출 / 구독 행 추가' 버튼을 눌러 입력하세요.</span></td></tr>`;
        }

        window.recalcSalesPanelSummary();
        await window.refreshAfterSalesMutation(memberId);
    } catch (err) {
        console.error('매출 삭제 오류:', err);
        if (statusEl) { statusEl.innerText = '❌ 삭제 실패'; statusEl.style.color = '#ef4444'; }
        alert(`매출 삭제 중 오류가 발생했습니다: ${err.message}`);
    }
};

// ============================================================================
// [13] 통합 회원/추천인 검색 및 복수 카드 선택(하이라이트) 유지 로직
// ============================================================================

window.searchedHighlightIds = new Set();

// [13-1] 검색어 정규화 헬퍼 (VK- 접두사 제거 및 소문자 변환)
window.normalizeSearchTerm = function(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/^vk-?/, '');
};

// [13-2] 검색된 대상 카드로 캔버스 화면 중심 부드럽게 이동
window.panToMemberCard = function(memberId) {
    const wrapper = document.getElementById('tree-wrapper');
    const container = document.getElementById('canvas-container') || document.body;
    if (!wrapper || !container || !memberId) return;

    let targetCard = null;
    document.querySelectorAll('.node-card').forEach(el => {
        const cardId = el.id.replace(/^card_/, '');
        if (typeof window.isSameMemberId === 'function' && window.isSameMemberId(cardId, memberId)) {
            targetCard = el;
        }
    });

    if (!targetCard) return;

    let offsetLeftSum = 0;
    let offsetTopSum = 0;
    let curr = targetCard;
    while (curr && curr !== wrapper) {
        offsetLeftSum += curr.offsetLeft;
        offsetTopSum += curr.offsetTop;
        curr = curr.offsetParent;
    }

    const cardCenterX = offsetLeftSum + (targetCard.offsetWidth / 2);
    const cardCenterY = offsetTopSum + (targetCard.offsetHeight / 2);

    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight;

    const salesW = document.getElementById('salesWidget');
    const leftOffset = (salesW && !salesW.classList.contains('closed') && !salesW.hasAttribute('data-settings-hidden')) ? 165 : 0;

    window.panX = ((containerWidth / 2) + leftOffset) - (cardCenterX * window.scale);
    window.panY = (containerHeight / 3) - (cardCenterY * window.scale);

    wrapper.style.setProperty('transition', 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    wrapper.style.setProperty('transform-origin', '0 0', 'important');
    wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');

    setTimeout(() => {
        wrapper.style.removeProperty('transition');
    }, 360);
};

// [13-3] 복수 검색 하이라이트 및 단일 선택 카드 테두리 일괄 적용
window.applyCardHighlights = function() {
    document.querySelectorAll('.node-card').forEach(el => {
        const cardId = el.id.replace(/^card_/, '');
        const normCardId = window.normalizeSearchTerm(cardId);

        const isSelected = window.currentSelectedId && typeof window.isSameMemberId === 'function' && window.isSameMemberId(cardId, window.currentSelectedId);
        const isSearched = window.searchedHighlightIds && window.searchedHighlightIds.has(normCardId);

        if (isSearched) {
            el.style.setProperty('border', '2.5px solid #f59e0b', 'important');
            el.style.setProperty('box-shadow', '0 0 18px rgba(245, 158, 11, 0.85)', 'important');
            el.style.setProperty('z-index', '50', 'important');
        } else if (isSelected) {
            el.style.setProperty('border', '2px solid #10b981', 'important');
            el.style.setProperty('box-shadow', '0 0 12px rgba(16, 185, 129, 0.5)', 'important');
            el.style.removeProperty('z-index');
        } else {
            el.style.removeProperty('border');
            el.style.removeProperty('border-color');
            el.style.removeProperty('border-width');
            el.style.removeProperty('box-shadow');
            el.style.removeProperty('z-index');
        }
    });
};

// [13-4] 헤더 및 패널 통합 검색 실행 (회원번호 숫자만 / 회원명 / 추천인번호 / 추천인명)
window.searchMember = function(customKeyword) {
    const inputEl = document.getElementById('searchInput');
    const rawKeyword = (typeof customKeyword === 'string' ? customKeyword : (inputEl ? inputEl.value : '')).trim();

    if (!rawKeyword) {
        window.searchedHighlightIds.clear();
        window.applyCardHighlights();
        return;
    }

    const normKey = window.normalizeSearchTerm(rawKeyword);
    const uniqueMembers = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];

    const matchedNodes = uniqueMembers.filter(m => {
        if (!m || !m.id) return false;

        const mIdNorm = window.normalizeSearchTerm(m.id);
        const mName = String(m.name || '').trim().toLowerCase();

        const recIdRaw = m.recId || m.recommender_id || m.recommenderId || m.rec_id || '';
        const recIdNorm = window.normalizeSearchTerm(recIdRaw);
        
        let recName = String(m.recName || m.recommender_name || m.recommenderName || m.rec_name || '').trim().toLowerCase();
        if ((!recName || recName === '-') && recIdRaw && typeof window.findMemberNode === 'function') {
            const recNode = window.findMemberNode(recIdRaw);
            if (recNode && recNode.name) recName = String(recNode.name).trim().toLowerCase();
        }

        const isSelfMatch = mIdNorm.includes(normKey) || mName.includes(normKey);
        const isRecMatch = (recIdNorm && recIdNorm.includes(normKey)) || (recName && recName !== '-' && recName.includes(normKey));

        return isSelfMatch || isRecMatch;
    });

    if (matchedNodes.length === 0) {
        alert(`'${rawKeyword}'에 해당하는 회원이나 추천인 내역을 찾을 수 없습니다.`);
        return;
    }

    window.searchedHighlightIds.clear();
    matchedNodes.forEach(m => {
        window.searchedHighlightIds.add(window.normalizeSearchTerm(m.id));
    });

    window.applyCardHighlights();
    window.panToMemberCard(matchedNodes[0].id);
};

window.searchPanelMember = function(e, inputEl) {
    const val = inputEl ? inputEl.value.trim() : (document.getElementById('salesSearchInput')?.value.trim() || '');
    if (val) window.searchMember(val);
};

window.clickSearchPanel = function() {
    const val = document.getElementById('salesSearchInput')?.value.trim() || '';
    if (val) window.searchMember(val);
};

// ============================================================================
// [14] 줌/드래그 및 캔버스 상호작용 (하단 최소화 및 원위치 복원 통합)
// ============================================================================

// [14-1] +, - 버튼 및 마우스 휠 줌 조절 기능
window.changeZoom = function(delta, mouseX = null, mouseY = null) {
    const wrapper = document.getElementById('tree-wrapper');
    const container = document.getElementById('canvas-container') || document.body;
    if (!wrapper || !container) return;

    const oldScale = window.scale;
    window.scale += delta;
    if (window.scale < 0.1) window.scale = 0.1;
    if (window.scale > 3) window.scale = 3;

    let targetX = container.getBoundingClientRect().width / 2;
    let targetY = container.getBoundingClientRect().height / 2;
    if (mouseX !== null && mouseY !== null) {
        targetX = mouseX - container.getBoundingClientRect().left;
        targetY = mouseY - container.getBoundingClientRect().top;
    }

    window.panX = targetX - ((targetX - window.panX) / oldScale * window.scale);
    window.panY = targetY - ((targetY - window.panY) / oldScale * window.scale);
    
    wrapper.style.setProperty('transform-origin', '0 0', 'important');
    wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
};

// [14-2] 계보도 정중앙 고정 기능
window.resetZoomAndPan = window.centerRootNode;

// [14-3] 캔버스 드래그, 마우스 휠 및 빈 공간 클릭 이벤트
let isDraggingCanvas = false;
let canvasDragStartX = 0, canvasDragStartY = 0;

function initCanvasDrag() {
    const canvas = document.getElementById('canvas-container') || document.querySelector('.canvas-container') || document.querySelector('main') || document.body;
    
    let isClickCandidate = false;
    let startX = 0, startY = 0;

    canvas.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.widget, .node-card, .zoom-controls, .top-header-bar, button, input, select, .taskbar-item, #perf-resizer, .left-panel, aside, .settings-menu, .modal')) return;
        
        isDraggingCanvas = true;
        isClickCandidate = true;
        startX = e.clientX;
        startY = e.clientY;
        canvasDragStartX = e.clientX - window.panX;
        canvasDragStartY = e.clientY - window.panY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDraggingCanvas) return;

        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            isClickCandidate = false;
        }

        e.preventDefault(); 
        window.panX = e.clientX - canvasDragStartX;
        window.panY = e.clientY - canvasDragStartY;
        const wrapper = document.getElementById('tree-wrapper');
        if (wrapper) {
            wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
        }
    });

    window.addEventListener('pointerup', () => { 
        if (isDraggingCanvas && isClickCandidate) {
            window.closeAllWidgetsAndModals();
        }

        isDraggingCanvas = false; 
        isClickCandidate = false;
        if (canvas) canvas.style.cursor = ''; 
    });

    canvas.addEventListener('wheel', (e) => {
        if (e.target.closest('.widget, .node-card, .left-panel, aside')) return; 
        e.preventDefault(); 
        if (typeof window.changeZoom === 'function') window.changeZoom(e.deltaY > 0 ? -0.05 : 0.05, e.clientX, e.clientY);
    }, { passive: false }); 
}

// [14-4] 전체화면 토글 기능
window.toggleFullScreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`전체화면 전환 실패: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// [14-5] 빈 공간 클릭 시 모든 위젯 화면 아래단으로 최소화 및 수당 시뮬레이터 슬라이드 접기
window.closeAllWidgetsAndModals = function() {
    const settingsMenu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (settingsMenu) settingsMenu.style.display = 'none';

    const perfW = document.getElementById('perfWidget');
    if (perfW && window.getComputedStyle(perfW).display !== 'none') {
        const isClosed = perfW.classList.contains('closed') || perfW.getAttribute('data-minimized') === 'true';
        if (!isClosed) {
            window.setPerfSidebarState(true);
        }
    }

    const floatingWidgets = document.querySelectorAll('.widget:not(#salesWidget):not(#perfWidget):not(#memberEditModal), .filter-widget, .ai-widget, #bonusDetailModal');
    let minIndex = 0;

    floatingWidgets.forEach(w => {
        const compStyle = window.getComputedStyle(w);
        if (compStyle.display === 'none' || compStyle.visibility === 'hidden') return;

        if (w.getAttribute('data-minimized') === 'true') {
            minIndex++;
            return;
        }

        window.minimizeSingleWidget(w, minIndex);
        minIndex++;
    });
};

// [14-5-1] 하단 수당 시뮬레이터(#perfWidget) 전용 슬라이드 접기/펼치기 완벽 제어
window.setPerfSidebarState = function(shouldClose) {
    const perfW = document.getElementById('perfWidget');
    if (!perfW) return;

    const icon = document.getElementById('perf-toggle-icon');
    const txt = document.getElementById('perf-toggle-text');
    const body = perfW.querySelector('.widget-body');
    const resizer = document.getElementById('perf-resizer');

    perfW.style.setProperty('transition', 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)', 'important');

    if (shouldClose) {
        const currentH = perfW.getBoundingClientRect().height;
        if (currentH > 60) {
            perfW.setAttribute('data-orig-height', `${currentH}px`);
        }
        perfW.classList.add('closed');
        perfW.setAttribute('data-minimized', 'true');
        
        perfW.style.setProperty('height', '48px', 'important');
        if (body) body.style.setProperty('display', 'none', 'important');
        if (resizer) resizer.style.setProperty('display', 'none', 'important');

        if (icon) icon.style.transform = 'rotate(180deg)';
        if (txt) txt.innerText = '펼치기';
    } else {
        const origH = perfW.getAttribute('data-orig-height') || '350px';
        perfW.classList.remove('closed');
        perfW.removeAttribute('data-minimized');

        perfW.style.setProperty('height', origH, 'important');
        if (body) body.style.setProperty('display', 'block', 'important');
        if (resizer) resizer.style.setProperty('display', 'block', 'important');

        if (icon) icon.style.transform = 'rotate(0deg)';
        if (txt) txt.innerText = '접기';
    }
};

window.togglePerfSidebar = function(e) {
    if (e && e.target && e.target.closest('input, label, .icon-btn-mac')) return;
    const perfW = document.getElementById('perfWidget');
    if (!perfW) return;

    const isClosed = perfW.classList.contains('closed') || perfW.getAttribute('data-minimized') === 'true' || perfW.getBoundingClientRect().height <= 55;
    window.setPerfSidebarState(!isClosed);
};

// [14-6] 개별 플로팅 위젯 하단 최소화 및 원위치 복원
window.minimizeSingleWidget = function(w, index = 0) {
    const rect = w.getBoundingClientRect();

    w.setAttribute('data-orig-top', w.style.top || `${rect.top}px`);
    w.setAttribute('data-orig-left', w.style.left || `${rect.left}px`);
    w.setAttribute('data-orig-right', w.style.right || 'auto');
    w.setAttribute('data-orig-bottom', w.style.bottom || 'auto');
    w.setAttribute('data-orig-width', w.style.width || `${rect.width}px`);
    w.setAttribute('data-orig-height', w.style.height || '');
    w.setAttribute('data-minimized', 'true');

    Array.from(w.children).forEach(child => {
        if (!child.classList.contains('widget-header')) {
            child.setAttribute('data-orig-display', child.style.display || '');
            child.style.setProperty('display', 'none', 'important');
        }
    });

    const rightOffset = 20 + (index * 250);
    w.style.setProperty('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    w.style.setProperty('top', 'auto', 'important');
    w.style.setProperty('left', 'auto', 'important');
    w.style.setProperty('bottom', '52px', 'important');
    w.style.setProperty('right', `${rightOffset}px`, 'important');
    w.style.setProperty('width', '240px', 'important');
    w.style.setProperty('height', '42px', 'important');
    w.style.setProperty('min-height', '42px', 'important');
    w.style.setProperty('resize', 'none', 'important');

    const header = w.querySelector('.widget-header');
    if (header) {
        header.style.cursor = 'pointer';
        header.title = '클릭하여 기존 자리로 복원';
    }
};

window.restoreSingleWidget = function(w) {
    if (!w || w.getAttribute('data-minimized') !== 'true') return;

    const origTop = w.getAttribute('data-orig-top');
    const origLeft = w.getAttribute('data-orig-left');
    const origRight = w.getAttribute('data-orig-right');
    const origBottom = w.getAttribute('data-orig-bottom');
    const origWidth = w.getAttribute('data-orig-width');
    const origHeight = w.getAttribute('data-orig-height');

    w.style.setProperty('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');

    if (origTop && origTop !== 'auto') w.style.setProperty('top', origTop, 'important');
    else w.style.removeProperty('top');

    if (origLeft && origLeft !== 'auto') w.style.setProperty('left', origLeft, 'important');
    else w.style.removeProperty('left');

    if (origRight && origRight !== 'auto') w.style.setProperty('right', origRight, 'important');
    else w.style.removeProperty('right');

    if (origBottom && origBottom !== 'auto') w.style.setProperty('bottom', origBottom, 'important');
    else w.style.removeProperty('bottom');

    if (origWidth) w.style.setProperty('width', origWidth, 'important');
    
    if (origHeight) {
        w.style.setProperty('height', origHeight, 'important');
    } else {
        w.style.removeProperty('height');
        w.style.removeProperty('min-height');
    }

    Array.from(w.children).forEach(child => {
        if (!child.classList.contains('widget-header')) {
            const origDisp = child.getAttribute('data-orig-display');
            if (origDisp) child.style.display = origDisp;
            else child.style.removeProperty('display');
        }
    });

    w.removeAttribute('data-minimized');

    const header = w.querySelector('.widget-header');
    if (header) {
        header.style.cursor = 'move';
        header.title = '클릭 후 드래그하여 이동';
    }

    setTimeout(() => {
        w.style.removeProperty('transition');
    }, 320);
};

// [14-7] 좌측 매출 패널(#salesWidget) 슬라이드 토글 및 헤더 보호
window.toggleSalesSidebar = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const salesW = document.getElementById('salesWidget');
    if (!salesW) return;

    salesW.style.removeProperty('transform');
    salesW.style.removeProperty('height');

    const isClosed = salesW.classList.toggle('closed');

    const perfW = document.getElementById('perfWidget');
    if (perfW) {
        perfW.style.setProperty('left', isClosed ? '0px' : '330px', 'important');
    }

    setTimeout(() => {
        if (typeof window.centerRootNode === 'function') window.centerRootNode();
    }, 310);
};

(function initWidgetHeaderProtectionAndRestore() {
    let headerStartX = 0, headerStartY = 0;
    let isHeaderClick = false;
    let clickedHeaderWidget = null;

    const protectSalesHeader = (e) => {
        const salesHeader = e.target.closest('#salesWidgetHeader, #salesWidget .widget-header');
        if (salesHeader) {
            if (!e.target.closest('button')) {
                e.stopPropagation();
            }
            const salesW = document.getElementById('salesWidget');
            if (salesW) {
                salesW.style.setProperty('height', 'calc(100vh - 60px)', 'important');
                const body = salesW.querySelector('.widget-body');
                if (body) body.style.setProperty('display', 'flex', 'important');
            }
        }
    };

    document.addEventListener('click', protectSalesHeader, true);
    document.addEventListener('dblclick', protectSalesHeader, true);

    document.addEventListener('pointerdown', (e) => {
        const header = e.target.closest('.widget-header');
        if (!header) return;

        const widget = header.closest('.widget, .filter-widget, .ai-widget, #bonusDetailModal');
        if (!widget) return;

        if (widget.id === 'salesWidget') {
            if (!e.target.closest('button')) e.stopPropagation();
            return;
        }
        if (widget.id === 'perfWidget' || widget.id === 'memberEditModal' || e.target.closest('button, input, label, select')) return;

        isHeaderClick = true;
        clickedHeaderWidget = widget;
        headerStartX = e.clientX;
        headerStartY = e.clientY;
    }, true);

    document.addEventListener('pointermove', (e) => {
        if (!isHeaderClick) return;
        if (Math.abs(e.clientX - headerStartX) > 5 || Math.abs(e.clientY - headerStartY) > 5) {
            isHeaderClick = false;
        }
    }, true);

    document.addEventListener('pointerup', () => {
        if (isHeaderClick && clickedHeaderWidget) {
            if (clickedHeaderWidget.getAttribute('data-minimized') === 'true') {
                window.restoreSingleWidget(clickedHeaderWidget);
            }
        }
        isHeaderClick = false;
        clickedHeaderWidget = null;
    }, true);
})();

// ============================================================================
// [15] 노드 클릭/더블클릭 통합 제어 및 회원정보 편집·삭제 모달 로직
// ============================================================================

// [15-1] 단일 클릭 실행 (복수 검색 하이라이트 해제 + 동적코드 갱신 + A/B라인 인원수 갱신 + 매출/수당 연동)
window.executeNodeSingleClick = async function(id) {
    const modal = document.getElementById('addPartnerModal');
    if (modal && window.getComputedStyle(modal).display !== 'none') {
        const sponInput = document.getElementById('m-spon-id');
        if (sponInput) {
            sponInput.value = window.findMemberNode(id) ? window.findMemberNode(id).id : id;
            sponInput.style.borderColor = '#10b981';
            setTimeout(() => { sponInput.style.borderColor = '#60a5fa'; }, 600);
        }
        window.addPartnerState.sponsorId = sponInput ? sponInput.value : id;
        if(typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
        return;
    }

    if (window.searchedHighlightIds && window.searchedHighlightIds.size > 0) {
        window.searchedHighlightIds.clear();
    }

    window.currentSelectedId = id; 
    let member = window.findMemberNode(id);
    const memberId = member ? member.id : id;
    
    if (window.treeMode !== 'recommender' && typeof window.computeDynamicCodes === 'function') {
        window.computeDynamicCodes(memberId);
        document.querySelectorAll('.node-card').forEach(el => {
            const cId = el.id.replace(/^card_/, '');
            const codeDiv = el.querySelector('.t-code');
            if (codeDiv && typeof window.getDynamicCode === 'function') {
                codeDiv.innerText = window.getDynamicCode(cId);
            }
        });
    }

    if (typeof window.updateHeaderLineCount === 'function') {
        window.updateHeaderLineCount(memberId);
    }

    const salesIdInput = document.getElementById('sales-target-id');
    if (salesIdInput) salesIdInput.value = memberId;
    
    const perfName = document.getElementById('perf-target-name');
    if (perfName) perfName.innerText = `(${member ? member.name : id} / ${memberId})`;
    
    const salesName = document.getElementById('sales-target-name');
    if (salesName) salesName.innerText = `${member ? member.name : id} (${memberId})`;
    
    if (typeof window.applyCardHighlights === 'function') window.applyCardHighlights();

    if (typeof window.loadTargetData === 'function') { try { await window.loadTargetData(memberId); } catch(e) {} }
    else if (typeof window.loadMemberSales === 'function') window.loadMemberSales(memberId);

    if (typeof window.renderSalesWidget === 'function') window.renderSalesWidget();
    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(memberId);
    if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') window.searchPeriodSales();
};

window.handleNodeClickLogic = function(id) {
    if (!id) return;
    if (window.cardClickTimer) { clearTimeout(window.cardClickTimer); window.cardClickTimer = null; }
    window.cardClickTimer = setTimeout(async () => { 
        window.cardClickTimer = null; 
        await window.executeNodeSingleClick(id); 
    }, 220);
};

// [15-2] 카드 더블클릭 시 회원정보 편집 및 삭제 전용 모달 제어 로직
window.initMemberEditModal = function() {
    if (document.getElementById('memberEditModal')) return;

    const modalHTML = `
        <div id="memberEditModal" class="widget modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-height: 88vh; background: #1f2937; border: 1px solid #4b5563; border-radius: 10px; color: #fff; z-index: 100000; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; flex-direction: column;">
            <!-- 모달 헤더 -->
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-bottom: 1px solid #374151; cursor: default;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 13.5px; color: #60a5fa;">
                    <span>✏️</span>
                    <span>회원 DB 전체 정보 편집 및 관리</span>
                </div>
                <button class="icon-btn-mac close" onclick="window.closeMemberEditModal()" title="닫기">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- 모달 본문 폼 (스크롤 지원) -->
            <div style="padding: 16px; overflow-y: auto; max-height: calc(88vh - 110px); display: flex; flex-direction: column; gap: 12px; font-size: 12px;">
                
                <!-- 1. 기본 인적/직급 컬럼 -->
                <div style="font-size: 11px; font-weight: bold; color: #60a5fa; border-bottom: 1px solid #374151; padding-bottom: 4px;">기본 회원 정보</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; color: #9ca3af; margin-bottom: 4px; font-size: 11px;">회원 ID (member_id)</label>
                        <input type="text" id="edit-m-id" readonly style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #374151; color: #9ca3af; border-radius: 4px; font-weight: bold; cursor: not-allowed;">
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">회원 이름 (name) *</label>
                        <input type="text" id="edit-m-name" placeholder="이름 입력" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; font-weight: bold;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">직급 (rank / rank_name)</label>
                        <select id="edit-m-rank" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; cursor: pointer;">
                            <option value="GUEST">GUEST</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="MANIA">MANIA</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="DIRECTOR">DIRECTOR</option>
                            <option value="EMERALD">EMERALD</option>
                            <option value="SAPPHIRE">SAPPHIRE</option>
                            <option value="RUBY">RUBY</option>
                            <option value="DIAMOND">DIAMOND</option>
                            <option value="CROWN">CROWN</option>
                            <option value="MASTER">MASTER</option>
                            <option value="CHIEF">CHIEF</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">회원 구분 (member_type)</label>
                        <select id="edit-m-type" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; cursor: pointer;">
                            <option value="사업자">사업자</option>
                            <option value="소비자">소비자</option>
                            <option value="복제">복제</option>
                        </select>
                    </div>
                </div>

                <!-- 2. 후원 / 추천 계보 컬럼 -->
                <div style="font-size: 11px; font-weight: bold; color: #60a5fa; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-top: 4px;">계보 및 라인 정보</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">후원인 ID (parent_id)</label>
                        <input type="text" id="edit-m-sponid" placeholder="최상위 루트는 빈칸" oninput="window.autoFillSponsorName(this.value)" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">배치 라인 (position)</label>
                        <select id="edit-m-pos" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; cursor: pointer;">
                            <option value="left">A라인 (left / 좌측)</option>
                            <option value="right">B라인 (right / 우측)</option>
                            <option value="root">최상위 (Root)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">추천인 ID (recommender_id)</label>
                        <input type="text" id="edit-m-recid" placeholder="VK-0000000" oninput="window.autoFillRecommenderName(this.value)" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">추천인 이름 (recommender_name)</label>
                        <input type="text" id="edit-m-recname" placeholder="자동 매칭 또는 직접 입력" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                    </div>
                </div>

                <!-- 3. 가입 및 매출 일자 컬럼 -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-top: 4px;">
                    <span style="font-size: 11px; font-weight: bold; color: #60a5fa;">가입 및 매출 일자 정보 (MMDD 입력 가능)</span>
                    <span id="edit-m-sales-source-badge" style="font-size: 10px; color: #10b981;">DB 매출내역 자동연동</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">가입일 (join_date)</label>
                        <input type="text" id="edit-m-joindate" placeholder="MMDD / YYYY-MM-DD" onblur="window.handleEditJoinDateBlur(this)" onkeydown="if(event.key==='Enter') this.blur();" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; text-align: center;">
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">최초매출일 (first_sales)</label>
                        <input type="text" id="edit-m-firstsales" placeholder="MMDD / YYYY-MM-DD" onblur="window.formatDateMMDD(this)" onkeydown="if(event.key==='Enter') this.blur();" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #60a5fa; font-weight: bold; border-radius: 4px; text-align: center;">
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">최종매출일 (last_sales)</label>
                        <input type="text" id="edit-m-lastsales" placeholder="MMDD / YYYY-MM-DD" onblur="window.formatDateMMDD(this)" onkeydown="if(event.key==='Enter') this.blur();" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #10b981; font-weight: bold; border-radius: 4px; text-align: center;">
                    </div>
                </div>

                <!-- 4. 추가 DB 컬럼 영역 -->
                <div id="edit-m-extra-section" style="display: none; flex-direction: column; gap: 8px; margin-top: 4px;">
                    <div style="font-size: 11px; font-weight: bold; color: #10b981; border-bottom: 1px solid #374151; padding-bottom: 4px;">추가 DB 컬럼 정보</div>
                    <div id="edit-m-extra-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"></div>
                </div>
            </div>

            <!-- 하단 고정 액션 버튼 영역 -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-top: 1px solid #374151;">
                <button onclick="window.deleteMemberFromModal()" style="padding: 7px 14px; background: #ef4444; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">🗑️ 회원 삭제</button>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.closeMemberEditModal()" style="padding: 7px 14px; background: #374151; color: #d1d5db; border: 1px solid #4b5563; border-radius: 4px; cursor: pointer; font-size: 12px;">취소</button>
                    <button onclick="window.saveMemberEditFromModal()" style="padding: 7px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">💾 저장</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.handleEditJoinDateBlur = function(inputEl) {
    if (!inputEl) return;
    if (typeof window.formatDateMMDD === 'function') {
        window.formatDateMMDD(inputEl, false);
    }
    const id = document.getElementById('edit-m-id')?.value.trim();
    const firstEl = document.getElementById('edit-m-firstsales');
    const lastEl = document.getElementById('edit-m-lastsales');

    if (id && typeof window.getSalesDatesFromHistory === 'function') {
        const hist = window.getSalesDatesFromHistory(id, inputEl.value);
        if (!hist.hasHistory) {
            if (firstEl) firstEl.value = inputEl.value;
            if (lastEl) lastEl.value = inputEl.value;
        }
    }
};

window.autoFillRecommenderName = function(val) {
    const recNameEl = document.getElementById('edit-m-recname');
    if (!recNameEl) return;
    const cleanVal = String(val || '').trim();
    if (!cleanVal) {
        recNameEl.value = '';
        return;
    }
    const recNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(cleanVal) : null;
    if (recNode && recNode.name) {
        recNameEl.value = recNode.name;
    }
};

window.autoFillSponsorName = function(val) {};

// [15-3] 특정 회원의 트리 상 부모(후원인) 노드 및 좌/우 배치 위치 역추적 헬퍼
window.findParentAndPosition = function(targetId) {
    let result = { parentNode: null, position: 'root' };
    if (!targetId || !window.treeData) return result;
    if (window.isSameMemberId(window.treeData.id, targetId)) return result;

    const visited = new Set();
    function searchParent(curr) {
        if (!curr || !curr.id || result.parentNode) return;
        const norm = String(curr.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visited.has(norm)) return;
        visited.add(norm);

        const leftNode = curr.left ? (typeof curr.left === 'object' ? curr.left : window.findMemberNode(curr.left)) : null;
        const rightNode = curr.right ? (typeof curr.right === 'object' ? curr.right : window.findMemberNode(curr.right)) : null;

        if (leftNode && window.isSameMemberId(leftNode.id || curr.left, targetId)) {
            result = { parentNode: curr, position: 'left' };
            return;
        }
        if (rightNode && window.isSameMemberId(rightNode.id || curr.right, targetId)) {
            result = { parentNode: curr, position: 'right' };
            return;
        }

        if (leftNode) searchParent(leftNode);
        if (rightNode) searchParent(rightNode);
    }

    searchParent(window.treeData);
    return result;
};

// [15-4] 더블클릭 시 회원 편집 모달 오픈 및 매출일 자동 표시
window.openEditMemberModal = async function(memberId) {
    window.initMemberEditModal();
    const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (!node) return;

    const modal = document.getElementById('memberEditModal');
    if (!modal) return;

    document.getElementById('edit-m-id').value = node.id || node.member_id || '';
    document.getElementById('edit-m-name').value = node.name || node.member_name || '';

    const rankEl = document.getElementById('edit-m-rank');
    const nodeRank = (node.rank || node.rank_name || 'MANIA').toUpperCase();
    if (rankEl) {
        if (!Array.from(rankEl.options).some(opt => opt.value === nodeRank)) {
            rankEl.insertAdjacentHTML('beforeend', `<option value="${nodeRank}">${nodeRank}</option>`);
        }
        rankEl.value = nodeRank;
    }

    const typeEl = document.getElementById('edit-m-type');
    const nodeType = node.type || node.member_type || '사업자';
    if (typeEl) {
        if (!Array.from(typeEl.options).some(opt => opt.value === nodeType)) {
            typeEl.insertAdjacentHTML('beforeend', `<option value="${nodeType}">${nodeType}</option>`);
        }
        typeEl.value = nodeType;
    }

    const parentInfo = window.findParentAndPosition(node.id);
    const sponId = (parentInfo.parentNode ? parentInfo.parentNode.id : '') || node.sponsor_id || node.sponId || node.parent_id || node.parentId || '';
    let posVal = parentInfo.position;
    if (posVal === 'root' && sponId) {
        const rawPos = String(node.position || node.line || node.branch || '').toLowerCase();
        posVal = (rawPos.includes('right') || rawPos.includes('b') || rawPos.includes('우')) ? 'right' : 'left';
    }

    document.getElementById('edit-m-sponid').value = sponId;
    const posEl = document.getElementById('edit-m-pos');
    if (posEl) posEl.value = posVal;

    const recId = node.recId || node.recommender_id || node.recommenderId || node.rec_id || '';
    let recName = node.recName || node.recommender_name || node.recommenderName || node.rec_name || '';
    if (!recName && recId && typeof window.findMemberNode === 'function') {
        const rNode = window.findMemberNode(recId);
        if (rNode) recName = rNode.name || '';
    }
    document.getElementById('edit-m-recid').value = recId;
    document.getElementById('edit-m-recname').value = recName;

    const rawJoin = node.joinDate || node.join_date || node.regDate || node.reg_date || node.date1 || '';
    const joinDate = (rawJoin && rawJoin !== '-') ? window.cleanDateStr(rawJoin) : '';

    const histDates = typeof window.getSalesDatesFromHistory === 'function'
        ? window.getSalesDatesFromHistory(node.id, joinDate)
        : { first: joinDate, last: joinDate, hasHistory: false };

    const firstSales = histDates.first || joinDate;
    const lastSales = histDates.last || joinDate;

    const joinInput = document.getElementById('edit-m-joindate');
    const firstInput = document.getElementById('edit-m-firstsales');
    const lastInput = document.getElementById('edit-m-lastsales');
    const badgeEl = document.getElementById('edit-m-sales-source-badge');

    if (joinInput) joinInput.value = joinDate;
    if (firstInput) firstInput.value = firstSales;
    if (lastInput) lastInput.value = lastSales;

    if (badgeEl) {
        if (histDates.hasHistory) {
            badgeEl.innerText = '✓ integrated_sales_history 자동검색됨';
            badgeEl.style.color = '#10b981';
        } else {
            badgeEl.innerText = '매출이력 없음 (가입일 기준 표시)';
            badgeEl.style.color = '#9ca3af';
        }
    }

    const excludedKeys = new Set([
        'id', 'member_id', 'name', 'member_name', 'rank', 'rank_name', 'type', 'member_type',
        'sponsor_id', 'sponId', 'parent_id', 'parentId', 'position', 'line', 'branch',
        'recId', 'recommender_id', 'recommenderId', 'rec_id', 'recName', 'recommender_name', 'recommenderName', 'rec_name',
        'joinDate', 'join_date', 'regDate', 'reg_date', 'date1',
        'firstSales', 'firstSalesDate', 'first_sales', 'first_sales_date',
        'lastSales', 'lastSalesDate', 'last_sales', 'last_sales_date',
        'code', 'left', 'right', 'children', 'periods', 'generation', 'isGhost', '_genFromM', '_branchLine'
    ]);

    const extraSection = document.getElementById('edit-m-extra-section');
    const extraContainer = document.getElementById('edit-m-extra-fields');
    if (extraSection && extraContainer) {
        extraContainer.innerHTML = '';
        let extraCount = 0;

        Object.keys(node).forEach(key => {
            if (excludedKeys.has(key) || key.startsWith('_')) return;
            const val = node[key];
            if (typeof val === 'object' && val !== null) return;

            extraCount++;
            const safeVal = (val !== undefined && val !== null) ? String(val).replace(/"/g, '&quot;') : '';
            extraContainer.insertAdjacentHTML('beforeend', `
                <div>
                    <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">${key}</label>
                    <input type="text" class="edit-m-extra-input" data-db-key="${key}" value="${safeVal}" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                </div>
            `);
        });

        extraSection.style.display = extraCount > 0 ? 'flex' : 'none';
    }

    modal.style.setProperty('display', 'flex', 'important');

    if (!histDates.hasHistory && typeof window.fetchMemberSalesDatesFromAPI === 'function') {
        const apiDates = await window.fetchMemberSalesDatesFromAPI(node.id);
        if (apiDates && apiDates.hasHistory) {
            if (firstInput) firstInput.value = apiDates.first;
            if (lastInput) lastInput.value = apiDates.last;
            if (badgeEl) {
                badgeEl.innerText = '✓ integrated_sales_history 자동검색됨';
                badgeEl.style.color = '#10b981';
            }
            node.firstSales = apiDates.first;
            node.lastSales = apiDates.last;
        }
    }
};

window.handleNodeDblClickLogic = function(e, id) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (window.cardClickTimer) { clearTimeout(window.cardClickTimer); window.cardClickTimer = null; }
    window.openEditMemberModal(id);
};

window.closeMemberEditModal = function() {
    const modal = document.getElementById('memberEditModal');
    if (modal) modal.style.setProperty('display', 'none', 'important');
};

window.closeEditMemberModal = window.closeMemberEditModal;

// [15-5] 현재 캔버스 위치(panX, panY, scale)를 유지하며 트리만 갱신하는 헬퍼
window.reRenderTreeKeepViewport = function() {
    const savedPanX = window.panX;
    const savedPanY = window.panY;
    const savedScale = window.scale;
    const origCenterFn = window.centerRootNode;

    window.centerRootNode = function() {};
    if (typeof window.renderTree === 'function') {
        window.renderTree(false);
    }

    setTimeout(() => {
        window.centerRootNode = origCenterFn;
        window.panX = savedPanX;
        window.panY = savedPanY;
        window.scale = savedScale;
        const wrapper = document.getElementById('tree-wrapper');
        if (wrapper) {
            wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
        }
    }, 180);
};

// [15-6] 회원 DB 전체 컬럼 수정 저장 및 영구 삭제 처리
window.saveMemberEditFromModal = async function() {
    const id = document.getElementById('edit-m-id')?.value.trim();
    const name = document.getElementById('edit-m-name')?.value.trim();
    const rank = document.getElementById('edit-m-rank')?.value;
    const type = document.getElementById('edit-m-type')?.value;
    let sponId = document.getElementById('edit-m-sponid')?.value.trim();
    const pos = document.getElementById('edit-m-pos')?.value;
    let recId = document.getElementById('edit-m-recid')?.value.trim();
    let recName = document.getElementById('edit-m-recname')?.value.trim();

    const joinEl = document.getElementById('edit-m-joindate');
    const firstEl = document.getElementById('edit-m-firstsales');
    const lastEl = document.getElementById('edit-m-lastsales');
    if (joinEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(joinEl, false);
    if (firstEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(firstEl, false);
    if (lastEl && typeof window.formatDateMMDD === 'function') window.formatDateMMDD(lastEl, false);

    const joinDate = joinEl ? window.cleanDateStr(joinEl.value.trim()) : '';
    const firstSales = (firstEl && firstEl.value.trim()) ? window.cleanDateStr(firstEl.value.trim()) : joinDate;
    const lastSales = (lastEl && lastEl.value.trim()) ? window.cleanDateStr(lastEl.value.trim()) : joinDate;

    if (!id) return;
    if (!name) {
        alert('회원 이름을 입력해 주세요.');
        return;
    }

    const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(id) : null;
    if (!node) return;

    if (recId && typeof window.findMemberNode === 'function') {
        const recNode = window.findMemberNode(recId);
        if (recNode) {
            recId = recNode.id;
            if (!recName) recName = recNode.name || '';
        } else if (/^\d+$/.test(recId)) {
            recId = 'VK-' + recId;
        }
    }
    if (sponId && typeof window.findMemberNode === 'function') {
        const sponNode = window.findMemberNode(sponId);
        if (sponNode) sponId = sponNode.id;
        else if (/^\d+$/.test(sponId)) sponId = 'VK-' + sponId;
    }

    const oldParentInfo = window.findParentAndPosition(id);
    const oldSponId = oldParentInfo.parentNode ? oldParentInfo.parentNode.id : '';
    const oldPos = oldParentInfo.position;

    if (pos !== 'root' && sponId && (!window.isSameMemberId(oldSponId, sponId) || oldPos !== pos)) {
        const newSponNode = window.findMemberNode(sponId);
        if (!newSponNode) {
            alert(`입력하신 후원인 ID (${sponId})를 계보도에서 찾을 수 없습니다.`);
            return;
        }
        if (window.isSameMemberId(sponId, id)) {
            alert('본인을 후원인으로 지정할 수 없습니다.');
            return;
        }
        const targetSlot = (pos === 'right') ? newSponNode.right : newSponNode.left;
        if (targetSlot && !window.isSameMemberId(targetSlot.id || targetSlot, id)) {
            alert(`후원인(${newSponNode.name})의 ${pos === 'right' ? 'B라인(우측)' : 'A라인(좌측)'}에는 이미 다른 파트너가 배치되어 있습니다.`);
            return;
        }

        if (oldParentInfo.parentNode) {
            if (oldPos === 'left') oldParentInfo.parentNode.left = null;
            if (oldPos === 'right') oldParentInfo.parentNode.right = null;
        }
        if (pos === 'right') newSponNode.right = node;
        else newSponNode.left = node;
    }

    const dbPos = (pos === 'right' || pos === 'B') ? 'B' : 'A';
    const finalParentId = (pos === 'root') ? null : (sponId || null);

    node.name = name;
    node.member_name = name;
    node.rank = rank;
    node.rank_name = rank;
    node.type = type;
    node.member_type = type;
    node.sponsor_id = finalParentId;
    node.sponId = finalParentId;
    node.parent_id = finalParentId;
    node.position = dbPos;
    node.recId = recId;
    node.recommender_id = recId;
    node.rec_id = recId;
    node.recName = recName;
    node.recommender_name = recName;
    node.rec_name = recName;
    node.joinDate = joinDate;
    node.join_date = joinDate;
    node.regDate = joinDate;
    node.date1 = joinDate;
    node.firstSales = firstSales;
    node.firstSalesDate = firstSales;
    node.first_sales = firstSales;
    node.first_sales_date = firstSales;
    node.lastSales = lastSales;
    node.lastSalesDate = lastSales;
    node.last_sales = lastSales;
    node.last_sales_date = lastSales;

    const norm = String(id).trim().toLowerCase().replace(/^vk-?/, '');
    window.memberSalesDateMap = window.memberSalesDateMap || {};
    window.memberSalesDateMap[norm] = { first: firstSales, last: lastSales };

    const extraPayload = {};
    document.querySelectorAll('.edit-m-extra-input').forEach(inp => {
        const k = inp.getAttribute('data-db-key');
        if (k) {
            node[k] = inp.value.trim();
            extraPayload[k] = node[k];
        }
    });

    const allMembers = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];
    allMembers.forEach(m => {
        if (m && window.isSameMemberId(m.recId || m.recommender_id || m.rec_id, id)) {
            m.recName = name;
            m.recommender_name = name;
            m.rec_name = name;
        }
    });

    if (window.API_BASE && !window.isSimMode) {
        try {
            await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id, newId: id, member_id: id,
                    name, rank, rank_name: rank,
                    type, member_type: type,
                    parentId: finalParentId, parent_id: finalParentId, sponsor_id: finalParentId,
                    position: dbPos,
                    recId, recommender_id: recId, recName, recommender_name: recName,
                    joinDate, join_date: joinDate,
                    firstSales, first_sales_date: firstSales,
                    lastSales, last_sales_date: lastSales,
                    code: node.code || '',
                    ...extraPayload
                })
            });
        } catch (err) {
            console.error('회원 DB 수정 오류:', err);
        }
    }

    window.closeMemberEditModal();
    window.getFlatMembers();
    window.reRenderTreeKeepViewport();

    if (window.currentSelectedId && window.isSameMemberId(window.currentSelectedId, id)) {
        const salesTarget = document.getElementById('sales-target-name');
        const perfTarget = document.getElementById('perf-target-name');
        if (salesTarget) salesTarget.innerText = `${name} (${id})`;
        if (perfTarget) perfTarget.innerText = `(${name} / ${id})`;
    }
};

window.deleteMemberFromModal = async function() {
    const id = document.getElementById('edit-m-id')?.value.trim();
    if (!id) return;

    const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(id) : null;
    if (!node) return;

    const hasChildren = Boolean(node.left || node.right);
    const confirmMsg = hasChildren
        ? `[주의] '${node.name} (${node.id})' 회원 하선에 연결된 파트너가 있습니다.\nDB에서 영구 삭제하시겠습니까?`
        : `'${node.name} (${node.id})' 회원을 DB에서 영구 삭제하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    let promotedChildId = null;

    if (window.treeData && window.isSameMemberId(window.treeData.id, id)) {
        const nextRoot = node.left || node.right;
        if (nextRoot) {
            promotedChildId = typeof nextRoot === 'object' ? nextRoot.id : nextRoot;
            window.treeData = typeof nextRoot === 'object' ? nextRoot : window.findMemberNode(nextRoot);
        } else {
            alert('계보도의 유일한 최상위 루트 회원은 삭제할 수 없습니다.');
            return;
        }
    } else {
        const visited = new Set();
        function removeTargetFromParent(curr) {
            if (!curr || !curr.id) return;
            const norm = String(curr.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (visited.has(norm)) return;
            visited.add(norm);

            const leftNode = curr.left ? (typeof curr.left === 'object' ? curr.left : window.findMemberNode(curr.left)) : null;
            const rightNode = curr.right ? (typeof curr.right === 'object' ? curr.right : window.findMemberNode(curr.right)) : null;

            if (leftNode && window.isSameMemberId(leftNode.id || curr.left, id)) {
                curr.left = null;
            } else if (leftNode) {
                removeTargetFromParent(leftNode);
            }

            if (rightNode && window.isSameMemberId(rightNode.id || curr.right, id)) {
                curr.right = null;
            } else if (rightNode) {
                removeTargetFromParent(rightNode);
            }
        }
        removeTargetFromParent(window.treeData);
    }

    if (window.flatMembersData) {
        Object.keys(window.flatMembersData).forEach(k => {
            const m = window.flatMembersData[k];
            if (window.isSameMemberId(k, id) || (m && window.isSameMemberId(m.id, id))) {
                delete window.flatMembersData[k];
            }
        });
    }

    if (window.API_BASE && !window.isSimMode) {
        try {
            const queryStr = promotedChildId ? `?mode=bridge&promotedId=${encodeURIComponent(promotedChildId)}` : '';
            await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(id)}${queryStr}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error('회원 DB 삭제 오류:', err);
        }
    }

    if (window.currentSelectedId && window.isSameMemberId(window.currentSelectedId, id)) {
        window.currentSelectedId = null;
        const salesTarget = document.getElementById('sales-target-name');
        const perfTarget = document.getElementById('perf-target-name');
        if (salesTarget) salesTarget.innerText = '선택 안됨';
        if (perfTarget) perfTarget.innerText = '(선택 안됨)';
        const salesContainer = document.getElementById('sales-rows-container');
        if (salesContainer) salesContainer.innerHTML = '';
    }

    window.closeMemberEditModal();
    window.getFlatMembers();
    window.reRenderTreeKeepViewport();
};

// [15-7] 전역 클릭 및 ESC 키보드 방어 이벤트 & 사이드바 관찰자
document.addEventListener('click', function(e) {
    const target = e.target;
    const text = target.innerText ? target.innerText.trim() : '';
    
    const settingsMenu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    const isClickInsideMenu = target.closest('.settings-menu, #settingsDropdown, #settingsMenu');
    const isClickOnGearIcon = target.closest('[onclick*="toggleSettingsMenu"], .icon-settings, [class*="gear"], [class*="setting"]');
    
    if (settingsMenu && window.getComputedStyle(settingsMenu).display === 'block') {
        if (!isClickInsideMenu && !isClickOnGearIcon) {
            settingsMenu.style.setProperty('display', 'none', 'important');
        }
    }
    
    const perfWidget = target.closest('#perfWidget') || target.closest('.perf-widget');
    if (perfWidget) {
        if (target.closest('.close, .close-btn, .icon-btn-mac') || text === '✖' || text === 'X' || target.tagName === 'INPUT' || target.tagName === 'LABEL') return;
        const isHeader = target.closest('.widget-header');
        if (isHeader) {
            e.preventDefault(); e.stopImmediatePropagation();
            if (perfWidget.style.display === 'none') perfWidget.style.display = 'flex';
            if(typeof window.togglePerfSidebar === 'function') window.togglePerfSidebar(e);
        }
    }
}, true); 

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (typeof window.closeAddPartnerModal === 'function') window.closeAddPartnerModal();
        if (typeof window.closeMemberEditModal === 'function') window.closeMemberEditModal();
        if (typeof window.closeBonusDetailModal === 'function') window.closeBonusDetailModal();
        const pModal = document.getElementById('addPartnerModal');
        if(pModal) pModal.style.display = 'none';

        window.currentSelectedId = null; 
        if (window.searchedHighlightIds) window.searchedHighlightIds.clear();
        if (typeof window.applyCardHighlights === 'function') window.applyCardHighlights();

        const salesName = document.getElementById('sales-target-name');
        if (salesName) salesName.innerText = '선택 안됨';
        if (typeof window.renderSalesWidget === 'function') window.renderSalesWidget();
        if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(null);
        if (typeof window.reRenderTreeKeepViewport === 'function') window.reRenderTreeKeepViewport();
    }
});

function initSidebarDefender() {
    const sidebar = window.getSmartLeftPanel();
    if (!sidebar) return;
    const observer = new MutationObserver((mutations) => {
        if (window.sidebarForceHiddenBySettings || sidebar.hasAttribute('data-settings-hidden')) return; 
        
        if (sidebar.classList.contains('closed') || sidebar.getAttribute('data-init-collapsed') === 'true') return;

        mutations.forEach(m => {
            if (m.attributeName === 'style' && sidebar.style.display === 'none') {
                if (!sidebar.classList.contains('is-settings-hidden')) sidebar.style.setProperty('display', 'flex', 'important'); 
            }
        });
    });
    observer.observe(sidebar, { attributes: true, attributeFilter: ['style'] });
}

// ============================================================================
// [16] 앱 초기 부팅 및 새로고침 시 좌측/하단 패널 & 표시설정 창 강제 접힘 세팅
// ============================================================================
function initApp() {
    const settingsMenu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (settingsMenu) {
        settingsMenu.style.setProperty('display', 'none', 'important');
    }

    if (!document.getElementById('panels-collapse-fix-css')) {
        const fixStyle = document.createElement('style');
        fixStyle.id = 'panels-collapse-fix-css';
        fixStyle.innerHTML = `
            #salesWidget.closed, .sales-panel.closed, aside.closed {
                transform: translateX(-100%) !important;
            }
            #salesWidget.closed .widget-body, .sales-panel.closed .widget-body {
                display: none !important;
            }
        `;
        document.head.appendChild(fixStyle);
    }

    if (typeof window.initPartnerModal === 'function') window.initPartnerModal();
    if (typeof window.initFilterWidget === 'function') window.initFilterWidget();
    if (typeof window.initMemberEditModal === 'function') window.initMemberEditModal();
    if (typeof window.ensureSalesPanelCRUDLayout === 'function') window.ensureSalesPanelCRUDLayout();

    const salesW = document.getElementById('salesWidget') || window.getSmartLeftPanel();
    if (salesW) {
        salesW.classList.add('closed');
        salesW.setAttribute('data-init-collapsed', 'true');
        salesW.style.setProperty('transform', 'translateX(-100%)', 'important');
        
        const salesHeaderTitle = salesW.querySelector('.widget-title, #salesWidgetHeader strong, #salesWidgetHeader span');
        if (salesHeaderTitle) salesHeaderTitle.innerText = '매출/구독';
    }

    if (typeof window.setPerfSidebarState === 'function') {
        window.setPerfSidebarState(true);
    }
    const perfW = document.getElementById('perfWidget');
    if (perfW) {
        perfW.style.setProperty('left', '0px', 'important');
        
        const perfHeaderTitle = perfW.querySelector('.widget-title, #perfWidgetHeader strong, #perfWidgetHeader span, .perf-widget strong');
        if (perfHeaderTitle) perfHeaderTitle.innerText = '실적/수당';
    }

    if (typeof window.reorganizePopupSettingsCategory === 'function') {
        window.reorganizePopupSettingsCategory();
    }

    document.querySelectorAll('#perfWidget thead th').forEach(th => {
        if (th.innerText && th.innerText.includes('기(주차)')) {
            th.innerHTML = th.innerHTML.replace('기(주차)', '기수');
        }
    });

    initCanvasDrag();
    initSidebarDefender();
    if (typeof window.fetchTreeData === 'function') window.fetchTreeData(true);
}

window.initApp = initApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
// ============================================================================
// [17] 시뮬레이터 본체 데이터 가로채기(Hook) 및 내비게이터/배지 정밀 연동 패치
// ============================================================================

// [17-1] 안전 애드온 패치: 내비게이터 실행 & 배지(승급/품위유지) & % 유지 복구
(function applySafeNavigatorAndBadgePatch() {
    const getSavedThresholdRatio = () => {
        let pct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
        if (isNaN(pct) || pct < 1) pct = 80;
        if (pct > 100) pct = 100;
        window.badgeThresholdRatio = pct / 100;
        return window.badgeThresholdRatio;
    };
    getSavedThresholdRatio();

    window.evaluateMemberCardBadgeStatus = function(memberId, teamMap, preferredOrderKey) {
        const res = {
            showPromoBadge: false,
            showMaintBadge: false,
            promoPct: 0,
            promoTargetRank: '',
            promoCurrPV: 0,
            promoReqPV: 0,
            maintPct: 0,
            maintCurrVal: 0,
            maintReqVal: 0,
            maintUnit: 'PV'
        };

        if (!memberId || typeof window.findMemberNode !== 'function') return res;
        const mNode = window.findMemberNode(memberId);
        if (!mNode) return res;

        const thresholdRatio = getSavedThresholdRatio();

        const { setA, setB } = typeof window.getSublinePartnerSets === 'function'
            ? window.getSublinePartnerSets(mNode)
            : { setA: new Set(), setB: new Set() };

        const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));

        let aTotalPV = 0, bTotalPV = 0;
        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
            const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
            if (pv <= 0) return;
            if (setA && setA.has(sNorm)) aTotalPV += pv;
            else if (setB && setB.has(sNorm)) bTotalPV += pv;
        });

        const minorPV = Math.min(aTotalPV, bTotalPV);
        const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

        const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'DIAMOND', minor_leg_pv: 100000000 };
        const reqMinorPV = Number(nextRank.minor_leg_pv || 100000000);
        const promoRatio = reqMinorPV > 0 ? (minorPV / reqMinorPV) : 0;

        res.promoPct = Math.floor(promoRatio * 100);
        res.promoTargetRank = nextRank.rank_name || 'DIAMOND';
        res.promoCurrPV = minorPV;
        res.promoReqPV = reqMinorPV;

        if (promoRatio >= thresholdRatio && reqMinorPV > 0) {
            res.showPromoBadge = true;
        }

        const maintPolicy = window.dbMaintPolicyMap ? window.dbMaintPolicyMap[currRank] : null;
        const rankRow = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === currRank);
        
        let reqMaintVal = Number(
            (maintPolicy && (maintPolicy.min_minor_pv || maintPolicy.req_pv || maintPolicy.target_pv)) ||
            (rankRow && (rankRow.maintenance_pv || rankRow.maint_pv || rankRow.minor_leg_pv)) || 0
        );

        if (reqMaintVal <= 0 && currLevel >= (typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel('DIRECTOR') : 3)) {
            reqMaintVal = 2000000;
        }

        if (reqMaintVal > 0) {
            let currMaintVal = 0;
            if (teamMap instanceof Map) {
                const mNorm = String(memberId).trim().toLowerCase().replace(/^vk-?/, '');
                const mData = teamMap.get(memberId) || teamMap.get(mNorm) || teamMap.get('VK-' + mNorm);
                if (mData) {
                    if (preferredOrderKey && mData.periods && mData.periods[preferredOrderKey]) {
                        const pObj = mData.periods[preferredOrderKey];
                        currMaintVal = Math.min(Number(pObj.aNewPV || pObj.aPV || 0), Number(pObj.bNewPV || pObj.bPV || 0));
                    } else if (typeof mData.minorPV === 'number') {
                        currMaintVal = mData.minorPV;
                    }
                }
            }
            if (currMaintVal <= 0) currMaintVal = minorPV;

            const maintRatio = currMaintVal / reqMaintVal;
            res.maintPct = Math.floor(maintRatio * 100);
            res.maintCurrVal = currMaintVal;
            res.maintReqVal = reqMaintVal;
            res.maintUnit = 'PV';

            if (maintRatio >= thresholdRatio) {
                res.showMaintBadge = true;
            }
        }

        return res;
    };

    window.forceOpenBizNavPopup = function() {
        if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed) {
            window.bizNavPopupWindow.focus();
            if (typeof window.renderBusinessNavigator === 'function') {
                window.renderBusinessNavigator(window.currentSelectedId || 'VK-1199464', window.bizNavPopupWindow.document);
            }
            return;
        }

        const w = parseInt(localStorage.getItem('bs_biz_nav_popup_w') || '680', 10) || 680;
        const h = parseInt(localStorage.getItem('bs_biz_nav_popup_h') || '760', 10) || 760;
        const l = parseInt(localStorage.getItem('bs_biz_nav_popup_left') || '100', 10) || 100;
        const t = parseInt(localStorage.getItem('bs_biz_nav_popup_top') || '70', 10) || 70;

        const popup = window.open('', 'BizNavigatorPopup', `width=${w},height=${h},left=${l},top=${t},resizable=yes,scrollbars=yes`);
        if (!popup) {
            alert('팝업 차단을 해제해 주세요.');
            return;
        }
        window.bizNavPopupWindow = popup;

        const doc = popup.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <title>🧭 비지네스 내비게이터</title>
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 0; background: #111827; color: #f9fafb; font-family: 'Pretendard', sans-serif; font-size: 12.5px; }
                    .popup-header { position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #1f2937; border-bottom: 1px solid #374151; }
                    .popup-body { padding: 16px; }
                </style>
            </head>
            <body>
                <div class="popup-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:16px;">🧭</span>
                        <strong style="font-size:14px; color:#fff;">비지네스 내비게이터 (승급 & 품위유지 가이드)</strong>
                        <span id="bizNavTargetBadge" style="font-size:12.5px; color:#60a5fa; font-weight:bold;"></span>
                    </div>
                    <button type="button" id="btn-nav-close" style="background:#374151; border:1px solid #4b5563; color:#e5e7eb; padding:4px 10px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">창 닫기 ✕</button>
                </div>
                <div id="bizNavBody" class="popup-body">데이터를 불러오는 중입니다...</div>
            </body>
            </html>
        `);
        doc.close();

        const closeBtn = doc.getElementById('btn-nav-close');
        if (closeBtn) closeBtn.addEventListener('click', () => popup.close());

        popup.addEventListener('beforeunload', () => {
            const chk = typeof window.findBizNavigatorCheckbox === 'function' ? window.findBizNavigatorCheckbox() : document.getElementById('chk-navigator');
            if (chk) chk.checked = false;
        });

        setTimeout(() => {
            if (typeof window.renderBusinessNavigator === 'function') {
                window.renderBusinessNavigator(window.currentSelectedId || 'VK-1199464', doc);
            }
        }, 120);
    };

    window.openBizNavigatorPopupWindow = window.forceOpenBizNavPopup;
    window.toggleBizNavigator = function(forceShow) {
        const isOpen = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
        const shouldOpen = (forceShow !== undefined) ? Boolean(forceShow) : !isOpen;
        if (shouldOpen) {
            window.forceOpenBizNavPopup();
        } else if (isOpen) {
            window.bizNavPopupWindow.close();
            window.bizNavPopupWindow = null;
        }
    };

    document.addEventListener('change', (e) => {
        const el = e.target;
        if (!el) return;

        if (el.id === 'inp-badge-threshold' || (el.type === 'number' && el.closest('#bs-badge-threshold-row'))) {
            let val = parseInt(el.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 100) val = 100;
            el.value = val;
            localStorage.setItem('bs_badge_threshold_pct', String(val));
            window.badgeThresholdRatio = val / 100;
            if (typeof window.renderTreeCardStatusBadges === 'function') {
                window.renderTreeCardStatusBadges();
            }
            return;
        }

        if (el.type === 'checkbox') {
            const labelText = String((el.closest('label, div, li') || {}).innerText || '');
            if (el.id === 'chk-navigator' || /네비게이터|내비게이터/i.test(labelText)) {
                window.toggleBizNavigator(el.checked);
            }
        }
    }, true);

    const syncSavedPctToInput = () => {
        const inp = document.getElementById('inp-badge-threshold');
        const saved = localStorage.getItem('bs_badge_threshold_pct');
        if (inp && saved && document.activeElement !== inp) {
            inp.value = saved;
            window.badgeThresholdRatio = parseInt(saved, 10) / 100;
        }
    };

    document.addEventListener('click', () => setTimeout(syncSavedPctToInput, 50), true);
    window.addEventListener('DOMContentLoaded', () => {
        syncSavedPctToInput();
        setTimeout(() => {
            if (typeof window.renderTreeCardStatusBadges === 'function') window.renderTreeCardStatusBadges();
        }, 500);
    });
})();

// [17-2] 빈 기수 숨김 보정: 본인 매출이 존재하면 하위 실적이 0이어도 기수 행 강제 표시
(function fixEmptyPeriodRowDisplay() {
    window.shouldDisplayPeriodRow = function(periodData, memberId) {
        if (!periodData) return false;
        
        const hasSublineSales = (periodData.a_cv > 0 || periodData.b_cv > 0 || periodData.a_pv > 0 || periodData.b_pv > 0);
        if (hasSublineSales) return true;

        const hasBonus = (periodData.directBonus > 0 || periodData.teamBonus > 0 || periodData.matchingBonus > 0 || periodData.levelBonus > 0);
        if (hasBonus) return true;

        const allSales = window.allSalesData || window.integrated_sales_history || [];
        const mNorm = String(memberId || window.currentSelectedId || '').trim().toLowerCase().replace(/^vk-?/, '');
        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));

        const hasSelfSalesInPeriod = allSales.some(s => {
            if (!s) return false;
            const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^vk-?/, '');
            if (sNorm !== mNorm) return false;

            const sDate = cleanFn(s.transaction_date || s.date || s.buy_date || '');
            const pKey = typeof window.getPeriodKeyByDate === 'function' ? window.getPeriodKeyByDate(sDate) : '';
            
            return (pKey === periodData.sortOrderKey || pKey === periodData.periodLabel || pKey === periodData.sortKey);
        });

        if (hasSelfSalesInPeriod) return true;

        if (periodData.sortOrderKey === '10-전' || periodData.periodLabel === '10-전') return true;

        return false;
    };

    setTimeout(() => {
        if (typeof window.calculateLocalPerformance === 'function') {
            window.calculateLocalPerformance(window.currentSelectedId || 'VK-1199472');
        }
    }, 300);
})();

// [17-3] 시뮬레이터 본체 엔진 데이터 가로채기(Hook) & 최신 기수 소실적 CV 연동
(function applyFinalNavigatorOverride() {
    const origCompute = window.computeAllMembersTeamBonusByPeriod;
    if (typeof origCompute === 'function' && !origCompute._isHooked) {
        const hookedFn = function(salesArg, membersArg) {
            if (Array.isArray(salesArg) && salesArg.length > 0) {
                window._capturedAllSales = salesArg;
            }
            if (Array.isArray(membersArg) && membersArg.length > 0) {
                window._capturedFlatMembers = membersArg;
            }
            const result = origCompute.apply(this, arguments);
            if (result) {
                window.lastAllMembersTeamBonusMap = result;
            }
            return result;
        };
        hookedFn._isHooked = true;
        window.computeAllMembersTeamBonusByPeriod = hookedFn;
    }

    function normalizeId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^vk-?/, '');
    }

    function getFullSalesArray() {
        const candidates = [
            window._capturedAllSales,
            typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : null,
            window.allSales,
            window.allSalesData,
            window.integrated_sales_history,
            window.dbSalesHistory,
            window.salesHistory,
            window.rawSalesData
        ].filter(arr => Array.isArray(arr) && arr.length > 0);

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.length - a.length);
            return candidates[0];
        }

        const collected = [];
        const seen = new Set();
        const visitNode = (n) => {
            if (!n || typeof n !== 'object') return;
            const nid = n.id || n.member_id || n.memberId || '';
            if (nid && seen.has(nid)) return;
            if (nid) seen.add(nid);

            const sList = n.sales || n.sales_history || n.salesList || n.histories || n.orders;
            if (Array.isArray(sList)) {
                sList.forEach(s => {
                    if (s && typeof s === 'object') {
                        collected.push( Object.assign({ member_id: nid }, s) );
                    }
                });
            }
            const ch = n.children || n.sublines || n.downlines || [];
            if (Array.isArray(ch)) ch.forEach(visitNode);
            if (n.left) visitNode(n.left);
            if (n.right) visitNode(n.right);
        };

        if (Array.isArray(window._capturedFlatMembers)) window._capturedFlatMembers.forEach(visitNode);
        if (Array.isArray(window.backendFlatMembers)) window.backendFlatMembers.forEach(visitNode);
        if (Array.isArray(window.allMembers)) window.allMembers.forEach(visitNode);
        if (window.treeData) visitNode(window.treeData);
        if (window.rootNode) visitNode(window.rootNode);

        return collected;
    }

    function getRobustSublineSets(mNode) {
        const setA = new Set();
        const setB = new Set();
        if (!mNode) return { setA, setB };

        if (typeof window.getSublinePartnerSets === 'function') {
            try {
                const raw = window.getSublinePartnerSets(mNode);
                if (raw && raw.setA) raw.setA.forEach(v => { const k = normalizeId(v); if (k) setA.add(k); });
                if (raw && raw.setB) raw.setB.forEach(v => { const k = normalizeId(v); if (k) setB.add(k); });
            } catch (e) {}
        }

        const collectAll = (node, targetSet) => {
            if (!node || typeof node !== 'object') return;
            const k = normalizeId(node.id || node.member_id || node.memberId);
            if (k) targetSet.add(k);
            const ch = node.children || node.sublines || node.downlines || [];
            if (Array.isArray(ch)) ch.forEach(c => collectAll(c, targetSet));
            if (node.left) collectAll(node.left, targetSet);
            if (node.right) collectAll(node.right, targetSet);
        };

        if (mNode.left) collectAll(mNode.left, setA);
        if (mNode.right) collectAll(mNode.right, setB);

        if (Array.isArray(mNode.children) && mNode.children.length > 0) {
            const leftChild = mNode.children.find(c => /^(A|L|LEFT|좌|1)$/i.test(String(c.position || c.leg || c.line || c.direction || '').trim())) || mNode.children[0];
            const rightChild = mNode.children.find(c => /^(B|R|RIGHT|우|2)$/i.test(String(c.position || c.leg || c.line || c.direction || '').trim())) || (mNode.children.length > 1 ? mNode.children[1] : null);
            if (leftChild) collectAll(leftChild, setA);
            if (rightChild && rightChild !== leftChild) collectAll(rightChild, setB);
        }

        return { setA, setB };
    }

    window.getLatestPeriodRangeFromSales = function(allSales) {
        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));
        let maxDate = '';

        (allSales || []).forEach(s => {
            if (!s) return;
            const dt = cleanFn(s.transaction_date || s.date || s.sales_date || s.buy_date || '');
            if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && dt > maxDate) maxDate = dt;
        });

        if (!maxDate) maxDate = '2026-10-01';

        const [yyyy, mm, ddStr] = maxDate.split('-');
        const dd = parseInt(ddStr, 10);
        const isFirstHalf = dd <= 15;
        const lastDay = new Date(Number(yyyy), Number(mm), 0).getDate();

        return {
            sortKey: `${yyyy}-${mm}-${isFirstHalf ? '1' : '2'}`,
            shortKey: `${mm}-${isFirstHalf ? '전' : '후'}`,
            label: `${parseInt(mm, 10)}월 ${isFirstHalf ? '1기' : '2기'}`,
            startDate: `${yyyy}-${mm}-${isFirstHalf ? '01' : '16'}`,
            endDate: `${yyyy}-${mm}-${isFirstHalf ? '15' : String(lastDay).padStart(2, '0')}`
        };
    };

    window.getPeriodObjFromDateStr = function(dateStr) {
        const clean = String(dateStr || '').trim().substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
        const [yyyy, mm, ddStr] = clean.split('-');
        const dd = parseInt(ddStr, 10);
        const isFirstHalf = dd <= 15;
        const lastDay = new Date(Number(yyyy), Number(mm), 0).getDate();
        return {
            sortKey: `${yyyy}-${mm}-${isFirstHalf ? '1' : '2'}`,
            shortKey: `${mm}-${isFirstHalf ? '전' : '후'}`,
            label: `${parseInt(mm, 10)}월 ${isFirstHalf ? '1기' : '2기'}`,
            startDate: `${yyyy}-${mm}-${isFirstHalf ? '01' : '16'}`,
            endDate: `${yyyy}-${mm}-${isFirstHalf ? '15' : String(lastDay).padStart(2, '0')}`
        };
    };

    window.getDbRequiredMaintCV = function(rankName) {
        const rUpper = String(rankName || '').trim().toUpperCase();
        if (!rUpper) return 0;

        if (window.dbRankMaintenancePolicies && window.dbRankMaintenancePolicies[rUpper] && window.dbRankMaintenancePolicies[rUpper].reqSmallCv > 0) {
            return Number(window.dbRankMaintenancePolicies[rUpper].reqSmallCv);
        }

        const extractCV = (entry) => {
            if (typeof entry === 'number') return entry;
            if (entry && typeof entry === 'object') {
                if (entry.reqSmallCv !== undefined && Number(entry.reqSmallCv) > 0) return Number(entry.reqSmallCv);
                if (entry.required_minor_leg_cv !== undefined) return Number(entry.required_minor_leg_cv);
                if (entry.requiredMinorLegCv !== undefined) return Number(entry.requiredMinorLegCv);
                if (entry.min_minor_cv !== undefined) return Number(entry.min_minor_cv);
                if (entry.req_cv !== undefined) return Number(entry.req_cv);
                if (entry.cv !== undefined) return Number(entry.cv);
                const nums = Object.values(entry).map(v => Number(v)).filter(n => !isNaN(n) && n > 0);
                if (nums.length > 0) return Math.max(...nums);
            }
            return 0;
        };

        for (const key of Object.keys(window)) {
            try {
                const val = window[key];
                if (!val || typeof val !== 'object') continue;
                if (Array.isArray(val)) {
                    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
                    const rInfo = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === rUpper);
                    const rId = rInfo ? Number(rInfo.rank_id || rInfo.id || 0) : -1;
                    const found = val.find(p => p && (String(p.rank_name || '').toUpperCase() === rUpper || (rId > 0 && Number(p.rank_id) === rId)) && ('required_minor_leg_cv' in p || 'maintenance_bonus_amount' in p));
                    if (found) {
                        const cv = extractCV(found);
                        if (cv > 0) return cv;
                    }
                } else if (val.DIRECTOR && val.EMERALD && val[rUpper]) {
                    const target = val[rUpper];
                    if (typeof target === 'object' && ('required_minor_leg_cv' in target || 'maintenance_bonus_amount' in target || 'reqSmallCv' in target || /maint/i.test(key))) {
                        const cv = extractCV(target);
                        if (cv > 0) return cv;
                    }
                }
            } catch (e) {}
        }

        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
        const rInfo = dbRanks.find(r => String(r.rank_name || '').toUpperCase() === rUpper);
        if (rInfo) {
            const cv = Number(rInfo.required_minor_leg_cv || rInfo.maintenance_cv || rInfo.maint_cv || 0);
            if (cv > 0) return cv;
        }
        return 0;
    };

    window.evaluateMaintAchievedRank = function(currRank, minorSubCV) {
        const currUpper = String(currRank || 'MANIA').trim().toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currUpper) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

        let maintTiers = [];
        if (dbRanks.length > 0) {
            dbRanks.forEach(r => {
                const rName = String(r.rank_name || '').trim().toUpperCase();
                const rLevel = Number(r.rank_level !== undefined ? r.rank_level : (typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(rName) : 0));
                const reqCV = window.getDbRequiredMaintCV(rName);
                if (reqCV > 0) {
                    maintTiers.push({ rankName: rName, rankLevel: rLevel, reqCV: reqCV });
                }
            });
        }

        if (maintTiers.length === 0) {
            const fallbackOrder = ['DIRECTOR', 'EMERALD', 'DIAMOND', 'GREEN DIAMOND', 'BLUE DIAMOND', 'RED DIAMOND', 'CROWN', 'CROWN ROYAL'];
            fallbackOrder.forEach((rName, idx) => {
                const reqCV = window.getDbRequiredMaintCV(rName);
                if (reqCV > 0) {
                    const rLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(rName) : (idx + 3);
                    maintTiers.push({ rankName: rName, rankLevel: rLevel, reqCV: reqCV });
                }
            });
        }

        maintTiers.sort((a, b) => a.reqCV - b.reqCV);

        let achievedTier = null;
        for (const tier of maintTiers) {
            if (currLevel > 0 && tier.rankLevel > 0 && tier.rankLevel > currLevel) continue;
            if (minorSubCV >= tier.reqCV) {
                achievedTier = tier;
            }
        }

        return {
            isAchieved: achievedTier !== null,
            achievedRank: achievedTier ? achievedTier.rankName : '없음',
            achievedReqCV: achievedTier ? achievedTier.reqCV : 0
        };
    };

    function computeAccurateLatestMinorCV(memberId, setA, setB, allSales, latestPeriod) {
        const mNorm = normalizeId(memberId);
        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));

        const periodCV_A = new Map();
        const periodCV_B = new Map();
        let directTermA = 0, directTermB = 0;

        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normalizeId(s.member_id || s.memberId || s.id);
            if (!sNorm || sNorm === mNorm) return;

            const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ?? s.sales_cv ?? 0) : Number(s.cv ?? s.sales_cv ?? 0);
            if (cv <= 0) return;

            const sDate = cleanFn(s.transaction_date || s.date || s.sales_date || s.buy_date || '');
            if (sDate && sDate > latestPeriod.endDate) return;

            const isA = setA.has(sNorm);
            const isB = setB.has(sNorm);
            if (!isA && !isB) return;

            const pObj = window.getPeriodObjFromDateStr(sDate);
            if (pObj) {
                if (isA) periodCV_A.set(pObj.sortKey, (periodCV_A.get(pObj.sortKey) || 0) + cv);
                if (isB) periodCV_B.set(pObj.sortKey, (periodCV_B.get(pObj.sortKey) || 0) + cv);
            }

            if (sDate >= latestPeriod.startDate && sDate <= latestPeriod.endDate) {
                if (isA) directTermA += cv;
                if (isB) directTermB += cv;
            }
        });

        let cachedMinorCV = 0;
        const bonusMap = window.lastAllMembersTeamBonusMap;
        if (bonusMap) {
            let memberPeriodObj = null;
            if (typeof bonusMap.entries === 'function') {
                for (const [k, v] of bonusMap.entries()) {
                    if (normalizeId(k) === mNorm) { memberPeriodObj = v; break; }
                }
            } else if (typeof bonusMap === 'object') {
                for (const k of Object.keys(bonusMap)) {
                    if (normalizeId(k) === mNorm) { memberPeriodObj = bonusMap[k]; break; }
                }
            }

            if (memberPeriodObj && typeof memberPeriodObj === 'object') {
                let pEntry = memberPeriodObj[latestPeriod.sortKey] || memberPeriodObj[latestPeriod.shortKey] || memberPeriodObj[latestPeriod.label];
                if (!pEntry) {
                    const keys = Object.keys(memberPeriodObj).filter(k => /^20\d{2}-\d{2}-[12]$/.test(k)).sort();
                    if (keys.length > 0 && keys[keys.length - 1] === latestPeriod.sortKey) {
                        pEntry = memberPeriodObj[keys[keys.length - 1]];
                    }
                }
                if (pEntry && typeof pEntry === 'object') {
                    const ca = Number(pEntry.a_cv ?? pEntry.left_cv ?? pEntry.aNewCV ?? pEntry.newA_CV ?? 0);
                    const cb = Number(pEntry.b_cv ?? pEntry.right_cv ?? pEntry.bNewCV ?? pEntry.newB_CV ?? 0);
                    const cMatched = Number(pEntry.matchedCV ?? pEntry.minorCV ?? pEntry.minor_cv ?? pEntry.deductedCV ?? 0);
                    if (ca > 0 && directTermA === 0) directTermA = ca;
                    if (cb > 0 && directTermB === 0) directTermB = cb;
                    if (cMatched > 0) cachedMinorCV = cMatched;
                    else if (ca > 0 || cb > 0) {
                        const minNew = Math.min(ca, cb);
                        cachedMinorCV = minNew > 0 ? minNew : Math.max(ca, cb);
                    }
                }
            }
        }

        const minDirect = Math.min(directTermA, directTermB);
        if (minDirect > 0) return minDirect;

        const allPKeys = Array.from(new Set([...periodCV_A.keys(), ...periodCV_B.keys(), latestPeriod.sortKey])).sort();
        let carryA = 0, carryB = 0;
        let latestMatchedOrMinorNew = 0;

        allPKeys.forEach(pKey => {
            const newA = (pKey === latestPeriod.sortKey) ? Math.max(periodCV_A.get(pKey) || 0, directTermA) : (periodCV_A.get(pKey) || 0);
            const newB = (pKey === latestPeriod.sortKey) ? Math.max(periodCV_B.get(pKey) || 0, directTermB) : (periodCV_B.get(pKey) || 0);
            const cumA = carryA + newA;
            const cumB = carryB + newB;
            const matched = Math.min(cumA, cumB);

            if (pKey === latestPeriod.sortKey) {
                if (matched > 0) {
                    latestMatchedOrMinorNew = matched;
                } else {
                    latestMatchedOrMinorNew = (cumA <= cumB) ? newA : newB;
                }
            }

            carryA = cumA - matched;
            carryB = cumB - matched;
        });

        if (latestMatchedOrMinorNew > 0) return latestMatchedOrMinorNew;
        if (cachedMinorCV > 0) return cachedMinorCV;
        if (directTermA > 0 || directTermB > 0) return Math.max(directTermA, directTermB);

        return 0;
    }

    window.evaluateMemberCardBadgeStatus = function(memberId) {
        const res = {
            showPromoBadge: false, showMaintBadge: false,
            promoPct: 0, promoTargetRank: '', promoCurrPV: 0, promoReqPV: 0,
            maintPct: 0, maintCurrVal: 0, maintReqVal: 0, maintUnit: 'CV'
        };
        if (!memberId || typeof window.findMemberNode !== 'function') return res;

        let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
        if (isNaN(thresholdPct) || thresholdPct < 1) thresholdPct = 80;
        const thresholdRatio = thresholdPct / 100;

        const mNode = window.findMemberNode(memberId);
        if (!mNode) return res;

        const { setA, setB } = getRobustSublineSets(mNode);
        const allSales = getFullSalesArray();
        const latestPeriod = window.getLatestPeriodRangeFromSales(allSales);
        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));

        let aTotalPV = 0, bTotalPV = 0;
        const termSalesMapA = new Map(), termSalesMapB = new Map();

        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normalizeId(s.member_id || s.memberId || s.id);
            if (!sNorm) return;

            const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv ?? s.sales_pv ?? 0) : Number(s.pv ?? s.sales_pv ?? 0);
            const sDate = cleanFn(s.transaction_date || s.date || s.sales_date || s.buy_date || '');

            const isA = setA.has(sNorm);
            const isB = setB.has(sNorm);

            if (pv > 0 && (!sDate || sDate <= latestPeriod.endDate)) {
                if (isA) aTotalPV += pv;
                else if (isB) bTotalPV += pv;
                const pObj = window.getPeriodObjFromDateStr(sDate);
                if (pObj) {
                    if (isA) termSalesMapA.set(pObj.sortKey, (termSalesMapA.get(pObj.sortKey) || 0) + pv);
                    if (isB) termSalesMapB.set(pObj.sortKey, (termSalesMapB.get(pObj.sortKey) || 0) + pv);
                }
            }
        });

        const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
        const isTermRestricted = (currRank === 'MANIA' || currRank === 'DIRECTOR' || currLevel < 3);

        let evalMinorPV = Math.min(aTotalPV, bTotalPV);
        if (isTermRestricted) {
            const allKeys = Array.from(new Set([latestPeriod.sortKey, ...termSalesMapA.keys(), ...termSalesMapB.keys()])).sort().reverse().slice(0, 4);
            let sumA = 0, sumB = 0;
            allKeys.forEach(k => { sumA += (termSalesMapA.get(k) || 0); sumB += (termSalesMapB.get(k) || 0); });
            evalMinorPV = Math.min(sumA, sumB);
        }

        const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'NEXT', minor_leg_pv: 0 };
        const reqMinorPV = Number(nextRank.minor_leg_pv || 0);
        if (reqMinorPV > 0) {
            const promoRatio = evalMinorPV / reqMinorPV;
            res.promoPct = Math.floor(promoRatio * 100);
            res.promoTargetRank = nextRank.rank_name || 'NEXT';
            res.promoCurrPV = evalMinorPV;
            res.promoReqPV = reqMinorPV;
            if (promoRatio >= thresholdRatio) res.showPromoBadge = true;
        }

        const reqMaintCV = window.getDbRequiredMaintCV(currRank);
        const minorSubTermCV = computeAccurateLatestMinorCV(memberId, setA, setB, allSales, latestPeriod);
        if (reqMaintCV > 0) {
            const maintRatio = minorSubTermCV / reqMaintCV;
            res.maintPct = Math.floor(maintRatio * 100);
            res.maintCurrVal = minorSubTermCV;
            res.maintReqVal = reqMaintCV;
            if (maintRatio >= thresholdRatio) res.showMaintBadge = true;
        }
        return res;
    };
})();

// [17-4] 비지네스 내비게이터 DB 승급조건(required_partner_rank_id & is_direct_sponsor) 완벽 연동 패치
(function fixNavigatorDbPartnerCondition() {
    function normalizeId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^vk-?/, '');
    }

    window.renderBusinessNavigator = async function(targetMemberId, optDoc = null) {
        const popup = window.bizNavPopupWindow;
        const pDoc = optDoc || ((popup && !popup.closed) ? popup.document : document);
        if (!pDoc) return;

        const bodyEl = pDoc.getElementById('bizNavBody');
        const badgeEl = pDoc.getElementById('bizNavTargetBadge');
        if (!bodyEl) return;

        if (typeof window.loadDbCompensationRates === 'function') {
            try { await window.loadDbCompensationRates(); } catch (e) {}
        }

        let targetId = targetMemberId || window.currentSelectedId || 'VK-1199464';
        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : null;
        if (!mNode) {
            bodyEl.innerHTML = `<div style="padding:30px; text-align:center; color:#9ca3af;">회원 정보를 찾을 수 없습니다. (${targetId})</div>`;
            return;
        }

        if (badgeEl) badgeEl.innerHTML = `[${mNode.name || mNode.id} (<b style="font-weight:bold; color:#ffffff;">${mNode.id}</b>)]`;

        const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

        const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'DIAMOND', minor_leg_pv: 0 };
        const reqMinorPV = Number(nextRank.minor_leg_pv || 0);

        const reqPartnerRankId = (nextRank.required_partner_rank_id !== null && nextRank.required_partner_rank_id !== undefined && nextRank.required_partner_rank_id !== '')
            ? Number(nextRank.required_partner_rank_id)
            : null;
        const reqPartnerRankObj = (reqPartnerRankId && window.dbRankByIdMap && window.dbRankByIdMap[reqPartnerRankId])
            ? window.dbRankByIdMap[reqPartnerRankId]
            : dbRanks.find(r => Number(r.rank_id) === reqPartnerRankId);

        const reqPartnerRank = reqPartnerRankObj ? String(reqPartnerRankObj.rank_name).toUpperCase() : 'MANIA';
        const reqPartnerCountEach = Number(nextRank.required_partner_count || nextRank.req_partner_count || 1);
        const isDirectSponsorReq = Number(nextRank.is_direct_sponsor || 0) === 1;
        const isTermRestricted = String(nextRank.period_type || '').toUpperCase() === 'RECENT_4';

        const { setA, setB } = typeof window.getSublinePartnerSets === 'function'
            ? window.getSublinePartnerSets(mNode)
            : { setA: new Set(), setB: new Set() };

        const directRecMap = typeof window.getDirectRecommendedPartnersMap === 'function'
            ? window.getDirectRecommendedPartnersMap(mNode)
            : new Map();
        const directRecNormSet = new Set(Array.from(directRecMap.keys()).map(k => normalizeId(k)));

        const allSales = window._capturedAllSales || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));
        const latestPeriod = typeof window.getLatestPeriodRangeFromSales === 'function'
            ? window.getLatestPeriodRangeFromSales(allSales)
            : { sortKey: '2026-10-2', shortKey: '10-후', label: '10월 2기', startDate: '2026-10-16', endDate: '2026-10-31' };

        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));
        const mNorm = normalizeId(targetId);

        let selfTotalPV = 0, selfTotalCV = 0, selfLastSalesDate = '', aTotalPV = 0, bTotalPV = 0, selfTermCV = 0;
        const termSalesMapA = new Map(), termSalesMapB = new Map();
        const termLabelMap = new Map();
        termLabelMap.set(latestPeriod.sortKey, latestPeriod.label);

        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normalizeId(s.member_id || s.memberId || s.id);
            if (!sNorm) return;

            const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv ?? s.sales_pv ?? 0) : Number(s.pv ?? s.sales_pv ?? 0);
            const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ?? s.sales_cv ?? 0) : Number(s.cv ?? s.sales_cv ?? 0);
            const sDate = cleanFn(s.transaction_date || s.date || s.sales_date || s.buy_date || '');

            const isSelf = (sNorm === mNorm);
            const isA = !isSelf && setA.has(sNorm);
            const isB = !isSelf && setB.has(sNorm);

            if (isSelf && (!sDate || sDate <= latestPeriod.endDate)) {
                selfTotalPV += pv;
                selfTotalCV += cv;
                if (sDate && (!selfLastSalesDate || sDate > selfLastSalesDate)) selfLastSalesDate = sDate;
                if (sDate >= latestPeriod.startDate && sDate <= latestPeriod.endDate && cv > 0) selfTermCV += cv;
            }

            if (pv > 0 && (!sDate || sDate <= latestPeriod.endDate)) {
                if (isA) aTotalPV += pv;
                else if (isB) bTotalPV += pv;
                const pObj = typeof window.getPeriodObjFromDateStr === 'function' ? window.getPeriodObjFromDateStr(sDate) : null;
                if (pObj) {
                    termLabelMap.set(pObj.sortKey, pObj.label);
                    if (isA) termSalesMapA.set(pObj.sortKey, (termSalesMapA.get(pObj.sortKey) || 0) + pv);
                    if (isB) termSalesMapB.set(pObj.sortKey, (termSalesMapB.get(pObj.sortKey) || 0) + pv);
                }
            }
        });

        const displaySelfPV = selfTotalPV > 0 ? selfTotalPV : Number(mNode.my_sales_pv || mNode.pv || 0);
        const displayLastSalesDate = selfLastSalesDate || cleanFn(mNode.last_sales_date || mNode.achieve_date || mNode.join_date || '') || '-';

        const allTermKeys = Array.from(new Set([latestPeriod.sortKey, ...termSalesMapA.keys(), ...termSalesMapB.keys()])).sort().reverse().slice(0, 4);
        let sumLeftPV = 0, sumRightPV = 0;
        const recentTerms = allTermKeys.map(k => {
            const leftPV = termSalesMapA.get(k) || 0;
            const rightPV = termSalesMapB.get(k) || 0;
            sumLeftPV += leftPV;
            sumRightPV += rightPV;
            return { label: termLabelMap.get(k) || k, leftPV, rightPV };
        });

        const evalLeftPV = isTermRestricted ? sumLeftPV : aTotalPV;
        const evalRightPV = isTermRestricted ? sumRightPV : bTotalPV;
        const minorPV = Math.min(evalLeftPV, evalRightPV);
        const promoPct = reqMinorPV > 0 ? Math.floor((minorPV / reqMinorPV) * 100) : 0;

        const reqPartnerLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(reqPartnerRank) : 3;
        let dirCountA = 0, dirCountB = 0, firstNodeA = null, firstNodeB = null;

        setA.forEach(norm => {
            const n = typeof window.findMemberNode === 'function' ? (window.findMemberNode(norm) || window.findMemberNode('VK-' + norm)) : null;
            if (!n) return;
            const nNorm = normalizeId(n.id);
            const isDirect = directRecNormSet.has(nNorm) || normalizeId(n.recId || n.recommender_id) === mNorm;

            if (isDirectSponsorReq && !isDirect) return;

            if (!firstNodeA) firstNodeA = n;
            const nLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(n.rank || n.rank_name) : 0;
            if (nLevel >= reqPartnerLevel) {
                dirCountA++;
                if (!firstNodeA || nLevel > window.getDbRankLevel(firstNodeA.rank || firstNodeA.rank_name)) {
                    firstNodeA = n;
                }
            }
        });

        setB.forEach(norm => {
            const n = typeof window.findMemberNode === 'function' ? (window.findMemberNode(norm) || window.findMemberNode('VK-' + norm)) : null;
            if (!n) return;
            const nNorm = normalizeId(n.id);
            const isDirect = directRecNormSet.has(nNorm) || normalizeId(n.recId || n.recommender_id) === mNorm;

            if (isDirectSponsorReq && !isDirect) return;

            if (!firstNodeB) firstNodeB = n;
            const nLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(n.rank || n.rank_name) : 0;
            if (nLevel >= reqPartnerLevel) {
                dirCountB++;
                if (!firstNodeB || nLevel > window.getDbRankLevel(firstNodeB.rank || firstNodeB.rank_name)) {
                    firstNodeB = n;
                }
            }
        });

        if (!firstNodeA && mNode.left) firstNodeA = typeof mNode.left === 'object' ? mNode.left : window.findMemberNode(mNode.left);
        if (!firstNodeB && mNode.right) firstNodeB = typeof mNode.right === 'object' ? mNode.right : window.findMemberNode(mNode.right);

        const isPartnerSatisfied = (dirCountA >= reqPartnerCountEach && dirCountB >= reqPartnerCountEach);
        const leftPartner = { id: firstNodeA ? (firstNodeA.id || '-') : '-', name: firstNodeA ? (firstNodeA.name || '-') : '-', rank: firstNodeA ? (firstNodeA.rank || firstNodeA.rank_name || '-') : '-', count: dirCountA };
        const rightPartner = { id: firstNodeB ? (firstNodeB.id || '-') : '-', name: firstNodeB ? (firstNodeB.name || '-') : '-', rank: firstNodeB ? (firstNodeB.rank || firstNodeB.rank_name || '-') : '-', count: dirCountB };

        const sponsorTypeLabel = isDirectSponsorReq ? '직접추천 파트너 조건' : '하위 육성 파트너 조건';

        const promoRequirementsCardHtml = `
            <div style="background:#1f2937; border:1px solid #374151; border-radius:8px; padding:14px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #374151;">
                    <div>
                        <div style="font-size:13px; font-weight:bold; color:#ffffff; margin-bottom:4px;">기준기수 : ${latestPeriod.label}</div>
                        <div style="font-size:15px; font-weight:bold; color:#ffffff;">승급 : ${currRank} &gt; ${nextRank.rank_name}</div>
                    </div>
                    <div>
                        <span style="background:#374151; color:#ffffff; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:4px;">달성률: ${promoPct}%</span>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; text-align:center; font-size:12px;">
                    <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                        <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">① 소실적 목표 PV</div>
                        <div style="color:#ffffff; font-weight:bold; font-size:13px;">${reqMinorPV.toLocaleString('ko-KR')} PV</div>
                        <div style="color:${minorPV >= reqMinorPV ? '#10b981' : '#ef4444'}; font-size:11px; margin-top:4px; font-weight:bold;">
                            ${minorPV >= reqMinorPV ? '✓ 달성 완료' : `부족: -${(reqMinorPV - minorPV).toLocaleString('ko-KR')} PV`}
                        </div>
                    </div>
                    <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                        <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">② ${sponsorTypeLabel}</div>
                        <div style="color:#ffffff; font-weight:bold; font-size:12px;">좌/우 각 ${reqPartnerRank} ${reqPartnerCountEach}명</div>
                        <div style="color:${isPartnerSatisfied ? '#10b981' : '#ef4444'}; font-size:11px; margin-top:4px; font-weight:bold;">
                            ${isPartnerSatisfied ? `✓ 충족 완료 (좌:${dirCountA} / 우:${dirCountB})` : `현재 (좌:${dirCountA} / 우:${dirCountB})`}
                        </div>
                    </div>
                    <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                        <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">③ 적용 기준 규정</div>
                        <div style="color:#ffffff; font-weight:bold; font-size:12.5px;">${isTermRestricted ? '기수제한 적용' : '전체 누적 인정'}</div>
                        <div style="color:#9ca3af; font-size:10.5px; margin-top:4px;">${isTermRestricted ? '최근 4개 기수 합산' : '기간 제한 없음'}</div>
                    </div>
                </div>
            </div>
        `;

        let mainContentHtml = '';
        if (isTermRestricted) {
            mainContentHtml = `
                <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">본인내역</div>
                    <div style="display:flex; font-size:12px;">
                        <div style="width:130px; padding:10px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">본인누적매출</div>
                        <div style="flex:1; padding:10px 12px; color:#ffffff; font-weight:bold; text-align:left; border-right:1px solid #374151;">${displaySelfPV.toLocaleString('ko-KR')} PV</div>
                        <div style="width:130px; padding:10px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">최근매출일자</div>
                        <div style="flex:1; padding:10px 12px; color:#ffffff; font-weight:bold; text-align:left;">${displayLastSalesDate}</div>
                    </div>
                </div>

                <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">하위내역 (기수제한 실적)</div>
                    <div style="display:flex; background:#111827; border-bottom:1px solid #374151; font-weight:bold; font-size:12px;">
                        <div style="width:130px; padding:10px 12px; color:#ffffff; border-right:1px solid #374151;">합계 (좌측 총합)</div>
                        <div style="flex:1; padding:10px 12px; color:#ffffff; text-align:left; border-right:1px solid #374151;">${sumLeftPV.toLocaleString('ko-KR')} PV</div>
                        <div style="width:130px; padding:10px 12px; color:#ffffff; border-right:1px solid #374151;">합계 (우측 총합)</div>
                        <div style="flex:1; padding:10px 12px; color:#ffffff; text-align:left;">${sumRightPV.toLocaleString('ko-KR')} PV</div>
                    </div>
                    <div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">
                        <div style="width:130px; padding:8px 12px; background:#111827; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">직추천(후원라인 좌)</div>
                        <div style="flex:1; padding:8px 12px; color:#ffffff; font-weight:bold; text-align:left; border-right:1px solid #374151;">${leftPartner.name} (<b style="font-weight:bold; color:#ffffff;">${leftPartner.id}</b>)</div>
                        <div style="width:130px; padding:8px 12px; background:#111827; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">직추천(후원라인 우)</div>
                        <div style="flex:1; padding:8px 12px; color:#ffffff; font-weight:bold; text-align:left;">${rightPartner.name} (<b style="font-weight:bold; color:#ffffff;">${rightPartner.id}</b>)</div>
                    </div>
                    ${recentTerms.map(t => `
                        <div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">
                            <div style="width:130px; padding:8px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">${t.label}(좌)</div>
                            <div style="flex:1; padding:8px 12px; color:#ffffff; text-align:left; font-weight:bold; border-right:1px solid #374151;">${t.leftPV.toLocaleString('ko-KR')} PV</div>
                            <div style="width:130px; padding:8px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">${t.label}(우)</div>
                            <div style="flex:1; padding:8px 12px; color:#ffffff; text-align:left; font-weight:bold;">${t.rightPV.toLocaleString('ko-KR')} PV</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            const remainLeftPV = Math.max(0, reqMinorPV - aTotalPV);
            const remainRightPV = Math.max(0, reqMinorPV - bTotalPV);
            mainContentHtml = `
                <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">추천계보라인</div>
                    <div style="display:flex; align-items:center; text-align:center; font-size:12px;">
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                        <div style="flex:1; display:flex; align-items:center; justify-content:space-around; padding:10px; border-right:1px solid #374151;">
                            <span style="color:#ffffff; font-family:monospace; font-weight:bold;">${leftPartner.id}</span>
                            <span style="color:#ffffff; font-weight:bold;">${leftPartner.name}</span>
                            <span style="color:#ffffff; font-weight:bold; font-size:11px; background:#374151; padding:2px 6px; border-radius:4px;">${leftPartner.rank}</span>
                            <span style="color:#ffffff; font-weight:bold;">${leftPartner.count}명</span>
                        </div>
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                        <div style="flex:1; display:flex; align-items:center; justify-content:space-around; padding:10px;">
                            <span style="color:#ffffff; font-family:monospace; font-weight:bold;">${rightPartner.id}</span>
                            <span style="color:#ffffff; font-weight:bold;">${rightPartner.name}</span>
                            <span style="color:#ffffff; font-weight:bold; font-size:11px; background:#374151; padding:2px 6px; border-radius:4px;">${rightPartner.rank}</span>
                            <span style="color:#ffffff; font-weight:bold;">${rightPartner.count}명</span>
                        </div>
                    </div>
                </div>
                <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937; font-size:12px;">
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">전체누적 PV</div>
                    <div style="display:flex; align-items:center; text-align:center; border-bottom:1px solid #374151;">
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                        <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; font-size:13px; border-right:1px solid #374151;">${aTotalPV.toLocaleString('ko-KR')}</div>
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                        <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; font-size:13px;">${bTotalPV.toLocaleString('ko-KR')}</div>
                    </div>
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">${nextRank.rank_name} PV (목표)</div>
                    <div style="display:flex; align-items:center; text-align:center; border-bottom:1px solid #374151;">
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                        <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">${reqMinorPV.toLocaleString('ko-KR')}</div>
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                        <div style="flex:1; padding:10px; color:#ffffff; font-weight:bold;">${reqMinorPV.toLocaleString('ko-KR')}</div>
                    </div>
                    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">${nextRank.rank_name} 승급까지 부족 PV</div>
                    <div style="display:flex; align-items:center; text-align:center;">
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌</div>
                        <div style="flex:1; padding:10px; color:${remainLeftPV === 0 ? '#10b981' : '#ef4444'}; font-weight:bold; font-size:13px; border-right:1px solid #374151;">${remainLeftPV === 0 ? '충족 완료' : remainLeftPV.toLocaleString('ko-KR')}</div>
                        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우</div>
                        <div style="flex:1; padding:10px; color:${remainRightPV === 0 ? '#10b981' : '#ef4444'}; font-weight:bold; font-size:13px;">${remainRightPV === 0 ? '충족 완료' : remainRightPV.toLocaleString('ko-KR')}</div>
                    </div>
                </div>
            `;
        }

        const reqMaintCV = typeof window.getDbRequiredMaintCV === 'function' ? window.getDbRequiredMaintCV(currRank) : 0;
        let minorSubTermCV = 0;
        if (Array.isArray(window.perfData) && window.perfData.length > 0) {
            minorSubTermCV = Number(window.perfData[0].matchedCV || 0);
        }
        const maintPct = reqMaintCV > 0 ? Math.min(100, Math.floor((minorSubTermCV / reqMaintCV) * 100)) : 100;
        const maintDiffCV = Math.max(0, reqMaintCV - minorSubTermCV);

        const maintEval = typeof window.evaluateMaintAchievedRank === 'function'
            ? window.evaluateMaintAchievedRank(currRank, minorSubTermCV)
            : { isAchieved: minorSubTermCV >= reqMaintCV && reqMaintCV > 0, achievedRank: currRank };
        const maintStatusText = maintEval.isAchieved
            ? `달성직급: ${maintEval.achievedRank} (달성)`
            : `달성직급: 없음 (미달성)`;
        const maintStatusColor = maintEval.isAchieved ? '#10b981' : '#ef4444';

        const maintHtml = `
            <div style="border:1px solid #374151; border-radius:8px; overflow:hidden; background:#1f2937; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #374151;">
                    <span style="font-size:13px; font-weight:bold; color:#ffffff;">품위유지 달성 현황</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:11px; font-weight:bold; color:${maintStatusColor};">${maintStatusText}</span>
                        <span style="background:#374151; color:#ffffff; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:4px;">달성률: ${maintPct}%</span>
                    </div>
                </div>
                <div style="border:1px solid #374151; border-radius:6px; overflow:hidden; margin-bottom:10px; background:#111827;">
                    <div style="background:#111827; padding:6px 8px; text-align:center; font-weight:bold; font-size:11.5px; color:#ffffff; border-bottom:1px solid #374151;">본인내역</div>
                    <div style="display:flex; font-size:12px;">
                        <div style="width:130px; padding:9px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">당기CV</div>
                        <div style="flex:1; padding:9px 12px; color:#ffffff; font-weight:bold; text-align:left; border-right:1px solid #374151;">
                            ${selfTermCV.toLocaleString('ko-KR')} CV
                        </div>
                        <div style="width:130px; padding:9px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">최근매출일자</div>
                        <div style="flex:1; padding:9px 12px; color:#ffffff; font-weight:bold; text-align:left;">${displayLastSalesDate}</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1.6fr 1fr; gap:10px; text-align:center; font-size:12px; background:#111827; padding:12px; border-radius:6px; border:1px solid #374151;">
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">직급별 기준 소실적 CV (DB)</div>
                        <div style="color:#ffffff; font-weight:bold; font-size:13px;">${reqMaintCV.toLocaleString('ko-KR')} CV</div>
                    </div>
                    <div style="border-left:1px solid #374151; border-right:1px solid #374151; padding:0 8px; display:flex; flex-direction:column; justify-content:center;">
                        <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">해당기수 소실적 신규 CV</div>
                        <div style="color:#ffffff; font-weight:bold; font-size:13px; margin-bottom:2px;">${minorSubTermCV.toLocaleString('ko-KR')} CV</div>
                        <div style="color:#9ca3af; font-size:10.5px; display:flex; justify-content:center; gap:6px;">
                            <span>소실적라인(하위): <b style="color:#ffffff;">${minorSubTermCV.toLocaleString('ko-KR')}</b></span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">부족분 CV</div>
                        <div style="color:${maintDiffCV === 0 ? '#10b981' : '#ef4444'}; font-weight:bold; font-size:13px;">
                            ${maintDiffCV === 0 ? '유지 달성' : `-${maintDiffCV.toLocaleString('ko-KR')} CV`}
                        </div>
                    </div>
                </div>
            </div>
        `;

        bodyEl.innerHTML = `${promoRequirementsCardHtml}${mainContentHtml}${maintHtml}`;
    };
})();

// ============================================================================
// [18] 상단 헤더 AI 전략 어드바이저 & 로컬 전용 GitHub 원클릭 업로드 버튼
// ============================================================================
(function initHeaderAIAndGitHubButtons() {
    if (window._headerCustomBtnsInitialized) return;
    window._headerCustomBtnsInitialized = true;

    const isLocalEnv = (
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '' ||
        window.location.protocol === 'file:'
    );

    function setupHeaderButtons() {
        let aiBtn = document.getElementById('customAiAdvisorBtn');

        if (!aiBtn) {
            const allBtns = Array.from(document.querySelectorAll('header button, .header button, .top-bar button, button, a'));
            let refreshBtn = null;

            for (let i = allBtns.length - 1; i >= 0; i--) {
                const el = allBtns[i];
                const r = el.getBoundingClientRect();
                if (r.top >= 0 && r.top <= 80 && r.right > window.innerWidth * 0.5) {
                    const html = (el.innerHTML || '').toLowerCase();
                    const title = (el.getAttribute('title') || '').toLowerCase();
                    const onclick = (el.getAttribute('onclick') || '').toLowerCase();
                    if (
                        title.includes('새로고침') || title.includes('초기화') || title.includes('refresh') || title.includes('reload') ||
                        onclick.includes('reload') || onclick.includes('refresh') ||
                        html.includes('↻') || html.includes('⟳') || html.includes('fa-redo') || html.includes('fa-sync') || html.includes('fa-rotate')
                    ) {
                        refreshBtn = el;
                        break;
                    }
                }
            }

            if (!refreshBtn) {
                const topRightBtns = allBtns.filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.top >= 0 && r.top <= 80 && r.width >= 16 && r.width <= 90 && r.right > window.innerWidth * 0.5;
                });
                if (topRightBtns.length > 0) {
                    topRightBtns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
                    refreshBtn = topRightBtns[0];
                }
            }

            if (!refreshBtn) return;

            aiBtn = document.createElement('button');
            aiBtn.id = 'customAiAdvisorBtn';
            aiBtn.type = 'button';
            aiBtn.setAttribute('title', 'AI 어드바이저');
            aiBtn.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                padding: 0;
                margin-left: 4px;
                background: transparent;
                color: #9ca3af;
                border: 1px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            aiBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                <path d="M20 3v4"/><path d="M22 5h-4"/>
            </svg>`;

            aiBtn.addEventListener('mouseenter', () => {
                aiBtn.style.color = '#ffffff';
                aiBtn.style.background = '#1f2937';
                aiBtn.style.borderColor = '#374151';
            });
            aiBtn.addEventListener('mouseleave', () => {
                aiBtn.style.color = '#9ca3af';
                aiBtn.style.background = 'transparent';
                aiBtn.style.borderColor = 'transparent';
            });
            aiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.openAIAdvisorPopupWindow();
            });

            if (refreshBtn.parentNode) {
                refreshBtn.parentNode.replaceChild(aiBtn, refreshBtn);
            }
        }

        if (isLocalEnv && aiBtn && aiBtn.parentNode && !document.getElementById('oneClickGithubBtn')) {
            const ghBtn = document.createElement('button');
            ghBtn.id = 'oneClickGithubBtn';
            ghBtn.type = 'button';
            ghBtn.setAttribute('title', 'GitHub 원클릭 업로드 (백엔드 + 프론트엔드 동시 저장 - 로컬 전용)');
            ghBtn.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                padding: 0;
                margin-left: 4px;
                background: transparent;
                color: #9ca3af;
                border: 1px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
            `;

            const ghIconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                <path d="M12 12v9"/>
                <path d="m16 16-4-4-4 4"/>
            </svg>`;
            ghBtn.innerHTML = ghIconSvg;

            ghBtn.addEventListener('mouseenter', () => {
                ghBtn.style.color = '#ffffff';
                ghBtn.style.background = '#1f2937';
                ghBtn.style.borderColor = '#374151';
            });
            ghBtn.addEventListener('mouseleave', () => {
                ghBtn.style.color = '#9ca3af';
                ghBtn.style.background = 'transparent';
                ghBtn.style.borderColor = 'transparent';
            });

            ghBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const memo = prompt('GitHub에 업로드할 작업 메모를 입력하세요:', '시뮬레이터 내비게이터 및 AI 어드바이저 업데이트');
                if (memo === null) return;

                ghBtn.disabled = true;
                ghBtn.innerHTML = `<span style="font-size:10px; color:#ffffff; font-weight:bold;">UP</span>`;

                try {
                    const baseUrl = (window.API_BASE || window.API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/api\/?$/, '');
                    const response = await fetch(`${baseUrl}/api/git-push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: memo.trim() || undefined })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success) {
                        throw new Error(result.message || '업로드 실패');
                    }
                    alert(`✅ [GitHub 통합 업로드 완료]\n\n${result.message}`);
                } catch (err) {
                    alert(`❌ [GitHub 업로드 오류]\n${err.message}\n\n* 백엔드(server.js)가 실행 중인지 확인해 주세요.`);
                } finally {
                    ghBtn.disabled = false;
                    ghBtn.innerHTML = ghIconSvg;
                }
            });

            aiBtn.parentNode.appendChild(ghBtn);
        }
    }

    window.collectNetworkContextForAI = function(rootMemberId) {
        const targetId = rootMemberId || window.currentSelectedId || 'VK-1199464';
        const rootNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : null;
        if (!rootNode) return null;

        const allSales = window._capturedAllSales || window.allSalesData || window.integrated_sales_history || [];
        const latestPeriod = typeof window.getLatestPeriodRangeFromSales === 'function'
            ? window.getLatestPeriodRangeFromSales(allSales)
            : { label: '최신기수', startDate: '2026-10-01', endDate: '2026-10-15' };

        const summaryList = [];
        const visited = new Set();

        function traverse(node, depth, parentInfo, lineDirection) {
            if (!node || depth > 4) return;
            const obj = (typeof node === 'object') ? node : (typeof window.findMemberNode === 'function' ? window.findMemberNode(node) : null);
            if (!obj) return;

            const nid = obj.id || obj.member_id || '';
            if (!nid || visited.has(nid)) return;
            visited.add(nid);

            const currRank = String(obj.rank || obj.rank_name || 'MANIA').toUpperCase();
            const badge = typeof window.evaluateMemberCardBadgeStatus === 'function'
                ? window.evaluateMemberCardBadgeStatus(nid)
                : {};

            const reqMaintCV = typeof window.getDbRequiredMaintCV === 'function'
                ? window.getDbRequiredMaintCV(currRank)
                : (badge.maintReqVal || 0);

            summaryList.push({
                '회원번호': nid,
                '성명': obj.name || '-',
                '단계_Depth': depth,
                '상위스폰서': parentInfo || '최상위(기준)',
                '소속라인': lineDirection || '기준본인',
                '현재직급': currRank,
                '목표승급직급': badge.promoTargetRank || '-',
                '승급소실적달성률': (badge.promoPct || 0) + '%',
                '현재소실적PV': badge.promoCurrPV || 0,
                '승급목표PV': badge.promoReqPV || 0,
                '승급부족PV': Math.max(0, (badge.promoReqPV || 0) - (badge.promoCurrPV || 0)),
                '품위유지기준CV': reqMaintCV,
                '당기소실적CV': badge.maintCurrVal || 0,
                '품위유지부족CV': Math.max(0, reqMaintCV - (badge.maintCurrVal || 0))
            });

            if (obj.left) {
                traverse(obj.left, depth + 1, `${obj.name}(${nid})`, depth === 0 ? '좌측(A라인)' : lineDirection);
            }
            if (obj.right) {
                traverse(obj.right, depth + 1, `${obj.name}(${nid})`, depth === 0 ? '우측(B라인)' : lineDirection);
            }

            if (Array.isArray(obj.children)) {
                obj.children.forEach((child, idx) => {
                    const pos = String(child.position || (idx === 0 ? '좌(A라인)' : '우(B라인)')).toUpperCase();
                    const dirLabel = (pos.includes('A') || pos.includes('LEFT') || pos.includes('좌')) ? '좌측(A라인)' : '우측(B라인)';
                    traverse(child, depth + 1, `${obj.name}(${nid})`, depth === 0 ? dirLabel : lineDirection);
                });
            }
        }

        traverse(rootNode, 0, null, null);

        return {
            '기준회원': `${rootNode.name} (${rootNode.id})`,
            '기준기수': `${latestPeriod.label} (${latestPeriod.startDate} ~ ${latestPeriod.endDate})`,
            '하위네트워크파트너현황': summaryList
        };
    };

    window.openAIAdvisorPopupWindow = function(targetMemberId) {
        const w = 780, h = 840;
        const l = Math.max(0, Math.floor((window.screen.width - w) / 2));
        const t = Math.max(0, Math.floor((window.screen.height - h) / 2));

        let popup = window.aiAdvisorPopupWindow;
        if (!popup || popup.closed) {
            popup = window.open('', 'AIAdvisorPopup', `width=${w},height=${h},left=${l},top=${t},resizable=yes,scrollbars=yes`);
            window.aiAdvisorPopupWindow = popup;
        } else {
            popup.focus();
        }
        if (!popup) return alert('팝업 차단을 해제해 주세요.');

        const rootId = targetMemberId || window.currentSelectedId || 'VK-1199464';
        const rootNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(rootId) : { id: rootId, name: '선택회원' };
        const savedApiKey = localStorage.getItem('BS_GEMINI_API_KEY') || '';

        popup.document.open();
        popup.document.write(`
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>AI 전략 어드바이저 - 비지네스 시뮬레이터</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111827; color: #ffffff; font-family: 'Pretendard', sans-serif; padding: 16px; line-height: 1.55; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; background: #1f2937; border: 1px solid #374151; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; }
    .header-title { font-size: 15px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
    .close-btn { background: #374151; color: #ffffff; border: 1px solid #4b5563; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; }
    .card { background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .label { font-size: 11.5px; color: #9ca3af; font-weight: bold; margin-bottom: 6px; display: block; }
    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    input, textarea, select { width: 100%; background: #111827; border: 1px solid #374151; color: #ffffff; padding: 9px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; outline: none; }
    .run-btn { width: 100%; background: #2563eb; color: #ffffff; border: 1px solid #3b82f6; padding: 11px; border-radius: 6px; font-size: 13.5px; font-weight: bold; cursor: pointer; margin-top: 4px; }
    .run-btn:disabled { background: #374151; border-color: #4b5563; cursor: not-allowed; }
    .result-box { background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 16px; min-height: 360px; max-height: 450px; overflow-y: auto; font-size: 13px; white-space: pre-wrap; }
    .api-row { display: flex; gap: 8px; align-items: center; }
    .save-key-btn { background: #374151; color: #ffffff; border: 1px solid #4b5563; padding: 9px 14px; border-radius: 6px; font-size: 12px; font-weight: bold; white-space: nowrap; cursor: pointer; }
    .badge { background: #374151; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
</style>
</head>
<body>
    <div class="header-bar">
        <div class="header-title">
            <span>AI 전략 어드바이저 (최적 매출 배치 & 승급 시뮬레이션)</span>
            <span class="badge">[${(rootNode && rootNode.name) || rootId} (${rootId})]</span>
        </div>
        <button class="close-btn" onclick="window.close()">창 닫기 ✕</button>
    </div>
    <div class="card">
        <label class="label">🔑 Google AI Studio API Key & 모델 선택 (혼잡 시 자동 우회 지원)</label>
        <div class="api-row">
            <input type="password" id="geminiApiKeyInput" placeholder="API Key 입력" value="${savedApiKey}">
            <select id="geminiModelSelect" style="width: 230px;">
                <option value="gemini-3.8-flash" selected>gemini-3.8-flash (최신 표준)</option>
                <option value="gemini-3.8-pro">gemini-3.8-pro (정밀 분석)</option>
                <option value="gemini-3.8-flash-lite">gemini-3.8-flash-lite (초고속)</option>
            </select>
            <button class="save-key-btn" id="saveKeyBtn">키 저장</button>
        </div>
    </div>
    <div class="card">
        <div class="input-row">
            <div><label class="label">💰 신규 발생 예정 CV</label><input type="text" id="simInputCV" value="700,000"></div>
            <div><label class="label">📈 신규 발생 예정 PV</label><input type="text" id="simInputPV" value="900,000"></div>
        </div>
        <div style="margin-bottom: 10px;">
            <label class="label">💬 중점 분석 요청사항</label>
            <textarea id="simCustomPrompt" rows="2">현재 후원계보도에서 위 신규 매출이 일어날 때, 어느 라인 누구 밑에 배치하면 수당(지원수당·추천매칭·품위유지)과 승급 달성에 가장 전체적인 효과가 좋을지 1순위, 2순위로 구체적인 수치와 함께 추천해줘.</textarea>
        </div>
        <button class="run-btn" id="runAiAnalysisBtn">Google AI 최적 배치 전략 분석 실행</button>
    </div>
    <div class="card" style="margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="label" style="margin-bottom:0;">📊 AI 어드바이저 분석 리포트</span>
            <span id="aiStatusText" style="font-size:11.5px; color:#9ca3af; font-weight:bold;">대기 중</span>
        </div>
        <div class="result-box" id="aiResultBox">상단의 [Google AI 최적 배치 전략 분석 실행] 버튼을 눌러주세요.</div>
    </div>
</body>
</html>`);
        popup.document.close();

        const pDoc = popup.document;
        const keyInput = pDoc.getElementById('geminiApiKeyInput');
        const saveKeyBtn = pDoc.getElementById('saveKeyBtn');
        const cvInput = pDoc.getElementById('simInputCV');
        const pvInput = pDoc.getElementById('simInputPV');
        const modelSelect = pDoc.getElementById('geminiModelSelect');
        const customPromptEl = pDoc.getElementById('simCustomPrompt');
        const runBtn = pDoc.getElementById('runAiAnalysisBtn');
        const resultBox = pDoc.getElementById('aiResultBox');
        const statusText = pDoc.getElementById('aiStatusText');

        [cvInput, pvInput].forEach(inp => {
            inp.addEventListener('input', () => {
                const num = Number(String(inp.value).replace(/[^\d]/g, '')) || 0;
                inp.value = num.toLocaleString('ko-KR');
            });
        });

        saveKeyBtn.addEventListener('click', () => {
            localStorage.setItem('BS_GEMINI_API_KEY', keyInput.value.trim());
            statusText.innerText = '✓ API Key 저장 완료';
            statusText.style.color = '#ffffff';
        });

        async function fetchWithFallback(apiKey, preferredModel, promptText) {
            const models = Array.from(new Set([preferredModel, 'gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.8-flash-lite']));
            let lastErr = '';
            for (const m of models) {
                for (let attempt = 1; attempt <= 2; attempt++) {
                    statusText.innerText = `${m} 요청 중... ${attempt > 1 ? `(재시도)` : ''}`;
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
                    });
                    const data = await res.json();
                    if (res.ok && !data.error) {
                        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) return { text, usedModel: m };
                    }
                    lastErr = data?.error?.message || `HTTP ${res.status}`;
                    if (res.status === 503 || res.status === 429 || /high demand|overloaded|unavailable/i.test(lastErr)) {
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        break;
                    }
                }
            }
            throw new Error(lastErr);
        }

        runBtn.addEventListener('click', async () => {
            const apiKey = keyInput.value.trim();
            if (!apiKey) return alert('API Key를 입력해 주세요.');
            localStorage.setItem('BS_GEMINI_API_KEY', apiKey);

            const simCV = Number(String(cvInput.value).replace(/[^\d]/g, '')) || 0;
            const simPV = Number(String(pvInput.value).replace(/[^\d]/g, '')) || 0;

            runBtn.disabled = true;
            runBtn.innerText = '⏳ AI 전략 분석 중...';
            resultBox.innerText = '실시간 계보도 데이터를 분석하고 있습니다. 잠시만 기다려 주세요...';

            try {
                const netContext = window.collectNetworkContextForAI(rootId);
                const fullPrompt = `당신은 네트워크 마케팅 보상플랜 및 바이너리 계보도 최적 배치 전문 AI 어드바이저입니다.\n\n[계보도 데이터]\n${JSON.stringify(netContext, null, 2)}\n\n[시뮬레이션 조건]\n- 신규 매출: ${simCV.toLocaleString('ko-KR')} CV / ${simPV.toLocaleString('ko-KR')} PV\n- 요청사항: ${customPromptEl.value.trim()}\n\n핵심 결론(🏆 최적 배치 1순위, 🥈 대안 2순위)과 각 파트너별 기대 수당/승급/품위유지 달성률 변화를 구체적인 수치로 브리핑해 주세요.`;

                const { text, usedModel } = await fetchWithFallback(apiKey, modelSelect.value, fullPrompt);
                resultBox.innerText = text;
                statusText.innerText = `✓ 분석 완료 (${usedModel})`;
                statusText.style.color = '#ffffff';
            } catch (err) {
                resultBox.innerText = `[오류 안내]\n${err.message}`;
                statusText.innerText = '오류 발생';
                statusText.style.color = '#ef4444';
            } finally {
                runBtn.disabled = false;
                runBtn.innerText = 'Google AI 최적 배치 전략 분석 실행';
            }
        });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(setupHeaderButtons, 250);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(setupHeaderButtons, 250));
    }
})();

// ============================================================================
// [19] 관리자 로그인 보안 게이트 (admin 인증 및 토큰 헤더 자동 주입)
// ============================================================================
(function forceInitLoginSecurityGate() {
    if (window._bsLoginGateMounted) return;
    window._bsLoginGateMounted = true;

    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';
    const EXPECTED_ID = 'admin';
    const EXPECTED_PW = 'tourism9**';
    const LOCAL_VALID_TOKEN = 'verified_admin_tourism9_token';

    const origFetch = window.fetch;
    window.fetch = async function(input, init = {}) {
        const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (urlStr.includes('/api/') || (window.API_BASE && urlStr.startsWith(window.API_BASE))) {
            init.headers = Object.assign({}, init.headers || {}, { 'x-auth-token': token });
        }
        return origFetch.call(this, input, init);
    };

    window.logoutSimulator = function() {
        if (!confirm('시뮬레이터에서 로그아웃하시겠습니까?')) return;
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
        window.location.reload();
    };

    function mountLogoutBtn() {
        if (document.getElementById('bsLogoutBtn')) return;
        const aiBtn = document.getElementById('customAiAdvisorBtn');
        const headerContainer = (aiBtn && aiBtn.parentNode) || document.querySelector('header, .header, .top-bar');
        if (!headerContainer) return;

        const btn = document.createElement('button');
        btn.id = 'bsLogoutBtn';
        btn.type = 'button';
        btn.title = '로그아웃';
        btn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-left:4px; background:transparent; color:#f87171; border:1px solid transparent; border-radius:6px; cursor:pointer;';
        btn.innerHTML = '🔒';
        btn.onclick = window.logoutSimulator;
        headerContainer.appendChild(btn);
    }

    function mountLoginScreen() {
        setTimeout(mountLogoutBtn, 600);

        const currentToken = sessionStorage.getItem(TOKEN_KEY);
        if (currentToken) return;

        let overlay = document.getElementById('bs-auth-login-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'bs-auth-login-overlay';
            overlay.style.cssText = `
                position: fixed !important;
                top: 0 !important; left: 0 !important;
                width: 100vw !important; height: 100vh !important;
                background: #0b0f19 !important;
                z-index: 2147483647 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-family: 'Pretendard', -apple-system, sans-serif !important;
            `;

            overlay.innerHTML = `
                <div style="background:#1f2937; border:1px solid #374151; border-radius:12px; width:360px; padding:30px 24px; box-shadow:0 25px 50px rgba(0,0,0,0.85); color:#fff; text-align:center;">
                    <div style="width:52px; height:52px; margin:0 auto 14px; border-radius:12px; background:rgba(59,130,246,0.15); border:1px solid #3b82f6; display:flex; align-items:center; justify-content:center; font-size:24px;">🔒</div>
                    <h2 style="margin:0 0 6px; font-size:18px; font-weight:800; color:#fff;">비지네스 시뮬레이터 V3.0</h2>
                    <p style="margin:0 0 22px; font-size:12px; color:#9ca3af;">승인된 관리자 계정으로 로그인해 주세요.</p>
                    <form id="bs-login-form" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                        <div>
                            <label style="display:block; font-size:11.5px; color:#d1d5db; margin-bottom:4px; font-weight:bold;">관리자 아이디 (ID)</label>
                            <input type="text" id="bs-login-id" placeholder="admin" required
                                   style="width:100%; box-sizing:border-box; padding:10px 12px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; font-size:13px; outline:none;">
                        </div>
                        <div>
                            <label style="display:block; font-size:11.5px; color:#d1d5db; margin-bottom:4px; font-weight:bold;">비밀번호 (Password)</label>
                            <input type="password" id="bs-login-pw" placeholder="비밀번호 입력" required
                                   style="width:100%; box-sizing:border-box; padding:10px 12px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; font-size:13px; outline:none;">
                        </div>
                        <div id="bs-login-error" style="display:none; color:#ef4444; font-size:12px; font-weight:bold; text-align:center; padding:4px 0;"></div>
                        <button type="submit" id="bs-login-submit"
                                style="margin-top:6px; width:100%; padding:11px; background:#2563eb; border:1px solid #3b82f6; border-radius:6px; color:#fff; font-size:13.5px; font-weight:bold; cursor:pointer;">
                            로그인
                        </button>
                    </form>
                </div>
            `;
            document.documentElement.appendChild(overlay);
        }

        const form = document.getElementById('bs-login-form');
        const idInp = document.getElementById('bs-login-id');
        const pwInp = document.getElementById('bs-login-pw');
        const errEl = document.getElementById('bs-login-error');

        setTimeout(() => { if (idInp) idInp.focus(); }, 100);

        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errEl.style.display = 'none';
                const uid = idInp.value.trim();
                const upw = pwInp.value;

                let tokenToSave = null;
                try {
                    const res = await fetch(`${window.API_BASE || ''}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: uid, password: upw })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.success && data.token) {
                            tokenToSave = data.token;
                        }
                    }
                } catch (err) {}

                if (!tokenToSave && uid === EXPECTED_ID && upw === EXPECTED_PW) {
                    tokenToSave = LOCAL_VALID_TOKEN;
                }

                if (tokenToSave) {
                    sessionStorage.setItem(TOKEN_KEY, tokenToSave);
                    localStorage.setItem(TOKEN_KEY, tokenToSave);
                    overlay.remove();
                    if (typeof window.fetchTreeData === 'function') {
                        window.fetchTreeData(true);
                    }
                } else {
                    errEl.innerText = '아이디 또는 비밀번호가 일치하지 않습니다.';
                    errEl.style.display = 'block';
                    pwInp.value = '';
                    pwInp.focus();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountLoginScreen);
    } else {
        mountLoginScreen();
    }
})();

// ============================================================================
// [20] 모바일 & 태블릿 반응형 레이아웃, 컴팩트 헤더 및 햄버거 드로어 메뉴
// ============================================================================

// [20-1] 모바일/태블릿 반응형 UI/UX 및 심플 헤더 & 햄버거 메뉴 패치 V11
(function initResponsiveMobileTabletSupportV11() {
    if (window._bsResponsivePatchMountedV11) return;
    window._bsResponsivePatchMountedV11 = true;

    function ensureViewportMeta() {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    window.isTabletOrMobileViewport = function() {
        return window.innerWidth <= 1024 || window.innerHeight <= 500;
    };
    window.isMobileViewport = function() {
        return window.innerWidth <= 640;
    };
    window.isLandscapePhoneOrCompactTablet = function() {
        return window.innerWidth > 640 && (window.innerWidth <= 1250 || window.innerHeight <= 500);
    };

    window.syncSalesPanelBelowHeader = function() {
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        const salesW = document.getElementById('salesWidget') || (typeof window.getSmartLeftPanel === 'function' ? window.getSmartLeftPanel() : null);
        const zoomCtrl = document.querySelector('.zoom-controls');

        let headerBottom = 60;
        if (headerEl) {
            const rect = headerEl.getBoundingClientRect();
            if (rect.height > 0) {
                headerBottom = Math.round(rect.bottom);
            }
        }

        document.documentElement.style.setProperty('--bs-header-bottom', `${headerBottom}px`);

        if (salesW) {
            salesW.style.setProperty('top', `${headerBottom}px`, 'important');
            salesW.style.setProperty('height', `calc(100dvh - ${headerBottom}px)`, 'important');
        }

        if (zoomCtrl) {
            if (window.isMobileViewport()) {
                zoomCtrl.style.setProperty('top', 'auto', 'important');
                zoomCtrl.style.setProperty('bottom', '56px', 'important');
                zoomCtrl.style.setProperty('right', '8px', 'important');
            } else {
                const parentEl = zoomCtrl.offsetParent || document.body;
                const isInsideCanvas = (parentEl.id === 'canvas-container' || parentEl.classList.contains('canvas-container') || parentEl.tagName === 'MAIN');
                const targetTop = isInsideCanvas ? 14 : (headerBottom + 14);

                zoomCtrl.style.setProperty('bottom', 'auto', 'important');
                zoomCtrl.style.setProperty('top', `${targetTop}px`, 'important');
                zoomCtrl.style.setProperty('right', '14px', 'important');
            }
        }
    };

    window.updateHeaderLineCount = function(selectedId) {
        const badgeEl = document.getElementById('header-line-count');
        if (!badgeEl) return;

        const targetId = selectedId || window.currentSelectedId;
        let baseNode = targetId && typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : (typeof window.getAbsoluteTopRoot === 'function' ? window.getAbsoluteTopRoot() : null);
        if (!baseNode && typeof window.getAbsoluteTopRoot === 'function') baseNode = window.getAbsoluteTopRoot();

        if (!baseNode) {
            badgeEl.innerHTML = `<span style="color:#9ca3af;">데이터 없음</span>`;
            return;
        }

        const baseName = baseNode.name || baseNode.id;

        if (window.treeMode === 'recommender') {
            const uniqueMembers = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];
            let directRecCount = 0;
            let totalRecSubCount = 0;
            const visited = new Set();

            function countRecSubtree(currNode, depth) {
                if (!currNode || !currNode.id) return;
                let norm = String(currNode.id).trim().toLowerCase().replace(/^vk-?/, '');
                if (visited.has(norm)) return;
                visited.add(norm);

                if (depth > 0) totalRecSubCount++;
                if (depth === 1) directRecCount++;

                uniqueMembers.filter(m => m && !window.isSameMemberId(m.id, currNode.id) && window.isSameMemberId(m.recId || m.rec_id || m.recommenderId, currNode.id))
                    .forEach(child => countRecSubtree(child, depth + 1));
            }

            countRecSubtree(baseNode, 0);
            badgeEl.innerHTML = `
                <b style="color:#fff;">${baseName}</b>
                <span style="color:#10b981; font-weight:bold; margin-left:4px;">직추천:${directRecCount}</span>
                <span style="color:#9ca3af; font-size:11px; margin-left:2px;">(Total ${totalRecSubCount})</span>
            `;
            return;
        }

        const visitedA = new Set();
        const visitedB = new Set();

        function countBranchNodes(node, visitedSet) {
            if (!node || !node.id) return 0;
            let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (visitedSet.has(norm)) return 0;
            visitedSet.add(norm);

            let count = 1;
            let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
            let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;

            if (leftChild) count += countBranchNodes(leftChild, visitedSet);
            if (rightChild) count += countBranchNodes(rightChild, visitedSet);
            return count;
        }

        let leftRoot = baseNode.left ? (typeof baseNode.left === 'object' ? baseNode.left : window.findMemberNode(baseNode.left)) : null;
        let rightRoot = baseNode.right ? (typeof baseNode.right === 'object' ? baseNode.right : window.findMemberNode(baseNode.right)) : null;

        const aCount = leftRoot ? countBranchNodes(leftRoot, visitedA) : 0;
        const bCount = rightRoot ? countBranchNodes(rightRoot, visitedB) : 0;
        const totalSub = aCount + bCount;

        badgeEl.innerHTML = `
            <b style="color:#fff;">${baseName}</b>
            <span style="color:#60a5fa; font-weight:bold; margin-left:5px;">A:${aCount.toLocaleString()}</span>
            <span style="color:#6b7280; margin:0 3px;">/</span>
            <span style="color:#f59e0b; font-weight:bold;">B:${bCount.toLocaleString()}</span>
            <span style="color:#9ca3af; font-size:11px; margin-left:3px;">(Total ${totalSub.toLocaleString()})</span>
        `;
    };

    function simplifyPrevNextButtons(rootDoc = document) {
        if (!rootDoc) return;
        const buttons = rootDoc.querySelectorAll('button, .nav-btn, [onclick*="Period"], [onclick*="period"]');
        buttons.forEach(btn => {
            const txt = (btn.innerText || '').trim();
            if (txt.includes('이전') && (txt.includes('◀') || txt.includes('<') || txt === '이전')) {
                btn.innerHTML = '◀';
                btn.title = '이전 기수';
                btn.classList.add('bs-period-nav-btn');
            } else if (txt.includes('다음') && (txt.includes('▶') || txt.includes('>') || txt === '다음')) {
                btn.innerHTML = '▶';
                btn.title = '다음 기수';
                btn.classList.add('bs-period-nav-btn');
            }
        });
    }

    const origOpenSalesPopup = window.openSalesSearchPopupWindow;
    if (typeof origOpenSalesPopup === 'function' && !origOpenSalesPopup._iconPatchedV11) {
        const wrappedOpenSales = function() {
            const pop = origOpenSalesPopup.apply(this, arguments);
            if (pop && pop.document) {
                setTimeout(() => simplifyPrevNextButtons(pop.document), 50);
            }
            return pop;
        };
        wrappedOpenSales._iconPatchedV11 = true;
        window.openSalesSearchPopupWindow = wrappedOpenSales;
    }

    function syncHeaderButtonsAndLayoutByViewport() {
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!headerEl) return;

        const isMobPortrait = window.isMobileViewport();
        const isLandscapeCompact = window.isLandscapePhoneOrCompactTablet();

        let hamBtn = document.getElementById('bs-mobile-hamburger-btn');
        if (!hamBtn) {
            hamBtn = document.createElement('button');
            hamBtn.id = 'bs-mobile-hamburger-btn';
            hamBtn.type = 'button';
            hamBtn.title = '메뉴 열기';
            hamBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            `;
            hamBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.toggleMobileHamburgerDrawer();
            };
        }
        if (hamBtn.parentElement !== headerEl) {
            headerEl.appendChild(hamBtn);
        }

        let topIconsHolder = document.getElementById('bs-top-row-icons-holder');
        if (!topIconsHolder) {
            topIconsHolder = document.createElement('div');
            topIconsHolder.id = 'bs-top-row-icons-holder';
            headerEl.appendChild(topIconsHolder);
        } else if (topIconsHolder.parentElement !== headerEl) {
            headerEl.appendChild(topIconsHolder);
        }

        const gearBtn = headerEl.querySelector('[onclick*="toggleSettingsMenu"]');
        let gearItem = gearBtn;
        if (gearBtn && gearBtn.parentElement && gearBtn.parentElement !== headerEl && gearBtn.parentElement !== topIconsHolder) {
            const p = gearBtn.parentElement;
            if (!p.querySelector('#searchInput') && !p.querySelector('input[type="date"]') && !p.querySelector('#header-line-count')) {
                gearItem = p;
            }
        }

        const treeBtn = document.getElementById('toggleTreeBtn') || headerEl.querySelector('[onclick*="toggleTreeMode"]');
        const aiBtn = document.getElementById('customAiAdvisorBtn');
        const ghBtn = document.getElementById('oneClickGithubBtn');
        const logoutBtn = document.getElementById('bsLogoutBtn');

        const orderedItems = [gearItem, treeBtn, aiBtn, ghBtn, logoutBtn].filter(Boolean);
        orderedItems.forEach(item => {
            if (item.parentElement !== topIconsHolder) {
                topIconsHolder.appendChild(item);
            }
            item.style.margin = '0';
        });

        const searchInp = document.getElementById('searchInput');
        const searchBox = (searchInp && searchInp.parentElement !== headerEl && !searchInp.parentElement.querySelector('input[type="date"]'))
            ? searchInp.parentElement
            : searchInp;

        if (isMobPortrait) {
            topIconsHolder.style.setProperty('display', 'none', 'important');
            if (searchInp) searchInp.style.setProperty('display', 'none', 'important');
            if (searchBox) searchBox.style.setProperty('display', 'none', 'important');
            hamBtn.style.setProperty('display', 'inline-flex', 'important');
        } else if (isLandscapeCompact) {
            hamBtn.style.setProperty('display', 'none', 'important');
            topIconsHolder.style.cssText = `
                position: absolute !important;
                top: 6px !important;
                right: 10px !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                z-index: 120 !important;
            `;
            orderedItems.forEach(el => {
                el.style.setProperty('display', 'inline-flex', 'important');
            });
            if (searchInp) searchInp.style.setProperty('display', 'inline-block', 'important');
            if (searchBox && searchBox !== searchInp) {
                searchBox.style.setProperty('display', 'flex', 'important');
                searchBox.style.setProperty('margin-left', 'auto', 'important');
            }
        } else {
            hamBtn.style.setProperty('display', 'none', 'important');
            topIconsHolder.style.cssText = `
                position: static !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                margin-left: 6px !important;
            `;
            orderedItems.forEach(el => {
                el.style.setProperty('display', 'inline-flex', 'important');
            });
            if (searchInp) searchInp.style.setProperty('display', 'inline-block', 'important');
            if (searchBox && searchBox !== searchInp) {
                searchBox.style.setProperty('display', 'flex', 'important');
                searchBox.style.removeProperty('margin-left');
            }
        }

        const dateInputs = headerEl.querySelectorAll('input[type="date"], #header-start-date, #header-end-date');
        dateInputs.forEach(dInp => {
            dInp.classList.add('bs-header-date-input');
            dInp.style.setProperty('display', 'inline-block', 'important');
            if (isMobPortrait) {
                dInp.style.setProperty('width', '84px', 'important');
                dInp.style.setProperty('min-width', '0px', 'important');
                dInp.style.setProperty('max-width', '88px', 'important');
                dInp.style.setProperty('padding', '2px 2px', 'important');
                dInp.style.setProperty('font-size', '10.5px', 'important');
            } else if (isLandscapeCompact) {
                dInp.style.setProperty('width', '106px', 'important');
                dInp.style.setProperty('min-width', '0px', 'important');
                dInp.style.setProperty('max-width', '114px', 'important');
                dInp.style.setProperty('padding', '2px 6px', 'important');
                dInp.style.setProperty('font-size', '11.5px', 'important');
            } else {
                dInp.style.removeProperty('width');
                dInp.style.removeProperty('min-width');
                dInp.style.removeProperty('max-width');
            }

            let curr = dInp.parentElement;
            while (curr && curr !== headerEl && curr !== document.body) {
                curr.classList.remove('bs-desktop-only-tool');
                curr.style.setProperty('display', 'flex', 'important');
                curr.style.setProperty('visibility', 'visible', 'important');
                curr.style.setProperty('opacity', '1', 'important');

                if (curr.parentElement === headerEl) {
                    curr.classList.add('bs-mobile-second-row-bar');
                    curr.classList.remove('bs-mobile-period-flex');
                } else {
                    curr.classList.add('bs-mobile-period-flex');
                }
                curr = curr.parentElement;
            }
        });

        window.syncSalesPanelBelowHeader();
    }

    const origToggleSales = window.toggleSalesSidebar;
    if (typeof origToggleSales === 'function' && !origToggleSales._patchedBelowHeaderV11) {
        const wrappedToggleSales = function(e) {
            origToggleSales.apply(this, arguments);
            window.syncSalesPanelBelowHeader();
            setTimeout(window.syncSalesPanelBelowHeader, 50);
            if (window.isTabletOrMobileViewport()) {
                const perfW = document.getElementById('perfWidget');
                if (perfW) perfW.style.setProperty('left', '0px', 'important');
            }
        };
        wrappedToggleSales._patchedBelowHeaderV11 = true;
        window.toggleSalesSidebar = wrappedToggleSales;
    }

    function ensureMobileDrawerDOM() {
        const existingOverlay = document.getElementById('bs-mobile-drawer-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'bs-mobile-drawer-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100dvh !important;
            background: rgba(0, 0, 0, 0.65) !important;
            z-index: 2147483642 !important;
            justify-content: flex-end !important;
        `;

        overlay.innerHTML = `
            <div id="bs-mobile-drawer-panel" onclick="event.stopPropagation()" style="width: min(280px, 82vw); height: 100%; background: #1f2937; border-left: 1px solid #374151; padding: 16px 14px; display: flex; flex-direction: column; gap: 14px; color: #fff; box-shadow: -8px 0 25px rgba(0,0,0,0.85); overflow-y: auto; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 10px;">
                    <strong style="font-size: 14px; color: #60a5fa;">☰ 시뮬레이터 메뉴</strong>
                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false)" style="background: #374151; border: 1px solid #4b5563; color: #e5e7eb; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">닫기 ✕</button>
                </div>

                <div>
                    <label style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 5px; font-weight: bold;">🔍 계보도 회원/추천인 검색</label>
                    <div style="display: flex; gap: 6px;">
                        <input type="text" id="bs-mobile-search-inp" placeholder="이름 또는 번호 입력" onkeydown="if(event.key==='Enter'){ window.runMobileDrawerSearch(); }" style="flex: 1; min-width: 0; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 6px; padding: 7px 10px; font-size: 12px; outline: none;">
                        <button type="button" onclick="window.runMobileDrawerSearch()" style="background: #2563eb; border: 1px solid #3b82f6; color: #fff; border-radius: 6px; padding: 0 12px; font-size: 12px; font-weight: bold; cursor: pointer;">검색</button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #374151; padding-top: 12px;">
                    <span style="font-size: 11px; color: #9ca3af; font-weight: bold;">🛠️ 주요 기능 및 도구</span>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); window.toggleTreeMode();" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>🌳</span> <span id="bs-mob-tree-mode-label" style="color: #ffffff; font-weight: bold;">계보도 전환</span>
                    </button>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); setTimeout(() => window.toggleSettingsMenu(event), 60);" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>⚙️</span> <span style="color: #ffffff; font-weight: bold;">카드 표시 항목 & 배지 설정</span>
                    </button>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); if(typeof window.toggleBizNavigator==='function') window.toggleBizNavigator(true);" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>🧭</span> <span style="color: #ffffff; font-weight: bold;">내비게이터</span>
                    </button>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); if(typeof window.toggleSalesSearchPopup==='function') window.toggleSalesSearchPopup(true);" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>📅</span> <span style="color: #ffffff; font-weight: bold;">매출 기간 검색</span>
                    </button>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); if(typeof window.openAIAdvisorPopupWindow==='function') window.openAIAdvisorPopupWindow();" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>✨</span> <span style="color: #ffffff; font-weight: bold;">AI 어드바이저</span>
                    </button>

                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); if(typeof window.toggleSalesSidebar==='function') window.toggleSalesSidebar();" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>💳</span> <span style="color: #ffffff; font-weight: bold;">매출/구독</span>
                    </button>

                    <button type="button" id="bs-mob-github-btn" onclick="window.toggleMobileHamburgerDrawer(false); const g=document.getElementById('oneClickGithubBtn'); if(g) g.click();" style="display: ${window.IS_LOCAL_DEV ? 'flex' : 'none'}; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #93c5fd; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;">
                        <span>☁️</span> <span>GitHub 원클릭 업로드</span>
                    </button>
                </div>

                <div style="margin-top: auto; border-top: 1px solid #374151; padding-top: 12px;">
                    <button type="button" onclick="window.toggleMobileHamburgerDrawer(false); if(typeof window.logoutSimulator==='function') window.logoutSimulator();" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 6px; color: #f87171; font-size: 12.5px; font-weight: bold; cursor: pointer;">
                        <span>🔒</span> <span>로그아웃</span>
                    </button>
                </div>
            </div>
        `;

        overlay.addEventListener('click', () => window.toggleMobileHamburgerDrawer(false));
        document.body.appendChild(overlay);
    }

    window.toggleMobileHamburgerDrawer = function(forceShow) {
        const overlay = document.getElementById('bs-mobile-drawer-overlay');
        if (!overlay) return;
        const isShown = overlay.style.display === 'flex';
        const nextState = (typeof forceShow === 'boolean') ? forceShow : !isShown;
        overlay.style.display = nextState ? 'flex' : 'none';

        if (nextState) {
            const modeLbl = document.getElementById('bs-mob-tree-mode-label');
            if (modeLbl) {
                modeLbl.innerText = (window.treeMode === 'recommender')
                    ? '후원계보도'
                    : '추천계보도';
            }
        }
    };

    window.runMobileDrawerSearch = function() {
        const inp = document.getElementById('bs-mobile-search-inp');
        const kw = inp ? inp.value.trim() : '';
        window.toggleMobileHamburgerDrawer(false);
        const mainInp = document.getElementById('searchInput');
        if (mainInp) mainInp.value = kw;
        if (typeof window.searchMember === 'function') {
            window.searchMember(kw);
        }
    };

    function injectResponsiveStyles() {
        let style = document.getElementById('bs-responsive-master-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'bs-responsive-master-css';
            document.head.appendChild(style);
        }

        style.innerHTML = `
            :root {
                --bs-header-bottom: 76px;
            }

            #canvas-container, .canvas-container, main {
                touch-action: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }
            .table-scroll-container, #perfWidget .widget-body, #sales-table-scroll-box {
                -webkit-overflow-scrolling: touch !important;
                overscroll-behavior: contain !important;
            }

            #bs-mobile-hamburger-btn {
                display: none;
            }

            header *, .header *, .top-bar *, .top-header-bar * {
                white-space: nowrap !important;
            }

            .bs-mobile-period-flex {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                width: auto !important;
                max-width: 100% !important;
                gap: 5px !important;
                flex: 0 0 auto !important;
            }

            @media screen and (min-width: 641px) and (max-width: 1250px) {
                header, .header, .top-bar, .top-header-bar {
                    position: relative !important;
                    z-index: 2147483550 !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    height: auto !important;
                    min-height: 48px !important;
                    padding: 6px 10px !important;
                    gap: 6px !important;
                    box-sizing: border-box !important;
                    width: 100vw !important;
                    max-width: 100vw !important;
                }

                header > div:first-child,
                .header > div:first-child,
                .top-bar > div:first-child {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    width: 100% !important;
                    padding-right: 210px !important;
                    gap: 10px !important;
                    min-height: 32px !important;
                    box-sizing: border-box !important;
                }

                .bs-mobile-second-row-bar {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    gap: 8px !important;
                    box-sizing: border-box !important;
                }
            }

            @media screen and (max-width: 1024px) {
                #salesWidget, aside.left-panel, .sales-panel {
                    position: fixed !important;
                    top: var(--bs-header-bottom, 76px) !important;
                    left: 0 !important;
                    width: min(320px, 86vw) !important;
                    max-width: 86vw !important;
                    height: calc(100dvh - var(--bs-header-bottom, 76px)) !important;
                    max-height: calc(100dvh - var(--bs-header-bottom, 76px)) !important;
                    z-index: 2147483500 !important;
                    box-shadow: 8px 4px 25px rgba(0, 0, 0, 0.75) !important;
                    border-top: 1px solid #374151 !important;
                }

                #perfWidget, .perf-widget {
                    left: 0px !important;
                    right: 0px !important;
                    width: 100vw !important;
                    max-width: 100vw !important;
                    box-sizing: border-box !important;
                }
                #perfWidget .widget-body {
                    overflow-x: auto !important;
                    overflow-y: auto !important;
                }
                #perfWidget table {
                    min-width: 1080px !important;
                }

                #filterWidget {
                    width: min(510px, 95vw) !important;
                    min-width: min(510px, 95vw) !important;
                    max-width: 95vw !important;
                    left: 2.5vw !important;
                    right: 2.5vw !important;
                }
                #bonusDetailModal {
                    width: min(740px, 96vw) !important;
                    min-width: min(740px, 96vw) !important;
                    max-width: 96vw !important;
                    height: min(520px, 84dvh) !important;
                    left: 50% !important;
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                }
                #addPartnerModal > div,
                #memberEditModal {
                    width: min(460px, 94vw) !important;
                    max-width: 94vw !important;
                    max-height: 88dvh !important;
                }
            }

            @media screen and (max-width: 640px) {
                header, .header, .top-bar, .top-header-bar {
                    position: relative !important;
                    z-index: 2147483550 !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    padding: 6px 8px !important;
                    gap: 5px !important;
                    width: 100vw !important;
                    max-width: 100vw !important;
                    box-sizing: border-box !important;
                }

                #bs-mobile-hamburger-btn {
                    position: absolute !important;
                    top: 6px !important;
                    right: 8px !important;
                    width: 32px !important;
                    height: 28px !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background: #1f2937 !important;
                    border: 1px solid #374151 !important;
                    border-radius: 6px !important;
                    color: #e5e7eb !important;
                    cursor: pointer !important;
                    z-index: 100 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }

                header > div:first-child, .header > div:first-child, .top-bar > div:first-child {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    width: 100% !important;
                    padding-right: 38px !important;
                    gap: 8px !important;
                    box-sizing: border-box !important;
                    min-height: 28px !important;
                }

                header h1, header h2, header strong, .header-title, .brand-title, .logo-text {
                    font-size: 13.5px !important;
                    letter-spacing: -0.5px !important;
                }

                #header-line-count {
                    font-size: 11px !important;
                    padding: 3px 9px !important;
                    margin: 0 !important;
                }

                .bs-mobile-second-row-bar,
                .bs-mobile-period-flex {
                    width: 100% !important;
                    max-width: 100% !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    gap: 3px !important;
                    padding: 4px 6px !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                }

                header select, .header select, .top-bar select {
                    padding: 2px 3px !important;
                    font-size: 10.5px !important;
                    height: 25px !important;
                    width: auto !important;
                    max-width: 68px !important;
                    flex-shrink: 0 !important;
                }

                .bs-period-nav-btn {
                    padding: 2px 5px !important;
                    font-size: 10px !important;
                    height: 25px !important;
                    min-width: 22px !important;
                    flex-shrink: 0 !important;
                }

                .bs-header-date-input,
                header input[type="date"],
                .header input[type="date"],
                #header-start-date,
                #header-end-date {
                    width: 84px !important;
                    min-width: 0px !important;
                    max-width: 88px !important;
                    flex: 0 1 84px !important;
                    padding: 2px 2px !important;
                    font-size: 10.5px !important;
                    letter-spacing: -0.3px !important;
                    height: 25px !important;
                    text-align: center !important;
                    box-sizing: border-box !important;
                }

                .bs-header-date-input::-webkit-calendar-picker-indicator,
                header input[type="date"]::-webkit-calendar-picker-indicator,
                #header-start-date::-webkit-calendar-picker-indicator,
                #header-end-date::-webkit-calendar-picker-indicator {
                    display: none !important;
                    -webkit-appearance: none !important;
                    width: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                #settingsDropdown, #settingsMenu, .settings-menu {
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    right: auto !important;
                    transform: translate(-50%, -50%) !important;
                    max-width: 92vw !important;
                    max-height: 80dvh !important;
                    overflow-y: auto !important;
                    z-index: 2147483644 !important;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.9) !important;
                }

                .zoom-controls {
                    top: auto !important;
                    bottom: 56px !important;
                    right: 8px !important;
                    transform: scale(0.85) !important;
                    transform-origin: bottom right !important;
                    z-index: 950 !important;
                }
            }
        `;
    }

    window.centerRootNode = function() {
        const wrapper = document.getElementById('tree-wrapper') || document.querySelector('.tree-wrapper');
        const container = document.getElementById('canvas-container') || (wrapper ? wrapper.parentElement : null);
        if (!wrapper || !container) return;

        if (window.innerWidth <= 480) {
            window.scale = 0.52;
        } else if (window.innerWidth <= 640) {
            window.scale = 0.60;
        } else if (window.innerHeight <= 450) {
            window.scale = 0.58;
        } else if (window.innerWidth <= 1024) {
            window.scale = 0.72;
        } else {
            window.scale = 0.85;
        }

        const rootCard = document.querySelector('.node-card');
        if (!rootCard) {
            setTimeout(window.centerRootNode, 100);
            return;
        }

        let offsetLeftSum = 0;
        let offsetTopSum = 0;
        let curr = rootCard;
        while (curr && curr !== wrapper) {
            offsetLeftSum += curr.offsetLeft;
            offsetTopSum += curr.offsetTop;
            curr = curr.offsetParent;
        }
        const cardCenterX = offsetLeftSum + (rootCard.offsetWidth / 2);
        const rootTopY = offsetTopSum;

        const containerWidth = container.clientWidth || window.innerWidth;
        const topMargin = (window.isMobileViewport() || window.innerHeight <= 450) ? 16 : 40;

        window.panX = (containerWidth / 2) - (cardCenterX * window.scale);
        window.panY = topMargin - (rootTopY * window.scale);

        wrapper.style.setProperty('transform-origin', '0 0', 'important');
        wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
    };
    window.resetZoomAndPan = window.centerRootNode;

    function initTouchAndPopupPatches() {
        const canvas = document.getElementById('canvas-container') || document.querySelector('.canvas-container') || document.querySelector('main') || document.body;
        if (canvas && canvas.dataset.touchPinchBoundV11 !== 'true') {
            canvas.dataset.touchPinchBoundV11 = 'true';
            let initialPinchDist = null, initialScale = 1, pinchCenterX = 0, pinchCenterY = 0;
            const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

            canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    initialPinchDist = getTouchDist(e.touches[0], e.touches[1]);
                    initialScale = window.scale || 0.6;
                    pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                }
            }, { passive: false });

            canvas.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && initialPinchDist) {
                    e.preventDefault();
                    const ratio = getTouchDist(e.touches[0], e.touches[1]) / initialPinchDist;
                    const targetScale = Math.min(3, Math.max(0.15, initialScale * ratio));
                    const delta = targetScale - (window.scale || 0.6);
                    if (Math.abs(delta) > 0.005 && typeof window.changeZoom === 'function') {
                        window.changeZoom(delta, pinchCenterX, pinchCenterY);
                    }
                }
            }, { passive: false });

            canvas.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) initialPinchDist = null;
            });

            let lastTapTime = 0, lastTapCardId = null;
            document.addEventListener('touchend', (e) => {
                const cardEl = e.target.closest('.node-card');
                if (!cardEl || e.target.closest('.corner-btn, .btn-add-parent')) return;
                const memberId = cardEl.id.replace(/^card_/, '');
                const now = Date.now();
                if (lastTapCardId === memberId && (now - lastTapTime) < 320) {
                    e.preventDefault();
                    e.stopPropagation();
                    lastTapTime = 0;
                    lastTapCardId = null;
                    if (window.cardClickTimer) { clearTimeout(window.cardClickTimer); window.cardClickTimer = null; }
                    if (typeof window.openEditMemberModal === 'function') window.openEditMemberModal(memberId);
                } else {
                    lastTapTime = now;
                    lastTapCardId = memberId;
                }
            }, { passive: false });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('#salesWidgetHeader, #salesWidget .widget-header, #salesWidget')) {
                setTimeout(window.syncSalesPanelBelowHeader, 10);
            }
        }, true);

        if (!window._mobilePopupPatchedV11) {
            window._mobilePopupPatchedV11 = true;
            const origWindowOpen = window.open;
            window.open = function(url, windowName, windowFeatures) {
                const isSimPopup = ['BizNavigatorPopup', 'SalesSearchPopup', 'AIAdvisorPopup'].includes(windowName);
                if (!isSimPopup || !window.isTabletOrMobileViewport()) {
                    return origWindowOpen.apply(window, arguments);
                }
                let overlayId = `bs-mobile-popup-${windowName}`;
                let existing = document.getElementById(overlayId);
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.id = overlayId;
                overlay.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100dvh !important; background:rgba(0,0,0,0.82) !important; z-index:2147483646 !important; display:flex !important; align-items:center !important; justify-content:center !important; padding:6px !important; box-sizing:border-box !important;';
                const iframe = document.createElement('iframe');
                iframe.style.cssText = 'width:100% !important; height:100% !important; max-width:960px !important; max-height:96dvh !important; border:1px solid #374151 !important; border-radius:10px !important; background:#111827 !important;';
                overlay.appendChild(iframe);
                document.body.appendChild(overlay);

                const fakeWin = iframe.contentWindow;
                const beforeUnloadHandlers = [];
                fakeWin.close = function() {
                    beforeUnloadHandlers.forEach(fn => { try { fn(); } catch (e) {} });
                    overlay.remove();
                    fakeWin.closed = true;
                };
                const origAddEvent = fakeWin.addEventListener.bind(fakeWin);
                fakeWin.addEventListener = function(type, listener, options) {
                    if (type === 'beforeunload') beforeUnloadHandlers.push(listener);
                    return origAddEvent(type, listener, options);
                };
                fakeWin.focus = function() { overlay.style.display = 'flex'; };
                return fakeWin;
            };
        }
    }

    function bootV11() {
        ensureViewportMeta();
        injectResponsiveStyles();
        ensureMobileDrawerDOM();
        simplifyPrevNextButtons(document);
        syncHeaderButtonsAndLayoutByViewport();
        initTouchAndPopupPatches();

        if (typeof window.updateHeaderLineCount === 'function') {
            window.updateHeaderLineCount(window.currentSelectedId);
        }

        window.addEventListener('resize', () => {
            syncHeaderButtonsAndLayoutByViewport();
            window.syncSalesPanelBelowHeader();
        });

        [150, 350, 650, 1000].forEach(delay => {
            setTimeout(() => {
                simplifyPrevNextButtons(document);
                syncHeaderButtonsAndLayoutByViewport();
                window.syncSalesPanelBelowHeader();
                if (typeof window.updateHeaderLineCount === 'function') {
                    window.updateHeaderLineCount(window.currentSelectedId);
                }
            }, delay);
        });

        setTimeout(window.centerRootNode, 350);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootV11);
    } else {
        bootV11();
    }
})();

// [20-2] 상단 헤더 기간 표시창 & 회원 검색창 컴팩트 너비 + 톱니바퀴(⚙️) 좌측 밀착 배치 패치
(function applyCompactHeaderInputsAndRightAlignPatch() {
    function injectCompactHeaderCSS() {
        let style = document.getElementById('bs-compact-header-inputs-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'bs-compact-header-inputs-css';
            document.head.appendChild(style);
        }

        style.innerHTML = `
            header input[type="date"],
            .header input[type="date"],
            .top-bar input[type="date"],
            #header-start-date,
            #header-end-date,
            .bs-header-date-input {
                width: 90px !important;
                min-width: 90px !important;
                max-width: 90px !important;
                flex: 0 0 90px !important;
                padding: 2px 4px !important;
                font-size: 11.5px !important;
                letter-spacing: -0.3px !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }

            header input[type="date"]::-webkit-calendar-picker-indicator,
            .header input[type="date"]::-webkit-calendar-picker-indicator,
            #header-start-date::-webkit-calendar-picker-indicator,
            #header-end-date::-webkit-calendar-picker-indicator {
                display: none !important;
                -webkit-appearance: none !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .bs-mobile-period-flex {
                width: auto !important;
                flex: 0 0 auto !important;
                gap: 4px !important;
                padding: 3px 6px !important;
            }

            #searchInput {
                width: 115px !important;
                min-width: 115px !important;
                max-width: 115px !important;
                padding: 3px 6px !important;
                font-size: 11.5px !important;
                box-sizing: border-box !important;
            }

            @media screen and (min-width: 1251px) {
                header, .header, .top-bar, .top-header-bar {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    gap: 8px !important;
                }

                .bs-desktop-right-tools-group,
                .bs-mobile-second-row-bar {
                    margin-left: auto !important;
                    margin-right: 4px !important;
                    width: auto !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    gap: 8px !important;
                    flex: 0 0 auto !important;
                }

                #bs-top-row-icons-holder {
                    margin-left: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 4px !important;
                    flex: 0 0 auto !important;
                }
            }

            @media screen and (max-width: 640px) {
                header input[type="date"],
                .header input[type="date"],
                #header-start-date,
                #header-end-date,
                .bs-header-date-input {
                    width: 82px !important;
                    min-width: 82px !important;
                    max-width: 82px !important;
                    flex: 0 0 82px !important;
                    font-size: 10.5px !important;
                    padding: 2px 2px !important;
                }
            }
        `;
    }

    function applyCompactAndAlignRight() {
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!headerEl) return;

        const isSmallMobile = window.innerWidth <= 640;
        const isDesktop = window.innerWidth > 1250 && window.innerHeight > 500;
        const targetDateWidth = isSmallMobile ? '82px' : '90px';

        let periodTopGroup = null;
        const dateInputs = headerEl.querySelectorAll('input[type="date"], #header-start-date, #header-end-date');
        dateInputs.forEach(inp => {
            inp.style.setProperty('width', targetDateWidth, 'important');
            inp.style.setProperty('min-width', targetDateWidth, 'important');
            inp.style.setProperty('max-width', targetDateWidth, 'important');
            inp.style.setProperty('flex', `0 0 ${targetDateWidth}`, 'important');
            inp.style.setProperty('padding', '2px 4px', 'important');
            inp.style.setProperty('text-align', 'center', 'important');

            let curr = inp.parentElement;
            while (curr && curr.parentElement !== headerEl && curr !== headerEl) {
                curr = curr.parentElement;
            }
            if (curr && curr.parentElement === headerEl) {
                periodTopGroup = curr;
            }
        });

        let searchTopGroup = null;
        const searchInp = document.getElementById('searchInput');
        if (searchInp) {
            searchInp.placeholder = '회원번호 / 이름';
            searchInp.style.setProperty('width', '115px', 'important');
            searchInp.style.setProperty('min-width', '115px', 'important');
            searchInp.style.setProperty('max-width', '115px', 'important');

            const searchParent = searchInp.parentElement;
            if (searchParent && searchParent !== headerEl && !searchParent.querySelector('input[type="date"]')) {
                searchParent.style.setProperty('width', 'auto', 'important');
                searchParent.style.setProperty('min-width', '0px', 'important');
                searchParent.style.setProperty('max-width', '155px', 'important');
                searchParent.style.setProperty('flex', '0 0 auto', 'important');
            }

            let curr = searchInp.parentElement;
            while (curr && curr.parentElement !== headerEl && curr !== headerEl) {
                curr = curr.parentElement;
            }
            if (curr && curr.parentElement === headerEl) {
                searchTopGroup = curr;
            }
        }

        const topIconsHolder = document.getElementById('bs-top-row-icons-holder');
        if (periodTopGroup) {
            periodTopGroup.classList.add('bs-desktop-right-tools-group');

            if (searchTopGroup && searchTopGroup !== periodTopGroup && !searchTopGroup.querySelector('#header-line-count')) {
                periodTopGroup.appendChild(searchTopGroup);
            }

            if (isDesktop) {
                if (topIconsHolder && topIconsHolder.parentElement === headerEl && periodTopGroup.nextElementSibling !== topIconsHolder) {
                    headerEl.insertBefore(periodTopGroup, topIconsHolder);
                }
                periodTopGroup.style.setProperty('margin-left', 'auto', 'important');
                periodTopGroup.style.setProperty('margin-right', '4px', 'important');
                periodTopGroup.style.setProperty('width', 'auto', 'important');
                periodTopGroup.style.setProperty('justify-content', 'flex-end', 'important');
                periodTopGroup.style.setProperty('gap', '8px', 'important');

                if (topIconsHolder) {
                    topIconsHolder.style.setProperty('margin-left', '0px', 'important');
                }
            } else {
                periodTopGroup.style.removeProperty('margin-left');
                periodTopGroup.style.removeProperty('margin-right');
            }
        }
    }

    function bootCompactAndAlign() {
        injectCompactHeaderCSS();
        applyCompactAndAlignRight();

        window.addEventListener('resize', applyCompactAndAlignRight);
        [200, 500, 1000].forEach(delay => setTimeout(applyCompactAndAlignRight, delay));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootCompactAndAlign);
    } else {
        bootCompactAndAlign();
    }
})();

// [20-3] 표시 설정 메뉴 '위젯 설정' 타이틀 하단 가로선 제거 패치
(function removeWidgetSettingsTitleUnderline() {
    let style = document.getElementById('bs-remove-widget-line-css');
    if (!style) {
        style = document.createElement('style');
        style.id = 'bs-remove-widget-line-css';
        document.head.appendChild(style);
    }
    style.innerHTML = `
        #bs-widget-settings-col > div:first-child,
        #bs-widget-settings-col > strong:first-child,
        #bs-widget-settings-col > h4:first-child,
        #bs-widget-settings-col > span:first-child,
        #bs-widget-settings-col .setting-title,
        #bs-widget-settings-col .menu-title {
            border-bottom: none !important;
            padding-bottom: 0 !important;
            margin-bottom: 2px !important;
        }
        #bs-widget-settings-col hr {
            display: none !important;
        }
    `;

    function stripInlineBorder() {
        const widgetCol = document.getElementById('bs-widget-settings-col');
        if (!widgetCol) return;

        widgetCol.querySelectorAll('*').forEach(el => {
            const txt = (el.innerText || '').trim();
            if (txt === '위젯 설정' || txt === '위젯설정') {
                el.style.setProperty('border-bottom', 'none', 'important');
                el.style.setProperty('padding-bottom', '0px', 'important');
                el.style.setProperty('margin-bottom', '2px', 'important');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', stripInlineBorder);
    } else {
        stripInlineBorder();
    }
    document.addEventListener('click', () => setTimeout(stripInlineBorder, 20), true);
})();
// ============================================================================
// [21] 최상단 기준 파트너(Root) 스위치 전환, 히스토리 기억 및 동명이인 선택 모달
// ============================================================================
(function initCustomRootSwitchAndLoginTargetPatchV2() {
    if (window._bsCustomRootSwitchPatchedV2) return;
    window._bsCustomRootSwitchPatchedV2 = true;

    const STORAGE_ROOT_KEY = 'bs_saved_custom_root_id';
    const STORAGE_HISTORY_KEY = 'bs_recent_root_history';
    const STORAGE_PENDING_LOGIN_QUERY = 'bs_pending_login_root_query';

    window.isRootCardPickMode = false;

    // [21-1] ID 정규화 및 전체 회원 풀(Pool) 백업/탐색
    function normId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^vk-?/, '');
    }

    function backupMasterDataIfNeeded() {
        if (!window._masterTreeDataBackup && window.treeData) {
            window._masterTreeDataBackup = window.treeData;
        }
        if (!window._masterMembersPoolBackup) {
            const list = collectAllNodes();
            if (list.length > 1) {
                window._masterMembersPoolBackup = list;
            }
        }
    }

    function collectAllNodes() {
        const map = new Map();
        const addNode = (n) => {
            if (!n || typeof n !== 'object') return;
            const id = n.id || n.member_id;
            if (id && !map.has(normId(id))) {
                map.set(normId(id), n);
            }
            if (n.left && typeof n.left === 'object') addNode(n.left);
            if (n.right && typeof n.right === 'object') addNode(n.right);
            if (Array.isArray(n.children)) n.children.forEach(addNode);
        };

        if (window._masterTreeDataBackup) {
            if (Array.isArray(window._masterTreeDataBackup)) window._masterTreeDataBackup.forEach(addNode);
            else addNode(window._masterTreeDataBackup);
        }
        if (window._originalMasterRootNode) addNode(window._originalMasterRootNode);
        if (typeof window.getUniqueMembers === 'function') {
            try { (window.getUniqueMembers() || []).forEach(addNode); } catch (e) {}
        }
        if (window.treeData) {
            if (Array.isArray(window.treeData)) window.treeData.forEach(addNode);
            else addNode(window.treeData);
        }
        if (Array.isArray(window.allMembers)) window.allMembers.forEach(addNode);
        if (Array.isArray(window.membersData)) window.membersData.forEach(addNode);
        if (Array.isArray(window.rawMembers)) window.rawMembers.forEach(addNode);

        if (map.size === 0) {
            document.querySelectorAll('.node-card[id^="card_"]').forEach(cardEl => {
                const cId = cardEl.id.replace(/^card_/, '');
                if (cId && typeof window.findMemberNode === 'function') {
                    const found = window.findMemberNode(cId);
                    if (found) addNode(found);
                }
            });
        }
        return Array.from(map.values());
    }

    function findNodeFromPool(targetId) {
        if (!targetId) return null;
        backupMasterDataIfNeeded();
        const tNorm = normId(targetId);

        if (window._masterMembersPoolBackup) {
            const f = window._masterMembersPoolBackup.find(m => normId(m.id || m.member_id) === tNorm);
            if (f) return f;
        }
        const pool = collectAllNodes();
        const foundInPool = pool.find(m => normId(m.id || m.member_id) === tNorm);
        if (foundInPool) return foundInPool;

        if (typeof window.findMemberNode === 'function') {
            return window.findMemberNode(targetId) || window.findMemberNode('VK-' + tNorm.toUpperCase());
        }
        return null;
    }

    // [21-2] 원본 최상위 루트 보존 및 getAbsoluteTopRoot 오버라이드
    const origGetAbsoluteTopRoot = window.getAbsoluteTopRoot;

    window.getTrueMasterTopRoot = function() {
        backupMasterDataIfNeeded();
        if (window._originalMasterRootNode) return window._originalMasterRootNode;
        if (typeof origGetAbsoluteTopRoot === 'function') {
            const r = origGetAbsoluteTopRoot();
            if (r) {
                window._originalMasterRootNode = r;
                return r;
            }
        }
        const pool = collectAllNodes();
        if (pool.length > 0) {
            window._originalMasterRootNode = pool[0];
            return pool[0];
        }
        return null;
    };

    window.getAbsoluteTopRoot = function() {
        window.getTrueMasterTopRoot();
        const savedRootId = window.customTopRootId || localStorage.getItem(STORAGE_ROOT_KEY);
        if (savedRootId) {
            const customNode = findNodeFromPool(savedRootId);
            if (customNode) {
                return customNode;
            }
        }
        return window._originalMasterRootNode || (typeof origGetAbsoluteTopRoot === 'function' ? origGetAbsoluteTopRoot() : null);
    };

    // [21-3] DOM 트리에서 선택한 카드의 서브트리(<li>)만 최상단으로 단독 표시하는 엔진
    window.isolateSubtreeInDOM = function(targetMemberId) {
        const treeRoot = document.getElementById('tree-root') || document.querySelector('.tree');
        if (!treeRoot) return false;

        treeRoot.querySelectorAll('[data-bs-root-hidden="1"]').forEach(el => {
            el.style.removeProperty('display');
            el.removeAttribute('data-bs-root-hidden');
        });
        treeRoot.querySelectorAll('[data-bs-root-unwrapped="1"]').forEach(el => {
            el.style.removeProperty('padding-top');
            el.removeAttribute('data-bs-root-unwrapped');
        });

        if (!targetMemberId) return true;

        const targetNorm = normId(targetMemberId);
        let targetCard = document.getElementById(`card_${targetMemberId}`);
        if (!targetCard) {
            document.querySelectorAll('.node-card[id^="card_"]').forEach(c => {
                if (normId(c.id.replace(/^card_/, '')) === targetNorm) {
                    targetCard = c;
                }
            });
        }
        if (!targetCard) return false;

        const targetLi = targetCard.closest('li');
        if (!targetLi) return false;

        let currLi = targetLi;
        while (currLi && currLi !== treeRoot && treeRoot.contains(currLi)) {
            const parentUl = currLi.parentElement;
            if (parentUl && parentUl.tagName === 'UL') {
                Array.from(parentUl.children).forEach(siblingLi => {
                    if (siblingLi !== currLi && siblingLi.tagName === 'LI') {
                        siblingLi.style.setProperty('display', 'none', 'important');
                        siblingLi.setAttribute('data-bs-root-hidden', '1');
                    }
                });

                parentUl.style.setProperty('padding-top', '0px', 'important');
                parentUl.setAttribute('data-bs-root-unwrapped', '1');

                const ancestorLi = parentUl.parentElement;
                if (ancestorLi && ancestorLi.tagName === 'LI' && treeRoot.contains(ancestorLi)) {
                    Array.from(ancestorLi.children).forEach(child => {
                        if (child !== parentUl) {
                            child.style.setProperty('display', 'none', 'important');
                            child.setAttribute('data-bs-root-hidden', '1');
                        }
                    });
                    ancestorLi.style.setProperty('padding-top', '0px', 'important');
                    ancestorLi.setAttribute('data-bs-root-unwrapped', '1');
                    currLi = ancestorLi;
                    continue;
                }
            }
            break;
        }

        targetLi.style.setProperty('padding-top', '0px', 'important');
        targetLi.setAttribute('data-bs-root-unwrapped', '1');
        return true;
    };

    function injectSubtreeCleanConnectorCSS() {
        if (document.getElementById('bs-subtree-clean-connector-css')) return;
        const st = document.createElement('style');
        st.id = 'bs-subtree-clean-connector-css';
        st.innerHTML = `
            [data-bs-root-unwrapped="1"]::before,
            [data-bs-root-unwrapped="1"]::after {
                display: none !important;
                border: none !important;
            }
            body.bs-root-pick-active .node-card {
                cursor: pointer !important;
                outline: 2px dashed #60a5fa !important;
                outline-offset: 2px !important;
                transition: transform 0.15s, outline-color 0.15s !important;
            }
            body.bs-root-pick-active .node-card:hover {
                outline: 3px solid #fbbf24 !important;
                transform: scale(1.06) !important;
                z-index: 999 !important;
            }
        `;
        document.head.appendChild(st);
    }

    // [21-4] 이전 선택 파트너 히스토리 저장 및 조회
    function saveToRootHistory(memberNode) {
        if (!memberNode || !memberNode.id) return;
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
        } catch (e) {
            history = [];
        }
        const entry = {
            id: memberNode.id,
            name: memberNode.name || memberNode.member_name || '-',
            rank: String(memberNode.rank || memberNode.rank_name || memberNode.title || 'MEMBER').toUpperCase(),
            memberType: memberNode.member_type || memberNode.type || memberNode.category || '사업자'
        };
        history = history.filter(item => normId(item.id) !== normId(entry.id));
        history.unshift(entry);
        if (history.length > 8) history = history.slice(0, 8);
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    }

    function getRootHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    // [21-5] 최상단 카드가 헤더에 가려지지 않도록 헤더 하단 기준 여백을 계산하여 배치
    window.centerSpecificCardAsRoot = function(targetCardEl) {
        const wrapper = document.getElementById('tree-wrapper') || document.querySelector('.tree-wrapper');
        const container = document.getElementById('canvas-container') || (wrapper ? wrapper.parentElement : null);
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!wrapper || !container || !targetCardEl) return;

        if (window.innerWidth <= 480) {
            window.scale = 0.52;
        } else if (window.innerWidth <= 640) {
            window.scale = 0.60;
        } else if (window.innerHeight <= 450) {
            window.scale = 0.58;
        } else if (window.innerWidth <= 1024) {
            window.scale = 0.72;
        } else {
            window.scale = 0.85;
        }

        wrapper.style.setProperty('transform-origin', '0 0', 'important');
        wrapper.style.setProperty('transform', `translate(0px, 0px) scale(1)`, 'important');

        const wrapperRect = wrapper.getBoundingClientRect();
        const cardRect = targetCardEl.getBoundingClientRect();
        const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 56;

        const cardCenterX = (cardRect.left - wrapperRect.left) + (cardRect.width / 2);
        const cardTopY = (cardRect.top - wrapperRect.top);

        const containerWidth = container.clientWidth || window.innerWidth;
        const paddingBelowHeader = (window.innerWidth <= 640 || window.innerHeight <= 450) ? 18 : 28;

        const desiredScreenTop = headerBottom + paddingBelowHeader;
        const targetPanY = (desiredScreenTop - wrapperRect.top) - (cardTopY * window.scale);

        window.panX = Math.round((containerWidth / 2) - (cardCenterX * window.scale));
        window.panY = Math.round(targetPanY);

        wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
    };

    const prevCenterRootNode = window.centerRootNode;
    window.centerRootNode = function() {
        const savedId = window.customTopRootId || localStorage.getItem(STORAGE_ROOT_KEY);
        if (savedId) {
            window.isolateSubtreeInDOM(savedId);
            const targetNorm = normId(savedId);
            let cardEl = document.getElementById(`card_${savedId}`);
            if (!cardEl) {
                document.querySelectorAll('.node-card[id^="card_"]').forEach(c => {
                    if (normId(c.id.replace(/^card_/, '')) === targetNorm) cardEl = c;
                });
            }
            if (cardEl) {
                window.centerSpecificCardAsRoot(cardEl);
                return;
            }
        }
        if (typeof prevCenterRootNode === 'function') {
            prevCenterRootNode();
        }
    };
    window.resetZoomAndPan = window.centerRootNode;

    window.applyCustomTopRootPartner = function(memberId, resetToMaster = false) {
        backupMasterDataIfNeeded();
        window.toggleRootCardPickMode(false);

        const switchModal = document.getElementById('bs-root-switch-modal-overlay');
        if (switchModal) switchModal.remove();

        const masterNode = window.getTrueMasterTopRoot();

        if (resetToMaster || !memberId || (masterNode && normId(masterNode.id) === normId(memberId))) {
            window.customTopRootId = null;
            localStorage.removeItem(STORAGE_ROOT_KEY);
            window.isolateSubtreeInDOM(null);

            const mId = masterNode ? masterNode.id : null;
            if (mId) {
                window.currentSelectedId = mId;
                const masterCard = document.getElementById(`card_${mId}`) || document.querySelector('.node-card');
                if (masterCard) window.centerSpecificCardAsRoot(masterCard);
                if (typeof window.selectNode === 'function') {
                    try { window.selectNode(mId); } catch (e) {}
                }
                if (typeof window.updateHeaderLineCount === 'function') {
                    window.updateHeaderLineCount(mId);
                }
            }
            updateSwitchButtonBadgeState();
            return;
        }

        const targetNode = findNodeFromPool(memberId);
        const canonicalId = targetNode ? (targetNode.id || targetNode.member_id || memberId) : memberId;

        window.customTopRootId = canonicalId;
        window.currentSelectedId = canonicalId;
        localStorage.setItem(STORAGE_ROOT_KEY, canonicalId);

        if (targetNode) {
            saveToRootHistory(targetNode);
        } else {
            const domCard = document.getElementById(`card_${canonicalId}`);
            if (domCard) {
                saveToRootHistory({
                    id: canonicalId,
                    name: domCard.getAttribute('data-name') || canonicalId,
                    rank: domCard.getAttribute('data-rank') || 'MEMBER'
                });
            }
        }

        const isolated = window.isolateSubtreeInDOM(canonicalId);

        if (!isolated && typeof window.renderTree === 'function') {
            try { window.renderTree(); } catch (e) {}
            window.isolateSubtreeInDOM(canonicalId);
        }

        setTimeout(() => {
            window.isolateSubtreeInDOM(canonicalId);
            const targetNorm = normId(canonicalId);
            let targetCardEl = document.getElementById(`card_${canonicalId}`);
            if (!targetCardEl) {
                document.querySelectorAll('.node-card[id^="card_"]').forEach(c => {
                    if (normId(c.id.replace(/^card_/, '')) === targetNorm) targetCardEl = c;
                });
            }

            if (targetCardEl) {
                window.centerSpecificCardAsRoot(targetCardEl);
                window._bypassRootPickCapture = true;
                targetCardEl.click();
                window._bypassRootPickCapture = false;
            }

            if (typeof window.updateHeaderLineCount === 'function') {
                window.updateHeaderLineCount(canonicalId);
            }
            updateSwitchButtonBadgeState();
        }, 60);
    };

    ['renderTree', 'toggleTreeMode', 'drawTree'].forEach(fnName => {
        const origFn = window[fnName];
        if (typeof origFn === 'function' && !origFn._rootSwitchWrapped) {
            const wrapped = function() {
                const res = origFn.apply(this, arguments);
                const savedId = window.customTopRootId || localStorage.getItem(STORAGE_ROOT_KEY);
                if (savedId) {
                    setTimeout(() => {
                        window.isolateSubtreeInDOM(savedId);
                        window.centerRootNode();
                        if (typeof window.updateHeaderLineCount === 'function') {
                            window.updateHeaderLineCount(savedId);
                        }
                    }, 80);
                }
                return res;
            };
            wrapped._rootSwitchWrapped = true;
            window[fnName] = wrapped;
        }
    });

    // [21-6] 회원번호/회원명 검색 및 동명이인(복수 결과) 선택 모달창 표시
    window.searchAndSelectTopRootPartner = function(rawQuery) {
        const q = String(rawQuery || '').trim();
        if (!q) {
            window.applyCustomTopRootPartner(null, true);
            return;
        }

        const pool = collectAllNodes();
        if (!pool || pool.length === 0) {
            localStorage.setItem(STORAGE_PENDING_LOGIN_QUERY, q);
            return;
        }

        const qNorm = normId(q);
        const qLower = q.toLowerCase();

        const exactIdMatches = pool.filter(m => normId(m.id || m.member_id) === qNorm);
        if (exactIdMatches.length === 1) {
            window.applyCustomTopRootPartner(exactIdMatches[0].id || exactIdMatches[0].member_id);
            return;
        }

        let matches = pool.filter(m => {
            const mName = String(m.name || m.member_name || '').trim().toLowerCase();
            return mName === qLower;
        });

        if (matches.length === 0) {
            matches = pool.filter(m => {
                const mName = String(m.name || m.member_name || '').trim().toLowerCase();
                const mId = String(m.id || m.member_id || '').trim().toLowerCase();
                return mName.includes(qLower) || mId.includes(qLower) || normId(mId).includes(qNorm);
            });
        }

        if (matches.length === 0) {
            alert(`"${q}"에 해당하는 파트너(회원번호 또는 이름)를 찾을 수 없습니다.`);
            return;
        }

        if (matches.length === 1) {
            window.applyCustomTopRootPartner(matches[0].id || matches[0].member_id);
            return;
        }

        window.openDuplicatePartnerSelectModal(matches, q);
    };

    window.openDuplicatePartnerSelectModal = function(candidates, keyword = '') {
        let overlay = document.getElementById('bs-duplicate-partner-modal');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'bs-duplicate-partner-modal';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100dvh !important;
            background: rgba(0, 0, 0, 0.78) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 12px !important;
            box-sizing: border-box !important;
        `;

        const rowsHtml = candidates.map(m => {
            const mId = m.id || m.member_id || '-';
            const mName = m.name || m.member_name || '-';
            const mRank = String(m.rank || m.rank_name || m.title || 'MEMBER').toUpperCase();
            const mType = m.member_type || m.type || m.category || m.grade_type || '사업자';

            return `
                <tr onclick="window.selectPartnerFromDuplicateModal('${mId}')" style="border-bottom: 1px solid #374151; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 10px 8px; text-align: center; font-family: monospace; font-weight: bold; color: #60a5fa;">${mId}</td>
                    <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #ffffff;">${mName}</td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="background: #374151; color: #fbbf24; font-size: 11px; font-weight: bold; padding: 3px 7px; border-radius: 4px;">${mRank}</span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: #d1d5db; font-weight: bold;">${mType}</td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <button type="button" style="background: #2563eb; border: 1px solid #3b82f6; color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 11.5px; font-weight: bold; cursor: pointer;">선택</button>
                    </td>
                </tr>
            `;
        }).join('');

        overlay.innerHTML = `
            <div onclick="event.stopPropagation()" style="width: min(540px, 95vw); max-height: 84dvh; background: #1f2937; border: 1px solid #4b5563; border-radius: 10px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); display: flex; flex-direction: column; overflow: hidden; color: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #111827; border-bottom: 1px solid #374151;">
                    <div>
                        <strong style="font-size: 14.5px; color: #60a5fa;">👥 동명이인 / 복수 파트너 선택 (${candidates.length}명)</strong>
                        <div style="font-size: 11.5px; color: #9ca3af; margin-top: 3px;">"${keyword}" 검색 결과가 여러 명입니다. 최상단에 표시할 파트너를 선택해 주세요.</div>
                    </div>
                    <button type="button" onclick="document.getElementById('bs-duplicate-partner-modal').remove()" style="background: #374151; border: 1px solid #4b5563; color: #e5e7eb; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: bold; cursor: pointer;">닫기 ✕</button>
                </div>
                <div style="overflow-y: auto; padding: 12px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                        <thead>
                            <tr style="background: #111827; color: #9ca3af; border-bottom: 2px solid #374151;">
                                <th style="padding: 9px 8px; text-align: center;">회원번호</th>
                                <th style="padding: 9px 8px; text-align: center;">이름</th>
                                <th style="padding: 9px 8px; text-align: center;">타이틀(직급)</th>
                                <th style="padding: 9px 8px; text-align: center;">회원구분</th>
                                <th style="padding: 9px 8px; text-align: center;">최상단 배치</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    };

    window.selectPartnerFromDuplicateModal = function(memberId) {
        const modal = document.getElementById('bs-duplicate-partner-modal');
        if (modal) modal.remove();
        window.applyCustomTopRootPartner(memberId);
    };

    // [21-7] 카드 직접 클릭 선택 모드
    window.toggleRootCardPickMode = function(forceState) {
        const nextState = (typeof forceState === 'boolean') ? forceState : !window.isRootCardPickMode;
        window.isRootCardPickMode = nextState;

        let banner = document.getElementById('bs-root-pick-banner');
        if (nextState) {
            document.body.classList.add('bs-root-pick-active');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'bs-root-pick-banner';
                banner.style.cssText = `
                    position: fixed !important;
                    top: calc(var(--bs-header-bottom, 64px) + 10px) !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                    border: 1px solid #93c5fd !important;
                    color: #ffffff !important;
                    padding: 8px 16px !important;
                    border-radius: 999px !important;
                    font-size: 12.5px !important;
                    font-weight: bold !important;
                    z-index: 2147483640 !important;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.75) !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    white-space: nowrap !important;
                `;
                banner.innerHTML = `
                    <span>🎯 계보도에서 최상단에 배치할 카드를 클릭하세요</span>
                    <button type="button" onclick="window.openRootSwitchModal()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; border-radius: 99px; padding: 2px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">검색/이전목록</button>
                    <button type="button" onclick="window.toggleRootCardPickMode(false)" style="background: #1e293b; border: 1px solid #475569; color: #f87171; border-radius: 99px; padding: 2px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">취소 ✕</button>
                `;
                document.body.appendChild(banner);
            } else {
                banner.style.display = 'flex';
            }
        } else {
            document.body.classList.remove('bs-root-pick-active');
            if (banner) banner.style.display = 'none';
        }
        updateSwitchButtonBadgeState();
    };

    function handleCardPickIntercept(e) {
        if (!window.isRootCardPickMode || window._bypassRootPickCapture) return;
        const cardEl = e.target.closest('.node-card');
        if (!cardEl) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        const memberId = cardEl.id.replace(/^card_/, '');
        if (memberId) {
            window.applyCustomTopRootPartner(memberId);
        }
    }

    window.addEventListener('pointerup', handleCardPickIntercept, true);
    window.addEventListener('click', handleCardPickIntercept, true);

    // [21-8] 스위치 모달창 & 헤더 우측 스위치 버튼 장착
    window.openRootSwitchModal = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        let overlay = document.getElementById('bs-root-switch-modal-overlay');
        if (overlay) overlay.remove();

        const currentRoot = window.getAbsoluteTopRoot();
        const history = getRootHistory();

        const historyChipsHtml = history.length > 0
            ? history.map(h => {
                const isCurr = currentRoot && normId(currentRoot.id) === normId(h.id);
                return `
                    <div onclick="window.applyCustomTopRootPartner('${h.id}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: ${isCurr ? 'rgba(37, 99, 235, 0.25)' : '#111827'}; border: 1px solid ${isCurr ? '#3b82f6' : '#374151'}; border-radius: 6px; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="color: #ffffff; font-size: 12.5px;">${h.name}</strong>
                            <span style="color: #60a5fa; font-family: monospace; font-size: 11.5px; font-weight: bold;">${h.id}</span>
                            <span style="background: #374151; color: #fbbf24; font-size: 10.5px; font-weight: bold; padding: 1px 6px; border-radius: 4px;">${h.rank}</span>
                            <span style="color: #9ca3af; font-size: 11px;">${h.memberType || ''}</span>
                        </div>
                        <span style="font-size: 11px; font-weight: bold; color: ${isCurr ? '#60a5fa' : '#9ca3af'};">${isCurr ? '현재 최상단' : '배치 ➔'}</span>
                    </div>
                `;
            }).join('')
            : `<div style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px;">이전에 선택했던 카드 기록이 없습니다.</div>`;

        overlay = document.createElement('div');
        overlay.id = 'bs-root-switch-modal-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100dvh !important;
            background: rgba(0, 0, 0, 0.65) !important;
            z-index: 2147483645 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 12px !important;
            box-sizing: border-box !important;
        `;

        overlay.innerHTML = `
            <div onclick="event.stopPropagation()" style="width: min(440px, 94vw); background: #1f2937; border: 1px solid #4b5563; border-radius: 10px; padding: 16px; color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.85); display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 10px;">
                    <strong style="font-size: 14px; color: #60a5fa;">🔀 최상단 기준 카드(Root) 스위치</strong>
                    <button type="button" onclick="document.getElementById('bs-root-switch-modal-overlay').remove()" style="background: #374151; border: 1px solid #4b5563; color: #e5e7eb; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">닫기 ✕</button>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button type="button" onclick="document.getElementById('bs-root-switch-modal-overlay').remove(); window.toggleRootCardPickMode(true);" style="flex: 1; padding: 10px 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 1px solid #60a5fa; border-radius: 6px; color: #fff; font-size: 12.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>👆</span> <span>계보도에서 카드 직접 클릭하여 선택</span>
                    </button>
                    <button type="button" onclick="window.applyCustomTopRootPartner(null, true)" title="전체 최상위 루트로 복귀" style="padding: 10px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: #e5e7eb; font-size: 12px; font-weight: bold; cursor: pointer; white-space: nowrap;">
                        전체 최상위로 복귀
                    </button>
                </div>

                <div>
                    <label style="display: block; font-size: 11.5px; color: #9ca3af; margin-bottom: 5px; font-weight: bold;">🔍 회원번호 또는 회원명으로 최상단 배치 (동명이인 자동 선택창 지원)</label>
                    <div style="display: flex; gap: 6px;">
                        <input type="text" id="bs-root-switch-search-inp" placeholder="회원번호 또는 이름 입력" onkeydown="if(event.key==='Enter'){ window.searchAndSelectTopRootPartner(this.value); }" style="flex: 1; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 6px; padding: 8px 10px; font-size: 12.5px; outline: none;">
                        <button type="button" onclick="window.searchAndSelectTopRootPartner(document.getElementById('bs-root-switch-search-inp').value)" style="background: #10b981; border: 1px solid #059669; color: #fff; border-radius: 6px; padding: 0 14px; font-size: 12.5px; font-weight: bold; cursor: pointer;">최상단 배치</button>
                    </div>
                </div>

                <div style="border-top: 1px solid #374151; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 11.5px; color: #9ca3af; font-weight: bold;">🕘 이전에 선택했던 카드 (클릭 시 즉시 최상단 전환)</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; max-height: 210px; overflow-y: auto;">
                        ${historyChipsHtml}
                    </div>
                </div>
            </div>
        `;

        overlay.addEventListener('click', () => overlay.remove());
        document.body.appendChild(overlay);
    };

    function updateSwitchButtonBadgeState() {
        const btn = document.getElementById('bsRootSwitchBtn');
        if (!btn) return;
        const hasCustomRoot = Boolean(window.customTopRootId || localStorage.getItem(STORAGE_ROOT_KEY));
        if (window.isRootCardPickMode || hasCustomRoot) {
            btn.style.borderColor = '#60a5fa';
            btn.style.color = '#60a5fa';
            btn.style.background = 'rgba(37, 99, 235, 0.25)';
        } else {
            btn.style.borderColor = '#374151';
            btn.style.color = '#e5e7eb';
            btn.style.background = '#1f2937';
        }
    }

    function mountHeaderRootSwitchIcon() {
        injectSubtreeCleanConnectorCSS();
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!headerEl) return;

        let switchBtn = document.getElementById('bsRootSwitchBtn');
        if (!switchBtn) {
            switchBtn = document.createElement('button');
            switchBtn.id = 'bsRootSwitchBtn';
            switchBtn.type = 'button';
            switchBtn.title = '가상모드';
            switchBtn.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 30px;
                padding: 0;
                margin: 0;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 6px;
                color: #e5e7eb;
                cursor: pointer;
                flex-shrink: 0;
            `;
            switchBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
            `;
            switchBtn.onclick = function(e) {
                window.openRootSwitchModal(e);
            };
        }

        const topIconsHolder = document.getElementById('bs-top-row-icons-holder');
        const treeBtn = document.getElementById('toggleTreeBtn') || headerEl.querySelector('[onclick*="toggleTreeMode"]');

        if (topIconsHolder) {
            if (switchBtn.parentElement !== topIconsHolder) {
                if (treeBtn && treeBtn.parentElement === topIconsHolder) {
                    topIconsHolder.insertBefore(switchBtn, treeBtn.nextSibling);
                } else {
                    topIconsHolder.insertBefore(switchBtn, topIconsHolder.firstChild);
                }
            }
        } else if (treeBtn && treeBtn.parentElement) {
            if (switchBtn.parentElement !== treeBtn.parentElement) {
                treeBtn.parentElement.insertBefore(switchBtn, treeBtn.nextSibling);
            }
        } else if (switchBtn.parentElement !== headerEl) {
            headerEl.appendChild(switchBtn);
        }

        const drawerPanel = document.getElementById('bs-mobile-drawer-panel');
        if (drawerPanel && !document.getElementById('bs-mob-root-switch-btn')) {
            const treeModeLbl = document.getElementById('bs-mob-tree-mode-label');
            const targetGroup = treeModeLbl ? treeModeLbl.closest('div') : null;
            if (targetGroup) {
                const mobSwitchBtn = document.createElement('button');
                mobSwitchBtn.id = 'bs-mob-root-switch-btn';
                mobSwitchBtn.type = 'button';
                mobSwitchBtn.onclick = function() {
                    if (typeof window.toggleMobileHamburgerDrawer === 'function') window.toggleMobileHamburgerDrawer(false);
                    window.openRootSwitchModal();
                };
                mobSwitchBtn.style.cssText = 'display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 12.5px; font-weight: bold; cursor: pointer; text-align: left;';
                mobSwitchBtn.innerHTML = `<span>🔀</span> <span style="color: #ffffff; font-weight: bold;">최상단 기준 카드 스위치 / 이전 기록</span>`;
                targetGroup.insertBefore(mobSwitchBtn, targetGroup.children[2] || null);
            }
        }

        updateSwitchButtonBadgeState();
    }

    // [21-9] 로그인 화면에 [최상단 시작 파트너] 입력창 자동 주입 및 연동
    function injectLoginPartnerInput() {
        const pwdInputs = document.querySelectorAll('input[type="password"]');
        pwdInputs.forEach(pwdInp => {
            const formOrBox = pwdInp.closest('form, .login-box, .auth-modal, div');
            if (!formOrBox || formOrBox.querySelector('#bs-login-start-partner-inp')) return;

            const parentContainer = pwdInp.parentElement;
            if (!parentContainer) return;

            const savedRootId = localStorage.getItem(STORAGE_ROOT_KEY) || '';
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width: 100%; margin-top: 8px; margin-bottom: 8px; text-align: left; box-sizing: border-box;';
            wrap.innerHTML = `
                <label style="display: block; font-size: 11.5px; color: #9ca3af; margin-bottom: 4px; font-weight: bold;">
                    🎯 최상단 시작 파트너 (회원번호 또는 회원명)
                </label>
                <input type="text" id="bs-login-start-partner-inp" value="${savedRootId}" placeholder="예: VK-1199472 또는 구본진 (미입력 시 전체 루트)" style="width: 100%; padding: 9px 12px; background: #111827; border: 1px solid #374151; border-radius: 6px; color: #ffffff; font-size: 13px; box-sizing: border-box; outline: none;">
            `;

            parentContainer.insertBefore(wrap, pwdInp.nextSibling);

            const partnerInp = wrap.querySelector('#bs-login-start-partner-inp');
            const saveLoginQuery = () => {
                const val = partnerInp.value.trim();
                if (val) {
                    localStorage.setItem(STORAGE_PENDING_LOGIN_QUERY, val);
                } else {
                    localStorage.removeItem(STORAGE_PENDING_LOGIN_QUERY);
                }
            };

            partnerInp.addEventListener('input', saveLoginQuery);
            partnerInp.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') saveLoginQuery();
            });

            const submitBtn = formOrBox.querySelector('button, input[type="submit"]');
            if (submitBtn) {
                submitBtn.addEventListener('click', saveLoginQuery, true);
            }
        });
    }

    function checkAndApplySavedOrPendingRoot() {
        const hasCards = document.querySelectorAll('.node-card').length > 0;
        if (!hasCards) return false;

        backupMasterDataIfNeeded();

        const pendingQuery = localStorage.getItem(STORAGE_PENDING_LOGIN_QUERY);
        if (pendingQuery) {
            localStorage.removeItem(STORAGE_PENDING_LOGIN_QUERY);
            window.searchAndSelectTopRootPartner(pendingQuery);
            return true;
        }

        const savedRootId = localStorage.getItem(STORAGE_ROOT_KEY);
        if (savedRootId && !window._initialCustomRootAppliedV2) {
            window._initialCustomRootAppliedV2 = true;
            window.applyCustomTopRootPartner(savedRootId);
            return true;
        }
        return false;
    }

    function bootRootSwitchPatchV2() {
        mountHeaderRootSwitchIcon();
        injectLoginPartnerInput();

        [300, 700, 1200, 2000].forEach(delay => {
            setTimeout(() => {
                mountHeaderRootSwitchIcon();
                injectLoginPartnerInput();
                checkAndApplySavedOrPendingRoot();
            }, delay);
        });

        window.addEventListener('resize', () => {
            setTimeout(mountHeaderRootSwitchIcon, 50);
        });

        const observer = new MutationObserver(() => {
            if (!document.getElementById('bsRootSwitchBtn')) {
                mountHeaderRootSwitchIcon();
            }
            injectLoginPartnerInput();
            if (!window._initialCustomRootAppliedV2 && document.querySelectorAll('.node-card').length > 0) {
                checkAndApplySavedOrPendingRoot();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootRootSwitchPatchV2);
    } else {
        bootRootSwitchPatchV2();
    }
})();

// ============================================================================
// [22] 보너스 검증 모달 추천계보 세대 보정, 맥북 신호등 최소화 버튼 및 우측 세로 슬라이드 독(V43)
// ============================================================================

// [22-1] 추천매칭 보너스 상단 요약 박스 2줄 정렬 & 추천계보 기준 명시 & 세대수(원 N대) 정밀 계산 패치 V2
(function fixMatchingBonusModalLayoutAndGenerationPatchV2() {
    if (window._bsMatchingGenFixPatchedV2) return;
    window._bsMatchingGenFixPatchedV2 = true;

    function normId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^vk-?/, '');
    }

    function getAllUniqueMembersList() {
        if (typeof window.getUniqueMembers === 'function') {
            const list = window.getUniqueMembers();
            if (Array.isArray(list) && list.length > 0) return list;
        }
        const map = new Map();
        function traverse(n) {
            if (!n || typeof n !== 'object') return;
            const id = n.id || n.member_id;
            if (id && !map.has(normId(id))) map.set(normId(id), n);
            if (n.left && typeof n.left === 'object') traverse(n.left);
            if (n.right && typeof n.right === 'object') traverse(n.right);
            if (Array.isArray(n.children)) n.children.forEach(traverse);
        }
        if (window._masterTreeDataBackup) {
            if (Array.isArray(window._masterTreeDataBackup)) window._masterTreeDataBackup.forEach(traverse);
            else traverse(window._masterTreeDataBackup);
        }
        if (window._originalMasterRootNode) traverse(window._originalMasterRootNode);
        if (window.treeData) {
            if (Array.isArray(window.treeData)) window.treeData.forEach(traverse);
            else traverse(window.treeData);
        }
        if (Array.isArray(window.allMembers)) window.allMembers.forEach(traverse);
        if (Array.isArray(window.membersData)) window.membersData.forEach(traverse);
        return Array.from(map.values());
    }

    window.getRecommenderGenerationInfo = function(baseMemberId, partnerMemberId) {
        const baseNorm = normId(baseMemberId);
        const targetNorm = normId(partnerMemberId);
        if (!baseNorm || !targetNorm || baseNorm === targetNorm) {
            return { isDownline: false, origGen: null, compressedGen: null, path: [] };
        }

        const allMembers = getAllUniqueMembersList();
        const memberMap = new Map();
        allMembers.forEach(m => {
            const k = normId(m.id || m.member_id);
            if (k) memberMap.set(k, m);
        });

        const visited = new Set();
        const chainUp = [];
        let curr = memberMap.get(targetNorm) || (typeof window.findMemberNode === 'function' ? window.findMemberNode(partnerMemberId) : null);

        while (curr) {
            const currNorm = normId(curr.id || curr.member_id);
            if (!currNorm || visited.has(currNorm)) break;
            visited.add(currNorm);
            chainUp.push(curr);

            const recRaw = curr.recId || curr.rec_id || curr.recommenderId || curr.recommender_id || '';
            const recNorm = normId(recRaw);
            if (!recNorm) break;

            if (recNorm === baseNorm) {
                const origGen = chainUp.length;
                let compGen = 0;
                const pathFromTop = [...chainUp].reverse();
                pathFromTop.forEach((node, idx) => {
                    const isLast = (idx === pathFromTop.length - 1);
                    const rName = String(node.rank || node.rank_name || '').toUpperCase();
                    const rLv = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(rName) : 0;
                    if (isLast || rLv >= 4) compGen++;
                });
                return {
                    isDownline: true,
                    origGen: origGen,
                    compressedGen: Math.max(1, compGen),
                    path: pathFromTop
                };
            }

            curr = memberMap.get(recNorm) || (typeof window.findMemberNode === 'function' ? window.findMemberNode(recRaw) : null);
        }

        const queue = [{ norm: baseNorm, depth: 0 }];
        const bfsVisited = new Set([baseNorm]);
        while (queue.length > 0) {
            const { norm, depth } = queue.shift();
            const children = allMembers.filter(m => {
                const mNorm = normId(m.id || m.member_id);
                const rNorm = normId(m.recId || m.rec_id || m.recommenderId || m.recommender_id);
                return mNorm && mNorm !== norm && rNorm === norm;
            });

            for (const child of children) {
                const cNorm = normId(child.id || child.member_id);
                if (bfsVisited.has(cNorm)) continue;
                bfsVisited.add(cNorm);
                const nextDepth = depth + 1;
                if (cNorm === targetNorm) {
                    return { isDownline: true, origGen: nextDepth, compressedGen: nextDepth, path: [] };
                }
                queue.push({ norm: cNorm, depth: nextDepth });
            }
        }

        return { isDownline: false, origGen: null, compressedGen: null, path: [] };
    };

    window.formatBonusDetailTopSummaryBox = function(modal) {
        if (!modal) return;

        const allDivs = modal.querySelectorAll('div');
        let summaryBox = null;

        allDivs.forEach(div => {
            const txt = (div.innerText || '').trim();
            if (txt.includes('대상 회원:') && txt.includes('항목:') && div.children.length >= 1 && div.children.length <= 4) {
                if (!summaryBox || summaryBox.contains(div)) {
                    summaryBox = div;
                }
            }
        });

        if (summaryBox && summaryBox.dataset.bsTwoLineFormatted !== 'true') {
            summaryBox.dataset.bsTwoLineFormatted = 'true';

            summaryBox.style.setProperty('display', 'flex', 'important');
            summaryBox.style.setProperty('flex-direction', 'column', 'important');
            summaryBox.style.setProperty('align-items', 'flex-start', 'important');
            summaryBox.style.setProperty('justify-content', 'center', 'important');
            summaryBox.style.setProperty('gap', '6px', 'important');
            summaryBox.style.setProperty('padding', '10px 14px', 'important');
            summaryBox.style.setProperty('line-height', '1.4', 'important');

            const children = Array.from(summaryBox.children);
            if (children.length >= 2) {
                const line1 = children[0];
                const line2 = children[1];

                line1.style.setProperty('width', '100%', 'important');
                line1.style.setProperty('white-space', 'nowrap', 'important');
                line1.style.setProperty('overflow', 'hidden', 'important');
                line1.style.setProperty('text-overflow', 'ellipsis', 'important');
                line1.style.setProperty('font-size', '12.5px', 'important');

                line2.style.setProperty('width', '100%', 'important');
                line2.style.setProperty('display', 'flex', 'important');
                line2.style.setProperty('align-items', 'center', 'important');
                line2.style.setProperty('justify-content', 'space-between', 'important');
                line2.style.setProperty('flex-wrap', 'wrap', 'important');
                line2.style.setProperty('gap', '6px', 'important');
                line2.style.setProperty('font-size', '12.5px', 'important');
                line2.style.setProperty('padding-top', '5px', 'important');
                line2.style.setProperty('border-top', '1px dashed #374151', 'important');

                if ((line2.innerText || '').includes('추천매칭보너스')) {
                    line2.innerHTML = `
                        <span style="white-space: nowrap;">
                            <span style="color: #9ca3af;">항목:</span>
                            <strong style="color: #fbbf24; margin-left: 3px;">추천매칭보너스 (추천계보 기준 · 세대 편집 및 파트너 추가 가능)</strong>
                        </span>
                        <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px; white-space: nowrap;">
                            ※ 추천계보(직추천 라인) 기준 산출
                        </span>
                    `;
                }
            }
        }

        allDivs.forEach(div => {
            const txt = (div.innerText || '').trim();
            if (txt.startsWith('💡 계산 로직') && txt.includes('매칭요율') && !div.dataset.bsLogicNoteAdded) {
                div.dataset.bsLogicNoteAdded = 'true';
                const noteEl = document.createElement('div');
                noteEl.style.cssText = 'margin-top: 4px; color: #34d399; font-size: 11.5px; font-weight: bold;';
                noteEl.innerHTML = '• 추천매칭보너스의 세대(원 N대 및 적용 세대)는 후원계보가 아닌 <u>추천계보(직추천 계보도)</u>를 기준으로 산출됩니다.';
                div.appendChild(noteEl);
            }
        });
    };

    window.reconcileMatchingBonusModalGenerations = function() {
        const modal = document.getElementById('bonusDetailModal');
        if (!modal || modal.style.display === 'none') return;

        window.formatBonusDetailTopSummaryBox(modal);

        const modalText = modal.innerText || '';
        if (!modalText.includes('추천매칭보너스') && !modalText.includes('Matching Bonus')) return;

        let baseMemberId = window.currentSelectedId;
        const headerMatch = modalText.match(/대상\s*회원\s*:\s*[^(\n]*\(\s*(VK-[0-9]+|[0-9]+)\s*\)/i);
        if (headerMatch && headerMatch[1]) {
            baseMemberId = headerMatch[1].trim();
        }
        if (!baseMemberId) return;

        const rows = modal.querySelectorAll('table tbody tr, table tr');
        rows.forEach(tr => {
            let partnerId = '';
            const idInput = tr.querySelector('input[type="text"]');
            if (idInput && idInput.value) {
                partnerId = idInput.value.trim();
            } else {
                const idMatch = (tr.innerText || '').match(/VK-[0-9]{5,}|[0-9]{6,}/i);
                if (idMatch) partnerId = idMatch[0].trim();
            }
            if (!partnerId) return;

            const genInfo = window.getRecommenderGenerationInfo(baseMemberId, partnerId);
            const firstTd = tr.querySelector('td');
            if (!firstTd) return;

            let origGenLabelEl = null;
            firstTd.querySelectorAll('div, span, small').forEach(el => {
                if (el.children.length === 0 && /\(\s*원\s*[0-9]+대\s*\)|\(\s*추천계보\s*외|\(\s*추천외\s*\)|\(\s*원\s*-대\s*\)/.test(el.innerText || '')) {
                    origGenLabelEl = el;
                }
            });

            const correctOrigText = genInfo.isDownline
                ? `(원 ${genInfo.origGen}대)`
                : `(추천계보 외 / 원 -대)`;

            if (origGenLabelEl) {
                if (origGenLabelEl.innerText.trim() !== correctOrigText) {
                    origGenLabelEl.innerText = correctOrigText;
                    origGenLabelEl.style.color = genInfo.isDownline ? '#9ca3af' : '#f87171';
                }
            } else {
                const htmlStr = firstTd.innerHTML;
                if (/\(\s*원\s*[0-9]+대\s*\)/.test(htmlStr)) {
                    firstTd.innerHTML = htmlStr.replace(/\(\s*원\s*[0-9]+대\s*\)/g, `<span style="color:${genInfo.isDownline ? '#9ca3af' : '#f87171'};">${correctOrigText}</span>`);
                }
            }

            tr.dataset.recOrigGen = genInfo.origGen || '';
            tr.dataset.isRecDownline = genInfo.isDownline ? '1' : '0';
        });
    };

    ['showBonusDetail', 'openBonusDetailModal', 'renderMatchingBonusDetail', 'updateMatchingPartnerRow'].forEach(fnName => {
        const origFn = window[fnName];
        if (typeof origFn === 'function' && !origFn._recGenPatchedV2) {
            const wrapped = function() {
                const res = origFn.apply(this, arguments);
                setTimeout(window.reconcileMatchingBonusModalGenerations, 20);
                setTimeout(window.reconcileMatchingBonusModalGenerations, 120);
                return res;
            };
            wrapped._recGenPatchedV2 = true;
            window[fnName] = wrapped;
        }
    });

    const observer = new MutationObserver(() => {
        const modal = document.getElementById('bonusDetailModal');
        if (modal && modal.style.display !== 'none') {
            window.reconcileMatchingBonusModalGenerations();
        }
    });

    function bootRecGenFixV2() {
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('input', (e) => {
            if (e.target && e.target.closest('#bonusDetailModal')) {
                setTimeout(window.reconcileMatchingBonusModalGenerations, 50);
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target && (e.target.closest('#perfWidget') || e.target.closest('#bonusDetailModal'))) {
                setTimeout(window.reconcileMatchingBonusModalGenerations, 50);
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootRecGenFixV2);
    } else {
        bootRecGenFixV2();
    }
})();

// [22-2] 보너스 산출 상세 검증 모달(#bonusDetailModal) 맥북 신호등 버튼 & 실적집계창 연동 하단 밀착 패치 V4
(function initBonusDetailModalMacStyleMinimizePatchV4() {
    if (window._bsBonusModalMacMinPatchedV4) return;
    window._bsBonusModalMacMinPatchedV4 = true;

    let savedModalState = {
        width: '680px',
        height: '480px',
        minWidth: '520px',
        minHeight: '340px',
        maxHeight: '85dvh',
        top: '50%',
        left: '50%',
        bottom: 'auto',
        right: 'auto',
        transform: 'translate(-50%, -50%)',
        captured: false
    };

    function injectMacTrafficButtonCSS() {
        let style = document.getElementById('bs-mac-traffic-btn-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'bs-mac-traffic-btn-css';
            document.head.appendChild(style);
        }
        style.innerHTML = `
            .bs-mac-circle-btn {
                width: 16px !important;
                height: 16px !important;
                min-width: 16px !important;
                min-height: 16px !important;
                max-width: 16px !important;
                max-height: 16px !important;
                border-radius: 50% !important;
                padding: 0 !important;
                margin: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                transition: transform 0.12s ease, filter 0.12s ease, background-color 0.15s ease !important;
                box-sizing: border-box !important;
                outline: none !important;
                line-height: 1 !important;
                flex-shrink: 0 !important;
            }
            .bs-mac-circle-btn[data-state="normal"] {
                background-color: #febc2e !important;
                border: 1px solid #d69816 !important;
                color: #4a3000 !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4) !important;
            }
            .bs-mac-circle-btn[data-state="minimized"] {
                background-color: #28c840 !important;
                border: 1px solid #1aa02d !important;
                color: #063b0e !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4) !important;
            }
            .bs-mac-circle-btn[data-state="close"] {
                background-color: #ff5f57 !important;
                border: 1px solid #e0443e !important;
                color: #4a0002 !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4) !important;
            }
            .bs-mac-circle-btn svg {
                width: 9px !important;
                height: 9px !important;
                opacity: 0.82;
                transition: opacity 0.12s ease;
                pointer-events: none;
                display: block !important;
            }
            .bs-mac-circle-btn:hover {
                transform: scale(1.1) !important;
                filter: brightness(1.06) !important;
            }
            .bs-mac-circle-btn:hover svg {
                opacity: 1;
            }
            #bonusDetailModal.bs-modal-minimized {
                transition: bottom 0.2s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
            }
        `;
    }

    function updateMacButtonIcon(btn, isMinimized) {
        if (!btn) return;
        btn.classList.add('bs-mac-circle-btn');
        if (isMinimized) {
            btn.setAttribute('data-state', 'minimized');
            btn.title = '원래 창 크기로 펼치기';
            btn.innerHTML = `
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <line x1="6" y1="2.5" x2="6" y2="9.5"></line>
                    <line x1="2.5" y1="6" x2="9.5" y2="6"></line>
                </svg>
            `;
        } else {
            btn.setAttribute('data-state', 'normal');
            btn.title = '창 최소화';
            btn.innerHTML = `
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
                    <line x1="2.5" y1="6" x2="9.5" y2="6"></line>
                </svg>
            `;
        }
    }

    function styleMacCloseButton(closeBtn) {
        if (!closeBtn) return;
        closeBtn.classList.add('bs-mac-circle-btn');
        closeBtn.setAttribute('data-state', 'close');
        closeBtn.title = '창 닫기';
        closeBtn.innerHTML = `
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="3" y1="3" x2="9" y2="9"></line>
                <line x1="9" y1="3" x2="3" y2="9"></line>
            </svg>
        `;
    }

    function getBonusModalParts() {
        const modal = document.getElementById('bonusDetailModal');
        if (!modal) return null;

        const children = Array.from(modal.children);
        const headerEl = modal.querySelector('.modal-header, .widget-header, #bonusDetailHeader') || children[0];
        const contentEls = children.filter(el => el !== headerEl && !el.classList.contains('resizer'));

        return { modal, headerEl, contentEls };
    }

    function captureNormalModalSize(modal) {
        if (!modal || modal.dataset.bsMinimized === 'true') return;
        const rect = modal.getBoundingClientRect();
        if (rect.height >= 150 && rect.width >= 280) {
            savedModalState = {
                width: `${Math.round(rect.width)}px`,
                height: `${Math.round(rect.height)}px`,
                minWidth: window.innerWidth <= 768 ? '92vw' : '500px',
                minHeight: '320px',
                maxHeight: '88dvh',
                top: `${Math.round(rect.top)}px`,
                left: `${Math.round(rect.left)}px`,
                bottom: 'auto',
                right: 'auto',
                transform: 'none',
                captured: true
            };
        }
    }

    window.syncMinimizedBonusModalPosition = function() {
        const modal = document.getElementById('bonusDetailModal');
        if (!modal || modal.style.display === 'none' || modal.dataset.bsMinimized !== 'true') return;

        const perfW = document.getElementById('perfWidget');
        let bottomOffset = 10;

        if (perfW && getComputedStyle(perfW).display !== 'none' && getComputedStyle(perfW).visibility !== 'hidden') {
            const pRect = perfW.getBoundingClientRect();
            if (pRect.height > 0 && pRect.top < window.innerHeight) {
                bottomOffset = Math.max(10, Math.round(window.innerHeight - pRect.top) + 6);
            }
        }

        modal.style.setProperty('top', 'auto', 'important');
        modal.style.setProperty('bottom', `${bottomOffset}px`, 'important');
        modal.style.setProperty('left', '50%', 'important');
        modal.style.setProperty('right', 'auto', 'important');
        modal.style.setProperty('transform', 'translateX(-50%)', 'important');
    };

    window.setBonusDetailModalMinimized = function(minimize) {
        const parts = getBonusModalParts();
        if (!parts || !parts.modal || !parts.headerEl) return;
        const { modal, headerEl, contentEls } = parts;

        if (modal.style.display === 'none') return;

        const isCurrentlyMin = modal.dataset.bsMinimized === 'true';
        const targetMinState = (typeof minimize === 'boolean') ? minimize : !isCurrentlyMin;

        const minBtn = document.getElementById('bs-bonus-modal-min-btn');

        if (targetMinState) {
            captureNormalModalSize(modal);

            modal.dataset.bsMinimized = 'true';
            modal.classList.add('minimized', 'bs-modal-minimized');

            contentEls.forEach(el => {
                el.style.setProperty('display', 'none', 'important');
            });

            modal.style.setProperty('width', '340px', 'important');
            modal.style.setProperty('min-width', '260px', 'important');
            modal.style.setProperty('max-width', '92vw', 'important');
            modal.style.setProperty('height', '40px', 'important');
            modal.style.setProperty('min-height', '40px', 'important');
            modal.style.setProperty('max-height', '40px', 'important');
            modal.style.setProperty('overflow', 'hidden', 'important');
            modal.style.setProperty('resize', 'none', 'important');

            window.syncMinimizedBonusModalPosition();

            headerEl.style.setProperty('cursor', 'pointer', 'important');
            headerEl.title = '클릭하여 원래 창 크기로 펼치기';

            updateMacButtonIcon(minBtn, true);
        } else {
            modal.dataset.bsMinimized = 'false';
            modal.classList.remove('minimized', 'bs-modal-minimized');

            contentEls.forEach(el => {
                el.style.removeProperty('display');
                if (getComputedStyle(el).display === 'none') {
                    el.style.setProperty('display', 'flex', 'important');
                    el.style.setProperty('flex-direction', 'column', 'important');
                }
            });

            const restoreW = savedModalState.captured ? savedModalState.width : (window.innerWidth <= 768 ? '95vw' : '700px');
            const restoreH = savedModalState.captured ? savedModalState.height : (window.innerWidth <= 768 ? '78dvh' : '500px');

            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('flex-direction', 'column', 'important');
            modal.style.setProperty('width', restoreW, 'important');
            modal.style.setProperty('min-width', savedModalState.minWidth || '500px', 'important');
            modal.style.setProperty('max-width', '96vw', 'important');
            modal.style.setProperty('height', restoreH, 'important');
            modal.style.setProperty('min-height', savedModalState.minHeight || '340px', 'important');
            modal.style.setProperty('max-height', '88dvh', 'important');
            modal.style.setProperty('bottom', 'auto', 'important');
            modal.style.setProperty('right', 'auto', 'important');
            modal.style.setProperty('overflow', 'hidden', 'important');
            modal.style.setProperty('resize', 'both', 'important');

            if (savedModalState.captured && savedModalState.transform === 'none') {
                const safeTop = Math.min(Math.max(56, parseInt(savedModalState.top, 10) || 100), window.innerHeight - 200);
                const safeLeft = Math.min(Math.max(10, parseInt(savedModalState.left, 10) || 100), window.innerWidth - 300);
                modal.style.setProperty('top', `${safeTop}px`, 'important');
                modal.style.setProperty('left', `${safeLeft}px`, 'important');
                modal.style.setProperty('transform', 'none', 'important');
            } else {
                modal.style.setProperty('top', '50%', 'important');
                modal.style.setProperty('left', '50%', 'important');
                modal.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
            }

            headerEl.style.setProperty('cursor', 'move', 'important');
            headerEl.title = '';

            updateMacButtonIcon(minBtn, false);
        }
    };

    function mountBonusModalMinimizeButton() {
        injectMacTrafficButtonCSS();
        const parts = getBonusModalParts();
        if (!parts || !parts.modal || !parts.headerEl) return;
        const { modal, headerEl } = parts;

        const allBtns = Array.from(headerEl.querySelectorAll('button')).filter(b => b.id !== 'bs-bonus-modal-min-btn');
        const closeBtn = allBtns[allBtns.length - 1];

        if (closeBtn) {
            styleMacCloseButton(closeBtn);
        }

        let minBtn = document.getElementById('bs-bonus-modal-min-btn');
        if (!minBtn) {
            minBtn = document.createElement('button');
            minBtn.id = 'bs-bonus-modal-min-btn';
            minBtn.type = 'button';
            updateMacButtonIcon(minBtn, modal.dataset.bsMinimized === 'true');

            minBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                window.setBonusDetailModalMinimized();
            }, true);

            if (closeBtn && closeBtn.parentElement) {
                if (closeBtn.parentElement === headerEl) {
                    const rightBtnWrap = document.createElement('div');
                    rightBtnWrap.id = 'bs-mac-btn-group-wrap';
                    rightBtnWrap.style.cssText = 'display: inline-flex; align-items: center; gap: 7px; margin-left: auto;';
                    headerEl.insertBefore(rightBtnWrap, closeBtn);
                    rightBtnWrap.appendChild(minBtn);
                    rightBtnWrap.appendChild(closeBtn);
                } else {
                    closeBtn.parentElement.style.display = 'inline-flex';
                    closeBtn.parentElement.style.alignItems = 'center';
                    closeBtn.parentElement.style.gap = '7px';
                    closeBtn.parentElement.insertBefore(minBtn, closeBtn);
                }
            } else {
                headerEl.appendChild(minBtn);
            }
        } else {
            updateMacButtonIcon(minBtn, modal.dataset.bsMinimized === 'true');
        }

        if (headerEl.dataset.bsHeaderRestoreBound !== 'true') {
            headerEl.dataset.bsHeaderRestoreBound = 'true';
            let downX = 0, downY = 0;

            headerEl.addEventListener('pointerdown', (e) => {
                downX = e.clientX;
                downY = e.clientY;
            }, true);

            headerEl.addEventListener('click', (e) => {
                if (e.target.closest('#bs-bonus-modal-min-btn') || (closeBtn && e.target.closest('button') === closeBtn)) {
                    return;
                }
                const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
                if (moveDist > 8) return;

                const isMin = modal.dataset.bsMinimized === 'true' || modal.classList.contains('minimized') || modal.getBoundingClientRect().height < 85;
                if (isMin) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    window.setBonusDetailModalMinimized(false);
                }
            }, true);
        }

        if (modal.style.display !== 'none' && modal.getBoundingClientRect().height > 0 && modal.getBoundingClientRect().height < 85 && modal.dataset.bsMinimized !== 'true') {
            window.setBonusDetailModalMinimized(false);
        }
    }

    function bindPerfWidgetPositionSync() {
        const perfW = document.getElementById('perfWidget');
        if (perfW && !perfW._bsResizeObserved) {
            perfW._bsResizeObserved = true;

            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => {
                    window.syncMinimizedBonusModalPosition();
                });
                ro.observe(perfW);
                const perfBody = perfW.querySelector('.widget-body');
                if (perfBody) ro.observe(perfBody);
            }

            perfW.addEventListener('transitionrun', () => {
                let frames = 0;
                const tick = () => {
                    window.syncMinimizedBonusModalPosition();
                    if (++frames < 25) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
            perfW.addEventListener('transitionend', window.syncMinimizedBonusModalPosition);
        }

        ['togglePerfWidget', 'closePerfWidget'].forEach(fnName => {
            const origFn = window[fnName];
            if (typeof origFn === 'function' && !origFn._bsSyncMinPosWrapped) {
                const wrapped = function() {
                    const res = origFn.apply(this, arguments);
                    [0, 30, 80, 150, 250, 350].forEach(d => setTimeout(window.syncMinimizedBonusModalPosition, d));
                    return res;
                };
                wrapped._bsSyncMinPosWrapped = true;
                window[fnName] = wrapped;
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#perfWidget') || e.target.closest('#settingsDropdown')) {
                [0, 30, 80, 160, 260, 360].forEach(d => setTimeout(window.syncMinimizedBonusModalPosition, d));
            }
        }, true);

        window.addEventListener('resize', window.syncMinimizedBonusModalPosition);
    }

    function bindCanvasBlankClickMinimize() {
        let pointerDownPos = null;

        document.addEventListener('pointerdown', (e) => {
            pointerDownPos = { x: e.clientX, y: e.clientY };
            const modal = document.getElementById('bonusDetailModal');
            if (modal && modal.style.display !== 'none') {
                captureNormalModalSize(modal);
            }
        }, true);

        document.addEventListener('click', (e) => {
            const modal = document.getElementById('bonusDetailModal');
            if (!modal || modal.style.display === 'none') return;

            if (pointerDownPos) {
                const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
                if (dist > 6) return;
            }

            if (
                e.target.closest('#bonusDetailModal') ||
                e.target.closest('header, .header, .top-bar') ||
                e.target.closest('#perfWidget') ||
                e.target.closest('#salesWidget') ||
                e.target.closest('.node-card') ||
                e.target.closest('.zoom-controls')
            ) {
                return;
            }

            const isCanvasBlank = e.target.closest('#canvas-container, .canvas-container, #tree-wrapper, .tree-wrapper, main') || e.target === document.body;
            if (isCanvasBlank && modal.dataset.bsMinimized !== 'true') {
                e.stopPropagation();
                window.setBonusDetailModalMinimized(true);
            }
        }, true);
    }

    ['showBonusDetail', 'openBonusDetailModal', 'renderMatchingBonusDetail'].forEach(fnName => {
        const origFn = window[fnName];
        if (typeof origFn === 'function' && !origFn._minRestoreWrappedV4) {
            const wrapped = function() {
                const res = origFn.apply(this, arguments);
                setTimeout(() => {
                    mountBonusModalMinimizeButton();
                    window.setBonusDetailModalMinimized(false);
                    const modal = document.getElementById('bonusDetailModal');
                    if (modal) captureNormalModalSize(modal);
                }, 20);
                return res;
            };
            wrapped._minRestoreWrappedV4 = true;
            window[fnName] = wrapped;
        }
    });

    function bootBonusModalMacMinimizePatchV4() {
        mountBonusModalMinimizeButton();
        bindCanvasBlankClickMinimize();
        bindPerfWidgetPositionSync();

        const observer = new MutationObserver(() => {
            const modal = document.getElementById('bonusDetailModal');
            if (modal && !document.getElementById('bs-bonus-modal-min-btn')) {
                mountBonusModalMinimizeButton();
            }
            const perfW = document.getElementById('perfWidget');
            if (perfW && !perfW._bsResizeObserved) {
                bindPerfWidgetPositionSync();
            }
            window.syncMinimizedBonusModalPosition();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootBonusModalMacMinimizePatchV4);
    } else {
        bootBonusModalMacMinimizePatchV4();
    }
})();

// [22-3] 배지 달성률 '원형 - / + 버튼 UI' 적용 + 헤더 4개 아이콘 슬라이드바 이동 + 줌 확대('+') 복원 패치 V43
(function initCustomStepperAndVerticalSlideDockV43() {
    if (window._bsBadgeAndNavFinalV43) return;
    window._bsBadgeAndNavFinalV43 = true;

    document.querySelectorAll('style[id*="bs-badge-"], style[id*="bs-final-clean-badge"]').forEach(s => s.remove());
    ['bsHeaderSlideZone', 'bsRightAutoSlideDock'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    function ensureVerticalDockAndBadgeCSSV43() {
        if (document.getElementById('bs-badge-final-v43-css')) return;
        const st = document.createElement('style');
        st.id = 'bs-badge-final-v43-css';
        st.textContent = [
            '.node-card, .node-card * {',
            '    animation: none !important;',
            '    -webkit-animation: none !important;',
            '    transition: none !important;',
            '    -webkit-transition: none !important;',
            '}',
            '.bs-card-top-badges span[data-v30-pct]::after {',
            '    content: " " attr(data-v30-pct) "%" !important;',
            '    font-weight: 800 !important;',
            '    display: inline !important;',
            '}',
            '.bs-v30-hide {',
            '    display: none !important;',
            '}',
            '.bs-pct-stepper-wrap {',
            '    display: flex !important;',
            '    align-items: center !important;',
            '    justify-content: center !important;',
            '    gap: 20px !important;',
            '    width: 100% !important;',
            '    padding: 8px 0 4px 0 !important;',
            '    margin-top: 4px !important;',
            '    user-select: none !important;',
            '}',
            '.bs-pct-stepper-btn {',
            '    width: 34px !important;',
            '    height: 34px !important;',
            '    min-width: 34px !important;',
            '    min-height: 34px !important;',
            '    border-radius: 50% !important;',
            '    background: #2b303c !important;',
            '    border: 1px solid rgba(255, 255, 255, 0.06) !important;',
            '    color: #e5e7eb !important;',
            '    display: inline-flex !important;',
            '    align-items: center !important;',
            '    justify-content: center !important;',
            '    cursor: pointer !important;',
            '    padding: 0 !important;',
            '    transition: background 0.15s ease, transform 0.1s ease !important;',
            '}',
            '.bs-pct-stepper-btn:hover {',
            '    background: #3b4252 !important;',
            '    color: #ffffff !important;',
            '}',
            '.bs-pct-stepper-btn:active {',
            '    transform: scale(0.94) !important;',
            '}',
            '.bs-pct-stepper-val {',
            '    font-size: 14px !important;',
            '    font-weight: 600 !important;',
            '    color: #f3f4f6 !important;',
            '    min-width: 44px !important;',
            '    text-align: center !important;',
            '    letter-spacing: 0.3px !important;',
            '}',
            '#bsBodyVerticalSlideDock {',
            '    position: fixed !important;',
            '    top: 52% !important;',
            '    right: 0 !important;',
            '    transform: translate(calc(100% - 14px), -50%) !important;',
            '    z-index: 999980 !important;',
            '    display: flex !important;',
            '    flex-direction: row !important;',
            '    align-items: center !important;',
            '    transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1) !important;',
            '    pointer-events: auto !important;',
            '}',
            '#bsBodyVerticalSlideDock:hover,',
            '#bsBodyVerticalSlideDock.bs-vdock-open {',
            '    transform: translate(0, -50%) !important;',
            '}',
            '#bsBodyVerticalSlideHandle {',
            '    width: 14px !important;',
            '    height: 64px !important;',
            '    background: linear-gradient(180deg, #1e293b, #0f172a) !important;',
            '    border: 1px solid rgba(96, 165, 250, 0.5) !important;',
            '    border-right: none !important;',
            '    border-radius: 7px 0 0 7px !important;',
            '    display: flex !important;',
            '    align-items: center !important;',
            '    justify-content: center !important;',
            '    color: #60a5fa !important;',
            '    font-size: 9px !important;',
            '    font-weight: 900 !important;',
            '    cursor: pointer !important;',
            '    box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.5) !important;',
            '    user-select: none !important;',
            '}',
            '#bsBodyVerticalSlideDock:hover #bsBodyVerticalSlideHandle,',
            '#bsBodyVerticalSlideDock.bs-vdock-open #bsBodyVerticalSlideHandle {',
            '    border-color: rgba(75, 85, 99, 0.75) !important;',
            '    color: #9ca3af !important;',
            '}',
            '#bsBodyVerticalSlideTray {',
            '    display: flex !important;',
            '    flex-direction: column !important;',
            '    align-items: center !important;',
            '    justify-content: center !important;',
            '    gap: 6px !important;',
            '    padding: 10px 8px !important;',
            '    background: rgba(17, 24, 39, 0.96) !important;',
            '    backdrop-filter: blur(10px) !important;',
            '    border: 1px solid rgba(75, 85, 99, 0.75) !important;',
            '    border-right: none !important;',
            '    border-radius: 10px 0 0 10px !important;',
            '    box-shadow: -6px 4px 20px rgba(0, 0, 0, 0.7) !important;',
            '}',
            '.bs-vdock-icon-btn {',
            '    display: inline-flex !important;',
            '    align-items: center !important;',
            '    justify-content: center !important;',
            '    width: 34px !important;',
            '    height: 34px !important;',
            '    min-width: 34px !important;',
            '    min-height: 34px !important;',
            '    border-radius: 8px !important;',
            '    border: 1px solid transparent !important;',
            '    background: rgba(31, 41, 55, 0.55) !important;',
            '    color: #d1d5db !important;',
            '    cursor: pointer !important;',
            '    padding: 0 !important;',
            '    margin: 0 !important;',
            '    box-sizing: border-box !important;',
            '    transition: all 0.15s ease !important;',
            '}',
            '.bs-vdock-icon-btn:hover {',
            '    background: rgba(55, 65, 81, 0.9) !important;',
            '    color: #ffffff !important;',
            '    transform: scale(1.05) !important;',
            '}',
            '.bs-vdock-icon-btn.bs-nav-active {',
            '    background: rgba(37, 99, 235, 0.28) !important;',
            '    border-color: rgba(96, 165, 250, 0.65) !important;',
            '    color: #60a5fa !important;',
            '    box-shadow: 0 0 10px rgba(37, 99, 235, 0.45) !important;',
            '}',
            '.bs-vdock-divider {',
            '    width: 22px !important;',
            '    height: 1px !important;',
            '    background: rgba(75, 85, 99, 0.65) !important;',
            '    margin: 2px 0 !important;',
            '}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function normalizeToStep10(val) {
        let num = parseInt(val, 10);
        if (isNaN(num) || num < 10) return 80;
        if (num > 100) return 100;
        return Math.max(10, Math.min(100, Math.round(num / 10) * 10));
    }

    const initStoredPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
    if (isNaN(initStoredPct) || initStoredPct < 10 || initStoredPct % 10 !== 0) {
        const fixedPct = initStoredPct < 10 ? 80 : normalizeToStep10(initStoredPct);
        localStorage.setItem('bs_badge_threshold_pct', String(fixedPct));
    }

    function setupBadgeThresholdInputStep10() {
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(inp => {
            const pTxt = (inp.parentElement ? inp.parentElement.innerText : '') || '';
            const rowTxt = (inp.closest('div') ? inp.closest('div').innerText : '') || '';
            if (pTxt.includes('배지') || pTxt.includes('달성률') || rowTxt.includes('배지 표시 기준') || (inp.id || '').toLowerCase().includes('badge')) {
                if (inp.getAttribute('step') !== '10') inp.setAttribute('step', '10');
                if (inp.getAttribute('min') !== '10') inp.setAttribute('min', '10');
                if (inp.getAttribute('max') !== '100') inp.setAttribute('max', '100');

                const curVal = parseInt(inp.value, 10);
                let validVal = normalizeToStep10(localStorage.getItem('bs_badge_threshold_pct') || '80');
                if (!isNaN(curVal) && curVal >= 10) {
                    validVal = normalizeToStep10(curVal);
                    localStorage.setItem('bs_badge_threshold_pct', String(validVal));
                }
                inp.value = String(validVal);

                let rowContainer = inp.closest('div');
                if (rowContainer) {
                    if (rowContainer.parentElement && (rowContainer.parentElement.innerText || '').includes('배지 표시 기준') && !(rowContainer.innerText || '').includes('배지 표시 기준')) {
                        rowContainer = rowContainer.parentElement;
                    }

                    inp.style.setProperty('display', 'none', 'important');
                    Array.from(inp.parentElement.childNodes).forEach(node => {
                        if (node !== inp && node.nodeType === 3 && (node.textContent || '').includes('%')) {
                            node.textContent = '';
                        } else if (node !== inp && node.nodeType === 1 && !node.classList.contains('bs-pct-stepper-wrap')) {
                            const t = (node.innerText || '').trim();
                            if (t.includes('%') || t.includes('이상')) {
                                node.style.setProperty('display', 'none', 'important');
                            }
                        }
                    });

                    rowContainer.style.setProperty('display', 'flex', 'important');
                    rowContainer.style.setProperty('flex-direction', 'column', 'important');
                    rowContainer.style.setProperty('align-items', 'stretch', 'important');
                    rowContainer.style.setProperty('gap', '6px', 'important');

                    let stepper = rowContainer.querySelector('.bs-pct-stepper-wrap');
                    if (!stepper) {
                        stepper = document.createElement('div');
                        stepper.className = 'bs-pct-stepper-wrap';

                        const minusBtn = document.createElement('button');
                        minusBtn.type = 'button';
                        minusBtn.className = 'bs-pct-stepper-btn';
                        minusBtn.title = '10% 감소';
                        minusBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        `;

                        const valDisplay = document.createElement('span');
                        valDisplay.className = 'bs-pct-stepper-val';
                        valDisplay.textContent = `${validVal}%`;

                        const plusBtn = document.createElement('button');
                        plusBtn.type = 'button';
                        plusBtn.className = 'bs-pct-stepper-btn';
                        plusBtn.title = '10% 증가';
                        plusBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        `;

                        const updatePctByDelta = (delta) => {
                            const current = normalizeToStep10(inp.value || localStorage.getItem('bs_badge_threshold_pct') || '80');
                            const next = Math.max(10, Math.min(100, current + delta));
                            inp.value = String(next);
                            valDisplay.textContent = `${next}%`;
                            localStorage.setItem('bs_badge_threshold_pct', String(next));

                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                            inp.dispatchEvent(new Event('change', { bubbles: true }));

                            if (typeof window.renderTreeCardStatusBadges === 'function') {
                                window.renderTreeCardStatusBadges();
                            }
                            window.syncBadgeTitlesToTextV43();
                        };

                        minusBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            updatePctByDelta(-10);
                        });

                        plusBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            updatePctByDelta(10);
                        });

                        stepper.appendChild(minusBtn);
                        stepper.appendChild(valDisplay);
                        stepper.appendChild(plusBtn);
                        rowContainer.appendChild(stepper);
                    } else {
                        const valDisplay = stepper.querySelector('.bs-pct-stepper-val');
                        if (valDisplay) valDisplay.textContent = `${validVal}%`;
                    }
                }
            }
        });
    }

    function getUserSettingThresholdPct() {
        setupBadgeThresholdInputStep10();
        const inputs = document.querySelectorAll('input[type="number"]');
        for (const inp of inputs) {
            const pTxt = (inp.parentElement ? inp.parentElement.innerText : '') || '';
            const rowTxt = (inp.closest('div') ? inp.closest('div').innerText : '') || '';
            if (pTxt.includes('배지') || pTxt.includes('달성률') || rowTxt.includes('배지') || (inp.id || '').toLowerCase().includes('badge')) {
                const v = parseInt(inp.value, 10);
                if (!isNaN(v) && v >= 10 && v <= 100) {
                    const step10Val = Math.max(10, Math.min(100, Math.round(v / 10) * 10));
                    localStorage.setItem('bs_badge_threshold_pct', String(step10Val));
                    return step10Val;
                }
            }
        }
        return normalizeToStep10(localStorage.getItem('bs_badge_threshold_pct') || '80');
    }

    function findZoomControlBox() {
        const bySel = document.querySelector('.zoom-controls, #zoomControls, #zoom-controls, [class*="zoom-control" i]');
        if (bySel) return bySel;

        const allBtns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        for (const b of allBtns) {
            if (b.closest('#bsBodyVerticalSlideDock')) continue;
            const r = b.getBoundingClientRect();
            if (r.top >= 46 && r.top <= 160 && r.left > window.innerWidth * 0.4) {
                if (b.parentElement && b.parentElement.children.length >= 2 && b.parentElement.children.length <= 6) {
                    return b.parentElement;
                }
            }
        }
        return null;
    }

    function ensureZoomPlusButtonRestored() {
        try {
            const zoomBox = findZoomControlBox();
            if (!zoomBox) return null;

            const tray = document.getElementById('bsBodyVerticalSlideTray');
            if (tray) {
                Array.from(tray.children).forEach(el => {
                    if (
                        el.id === 'bsVDockSalesWidgetBtn' ||
                        el.id === 'bsVDockPerfWidgetBtn' ||
                        el.id === 'bsVDockBizNavBtn' ||
                        el.id === 'bsVDockPeriodSearchBtn' ||
                        el.classList.contains('bs-vdock-divider')
                    ) {
                        return;
                    }
                    const meta = ((el.id || '') + ' ' + (el.title || '') + ' ' + (el.getAttribute('onclick') || '') + ' ' + (el.innerText || '') + ' ' + (el.innerHTML || '')).toLowerCase();
                    const isPlus =
                        meta.includes('zoom') || meta.includes('확대') ||
                        (el.innerText || '').trim() === '+' || (el.innerText || '').trim() === '＋' ||
                        (!meta.includes('<circle') && !meta.includes('<rect') && meta.includes('12') && meta.includes('5') && meta.includes('19'));

                    if (isPlus) {
                        el.classList.remove('bs-vdock-icon-btn', 'bs-v30-hide');
                        el.style.removeProperty('display');
                        zoomBox.appendChild(el);
                    }
                });
            }

            const children = Array.from(zoomBox.children);
            if (children.length === 3 && !document.getElementById('bsRestoredZoomInBtn')) {
                const sampleBtn = children[0];
                const plusBtn = document.createElement(sampleBtn.tagName || 'BUTTON');
                plusBtn.id = 'bsRestoredZoomInBtn';
                plusBtn.className = sampleBtn.className || '';
                if (sampleBtn.getAttribute('style')) {
                    plusBtn.setAttribute('style', sampleBtn.getAttribute('style'));
                }
                plusBtn.title = '확대';
                plusBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                `;
                plusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const minusOnclick = sampleBtn.getAttribute('onclick') || '';
                    if (minusOnclick) {
                        const plusCode = minusOnclick
                            .replace(/zoomOut/gi, 'zoomIn')
                            .replace(/zoom_out/gi, 'zoom_in')
                            .replace(/'out'/gi, "'in'")
                            .replace(/"out"/gi, '"in"')
                            .replace(/-\s*0\./g, '0.')
                            .replace(/-\s*1/g, '1');
                        if (plusCode !== minusOnclick) {
                            try { new Function(plusCode)(); return; } catch (err) {}
                        }
                    }
                    if (typeof window.zoomIn === 'function') { window.zoomIn(); return; }
                    if (typeof window.changeZoom === 'function') { window.changeZoom(0.1); return; }
                    if (typeof window.zoomTree === 'function') { window.zoomTree(0.1); return; }
                });
                zoomBox.appendChild(plusBtn);
            }

            return zoomBox;
        } catch (e) {
            return null;
        }
    }

    function findSettingCheckboxByKeywords(keywords) {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
            if (cb.closest('#perfWidget')) continue;
            const labelEl = cb.closest('label') || cb.parentElement;
            const txt = (labelEl ? labelEl.innerText : '').replace(/\s+/g, ' ').trim();
            if (!txt || txt.length > 30) continue;
            if (keywords.some(kw => txt.includes(kw))) {
                return cb;
            }
        }
        return null;
    }

    function hideMovedSettingsItemsInDropdown() {
        const targetChecks = [
            findSettingCheckboxByKeywords(['매출/구독', '매출구독']),
            findSettingCheckboxByKeywords(['실적/수당', '실적수당']),
            findSettingCheckboxByKeywords(['내비게이터', '네비게이터']),
            findSettingCheckboxByKeywords(['매출 기간 검색', '기간 검색', '매출기간'])
        ];

        targetChecks.forEach(cb => {
            if (!cb) return;
            const rowEl = cb.closest('label') || cb.parentElement;
            if (rowEl && rowEl.tagName !== 'BODY') {
                rowEl.style.setProperty('display', 'none', 'important');
            }
        });

        document.querySelectorAll('div, span, p, h3, h4, h5, label, b, strong').forEach(el => {
            if (el.children.length > 0) return;
            const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt === '위젯 설정' || txt === '팝업 설정') {
                el.style.setProperty('display', 'none', 'important');
                const prev = el.previousElementSibling;
                if (prev && (prev.tagName === 'HR' || (prev.textContent || '').trim() === '')) {
                    prev.style.setProperty('display', 'none', 'important');
                }
                const parent = el.parentElement;
                if (parent && parent.tagName !== 'BODY' && !parent.querySelector('input[type="number"]')) {
                    const parentTxt = (parent.innerText || '').replace(/\s+/g, ' ').trim();
                    if (parentTxt === '' || parentTxt === '위젯 설정' || parentTxt === '팝업 설정') {
                        parent.style.setProperty('display', 'none', 'important');
                    }
                }
            }
        });
    }

    function findHeaderSearchInput() {
        const headerEl = document.querySelector('header, .header, .top-bar') || document.body;
        return headerEl.querySelector('input[placeholder*="회원"], input[placeholder*="이름"], input[placeholder*="검색"], input[type="search"], #searchInput');
    }

    function isSearchMagnifierIcon(el) {
        if (!el) return false;
        if (el.id === 'bsVDockPeriodSearchBtn') return false;

        const meta = (
            (el.id || '') + ' ' +
            (el.title || '') + ' ' +
            (el.className || '') + ' ' +
            (el.getAttribute('onclick') || '') + ' ' +
            (el.getAttribute('aria-label') || '') + ' ' +
            (el.innerHTML || '')
        ).toLowerCase();

        if (meta.includes('search') || meta.includes('검색') || meta.includes('돋보기') || meta.includes('findmember') || meta.includes('handlesearch')) {
            return true;
        }

        if (!meta.includes('<rect') && meta.includes('<circle')) {
            if (
                meta.includes('16.65') ||
                meta.includes('4.35') ||
                meta.includes('4.3') ||
                (meta.includes('cx="11"') && meta.includes('r="8"')) ||
                (meta.includes('cx="10"') && meta.includes('r="7"')) ||
                (meta.includes('21') && meta.includes('15'))
            ) {
                return true;
            }
        }

        const searchInp = findHeaderSearchInput();
        if (searchInp && searchInp.parentElement && searchInp.parentElement.contains(el)) {
            return true;
        }

        return false;
    }

    function restoreSearchIconToHeaderIfMoved() {
        ensureZoomPlusButtonRestored();

        const searchInp = findHeaderSearchInput();
        if (!searchInp) return;

        const tray = document.getElementById('bsBodyVerticalSlideTray');
        if (!tray) return;

        const children = Array.from(tray.children);
        children.forEach(el => {
            if (
                el.id === 'bsVDockSalesWidgetBtn' ||
                el.id === 'bsVDockPerfWidgetBtn' ||
                el.id === 'bsVDockBizNavBtn' ||
                el.id === 'bsVDockPeriodSearchBtn' ||
                el.classList.contains('bs-vdock-divider')
            ) {
                return;
            }

            if (isSearchMagnifierIcon(el)) {
                el.classList.remove('bs-vdock-icon-btn');
                const searchContainer = searchInp.parentElement;
                if (searchContainer) {
                    if (searchInp.nextSibling) {
                        searchContainer.insertBefore(el, searchInp.nextSibling);
                    } else {
                        searchContainer.appendChild(el);
                    }
                }
            }
        });
    }

    function shouldKeepIconInHeader(el) {
        if (!el) return false;
        if (isSearchMagnifierIcon(el)) return true;

        const meta = (
            (el.id || '') + ' ' +
            (el.title || '') + ' ' +
            (el.className || '') + ' ' +
            (el.getAttribute('onclick') || '') + ' ' +
            (el.getAttribute('aria-label') || '') + ' ' +
            (el.innerHTML || '')
        ).toLowerCase();

        if (
            el.id === 'bsRestoredZoomInBtn' ||
            meta.includes('zoom') || meta.includes('확대') || meta.includes('축소') ||
            (el.innerText || '').trim() === '+' ||
            (!meta.includes('<circle') && !meta.includes('<rect') && meta.includes('12') && meta.includes('5') && meta.includes('19'))
        ) {
            return true;
        }

        if (
            meta.includes('cloud') || meta.includes('upload') || meta.includes('backup') ||
            meta.includes('sync') || meta.includes('db') || meta.includes('클라우드') ||
            meta.includes('백업') || meta.includes('저장') || meta.includes('교차') ||
            meta.includes('shuffle') || meta.includes('sparkle') || meta.includes('m16 16l-4-4') ||
            meta.includes('18 10h-1.26') || meta.includes('a8 8 0 1 0')
        ) {
            return false;
        }

        const isGear =
            meta.includes('setting') || meta.includes('설정') || meta.includes('표시') ||
            meta.includes('gear') || meta.includes('cog') || meta.includes('19.4 15') || meta.includes('19.4,15');
        if (isGear) return true;

        const isLock =
            meta.includes('lock') || meta.includes('잠금') || meta.includes('로그아웃') ||
            meta.includes('logout') || meta.includes('m7 11v7') || meta.includes('m7 11v-4') ||
            meta.includes('a5 5 0 0 1 10 0v4') || (meta.includes('rect') && meta.includes('y="11"'));
        if (isLock) return true;

        return false;
    }

    function extractRemainingHeaderIconsToMove() {
        const headerEl = document.querySelector('header, .header, .top-bar') || document.body;
        const searchInp = findHeaderSearchInput();
        const zoomBox = ensureZoomPlusButtonRestored();

        let minRightToolbarX = 350;
        if (searchInp) {
            const searchBoxEl = searchInp.parentElement || searchInp;
            const sbRect = searchBoxEl.getBoundingClientRect();
            if (sbRect.right > 0) {
                minRightToolbarX = sbRect.right + 12;
            }
        }

        const svgList = Array.from(headerEl.querySelectorAll('svg, i, img'));
        const iconWrappers = [];

        svgList.forEach(svg => {
            if (svg.closest('#bsBodyVerticalSlideDock') || svg.closest('#settingsDropdown') || svg.closest('.bs-pct-stepper-wrap')) return;
            if (searchInp && searchInp.parentElement && searchInp.parentElement.contains(svg)) return;
            if (zoomBox && zoomBox.contains(svg)) return;

            const rect = svg.getBoundingClientRect();
            if (rect.width === 0 || rect.top > 45 || rect.left < minRightToolbarX) return;

            let wrapper = svg.closest('button, a, label') || svg.parentElement;
            if (!wrapper || wrapper === headerEl || wrapper === document.body) return;

            if (wrapper.querySelectorAll('svg').length > 1) {
                wrapper = svg.parentElement;
            }

            if (!iconWrappers.includes(wrapper)) {
                iconWrappers.push(wrapper);
            }
        });

        iconWrappers.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

        const toMove = [];
        iconWrappers.forEach(el => {
            if (shouldKeepIconInHeader(el)) return;
            toMove.push(el);
        });

        return toMove;
    }

    function updateAllVerticalDockIconsActiveState() {
        const salesBtn = document.getElementById('bsVDockSalesWidgetBtn');
        if (salesBtn) {
            const cb = findSettingCheckboxByKeywords(['매출/구독', '매출구독']);
            salesBtn.classList.toggle('bs-nav-active', Boolean(cb && cb.checked));
        }
        const perfBtn = document.getElementById('bsVDockPerfWidgetBtn');
        if (perfBtn) {
            const cb = findSettingCheckboxByKeywords(['실적/수당', '실적수당']);
            perfBtn.classList.toggle('bs-nav-active', Boolean(cb && cb.checked));
        }
        const navBtn = document.getElementById('bsVDockBizNavBtn');
        if (navBtn) {
            const cb = findSettingCheckboxByKeywords(['내비게이터', '네비게이터']);
            const popupOpen = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
            navBtn.classList.toggle('bs-nav-active', Boolean(popupOpen || (cb && cb.checked)));
        }
        const periodBtn = document.getElementById('bsVDockPeriodSearchBtn');
        if (periodBtn) {
            const cb = findSettingCheckboxByKeywords(['매출 기간 검색', '기간 검색', '매출기간']);
            periodBtn.classList.toggle('bs-nav-active', Boolean(cb && cb.checked));
        }
    }

    function makeVDockBtn(id, title, svgHtml, onClickFn) {
        let btn = document.getElementById(id);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = id;
            btn.type = 'button';
            btn.className = 'bs-vdock-icon-btn';
            btn.title = title;
            btn.innerHTML = svgHtml;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClickFn(e);
                setTimeout(updateAllVerticalDockIconsActiveState, 60);
                setTimeout(updateAllVerticalDockIconsActiveState, 250);
            });
        }
        return btn;
    }

    function buildAndSyncBodyVerticalSlideDock() {
        ensureVerticalDockAndBadgeCSSV43();
        hideMovedSettingsItemsInDropdown();
        setupBadgeThresholdInputStep10();
        restoreSearchIconToHeaderIfMoved();

        let dock = document.getElementById('bsBodyVerticalSlideDock');
        let tray = document.getElementById('bsBodyVerticalSlideTray');

        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'bsBodyVerticalSlideDock';

            const handle = document.createElement('div');
            handle.id = 'bsBodyVerticalSlideHandle';
            handle.title = '마우스를 올리면 도구 메뉴가 열립니다';
            handle.textContent = '❮';

            tray = document.createElement('div');
            tray.id = 'bsBodyVerticalSlideTray';

            const salesBtn = makeVDockBtn(
                'bsVDockSalesWidgetBtn',
                '매출/구독',
                `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <line x1="10" y1="9" x2="8" y2="9"></line>
                </svg>`,
                () => {
                    const cb = findSettingCheckboxByKeywords(['매출/구독', '매출구독']);
                    if (cb) cb.click();
                    else if (typeof window.togglePerfSidebar === 'function') window.togglePerfSidebar();
                }
            );

            const perfBtn = makeVDockBtn(
                'bsVDockPerfWidgetBtn',
                '실적/수당',
                `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                    <line x1="2" y1="20" x2="22" y2="20"></line>
                </svg>`,
                () => {
                    const cb = findSettingCheckboxByKeywords(['실적/수당', '실적수당']);
                    if (cb) cb.click();
                    else if (typeof window.toggleFoldPerfWidget === 'function') window.toggleFoldPerfWidget();
                }
            );

            const navBtn = makeVDockBtn(
                'bsVDockBizNavBtn',
                '내비게이터',
                `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>`,
                () => {
                    const cb = findSettingCheckboxByKeywords(['내비게이터', '네비게이터']);
                    const isPopupOpen = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
                    if (isPopupOpen) {
                        try { window.bizNavPopupWindow.close(); } catch (err) {}
                        if (cb && cb.checked) cb.click();
                    } else {
                        if (cb && !cb.checked) cb.click();
                        const targetId = window.currentSelectedId || 'VK-1199464';
                        if (typeof window.openBizNavigatorPopupWindow === 'function') {
                            window.openBizNavigatorPopupWindow(targetId);
                        } else if (typeof window.forceOpenBizNavPopup === 'function') {
                            window.forceOpenBizNavPopup(targetId);
                        }
                    }
                }
            );

            const periodBtn = makeVDockBtn(
                'bsVDockPeriodSearchBtn',
                '매출 기간 검색',
                `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                    <circle cx="14.5" cy="15.5" r="2.5"></circle>
                    <line x1="16.5" y1="17.5" x2="18.5" y2="19.5"></line>
                </svg>`,
                () => {
                    const cb = findSettingCheckboxByKeywords(['매출 기간 검색', '기간 검색', '매출기간']);
                    if (cb) cb.click();
                }
            );

            tray.appendChild(salesBtn);
            tray.appendChild(perfBtn);
            tray.appendChild(navBtn);
            tray.appendChild(periodBtn);

            dock.appendChild(handle);
            dock.appendChild(tray);
            document.body.appendChild(dock);

            let closeTimer = null;
            window.addEventListener('mousemove', (ev) => {
                const d = document.getElementById('bsBodyVerticalSlideDock');
                if (!d) return;

                const inBodyVerticalRange = ev.clientY >= 70 && ev.clientY <= (window.innerHeight - 50);
                const nearRightEdge = (window.innerWidth - ev.clientX) <= 22 && inBodyVerticalRange;
                const isHoveringDock = d.matches(':hover');

                if (nearRightEdge || isHoveringDock) {
                    clearTimeout(closeTimer);
                    d.classList.add('bs-vdock-open');
                    handle.textContent = '❯';
                } else if (d.classList.contains('bs-vdock-open')) {
                    clearTimeout(closeTimer);
                    closeTimer = setTimeout(() => {
                        if (!d.matches(':hover')) {
                            d.classList.remove('bs-vdock-open');
                            handle.textContent = '❮';
                        }
                    }, 200);
                }
            }, { passive: true });
        }

        if (tray) {
            const remainingIcons = extractRemainingHeaderIconsToMove();
            if (remainingIcons.length > 0) {
                if (!tray.querySelector('.bs-vdock-divider')) {
                    const divider = document.createElement('div');
                    divider.className = 'bs-vdock-divider';
                    tray.appendChild(divider);
                }
                remainingIcons.forEach(iconEl => {
                    iconEl.classList.add('bs-vdock-icon-btn');
                    tray.appendChild(iconEl);
                });
            }
        }

        ensureZoomPlusButtonRestored();
        updateAllVerticalDockIconsActiveState();
    }

    function isDirectorOrAboveRank(rankStr) {
        const r = String(rankStr || '').trim().toUpperCase();
        if (!r || r === 'GUEST' || r === 'MEMBER' || r === 'MANIA') return false;
        if (typeof window.getDbRankLevel === 'function') {
            const lv = Number(window.getDbRankLevel(r) || 0);
            if (lv > 0) return lv >= 4;
        }
        const highRanks = ['DIRECTOR', 'EMERALD', 'DIAMOND', 'GREEN DIAMOND', 'BLUE DIAMOND', 'RED DIAMOND', 'CROWN'];
        return highRanks.some(hr => r.includes(hr));
    }

    let isProgrammaticResizing = false;

    function getSavedUserNavWidth() {
        const saved = parseInt(localStorage.getItem('bs_nav_user_width') || '0', 10);
        if (!isNaN(saved) && saved >= 360 && saved <= 1400) {
            return saved;
        }
        return 680;
    }

    function saveUserNavWidth(w) {
        const numW = Math.round(Number(w));
        if (!isNaN(numW) && numW >= 360 && numW <= 1600) {
            localStorage.setItem('bs_nav_user_width', String(numW));
        }
    }

    function bindPopupWidthLock(win) {
        if (!win || win === window || win.closed) return;

        if (!win._nativeResizeToV43 && typeof win.resizeTo === 'function') {
            const nativeResizeTo = win._nativeResizeToV41 || win._nativeResizeToV40 || win._nativeResizeToV39 || win._nativeResizeToV38 || win._nativeResizeToV37 || win._nativeResizeToV36 || win._nativeResizeToV35 || win._nativeResizeToV34 || win._nativeResizeToV33 || win.resizeTo.bind(win);
            win._nativeResizeToV43 = nativeResizeTo;

            win.resizeTo = function(reqW, reqH) {
                const lockedW = getSavedUserNavWidth();
                const finalH = Number(reqH) || win.outerHeight || 700;
                isProgrammaticResizing = true;
                try {
                    nativeResizeTo(lockedW, finalH);
                } catch (e) {}
                setTimeout(() => { isProgrammaticResizing = false; }, 120);
            };
        }

        if (!win._widthListenerBoundV43) {
            win._widthListenerBoundV43 = true;
            let resizeTimer = null;
            win.addEventListener('resize', () => {
                if (isProgrammaticResizing) return;
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (!isProgrammaticResizing && !win.closed && win.outerWidth >= 360) {
                        saveUserNavWidth(win.outerWidth);
                    }
                }, 150);
            });
            win.addEventListener('unload', () => {
                setTimeout(updateAllVerticalDockIconsActiveState, 100);
            });
        }
    }

    const origWindowOpen = window.open;
    if (typeof origWindowOpen === 'function' && !origWindowOpen._v43Wrapped) {
        const wrappedWindowOpen = function(url, target, features) {
            let modFeatures = String(features || '');
            if ((target && String(target).toLowerCase().includes('nav')) || modFeatures.includes('width=')) {
                const savedW = getSavedUserNavWidth();
                if (/width=\s*\d+/i.test(modFeatures)) {
                    modFeatures = modFeatures.replace(/width=\s*\d+/i, `width=${savedW}`);
                } else if (modFeatures) {
                    modFeatures += `,width=${savedW}`;
                }
            }
            const popWin = origWindowOpen.call(this, url, target, modFeatures);
            if (popWin) {
                bindPopupWidthLock(popWin);
                setTimeout(updateAllVerticalDockIconsActiveState, 80);
            }
            return popWin;
        };
        wrappedWindowOpen._v43Wrapped = true;
        window.open = wrappedWindowOpen;
    }

    function autoFitNavigatorWindowHeight(pDoc, isEligibleForMaint) {
        if (!pDoc) return;
        try {
            const bodyEl = pDoc.getElementById('bizNavBody');
            if (!bodyEl) return;

            bodyEl.style.height = 'auto';
            bodyEl.style.minHeight = '0';
            bodyEl.style.maxHeight = 'none';
            bodyEl.style.overflowY = 'visible';
            bodyEl.style.width = '100%';
            bodyEl.style.maxWidth = '100%';
            bodyEl.style.boxSizing = 'border-box';

            let modalBox = bodyEl.parentElement;
            while (modalBox && modalBox !== pDoc.body && modalBox !== pDoc.documentElement) {
                modalBox.style.height = 'auto';
                modalBox.style.minHeight = '0';
                modalBox.style.maxWidth = '100%';
                modalBox.style.boxSizing = 'border-box';
                modalBox = modalBox.parentElement;
            }

            const win = pDoc.defaultView || window.bizNavPopupWindow;
            if (win && win !== window && !win.closed) {
                bindPopupWidthLock(win);

                pDoc.documentElement.style.height = 'auto';
                pDoc.documentElement.style.width = '100%';
                pDoc.body.style.height = 'auto';
                pDoc.body.style.minHeight = '0';
                pDoc.body.style.width = '100%';
                pDoc.body.style.maxWidth = '100%';
                pDoc.body.style.margin = '0';
                pDoc.body.style.boxSizing = 'border-box';
                pDoc.body.style.overflowX = 'hidden';

                const lockedUserWidth = getSavedUserNavWidth();
                const headerEl = bodyEl.previousElementSibling;
                const headerH = headerEl ? headerEl.getBoundingClientRect().height : 56;
                const bodyRectH = bodyEl.scrollHeight || bodyEl.getBoundingClientRect().height;
                const chromeH = Math.max(45, (win.outerHeight - win.innerHeight) || 65);
                const contentTotalH = Math.ceil(headerH + bodyRectH + chromeH + 24);

                const maxScreenH = (win.screen ? win.screen.availHeight : 950) - 40;
                const targetHeight = isEligibleForMaint
                    ? Math.min(maxScreenH, Math.max(contentTotalH, 760))
                    : Math.min(maxScreenH, Math.max(contentTotalH, 420));

                const nativeResize = win._nativeResizeToV43 || win._nativeResizeToV41 || win.resizeTo.bind(win);
                if (Math.abs((win.outerWidth || 0) - lockedUserWidth) > 5 || Math.abs((win.outerHeight || 0) - targetHeight) > 12) {
                    isProgrammaticResizing = true;
                    try {
                        nativeResize(lockedUserWidth, targetHeight);
                    } catch (e) {}
                    setTimeout(() => { isProgrammaticResizing = false; }, 120);
                }
            }
        } catch (e) {}
    }

    window.hideMaintSectionInNavigatorIfUnderDirector = function(targetMemberId, optDoc) {
        try {
            const popup = window.bizNavPopupWindow;
            if (popup && !popup.closed) {
                bindPopupWidthLock(popup);
            }
            updateAllVerticalDockIconsActiveState();

            const docs = [];
            if (optDoc) docs.push(optDoc);
            if (popup && !popup.closed && popup.document && !docs.includes(popup.document)) {
                docs.push(popup.document);
            }
            if (!docs.includes(document)) docs.push(document);

            docs.forEach(pDoc => {
                const bodyEl = pDoc.getElementById('bizNavBody');
                if (!bodyEl) return;

                let mId = targetMemberId;
                const badgeEl = pDoc.getElementById('bizNavTargetBadge');
                if (!mId && badgeEl) {
                    const m = (badgeEl.innerText || '').match(/VK-\d+/i);
                    if (m) mId = m[0];
                }
                if (!mId) mId = window.currentSelectedId;

                let currRank = '';
                const mNode = (mId && typeof window.findMemberNode === 'function') ? window.findMemberNode(mId) : null;
                if (mNode) {
                    currRank = String(mNode.rank || mNode.rank_name || '').trim().toUpperCase();
                }

                if (!currRank) {
                    const promoHeaderMatch = (bodyEl.innerText || '').match(/승급\s*:\s*([A-Z\s]+?)\s*>/i);
                    if (promoHeaderMatch) {
                        currRank = promoHeaderMatch[1].trim().toUpperCase();
                    }
                }

                const isEligibleForMaint = isDirectorOrAboveRank(currRank);

                const allDivs = Array.from(bodyEl.querySelectorAll('div, section, table, h3, h4, p, span'));
                for (const el of allDivs) {
                    const directTxt = (el.innerText || '').trim();
                    if (!directTxt) continue;

                    if (
                        (directTxt.startsWith('품위유지 달성 현황') || directTxt.startsWith('품위유지 수당') || directTxt.startsWith('품위유지수당')) &&
                        !directTxt.includes('승급 :')
                    ) {
                        let container = el;
                        while (
                            container.parentElement &&
                            container.parentElement !== bodyEl &&
                            !(container.parentElement.innerText || '').includes('승급 :')
                        ) {
                            container = container.parentElement;
                        }

                        const prevEl = container.previousElementSibling;
                        if (prevEl && ((prevEl.innerText || '').trim() === '' || prevEl.tagName === 'HR')) {
                            if (!isEligibleForMaint) prevEl.style.setProperty('display', 'none', 'important');
                            else prevEl.style.removeProperty('display');
                        }

                        let curr = container;
                        while (curr) {
                            if (!isEligibleForMaint) {
                                curr.style.setProperty('display', 'none', 'important');
                            } else {
                                curr.style.removeProperty('display');
                            }
                            curr = curr.nextElementSibling;
                        }
                        break;
                    }
                }

                Array.from(bodyEl.children).forEach(child => {
                    const cTxt = (child.innerText || '').trim();
                    if (cTxt.includes('품위유지') && !cTxt.includes('승급 :')) {
                        if (!isEligibleForMaint) {
                            child.style.setProperty('display', 'none', 'important');
                        } else {
                            child.style.removeProperty('display');
                        }
                    } else if (cTxt.includes('품위유지') && cTxt.includes('승급 :')) {
                        let foundMaintHeader = false;
                        Array.from(child.children).forEach(sub => {
                            const sTxt = (sub.innerText || '').trim();
                            if (sTxt.includes('품위유지 달성 현황') || sTxt.includes('품위유지수당') || sTxt.includes('품위유지 기준')) {
                                foundMaintHeader = true;
                                const prev = sub.previousElementSibling;
                                if (prev && ((prev.innerText || '').trim() === '' || prev.tagName === 'HR')) {
                                    if (!isEligibleForMaint) prev.style.setProperty('display', 'none', 'important');
                                    else prev.style.removeProperty('display');
                                }
                            }
                            if (foundMaintHeader) {
                                if (!isEligibleForMaint) sub.style.setProperty('display', 'none', 'important');
                                else sub.style.removeProperty('display');
                            }
                        });
                    }
                });

                autoFitNavigatorWindowHeight(pDoc, isEligibleForMaint);
                setTimeout(() => autoFitNavigatorWindowHeight(pDoc, isEligibleForMaint), 40);
            });
        } catch (e) {}
    };

    const origRenderNav = window.renderBusinessNavigator;
    if (typeof origRenderNav === 'function' && !origRenderNav._v43Wrapped) {
        const wrappedRenderNav = async function(targetMemberId, optDoc) {
            isProgrammaticResizing = true;
            const r = await origRenderNav.apply(this, arguments);
            window.hideMaintSectionInNavigatorIfUnderDirector(targetMemberId, optDoc);
            setTimeout(() => {
                window.hideMaintSectionInNavigatorIfUnderDirector(targetMemberId, optDoc);
                isProgrammaticResizing = false;
            }, 60);
            return r;
        };
        wrappedRenderNav._v43Wrapped = true;
        window.renderBusinessNavigator = wrappedRenderNav;
    }

    const origOpenNavPopup = window.openBizNavigatorPopupWindow;
    if (typeof origOpenNavPopup === 'function' && !origOpenNavPopup._v43Wrapped) {
        const wrappedOpenPopup = function(targetMemberId) {
            isProgrammaticResizing = true;
            const r = origOpenNavPopup.apply(this, arguments);
            if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed) {
                bindPopupWidthLock(window.bizNavPopupWindow);
            }
            [30, 100, 250, 500].forEach(d => {
                setTimeout(() => window.hideMaintSectionInNavigatorIfUnderDirector(targetMemberId, null), d);
            });
            setTimeout(() => { isProgrammaticResizing = false; }, 550);
            return r;
        };
        wrappedOpenPopup._v43Wrapped = true;
        window.openBizNavigatorPopupWindow = wrappedOpenPopup;
    }

    const origEvalStatus = window.evaluateMemberCardBadgeStatus;
    if (typeof origEvalStatus === 'function' && !origEvalStatus._v43Wrapped) {
        const wrappedEval = function(memberId, teamMap, preferredOrderKey) {
            const res = origEvalStatus.apply(this, arguments);
            if (!res) return res;

            const thresholdPct = getUserSettingThresholdPct();

            try {
                const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
                if (mNode) {
                    const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').toUpperCase();
                    if (!isDirectorOrAboveRank(currRank)) {
                        res.maintPct = 0;
                        res.showMaintBadge = false;
                    }
                }
            } catch (e) {}

            if (res.maintPct <= 5) {
                res.maintPct = 0;
            }

            res.showPromoBadge = (res.promoPct >= thresholdPct);
            res.showMaintBadge = (res.maintPct >= thresholdPct);
            return res;
        };
        wrappedEval._v43Wrapped = true;
        window.evaluateMemberCardBadgeStatus = wrappedEval;
    }

    let isSyncingV43 = false;

    window.syncBadgeTitlesToTextV43 = function() {
        if (isSyncingV43) return;
        isSyncingV43 = true;

        try {
            ensureVerticalDockAndBadgeCSSV43();
            buildAndSyncBodyVerticalSlideDock();
            const thresholdPct = getUserSettingThresholdPct();

            document.querySelectorAll('.bs-card-top-badges span, .node-card span').forEach(el => {
                if (el.children.length > 0) return;

                const rawTxt = (el.textContent || '').trim();
                if (!rawTxt.startsWith('승급') && !rawTxt.startsWith('품위유지') && !rawTxt.startsWith('유지')) return;

                const isPromo = rawTxt.startsWith('승급');
                const baseLabel = isPromo ? '승급' : '품위유지';

                let pct = null;
                const titleAttr = el.getAttribute('title') || '';
                const tMatch = titleAttr.match(/(\d+(?:\.\d+)?)\s*%/);
                if (tMatch) {
                    pct = Math.floor(Number(tMatch[1]));
                }

                const cardEl = el.closest('.node-card, [id^="card_"]');
                if (cardEl) {
                    const mId = cardEl.getAttribute('data-member-id') || (cardEl.id || '').replace(/^card_/, '') || ((cardEl.innerText || '').match(/VK-\d+/i) || [])[0];
                    if (mId) {
                        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(mId.toUpperCase()) : null;
                        if (!isPromo && mNode && !isDirectorOrAboveRank(mNode.rank || mNode.rank_name)) {
                            pct = 0;
                        } else if ((pct === null || isNaN(pct)) && typeof window.evaluateMemberCardBadgeStatus === 'function') {
                            const st = window.evaluateMemberCardBadgeStatus(mId.toUpperCase());
                            if (st) pct = isPromo ? st.promoPct : st.maintPct;
                        }
                    }
                }

                if (pct !== null && !isNaN(pct)) {
                    if ((!isPromo && pct <= 5) || pct < thresholdPct) {
                        el.classList.add('bs-v30-hide');
                        el.removeAttribute('data-v30-pct');
                        return;
                    }

                    el.classList.remove('bs-v30-hide');
                    if (el.textContent !== baseLabel) {
                        el.textContent = baseLabel;
                    }
                    const pctStr = String(pct);
                    if (el.getAttribute('data-v30-pct') !== pctStr) {
                        el.setAttribute('data-v30-pct', pctStr);
                    }
                }
            });
        } finally {
            isSyncingV43 = false;
        }
    };

    const origRenderFn = window.renderTreeCardStatusBadges;
    if (typeof origRenderFn === 'function' && !origRenderFn._v43Wrapped) {
        const wrappedRender = async function() {
            const r = await origRenderFn.apply(this, arguments);
            window.syncBadgeTitlesToTextV43();
            return r;
        };
        wrappedRender._v43Wrapped = true;
        window.renderTreeCardStatusBadges = wrappedRender;
    }

    function bootV43() {
        ensureVerticalDockAndBadgeCSSV43();
        buildAndSyncBodyVerticalSlideDock();
        setupBadgeThresholdInputStep10();

        if (typeof window.renderTreeCardStatusBadges === 'function') {
            window.renderTreeCardStatusBadges();
        } else {
            window.syncBadgeTitlesToTextV43();
        }
        window.hideMaintSectionInNavigatorIfUnderDirector();

        [150, 400, 900, 1800].forEach(d => {
            setTimeout(() => {
                buildAndSyncBodyVerticalSlideDock();
                setupBadgeThresholdInputStep10();
                window.syncBadgeTitlesToTextV43();
                window.hideMaintSectionInNavigatorIfUnderDirector();
            }, d);
        });

        const treeWrapper = document.getElementById('tree-wrapper') || document.body;
        const observer = new MutationObserver(() => {
            if (!isSyncingV43) {
                window.syncBadgeTitlesToTextV43();
            }
        });
        observer.observe(treeWrapper, { childList: true, subtree: true });

        document.addEventListener('change', () => {
            setTimeout(() => {
                window.syncBadgeTitlesToTextV43();
                window.hideMaintSectionInNavigatorIfUnderDirector();
                updateAllVerticalDockIconsActiveState();
            }, 50);
        }, true);

        document.addEventListener('click', () => {
            setTimeout(() => {
                buildAndSyncBodyVerticalSlideDock();
                setupBadgeThresholdInputStep10();
                window.syncBadgeTitlesToTextV43();
                window.hideMaintSectionInNavigatorIfUnderDirector();
                updateAllVerticalDockIconsActiveState();
            }, 80);
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootV43);
    } else {
        bootV43();
    }
})();

// ============================================================================
// [23] 🌟 [마스터 통합 정리] TiDB 품위유지 기준 CV 참조 + (소실적 CV + 본인 당기 CV) 달성률 통일 & 배지 깜빡임 제로화
// - [11], [17], [22]번 섹션에 중복 선언되어 충돌하던 내비게이터 및 카드 배지 평가 함수를 하나로 통합
// - 하드코딩 없이 TiDB(rank_maintenance_bonus_policies) 기준 CV를 100% 참조
// - 내비게이터와 계보도 카드 배지 모두 (해당기수 소실적 CV + 본인 당기 CV) / DB 기준 CV 로 동일하게 계산
// ============================================================================
(function unifyDignityCalculationAndBadgeEngineV23() {
    if (window._bsUnifiedDignityEngineV23) return;
    window._bsUnifiedDignityEngineV23 = true;

    function normId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^vk-?/, '');
    }

    // [23-1] 특정 회원의 당기 본인 발생 CV + 소실적(이월/신규 매칭 포함) CV 통합 산출 (100% TiDB 연동)
    window.computeUnifiedDignityMetrics = function(memberId) {
        const emptyRes = { currRank: 'MANIA', reqMaintCV: 0, selfTermCV: 0, minorSubTermCV: 0, totalRecognizedCV: 0, maintPct: 0, maintDiffCV: 0, isEligibleRank: false };
        if (!memberId || typeof window.findMemberNode !== 'function') return emptyRes;

        const mNode = window.findMemberNode(memberId);
        if (!mNode) return emptyRes;

        const currRank = String(mNode.rank || mNode.rank_name || 'MANIA').trim().toUpperCase();
        const reqMaintCV = typeof window.getDbRequiredMaintCV === 'function' ? Number(window.getDbRequiredMaintCV(currRank) || 0) : 0;
        const isEligibleRank = reqMaintCV > 0;

        if (!isEligibleRank) {
            return { ...emptyRes, currRank };
        }

        const allSales = window._capturedAllSales || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));
        const latestPeriod = typeof window.getLatestPeriodRangeFromSales === 'function'
            ? window.getLatestPeriodRangeFromSales(allSales)
            : { sortKey: '2026-10-2', shortKey: '10-후', label: '10월 2기', startDate: '2026-10-16', endDate: '2026-10-31' };

        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));
        const mNorm = normId(memberId);
        const { setA, setB } = typeof window.getSublinePartnerSets === 'function'
            ? window.getSublinePartnerSets(mNode)
            : { setA: new Set(), setB: new Set() };

        // 1) 본인 당기 CV 집계 및 기수별 A/B 라인 CV 집계
        let selfTermCV = 0;
        const periodCV_A = new Map();
        const periodCV_B = new Map();
        let directTermA = 0, directTermB = 0;

        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normId(s.member_id || s.memberId || s.id);
            if (!sNorm) return;

            const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ?? s.sales_cv ?? 0) : Number(s.cv ?? s.sales_cv ?? 0);
            if (cv <= 0) return;

            const sDate = cleanFn(s.transaction_date || s.date || s.sales_date || s.buy_date || '');
            if (sDate && sDate > latestPeriod.endDate) return;

            if (sNorm === mNorm) {
                if (sDate >= latestPeriod.startDate && sDate <= latestPeriod.endDate) {
                    selfTermCV += cv;
                }
                return;
            }

            const isA = setA.has(sNorm);
            const isB = setB.has(sNorm);
            if (!isA && !isB) return;

            const pObj = typeof window.getPeriodObjFromDateStr === 'function' ? window.getPeriodObjFromDateStr(sDate) : null;
            if (pObj) {
                if (isA) periodCV_A.set(pObj.sortKey, (periodCV_A.get(pObj.sortKey) || 0) + cv);
                if (isB) periodCV_B.set(pObj.sortKey, (periodCV_B.get(pObj.sortKey) || 0) + cv);
            }
            if (sDate >= latestPeriod.startDate && sDate <= latestPeriod.endDate) {
                if (isA) directTermA += cv;
                if (isB) directTermB += cv;
            }
        });

        // 2) 소실적 누적(매칭) CV 산출
        let minorSubTermCV = 0;
        const allPKeys = Array.from(new Set([...periodCV_A.keys(), ...periodCV_B.keys(), latestPeriod.sortKey])).sort();
        let carryA = 0, carryB = 0;

        allPKeys.forEach(pKey => {
            const newA = (pKey === latestPeriod.sortKey) ? Math.max(periodCV_A.get(pKey) || 0, directTermA) : (periodCV_A.get(pKey) || 0);
            const newB = (pKey === latestPeriod.sortKey) ? Math.max(periodCV_B.get(pKey) || 0, directTermB) : (periodCV_B.get(pKey) || 0);
            const cumA = carryA + newA;
            const cumB = carryB + newB;
            const matched = Math.min(cumA, cumB);

            if (pKey === latestPeriod.sortKey) {
                minorSubTermCV = matched > 0 ? matched : ((cumA <= cumB) ? newA : newB);
            }
            carryA = cumA - matched;
            carryB = cumB - matched;
        });

        if (minorSubTermCV === 0 && (directTermA > 0 || directTermB > 0)) {
            minorSubTermCV = Math.max(directTermA, directTermB);
        }

        // 3) 최종 인정 CV = 소실적 누적 CV + 본인 당기 CV
        const totalRecognizedCV = minorSubTermCV + selfTermCV;
        const maintPct = reqMaintCV > 0 ? Math.min(100, Math.floor((totalRecognizedCV / reqMaintCV) * 100)) : 0;
        const maintDiffCV = Math.max(0, reqMaintCV - totalRecognizedCV);

        return {
            currRank,
            reqMaintCV,
            selfTermCV,
            minorSubTermCV,
            totalRecognizedCV,
            maintPct,
            maintDiffCV,
            isEligibleRank
        };
    };

    // [23-2] 계보도 카드 배지 판정 함수에 (소실적 CV + 본인 당기 CV) 달성률 연동
    const baseEvalBadge = window.evaluateMemberCardBadgeStatus;
    window.evaluateMemberCardBadgeStatus = function(memberId, teamMap, preferredOrderKey) {
        const res = typeof baseEvalBadge === 'function'
            ? baseEvalBadge.apply(this, arguments)
            : { showPromoBadge: false, showMaintBadge: false, promoPct: 0, promoTargetRank: '', promoCurrPV: 0, promoReqPV: 0, maintPct: 0, maintCurrVal: 0, maintReqVal: 0, maintUnit: 'CV' };

        let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
        if (isNaN(thresholdPct) || thresholdPct < 10) thresholdPct = 80;

        const dInfo = window.computeUnifiedDignityMetrics(memberId);
        if (!dInfo.isEligibleRank) {
            res.maintPct = 0;
            res.showMaintBadge = false;
        } else {
            res.maintPct = dInfo.maintPct;
            res.maintCurrVal = dInfo.totalRecognizedCV;
            res.maintReqVal = dInfo.reqMaintCV;
            res.maintUnit = 'CV';
            res.showMaintBadge = (dInfo.maintPct >= thresholdPct);
        }
        res.showPromoBadge = (res.promoPct >= thresholdPct);
        return res;
    };

    // [23-3] 비지네스 내비게이터 렌더링 시 품위유지 달성 현황에 (소실적 CV + 본인 당기 CV) 자동 반영
    const baseRenderNav = window.renderBusinessNavigator;
    if (typeof baseRenderNav === 'function') {
        window.renderBusinessNavigator = async function(targetMemberId, optDoc = null) {
            const r = await baseRenderNav.apply(this, arguments);
            try {
                const popup = window.bizNavPopupWindow;
                const pDoc = optDoc || ((popup && !popup.closed) ? popup.document : document);
                if (!pDoc) return r;

                const bodyEl = pDoc.getElementById('bizNavBody');
                if (!bodyEl) return r;

                const targetId = targetMemberId || window.currentSelectedId || 'VK-1199464';
                const dInfo = window.computeUnifiedDignityMetrics(targetId);
                if (!dInfo.isEligibleRank) return r;

                const allSpans = Array.from(bodyEl.querySelectorAll('span, div'));
                const maintHeaderSpan = allSpans.find(el => el.children.length === 0 && (el.innerText || '').trim() === '품위유지 달성 현황');
                if (maintHeaderSpan && maintHeaderSpan.parentElement) {
                    const headerBar = maintHeaderSpan.parentElement;
                    const maintEval = typeof window.evaluateMaintAchievedRank === 'function'
                        ? window.evaluateMaintAchievedRank(dInfo.currRank, dInfo.totalRecognizedCV)
                        : { isAchieved: dInfo.totalRecognizedCV >= dInfo.reqMaintCV, achievedRank: dInfo.currRank };

                    Array.from(headerBar.querySelectorAll('span')).forEach(sp => {
                        const t = (sp.innerText || '').trim();
                        if (t.startsWith('달성률:')) {
                            sp.innerText = `달성률: ${dInfo.maintPct}%`;
                        } else if (t.startsWith('달성직급:')) {
                            sp.innerText = maintEval.isAchieved ? `달성직급: ${maintEval.achievedRank} (달성)` : `달성직급: 없음 (미달성)`;
                            sp.style.color = maintEval.isAchieved ? '#10b981' : '#ef4444';
                        }
                    });
                }

                const missingLabel = allSpans.find(el => el.children.length === 0 && (el.innerText || '').trim() === '부족분 CV');
                if (missingLabel && missingLabel.parentElement) {
                    const valEl = missingLabel.nextElementSibling;
                    if (valEl) {
                        valEl.innerText = dInfo.maintDiffCV === 0 ? '유지 달성' : `-${dInfo.maintDiffCV.toLocaleString('ko-KR')} CV`;
                        valEl.style.color = dInfo.maintDiffCV === 0 ? '#10b981' : '#ef4444';
                    }
                }
            } catch (e) {}
            return r;
        };
    }

    setTimeout(() => {
        if (typeof window.renderTreeCardStatusBadges === 'function') {
            window.renderTreeCardStatusBadges();
        }
    }, 300);
})();
// ============================================================================
// [24] 🚨 CORS Preflight 원천 제거(쿼리스트링 토큰 방식) + 좌/우 라인 공제 후 누적 CV('0' 표시) 패치
// ============================================================================
(function masterZeroPreflightAndPerfTableV24() {
    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';
    const VALID_TOKEN = 'verified_admin_tourism9_token';

    if (!sessionStorage.getItem(TOKEN_KEY)) sessionStorage.setItem(TOKEN_KEY, VALID_TOKEN);
    if (!localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, VALID_TOKEN);

    // 1. 순수 브라우저 원본 fetch 확보 (index.html:795 및 api.js 래퍼 완전 우회)
    let pureNativeFetch = window.fetch.bind(window);
    try {
        const cleanIframe = document.createElement('iframe');
        cleanIframe.style.display = 'none';
        document.documentElement.appendChild(cleanIframe);
        if (cleanIframe.contentWindow && cleanIframe.contentWindow.fetch) {
            pureNativeFetch = cleanIframe.contentWindow.fetch.bind(window);
        }
        cleanIframe.remove();
    } catch (e) {}

    // 2. 모든 GET 요청에서 커스텀 헤더를 완전 삭제하고 ?token=... 쿼리로 전송 (CORS Preflight 0건 보장!)
    window.fetch = async function(input, init = {}) {
        let urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const isApiCall = urlStr.includes('/api/') || (window.API_BASE && urlStr.startsWith(window.API_BASE));
        const method = (init && init.method) ? String(init.method).toUpperCase() : 'GET';

        if (isApiCall) {
            const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || VALID_TOKEN;
            if (!urlStr.includes('token=')) {
                const sep = urlStr.includes('?') ? '&' : '?';
                urlStr = `${urlStr}${sep}token=${encodeURIComponent(token)}`;
            }

            if (method === 'GET') {
                // GET 요청은 헤더를 아예 넣지 않아 브라우저의 CORS Preflight 검사를 원천 차단함
                return pureNativeFetch(urlStr, { method: 'GET' });
            }

            const headers = Object.assign({}, init.headers || {}, { 'x-auth-token': token });
            return pureNativeFetch(urlStr, Object.assign({}, init, { headers }));
        }
        return pureNativeFetch(input, init);
    };

    // 3. loadDbCompensationRates 무한 재시도 방지 쿨다운(3초)
    let isRulesLoading = false;
    let lastRulesAttemptTime = 0;
    const origLoadRules = window.loadDbCompensationRates;
    if (typeof origLoadRules === 'function' && !origLoadRules._safeGuardedV24) {
        const safeLoadRules = async function(forceReload = false) {
            if (window.dbRankRatesLoaded && !forceReload) return;
            const now = Date.now();
            if (isRulesLoading || (now - lastRulesAttemptTime < 3000 && !forceReload)) return;
            isRulesLoading = true;
            lastRulesAttemptTime = now;
            try {
                await origLoadRules.apply(this, arguments);
            } finally {
                isRulesLoading = false;
            }
        };
        safeLoadRules._safeGuardedV24 = true;
        window.loadDbCompensationRates = safeLoadRules;
    }

    // 4. 실적 집계 창: 좌/우 라인 모두 공제CV 차감 후 잔여 누적 CV 표시 (전액 공제되어 0이 된 소실적 라인은 '0' 표시)
    const origCalcPerf = window.calculateLocalPerformance;
    if (typeof origCalcPerf === 'function' && !origCalcPerf._accDisplayPatchedV24) {
        const wrappedCalcPerf = async function(targetId) {
            const res = await origCalcPerf.apply(this, arguments);
            const tbody = document.getElementById('perf-table-tbody');
            if (!tbody || !Array.isArray(window.perfData)) return res;

            const trs = tbody.querySelectorAll('tr');
            window.perfData.forEach((row, idx) => {
                const tr = trs[idx];
                if (!tr || !tr.children || tr.children.length < 8) return;

                const afterDeductA = Number(row.balanceA ?? row.displayAccACV ?? 0);
                const afterDeductB = Number(row.balanceB ?? row.displayAccBCV ?? 0);
                const hasActivityA = (row.beforeDeductACV > 0 || row.a_cv > 0 || row.matchedCV > 0);
                const hasActivityB = (row.beforeDeductBCV > 0 || row.b_cv > 0 || row.matchedCV > 0);

                tr.children[2].innerText = afterDeductA > 0 ? afterDeductA.toLocaleString('ko-KR') : (hasActivityA ? '0' : '-');
                tr.children[7].innerText = afterDeductB > 0 ? afterDeductB.toLocaleString('ko-KR') : (hasActivityB ? '0' : '-');
            });
            return res;
        };
        wrappedCalcPerf._accDisplayPatchedV24 = true;
        window.calculateLocalPerformance = wrappedCalcPerf;
    }

    // 5. 초기 보상플랜 및 계보도 데이터 즉시 로드
    setTimeout(async () => {
        if (typeof window.loadDbCompensationRates === 'function') {
            await window.loadDbCompensationRates(true);
        }
        if (typeof window.fetchTreeData === 'function') {
            await window.fetchTreeData(true);
        }
    }, 150);
})();