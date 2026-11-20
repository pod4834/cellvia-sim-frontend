// ============================================================================
// [00] 환경 감지 및 API 기본 경로 설정 (로컬 개발 3005 포트 강제 고정)
// ============================================================================
(function ensureMainJsApiBase() {
    const host = window.location.hostname;
    const isLocal = (host === '127.0.0.1' || host === 'localhost' || host === '' || window.location.protocol === 'file:');
    window.IS_LOCAL_DEV = isLocal;
    const resolvedBase = isLocal ? 'http://127.0.0.1:3005' : window.location.origin;
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

// [01-1] 계보도 초기 위치 정중앙 정렬
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

window.updateSetting = function(arg1, arg2) {
    window.cardSettings = window.cardSettings || {
        id: true, name: true, rank: true, type: true, code: true, joinDate: true,
        recName: true, recId: true, firstSales: false, lastSales: false
    };

    let settingKey = null;
    let isChecked = undefined;

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

    if (typeof window.reRenderTreeKeepViewport === 'function') {
        window.reRenderTreeKeepViewport();
    } else if (typeof window.renderTree === 'function') {
        window.renderTree(false);
    }
};

window.updateCardSetting = window.updateSetting;
window.toggleCardSetting = window.updateSetting;

// ============================================================================
// [05] 우측 위젯 체크박스 연동 및 닫기 제어
// ============================================================================
window.closeWidgetGlobal = function(e, widgetId, chkId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

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

    if (chk) chk.checked = false;

    if (typeof window.toggleWidgetGlobal === 'function') {
        window.toggleWidgetGlobal(chkId || 'chk-filter-widget', widgetId);
    } else {
        const widget = document.getElementById(widgetId) || document.querySelector(`.${widgetId}`);
        if (widget) widget.style.setProperty('display', 'none', 'important');
    }
};

window.hideInlineSalesSearchPanels = function() {
    const inlineIds = ['salesSearchWidget', 'salesSearchModal', 'periodSearchWidget', 'sales-search-panel', 'period-search-panel', 'filterWidget'];
    inlineIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });
};

window.toggleWidgetGlobal = function(chkId, widgetId) {
    let chk = document.getElementById(chkId);
    if (!chk && window.event && window.event.target && window.event.target.tagName === 'INPUT') {
        chk = window.event.target;
    }
    let isChecked = chk ? chk.checked : (window.event && window.event.target && window.event.target.checked);
    if (typeof isChecked === 'undefined') isChecked = false;

    const labelText = chk && chk.parentElement ? chk.parentElement.innerText.trim() : widgetId;
    const lowerWidgetId = String(widgetId).toLowerCase();

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

    if (lowerWidgetId.includes('perf') || labelText.includes('수당') || labelText.includes('실적')) {
        let perfW = document.getElementById('perfWidget') || document.querySelector('.perf-widget');
        if (perfW) {
            if (isChecked) perfW.style.setProperty('display', 'flex', 'important');
            else perfW.style.setProperty('display', 'none', 'important');
        }
        return;
    }

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
// [06] 입력 포맷 유틸리티 (MMDD -> YYYY-MM-DD 변환, VK/VJ 자동부여, 매출일 자동 검색)
// ============================================================================
window.getTodayString = function() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

window.formatVKId = function(inputEl) {
    if (!inputEl) return;
    const isVj = (window.currentCanvasMode === 'vj');
    let raw = String(inputEl.value || '').trim().toUpperCase();
    let val = raw.replace(/[^0-9]/g, '');

    if (val) {
        inputEl.value = isVj ? `VJ-${val.padStart(3, '0')}` : `VK-${val}`;
    } else {
        inputEl.value = '';
    }

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

window.getSalesDatesFromHistory = function(memberId, fallbackJoinDate = '') {
    if (!memberId) return { first: fallbackJoinDate, last: fallbackJoinDate, hasHistory: false };
    const normTarget = String(memberId).trim().toLowerCase().replace(/^v[kj]-?/, '');

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
        const itemMid = String(item.member_id || item.memberId || item.id || '').trim().toLowerCase().replace(/^v[kj]-?/, '');
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
                                <option value="GUEST" selected>GUEST</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="MANIA">MANIA</option>
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

window.submitAddPartner = async function() {
    const newId = document.getElementById('m-member-id')?.value.trim();
    const newName = document.getElementById('m-name')?.value.trim();
    const rank = document.getElementById('m-rank')?.value || 'GUEST';
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

window.addTreeChild = function(e, sponsorId, position) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    window.addPartnerState.sponsorId = sponsorId;
    window.addPartnerState.position = position;
    window.addPartnerState.isAddingParent = false;

    const modal = document.getElementById('addPartnerModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('m-spon-id').value = sponsorId;
        document.getElementById('m-member-id').value = (window.currentCanvasMode === 'vj' && typeof window.getNextVjAutoId === 'function') ? window.getNextVjAutoId() : '';
        document.getElementById('m-name').value = '';
        document.getElementById('m-rec-id').value = '';
        document.getElementById('m-rec-name').value = '';

        const posSelect = document.getElementById('m-pos');
        if (posSelect) posSelect.value = (position === 'left' || position === 'A라인') ? posSelect.options[0].value : posSelect.options[1].value;

        const today = window.getTodayString();
        ['m-join-date', 'm-first-date', 'm-last-date'].forEach(id => {
            let el = document.getElementById(id);
            if (el) el.value = today;
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
        document.getElementById('m-member-id').value = (window.currentCanvasMode === 'vj' && typeof window.getNextVjAutoId === 'function') ? window.getNextVjAutoId() : '';
        document.getElementById('m-name').value = '';
        document.getElementById('m-rec-id').value = '';
        document.getElementById('m-rec-name').value = '';

        const today = window.getTodayString();
        ['m-join-date', 'm-first-date', 'm-last-date'].forEach(id => {
            let el = document.getElementById(id);
            if (el) el.value = today;
        });
        if (typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
    }
};

window.ensureFrontLayerStyle = function() {
    if (document.getElementById('widget-front-layer-style')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'widget-front-layer-style';
    styleEl.innerHTML = `
        #filterWidget.is-front-widget,
        #perfWidget.is-front-widget {
            z-index: 2147483600 !important;
        }
        #filterWidget.is-back-widget,
        #perfWidget.is-back-widget {
            z-index: 900 !important;
        }
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

window.getSalesMemberLine = function(memberId) {
    if (!memberId) return '-';
    const targetNorm = String(memberId).trim().toLowerCase().replace(/^v[kj]-?/, '');

    let baseNode = window.currentSelectedId ? window.findMemberNode(window.currentSelectedId) : null;
    if (!baseNode && window.treeData) {
        baseNode = Array.isArray(window.treeData) ? window.treeData[0] : window.treeData;
    }

    if (baseNode && baseNode.id) {
        const baseNorm = String(baseNode.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
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

window.initFilterWidget = function() {
    window.bindWidgetFrontEvents();
    if (document.getElementById('filterWidget')) return;

    const savedH = parseInt(localStorage.getItem('filterWidgetSavedHeight') || '420', 10);
    const initialHeight = (!isNaN(savedH) && savedH >= 240) ? Math.min(savedH, window.innerHeight - 60) : 420;

    const widgetHTML = `
        <div id="filterWidget" class="widget filter-widget is-front-widget" style="display: none; flex-direction: column; position: fixed; top: 100px; right: 20px; width: 510px; min-width: 510px; max-width: 510px; height: ${initialHeight}px; min-height: 240px; max-height: 88vh; box-sizing: border-box !important; resize: none !important; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: #fff; z-index: 2147483600 !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden;">
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-bottom: 1px solid #374151; cursor: move; box-sizing: border-box; user-select: none; flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; color: #60a5fa;">
                    <span>🔍</span>
                    <span>매출 기간 검색</span>
                </div>
                <button class="icon-btn-mac close" onclick="window.closeWidgetGlobal(event, 'filterWidget', 'chk-filter-widget')" title="닫기">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
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
            <div id="filter-resize-handle" title="위아래로 드래그하여 창 높이를 조절하세요 (높이 자동 기억)" style="height: 12px; background: #111827; border-top: 1px solid #374151; cursor: ns-resize; display: flex; align-items: center; justify-content: center; flex-shrink: 0; user-select: none;">
                <div style="width: 36px; height: 3px; background: #4b5563; border-radius: 2px;"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
};

window.filterCurrentRows = [];
window.filterRowClickTimer = null;

window.toggleFilterRowSelect = function(event, idx) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const row = window.filterCurrentRows[idx];
    if (!row) return;
    row.state = (row.state === 'selected') ? 'none' : 'selected';
    window.renderFilterRowsAndTotals();
};

window.handleFilterRowDblClick = function(event, idx) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (window.filterRowClickTimer) { clearTimeout(window.filterRowClickTimer); window.filterRowClickTimer = null; }
    const row = window.filterCurrentRows[idx];
    if (!row) return;
    row.state = (row.state === 'excluded') ? 'none' : 'excluded';
    window.renderFilterRowsAndTotals();
};

window.handleFilterRowSingleClick = function(event, memberId) {
    if (window.filterRowClickTimer) clearTimeout(window.filterRowClickTimer);
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
    const targetSumRows = hasSelection ? selectedRows : rows.filter(r => r.state !== 'excluded');

    let sumCv = 0, sumPv = 0;
    targetSumRows.forEach(r => { sumCv += r.cv; sumPv += r.pv; });

    let rowsHtml = '';
    rows.forEach((r, idx) => {
        const isSelected = r.state === 'selected';
        const isExcluded = r.state === 'excluded';
        let boxHtml = isSelected
            ? `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: #3b82f6; border: 1px solid #60a5fa; color: #fff; font-size: 11px; font-weight: bold; line-height: 15px; text-align: center;">✓</div>`
            : (isExcluded
                ? `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #ef4444; font-size: 11px; font-weight: bold; line-height: 15px; text-align: center;">✕</div>`
                : `<div style="width: 16px; height: 16px; margin: 0 auto; border-radius: 3px; background: #1f2937; border: 1px solid #4b5563;"></div>`);

        const rowBg = isSelected ? 'rgba(59, 130, 246, 0.16)' : (isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'transparent');
        const textDeco = isExcluded ? 'line-through' : 'none';
        const rowOpacity = isExcluded ? '0.45' : '1';

        rowsHtml += `
            <tr onclick="window.handleFilterRowSingleClick(event, '${r.mId}')"
                ondblclick="window.handleFilterRowDblClick(event, ${idx})"
                style="border-bottom: 1px solid #1f2937; cursor: pointer; background: ${rowBg}; text-decoration: ${textDeco}; opacity: ${rowOpacity};">
                <td onclick="window.toggleFilterRowSelect(event, ${idx})" style="padding: 6px 2px; text-align: center; cursor: pointer;">${boxHtml}</td>
                <td style="padding: 6px 4px; color: #d1d5db; text-align: center;">${r.dStr}</td>
                <td style="padding: 6px 4px; color: #60a5fa; font-weight: bold; text-align: center;">${r.mId}</td>
                <td style="padding: 6px 4px; color: #fff; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.mName}</td>
                <td style="padding: 6px 4px; color: ${r.lineColor}; font-weight: bold; text-align: center;">${r.lineLabel}</td>
                <td style="padding: 6px 6px; color: #60a5fa; font-weight: bold; text-align: right;">${r.cv.toLocaleString('ko-KR')}</td>
                <td style="padding: 6px 6px; color: #10b981; font-weight: bold; text-align: right;">${r.pv.toLocaleString('ko-KR')}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
    if (summaryEl && summaryEl.firstElementChild) {
        summaryEl.firstElementChild.innerText = hasSelection
            ? `선택 합계: ${selectedRows.length}건 (전체 ${rows.length}건)`
            : `검색 결과: ${targetSumRows.length}건`;
    }
    if (totalCvEl) totalCvEl.innerText = `총 ${sumCv.toLocaleString('ko-KR')} CV`;
    if (totalPvEl) totalPvEl.innerText = `총 ${sumPv.toLocaleString('ko-KR')} PV`;
};

window.searchPeriodSales = function() {
    window.bindWidgetFrontEvents();
    const tbody = document.getElementById('filter-sales-tbody');
    if (!tbody) return;
    window.renderFilterRowsAndTotals();
};

// ============================================================================
// [08] 보너스 내역 팝업 모달창 제어
// ============================================================================
window.matchingEditState = {
    targetId: '', termLabel: '', periodKey: '', startDate: '', endDate: '', memberHistRank: '', rows: []
};

window.closeBonusDetailModal = function() {
    const modal = document.getElementById('bonusDetailModal');
    if (modal) modal.style.display = 'none';
};

window.initBonusModalResizeAndMemory = function() {
    const modal = document.getElementById('bonusDetailModal');
    if (!modal) return;

    modal.style.setProperty('box-sizing', 'border-box', 'important');
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

    if (modal.dataset.resizeBound === 'true') return;
    modal.dataset.resizeBound = 'true';

    let resizeMode = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    const rightHandle = document.createElement('div');
    rightHandle.style.cssText = 'position:absolute; top:40px; right:0; width:8px; height:calc(100% - 40px); cursor:ew-resize; z-index:100;';
    const bottomHandle = document.createElement('div');
    bottomHandle.style.cssText = 'position:absolute; bottom:0; left:0; width:100%; height:8px; cursor:ns-resize; z-index:100;';
    const cornerHandle = document.createElement('div');
    cornerHandle.style.cssText = 'position:absolute; bottom:0; right:0; width:16px; height:16px; cursor:nwse-resize; z-index:101; display:flex; align-items:flex-end; justify-content:flex-end; padding:2px; box-sizing:border-box;';
    cornerHandle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#60a5fa" stroke-width="1.5"><line x1="9" y1="1" x2="1" y2="9"></line><line x1="9" y1="5" x2="5" y2="9"></line></svg>`;

    modal.appendChild(rightHandle);
    modal.appendChild(bottomHandle);
    modal.appendChild(cornerHandle);

    const startResize = (e, mode) => {
        e.preventDefault(); e.stopPropagation();
        resizeMode = mode;
        startX = e.clientX; startY = e.clientY;
        startW = parseFloat(modal.style.width) || modal.offsetWidth;
        startH = parseFloat(modal.style.height) || modal.offsetHeight;
        document.body.style.userSelect = 'none';
    };

    rightHandle.addEventListener('mousedown', (e) => startResize(e, 'w'));
    bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'h'));
    cornerHandle.addEventListener('mousedown', (e) => startResize(e, 'wh'));

    window.addEventListener('mousemove', (e) => {
        if (!resizeMode) return;
        if (resizeMode === 'w' || resizeMode === 'wh') {
            modal.style.width = `${Math.round(Math.max(560, Math.min(window.innerWidth - 30, startW + (e.clientX - startX))))}px`;
        }
        if (resizeMode === 'h' || resizeMode === 'wh') {
            modal.style.height = `${Math.round(Math.max(320, Math.min(window.innerHeight - 30, startH + (e.clientY - startY))))}px`;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!resizeMode) return;
        resizeMode = null;
        document.body.style.userSelect = '';
        localStorage.setItem('bs_bonus_modal_width', String(Math.round(parseFloat(modal.style.width) || modal.offsetWidth)));
        localStorage.setItem('bs_bonus_modal_height', String(Math.round(parseFloat(modal.style.height) || modal.offsetHeight)));
    });
};

window.formatMatchingPartnerInputId = function(inputEl) {
    if (!inputEl) return;
    const isVj = (window.currentCanvasMode === 'vj');
    let raw = String(inputEl.value || '').toUpperCase().replace(/[^0-9A-Z-]/g, '');
    let digits = raw.replace(/^V[KJ]-?/, '').replace(/[^0-9]/g, '');
    if (digits.length > 0) {
        inputEl.value = isVj ? `VJ-${digits.padStart(3, '0')}` : `VK-${digits}`;
    } else {
        inputEl.value = isVj ? 'VJ-' : 'VK-';
    }
};

window.loadMatchingOverridesForTarget = async function(targetId) {
    if (!targetId) return {};
    const normTarget = String(targetId).trim().toUpperCase();
    const localKey = `bs_matching_overrides_${normTarget}`;
    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : 'GUEST';
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

window.lookupPartnerForMatchingRow = function(idx, rawInputId) {
    const st = window.matchingEditState;
    if (!st || !st.rows[idx]) return;

    const isVj = (window.currentCanvasMode === 'vj');
    let cleanId = String(rawInputId || '').trim().toUpperCase();
    const digits = cleanId.replace(/^V[KJ]-?/, '').replace(/[^0-9]/g, '');
    if (digits) cleanId = isVj ? `VJ-${digits.padStart(3, '0')}` : `VK-${digits}`;

    const row = st.rows[idx];
    row.member_id = cleanId;

    if (!digits) {
        row.name = '-'; row.rank = '-'; row.teamBonus = 0; row.matchingAmount = 0;
        window.renderMatchingEditorTable();
        return;
    }

    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : 'GUEST';
    const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(cleanId) : null;
    const normId = digits.toLowerCase();

    const teamMap = window.lastAllMembersTeamBonusMap instanceof Map ? window.lastAllMembersTeamBonusMap : null;
    const partnerPeriodMap = teamMap ? (teamMap.get(normId) || teamMap.get(cleanId.toLowerCase())) : null;
    const periodInfo = (partnerPeriodMap && st.periodKey) ? partnerPeriodMap[st.periodKey] : null;

    row.name = mNode ? (mNode.name || '-') : '-';
    row.rank = periodInfo && periodInfo.historicalRank ? periodInfo.historicalRank : (mNode ? (mNode.rank || baseRank) : baseRank);
    row.teamBonus = periodInfo && typeof periodInfo.teamBonus === 'number' ? periodInfo.teamBonus : 0;

    const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(st.memberHistRank) : {};
    const genNum = Number(row.gen || 1);
    row.rate = genNum > 0 ? (myMatchRates[genNum] || 0) : 0;
    row.matchingAmount = Math.floor((row.teamBonus || 0) * row.rate);

    window.renderMatchingEditorTable();
};

window.changeMatchingRowGen = function(idx, newGenVal) {
    const st = window.matchingEditState;
    if (!st || !st.rows[idx]) return;
    const genNum = parseInt(newGenVal, 10) || 0;
    const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(st.memberHistRank) : {};
    const row = st.rows[idx];
    row.gen = genNum;
    row.genLabel = genNum > 0 ? `${genNum}세대` : '제외';
    row.rate = genNum > 0 ? (myMatchRates[genNum] || 0) : 0;
    row.matchingAmount = genNum > 0 ? Math.floor((row.teamBonus || 0) * row.rate) : 0;
    window.renderMatchingEditorTable();
};

window.addMatchingEditorRow = function() {
    const st = window.matchingEditState;
    if (!st) return;
    const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(st.memberHistRank) : {};
    const isVj = (window.currentCanvasMode === 'vj');
    st.rows.push({
        gen: 1, rawGen: 1, genLabel: '1세대',
        member_id: isVj ? 'VJ-' : 'VK-', name: '-', rank: '-',
        teamBonus: 0, rate: myMatchRates[1] || 0, matchingAmount: 0, isNewRow: true
    });
    window.renderMatchingEditorTable();
};

window.removeMatchingEditorRow = function(idx) {
    const st = window.matchingEditState;
    if (!st || !Array.isArray(st.rows)) return;
    st.rows.splice(idx, 1);
    window.renderMatchingEditorTable();
};

window.renderMatchingEditorTable = function() {
    const tbodyEl = document.getElementById('b-detail-tbody');
    if (!tbodyEl) return;

    const st = window.matchingEditState;
    const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(st.memberHistRank) : {};

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
            const rawGenHint = (item.rawGen && item.rawGen !== genNum) ? `<div style="color:#9ca3af; font-size:9.5px;">(원 ${item.rawGen}대)</div>` : '';

            let genOptionsHtml = `<option value="0" ${genNum === 0 ? 'selected' : ''}>제외(0%)</option>`;
            for (let g = 1; g <= 5; g++) {
                const gRate = myMatchRates[g] || 0;
                const gPct = (gRate * 100).toFixed(1).replace(/\.0$/, '');
                genOptionsHtml += `<option value="${g}" ${genNum === g ? 'selected' : ''}>${g}세대 (${gPct}%)</option>`;
            }

            rowsHtml += `
                <tr style="border-bottom:1px solid #374151; ${genNum === 0 ? 'opacity:0.45;' : ''}">
                    <td style="padding:5px 4px; text-align:center;">
                        <select onchange="window.changeMatchingRowGen(${idx}, this.value)" style="background:#111827; border:1px solid #4b5563; color:#fbbf24; font-weight:bold; border-radius:4px; padding:3px 4px; font-size:11px; cursor:pointer;">${genOptionsHtml}</select>
                        ${rawGenHint}
                    </td>
                    <td style="padding:5px 4px; text-align:center;">
                        <input type="text" class="match-partner-id-input" value="${item.member_id || 'VK-'}" oninput="window.formatMatchingPartnerInputId(this)" onblur="window.lookupPartnerForMatchingRow(${idx}, this.value)" onkeydown="if(event.key==='Enter'){ this.blur(); }" style="width:92px; text-align:center; background:#111827; border:1px solid #4b5563; color:#60a5fa; font-weight:bold; padding:4px; border-radius:4px; font-size:11px;">
                    </td>
                    <td style="padding:5px 4px; color:#fff; font-weight:bold; text-align:center;">${item.name || '-'}</td>
                    <td style="padding:5px 4px; color:#10b981; font-weight:bold; text-align:center;">${item.rank || '-'}</td>
                    <td style="padding:5px 6px; color:#60a5fa; font-weight:bold; text-align:right;">${(item.teamBonus || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:5px 4px; color:#f59e0b; font-weight:bold; text-align:center;">${rateStr}</td>
                    <td style="padding:5px 6px; color:#10b981; font-weight:bold; text-align:right;">${(item.matchingAmount || 0).toLocaleString('ko-KR')} 원</td>
                    <td style="padding:5px 4px; text-align:center;"><button onclick="window.removeMatchingEditorRow(${idx})" style="background:transparent; border:none; color:#ef4444; font-weight:bold; font-size:14px; cursor:pointer;">✕</button></td>
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
                    <button onclick="window.addMatchingEditorRow()" style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">+ 파트너 행 추가</button>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.resetMatchingOverrideToAuto()" style="background:#4b5563; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11.5px; cursor:pointer;">🔄 자동계산 복원</button>
                        <button onclick="window.saveMatchingOverridesToDB()" style="background:#10b981; color:#fff; border:none; padding:6px 14px; border-radius:4px; font-size:11.5px; font-weight:bold; cursor:pointer;">💾 TiDB 저장 및 시뮬레이터 반영</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
    tbodyEl.innerHTML = rowsHtml;
};

window.saveMatchingOverridesToDB = async function() {
    const st = window.matchingEditState;
    if (!st || !st.targetId || !st.periodKey) return;
    const validRows = (st.rows || []).filter(r => String(r.member_id || '').replace(/[^0-9]/g, '').length > 0 && Number(r.gen) > 0);
    const normTarget = String(st.targetId).trim().toUpperCase();
    const localKey = `bs_matching_overrides_${normTarget}`;

    let savedMap = {};
    try { savedMap = JSON.parse(localStorage.getItem(localKey) || '{}'); } catch (e) {}
    savedMap[st.periodKey] = validRows.map(r => ({ ...r, isManualOverride: true }));
    localStorage.setItem(localKey, JSON.stringify(savedMap));

    window.cachedMatchingOverrides = window.cachedMatchingOverrides || {};
    window.cachedMatchingOverrides[normTarget] = savedMap;

    if (window.API_BASE) {
        try {
            await fetch(`${window.API_BASE}/api/matching-overrides`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_member_id: normTarget, period_key: st.periodKey, period_label: st.termLabel, rows: validRows })
            });
        } catch (err) {}
    }

    if (typeof window.calculateLocalPerformance === 'function') {
        await window.calculateLocalPerformance(st.targetId);
    }
    alert(`✅ [${st.termLabel}] 추천매칭보너스 편집 내역이 저장되어 시뮬레이터에 반영되었습니다.`);
};

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
            await fetch(`${window.API_BASE}/api/matching-overrides?targetId=${encodeURIComponent(normTarget)}&periodKey=${encodeURIComponent(st.periodKey)}`, { method: 'DELETE' });
        } catch (err) {}
    }

    if (typeof window.calculateLocalPerformance === 'function') {
        await window.calculateLocalPerformance(st.targetId);
    }
    window.openBonusDetailModal(st.targetId, st.termLabel, st.startDate, st.endDate, 'matchBonus');
};

window.openBonusDetailModal = function(targetId, termLabel, startDate, endDate, bonusType) {
    const modal = document.getElementById('bonusDetailModal');
    const summaryEl = document.getElementById('b-detail-summary');
    const logicEl = document.getElementById('b-detail-logic');
    const theadEl = document.getElementById('b-detail-thead');
    const tbodyEl = document.getElementById('b-detail-tbody');
    if (!modal || !summaryEl || !tbodyEl) return;

    if (typeof window.initBonusModalResizeAndMemory === 'function') window.initBonusModalResizeAndMemory();

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
            recDetails: [], matchingDetails: [], details: [],
            levelBonus: 0, carBonus: 0, fastPowerBonus: 0, directBonus: 0, teamBonus: 0, matchingBonus: 0
        };
    }

    const baseRank = typeof window.getBaseBusinessRankName === 'function' ? window.getBaseBusinessRankName() : 'GUEST';
    const memberHistRank = pRec.historicalRank || pRec.appliedMatchRank || member.rank || baseRank;

    let bonusTitle = '', logicText = '', theadHtml = '', rowsHtml = '';
    let colCount = 6;

    if (bonusType === 'recBonus') {
        colCount = 7;
        const recRate = pRec.appliedRecRate !== undefined ? pRec.appliedRecRate : window.getDirectBonusRate(memberHistRank);
        const ratePct = (recRate * 100).toFixed(1).replace(/\.0$/, '');
        bonusTitle = '추천수당 (Direct Bonus)';
        logicText = `💡 <b>계산 로직:</b> 선택 회원(<b>${member.name}</b> / <b>${termLabel} 당시 직급: ${memberHistRank}</b>)이 추천한 파트너의 당기 매출 CV × DB 요율(<b>${ratePct}%</b>)`;
        theadHtml = `<tr><th style="padding:6px; text-align:center;">매출일자</th><th style="padding:6px; text-align:center;">추천파트너 ID</th><th style="padding:6px; text-align:center;">파트너 이름</th><th style="padding:6px; text-align:center;">당시 직급</th><th style="padding:6px; text-align:right;">당기 발생 CV</th><th style="padding:6px; text-align:center;">DB 요율</th><th style="padding:6px; text-align:right;">산출 추천수당</th></tr>`;
        if (pRec.recDetails && pRec.recDetails.length > 0) {
            pRec.recDetails.forEach(det => {
                rowsHtml += `<tr style="border-bottom:1px solid #374151;"><td style="padding:6px; color:#d1d5db; text-align:center;">${det.date || '-'}</td><td style="padding:6px; color:#60a5fa; font-weight:bold; text-align:center;">${det.member_id}</td><td style="padding:6px; color:#fff; font-weight:bold; text-align:center;">${det.name || '-'}</td><td style="padding:6px; color:#d1d5db; text-align:center;">${det.rank || '-'}</td><td style="padding:6px; color:#fff; font-weight:bold; text-align:right;">${(det.cv || 0).toLocaleString('ko-KR')} CV</td><td style="padding:6px; color:#f59e0b; text-align:center;">${((det.rate || 0) * 100).toFixed(1).replace(/\.0$/, '')}%</td><td style="padding:6px; color:#10b981; font-weight:bold; text-align:right;">${(det.bonus || 0).toLocaleString('ko-KR')} 원</td></tr>`;
            });
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

        bonusTitle = '지원수당 (Team / Sponsor Bonus)';
        logicText = `💡 <b>계산 로직:</b> 소실적 공제 CV(<b>${matchedCV.toLocaleString('ko-KR')} CV</b>) × 본인 <b>${termLabel} 당시 직급(${memberHistRank})</b> DB 요율(<b>${ratePct}%</b>)`;
        theadHtml = `<tr><th style="padding:6px; text-align:center;">구분</th><th style="padding:6px; text-align:right;">전기수 누적 CV</th><th style="padding:6px; text-align:right;">이번기수 신규 CV</th><th style="padding:6px; text-align:right;">공제전 누적합산</th><th style="padding:6px; text-align:right;">공제 CV</th><th style="padding:6px; text-align:right;">누적 CV (공제후)</th></tr>`;
        rowsHtml += `
            <tr style="border-bottom:1px solid #374151;"><td style="padding:6px; text-align:center; font-weight:bold; color:#60a5fa;">A라인</td><td style="padding:6px; text-align:right; color:#9ca3af;">${prevCarryA.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#fff; font-weight:bold;">+${(pRec.a_cv || 0).toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#fbbf24; font-weight:bold;">${beforeA.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#ef4444; font-weight:bold;">-${matchedCV.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#10b981; font-weight:bold;">${(pRec.displayAccACV || 0).toLocaleString('ko-KR')}</td></tr>
            <tr style="border-bottom:2px solid #374151;"><td style="padding:6px; text-align:center; font-weight:bold; color:#10b981;">B라인</td><td style="padding:6px; text-align:right; color:#9ca3af;">${prevCarryB.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#fff; font-weight:bold;">+${(pRec.b_cv || 0).toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#fbbf24; font-weight:bold;">${beforeB.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#ef4444; font-weight:bold;">-${matchedCV.toLocaleString('ko-KR')}</td><td style="padding:6px; text-align:right; color:#10b981; font-weight:bold;">${(pRec.displayAccBCV || 0).toLocaleString('ko-KR')}</td></tr>
        `;
    } else if (bonusType === 'matchBonus') {
        const myMatchRates = typeof window.getMatchingBonusRates === 'function' ? window.getMatchingBonusRates(memberHistRank) : {};
        const rateSummary = Object.entries(myMatchRates).filter(([, r]) => r > 0).map(([g, r]) => `${g}세대 ${(r * 100).toFixed(1).replace(/\.0$/, '')}%`).join(', ') || '적용 요율 없음';
        bonusTitle = '추천매칭보너스 (Matching Bonus)';
        logicText = `💡 <b>계산 로직 (본인 ${termLabel} 당시 직급: <span style="color:#10b981;">${memberHistRank}</span> / DB 매칭요율: ${rateSummary})</b>`;
        theadHtml = `<tr><th style="padding:6px; text-align:center;">적용 세대(편집)</th><th style="padding:6px; text-align:center;">파트너 ID</th><th style="padding:6px; text-align:center;">파트너 이름</th><th style="padding:6px; text-align:center;">당시 직급</th><th style="padding:6px; text-align:right;">파트너 지원수당</th><th style="padding:6px; text-align:center;">DB 매칭요율</th><th style="padding:6px; text-align:right;">산출 매칭보너스</th><th style="padding:6px; text-align:center; width:36px;">삭제</th></tr>`;
        window.matchingEditState = {
            targetId: member.id, termLabel: termLabel || pRec.periodLabel || '-',
            periodKey: pRec.sortOrderKey || '', startDate: startDate || pRec.startDate || '',
            endDate: endDate || pRec.endDate || '', memberHistRank: memberHistRank,
            rows: Array.isArray(pRec.matchingDetails) ? pRec.matchingDetails.map(x => ({ ...x })) : []
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
        const condText = reqCv > 0 ? `당기 소실적 CV ${reqCv.toLocaleString('ko-KR')} 이상` : '해당 직급 유지';
        bonusTitle = '품위유지수당 (Maintenance Bonus)';
        logicText = `💡 <b>계산 로직:</b> 본인 <b>${termLabel} 당시 직급(${memberHistRank})</b> 기준 지급 조건(<b>${condText}</b>) 충족 시 지급`;
        theadHtml = `<tr><th style="padding:6px; text-align:center;">대상 기수</th><th style="padding:6px; text-align:center;">당시 직급</th><th style="padding:6px; text-align:right;">당기 소실적 CV</th><th style="padding:6px; text-align:center;">DB 지급 기준</th><th style="padding:6px; text-align:right;">지급 품위유지수당</th></tr>`;
        rowsHtml = `<tr style="border-bottom:1px solid #374151;"><td style="padding:8px; text-align:center; color:#60a5fa; font-weight:bold;">${termLabel || pRec.periodLabel || '-'}</td><td style="padding:8px; text-align:center; color:#10b981; font-weight:bold;">${memberHistRank}</td><td style="padding:8px; text-align:right; color:#fff; font-weight:bold;">${(pRec.matchedCV || 0).toLocaleString('ko-KR')} CV</td><td style="padding:8px; text-align:center; color:#f59e0b;">${condText}</td><td style="padding:8px; text-align:right; color:#fbbf24; font-weight:bold;">${(pRec.levelBonus || 0).toLocaleString('ko-KR')} 원</td></tr>`;
    } else if (bonusType === 'carBonus') {
        colCount = 6;
        bonusTitle = '차량유지비 (Car Maintenance Bonus)';
        logicText = `💡 <b>계산 로직:</b> 당월 전기수와 후기수 연속 조건 달성 시 지급`;
        theadHtml = `<tr><th colspan="6" style="padding:6px; text-align:center;">차량유지비 지급 내역</th></tr>`;
        rowsHtml = `<tr><td colspan="6" style="padding:12px; text-align:center; color:#fbbf24; font-weight:bold;">${(pRec.carBonus || 0).toLocaleString('ko-KR')} 원</td></tr>`;
    } else if (bonusType === 'fastPowerBonus') {
        colCount = 6;
        bonusTitle = '패스트파워보너스 (Fast Power Bonus)';
        logicText = `💡 <b>계산 로직:</b> 전월 Step 1·2·3 달성 내역 기준 익월 전기수에 지급`;
        theadHtml = `<tr><th colspan="6" style="padding:6px; text-align:center;">지급 패스트파워보너스</th></tr>`;
        rowsHtml = `<tr><td colspan="6" style="padding:10px; text-align:center; color:#10b981; font-weight:bold;">${(pRec.fastPowerBonus || 0).toLocaleString('ko-KR')} 원</td></tr>`;
    }

    summaryEl.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><span style="color:#9ca3af;">대상 회원:</span> <strong style="color:#fff;">${member.name} (${member.id})</strong> | <span style="color:#9ca3af;">당시 직급:</span> <strong style="color:#10b981;">${memberHistRank}</strong> | <span style="color:#9ca3af;">기수:</span> <strong style="color:#60a5fa;">${termLabel || pRec.periodLabel || '-'}</strong></div><div><span style="color:#9ca3af;">항목:</span> <strong style="color:#fbbf24;">${bonusTitle}</strong></div></div>`;
    logicEl.innerHTML = logicText;
    theadEl.innerHTML = theadHtml;
    tbodyEl.innerHTML = rowsHtml || `<tr><td colspan="${colCount}" style="padding:20px; color:#9ca3af; text-align:center;">산출된 보너스 상세 내역이 없습니다.</td></tr>`;

    modal.style.display = 'flex';
    modal.style.setProperty('z-index', '2147483645', 'important');
};

// ============================================================================
// [09] 계보도 핵심 로직 (VK- 및 VJ- 접두어 완벽 호환 트리 렌더링 & 동적 코드 산정)
// ============================================================================
window.isSameMemberId = function(id1, id2) {
    if (!id1 || !id2) return false;
    const s1 = String(id1).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
    const s2 = String(id2).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
    return s1 === s2 || String(id1).trim().toLowerCase() === String(id2).trim().toLowerCase();
};

window.getFlatMembers = function() {
    const map = {};
    const visited = new Set();
    function flatten(node) {
        if (!node || !node.id) return;
        let rawId = String(node.id).trim();
        let norm = rawId.toLowerCase().replace(/^v[kj]-?/, '');
        if (visited.has(rawId.toUpperCase())) return;
        visited.add(rawId.toUpperCase());

        map[rawId] = node;
        map[rawId.toUpperCase()] = node;
        map[norm] = node;
        map['VK-' + norm] = node;
        map['VJ-' + norm] = node;
        if (/^\d+$/.test(norm)) {
            map['VJ-' + norm.padStart(3, '0')] = node;
        }

        if (node.left) flatten(typeof node.left === 'object' ? node.left : map[node.left]);
        if (node.right) flatten(typeof node.right === 'object' ? node.right : map[node.right]);
    }
    if (window.treeData) flatten(window.treeData);
    window.flatMembersData = map;
    return map;
};

window.getUniqueMembers = function() {
    const flatMap = window.getFlatMembers();
    const uniqueMap = new Map();
    Object.values(flatMap).forEach(m => {
        if (m && m.id) {
            let key = String(m.id).trim().toUpperCase();
            if (!uniqueMap.has(key)) uniqueMap.set(key, m);
        }
    });
    return Array.from(uniqueMap.values());
};

window.findMemberNode = function(id) {
    if (!id) return null;
    const flatMap = window.getFlatMembers();
    const clean = String(id).trim();
    if (flatMap[clean]) return flatMap[clean];
    if (flatMap[clean.toUpperCase()]) return flatMap[clean.toUpperCase()];

    let norm = clean.toLowerCase().replace(/^v[kj]-?/, '');
    if (flatMap[norm]) return flatMap[norm];
    if (flatMap['VK-' + norm]) return flatMap['VK-' + norm];
    if (flatMap['VJ-' + norm]) return flatMap['VJ-' + norm];
    if (/^\d+$/.test(norm) && flatMap['VJ-' + norm.padStart(3, '0')]) {
        return flatMap['VJ-' + norm.padStart(3, '0')];
    }
    return Object.values(flatMap).find(m => m && window.isSameMemberId(m.id, id)) || null;
};

window.getAbsoluteTopRoot = function() {
    if (window.treeData && window.treeData.id) return window.findMemberNode(window.treeData.id) || window.treeData;
    return Object.values(window.getFlatMembers())[0] || null;
};

function getTagFromCode(codeStr) {
    if (!codeStr || codeStr === 'm') return 'm';
    if (codeStr === 'x') return 'x';
    let parts = String(codeStr).split('-');
    return parts[parts.length - 1] || 'm';
}

window.setDynamicCode = function(id, code) {
    if (!id) return;
    window.dynamicCodes = window.dynamicCodes || {};
    let clean = String(id).trim();
    let norm = clean.toLowerCase().replace(/^v[kj]-?/, '');
    window.dynamicCodes[clean] = code;
    window.dynamicCodes[clean.toUpperCase()] = code;
    window.dynamicCodes[norm] = code;
    window.dynamicCodes['VK-' + norm] = code;
    window.dynamicCodes['VJ-' + norm] = code;
    let node = window.findMemberNode(id);
    if (node) node.code = code;
};

window.getDynamicCode = function(id) {
    if (!id) return '';
    let clean = String(id).trim();
    let norm = clean.toLowerCase().replace(/^v[kj]-?/, '');
    if (window.dynamicCodes && window.dynamicCodes[clean]) return window.dynamicCodes[clean];
    if (window.dynamicCodes && window.dynamicCodes[clean.toUpperCase()]) return window.dynamicCodes[clean.toUpperCase()];
    if (window.dynamicCodes && window.dynamicCodes[norm]) return window.dynamicCodes[norm];
    let node = window.findMemberNode(id);
    return node ? (node.code || '') : '';
};

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
        let key = String(node.id).trim().toUpperCase();
        if (visited.has(key)) return;
        visited.add(key);

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

window.buildNodeHTML = function(node, visited) {
    if (!visited) visited = new Set();
    if (!node || !node.id) return '';

    let key = String(node.id).trim().toUpperCase();
    if (visited.has(key)) return '';
    visited.add(key);

    let norm = String(node.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
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

    let html = `<li><div class="node-card" id="card_${node.id}" data-member-id="${node.id}" onclick="window.handleNodeClickLogic('${node.id}')" ondblclick="window.handleNodeDblClickLogic(event, '${node.id}')">${topParentBtn}${innerContent}${cornerBtns}</div>`;

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

window.renderTree = function(recenter = false) {
    const rootEl = document.getElementById('tree-root');
    if (!rootEl) return;

    if (!window.treeMode) window.treeMode = 'sponsor';

    let rootNode = window.treeMode === 'recommender' ? (window.findMemberNode(window.recommenderRootId) || window.getAbsoluteTopRoot()) : window.treeData;
    if (window.treeMode !== 'recommender') window.computeDynamicCodes(window.currentSelectedId);

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []);
    window.memberSalesDateMap = window.memberSalesDateMap || {};
    allSales.forEach(s => {
        if (!s || !s.member_id) return;
        let mId = String(s.member_id).trim().toLowerCase().replace(/^v[kj]-?/, '');
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
        if (typeof window.centerRootNode === 'function') window.centerRootNode();
    }, 150);

    setTimeout(() => {
        if (typeof window.applyCardHighlights === 'function') window.applyCardHighlights();
    }, 60);

    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(window.currentSelectedId);
};

// ============================================================================
// [10] TiDB 보상플랜 동적 로드 및 하단 수당 시뮬레이터 메인 연산 엔진
// ============================================================================
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
                m.rank = m.rank || m.rank_name || 'GUEST';
                m.type = m.type || m.member_type || '사업자';
            });
            if (typeof window.renderTree === 'function') window.renderTree(isReRender);
        }
    } catch (error) {}
};

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

window.getSublinePartnerSets = function(rootNode) {
    const setA = new Set();
    const setB = new Set();
    if (!rootNode || !rootNode.id) return { setA, setB };

    const rootNorm = String(rootNode.id).trim().toLowerCase().replace(/^v[kj]-?/, '');

    function collectSubNodes(curr, targetSet, visited) {
        if (!curr) return;
        const obj = (typeof curr === 'object') ? curr : (typeof window.findMemberNode === 'function' ? window.findMemberNode(curr) : null);
        if (!obj || !obj.id) return;

        const norm = String(obj.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
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

window.extractDirectRateFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const candidateKeys = ['direct_bonus_rate', 'recommend_bonus_rate', 'recommender_bonus_rate', 'rec_bonus_rate', 'direct_rate', 'recommend_rate', 'rec_rate', 'referral_bonus_rate', 'referral_rate', 'direct_pct', 'rec_pct'];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }
    return null;
};

window.extractTeamRateFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const candidateKeys = ['team_bonus_rate', 'sponsor_bonus_rate', 'support_bonus_rate', 'binary_bonus_rate', 'spon_bonus_rate', 'team_rate', 'sponsor_rate', 'support_rate', 'binary_rate', 'spon_rate', 'matching_cv_rate', 'small_leg_rate', 'team_pct', 'sponsor_pct'];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
            if (!isNaN(v)) return v > 1 ? (v / 100) : v;
        }
    }
    return null;
};

window.extractTeamCapFromPolicyObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const candidateKeys = ['team_bonus_cap', 'sponsor_bonus_cap', 'support_bonus_cap', 'binary_bonus_cap', 'max_team_bonus', 'max_sponsor_bonus', 'team_cap', 'sponsor_cap', 'bonus_cap', 'limit_amount', 'max_bonus_amount', 'max_payout', 'period_cap', 'cap_amount'];
    for (const k of candidateKeys) {
        if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
            let v = Number(policyObj[k]);
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
        const explicitKeys = [`matching_gen${g}_rate`, `matching_gen_${g}_rate`, `matching_gen${g}`, `matching_gen_${g}`, `match_gen${g}_rate`, `match_gen_${g}_rate`, `match_gen${g}`, `match_gen_${g}`, `matching_rate_${g}`, `matching_rate${g}`, `match_rate_${g}`, `match_rate${g}`, `gen${g}_matching_rate`, `gen_${g}_matching_rate`, `gen${g}_match_rate`, `gen${g}_rate`, `gen_${g}_rate`, `generation_${g}_rate`, `generation${g}_rate`, `matching_${g}`, `match_${g}`, `gen${g}`];
        for (const k of explicitKeys) {
            if (policyObj[k] !== undefined && policyObj[k] !== null && policyObj[k] !== '') {
                const r = toRate(policyObj[k]);
                if (r !== null && r > 0) { genRates[g] = r; break; }
            }
        }
    }
    return Object.keys(genRates).length > 0 ? genRates : null;
};

window.extractMaintenancePolicyFromObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const targetObj = (policyObj.maintenance_policy && typeof policyObj.maintenance_policy === 'object') ? policyObj.maintenance_policy : policyObj;
    let amount = null, reqSmallCv = 0, reqSmallPv = 0;

    const amountKeys = ['maintenance_bonus_amount', 'maintenance_bonus', 'dignity_bonus', 'level_bonus', 'bonus_amount', 'maintenance_amount', 'dignity_amount', 'payout_amount', 'pay_amount', 'fixed_bonus', 'fixed_amount', 'amount', 'bonus', 'reward_amount', 'allowance'];
    for (const k of amountKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) { amount = v; break; }
        }
    }

    for (const [k, val] of Object.entries(targetObj)) {
        const lk = k.toLowerCase();
        if (lk.includes('id') || lk.includes('rank') || lk.includes('level')) continue;
        if (lk.includes('min') || lk.includes('req') || lk.includes('cond') || lk.includes('qualify') || lk.includes('target') || lk.includes('cv') || lk.includes('pv')) {
            const v = Number(String(val).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) {
                if (lk.includes('pv')) reqSmallPv = v;
                else if (lk.includes('cv') || v !== amount) reqSmallCv = v;
            }
        }
    }

    if (amount === null || amount <= 0) return null;
    return { amount, reqSmallCv, reqSmallPv, rawPolicy: targetObj };
};

window.extractCarMaintenancePolicyFromObj = function(policyObj) {
    if (!policyObj || typeof policyObj !== 'object') return null;
    const targetObj = (policyObj.car_maintenance_policy && typeof policyObj.car_maintenance_policy === 'object') ? policyObj.car_maintenance_policy : policyObj;
    let amount = null, reqSmallCvPerPeriod = 0;

    const amountKeys = ['car_maintenance_bonus_amount', 'car_bonus_amount', 'car_maintenance_amount', 'car_bonus', 'bonus_amount', 'payout_amount', 'amount'];
    for (const k of amountKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v > 0) { amount = v; break; }
        }
    }

    const cvKeys = ['required_minor_leg_cv_per_period', 'required_minor_leg_cv', 'min_minor_leg_cv', 'required_small_cv', 'min_small_cv', 'required_cv', 'min_cv'];
    for (const k of cvKeys) {
        if (targetObj[k] !== undefined && targetObj[k] !== null && targetObj[k] !== '') {
            const v = Number(String(targetObj[k]).replace(/,/g, ''));
            if (!isNaN(v) && v >= 0) { reqSmallCvPerPeriod = v; break; }
        }
    }

    if (amount === null || amount <= 0) return null;
    return { amount, reqSmallCvPerPeriod, payoutSchedule: targetObj.payout_schedule || '', description: targetObj.description || '', rawPolicy: targetObj };
};

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
        const fastpowerPolicies = Array.isArray(compRules.fastpower_policies) ? compRules.fastpower_policies : [];
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
                ...r, rank_id: rId, rank_level: rLevel, rank_name: rName,
                period_type: String(r.period_type || 'NONE').trim().toUpperCase(),
                personal_pv_min: Number(r.personal_pv_min ?? 0),
                minor_leg_pv: Number(r.minor_leg_pv ?? 0),
                required_partner_rank_id: r.required_partner_rank_id !== null && r.required_partner_rank_id !== undefined && r.required_partner_rank_id !== '' ? Number(r.required_partner_rank_id) : null,
                is_direct_sponsor: Number(r.is_direct_sponsor ?? 0),
                maintenance_rank_id: r.maintenance_rank_id !== null && r.maintenance_rank_id !== undefined && r.maintenance_rank_id !== '' ? Number(r.maintenance_rank_id) : null
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
                    required_partner_rank_id: fp.required_partner_rank_id !== null && fp.required_partner_rank_id !== undefined && fp.required_partner_rank_id !== '' ? Number(fp.required_partner_rank_id) : null,
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
            if (mRates !== null) window.dbRankMatchingRates[rName] = { ...(window.dbRankMatchingRates[rName] || {}), ...mRates };

            if (mergedObj.maintenance_policy) {
                const maintPol = window.extractMaintenancePolicyFromObj(mergedObj.maintenance_policy);
                if (maintPol !== null) window.dbRankMaintenancePolicies[rName] = maintPol;
            }
            if (mergedObj.car_maintenance_policy) {
                const carPol = window.extractCarMaintenancePolicyFromObj(mergedObj.car_maintenance_policy);
                if (carPol !== null) window.dbRankCarMaintenancePolicies[rName] = carPol;
            }
        };

        Object.entries(policiesByRankName).forEach(([rName, mergedObj]) => registerRankPolicy(rName, mergedObj));

        window.dbRanksSorted.forEach(r => {
            const rName = r.rank_name;
            const rId = r.rank_id;
            registerRankPolicy(rName, {
                ...r,
                ...(bonusPolicies[rId] || bonusPolicies[rName] || {}),
                matching_policy: matchingPolicies[rId] || matchingPolicies[rName] || null,
                maintenance_policy: maintenancePolicies[rId] || maintenancePolicies[rName] || null,
                car_maintenance_policy: carMaintenancePolicies[rId] || carMaintenancePolicies[rName] || null
            });
        });

        window.dbRankRatesLoaded = window.dbRanksSorted.length > 0;
    } catch (err) {
        console.error('❌ TiDB 보상플랜 요율 로드 실패:', err);
    }
};

window.getDbRankLevel = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankByNameMap && window.dbRankByNameMap[r]) ? Number(window.dbRankByNameMap[r].rank_level || 0) : 0;
};

window.getDbRankId = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankByNameMap && window.dbRankByNameMap[r]) ? Number(window.dbRankByNameMap[r].rank_id || 0) : 0;
};

window.getBaseBusinessRankName = function() {
    return 'GUEST';
};

window.getDirectBonusRate = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankDirectRates && typeof window.dbRankDirectRates[r] === 'number') ? window.dbRankDirectRates[r] : 0;
};

window.getTeamBonusRate = function(rankName) {
    if (!rankName) return 0;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankTeamRates && typeof window.dbRankTeamRates[r] === 'number') ? window.dbRankTeamRates[r] : 0;
};

window.getTeamBonusCap = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankTeamCaps && typeof window.dbRankTeamCaps[r] === 'number' && window.dbRankTeamCaps[r] > 0) ? window.dbRankTeamCaps[r] : null;
};

window.getMatchingBonusRates = function(rankName) {
    if (!rankName) return {};
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankMatchingRates && window.dbRankMatchingRates[r]) ? window.dbRankMatchingRates[r] : {};
};

window.getMaintenanceBonusPolicy = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankMaintenancePolicies && window.dbRankMaintenancePolicies[r]) ? window.dbRankMaintenancePolicies[r] : null;
};

window.getCarMaintenanceBonusPolicy = function(rankName) {
    if (!rankName) return null;
    const r = String(rankName).trim().toUpperCase();
    return (window.dbRankCarMaintenancePolicies && window.dbRankCarMaintenancePolicies[r]) ? window.dbRankCarMaintenancePolicies[r] : null;
};

window.getDirectRecommendedPartnersMap = function(targetMember) {
    const recMap = new Map();
    if (!targetMember || !targetMember.id) return recMap;

    const targetNorm = String(targetMember.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
    const targetName = String(targetMember.name || '').trim();
    const allMembers = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];

    const rollupChk = document.getElementById('chk-rollup') || document.querySelector('#perfWidget input[type="checkbox"]');
    const isRollup = rollupChk ? rollupChk.checked : true;

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
        if (mNorm === targetNorm) return;

        const rId = m.recId || m.recommender_id || m.recommenderId || m.rec_id || '';
        const rNorm = String(rId).trim().toLowerCase().replace(/^v[kj]-?/, '');
        const rName = String(m.recName || m.recommender_name || m.recommenderName || m.rec_name || '').trim();

        if ((rNorm && rNorm === targetNorm) || (!rNorm && targetName && rName === targetName)) {
            recMap.set(mNorm, m);
            return;
        }

        if (isRollup && rNorm) {
            let currRecId = rId;
            const visited = new Set([mNorm]);
            while (currRecId) {
                const currNorm = String(currRecId).trim().toLowerCase().replace(/^v[kj]-?/, '');
                if (visited.has(currNorm)) break;
                visited.add(currNorm);

                const recNode = window.findMemberNode(currRecId);
                if (!recNode) break;

                const recRank = String(recNode.rank || recNode.rank_name || '').toUpperCase();
                const recRate = window.getDirectBonusRate(recRank);

                if (recRate <= 0) {
                    const nextRecId = recNode.recId || recNode.recommender_id || recNode.rec_id || '';
                    const nextNorm = String(nextRecId).trim().toLowerCase().replace(/^v[kj]-?/, '');
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

window.resolveHistoricalRank = function(memberObj, orderKey, rawSk, backendMembersMap, accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo) {
    if (!memberObj) return 'GUEST';
    const currentRank = String(memberObj.rank || memberObj.rank_name || 'GUEST').trim().toUpperCase();
    if (currentRank === 'GUEST' || currentRank === 'MEMBER') return currentRank;

    const totalMinorLegPV = Math.min(accAPV || 0, accBPV || 0);
    const r4A = (recent4APV !== undefined && recent4APV !== null) ? recent4APV : (accAPV || 0);
    const r4B = (recent4BPV !== undefined && recent4BPV !== null) ? recent4BPV : (accBPV || 0);
    const recent4MinorLegPV = Math.min(r4A, r4B);

    let achievedRank = currentRank;
    const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

    for (const rRow of dbRanks) {
        const reqMinorPv = Number(rRow.minor_leg_pv || 0);
        if (reqMinorPv <= 0) continue;

        const periodType = String(rRow.period_type || 'NONE').trim().toUpperCase();
        const compareMinorPV = (periodType === 'RECENT_4') ? recent4MinorLegPV : totalMinorLegPV;

        if (compareMinorPV < reqMinorPv) continue;

        const reqPartnerRankId = rRow.required_partner_rank_id;
        const isDirectSponsor = Number(rRow.is_direct_sponsor || 0) === 1;

        if (reqPartnerRankId !== null && reqPartnerRankId > 0 && legQualifyInfo) {
            if (isDirectSponsor) {
                if (legQualifyInfo.maxDirectRankIdA < reqPartnerRankId || legQualifyInfo.maxDirectRankIdB < reqPartnerRankId) continue;
            } else {
                if (legQualifyInfo.maxSubRankIdA < reqPartnerRankId || legQualifyInfo.maxSubRankIdB < reqPartnerRankId) continue;
            }
        }
        achievedRank = rRow.rank_name;
    }

    const curLevel = window.getDbRankLevel(currentRank);
    const achLevel = window.getDbRankLevel(achievedRank);
    if (curLevel > 0 && achLevel > curLevel) return currentRank;
    return achievedRank;
};

window.getAllCombinedMembersList = function(backendMembersMap) {
    const combinedMap = new Map();
    const localList = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];

    localList.forEach(m => {
        if (!m || !m.id) return;
        const norm = String(m.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
        combinedMap.set(norm, m);
    });

    if (backendMembersMap && typeof backendMembersMap === 'object') {
        Object.values(backendMembersMap).forEach(bm => {
            if (!bm || !(bm.id || bm.member_id)) return;
            const bid = bm.id || bm.member_id;
            const norm = String(bid).trim().toLowerCase().replace(/^v[kj]-?/, '');
            if (!combinedMap.has(norm)) {
                const foundNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(bid) : null;
                combinedMap.set(norm, foundNode || { ...bm, id: bid });
            }
        });
    }
    return Array.from(combinedMap.values());
};

window.getLegPartnerQualificationInfo = function(treeNode, setA, setB, directRecNormSet, orderKey, teamBonusMap) {
    let maxDirectRankIdA = 0, maxDirectRankIdB = 0;
    let maxSubRankIdA = 0, maxSubRankIdB = 0;
    const baseRankId = window.getDbRankId('GUEST');

    const getPartnerRankIdAtPeriod = (subNorm) => {
        const pMap = teamBonusMap ? teamBonusMap.get(subNorm) : null;
        if (pMap && pMap[orderKey] && pMap[orderKey].historicalRank) {
            return window.getDbRankId(pMap[orderKey].historicalRank);
        }
        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(subNorm) : null;
        if (mNode && mNode.rank) return window.getDbRankId(mNode.rank);
        return baseRankId;
    };

    setA.forEach(subNorm => {
        const rId = getPartnerRankIdAtPeriod(subNorm);
        if (rId > maxSubRankIdA) maxSubRankIdA = rId;
        if (directRecNormSet.has(subNorm) && rId > maxDirectRankIdA) maxDirectRankIdA = rId;
    });

    setB.forEach(subNorm => {
        const rId = getPartnerRankIdAtPeriod(subNorm);
        if (rId > maxSubRankIdB) maxSubRankIdB = rId;
        if (directRecNormSet.has(subNorm) && rId > maxDirectRankIdB) maxDirectRankIdB = rId;
    });

    return { maxDirectRankIdA, maxDirectRankIdB, maxSubRankIdA, maxSubRankIdB };
};

window.computeAllMembersTeamBonusByPeriod = function(allSales, backendMembersMap) {
    const allMembers = window.getAllCombinedMembersList(backendMembersMap);
    const salesByMember = new Map();

    allSales.forEach(s => {
        if (!s) return;
        const midNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^v[kj]-?/, '');
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
    salesByMember.forEach(list => list.forEach(({ pInfo }) => allGlobalPeriodKeys.add(pInfo.sortOrderKey)));
    const sortedGlobalKeys = Array.from(allGlobalPeriodKeys).sort((a, b) => a.localeCompare(b));

    const teamBonusMap = new Map();
    const membersBottomUp = [...allMembers].sort((a, b) => Number(b.generation || 0) - Number(a.generation || 0));

    membersBottomUp.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
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
                    mPeriodBuckets[pInfo.sortOrderKey] = { sortOrderKey: pInfo.sortOrderKey, backendKey: pInfo.backendKey, periodLabel: pInfo.periodLabel, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0 };
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
                    mPeriodBuckets[pInfo.sortOrderKey] = { sortOrderKey: pInfo.sortOrderKey, backendKey: pInfo.backendKey, periodLabel: pInfo.periodLabel, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0 };
                }
                mPeriodBuckets[pInfo.sortOrderKey].b_cv += cv;
                mPeriodBuckets[pInfo.sortOrderKey].b_pv += pv;
            });
        });

        let prevA = 0, prevB = 0, accAPV = 0, accBPV = 0;
        let highestRankAchieved = String(m.rank || m.rank_name || 'GUEST').trim().toUpperCase();
        const recent4Window = [];
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
                if (recent4Window.length > 4) recent4Window.shift();
            }

            const recent4APV = recent4Window.reduce((sum, item) => sum + item.a_pv, 0);
            const recent4BPV = recent4Window.reduce((sum, item) => sum + item.b_pv, 0);
            const legQualifyInfo = window.getLegPartnerQualificationInfo(treeNode, setA, setB, directRecNormSet, k, teamBonusMap);

            const evaluatedRank = window.resolveHistoricalRank(treeNode, k, b.backendKey || defaultBackendKey, backendMembersMap, accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo);
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

            memberPeriodResult[k] = {
                teamBonus: tb, matchedCV: deduct, accAPV, accBPV, recent4APV, recent4BPV, historicalRank: histRank
            };
        });

        teamBonusMap.set(mNorm, memberPeriodResult);
    });

    return teamBonusMap;
};

window.buildRecommenderChildrenMap = function(allMembers, backendMembersMap) {
    const recChildrenMap = new Map();
    const memberByNormId = new Map();
    const membersByName = new Map();

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
        memberByNormId.set(mNorm, m);

        const mName = String(m.name || '').trim();
        if (mName) {
            if (!membersByName.has(mName)) membersByName.set(mName, []);
            membersByName.get(mName).push(m);
        }
    });

    allMembers.forEach(m => {
        if (!m || !m.id) return;
        const mNorm = String(m.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
        const rawRecId = m.recId || m.recommender_id || m.recommenderId || m.rec_id || '';
        const rawRecName = String(m.recName || m.recommender_name || m.recommenderName || m.rec_name || '').trim();

        let rNorm = String(rawRecId).trim().toLowerCase().replace(/^v[kj]-?/, '');
        if (!rNorm || !memberByNormId.has(rNorm)) {
            rNorm = '';
            if (rawRecName && rawRecName !== '-') {
                const candidates = membersByName.get(rawRecName) || [];
                if (candidates.length >= 1) {
                    rNorm = String(candidates[0].id).trim().toLowerCase().replace(/^v[kj]-?/, '');
                }
            }
        }

        if (!rNorm || rNorm === mNorm) return;
        if (!recChildrenMap.has(rNorm)) recChildrenMap.set(rNorm, []);
        const list = recChildrenMap.get(rNorm);
        if (!list.some(existing => String(existing.id).trim().toLowerCase().replace(/^v[kj]-?/, '') === mNorm)) {
            list.push(m);
        }
    });

    return { recChildrenMap, memberByNormId };
};

window.calculateMatchingBonusForTarget = function(targetMember, periodMap, allMembersTeamBonusMap, isRollup, backendMembersMap) {
    if (!targetMember || !targetMember.id) return;
    const allMembers = window.getAllCombinedMembersList(backendMembersMap);
    const { recChildrenMap } = window.buildRecommenderChildrenMap(allMembers, backendMembersMap);
    const rootNorm = String(targetMember.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
    const ROLLUP_MIN_TEAM_BONUS = 30000;

    const allRelevantPeriodKeys = new Set(Object.keys(periodMap));
    const directFirstGenChildren = recChildrenMap.get(rootNorm) || [];
    const firstGenSlotCount = Math.max(2, directFirstGenChildren.length);

    allRelevantPeriodKeys.forEach(orderKey => {
        const pRow = periodMap[orderKey];
        const targetTeamObj = allMembersTeamBonusMap.get(rootNorm);
        const targetHistRank = (pRow && pRow.historicalRank) ? pRow.historicalRank : ((targetTeamObj && targetTeamObj[orderKey] && targetTeamObj[orderKey].historicalRank) ? targetTeamObj[orderKey].historicalRank : 'GUEST');

        const myMatchRates = window.getMatchingBonusRates(targetHistRank);
        const maxGen = Math.max(0, ...Object.keys(myMatchRates).map(Number));
        if (maxGen === 0) {
            if (pRow) { pRow.matchingBonus = 0; pRow.matchingDetails = []; pRow.appliedMatchRank = targetHistRank; }
            return;
        }

        const rawCandidates = [];
        const traverseRecTree = (parentNorm, currentEffectiveGen, rawDepth, visited) => {
            const children = recChildrenMap.get(parentNorm) || [];
            children.forEach(child => {
                const cNorm = String(child.id).trim().toLowerCase().replace(/^v[kj]-?/, '');
                if (visited.has(cNorm)) return;
                visited.add(cNorm);

                const pTeamObj = allMembersTeamBonusMap.get(cNorm);
                const partnerPeriodData = pTeamObj ? pTeamObj[orderKey] : null;
                const partnerTeamBonus = partnerPeriodData ? (partnerPeriodData.teamBonus || 0) : 0;
                const partnerHistRank = partnerPeriodData ? partnerPeriodData.historicalRank : 'GUEST';

                const qualifiesForGeneration = isRollup ? (partnerTeamBonus >= ROLLUP_MIN_TEAM_BONUS) : (partnerTeamBonus > 0);
                if (qualifiesForGeneration) {
                    rawCandidates.push({ gen: currentEffectiveGen, rawGen: rawDepth, member_id: child.id, name: child.name || '-', rank: partnerHistRank, teamBonus: partnerTeamBonus });
                    traverseRecTree(cNorm, currentEffectiveGen + 1, rawDepth + 1, visited);
                } else {
                    traverseRecTree(cNorm, isRollup ? currentEffectiveGen : (currentEffectiveGen + 1), rawDepth + 1, visited);
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
            matchingList.push({ gen: cand.gen, rawGen: cand.rawGen, genLabel: `${cand.gen}세대`, member_id: cand.member_id, name: cand.name, rank: cand.rank, teamBonus: cand.teamBonus, rate, matchingAmount: matchAmt });
        });

        if (pRow) {
            matchingList.sort((a, b) => (a.gen - b.gen) || (b.matchingAmount - a.matchingAmount));
            pRow.matchingBonus = periodMatchingSum;
            pRow.matchingDetails = matchingList;
            pRow.appliedMatchRank = targetHistRank;
        }
    });
};

window.calculateFastPowerBonusForTarget = function(targetMember, periodMap, allSales, backendMembersMap) {
    if (!targetMember || !targetMember.id) return;
    Object.values(periodMap).forEach(r => { r.fastPowerBonus = r.fastPowerBonus || 0; });
};

window.calculateLocalPerformance = async function(targetId) {
    const tbody = document.getElementById('perf-table-tbody');
    const nameEl = document.getElementById('perf-target-name');
    if (!tbody) return;

    const rollupChk = document.getElementById('chk-rollup') || document.querySelector('#perfWidget input[type="checkbox"]');
    if (rollupChk && !rollupChk.dataset.boundRollup) {
        rollupChk.dataset.boundRollup = 'true';
        rollupChk.addEventListener('change', () => window.calculateLocalPerformance(window.currentSelectedId));
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
    const rootNorm = String(actualId).trim().toLowerCase().replace(/^v[kj]-?/, '');
    if (nameEl) nameEl.innerText = `(${targetMember.name || actualId} / ${actualId})`;

    if (typeof window.loadDbCompensationRates === 'function') {
        await window.loadDbCompensationRates();
    }
    const baseRankName = targetMember.rank || 'GUEST';

    let allSales = window.integrated_sales_history || [];
    if (window.API_BASE) {
        try {
            const sRes = await fetch(`${window.API_BASE}/api/sales`);
            if (sRes.ok) {
                const sRows = await sRes.json();
                if (Array.isArray(sRows)) {
                    window.allSalesData = sRows;
                    allSales = sRows;
                }
            }
        } catch (e) {}
    }

    const allMembersTeamBonusMap = typeof window.computeAllMembersTeamBonusByPeriod === 'function'
        ? window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData)
        : new Map();

    window.lastAllMembersTeamBonusMap = allMembersTeamBonusMap;
    const targetPeriodRankMap = allMembersTeamBonusMap.get(rootNorm) || {};

    const { setA, setB } = window.getSublinePartnerSets(targetMember);
    const directRecMap = window.getDirectRecommendedPartnersMap(targetMember);
    const directRecNormSet = new Set(directRecMap.keys());

    const periodMap = {};

    function ensurePeriodBucket(pInfo) {
        if (!pInfo || !pInfo.sortOrderKey) return null;
        if (!periodMap[pInfo.sortOrderKey]) {
            const myHistRank = (targetPeriodRankMap[pInfo.sortOrderKey] && targetPeriodRankMap[pInfo.sortOrderKey].historicalRank) ? targetPeriodRankMap[pInfo.sortOrderKey].historicalRank : baseRankName;
            periodMap[pInfo.sortOrderKey] = {
                sortOrderKey: pInfo.sortOrderKey, sortKey: pInfo.backendKey || pInfo.sortOrderKey,
                periodLabel: pInfo.periodLabel || pInfo.sortOrderKey, startDate: pInfo.startDate || '', endDate: pInfo.endDate || '',
                historicalRank: myHistRank, a_cv: 0, a_pv: 0, b_cv: 0, b_pv: 0, matchedCV: 0, balanceA: 0, balanceB: 0,
                directBonus: 0, appliedRecRate: window.getDirectBonusRate(myHistRank),
                teamBonus: 0, appliedTeamRate: window.getTeamBonusRate(myHistRank),
                matchingBonus: 0, levelBonus: 0, carBonus: 0, fastPowerBonus: 0,
                details: [], recDetails: [], matchingDetails: []
            };
        }
        return periodMap[pInfo.sortOrderKey];
    }

    allSales.forEach(s => {
        if (!s) return;
        const saleMidNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^v[kj]-?/, '');
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
        const salePartnerHistRank = (salePartnerPeriodMap && salePartnerPeriodMap[pInfo.sortOrderKey]) ? salePartnerPeriodMap[pInfo.sortOrderKey].historicalRank : 'GUEST';

        if (isLineA) {
            bucket.a_cv += cvVal; bucket.a_pv += pvVal;
            bucket.details.push({ line: 'A라인', member_id: s.member_id, rank: salePartnerHistRank, cv: cvVal, pv: pvVal, date: window.cleanDateStr(rawDate) });
        } else if (isLineB) {
            bucket.b_cv += cvVal; bucket.b_pv += pvVal;
            bucket.details.push({ line: 'B라인', member_id: s.member_id, rank: salePartnerHistRank, cv: cvVal, pv: pvVal, date: window.cleanDateStr(rawDate) });
        }

        if (isDirectRec && cvVal > 0) {
            const recPartner = directRecMap.get(saleMidNorm);
            const recRate = bucket.appliedRecRate;
            const bonusAmt = Math.floor(cvVal * recRate);
            bucket.directBonus += bonusAmt;
            bucket.recDetails.push({ date: window.cleanDateStr(rawDate), member_id: recPartner ? recPartner.id : s.member_id, name: recPartner ? recPartner.name : '-', rank: salePartnerHistRank, cv: cvVal, rate: recRate, bonus: bonusAmt });
        }
    });

    const chronologicalRows = Object.values(periodMap).sort((a, b) => a.sortOrderKey.localeCompare(b.sortOrderKey));
    if (chronologicalRows.length === 0) {
        window.perfData = [];
        tbody.innerHTML = `<tr><td colspan="18" style="padding:30px; text-align:center; color:#9ca3af;">산하 파트너 매출 및 수당 내역이 없습니다. (본인 매출 제외)</td></tr>`;
        return;
    }

    let prevAccACV = 0, prevAccBCV = 0, totalAccAPV = 0, totalAccBPV = 0;
    let runningHighestRank = String(targetMember.rank || 'GUEST').trim().toUpperCase();
    const recent4Window = [];

    chronologicalRows.forEach(row => {
        totalAccAPV += (row.a_pv || 0);
        totalAccBPV += (row.b_pv || 0);
        row.accAPV = totalAccAPV;
        row.accBPV = totalAccBPV;

        recent4Window.push({ a_pv: row.a_pv || 0, b_pv: row.b_pv || 0 });
        if (recent4Window.length > 4) recent4Window.shift();
        const recent4APV = recent4Window.reduce((s, x) => s + x.a_pv, 0);
        const recent4BPV = recent4Window.reduce((s, x) => s + x.b_pv, 0);
        row.recent4APV = recent4APV;
        row.recent4BPV = recent4BPV;
        row.recent4MinorPV = Math.min(recent4APV, recent4BPV);

        const legQualifyInfo = window.getLegPartnerQualificationInfo(targetMember, setA, setB, directRecNormSet, row.sortOrderKey, allMembersTeamBonusMap);
        const evalRank = window.resolveHistoricalRank(targetMember, row.sortOrderKey, row.sortKey, window.flatMembersData, totalAccAPV, totalAccBPV, recent4APV, recent4BPV, legQualifyInfo);
        if (window.getDbRankLevel(evalRank) > window.getDbRankLevel(runningHighestRank)) runningHighestRank = evalRank;
        row.historicalRank = runningHighestRank;

        const rowTeamRate = window.getTeamBonusRate(row.historicalRank);
        const rowTeamCap = window.getTeamBonusCap(row.historicalRank);

        row.prevCarryA = prevAccACV;
        row.prevCarryB = prevAccBCV;
        const compareAccACV = prevAccACV + (row.a_cv || 0);
        const compareAccBCV = prevAccBCV + (row.b_cv || 0);
        row.beforeDeductACV = compareAccACV;
        row.beforeDeductBCV = compareAccBCV;

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
            if (rowTeamCap !== null && calcTeamBonus > rowTeamCap) calcTeamBonus = rowTeamCap;
        }
        row.teamBonus = calcTeamBonus;
        row.appliedTeamRate = rowTeamRate;

        const maintPolicy = window.getMaintenanceBonusPolicy(row.historicalRank);
        if (maintPolicy && maintPolicy.amount > 0) {
            const reqCv = maintPolicy.reqSmallCv || 0;
            row.levelBonus = (deductCV >= reqCv) ? maintPolicy.amount : 0;
        } else {
            row.levelBonus = 0;
        }
    });

    window.calculateMatchingBonusForTarget(targetMember, periodMap, allMembersTeamBonusMap, isRollup, window.flatMembersData);

    window.perfData = [...chronologicalRows].reverse();
    tbody.innerHTML = '';

    const fmt = num => (num && num > 0) ? num.toLocaleString('ko-KR') : '-';
    const fmtB = (num, t, row) => (!num || num <= 0)
        ? (t === 'matchBonus' ? `<span onclick="window.openBonusDetailModal('${actualId}', '${row.periodLabel}', '${row.startDate}', '${row.endDate}', '${t}')" style="cursor:pointer; color:#6b7280; text-decoration:underline;">0</span>` : '<span style="color:#6b7280;">0</span>')
        : `<span onclick="window.openBonusDetailModal('${actualId}', '${row.periodLabel}', '${row.startDate}', '${row.endDate}', '${t}')" style="cursor:pointer; text-decoration:underline; color:#60a5fa;">${num.toLocaleString('ko-KR')}</span>`;
    const fmtBonusNum = num => (!num || num <= 0) ? '0' : num.toLocaleString('ko-KR');

    window.perfData.forEach(row => {
        const totalBonus = (row.directBonus || 0) + (row.teamBonus || 0) + (row.matchingBonus || 0) + (row.levelBonus || 0) + (row.carBonus || 0) + (row.fastPowerBonus || 0);
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #374151';
        tr.innerHTML = `
            <td style="padding:8px; text-align:center; font-weight:bold; color:#60a5fa; border-right:1px solid #374151; background:#111827;">${row.periodLabel}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; text-align:right;">${fmt(row.a_cv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right;">${fmt(row.displayAccACV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; text-align:right; border-right:1px solid #374151;">${fmt(row.matchedCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#10b981; text-align:right;">${fmt(row.a_pv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right; border-right:1px solid #374151;">${fmt(row.accAPV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; text-align:right;">${fmt(row.b_cv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right;">${fmt(row.displayAccBCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; text-align:right; border-right:1px solid #374151;">${fmt(row.matchedCV)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#10b981; text-align:right;">${fmt(row.b_pv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#d1d5db; text-align:right; border-right:1px solid #374151;">${fmt(row.accBPV)}</td>
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
window.badgeThresholdRatio = typeof window.badgeThresholdRatio === 'number' ? window.badgeThresholdRatio : 0.8;
window.bizNavPopupWindow = null;
window.salesSearchPopupWindow = null;

window.getCurrentSelectedPeriodOrderKey = function() {
    const dateInputs = document.querySelectorAll('input[type="date"], input[placeholder*="YYYY"]');
    for (const inp of dateInputs) {
        if (inp && inp.value && /^\d{4}-\d{2}-\d{2}$/.test(inp.value.trim())) {
            const pInfo = window.getPeriodInfoFromDate(inp.value.trim());
            if (pInfo && pInfo.sortOrderKey) return pInfo.sortOrderKey;
        }
    }
    return null;
};

window.findBizNavigatorCheckbox = function() {
    const direct = document.querySelector('#chk-navigator, #chk-biz-nav, #chkBizNav, #toggle-navigator, #opt-navigator');
    if (direct && direct.type === 'checkbox') return direct;

    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const chk of allCheckboxes) {
        if (chk.id === 'chk-rollup') continue;
        const rowEl = chk.closest('label, li, tr, .setting-item, .menu-item, .option-row, div') || chk.parentElement;
        const nearText = String((rowEl && rowEl.innerText) || '') + ' ' + String(chk.id || '');
        if (/네비게이터|내비게이터|navigator/i.test(nearText)) return chk;
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
        const nearText = String((rowEl && rowEl.innerText) || '') + ' ' + String(chk.id || '');
        if (/매출\s*기간\s*검색|기간\s*검색|매출\s*검색|sales\s*search/i.test(nearText)) return chk;
    }
    return null;
};

// [11-1] 매출 기간 검색 독립 팝업 상태 및 렌더러
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
    if (!(st.anchorDate instanceof Date) || isNaN(st.anchorDate.getTime())) st.anchorDate = new Date();

    let y = st.anchorDate.getFullYear();
    let m = st.anchorDate.getMonth();
    let d = st.anchorDate.getDate();

    if (st.unit === 'term') {
        if (direction < 0) {
            if (d > 15) d = 1;
            else { m -= 1; d = 16; }
        } else {
            if (d <= 15) d = 16;
            else { m += 1; d = 1; }
        }
    } else if (st.unit === 'month') {
        m += direction; d = 1;
    } else if (st.unit === 'year') {
        y += direction; m = 0; d = 1;
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

    if (unitSel && unitSel.value) st.unit = unitSel.value;

    if (resetToAnchor || !st.startDate || !st.endDate) {
        if (!(st.anchorDate instanceof Date) || isNaN(st.anchorDate.getTime())) st.anchorDate = new Date();
        const dates = window.calculatePopupPeriodDates(st.anchorDate, st.unit);
        st.startDate = dates.start;
        st.endDate = dates.end;
        if (startInp) startInp.value = dates.start;
        if (endInp) endInp.value = dates.end;
    } else if (!skipInputRead) {
        if (startInp && startInp.value) st.startDate = cleanFn(startInp.value);
        if (endInp && endInp.value) st.endDate = cleanFn(endInp.value);
    }

    if (lineSel && lineSel.value) st.lineFilter = lineSel.value;

    const startDate = st.startDate;
    const endDate = st.endDate;
    const lineFilter = st.lineFilter || 'ALL';

    const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));

    let baseNode = window.currentSelectedId && typeof window.findMemberNode === 'function' ? window.findMemberNode(window.currentSelectedId) : null;
    if (!baseNode && window.treeData) baseNode = Array.isArray(window.treeData) ? window.treeData[0] : window.treeData;
    const baseNorm = (baseNode && baseNode.id) ? String(baseNode.id).trim().toLowerCase().replace(/^v[kj]-?/, '') : '';
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
        let dA = cleanFn(a.transaction_date || a.date || '');
        let dB = cleanFn(b.transaction_date || b.date || '');
        return dB.localeCompare(dA);
    });

    const prevStateMap = {};
    if (Array.isArray(st.rows)) {
        st.rows.forEach(r => { if (r.rowKey && r.state !== 'none') prevStateMap[r.rowKey] = r.state; });
    }

    const mappedRows = [];
    filtered.forEach((s, idx) => {
        let cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv || s.sales_cv) : Number(s.cv || s.sales_cv || 0);
        let pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv || s.sales_pv) : Number(s.pv || s.sales_pv || 0);
        let mId = s.member_id || s.memberId || '-';
        let mNorm = String(mId).trim().toLowerCase().replace(/^v[kj]-?/, '');
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
            id: s.id, rowKey, dStr, mId, mName, lineLabel, lineColor, cv, pv,
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
    targetSumRows.forEach(r => { sumCv += r.cv; sumPv += r.pv; });

    let rowsHtml = '';
    rows.forEach((r, idx) => {
        const isSelected = r.state === 'selected';
        const isExcluded = r.state === 'excluded';
        let boxHtml = isSelected
            ? `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:#3b82f6; border:1px solid #60a5fa; color:#fff; font-size:11px; font-weight:bold; line-height:15px; text-align:center;">✓</div>`
            : (isExcluded
                ? `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:rgba(239,68,68,0.25); border:1px solid #ef4444; color:#ef4444; font-size:11px; font-weight:bold; line-height:15px; text-align:center;">✕</div>`
                : `<div class="pop-chk-box" data-idx="${idx}" style="width:16px; height:16px; margin:0 auto; border-radius:3px; background:#1f2937; border:1px solid #4b5563;"></div>`);

        const rowBg = isSelected ? 'rgba(59, 130, 246, 0.16)' : (isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'transparent');
        const textDeco = isExcluded ? 'line-through' : 'none';
        const rowOpacity = isExcluded ? '0.45' : '1';

        rowsHtml += `
            <tr data-idx="${idx}" data-mid="${r.mId}" data-sales-id="${r.id || ''}" data-selected="${isSelected ? 'true' : 'false'}"
                style="border-bottom:1px solid #374151; cursor:pointer; background:${rowBg}; text-decoration:${textDeco}; opacity:${rowOpacity};">
                <td class="pop-chk-cell" data-idx="${idx}" style="padding:6px 2px; text-align:center; cursor:pointer;">${boxHtml}</td>
                <td style="padding:6px 4px; color:#d1d5db; text-align:center;">${r.dStr}</td>
                <td style="padding:6px 4px; color:#60a5fa; font-weight:bold; text-align:center;">${r.mId}</td>
                <td style="padding:6px 4px; color:#fff; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.mName}</td>
                <td style="padding:6px 4px; color:${r.lineColor}; font-weight:bold; text-align:center;">${r.lineLabel}</td>
                <td style="padding:6px 8px; color:#60a5fa; font-weight:bold; text-align:right;">${r.cv.toLocaleString('ko-KR')}</td>
                <td style="padding:6px 8px; color:#10b981; font-weight:bold; text-align:right;">${r.pv.toLocaleString('ko-KR')}</td>
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
    if (typeof window.hideInlineSalesSearchPanels === 'function') window.hideInlineSalesSearchPanels();

    if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
        window.salesSearchPopupWindow.focus();
        window.renderSalesSearchPopupContent(false, true);
        return window.salesSearchPopupWindow;
    }

    const savedW = parseInt(localStorage.getItem('bs_sales_search_popup_w') || '920', 10);
    const savedH = parseInt(localStorage.getItem('bs_sales_search_popup_h') || '780', 10);
    const w = Math.max(600, isNaN(savedW) ? 920 : savedW);
    const h = Math.max(450, isNaN(savedH) ? 780 : savedH);

    window.salesPopupState.anchorDate = new Date();
    const initDates = window.calculatePopupPeriodDates(window.salesPopupState.anchorDate, window.salesPopupState.unit || 'term');
    window.salesPopupState.startDate = initDates.start;
    window.salesPopupState.endDate = initDates.end;

    const popup = window.open('', 'SalesSearchPopup', `width=${w},height=${h},left=140,top=80,resizable=yes,scrollbars=yes`);
    if (!popup) return null;
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
                        <button type="button" id="btn-pop-prev" class="nav-btn">◀</button>
                        <button type="button" id="btn-pop-next" class="nav-btn">▶</button>
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
                        <col style="width: 44px;"><col style="width: 88px;"><col style="width: 96px;"><col style="width: 84px;"><col style="width: 68px;"><col style="width: auto;"><col style="width: auto;">
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
    if (startInp) startInp.addEventListener('change', () => window.renderSalesSearchPopupContent(false, false));
    const endInp = doc.getElementById('pop-end-date');
    if (endInp) endInp.addEventListener('change', () => window.renderSalesSearchPopupContent(false, false));
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
                e.preventDefault(); e.stopPropagation();
                const idx = Number(chkCell.getAttribute('data-idx'));
                const row = window.salesPopupState.rows[idx];
                if (row) {
                    row.state = (row.state === 'selected') ? 'none' : 'selected';
                    window.renderSalesPopupRowsAndTotals();
                }
                return;
            }
            const tr = e.target.closest('tr[data-mid]');
            if (tr) {
                const memberId = tr.getAttribute('data-mid');
                if (window.salesPopupState.rowClickTimer) clearTimeout(window.salesPopupState.rowClickTimer);
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
            e.preventDefault(); e.stopPropagation();
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

    window.renderSalesSearchPopupContent(true, true);
    return popup;
};

window.toggleSalesSearchPopup = function(forceShow) {
    if (typeof window.hideInlineSalesSearchPanels === 'function') window.hideInlineSalesSearchPanels();
    const isPopupOpen = Boolean(window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed);
    const willShow = (forceShow !== undefined) ? Boolean(forceShow) : !isPopupOpen;

    if (willShow) window.openSalesSearchPopupWindow();
    else {
        if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) window.salesSearchPopupWindow.close();
        window.salesSearchPopupWindow = null;
    }

    const salesChk = window.findSalesSearchCheckbox();
    if (salesChk && salesChk.checked !== willShow) salesChk.checked = willShow;
};

window.reorganizePopupSettingsCategory = function(keepHidden = false) {
    const navChk = typeof window.findBizNavigatorCheckbox === 'function' ? window.findBizNavigatorCheckbox() : null;
    const salesChk = typeof window.findSalesSearchCheckbox === 'function' ? window.findSalesSearchCheckbox() : null;

    let menuDropdown = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (!menuDropdown && navChk) menuDropdown = navChk.closest('#settingsDropdown, #settingsMenu, .settings-menu, .dropdown-menu');
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
            <input type="number" id="inp-badge-threshold" value="${savedPct}" min="10" max="100" step="10" style="width: 44px; background: #111827; border: 1px solid #4b5563; color: #fbbf24; font-weight: bold; border-radius: 4px; padding: 2px 4px; text-align: center; font-size: 11px;">
            <span style="color: #9ca3af; font-size: 11px;">% 이상</span>
        </div>
    `;

    menuDropdown.innerHTML = '';
    menuDropdown.appendChild(topColsWrap);
    menuDropdown.appendChild(widgetCol);
    menuDropdown.appendChild(popupCol);
    menuDropdown.appendChild(badgeThresholdRow);
};

window.renderTreeCardStatusBadges = async function() {
    if (typeof window.loadDbCompensationRates === 'function') await window.loadDbCompensationRates();

    let teamMap = window.lastAllMembersTeamBonusMap instanceof Map ? window.lastAllMembersTeamBonusMap : null;
    if (!teamMap) {
        const allSales = window.allSalesData || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : (window.integrated_sales_history || []));
        if (Array.isArray(allSales) && allSales.length > 0 && typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
            teamMap = window.computeAllMembersTeamBonusByPeriod(allSales, null);
            window.lastAllMembersTeamBonusMap = teamMap;
        }
    }

    const preferredOrderKey = typeof window.getCurrentSelectedPeriodOrderKey === 'function' ? window.getCurrentSelectedPeriodOrderKey(teamMap) : null;
    const cardMap = new Map();
    const candidateNodes = document.querySelectorAll('.node-card, .tree-node, [id^="card_"], [data-member-id]');

    candidateNodes.forEach(el => {
        if (!el || el.closest('#perfWidget') || el.closest('#bonusDetailModal') || el.closest('#salesWidget')) return;
        let memberId = el.getAttribute('data-member-id') || el.id?.replace(/^card_/, '');
        if (!memberId || !/V[KJ]-[A-Z0-9]+/i.test(memberId)) {
            const txt = String(el.innerText || '');
            const match = txt.match(/V[KJ]-[A-Z0-9]+/i);
            if (match) memberId = match[0];
        }
        if (!memberId || !/V[KJ]-[A-Z0-9]+/i.test(memberId)) return;
        cardMap.set(memberId.toUpperCase(), el);
    });

    cardMap.forEach((cardEl, memberId) => {
        const oldBadge = cardEl.querySelector('.bs-card-top-badges');
        if (oldBadge) oldBadge.remove();

        if (typeof window.evaluateMemberCardBadgeStatus !== 'function') return;
        const status = window.evaluateMemberCardBadgeStatus(memberId, teamMap, preferredOrderKey);
        if (!status || (!status.showPromoBadge && !status.showMaintBadge)) return;

        if (window.getComputedStyle(cardEl).position === 'static') cardEl.style.position = 'relative';
        cardEl.style.overflow = 'visible';

        const badgeWrap = document.createElement('div');
        badgeWrap.className = 'bs-card-top-badges';
        badgeWrap.style.cssText = 'position:absolute; top:-6px; right:-6px; display:flex; flex-direction:row; gap:3px; z-index:9999; pointer-events:auto;';

        if (status.showPromoBadge) {
            const pBadge = document.createElement('span');
            pBadge.innerText = '승급';
            pBadge.title = `[승급 ${status.promoPct}% 달성] 목표: ${status.promoTargetRank}`;
            pBadge.style.cssText = 'background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; font-size:10px; font-weight:800; line-height:1; padding:3px 6px; border-radius:4px; border:1px solid #60a5fa; box-shadow:0 2px 5px rgba(0,0,0,0.6); white-space:nowrap; cursor:pointer;';
            badgeWrap.appendChild(pBadge);
        }

        if (status.showMaintBadge) {
            const mBadge = document.createElement('span');
            mBadge.innerText = '품위유지';
            mBadge.title = `[품위유지 ${status.maintPct}% 달성]`;
            mBadge.style.cssText = 'background:linear-gradient(135deg, #059669, #047857); color:#fff; font-size:10px; font-weight:800; line-height:1; padding:3px 6px; border-radius:4px; border:1px solid #34d399; box-shadow:0 2px 5px rgba(0,0,0,0.6); white-space:nowrap; cursor:pointer;';
            badgeWrap.appendChild(mBadge);
        }

        cardEl.appendChild(badgeWrap);
    });
};

// ============================================================================
// [12] 좌측 '매출 및 구독 내역' 패널 CRUD (행 추가/수기 쉼표 입력/삭제 & TiDB 저장)
// ============================================================================
window.deletedSaleDbIds = window.deletedSaleDbIds || new Set();
window.hasUnsavedSalesChanges = false;

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

window.markSalesUnsaved = function(isDirty) {
    window.hasUnsavedSalesChanges = isDirty;
    const salesW = document.getElementById('salesWidget') || window.getSmartLeftPanel();
    const saveBtn = salesW ? salesW.querySelector('.widget-header button, #salesWidgetHeader button') : null;
    const statusEl = document.getElementById('sales-sync-status');

    if (saveBtn) {
        if (isDirty) {
            saveBtn.style.setProperty('color', '#fbbf24', 'important');
            saveBtn.title = '변경된 매출 내역이 있습니다. 클릭하여 TiDB에 저장하세요!';
        } else {
            saveBtn.style.removeProperty('color');
            saveBtn.title = '현재 매출 내역 TiDB 저장';
        }
    }
    if (statusEl) {
        statusEl.innerText = isDirty ? '● 미저장 변경있음 (상단 💾 클릭)' : '✓ TiDB 동기화됨';
        statusEl.style.color = isDirty ? '#fbbf24' : '#10b981';
    }
};

// [12-3] 좌측 패널 내부 모든 박스(검색창 ~ 행 추가 버튼 ~ 총 건수 ~ 테이블 ~ 합계) 간격을 8px로 균일하게 정렬
window.ensureSalesPanelCRUDLayout = function() {
    const salesW = document.getElementById('salesWidget') ? document.getElementById('salesWidget') : window.getSmartLeftPanel();
    if (!salesW) return null;

    if (!salesW.dataset.initCollapsed) {
        salesW.dataset.initCollapsed = 'true';
        salesW.classList.add('closed');
        salesW.style.setProperty('transform', 'translateX(-100%)', 'important');
        const perfW = document.getElementById('perfWidget');
        if (perfW) perfW.style.setProperty('left', '0px', 'important');
    }

    const headerSaveBtn = salesW.querySelector('.widget-header button, #salesWidgetHeader button');
    if (headerSaveBtn) {
        headerSaveBtn.title = '현재 매출 내역 TiDB 즉시 저장';
        headerSaveBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.saveAllMemberSalesToTiDB();
        };
    }

    const bodyEl = salesW.querySelector('.widget-body') ? salesW.querySelector('.widget-body') : salesW;
    bodyEl.style.setProperty('display', 'flex', 'important');
    bodyEl.style.setProperty('flex-direction', 'column', 'important');
    bodyEl.style.setProperty('height', 'calc(100% - 52px)', 'important');
    bodyEl.style.setProperty('overflow', 'hidden', 'important');
    bodyEl.style.setProperty('padding', '10px 10px 8px 10px', 'important');
    bodyEl.style.setProperty('gap', '8px', 'important');
    bodyEl.style.setProperty('box-sizing', 'border-box', 'important');

    // 1. 기존 HTML 구형 테이블 헤더 및 빈 여백 컨테이너 숨김 + 검색창 컨테이너 외부 여백 초기화
    let existingRowsContainer = document.getElementById('sales-rows-container') ? document.getElementById('sales-rows-container') : document.getElementById('sales-list-tbody');
    if (existingRowsContainer && existingRowsContainer.tagName !== 'TBODY') {
        existingRowsContainer.style.setProperty('display', 'none', 'important');
    }

    Array.from(bodyEl.children).forEach(function(child) {
        if (child.id === 'sales-crud-wrapper') return;

        // 검색창(패널 회원명 / ID 검색...)을 감싸는 박스의 불필요한 바깥 여백을 0으로 통일
        const searchInp = child.querySelector('input[type="text"], input[type="search"], #salesSearchInput');
        if (searchInp) {
            child.style.setProperty('flex-shrink', '0', 'important');
            child.style.setProperty('margin', '0', 'important');
            child.style.setProperty('padding', '0', 'important');
            child.style.setProperty('border', 'none', 'important');
            if (searchInp.parentElement && searchInp.parentElement !== child && searchInp.parentElement !== bodyEl) {
                searchInp.parentElement.style.setProperty('margin', '0', 'important');
            }
            return;
        }

        const txt = (child.innerText ? child.innerText : '').trim();
        if (txt.includes('MMDD')) {
            child.style.setProperty('flex-shrink', '0', 'important');
            child.style.setProperty('margin', '0', 'important');
            child.style.setProperty('padding', '2px 0 0 0', 'important');
            return;
        }

        if ((txt.includes('구분') && txt.includes('날짜')) ? true : (child.tagName === 'TABLE' ? true : (child.classList.contains('sales-table-header') ? true : child.classList.contains('table-scroll-container')))) {
            child.style.setProperty('display', 'none', 'important');
        }
    });

    bodyEl.querySelectorAll('div, table, thead').forEach(function(el) {
        if (el.closest('#sales-crud-wrapper')) return;
        if (el.querySelector('input')) return;
        const t = (el.innerText ? el.innerText : '').replace(/\s+/g, ' ').trim();
        if (t === '구분 날짜 ↑ CV PV' ? true : (t === '구분 날짜 ↓ CV PV' ? true : (t === '구분 날짜 CV PV'))) {
            el.style.setProperty('display', 'none', 'important');
            if (el.nextElementSibling && el.nextElementSibling.id !== 'sales-crud-wrapper' && !el.nextElementSibling.innerText.includes('MMDD')) {
                el.nextElementSibling.style.setProperty('display', 'none', 'important');
            }
        }
    });

    let crudWrapper = document.getElementById('sales-crud-wrapper');
    if (!crudWrapper) {
        crudWrapper = document.createElement('div');
        crudWrapper.id = 'sales-crud-wrapper';
    }

    // 🌟 검색창과의 간격 및 내부 박스들 사이의 간격을 모두 동일하게 8px(gap: 8px, padding: 0)로 통일!
    crudWrapper.style.cssText = 'display: flex !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important; gap: 8px !important; box-sizing: border-box !important;';

    if (!crudWrapper.dataset.layoutBuiltV39) {
        crudWrapper.dataset.layoutBuiltV39 = 'true';
        crudWrapper.innerHTML = [
            '<div style="flex-shrink: 0; margin: 0; padding: 0;">',
            '    <button type="button" onclick="window.appendBlankSaleRow()" style="width: 100%; height: 34px; padding: 0 8px; background: #1f2937; color: #60a5fa; border: 1px dashed #4b5563; border-radius: 6px; font-size: 11.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">+ 매출 / 구독 행 추가</button>',
            '</div>',
            '<div style="display: flex; justify-content: space-between; align-items: center; height: 32px; padding: 0 10px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; font-size: 11px; color: #d1d5db; flex-shrink: 0; box-sizing: border-box; margin: 0;">',
            '    <span id="sales-count-label">총 0건</span>',
            '    <span id="sales-sync-status" style="font-size: 10px; color: #10b981;">● 연동 대기</span>',
            '</div>',
            '<div id="sales-table-scroll-box" style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #374151; border-radius: 6px; background: #111827; display: flex; flex-direction: column; margin: 0;">',
            '    <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">',
            '        <colgroup><col style="width: 44px;"><col style="width: 78px;"><col style="width: auto;"><col style="width: auto;"><col style="width: 24px;"></colgroup>',
            '        <thead style="background: #1f2937; color: #9ca3af; position: sticky; top: 0; z-index: 2;">',
            '            <tr>',
            '                <th style="padding: 6px 2px; border-bottom: 1px solid #374151; text-align: center;">구분</th>',
            '                <th style="padding: 6px 2px; border-bottom: 1px solid #374151; text-align: center; cursor: pointer;" onclick="window.toggleSalesSortOrder()">날짜 <span id="sales-sort-arrow">↓</span></th>',
            '                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: right;">CV</th>',
            '                <th style="padding: 6px 4px; border-bottom: 1px solid #374151; text-align: right;">PV</th>',
            '                <th style="padding: 6px 1px; border-bottom: 1px solid #374151; text-align: center;">✕</th>',
            '            </tr>',
            '        </thead>',
            '        <tbody id="sales-crud-tbody">',
            '            <tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #6b7280;">계보도에서 회원 카드를 선택해 주세요.</td></tr>',
            '        </tbody>',
            '    </table>',
            '</div>',
            '<div style="display: flex; justify-content: space-between; align-items: center; height: 32px; padding: 0 10px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; font-size: 11px; color: #d1d5db; flex-shrink: 0; box-sizing: border-box; margin: 0;">',
            '    <span style="color: #9ca3af;">합계</span>',
            '    <span><b id="sales-sum-cv" style="color: #60a5fa;">0</b> CV / <b id="sales-sum-pv" style="color: #10b981;">0</b> PV</span>',
            '</div>'
        ].join('\n');
    }

    const footerHint = Array.from(bodyEl.children).find(function(el) {
        return el !== crudWrapper && (el.innerText ? el.innerText : '').includes('MMDD');
    });

    if (footerHint) {
        if (crudWrapper.nextElementSibling !== footerHint) {
            bodyEl.insertBefore(crudWrapper, footerHint);
        }
    } else if (crudWrapper.parentElement !== bodyEl) {
        bodyEl.appendChild(crudWrapper);
    }

    return crudWrapper;
};

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
                <input type="text" class="edit-sale-date" value="${dStr}" placeholder="MMDD" onblur="window.formatDateMMDD(this); window.onSaleRowFieldChange(this);" onkeydown="if(event.key==='Enter') this.blur();" style="width: 100%; box-sizing: border-box; background: #111827; color: #d1d5db; border: 1px solid #374151; border-radius: 3px; padding: 3px 2px; font-size: 10.5px; text-align: center;">
            </td>
            <td style="padding: 3px 2px;">
                <input type="text" inputmode="numeric" class="edit-sale-cv" value="${cvDisplay}" placeholder="0" oninput="window.onSaleNumberInput(this);" onkeydown="if(event.key==='Enter') window.saveAllMemberSalesToTiDB();" style="width: 100%; box-sizing: border-box; background: #111827; color: #60a5fa; font-weight: bold; border: 1px solid #374151; border-radius: 3px; padding: 3px 4px; font-size: 11px; text-align: right;">
            </td>
            <td style="padding: 3px 2px;">
                <input type="text" inputmode="numeric" class="edit-sale-pv" value="${pvDisplay}" placeholder="0" oninput="window.onSaleNumberInput(this);" onkeydown="if(event.key==='Enter') window.saveAllMemberSalesToTiDB();" style="width: 100%; box-sizing: border-box; background: #111827; color: #10b981; font-weight: bold; border: 1px solid #374151; border-radius: 3px; padding: 3px 4px; font-size: 11px; text-align: right;">
            </td>
            <td style="padding: 3px 1px; text-align: center;">
                <button onclick="window.deleteSaleRecord('${dbId}', this)" style="background: transparent; color: #ef4444; border: 1px solid #374151; border-radius: 3px; cursor: pointer; padding: 2px 3px; font-size: 10px; font-weight: bold;">✕</button>
            </td>
        </tr>
    `;
};

window.onSaleRowFieldChange = function(inputEl) {
    const tr = inputEl ? inputEl.closest('tr.sale-edit-row') : null;
    if (tr) tr.setAttribute('data-dirty', 'true');
    window.markSalesUnsaved(true);
    window.recalcSalesPanelSummary();
};

window.recalcSalesPanelSummary = function() {
    const rows = document.querySelectorAll('#sales-crud-tbody tr.sale-edit-row');
    let totalCv = 0, totalPv = 0;
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
    if (!memberId) return alert('먼저 계보도에서 매출을 등록할 회원 카드를 클릭해 선택해 주세요.');
    window.ensureSalesPanelCRUDLayout();
    const tbody = document.getElementById('sales-crud-tbody');
    if (!tbody) return;
    if (!tbody.querySelector('tr.sale-edit-row')) tbody.innerHTML = '';

    tbody.insertAdjacentHTML('beforeend', window.buildSaleRowHTML({ id: 'new_' + Date.now(), category: '매출', transaction_date: window.getTodayString(), cv: '', pv: '' }, true));
    window.markSalesUnsaved(true);
    window.recalcSalesPanelSummary();
};

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

    const normTarget = String(memberId).trim().toLowerCase().replace(/^v[kj]-?/, '');

    if (window.API_BASE) {
        try {
            const res = await fetch(`${window.API_BASE}/api/sales/history?member_id=${encodeURIComponent(memberId)}`);
            if (res.ok) {
                const dbRows = await res.json();
                if (Array.isArray(dbRows)) {
                    window.integrated_sales_history = (window.integrated_sales_history || []).filter(item => String(item.member_id || '').trim().toLowerCase().replace(/^v[kj]-?/, '') !== normTarget);
                    dbRows.forEach(r => {
                        window.integrated_sales_history.push({
                            id: r.id, _dbId: r.id, member_id: r.member_id,
                            category: r.category || '매출',
                            transaction_date: window.cleanDateStr(r.transaction_date || r.date || ''),
                            cv: window.parseCommaNumber(r.cv), pv: window.parseCommaNumber(r.pv)
                        });
                    });
                }
            }
            window.markSalesUnsaved(false);
            if (statusEl) { statusEl.innerText = showToast ? '✓ TiDB 저장 완료!' : '● TiDB 실시간 연동됨'; statusEl.style.color = '#10b981'; }
        } catch (err) {}
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
    if (!tbody || !memberId) return;

    const normTarget = String(memberId).trim().toLowerCase().replace(/^v[kj]-?/, '');
    const allSales = window.integrated_sales_history || [];
    const memberSales = allSales.filter(item => item && String(item.member_id || item.memberId || '').trim().toLowerCase().replace(/^v[kj]-?/, '') === normTarget);

    memberSales.sort((a, b) => {
        const dA = window.cleanDateStr(a.transaction_date || a.date || '');
        const dB = window.cleanDateStr(b.transaction_date || b.date || '');
        return window.salesSortOrder === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
    });

    if (memberSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 25px 10px; text-align: center; color: #9ca3af;">등록된 매출/구독 내역이 없습니다.</td></tr>`;
    } else {
        tbody.innerHTML = memberSales.map(row => window.buildSaleRowHTML(row, false)).join('');
    }
    window.recalcSalesPanelSummary();
};

window.refreshAfterSalesMutation = async function(memberId) {
    if (!memberId) return;
    if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(memberId);
};

window.saveAllMemberSalesToTiDB = async function() {
    const memberId = window.currentSelectedId;
    if (!memberId) return alert('먼저 계보도에서 회원을 선택해 주세요.');
    const tbody = document.getElementById('sales-crud-tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr.sale-edit-row'));
    try {
        for (const delId of Array.from(window.deletedSaleDbIds)) {
            if (window.API_BASE) await fetch(`${window.API_BASE}/api/sales/history/${encodeURIComponent(delId)}`, { method: 'DELETE' });
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

            if (isNew && cv === 0 && pv === 0) { tr.remove(); continue; }

            if ((isNew || isDirty) && window.API_BASE) {
                const res = await fetch(`${window.API_BASE}/api/sales/history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: isNew ? null : saleId, _dbId: isNew ? null : saleId, member_id: memberId, category, transaction_date, cv, pv })
                });
                const data = await res.json();
                if (data && data.id) tr.setAttribute('data-sale-id', String(data.id));
                tr.setAttribute('data-is-new', 'false');
                tr.setAttribute('data-dirty', 'false');
            }
        }

        await window.loadMemberSales(memberId, true);
        await window.refreshAfterSalesMutation(memberId);
        window.markSalesUnsaved(false);
    } catch (err) {
        alert(`매출 저장 중 오류가 발생했습니다: ${err.message}`);
    }
};

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
    if (!confirm('선택한 매출/구독 내역을 삭제하시겠습니까?')) return;

    try {
        if (window.API_BASE) await fetch(`${window.API_BASE}/api/sales/history/${encodeURIComponent(saleId)}`, { method: 'DELETE' });
        window.integrated_sales_history = (window.integrated_sales_history || []).filter(item => String(item._dbId || item.id) !== String(saleId));
        if (tr) tr.remove();
        window.recalcSalesPanelSummary();
        await window.refreshAfterSalesMutation(memberId);
    } catch (err) {}
};

// ============================================================================
// [13] 통합 회원/추천인 검색 및 복수 카드 선택(하이라이트) 유지 로직
// ============================================================================
window.searchedHighlightIds = new Set();

window.normalizeSearchTerm = function(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
};

window.panToMemberCard = function(memberId) {
    const wrapper = document.getElementById('tree-wrapper');
    const container = document.getElementById('canvas-container') || document.body;
    if (!wrapper || !container || !memberId) return;

    let targetCard = null;
    document.querySelectorAll('.node-card').forEach(el => {
        const cardId = el.id.replace(/^card_/, '');
        if (typeof window.isSameMemberId === 'function' && window.isSameMemberId(cardId, memberId)) targetCard = el;
    });
    if (!targetCard) return;

    let offsetLeftSum = 0, offsetTopSum = 0, curr = targetCard;
    while (curr && curr !== wrapper) {
        offsetLeftSum += curr.offsetLeft;
        offsetTopSum += curr.offsetTop;
        curr = curr.offsetParent;
    }

    const cardCenterX = offsetLeftSum + (targetCard.offsetWidth / 2);
    const cardCenterY = offsetTopSum + (targetCard.offsetHeight / 2);
    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight;

    window.panX = (containerWidth / 2) - (cardCenterX * window.scale);
    window.panY = (containerHeight / 3) - (cardCenterY * window.scale);

    wrapper.style.setProperty('transform-origin', '0 0', 'important');
    wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
};

window.applyCardHighlights = function() {
    document.querySelectorAll('.node-card').forEach(el => {
        const cardId = el.id.replace(/^card_/, '');
        const normCardId = window.normalizeSearchTerm(cardId);
        const isSelected = window.currentSelectedId && typeof window.isSameMemberId === 'function' && window.isSameMemberId(cardId, window.currentSelectedId);
        const isSearched = window.searchedHighlightIds && window.searchedHighlightIds.has(normCardId);

        if (isSearched) {
            el.style.setProperty('border', '2.5px solid #f59e0b', 'important');
            el.style.setProperty('box-shadow', '0 0 18px rgba(245, 158, 11, 0.85)', 'important');
        } else if (isSelected) {
            el.style.setProperty('border', '2px solid #10b981', 'important');
            el.style.setProperty('box-shadow', '0 0 12px rgba(16, 185, 129, 0.5)', 'important');
        } else {
            el.style.removeProperty('border');
            el.style.removeProperty('box-shadow');
        }
    });
};

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
        return mIdNorm.includes(normKey) || mName.includes(normKey);
    });

    if (matchedNodes.length === 0) return alert(`'${rawKeyword}'에 해당하는 회원을 찾을 수 없습니다.`);

    window.searchedHighlightIds.clear();
    matchedNodes.forEach(m => window.searchedHighlightIds.add(window.normalizeSearchTerm(m.id)));
    window.applyCardHighlights();
    window.panToMemberCard(matchedNodes[0].id);
};

// ============================================================================
// [14] 줌/드래그 및 캔버스 상호작용
// ============================================================================
window.changeZoom = function(delta, mouseX = null, mouseY = null) {
    const wrapper = document.getElementById('tree-wrapper');
    const container = document.getElementById('canvas-container') || document.body;
    if (!wrapper || !container) return;

    const oldScale = window.scale || 0.85;
    window.scale = Math.min(3, Math.max(0.1, oldScale + delta));

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

window.resetZoomAndPan = window.centerRootNode;

let isDraggingCanvas = false;
let canvasDragStartX = 0, canvasDragStartY = 0;

function initCanvasDrag() {
    const canvas = document.getElementById('canvas-container') || document.querySelector('.canvas-container') || document.querySelector('main') || document.body;
    let isClickCandidate = false, startX = 0, startY = 0;

    canvas.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.widget, .node-card, .zoom-controls, .top-header-bar, button, input, select, .left-panel, aside, .settings-menu, .modal')) return;
        isDraggingCanvas = true;
        isClickCandidate = true;
        startX = e.clientX; startY = e.clientY;
        canvasDragStartX = e.clientX - (window.panX || 0);
        canvasDragStartY = e.clientY - (window.panY || 0);
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDraggingCanvas) return;
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) isClickCandidate = false;
        e.preventDefault();
        window.panX = e.clientX - canvasDragStartX;
        window.panY = e.clientY - canvasDragStartY;
        const wrapper = document.getElementById('tree-wrapper');
        if (wrapper) wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
    });

    window.addEventListener('pointerup', () => {
        if (isDraggingCanvas && isClickCandidate && typeof window.closeAllWidgetsAndModals === 'function') {
            window.closeAllWidgetsAndModals();
        }
        isDraggingCanvas = false;
        isClickCandidate = false;
        if (canvas) canvas.style.cursor = '';
    });
}

window.toggleFullScreen = function() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen();
};

window.closeAllWidgetsAndModals = function() {
    const settingsMenu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (settingsMenu) settingsMenu.style.display = 'none';

    const perfW = document.getElementById('perfWidget');
    if (perfW && window.getComputedStyle(perfW).display !== 'none') {
        const isClosed = perfW.classList.contains('closed') || perfW.getAttribute('data-minimized') === 'true';
        if (!isClosed) window.setPerfSidebarState(true);
    }
};

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
        if (currentH > 60) perfW.setAttribute('data-orig-height', `${currentH}px`);
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

window.toggleSalesSidebar = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const salesW = document.getElementById('salesWidget');
    if (!salesW) return;
    salesW.style.removeProperty('transform');
    const isClosed = salesW.classList.toggle('closed');
    const perfW = document.getElementById('perfWidget');
    if (perfW) perfW.style.setProperty('left', isClosed ? '0px' : '330px', 'important');
    setTimeout(() => { if (typeof window.centerRootNode === 'function') window.centerRootNode(); }, 310);
};

// ============================================================================
// [15] 노드 클릭/더블클릭 통합 제어 및 회원정보 편집·삭제 모달 로직
// ============================================================================
window.executeNodeSingleClick = async function(id) {
    const modal = document.getElementById('addPartnerModal');
    if (modal && window.getComputedStyle(modal).display !== 'none') {
        const sponInput = document.getElementById('m-spon-id');
        if (sponInput) sponInput.value = window.findMemberNode(id) ? window.findMemberNode(id).id : id;
        window.addPartnerState.sponsorId = sponInput ? sponInput.value : id;
        if (typeof window.updateModalCodeByPos === 'function') window.updateModalCodeByPos();
        return;
    }

    if (window.searchedHighlightIds && window.searchedHighlightIds.size > 0) window.searchedHighlightIds.clear();

    window.currentSelectedId = id;
    let member = window.findMemberNode(id);
    const memberId = member ? member.id : id;

    if (window.treeMode !== 'recommender' && typeof window.computeDynamicCodes === 'function') {
        window.computeDynamicCodes(memberId);
        document.querySelectorAll('.node-card').forEach(el => {
            const cId = el.id.replace(/^card_/, '');
            const codeDiv = el.querySelector('.t-code');
            if (codeDiv && typeof window.getDynamicCode === 'function') codeDiv.innerText = window.getDynamicCode(cId);
        });
    }

    if (typeof window.updateHeaderLineCount === 'function') window.updateHeaderLineCount(memberId);

    const perfName = document.getElementById('perf-target-name');
    if (perfName) perfName.innerText = `(${member ? member.name : id} / ${memberId})`;
    const salesName = document.getElementById('sales-target-name');
    if (salesName) salesName.innerText = `${member ? member.name : id} (${memberId})`;

    if (typeof window.applyCardHighlights === 'function') window.applyCardHighlights();
    if (typeof window.loadMemberSales === 'function') await window.loadMemberSales(memberId);
    if (typeof window.calculateLocalPerformance === 'function') window.calculateLocalPerformance(memberId);
};

window.handleNodeClickLogic = function(id) {
    if (!id) return;
    if (window.cardClickTimer) { clearTimeout(window.cardClickTimer); window.cardClickTimer = null; }
    window.cardClickTimer = setTimeout(async () => {
        window.cardClickTimer = null;
        await window.executeNodeSingleClick(id);
    }, 220);
};

window.initMemberEditModal = function() {
    if (document.getElementById('memberEditModal')) return;

    const modalHTML = `
        <div id="memberEditModal" class="widget modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-height: 88vh; background: #1f2937; border: 1px solid #4b5563; border-radius: 10px; color: #fff; z-index: 100000; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; flex-direction: column;">
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #111827; border-bottom: 1px solid #374151; cursor: default;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 13.5px; color: #60a5fa;">
                    <span>✏️</span><span>회원 DB 전체 정보 편집 및 관리</span>
                </div>
                <button class="icon-btn-mac close" onclick="window.closeMemberEditModal()" title="닫기">✕</button>
            </div>
            <div style="padding: 16px; overflow-y: auto; max-height: calc(88vh - 110px); display: flex; flex-direction: column; gap: 12px; font-size: 12px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><label style="display: block; color: #9ca3af; margin-bottom: 4px; font-size: 11px;">회원 ID (더블클릭 시 잠금해제)</label><input type="text" id="edit-m-id" readonly style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #374151; color: #9ca3af; border-radius: 4px; font-weight: bold;"></div>
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">회원 이름 (name) *</label><input type="text" id="edit-m-name" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; font-weight: bold;"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">직급 (rank)</label>
                        <select id="edit-m-rank" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                            <option value="GUEST">GUEST</option><option value="MEMBER">MEMBER</option><option value="MANIA">MANIA</option><option value="DIRECTOR">DIRECTOR</option><option value="EMERALD">EMERALD</option><option value="DIAMOND">DIAMOND</option><option value="GREEN DIAMOND">GREEN DIAMOND</option><option value="BLUE DIAMOND">BLUE DIAMOND</option><option value="RED DIAMOND">RED DIAMOND</option><option value="CROWN">CROWN</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">회원 구분</label>
                        <select id="edit-m-type" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                            <option value="사업자">사업자</option><option value="소비자">소비자</option><option value="복제">복제</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">후원인 ID (parent_id)</label><input type="text" id="edit-m-sponid" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;"></div>
                    <div>
                        <label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">배치 라인 (position)</label>
                        <select id="edit-m-pos" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;">
                            <option value="left">A라인 (좌측)</option><option value="right">B라인 (우측)</option><option value="root">최상위 (Root)</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">추천인 ID</label><input type="text" id="edit-m-recid" oninput="window.autoFillRecommenderName(this.value)" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;"></div>
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">추천인 이름</label><input type="text" id="edit-m-recname" style="width: 100%; box-sizing: border-box; padding: 7px 8px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px;"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">가입일</label><input type="text" id="edit-m-joindate" onblur="window.formatDateMMDD(this)" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #fff; border-radius: 4px; text-align: center;"></div>
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">최초매출일</label><input type="text" id="edit-m-firstsales" onblur="window.formatDateMMDD(this)" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #60a5fa; font-weight: bold; border-radius: 4px; text-align: center;"></div>
                    <div><label style="display: block; color: #d1d5db; margin-bottom: 4px; font-size: 11px;">최종매출일</label><input type="text" id="edit-m-lastsales" onblur="window.formatDateMMDD(this)" style="width: 100%; box-sizing: border-box; padding: 7px 6px; background: #111827; border: 1px solid #4b5563; color: #10b981; font-weight: bold; border-radius: 4px; text-align: center;"></div>
                </div>
                <div id="edit-m-extra-section" style="display: none; flex-direction: column; gap: 8px;"><div id="edit-m-extra-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"></div></div>
            </div>
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

window.autoFillRecommenderName = function(val) {
    const recNameEl = document.getElementById('edit-m-recname');
    if (!recNameEl) return;
    const cleanVal = String(val || '').trim();
    if (!cleanVal) { recNameEl.value = ''; return; }
    const recNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(cleanVal) : null;
    if (recNode && recNode.name) recNameEl.value = recNode.name;
};

window.findParentAndPosition = function(targetId) {
    let result = { parentNode: null, position: 'root' };
    if (!targetId || !window.treeData) return result;
    if (window.isSameMemberId(window.treeData.id, targetId)) return result;

    const visited = new Set();
    function searchParent(curr) {
        if (!curr || !curr.id || result.parentNode) return;
        const key = String(curr.id).trim().toUpperCase();
        if (visited.has(key)) return;
        visited.add(key);

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

window.openEditMemberModal = async function(memberId) {
    window.initMemberEditModal();
    const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
    if (!node) return;
    const modal = document.getElementById('memberEditModal');
    if (!modal) return;

    const idEl = document.getElementById('edit-m-id');
    idEl.value = node.id || node.member_id || '';
    idEl.dataset.originalId = idEl.value;
    document.getElementById('edit-m-name').value = node.name || node.member_name || '';

    const rankEl = document.getElementById('edit-m-rank');
    const nodeRank = (node.rank || node.rank_name || 'GUEST').toUpperCase();
    if (rankEl) rankEl.value = nodeRank;

    const typeEl = document.getElementById('edit-m-type');
    if (typeEl) typeEl.value = node.type || node.member_type || '사업자';

    const parentInfo = window.findParentAndPosition(node.id);
    const sponId = (parentInfo.parentNode ? parentInfo.parentNode.id : '') || node.parent_id || '';
    let posVal = parentInfo.position;
    if (posVal === 'root' && sponId) {
        const rawPos = String(node.position || '').toLowerCase();
        posVal = (rawPos.includes('right') || rawPos.includes('b')) ? 'right' : 'left';
    }
    document.getElementById('edit-m-sponid').value = sponId;
    const posEl = document.getElementById('edit-m-pos');
    if (posEl) posEl.value = posVal;

    const recId = node.recId || node.recommender_id || '';
    let recName = node.recName || node.recommender_name || '';
    if (!recName && recId) {
        const rNode = window.findMemberNode(recId);
        if (rNode) recName = rNode.name || '';
    }
    document.getElementById('edit-m-recid').value = recId;
    document.getElementById('edit-m-recname').value = recName;

    const rawJoin = node.joinDate || node.join_date || '';
    const joinDate = (rawJoin && rawJoin !== '-') ? window.cleanDateStr(rawJoin) : '';
    const histDates = window.getSalesDatesFromHistory(node.id, joinDate);

    document.getElementById('edit-m-joindate').value = joinDate;
    document.getElementById('edit-m-firstsales').value = histDates.first || joinDate;
    document.getElementById('edit-m-lastsales').value = histDates.last || joinDate;

    modal.style.setProperty('display', 'flex', 'important');
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

window.reRenderTreeKeepViewport = function() {
    const savedPanX = window.panX;
    const savedPanY = window.panY;
    const savedScale = window.scale;
    const origCenterFn = window.centerRootNode;

    window.centerRootNode = function() {};
    if (typeof window.renderTree === 'function') window.renderTree(false);

    setTimeout(() => {
        window.centerRootNode = origCenterFn;
        window.panX = savedPanX;
        window.panY = savedPanY;
        window.scale = savedScale;
        const wrapper = document.getElementById('tree-wrapper');
        if (wrapper) wrapper.style.setProperty('transform', `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`, 'important');
    }, 180);
};

window.saveMemberEditFromModal = async function() {
    const idEl = document.getElementById('edit-m-id');
    const newId = idEl?.value.trim();
    const origId = (idEl?.dataset.originalId || newId || '').trim();
    const name = document.getElementById('edit-m-name')?.value.trim();
    const rank = document.getElementById('edit-m-rank')?.value || 'GUEST';
    const type = document.getElementById('edit-m-type')?.value || '사업자';
    let sponId = document.getElementById('edit-m-sponid')?.value.trim();
    const pos = document.getElementById('edit-m-pos')?.value;
    let recId = document.getElementById('edit-m-recid')?.value.trim();
    let recName = document.getElementById('edit-m-recname')?.value.trim();

    const joinEl = document.getElementById('edit-m-joindate');
    const firstEl = document.getElementById('edit-m-firstsales');
    const lastEl = document.getElementById('edit-m-lastsales');
    if (joinEl) window.formatDateMMDD(joinEl, false);
    if (firstEl) window.formatDateMMDD(firstEl, false);
    if (lastEl) window.formatDateMMDD(lastEl, false);

    const joinDate = joinEl ? window.cleanDateStr(joinEl.value.trim()) : '';
    const firstSales = (firstEl && firstEl.value.trim()) ? window.cleanDateStr(firstEl.value.trim()) : joinDate;
    const lastSales = (lastEl && lastEl.value.trim()) ? window.cleanDateStr(lastEl.value.trim()) : joinDate;

    if (!newId || !name) return alert('회원 ID와 이름을 입력해 주세요.');

    const dbPos = (pos === 'right' || pos === 'B') ? 'B' : 'A';
    const finalParentId = (pos === 'root') ? null : (sponId || null);

    if (window.API_BASE) {
        try {
            await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(origId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalId: origId, id: newId, newId: newId, member_id: newId,
                    name, rank, rank_name: rank, type, member_type: type,
                    parentId: finalParentId, parent_id: finalParentId, position: dbPos,
                    recId, recommender_id: recId, recName, recommender_name: recName,
                    joinDate, join_date: joinDate, firstSales, first_sales_date: firstSales, lastSales, last_sales_date: lastSales
                })
            });
        } catch (err) {}
    }

    window.closeMemberEditModal();
    if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
};

window.deleteMemberFromModal = async function() {
    const id = document.getElementById('edit-m-id')?.value.trim();
    if (!id) return;
    if (!confirm(`'${id}' 회원을 삭제하시겠습니까?`)) return;

    if (window.API_BASE) {
        try {
            await fetch(`${window.API_BASE}/api/member/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {}
    }
    window.closeMemberEditModal();
    if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
};

// ============================================================================
// [16] 앱 초기 부팅 및 새로고침 시 좌측/하단 패널 강제 접힘 세팅
// ============================================================================
function initApp() {
    const settingsMenu = document.getElementById('settingsDropdown') || document.getElementById('settingsMenu') || document.querySelector('.settings-menu');
    if (settingsMenu) settingsMenu.style.setProperty('display', 'none', 'important');

    if (!document.getElementById('panels-collapse-fix-css')) {
        const fixStyle = document.createElement('style');
        fixStyle.id = 'panels-collapse-fix-css';
        fixStyle.innerHTML = `
            #salesWidget.closed, .sales-panel.closed, aside.closed { transform: translateX(-100%) !important; }
            #salesWidget.closed .widget-body, .sales-panel.closed .widget-body { display: none !important; }
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
    }

    if (typeof window.setPerfSidebarState === 'function') window.setPerfSidebarState(true);
    const perfW = document.getElementById('perfWidget');
    if (perfW) perfW.style.setProperty('left', '0px', 'important');

    if (typeof window.reorganizePopupSettingsCategory === 'function') window.reorganizePopupSettingsCategory();

    initCanvasDrag();
    if (typeof window.fetchTreeData === 'function') window.fetchTreeData(true);
}

window.initApp = initApp;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();

// ============================================================================
// [17] 시뮬레이터 본체 데이터 가로채기(Hook) 및 내비게이터 팝업 연동
// ============================================================================
(function applySafeNavigatorAndBadgePatch() {
    window.forceOpenBizNavPopup = function() {
        if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed) {
            window.bizNavPopupWindow.focus();
            if (typeof window.renderBusinessNavigator === 'function') {
                window.renderBusinessNavigator(window.currentSelectedId, window.bizNavPopupWindow.document);
            }
            return;
        }

        const w = parseInt(localStorage.getItem('bs_biz_nav_popup_w') || '680', 10) || 680;
        const h = parseInt(localStorage.getItem('bs_biz_nav_popup_h') || '760', 10) || 760;
        const popup = window.open('', 'BizNavigatorPopup', `width=${w},height=${h},left=100,top=70,resizable=yes,scrollbars=yes`);
        if (!popup) return;
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

        setTimeout(() => {
            if (typeof window.renderBusinessNavigator === 'function') {
                window.renderBusinessNavigator(window.currentSelectedId, doc);
            }
        }, 120);
    };

    window.openBizNavigatorPopupWindow = window.forceOpenBizNavPopup;
    window.toggleBizNavigator = function(forceShow) {
        const isOpen = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
        const shouldOpen = (forceShow !== undefined) ? Boolean(forceShow) : !isOpen;
        if (shouldOpen) window.forceOpenBizNavPopup();
        else if (isOpen) {
            window.bizNavPopupWindow.close();
            window.bizNavPopupWindow = null;
        }
    };

    window.renderBusinessNavigator = async function(targetMemberId, optDoc = null) {
        const popup = window.bizNavPopupWindow;
        const pDoc = optDoc || ((popup && !popup.closed) ? popup.document : document);
        if (!pDoc) return;
        const bodyEl = pDoc.getElementById('bizNavBody');
        const badgeEl = pDoc.getElementById('bizNavTargetBadge');
        if (!bodyEl) return;

        if (typeof window.loadDbCompensationRates === 'function') await window.loadDbCompensationRates();

        const defaultRoot = window.getAbsoluteTopRoot();
        let targetId = targetMemberId || window.currentSelectedId || (defaultRoot ? defaultRoot.id : 'VK-1199464');
        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : null;
        if (!mNode) {
            bodyEl.innerHTML = `<div style="padding:30px; text-align:center; color:#9ca3af;">회원 정보를 찾을 수 없습니다. (${targetId})</div>`;
            return;
        }

        if (badgeEl) badgeEl.innerHTML = `[${mNode.name || mNode.id} (<b style="color:#fff;">${mNode.id}</b>)]`;

        const currRank = String(mNode.rank || mNode.rank_name || 'GUEST').toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
        const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'DIRECTOR', minor_leg_pv: 2100000 };
        const reqMinorPV = Number(nextRank.minor_leg_pv || 2100000);

        const { setA, setB } = window.getSublinePartnerSets(mNode);
        const allSales = window.allSalesData || window.integrated_sales_history || [];
        let aTotalPV = 0, bTotalPV = 0;

        allSales.forEach(s => {
            if (!s) return;
            const sNorm = String(s.member_id || s.memberId || '').trim().toLowerCase().replace(/^v[kj]-?/, '');
            const pv = window.parseCommaNumber(s.pv || s.sales_pv || 0);
            if (pv <= 0) return;
            if (setA.has(sNorm)) aTotalPV += pv;
            else if (setB.has(sNorm)) bTotalPV += pv;
        });

        const minorPV = Math.min(aTotalPV, bTotalPV);
        const promoPct = reqMinorPV > 0 ? Math.floor((minorPV / reqMinorPV) * 100) : 0;

        bodyEl.innerHTML = `
            <div style="background:#1f2937; border:1px solid #374151; border-radius:8px; padding:14px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #374151;">
                    <div>
                        <span style="font-size:12px; color:#9ca3af;">승급 목표</span>
                        <div style="font-size:15px; font-weight:bold; color:#fff; margin-top:2px;">${currRank} ➔ ${nextRank.rank_name}</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:11px; color:#9ca3af;">소실적 PV 달성률</span>
                        <div style="font-size:18px; font-weight:bold; color:#60a5fa;">${promoPct}%</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
                    <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                        <div style="color:#9ca3af; font-size:11px;">좌측(A) 누적 PV</div>
                        <div style="color:#fff; font-weight:bold; font-size:14px; margin-top:4px;">${aTotalPV.toLocaleString('ko-KR')} PV</div>
                    </div>
                    <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">
                        <div style="color:#9ca3af; font-size:11px;">우측(B) 누적 PV</div>
                        <div style="color:#fff; font-weight:bold; font-size:14px; margin-top:4px;">${bTotalPV.toLocaleString('ko-KR')} PV</div>
                    </div>
                </div>
            </div>
        `;
    };
})();

// ============================================================================
// [18] 상단 헤더 AI 전략 어드바이저 & 로컬 전용 GitHub 원클릭 업로드 버튼
// ============================================================================
(function initHeaderAIAndGitHubButtons() {
    if (window._headerCustomBtnsInitialized) return;
    window._headerCustomBtnsInitialized = true;

    const isLocalEnv = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '');

    function setupHeaderButtons() {
        let aiBtn = document.getElementById('customAiAdvisorBtn');
        const headerEl = document.querySelector('header, .header, .top-bar');
        if (!headerEl) return;

        if (!aiBtn) {
            aiBtn = document.createElement('button');
            aiBtn.id = 'customAiAdvisorBtn';
            aiBtn.type = 'button';
            aiBtn.title = 'AI 어드바이저';
            aiBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-left:4px; background:transparent; color:#9ca3af; border:1px solid transparent; border-radius:6px; cursor:pointer;';
            aiBtn.innerHTML = '✨';
            aiBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (typeof window.openAIAdvisorPopupWindow === 'function') window.openAIAdvisorPopupWindow();
            };
            headerEl.appendChild(aiBtn);
        }

        if (isLocalEnv && aiBtn.parentNode && !document.getElementById('oneClickGithubBtn')) {
            const ghBtn = document.createElement('button');
            ghBtn.id = 'oneClickGithubBtn';
            ghBtn.type = 'button';
            ghBtn.title = 'GitHub 원클릭 업로드';
            ghBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-left:4px; background:transparent; color:#9ca3af; border:1px solid transparent; border-radius:6px; cursor:pointer;';
            ghBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>`;

            ghBtn.addEventListener('click', async (e) => {
                e.preventDefault(); e.stopPropagation();
                const defaultMemo = typeof window.getGitDefaultMemoTimeStr === 'function' ? window.getGitDefaultMemoTimeStr() : '';
                const memo = prompt('GitHub에 업로드할 작업 메모를 입력하세요:', defaultMemo);
                if (memo === null) return;

                ghBtn.disabled = true;
                try {
                    const response = await fetch(`${window.API_BASE}/api/git-push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: memo.trim() || undefined })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success) throw new Error(result.message || '업로드 실패');
                    alert(`✅ [GitHub 통합 업로드 완료]\n\n${result.message}`);
                } catch (err) {
                    alert(`❌ [GitHub 업로드 오류]\n${err.message}`);
                } finally {
                    ghBtn.disabled = false;
                }
            });

            aiBtn.parentNode.appendChild(ghBtn);
        }
    }

    setTimeout(setupHeaderButtons, 250);
})();

// ============================================================================
// [19] 관리자 로그인 보안 게이트 (프론트엔드 비밀번호 평문 노출 제거 & 서버 인증 전용)
// ============================================================================
(function forceInitLoginSecurityGate() {
    if (window._bsLoginGateMounted) return;
    window._bsLoginGateMounted = true;

    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';

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

    setTimeout(mountLogoutBtn, 500);
})();

// ============================================================================
// [20] 모바일 & 태블릿 반응형 레이아웃 및 컴팩트 헤더 정렬
// ============================================================================
(function initResponsiveAndCompactHeaderV20() {
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
        const visitedA = new Set();
        const visitedB = new Set();

        function countBranchNodes(node, visitedSet) {
            if (!node || !node.id) return 0;
            let key = String(node.id).trim().toUpperCase();
            if (visitedSet.has(key)) return 0;
            visitedSet.add(key);

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
})();

// ============================================================================
// [21] 🔀 가상모드: 최상단 기준 파트너(Root) 스위치 전환, 카드 직접 클릭 픽커 & 히스토리 모달 복원
// ============================================================================
(function initCustomRootSwitchAndVirtualModeV21() {
    if (window._bsCustomRootSwitchRestoredV21) return;
    window._bsCustomRootSwitchRestoredV21 = true;

    const STORAGE_ROOT_KEY = 'bs_saved_custom_root_id';
    const STORAGE_HISTORY_KEY = 'bs_recent_root_history';

    window.isRootCardPickMode = false;

    // 혹시 이전에 VJ-002 등이 잘못 저장되어 있었다면 정리
    try {
        const saved = localStorage.getItem(STORAGE_ROOT_KEY) ? localStorage.getItem(STORAGE_ROOT_KEY) : '';
        if (/^VJ-00[2-9]$/i.test(saved)) {
            localStorage.removeItem(STORAGE_ROOT_KEY);
        }
    } catch (e) {}

    function normId(val) {
        if (!val) return '';
        let s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        return String(s).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
    }

    function injectSubtreeCleanConnectorCSS() {
        if (document.getElementById('bs-subtree-clean-connector-css')) return;
        const st = document.createElement('style');
        st.id = 'bs-subtree-clean-connector-css';
        st.textContent = [
            '[data-bs-root-unwrapped="1"]::before, [data-bs-root-unwrapped="1"]::after { display: none !important; border: none !important; }',
            'body.bs-root-pick-active .node-card { cursor: pointer !important; outline: 2px dashed #60a5fa !important; outline-offset: 2px !important; }',
            'body.bs-root-pick-active .node-card:hover { outline: 3px solid #fbbf24 !important; transform: scale(1.06) !important; z-index: 999 !important; }'
        ].join('\n');
        document.head.appendChild(st);
    }

    function saveToRootHistory(memberNode) {
        if (!memberNode) return;
        const mId = memberNode.id ? memberNode.id : memberNode.member_id;
        if (!mId) return;

        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) ? localStorage.getItem(STORAGE_HISTORY_KEY) : '[]');
            if (!Array.isArray(history)) history = [];
        } catch (e) {
            history = [];
        }

        const entry = {
            id: mId,
            name: memberNode.name ? memberNode.name : (memberNode.member_name ? memberNode.member_name : '-'),
            rank: String(memberNode.rank ? memberNode.rank : (memberNode.rank_name ? memberNode.rank_name : 'GUEST')).toUpperCase(),
            memberType: memberNode.member_type ? memberNode.member_type : (memberNode.type ? memberNode.type : '사업자')
        };

        history = history.filter(function(item) { return normId(item.id) !== normId(entry.id); });
        history.unshift(entry);
        if (history.length > 8) history = history.slice(0, 8);
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    }

    function getRootHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) ? localStorage.getItem(STORAGE_HISTORY_KEY) : '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    // DOM 트리에서 선택한 카드의 서브트리(<li>)만 최상단으로 단독 분리하여 보여주는 가상모드 엔진
    window.isolateSubtreeInDOM = function(targetMemberId) {
        injectSubtreeCleanConnectorCSS();
        const treeRoot = document.getElementById('tree-root') ? document.getElementById('tree-root') : document.querySelector('.tree');
        if (!treeRoot) return false;

        treeRoot.querySelectorAll('[data-bs-root-hidden="1"]').forEach(function(el) {
            el.style.removeProperty('display');
            el.removeAttribute('data-bs-root-hidden');
        });
        treeRoot.querySelectorAll('[data-bs-root-unwrapped="1"]').forEach(function(el) {
            el.style.removeProperty('padding-top');
            el.removeAttribute('data-bs-root-unwrapped');
        });

        if (!targetMemberId) return true;

        const targetNorm = normId(targetMemberId);
        let targetCard = document.getElementById('card_' + targetMemberId);
        if (!targetCard) {
            document.querySelectorAll('.node-card[id^="card_"]').forEach(function(c) {
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
                Array.from(parentUl.children).forEach(function(siblingLi) {
                    if (siblingLi !== currLi && siblingLi.tagName === 'LI') {
                        siblingLi.style.setProperty('display', 'none', 'important');
                        siblingLi.setAttribute('data-bs-root-hidden', '1');
                    }
                });

                parentUl.style.setProperty('padding-top', '0px', 'important');
                parentUl.setAttribute('data-bs-root-unwrapped', '1');

                const ancestorLi = parentUl.parentElement;
                if (ancestorLi && ancestorLi.tagName === 'LI' && treeRoot.contains(ancestorLi)) {
                    Array.from(ancestorLi.children).forEach(function(child) {
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

    window.centerSpecificCardAsRoot = function(targetCardEl) {
        const wrapper = document.getElementById('tree-wrapper') ? document.getElementById('tree-wrapper') : document.querySelector('.tree-wrapper');
        const container = document.getElementById('canvas-container') ? document.getElementById('canvas-container') : (wrapper ? wrapper.parentElement : null);
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!wrapper || !container || !targetCardEl) return;

        window.scale = window.innerWidth <= 640 ? 0.60 : (window.innerWidth <= 1024 ? 0.72 : 0.85);

        wrapper.style.setProperty('transform-origin', '0 0', 'important');
        wrapper.style.setProperty('transform', 'translate(0px, 0px) scale(1)', 'important');

        const wrapperRect = wrapper.getBoundingClientRect();
        const cardRect = targetCardEl.getBoundingClientRect();
        const headerBottom = headerEl ? Math.round(headerEl.getBoundingClientRect().bottom) : 56;

        const cardCenterX = (cardRect.left - wrapperRect.left) + (cardRect.width / 2);
        const cardTopY = (cardRect.top - wrapperRect.top);

        const containerWidth = container.clientWidth ? container.clientWidth : window.innerWidth;
        const desiredScreenTop = headerBottom + 28;
        const targetPanY = (desiredScreenTop - wrapperRect.top) - (cardTopY * window.scale);

        window.panX = Math.round((containerWidth / 2) - (cardCenterX * window.scale));
        window.panY = Math.round(targetPanY);

        wrapper.style.setProperty('transform', 'translate(' + window.panX + 'px, ' + window.panY + 'px) scale(' + window.scale + ')', 'important');
    };

    window.applyCustomTopRootPartner = function(memberId, resetToMaster) {
        window.toggleRootCardPickMode(false);

        const switchModal = document.getElementById('bs-root-switch-modal-overlay');
        if (switchModal) switchModal.remove();
        const dupModal = document.getElementById('bs-duplicate-partner-modal');
        if (dupModal) dupModal.remove();

        const masterNode = typeof window.getAbsoluteTopRoot === 'function' ? window.getAbsoluteTopRoot() : null;

        if (resetToMaster || !memberId || (masterNode && normId(masterNode.id) === normId(memberId))) {
            window.customTopRootId = null;
            localStorage.removeItem(STORAGE_ROOT_KEY);
            window.isolateSubtreeInDOM(null);

            const mId = masterNode ? masterNode.id : null;
            if (mId) {
                window.currentSelectedId = mId;
                const masterCard = document.getElementById('card_' + mId) ? document.getElementById('card_' + mId) : document.querySelector('.node-card');
                if (masterCard) window.centerSpecificCardAsRoot(masterCard);
                if (typeof window.updateHeaderLineCount === 'function') window.updateHeaderLineCount(mId);
            }
            if (typeof window.updateVirtualModeBtnState === 'function') window.updateVirtualModeBtnState();
            return;
        }

        const targetNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(memberId) : null;
        const canonicalId = targetNode ? (targetNode.id ? targetNode.id : memberId) : memberId;

        window.customTopRootId = canonicalId;
        window.currentSelectedId = canonicalId;
        localStorage.setItem(STORAGE_ROOT_KEY, canonicalId);

        if (targetNode) {
            saveToRootHistory(targetNode);
        }

        const isolated = window.isolateSubtreeInDOM(canonicalId);
        if (!isolated && typeof window.renderTree === 'function') {
            try { window.renderTree(); } catch (e) {}
            window.isolateSubtreeInDOM(canonicalId);
        }

        setTimeout(function() {
            window.isolateSubtreeInDOM(canonicalId);
            const targetNorm = normId(canonicalId);
            let targetCardEl = document.getElementById('card_' + canonicalId);
            if (!targetCardEl) {
                document.querySelectorAll('.node-card[id^="card_"]').forEach(function(c) {
                    if (normId(c.id.replace(/^card_/, '')) === targetNorm) targetCardEl = c;
                });
            }

            if (targetCardEl) {
                window.centerSpecificCardAsRoot(targetCardEl);
                window._bypassRootPickCapture = true;
                if (typeof window.executeNodeSingleClick === 'function') {
                    window.executeNodeSingleClick(canonicalId);
                }
                window._bypassRootPickCapture = false;
            }
            if (typeof window.updateHeaderLineCount === 'function') window.updateHeaderLineCount(canonicalId);
            if (typeof window.updateVirtualModeBtnState === 'function') window.updateVirtualModeBtnState();
        }, 60);
    };

    window.searchAndSelectTopRootPartner = function(rawQuery) {
        const q = String(rawQuery ? rawQuery : '').trim();
        if (!q) {
            window.applyCustomTopRootPartner(null, true);
            return;
        }

        const pool = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];
        const qNorm = normId(q);
        const qLower = q.toLowerCase();

        const exactIdMatches = pool.filter(function(m) { return normId(m.id ? m.id : m.member_id) === qNorm; });
        if (exactIdMatches.length === 1) {
            window.applyCustomTopRootPartner(exactIdMatches[0].id ? exactIdMatches[0].id : exactIdMatches[0].member_id);
            return;
        }

        let matches = pool.filter(function(m) {
            const mName = String(m.name ? m.name : '').trim().toLowerCase();
            return mName === qLower;
        });

        if (matches.length === 0) {
            matches = pool.filter(function(m) {
                const mName = String(m.name ? m.name : '').trim().toLowerCase();
                const mId = String(m.id ? m.id : '').trim().toLowerCase();
                return mName.includes(qLower) ? true : (mId.includes(qLower) ? true : normId(mId).includes(qNorm));
            });
        }

        if (matches.length === 0) {
            window.alert('"' + q + '"에 해당하는 파트너(회원번호 또는 이름)를 찾을 수 없습니다.');
            return;
        }

        if (matches.length === 1) {
            window.applyCustomTopRootPartner(matches[0].id ? matches[0].id : matches[0].member_id);
            return;
        }

        window.openDuplicatePartnerSelectModal(matches, q);
    };

    window.openDuplicatePartnerSelectModal = function(candidates, keyword) {
        let overlay = document.getElementById('bs-duplicate-partner-modal');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'bs-duplicate-partner-modal';
        overlay.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100dvh !important; background:rgba(0,0,0,0.78) !important; z-index:2147483647 !important; display:flex !important; align-items:center !important; justify-content:center !important; padding:12px !important; box-sizing:border-box !important;';

        const rowsHtml = candidates.map(function(m) {
            const mId = m.id ? m.id : (m.member_id ? m.member_id : '-');
            const mName = m.name ? m.name : '-';
            const mRank = String(m.rank ? m.rank : 'GUEST').toUpperCase();
            const mType = m.type ? m.type : '사업자';
            return [
                '<tr onclick="window.applyCustomTopRootPartner(\'' + mId + '\')" style="border-bottom:1px solid #374151; cursor:pointer;">',
                '<td style="padding:10px 8px; text-align:center; font-weight:bold; color:#60a5fa;">' + mId + '</td>',
                '<td style="padding:10px 8px; text-align:center; font-weight:bold; color:#fff;">' + mName + '</td>',
                '<td style="padding:10px 8px; text-align:center;"><span style="background:#374151; color:#fbbf24; font-size:11px; font-weight:bold; padding:3px 7px; border-radius:4px;">' + mRank + '</span></td>',
                '<td style="padding:10px 8px; text-align:center; color:#d1d5db;">' + mType + '</td>',
                '<td style="padding:10px 8px; text-align:center;"><button type="button" style="background:#2563eb; border:1px solid #3b82f6; color:#fff; border-radius:4px; padding:4px 10px; font-size:11.5px; font-weight:bold; cursor:pointer;">선택</button></td>',
                '</tr>'
            ].join('');
        }).join('');

        overlay.innerHTML = [
            '<div onclick="event.stopPropagation()" style="width:min(540px, 95vw); max-height:84dvh; background:#1f2937; border:1px solid #4b5563; border-radius:10px; box-shadow:0 25px 60px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden; color:#fff;">',
            '<div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#111827; border-bottom:1px solid #374151;">',
            '<div><strong style="font-size:14.5px; color:#60a5fa;">👥 동명이인 / 복수 파트너 선택 (' + candidates.length + '명)</strong></div>',
            '<button type="button" onclick="document.getElementById(\'bs-duplicate-partner-modal\').remove()" style="background:#374151; border:1px solid #4b5563; color:#e5e7eb; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:bold; cursor:pointer;">닫기 ✕</button>',
            '</div>',
            '<div style="overflow-y:auto; padding:12px;"><table style="width:100%; border-collapse:collapse; font-size:12.5px;">',
            '<thead><tr style="background:#111827; color:#9ca3af; border-bottom:2px solid #374151;"><th style="padding:9px 8px;">회원번호</th><th style="padding:9px 8px;">이름</th><th style="padding:9px 8px;">직급</th><th style="padding:9px 8px;">구분</th><th style="padding:9px 8px;">배치</th></tr></thead>',
            '<tbody>' + rowsHtml + '</tbody></table></div></div>'
        ].join('');

        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    };

    window.toggleRootCardPickMode = function(forceState) {
        injectSubtreeCleanConnectorCSS();
        const nextState = (typeof forceState === 'boolean') ? forceState : !window.isRootCardPickMode;
        window.isRootCardPickMode = nextState;

        let banner = document.getElementById('bs-root-pick-banner');
        if (nextState) {
            document.body.classList.add('bs-root-pick-active');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'bs-root-pick-banner';
                banner.style.cssText = 'position:fixed !important; top:72px !important; left:50% !important; transform:translateX(-50%) !important; background:linear-gradient(135deg, #2563eb, #1d4ed8) !important; border:1px solid #93c5fd !important; color:#ffffff !important; padding:8px 16px !important; border-radius:999px !important; font-size:12.5px !important; font-weight:bold !important; z-index:2147483640 !important; box-shadow:0 10px 25px rgba(0,0,0,0.75) !important; display:flex !important; align-items:center !important; gap:10px !important; white-space:nowrap !important;';
                banner.innerHTML = [
                    '<span>🎯 계보도에서 최상단에 배치할 카드를 클릭하세요</span>',
                    '<button type="button" onclick="window.openRootSwitchModal()" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:#fff; border-radius:99px; padding:2px 8px; font-size:11px; font-weight:bold; cursor:pointer;">검색/이전목록</button>',
                    '<button type="button" onclick="window.toggleRootCardPickMode(false)" style="background:#1e293b; border:1px solid #475569; color:#f87171; border-radius:99px; padding:2px 8px; font-size:11px; font-weight:bold; cursor:pointer;">취소 ✕</button>'
                ].join('');
                document.body.appendChild(banner);
            } else {
                banner.style.display = 'flex';
            }
        } else {
            document.body.classList.remove('bs-root-pick-active');
            if (banner) banner.style.display = 'none';
        }
        if (typeof window.updateVirtualModeBtnState === 'function') window.updateVirtualModeBtnState();
    };

    function handleCardPickIntercept(e) {
        if (!window.isRootCardPickMode || window._bypassRootPickCapture) return;
        const cardEl = e.target && typeof e.target.closest === 'function' ? e.target.closest('.node-card') : null;
        if (!cardEl) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        const memberId = cardEl.id ? cardEl.id.replace(/^card_/, '') : cardEl.getAttribute('data-member-id');
        if (memberId) {
            window.applyCustomTopRootPartner(memberId);
        }
    }

    window.addEventListener('pointerup', handleCardPickIntercept, true);
    window.addEventListener('click', handleCardPickIntercept, true);

    // 🌟 가상모드(최상단 기준 카드 스위치) 메인 모달 오픈 함수
    window.openRootSwitchModal = function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        let overlay = document.getElementById('bs-root-switch-modal-overlay');
        if (overlay) overlay.remove();

        const currentRootId = window.customTopRootId ? window.customTopRootId : localStorage.getItem(STORAGE_ROOT_KEY);
        const history = getRootHistory();

        const historyChipsHtml = history.length > 0
            ? history.map(function(h) {
                const isCurr = currentRootId && normId(currentRootId) === normId(h.id);
                const bg = isCurr ? 'rgba(37, 99, 235, 0.25)' : '#111827';
                const border = isCurr ? '#3b82f6' : '#374151';
                const statusColor = isCurr ? '#60a5fa' : '#9ca3af';
                const statusTxt = isCurr ? '현재 최상단' : '배치 ➔';
                return [
                    '<div onclick="window.applyCustomTopRootPartner(\'' + h.id + '\')" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:' + bg + '; border:1px solid ' + border + '; border-radius:6px; cursor:pointer;">',
                    '<div style="display:flex; align-items:center; gap:8px;">',
                    '<strong style="color:#ffffff; font-size:12.5px;">' + h.name + '</strong>',
                    '<span style="color:#60a5fa; font-family:monospace; font-size:11.5px; font-weight:bold;">' + h.id + '</span>',
                    '<span style="background:#374151; color:#fbbf24; font-size:10.5px; font-weight:bold; padding:1px 6px; border-radius:4px;">' + h.rank + '</span>',
                    '<span style="color:#9ca3af; font-size:11px;">' + (h.memberType ? h.memberType : '') + '</span>',
                    '</div>',
                    '<span style="font-size:11px; font-weight:bold; color:' + statusColor + ';">' + statusTxt + '</span>',
                    '</div>'
                ].join('');
            }).join('')
            : '<div style="padding:12px; text-align:center; color:#6b7280; font-size:12px;">이전에 선택했던 카드 기록이 없습니다.</div>';

        overlay = document.createElement('div');
        overlay.id = 'bs-root-switch-modal-overlay';
        overlay.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100dvh !important; background:rgba(0,0,0,0.65) !important; z-index:2147483645 !important; display:flex !important; align-items:center !important; justify-content:center !important; padding:12px !important; box-sizing:border-box !important;';

        overlay.innerHTML = [
            '<div onclick="event.stopPropagation()" style="width:min(440px, 94vw); background:#1f2937; border:1px solid #4b5563; border-radius:10px; padding:16px; color:#fff; box-shadow:0 20px 50px rgba(0,0,0,0.85); display:flex; flex-direction:column; gap:14px;">',
            '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #374151; padding-bottom:10px;">',
            '<strong style="font-size:14px; color:#60a5fa;">🔀 가상모드: 최상단 기준 카드(Root) 스위치</strong>',
            '<button type="button" onclick="document.getElementById(\'bs-root-switch-modal-overlay\').remove()" style="background:#374151; border:1px solid #4b5563; color:#e5e7eb; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:bold; cursor:pointer;">닫기 ✕</button>',
            '</div>',
            '<div style="display:flex; gap:8px;">',
            '<button type="button" onclick="document.getElementById(\'bs-root-switch-modal-overlay\').remove(); window.toggleRootCardPickMode(true);" style="flex:1; padding:10px 12px; background:linear-gradient(135deg, #2563eb, #1d4ed8); border:1px solid #60a5fa; border-radius:6px; color:#fff; font-size:12.5px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">',
            '<span>👆</span><span>계보도에서 카드 직접 클릭하여 선택</span>',
            '</button>',
            '<button type="button" onclick="window.applyCustomTopRootPartner(null, true)" title="전체 최상위 루트로 복귀" style="padding:10px 12px; background:#374151; border:1px solid #4b5563; border-radius:6px; color:#e5e7eb; font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap;">전체 최상위로 복귀</button>',
            '</div>',
            '<div>',
            '<label style="display:block; font-size:11.5px; color:#9ca3af; margin-bottom:5px; font-weight:bold;">🔍 회원번호 또는 회원명으로 최상단 배치 (동명이인 자동 선택창 지원)</label>',
            '<div style="display:flex; gap:6px;">',
            '<input type="text" id="bs-root-switch-search-inp" placeholder="회원번호 또는 이름 입력" onkeydown="if(event.key===\'Enter\'){ window.searchAndSelectTopRootPartner(this.value); }" style="flex:1; background:#111827; border:1px solid #4b5563; color:#fff; border-radius:6px; padding:8px 10px; font-size:12.5px; outline:none;">',
            '<button type="button" onclick="window.searchAndSelectTopRootPartner(document.getElementById(\'bs-root-switch-search-inp\').value)" style="background:#10b981; border:1px solid #059669; color:#fff; border-radius:6px; padding:0 14px; font-size:12.5px; font-weight:bold; cursor:pointer;">최상단 배치</button>',
            '</div>',
            '</div>',
            '<div style="border-top:1px solid #374151; padding-top:10px;">',
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><span style="font-size:11.5px; color:#9ca3af; font-weight:bold;">🕘 이전에 선택했던 카드 (클릭 시 즉시 최상단 전환)</span></div>',
            '<div style="display:flex; flex-direction:column; gap:6px; max-height:210px; overflow-y:auto;">' + historyChipsHtml + '</div>',
            '</div>',
            '</div>'
        ].join('');

        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    };
})();

// ============================================================================
// [22] 배지 달성률 '원형 - / + 버튼 UI' + 우측 세로 슬라이드 독 ('가상모드' & 'GitHub 업로드' 완벽 복원)
// ============================================================================
(function initCustomStepperAndVerticalSlideDockV22() {
    if (window._bsBadgeAndNavFinalV43_AllRestored) return;
    window._bsBadgeAndNavFinalV43_AllRestored = true;

    ['bsHeaderSlideZone', 'bsRightAutoSlideDock', 'bsBodyVerticalSlideDock'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    function ensureVerticalDockAndBadgeCSSV43() {
        let st = document.getElementById('bs-badge-final-v43-css');
        if (!st) {
            st = document.createElement('style');
            st.id = 'bs-badge-final-v43-css';
            document.head.appendChild(st);
        }
        st.textContent = [
            '.node-card, .node-card * { animation: none !important; transition: none !important; }',
            '.bs-card-top-badges span[data-v30-pct]::after { content: " " attr(data-v30-pct) "%" !important; font-weight: 800 !important; display: inline !important; }',
            '.bs-v30-hide { display: none !important; }',
            '.bs-pct-stepper-wrap { display: flex !important; align-items: center !important; justify-content: center !important; gap: 20px !important; width: 100% !important; padding: 8px 0 4px 0 !important; margin-top: 4px !important; user-select: none !important; }',
            '.bs-pct-stepper-btn { width: 34px !important; height: 34px !important; min-width: 34px !important; min-height: 34px !important; border-radius: 50% !important; background: #2b303c !important; border: 1px solid rgba(255, 255, 255, 0.06) !important; color: #e5e7eb !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; padding: 0 !important; }',
            '.bs-pct-stepper-btn:hover { background: #3b4252 !important; color: #ffffff !important; }',
            '.bs-pct-stepper-val { font-size: 14px !important; font-weight: 600 !important; color: #f3f4f6 !important; min-width: 44px !important; text-align: center !important; }',
            '#bsBodyVerticalSlideDock { position: fixed !important; top: 52% !important; right: 0 !important; transform: translate(calc(100% - 14px), -50%) !important; z-index: 999980 !important; display: flex !important; flex-direction: row !important; align-items: center !important; transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1) !important; pointer-events: auto !important; }',
            '#bsBodyVerticalSlideDock:hover, #bsBodyVerticalSlideDock.bs-vdock-open { transform: translate(0, -50%) !important; }',
            '#bsBodyVerticalSlideHandle { width: 14px !important; height: 64px !important; background: linear-gradient(180deg, #1e293b, #0f172a) !important; border: 1px solid rgba(96, 165, 250, 0.5) !important; border-right: none !important; border-radius: 7px 0 0 7px !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #60a5fa !important; font-size: 9px !important; font-weight: 900 !important; cursor: pointer !important; box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.5) !important; user-select: none !important; }',
            '#bsBodyVerticalSlideTray { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 6px !important; padding: 10px 8px !important; background: rgba(17, 24, 39, 0.96) !important; backdrop-filter: blur(10px) !important; border: 1px solid rgba(75, 85, 99, 0.75) !important; border-right: none !important; border-radius: 10px 0 0 10px !important; box-shadow: -6px 4px 20px rgba(0, 0, 0, 0.7) !important; }',
            '.bs-vdock-icon-btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 34px !important; height: 34px !important; min-width: 34px !important; min-height: 34px !important; border-radius: 8px !important; border: 1px solid transparent !important; background: rgba(31, 41, 55, 0.55) !important; color: #d1d5db !important; cursor: pointer !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; transition: all 0.15s ease !important; }',
            '.bs-vdock-icon-btn:hover { background: rgba(55, 65, 81, 0.9) !important; color: #ffffff !important; transform: scale(1.05) !important; }',
            '.bs-vdock-icon-btn.bs-nav-active { background: rgba(37, 99, 235, 0.28) !important; border-color: rgba(96, 165, 250, 0.65) !important; color: #60a5fa !important; box-shadow: 0 0 10px rgba(37, 99, 235, 0.45) !important; }',
            '.bs-vdock-divider { width: 22px !important; height: 1px !important; background: rgba(75, 85, 99, 0.65) !important; margin: 2px 0 !important; }'
        ].join('\n');
    }

    function normalizeToStep10(val) {
        let num = parseInt(val, 10);
        if (isNaN(num) || num < 10) return 80;
        if (num > 100) return 100;
        return Math.max(10, Math.min(100, Math.round(num / 10) * 10));
    }

    function setupBadgeThresholdInputStep10() {
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(function(inp) {
            const rowTxt = (inp.closest('div') ? inp.closest('div').innerText : '') || '';
            if (rowTxt.includes('배지') || (inp.id || '').toLowerCase().includes('badge')) {
                let validVal = normalizeToStep10(localStorage.getItem('bs_badge_threshold_pct') ? localStorage.getItem('bs_badge_threshold_pct') : '80');
                inp.value = String(validVal);

                let rowContainer = inp.closest('#bs-badge-threshold-row') ? inp.closest('#bs-badge-threshold-row') : inp.closest('div');
                if (rowContainer) {
                    inp.style.setProperty('display', 'none', 'important');
                    rowContainer.style.setProperty('display', 'flex', 'important');
                    rowContainer.style.setProperty('flex-direction', 'column', 'important');
                    rowContainer.style.setProperty('align-items', 'stretch', 'important');

                    let stepper = rowContainer.querySelector('.bs-pct-stepper-wrap');
                    if (!stepper) {
                        stepper = document.createElement('div');
                        stepper.className = 'bs-pct-stepper-wrap';
                        stepper.innerHTML = [
                            '<button type="button" class="bs-pct-stepper-btn bs-step-minus" title="10% 감소"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>',
                            '<span class="bs-pct-stepper-val">' + validVal + '%</span>',
                            '<button type="button" class="bs-pct-stepper-btn bs-step-plus" title="10% 증가"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>'
                        ].join('');
                        const valDisplay = stepper.querySelector('.bs-pct-stepper-val');
                        const updatePct = function(delta) {
                            const cur = normalizeToStep10(localStorage.getItem('bs_badge_threshold_pct') ? localStorage.getItem('bs_badge_threshold_pct') : '80');
                            const next = Math.max(10, Math.min(100, cur + delta));
                            inp.value = String(next);
                            valDisplay.textContent = next + '%';
                            localStorage.setItem('bs_badge_threshold_pct', String(next));
                            if (typeof window.renderTreeCardStatusBadges === 'function') window.renderTreeCardStatusBadges();
                        };
                        stepper.querySelector('.bs-step-minus').onclick = function(e) { e.stopPropagation(); updatePct(-10); };
                        stepper.querySelector('.bs-step-plus').onclick = function(e) { e.stopPropagation(); updatePct(10); };
                        rowContainer.appendChild(stepper);
                    }
                }
            }
        });
    }

    window.updateVirtualModeBtnState = function() {
        const rootSwitchBtn = document.getElementById('bsVDockRootSwitchBtn');
        if (!rootSwitchBtn) return;
        const hasCustomRoot = Boolean(window.customTopRootId ? true : localStorage.getItem('bs_saved_custom_root_id'));
        const isActive = Boolean(window.isRootCardPickMode ? true : hasCustomRoot);
        rootSwitchBtn.classList.toggle('bs-nav-active', isActive);
    };

    function updateAllVerticalDockIconsActiveState() {
        const salesBtn = document.getElementById('bsVDockSalesWidgetBtn');
        if (salesBtn) {
            const salesW = document.getElementById('salesWidget');
            const isOpen = salesW && !salesW.classList.contains('closed') && window.getComputedStyle(salesW).display !== 'none';
            salesBtn.classList.toggle('bs-nav-active', Boolean(isOpen));
        }
        const perfBtn = document.getElementById('bsVDockPerfWidgetBtn');
        if (perfBtn) {
            const perfW = document.getElementById('perfWidget');
            const isOpen = perfW && !perfW.classList.contains('closed') && perfW.getAttribute('data-minimized') !== 'true';
            perfBtn.classList.toggle('bs-nav-active', Boolean(isOpen));
        }
        const navBtn = document.getElementById('bsVDockBizNavBtn');
        if (navBtn) {
            const popupOpen = Boolean(window.bizNavPopupWindow && !window.bizNavPopupWindow.closed);
            navBtn.classList.toggle('bs-nav-active', popupOpen);
        }
        const periodBtn = document.getElementById('bsVDockPeriodSearchBtn');
        if (periodBtn) {
            const popupOpen = Boolean(window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed);
            periodBtn.classList.toggle('bs-nav-active', popupOpen);
        }
        const treeModeBtn = document.getElementById('bsVDockTreeModeBtn');
        if (treeModeBtn) {
            treeModeBtn.classList.toggle('bs-nav-active', window.treeMode === 'recommender');
            treeModeBtn.title = (window.treeMode === 'recommender') ? '현재: 추천계보도 (클릭 시 후원계보도로 전환)' : '현재: 후원계보도 (클릭 시 추천계보도로 전환)';
        }
        window.updateVirtualModeBtnState();
    }

    window.triggerOneClickGitPush = async function(btnEl) {
        const now = new Date();
        const defaultMemo = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');

        const memo = window.prompt('GitHub에 업로드할 작업 메모를 입력하세요:', defaultMemo);
        if (memo === null) return;

        const origHtml = btnEl ? btnEl.innerHTML : '';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span style="font-size:10px; color:#60a5fa; font-weight:800;">UP</span>';
        }

        try {
            const baseUrl = (window.API_BASE ? window.API_BASE : 'http://127.0.0.1:3005').replace(/\/api\/?$/, '');
            const response = await window.fetch(baseUrl + '/api/git-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: memo.trim() ? memo.trim() : defaultMemo })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message ? result.message : '업로드 실패');
            }
            window.alert('✅ [GitHub 원클릭 업로드 완료]\n\n' + result.message);
        } catch (err) {
            window.alert('❌ [GitHub 업로드 오류]\n' + err.message + '\n\n* 백엔드(server.js)가 실행 중인지 확인해 주세요.');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = origHtml;
            }
        }
    };

    function makeVDockBtn(id, title, svgHtml, onClickFn) {
        let btn = document.getElementById(id);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = id;
            btn.type = 'button';
            btn.className = 'bs-vdock-icon-btn';
            btn.title = title;
            btn.innerHTML = svgHtml;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                onClickFn(e, btn);
                setTimeout(updateAllVerticalDockIconsActiveState, 80);
            });
        }
        return btn;
    }

    function buildAndSyncBodyVerticalSlideDock() {
        ensureVerticalDockAndBadgeCSSV43();
        setupBadgeThresholdInputStep10();

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
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
                function(e) {
                    if (typeof window.toggleSalesSidebar === 'function') window.toggleSalesSidebar(e);
                }
            );

            const perfBtn = makeVDockBtn(
                'bsVDockPerfWidgetBtn',
                '실적/수당',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line><line x1="2" y1="20" x2="22" y2="20"></line></svg>',
                function() {
                    if (typeof window.toggleFoldPerfWidget === 'function') window.toggleFoldPerfWidget();
                }
            );

            const navBtn = makeVDockBtn(
                'bsVDockBizNavBtn',
                '내비게이터',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>',
                function() {
                    if (typeof window.toggleBizNavigator === 'function') window.toggleBizNavigator();
                }
            );

            const periodBtn = makeVDockBtn(
                'bsVDockPeriodSearchBtn',
                '매출 기간 검색',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><circle cx="14.5" cy="15.5" r="2.5"></circle><line x1="16.5" y1="17.5" x2="18.5" y2="19.5"></line></svg>',
                function() {
                    if (typeof window.toggleSalesSearchPopup === 'function') window.toggleSalesSearchPopup();
                }
            );

            const treeModeBtn = makeVDockBtn(
                'bsVDockTreeModeBtn',
                '후원계보도 ↔ 추천계보도 전환',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><rect x="9" y="2" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="16" y="16" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><line x1="12" y1="12" x2="12" y2="8"></line></svg>',
                function() {
                    if (typeof window.toggleTreeMode === 'function') window.toggleTreeMode();
                }
            );

            // 🌟 복원 완료: 가상모드 (최상단 기준 카드 스위치 & 카드 직접 클릭 선택 모달 호출)
            const rootSwitchBtn = makeVDockBtn(
                'bsVDockRootSwitchBtn',
                '가상모드 (최상단 기준 카드 스위치)',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>',
                function(e) {
                    if (typeof window.openRootSwitchModal === 'function') {
                        window.openRootSwitchModal(e);
                    }
                }
            );

            const aiAdvisorBtn = makeVDockBtn(
                'bsVDockAiAdvisorBtn',
                'AI 어드바이저',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path></svg>',
                function() {
                    if (typeof window.openAIAdvisorPopupWindow === 'function') window.openAIAdvisorPopupWindow();
                }
            );

            const githubPushBtn = makeVDockBtn(
                'bsVDockGitPushBtn',
                'GitHub 원클릭 업로드 (백엔드 + 프론트엔드 동시 저장)',
                '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m16 16-4-4-4 4"></path></svg>',
                function(e, btn) {
                    window.triggerOneClickGitPush(btn);
                }
            );

            tray.appendChild(salesBtn);
            tray.appendChild(perfBtn);
            tray.appendChild(navBtn);
            tray.appendChild(periodBtn);

            const divider = document.createElement('div');
            divider.className = 'bs-vdock-divider';
            tray.appendChild(divider);

            tray.appendChild(treeModeBtn);
            tray.appendChild(rootSwitchBtn);
            tray.appendChild(aiAdvisorBtn);
            tray.appendChild(githubPushBtn);

            dock.appendChild(handle);
            dock.appendChild(tray);
            document.body.appendChild(dock);

            let closeTimer = null;
            window.addEventListener('mousemove', function(ev) {
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
                    closeTimer = setTimeout(function() {
                        if (!d.matches(':hover')) {
                            d.classList.remove('bs-vdock-open');
                            handle.textContent = '❮';
                        }
                    }, 200);
                }
            }, { passive: true });
        }

        ['toggleTreeBtn', 'bsRootSwitchBtn', 'customAiAdvisorBtn', 'oneClickGithubBtn'].forEach(function(oldId) {
            const oldEl = document.getElementById(oldId);
            if (oldEl && !oldEl.closest('#bsBodyVerticalSlideTray')) {
                oldEl.style.setProperty('display', 'none', 'important');
            }
        });

        updateAllVerticalDockIconsActiveState();
    }

    setInterval(buildAndSyncBodyVerticalSlideDock, 500);
    setTimeout(buildAndSyncBodyVerticalSlideDock, 100);
})();
// ============================================================================
// [23] 🌟 TiDB 품위유지 기준 CV 참조 + (소실적 CV + 본인 당기 CV) 달성률 통합 엔진
// ============================================================================
(function unifyDignityCalculationAndBadgeEngineV23() {
    if (window._bsUnifiedDignityEngineV23) return;
    window._bsUnifiedDignityEngineV23 = true;

    function normId(val) {
        if (!val) return '';
        const s = (typeof val === 'object') ? (val.id || val.member_id || val.memberId || '') : String(val);
        return String(s).trim().toLowerCase().replace(/^v[kj]-?/, '');
    }

    window.getDbRequiredMaintCV = function(rankName) {
        const rUpper = String(rankName || '').trim().toUpperCase();
        if (!rUpper || rUpper === 'GUEST' || rUpper === 'MEMBER' || rUpper === 'MANIA') return 0;
        if (window.dbRankMaintenancePolicies && window.dbRankMaintenancePolicies[rUpper] && window.dbRankMaintenancePolicies[rUpper].reqSmallCv > 0) {
            return Number(window.dbRankMaintenancePolicies[rUpper].reqSmallCv);
        }
        return 0;
    };

    window.computeUnifiedDignityMetrics = function(memberId) {
        const emptyRes = { currRank: 'GUEST', reqMaintCV: 0, selfTermCV: 0, minorSubTermCV: 0, totalRecognizedCV: 0, maintPct: 0, maintDiffCV: 0, isEligibleRank: false };
        if (!memberId || typeof window.findMemberNode !== 'function') return emptyRes;

        const mNode = window.findMemberNode(memberId);
        if (!mNode) return emptyRes;

        const currRank = String(mNode.rank || mNode.rank_name || 'GUEST').trim().toUpperCase();
        const reqMaintCV = Number(window.getDbRequiredMaintCV(currRank) || 0);
        const isEligibleRank = reqMaintCV > 0;

        if (!isEligibleRank) return { ...emptyRes, currRank };

        const allSales = window.allSalesData || window.integrated_sales_history || [];
        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : (s => String(s || '').trim().substring(0, 10));
        const mNorm = normId(memberId);
        const { setA, setB } = typeof window.getSublinePartnerSets === 'function' ? window.getSublinePartnerSets(mNode) : { setA: new Set(), setB: new Set() };

        let selfTermCV = 0, directTermA = 0, directTermB = 0;
        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normId(s.member_id || s.memberId || s.id);
            const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ?? s.sales_cv ?? 0) : Number(s.cv ?? s.sales_cv ?? 0);
            if (cv <= 0) return;
            if (sNorm === mNorm) selfTermCV += cv;
            else if (setA.has(sNorm)) directTermA += cv;
            else if (setB.has(sNorm)) directTermB += cv;
        });

        const minorSubTermCV = Math.min(directTermA, directTermB);
        const totalRecognizedCV = minorSubTermCV + selfTermCV;
        const maintPct = reqMaintCV > 0 ? Math.min(100, Math.floor((totalRecognizedCV / reqMaintCV) * 100)) : 0;
        const maintDiffCV = Math.max(0, reqMaintCV - totalRecognizedCV);

        return { currRank, reqMaintCV, selfTermCV, minorSubTermCV, totalRecognizedCV, maintPct, maintDiffCV, isEligibleRank };
    };

    window.evaluateMemberCardBadgeStatus = function(memberId) {
        const res = { showPromoBadge: false, showMaintBadge: false, promoPct: 0, promoTargetRank: '', promoCurrPV: 0, promoReqPV: 0, maintPct: 0, maintCurrVal: 0, maintReqVal: 0, maintUnit: 'CV' };
        if (!memberId || typeof window.findMemberNode !== 'function') return res;

        let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') || '80', 10);
        if (isNaN(thresholdPct) || thresholdPct < 10) thresholdPct = 80;

        const mNode = window.findMemberNode(memberId);
        if (!mNode) return res;

        const { setA, setB } = typeof window.getSublinePartnerSets === 'function' ? window.getSublinePartnerSets(mNode) : { setA: new Set(), setB: new Set() };
        const allSales = window.allSalesData || window.integrated_sales_history || [];
        let aTotalPV = 0, bTotalPV = 0;

        (allSales || []).forEach(s => {
            if (!s) return;
            const sNorm = normId(s.member_id || s.memberId || s.id);
            const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv ?? s.sales_pv ?? 0) : Number(s.pv ?? s.sales_pv ?? 0);
            if (pv <= 0) return;
            if (setA.has(sNorm)) aTotalPV += pv;
            else if (setB.has(sNorm)) bTotalPV += pv;
        });

        const currRank = String(mNode.rank || mNode.rank_name || 'GUEST').toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
        const nextRank = dbRanks.find(r => Number(r.rank_level || 0) > currLevel && Number(r.minor_leg_pv || 0) > 0) || { rank_name: 'DIRECTOR', minor_leg_pv: 2100000 };
        const reqMinorPV = Number(nextRank.minor_leg_pv || 0);
        const minorPV = Math.min(aTotalPV, bTotalPV);

        if (reqMinorPV > 0) {
            res.promoPct = Math.floor((minorPV / reqMinorPV) * 100);
            res.promoTargetRank = nextRank.rank_name;
            res.promoCurrPV = minorPV;
            res.promoReqPV = reqMinorPV;
            res.showPromoBadge = (res.promoPct >= thresholdPct);
        }

        const dInfo = window.computeUnifiedDignityMetrics(memberId);
        if (dInfo.isEligibleRank) {
            res.maintPct = dInfo.maintPct;
            res.maintCurrVal = dInfo.totalRecognizedCV;
            res.maintReqVal = dInfo.reqMaintCV;
            res.showMaintBadge = (dInfo.maintPct >= thresholdPct);
        }
        return res;
    };
})();

// ============================================================================
// [24] 🚨 3005 포트 고정 + 안정적인 단일 로그인 오버레이 관리
// ============================================================================
(function masterPort3005AndStableLoginV24() {
    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';
    const host = window.location.hostname;
    const isLocal = (host === '127.0.0.1' || host === 'localhost' || host === '' || window.location.protocol === 'file:');
    window.API_BASE = isLocal ? 'http://127.0.0.1:3005' : window.location.origin;
    window.API_BASE_URL = window.API_BASE;

    window.showSecurityLoginOverlay = function() {
        if (document.getElementById('bs-auth-login-overlay')) return;

        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);

        const overlay = document.createElement('div');
        overlay.id = 'bs-auth-login-overlay';
        overlay.style.cssText = `
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            background: #0b0f19 !important; z-index: 2147483647 !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
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
                        <input type="text" id="bs-login-id" placeholder="관리자 ID 입력" autocomplete="username" required
                               style="width:100%; box-sizing:border-box; padding:10px 12px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; font-size:13px; outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:11.5px; color:#d1d5db; margin-bottom:4px; font-weight:bold;">비밀번호 (Password)</label>
                        <input type="password" id="bs-login-pw" placeholder="비밀번호 입력" autocomplete="current-password" required
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

        const form = document.getElementById('bs-login-form');
        const idInp = document.getElementById('bs-login-id');
        const pwInp = document.getElementById('bs-login-pw');
        const errEl = document.getElementById('bs-login-error');

        setTimeout(() => { if (idInp) idInp.focus(); }, 100);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errEl.style.display = 'none';
            const uid = idInp.value.trim();
            const upw = pwInp.value.trim();

            try {
                const res = await window.fetch(`${window.API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: uid, password: upw })
                });
                const data = await res.json();

                if (res.ok && data && data.success && data.token) {
                    sessionStorage.setItem(TOKEN_KEY, data.token);
                    localStorage.setItem(TOKEN_KEY, data.token);
                    overlay.remove();
                    if (typeof window.loadDbCompensationRates === 'function') await window.loadDbCompensationRates(true);
                    if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
                    return;
                }
            } catch (err) {
                errEl.innerText = '서버와 통신할 수 없습니다. 백엔드(3005번 포트) 실행 상태를 확인해 주세요.';
                errEl.style.display = 'block';
                return;
            }

            errEl.innerText = '아이디 또는 비밀번호가 일치하지 않습니다.';
            errEl.style.display = 'block';
            pwInp.value = '';
            pwInp.focus();
        });
    };
})();

// ============================================================================
// [25] 하위 파트너 신규 생성 시 기본 직급 'GUEST' 자동 고정 패치
// ============================================================================
(function enforceDefaultGuestRankOnNewPartnerV25() {
    function lockRankToGuest(container) {
        if (!container) return;
        const rankSelects = container.querySelectorAll('select#m-rank, select#member-rank, select#add-rank, select[name="rank"]');
        rankSelects.forEach(sel => {
            let guestOpt = Array.from(sel.options).find(o => String(o.value).toUpperCase() === 'GUEST');
            if (!guestOpt) {
                guestOpt = document.createElement('option');
                guestOpt.value = 'GUEST';
                guestOpt.textContent = 'GUEST';
                sel.insertBefore(guestOpt, sel.firstChild);
            }
            const modalEl = sel.closest('.modal, .popup, #addPartnerModal') || document.body;
            const titleText = (modalEl.querySelector('h2, h3, h4')?.innerText || '').trim();
            const isEditMode = titleText.includes('수정') || titleText.includes('편집');
            if (!isEditMode) {
                sel.value = 'GUEST';
                sel.style.pointerEvents = 'none';
                sel.style.opacity = '0.75';
            }
        });
    }
    document.addEventListener('click', () => setTimeout(() => lockRankToGuest(document.body), 50), true);
})();

// ============================================================================
// [26] 🔒 회원정보 수정 시 회원번호 더블클릭 ➔ 비밀번호 인증 후 편집 잠금 해제
// ============================================================================
(function enableMemberIdEditOnDblClickV26() {
    function isMemberIdInput(el) {
        if (!el || el.tagName !== 'INPUT') return false;
        if (el.closest('#bs-auth-login-overlay') || el.type === 'password') return false;
        return el.id === 'edit-m-id';
    }

    function openPasswordVerifyModal(onSuccess) {
        const exist = document.getElementById('bs-id-unlock-pw-modal');
        if (exist) exist.remove();

        const modal = document.createElement('div');
        modal.id = 'bs-id-unlock-pw-modal';
        modal.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100vh !important; background:rgba(0,0,0,0.75) !important; z-index:2147483647 !important; display:flex !important; align-items:center !important; justify-content:center !important;';
        modal.innerHTML = `
            <div style="background:#1f2937; border:1px solid #3b82f6; border-radius:10px; width:320px; padding:22px 20px; color:#fff; text-align:center;">
                <h3 style="margin:0 0 8px; font-size:15px;">🔓 회원번호 변경 잠금 해제</h3>
                <p style="margin:0 0 14px; font-size:11.5px; color:#9ca3af;">관리자 로그인 비밀번호를 입력해 주세요.</p>
                <form id="bs-id-unlock-form" style="display:flex; flex-direction:column; gap:10px;">
                    <input type="password" id="bs-id-unlock-pw-input" placeholder="관리자 비밀번호" required style="width:100%; box-sizing:border-box; padding:9px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; text-align:center;">
                    <div id="bs-id-unlock-err" style="display:none; color:#ef4444; font-size:11.5px; font-weight:bold;"></div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" id="bs-id-unlock-cancel" style="flex:1; padding:8px; background:#374151; border:none; border-radius:6px; color:#fff; cursor:pointer;">취소</button>
                        <button type="submit" style="flex:1; padding:8px; background:#2563eb; border:none; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer;">해제</button>
                    </div>
                </form>
            </div>
        `;
        document.documentElement.appendChild(modal);

        const pwInput = document.getElementById('bs-id-unlock-pw-input');
        const errBox = document.getElementById('bs-id-unlock-err');
        document.getElementById('bs-id-unlock-cancel').onclick = () => modal.remove();
        setTimeout(() => pwInput && pwInput.focus(), 50);

        document.getElementById('bs-id-unlock-form').onsubmit = async (e) => {
            e.preventDefault();
            const pw = pwInput.value.trim();
            if (!pw) return;
            try {
                const res = await window.fetch(`${window.API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'admin', password: pw })
                });
                const data = await res.json();
                if (res.ok && data && data.success) {
                    modal.remove();
                    onSuccess();
                    return;
                }
            } catch (err) {}
            errBox.innerText = '비밀번호가 일치하지 않습니다.';
            errBox.style.display = 'block';
        };
    }

    document.addEventListener('dblclick', (e) => {
        const targetInput = isMemberIdInput(e.target) ? e.target : null;
        if (!targetInput) return;
        e.preventDefault(); e.stopPropagation();

        openPasswordVerifyModal(() => {
            targetInput.disabled = false;
            targetInput.readOnly = false;
            targetInput.removeAttribute('readonly');
            targetInput.style.backgroundColor = '#1e293b';
            targetInput.style.border = '1.5px solid #3b82f6';
            targetInput.style.color = '#60a5fa';
            targetInput.dataset.unlockedByAuth = 'true';
            targetInput.focus();
            targetInput.select();
        });
    }, true);
})();

// ============================================================================
// [27] 🌟 VJ 멀티 캔버스 & 3005 포트 강제 라우팅 & VJ-002 자동채번 (클린 통합본)
// ============================================================================
(function initVjCanvasCompleteSolutionV27() {
    const MODE_KEY = 'BS_CANVAS_MODE_V1';
    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';

    const host = window.location.hostname;
    const isLocal = (host === '127.0.0.1' || host === 'localhost' || host === '' || window.location.protocol === 'file:');
    window.API_BASE = isLocal ? 'http://127.0.0.1:3005' : window.location.origin;
    window.API_BASE_URL = window.API_BASE;

    if (!window._vjModeBootInitializedV27) {
        window._vjModeBootInitializedV27 = true;
        localStorage.setItem(MODE_KEY, 'main');
        sessionStorage.setItem(MODE_KEY, 'main');
        window.currentCanvasMode = 'main';
    }
    window._vjCachedMembersMap = window._vjCachedMembersMap || {};

    function setCanvasMode(mode) {
        const cleanMode = (mode === 'vj') ? 'vj' : 'main';
        window.currentCanvasMode = cleanMode;
        localStorage.setItem(MODE_KEY, cleanMode);
        sessionStorage.setItem(MODE_KEY, cleanMode);
    }

    window.getNextVjAutoId = function() {
        let maxNum = 1;
        const sources = [window._vjCachedMembersMap || {}, window.flatMembersData || {}, window.memberMap || {}];
        sources.forEach(mapObj => {
            if (!mapObj || typeof mapObj !== 'object') return;
            Object.keys(mapObj).forEach(k => {
                const m = String(k).match(/^VJ-0*(\d+)$/i);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (!isNaN(n) && n < 100000 && n > maxNum) maxNum = n;
                }
            });
        });

        document.querySelectorAll('.node-card, [data-member-id]').forEach(el => {
            const txt = (el.getAttribute('data-member-id') || el.innerText || '');
            const matches = txt.match(/VJ-0*(\d+)/gi) || [];
            matches.forEach(token => {
                const n = parseInt(token.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(n) && n < 100000 && n > maxNum) maxNum = n;
            });
        });

        return 'VJ-' + String(maxNum + 1).padStart(3, '0');
    };

    window.findMemberNameById = function(rawId) {
        if (!rawId) return '';
        const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(rawId) : null;
        return node && node.name ? node.name : '';
    };

    window.fetch = function(input, init) {
        init = init || {};
        let urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        urlStr = urlStr.replace('127.0.0.1:3001', '127.0.0.1:3005').replace('localhost:3001', '127.0.0.1:3005');

        const isApiCall = urlStr.includes('/api/') || urlStr.includes(':3005');
        const isLoginCall = urlStr.includes('/api/login');
        const isAuthCheck = urlStr.includes('/api/auth-check');
        const method = (init && init.method) ? String(init.method).toUpperCase() : 'GET';
        const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
        const mode = (window.currentCanvasMode === 'vj') ? 'vj' : 'main';

        if (isApiCall && !isLoginCall && !isAuthCheck && (!token || document.getElementById('bs-auth-login-overlay'))) {
            if (typeof window.showSecurityLoginOverlay === 'function') window.showSecurityLoginOverlay();
            return Promise.resolve({
                ok: false,
                status: 401,
                clone: function() { return this; },
                json: function() { return Promise.resolve({ success: false, data: [], compRules: {} }); },
                text: function() { return Promise.resolve('{}'); }
            });
        }

        if (isApiCall) {
            if (token && !urlStr.includes('token=')) {
                urlStr += (urlStr.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
            }
            if (urlStr.includes('canvasMode=')) {
                urlStr = urlStr.replace(/canvasMode=[^&]+/, 'canvasMode=' + mode);
            } else {
                urlStr += (urlStr.includes('?') ? '&' : '?') + 'canvasMode=' + mode;
            }
            if (typeof window.getHeaderPeriodRange === 'function' && (urlStr.includes('/api/tree') || urlStr.includes('/api/sales'))) {
                const range = window.getHeaderPeriodRange();
                if (range.end && !urlStr.includes('endDate=') && !urlStr.includes('end=')) {
                    urlStr += '&startDate=' + encodeURIComponent(range.start) + '&endDate=' + encodeURIComponent(range.end);
                }
            }
            if (method === 'GET' && !urlStr.includes('_t=')) {
                urlStr += '&_t=' + Date.now();
            }
        }

        let requestBody = init && init.body ? init.body : null;
        if (isApiCall && (method === 'POST' || method === 'PUT') && requestBody) {
            try {
                const bodyObj = typeof requestBody === 'string' ? JSON.parse(requestBody) : Object.assign({}, requestBody);
                bodyObj._canvasMode = mode;

                if (urlStr.includes('/api/member') && method === 'POST' && mode === 'vj') {
                    let inputIdVal = String(bodyObj.id || bodyObj.member_id || '').trim().toUpperCase();
                    if (!inputIdVal || /^VK-/i.test(inputIdVal) || /^VJ-\d{5,}$/i.test(inputIdVal) || inputIdVal === 'VJ-001') {
                        inputIdVal = window.getNextVjAutoId();
                    }
                    bodyObj.id = inputIdVal;
                    bodyObj.member_id = inputIdVal;
                }
                requestBody = JSON.stringify(bodyObj);
            } catch (e) {}
        }

        return new Promise(function(resolve, reject) {
            const xhr = new XMLHttpRequest();
            xhr.open(method, urlStr, true);

            if (isApiCall) xhr.setRequestHeader('x-canvas-mode', mode);
            if (method !== 'GET') {
                xhr.setRequestHeader('Content-Type', 'application/json');
                if (token) xhr.setRequestHeader('x-auth-token', token);
            }

            xhr.onload = function() {
                if (xhr.status === 401 && !isLoginCall && typeof window.showSecurityLoginOverlay === 'function') {
                    window.showSecurityLoginOverlay();
                }
                const bodyText = xhr.responseText;
                let parsedJson = {};
                try { parsedJson = bodyText ? JSON.parse(bodyText) : {}; } catch (e) {}

                if (urlStr.includes('/api/tree') && parsedJson && parsedJson.flatMembers) {
                    window._vjCachedMembersMap = parsedJson.flatMembers;
                }

                const resObj = {
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    clone: function() { return resObj; },
                    json: function() { return Promise.resolve(parsedJson); },
                    text: function() { return Promise.resolve(bodyText); }
                };
                resolve(resObj);
            };
            xhr.onerror = function() {
                reject(new TypeError('Failed to fetch'));
            };
            xhr.send(requestBody);
        });
    };

    window.toggleVjCanvasMode = async function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const nextMode = (window.currentCanvasMode === 'vj') ? 'main' : 'vj';
        setCanvasMode(nextMode);
        if (typeof window.updateVjSwitchUI === 'function') window.updateVjSwitchUI();

        window.customTopRootId = null;
        window.currentSelectedId = null;
        window.perfData = [];
        const tbody = document.getElementById('perf-table-tbody');
        if (tbody) tbody.innerHTML = '';

        if (typeof window.fetchTreeData === 'function') {
            await window.fetchTreeData(true);
        } else {
            window.location.reload();
        }
    };

    window.updateVjSwitchUI = function() {
        const btn = document.getElementById('bsVjCanvasToggleBtn');
        if (!btn) return;
        const isVj = (window.currentCanvasMode === 'vj');
        const nextState = isVj ? 'vj' : 'main';
        if (btn.dataset.renderedState === nextState) return;
        btn.dataset.renderedState = nextState;

        btn.innerText = 'VJ';
        btn.title = isVj ? '현재: VJ 모드 활성 중 (클릭 시 기본 VK 계보도로 전환)' : '클릭하여 VJ 모드로 전환';

        const baseStyle = 'position:static !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; width:38px !important; min-width:38px !important; max-width:38px !important; height:28px !important; padding:0 !important; margin:0 !important; border-radius:6px !important; font-size:12px !important; font-weight:800 !important; cursor:pointer !important; box-sizing:border-box !important; flex-shrink:0 !important;';
        const colorStyle = isVj
            ? 'background:#172554 !important; color:#60a5fa !important; border:1.5px solid #60a5fa !important;'
            : 'background:#1e293b !important; color:#cbd5e1 !important; border:1px solid #475569 !important;';

        btn.style.cssText = baseStyle + colorStyle;
    };

    function syncAddPartnerModalVjId() {
        if (window.currentCanvasMode !== 'vj') return;
        const addModal = document.getElementById('addPartnerModal');
        if (!addModal || window.getComputedStyle(addModal).display === 'none') return;

        const idInp = document.getElementById('m-member-id');
        if (idInp && document.activeElement !== idInp) {
            const cur = String(idInp.value || '').trim();
            if (!cur || /^VK-/i.test(cur) || cur.toUpperCase() === 'VJ-001') {
                idInp.value = window.getNextVjAutoId();
            }
        }
    }

    setTimeout(async function() {
        const hasToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
        if (!hasToken) {
            if (typeof window.showSecurityLoginOverlay === 'function') window.showSecurityLoginOverlay();
            return;
        }
        try {
            const checkRes = await window.fetch(window.API_BASE + '/api/auth-check');
            if (!checkRes.ok) {
                if (typeof window.showSecurityLoginOverlay === 'function') window.showSecurityLoginOverlay();
                return;
            }
            if (typeof window.loadDbCompensationRates === 'function') await window.loadDbCompensationRates(true);
            if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
        } catch (e) {
            if (typeof window.showSecurityLoginOverlay === 'function') window.showSecurityLoginOverlay();
        }
    }, 150);

    setInterval(syncAddPartnerModalVjId, 300);
})();

// ============================================================================
// [28] 🖱️ 계보도 파트너 카드 마우스 드래그 앤 드롭으로 후원인 및 라인(A/B) 변경
// ============================================================================
(function initPartnerCardDragAndDropSponsorChangeV28() {
    let draggedMemberId = null;
    let draggedCardEl = null;

    function extractMemberIdFromCard(cardEl) {
        if (!cardEl) return null;
        const attrId = cardEl.getAttribute('data-member-id') || (cardEl.id ? cardEl.id.replace(/^card_/, '') : '');
        if (attrId && /^V[KJ]-/i.test(String(attrId).trim())) return String(attrId).trim().toUpperCase();
        const match = (cardEl.innerText || '').match(/\b(V[KJ]-[A-Z0-9]+)\b/i);
        return match ? match[1].toUpperCase() : null;
    }

    function bindDragEventsToCards() {
        document.querySelectorAll('.node-card').forEach(function(card) {
            if (card.dataset.dndBoundV28 === 'true') return;
            const mId = extractMemberIdFromCard(card);
            if (!mId) return;

            card.dataset.dndBoundV28 = 'true';
            card.setAttribute('draggable', 'true');

            card.addEventListener('mousedown', function(e) {
                if (e.target.tagName === 'BUTTON') return;
                e.stopPropagation();
            });
            card.addEventListener('dragstart', function(e) {
                draggedMemberId = extractMemberIdFromCard(card);
                draggedCardEl = card;
                if (e.dataTransfer) e.dataTransfer.setData('text/plain', draggedMemberId);
            });
            card.addEventListener('dragover', function(e) {
                if (!draggedMemberId) return;
                e.preventDefault();
            });
            card.addEventListener('drop', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                const targetId = extractMemberIdFromCard(card);
                if (!draggedMemberId || !targetId || draggedMemberId === targetId) return;
                const posInput = window.prompt(draggedMemberId + ' 파트너를 ' + targetId + ' 산하 어느 라인으로 이동하시겠습니까? (A 또는 B 입력)', 'A');
                if (!posInput) return;
                const newPos = posInput.trim().toUpperCase() === 'B' ? 'B' : 'A';
                const sourceMember = window.findMemberNode(draggedMemberId) || { id: draggedMemberId, name: draggedMemberId };
                await window.fetch(window.API_BASE + '/api/member/' + encodeURIComponent(draggedMemberId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originalId: draggedMemberId, id: draggedMemberId, member_id: draggedMemberId,
                        name: sourceMember.name || draggedMemberId, rank: sourceMember.rank || 'GUEST',
                        type: sourceMember.type || '사업자', parentId: targetId, parent_id: targetId, position: newPos
                    })
                });
                if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
            });
        });
    }

    setInterval(bindDragEventsToCards, 600);
})();

// ============================================================================
// [29] ⏳ 헤더 기간 설정 '타임머신' 연동 헬퍼
// ============================================================================
(function initHeaderPeriodTimeMachineV29() {
    window.getHeaderPeriodRange = function() {
        const headerScope = document.querySelector('header, .header, .top-bar') || document.body;
        const dateInputs = Array.from(headerScope.querySelectorAll('input[type="date"], input[type="text"]'))
            .filter(function(el) {
                if (el.closest('.modal, .popup')) return false;
                const val = String(el.value || '').trim().replace(/\//g, '-');
                return /^\d{4}-\d{2}-\d{2}$/.test(val);
            });

        if (dateInputs.length >= 2) {
            return {
                start: String(dateInputs[0].value).trim().replace(/\//g, '-'),
                end: String(dateInputs[1].value).trim().replace(/\//g, '-'),
                startInput: dateInputs[0],
                endInput: dateInputs[1]
            };
        }
        return { start: '', end: '', startInput: null, endInput: null };
    };

    document.addEventListener('change', function(e) {
        if (e.target && e.target.closest('header, .header, .top-bar') && e.target.type === 'date') {
            if (typeof window.fetchTreeData === 'function') window.fetchTreeData(true);
        }
    }, true);
})();

// ============================================================================
// [30] 🕒 GitHub 업로드 작업메모 기본값을 'YYYY-MM-DD_HHMM' (24시간제)으로 자동 세팅
// ============================================================================
(function initGitPushDefaultMemoFormatV30() {
    window.getGitDefaultMemoTimeStr = function() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd + '_' + hh + min;
    };
})();

// ============================================================================
// [31] ❓ 상단 헤더 우측 [⚙️] ➔ [VJ] ➔ [?] 흔들림 제로(0%) 1줄 고정 & 보상플랜 요약표
// ============================================================================
(function initCompensationPlanHelpAndStableRowV31() {
    window.openCompensationPlanPopup = function() {
        const win = window.open('', 'COMP_PLAN_HELP', 'width=1100,height=760,resizable=yes,scrollbars=yes');
        if (!win) return;
        const html = [
            '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Compensation Plan (マーケティングプラン要約)</title>',
            '<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;color:#1e293b;font-family:Meiryo,sans-serif}.cp-header{text-align:center;margin-bottom:18px}.cp-title{display:inline-block;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#1e3a8a;border-bottom:2.5px solid #2563eb;padding-bottom:4px;margin:0 0 8px 0}.cp-subtitle{font-size:15px;font-weight:700;color:#334155;margin:0}table{width:100%;border-collapse:collapse;border:1.5px solid #94a3b8;font-size:12px}th{background:#8e9aaf;color:#0f172a;font-weight:700;padding:8px 6px;border:1px solid #cbd5e1}td{border:1px solid #e2e8f0;padding:8px;text-align:center}td.col-title{font-weight:800;width:90px}td.col-pv{text-align:left;width:220px}td.col-fp{text-align:left;width:250px;line-height:1.5}</style></head><body>',
            '<div class="cp-header"><h1 class="cp-title">Compensation Plan</h1><p class="cp-subtitle">マーケティングプラン要約</p></div>',
            '<table><thead><tr><th rowspan="3">タイトル</th><th rowspan="3">タイトル獲得PV<br>(無限累積)</th><th rowspan="3">購読基準CV</th><th colspan="10">手当支給基準CV</th></tr>',
            '<tr><th rowspan="2">紹介手当</th><th rowspan="2">支援手当</th><th colspan="5">紹介マッチング手当</th><th rowspan="2">維持ボリュームCV</th><th rowspan="2">タイトル維持手当</th><th rowspan="2">ファストパワー手当</th></tr>',
            '<tr><th>1代</th><th>2代</th><th>3代</th><th>4代</th><th>5代</th></tr></thead><tbody>',
            '<tr><td class="col-title">Customer</td><td>-</td><td rowspan="4">なし</td><td>0%</td><td>0%</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>',
            '<td rowspan="11" class="col-fp"><b>▷ プラン1</b>: 左側レッグに2名紹介 → 10万ウォン<br><br><b>▷ プラン2</b>: 左側直接紹介2名が各2名紹介 → 20万ウォン<br><br><b>▷ プラン3</b>: 右側直接紹介2名が各2名紹介 → 30万ウォン<br><br>(毎月最大60万ウォン)</td></tr>',
            '<tr><td class="col-title">Guest</td><td class="col-pv">会員登録時</td><td>0%</td><td>0%</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td rowspan="2">なし</td><td rowspan="2">-</td></tr>',
            '<tr><td class="col-title">Member</td><td class="col-pv">1PV以上〜70万PV未満</td><td rowspan="9">12%</td><td rowspan="7">12%</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>',
            '<tr><td class="col-title">Mania</td><td class="col-pv">70万PV以上</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>',
            '<tr><td class="col-title">Director</td><td class="col-pv">小実績210万PV / 直接MA 70万:MA 70万</td><td rowspan="2">1万 CV</td><td>10%</td><td>-</td><td>-</td><td>-</td><td>-</td><td>210万 CV</td><td>15万ウォン</td></tr>',
            '<tr><td class="col-title">Emerald</td><td class="col-pv">小実績1,400万PV / 直接MA 70万:MA 70万</td><td>10%</td><td>5%</td><td>-</td><td>-</td><td>-</td><td>350万 CV</td><td>30万ウォン</td></tr>',
            '<tr><td class="col-title">Diamond</td><td class="col-pv">小実績1億PV / 紹介系列DR 1:1</td><td rowspan="3">3万 CV</td><td>10%</td><td>5%</td><td>5%</td><td>-</td><td>-</td><td>1,000万 CV</td><td>75万ウォン</td></tr>',
            '<tr><td class="col-title">Green Diamond</td><td class="col-pv">小実績3億PV / EM 1:1 & DM 2期維持</td><td>10%</td><td>5%</td><td>5%</td><td>2%</td><td>-</td><td>1,900万 CV</td><td>140万ウォン</td></tr>',
            '<tr><td class="col-title">Blue Diamond</td><td class="col-pv">小実績10億PV / DM 1:1 & GDM 2期維持</td><td>10%</td><td>5%</td><td>5%</td><td>3%</td><td>-</td><td>3,400万 CV</td><td>230万ウォン</td></tr>',
            '<tr><td class="col-title">Red Diamond</td><td class="col-pv">小実績30億PV / GDM 1:1 & BDM 2期維持</td><td rowspan="2">7万 CV</td><td rowspan="2">10%</td><td>10%</td><td>5%</td><td>5%</td><td>3%</td><td>2%</td><td>6,500万 CV</td><td>400万ウォン</td></tr>',
            '<tr><td class="col-title">Crown</td><td class="col-pv">小実績100億PV / BDM 1:1</td><td>10%</td><td>5%</td><td>5%</td><td>3%</td><td>3%</td><td>13,500万 CV</td><td>600万ウォン</td></tr>',
            '</tbody></table></body></html>'
        ].join('');
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    function mountStableSingleRowButtons() {
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!headerEl) return;

        const gearBtn = headerEl.querySelector('[onclick*="toggleSettingsMenu"], .icon-settings, [title*="설정"]');
        if (!gearBtn) return;

        let inlineGroup = document.getElementById('bs-header-inline-btn-group');
        const vjBtnExist = document.getElementById('bsVjCanvasToggleBtn');
        const helpBtnExist = document.getElementById('bs-comp-plan-help-btn-v32');

        if (inlineGroup && vjBtnExist && helpBtnExist && inlineGroup.contains(gearBtn) && inlineGroup.contains(vjBtnExist) && inlineGroup.contains(helpBtnExist)) {
            if (typeof window.updateVjSwitchUI === 'function') window.updateVjSwitchUI();
            return;
        }

        let vjBtn = vjBtnExist;
        if (!vjBtn) {
            vjBtn = document.createElement('button');
            vjBtn.id = 'bsVjCanvasToggleBtn';
            vjBtn.type = 'button';
            vjBtn.onclick = window.toggleVjCanvasMode;
        }

        let helpBtn = helpBtnExist;
        if (!helpBtn) {
            helpBtn = document.createElement('button');
            helpBtn.id = 'bs-comp-plan-help-btn-v32';
            helpBtn.type = 'button';
            helpBtn.title = '보상플랜 요약표 (Compensation Plan)';
            helpBtn.innerText = '?';
            helpBtn.style.cssText = 'position:static !important; width:28px !important; height:28px !important; min-width:28px !important; max-width:28px !important; border-radius:6px !important; background:#1e293b !important; border:1px solid #475569 !important; color:#cbd5e1 !important; font-size:13.5px !important; font-weight:800 !important; cursor:pointer !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; padding:0 !important; margin:0 !important; flex-shrink:0 !important; box-sizing:border-box !important;';
            helpBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.openCompensationPlanPopup();
            };
        }

        if (!inlineGroup) {
            inlineGroup = document.createElement('div');
            inlineGroup.id = 'bs-header-inline-btn-group';
            inlineGroup.style.cssText = 'display:inline-flex !important; flex-direction:row !important; flex-wrap:nowrap !important; align-items:center !important; gap:5px !important; margin:0 4px !important; padding:0 !important; flex-shrink:0 !important; vertical-align:middle !important;';
            if (gearBtn.parentElement) {
                gearBtn.parentElement.insertBefore(inlineGroup, gearBtn);
            }
        }

        inlineGroup.appendChild(gearBtn);
        inlineGroup.appendChild(vjBtn);
        inlineGroup.appendChild(helpBtn);

        if (typeof window.updateVjSwitchUI === 'function') window.updateVjSwitchUI();
    }

    setTimeout(mountStableSingleRowButtons, 50);
    setTimeout(mountStableSingleRowButtons, 300);
    setInterval(mountStableSingleRowButtons, 800);
})();

// ============================================================================
// [32] 🔄 우측 상단 컨트롤 바(- ⊙ ⤢ +) 내부에 VJ 초기화(🔄) 아이콘 장착
// ============================================================================
(function initVjResetIconInRightToolbarV32() {
    window.handleResetVjCanvas = async function() {
        const confirmed = window.confirm('현재 VJ 캔버스의 모든 파트너와 매출 내역을 삭제하고 최초 상태(VJ-001 박성혜 마스터 1명)로 초기화하시겠습니까?');
        if (!confirmed) return;

        try {
            const res = await window.fetch(window.API_BASE + '/api/vj/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-canvas-mode': 'vj' },
                body: JSON.stringify({ _canvasMode: 'vj' })
            });
            const data = await res.json();
            if (res.ok && data && data.success) {
                window._vjCachedMembersMap = {};
                if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
                else window.location.reload();
            }
        } catch (err) {}
    };

    function mountResetIconIntoRightToolbar() {
        if (document.getElementById('bs-vj-floating-reset-btn-v33')) return;

        const rightToolbar = document.querySelector('.zoom-controls');
        if (!rightToolbar) return;

        const resetBtn = document.createElement('button');
        resetBtn.id = 'bs-vj-floating-reset-btn-v33';
        resetBtn.type = 'button';
        resetBtn.title = 'VJ 모드 초기화 (VJ-001 초기 상태로 리셋)';
        resetBtn.innerHTML = '↺';
        resetBtn.style.cssText = 'width:28px !important; height:28px !important; border-radius:6px !important; background:transparent !important; border:none !important; color:#cbd5e1 !important; font-size:15px !important; font-weight:bold !important; cursor:pointer !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; padding:0 !important; margin:0 2px !important;';
        resetBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.handleResetVjCanvas();
        };

        rightToolbar.insertBefore(resetBtn, rightToolbar.firstChild);
        rightToolbar.style.setProperty('display', 'inline-flex', 'important');
        rightToolbar.style.setProperty('align-items', 'center', 'important');
        rightToolbar.style.setProperty('width', 'auto', 'important');
    }

    setInterval(mountResetIconIntoRightToolbar, 500);
})();
// ============================================================================
// [33] 🎢 계보도 캔버스 60fps 부드러운 마우스 휠(Smooth Wheel) 상하/좌우 스크롤 복원
//      - 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호를 완전히 제거한 안전 버전
// ============================================================================
(function initSmoothTreeCanvasWheelPanV33() {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isAnimating = false;

    function getTreeWrapperEl() {
        return document.getElementById('tree-wrapper') ? document.getElementById('tree-wrapper') : document.querySelector('.tree-wrapper');
    }

    function parseCurrentTransform(el) {
        let x = typeof window.panX === 'number' ? window.panX : 0;
        let y = typeof window.panY === 'number' ? window.panY : 0;
        let scale = typeof window.scale === 'number' ? window.scale : 0.85;

        if (!el) return { x: x, y: y, scale: scale };

        const st = window.getComputedStyle(el);
        const tr = st.transform ? st.transform : (el.style.transform ? el.style.transform : '');

        if (tr && tr !== 'none') {
            const m2d = tr.match(/matrix\(([^)]+)\)/);
            if (m2d && m2d[1]) {
                const vals = m2d[1].split(',').map(function(v) { return parseFloat(v.trim()); });
                if (vals.length >= 6) {
                    if (!isNaN(vals[0]) && vals[0] > 0) scale = vals[0];
                    if (!isNaN(vals[4])) x = vals[4];
                    if (!isNaN(vals[5])) y = vals[5];
                }
            }
        }
        return { x: x, y: y, scale: scale };
    }

    function applyCanvasTransform(el, x, y, scale) {
        if (!el) return;
        window.panX = x;
        window.panY = y;
        window.scale = scale;

        const transformValue = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) scale(' + scale + ')';
        el.style.setProperty('transition', 'none', 'important');
        el.style.setProperty('transform-origin', '0 0', 'important');
        el.style.setProperty('transform', transformValue, 'important');
    }

    function smoothWheelStep() {
        if (!isAnimating) return;

        const wrapper = getTreeWrapperEl();
        if (!wrapper) {
            isAnimating = false;
            return;
        }

        const ease = 0.28;
        const dx = targetX - currentX;
        const dy = targetY - currentY;

        if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
            currentX = targetX;
            currentY = targetY;
            isAnimating = false;
        } else {
            currentX += dx * ease;
            currentY += dy * ease;
        }

        const curScale = typeof window.scale === 'number' ? window.scale : 0.85;
        applyCanvasTransform(wrapper, currentX, currentY, curScale);

        if (isAnimating) {
            requestAnimationFrame(smoothWheelStep);
        }
    }

    // 마우스로 직접 캔버스를 잡고 드래그할 때는 휠 관성 애니메이션 즉시 정지
    window.addEventListener('pointerdown', function() {
        isAnimating = false;
    }, { capture: true });

    // 계보도 영역 마우스 휠 이벤트 가로채기 (상하/좌우 스크롤 작동)
    window.addEventListener('wheel', function(e) {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return;

        // 좌측 매출 패널, 하단 실적 집계 위젯, 상단 헤더, 모달창 내부에서는 자체 스크롤 유지
        const isInsideOtherPanel = Boolean(
            t.closest('#salesWidget') ? true :
            t.closest('#perfWidget') ? true :
            t.closest('#bonusDetailModal') ? true :
            t.closest('#memberEditModal') ? true :
            t.closest('#addPartnerModal') ? true :
            t.closest('#filterWidget') ? true :
            t.closest('.bs-inpage-modal-wrap-v29') ? true :
            t.closest('.settings-menu') ? true :
            t.closest('#settingsDropdown') ? true :
            t.closest('header') ? true :
            t.closest('aside') ? true : false
        );

        if (isInsideOtherPanel) return;

        const wrapper = getTreeWrapperEl();
        if (!wrapper) return;

        e.preventDefault();
        e.stopPropagation();

        // Ctrl 키(또는 Mac Cmd 키)를 누른 채 휠을 굴리면 확대/축소(Zoom)로 동작
        if (Boolean(e.ctrlKey) ? true : Boolean(e.metaKey)) {
            if (typeof window.changeZoom === 'function') {
                window.changeZoom(e.deltaY > 0 ? -0.06 : 0.06, e.clientX, e.clientY);
            }
            return;
        }

        const multiplier = (e.deltaMode === 1) ? 32 : (e.deltaMode === 2 ? 300 : 1);
        let deltaX = e.deltaX * multiplier;
        let deltaY = e.deltaY * multiplier;

        // Shift 키를 누르고 휠을 굴리면 좌우 스크롤로 전환
        if (e.shiftKey && Math.abs(deltaX) < Math.abs(deltaY)) {
            deltaX = deltaY;
            deltaY = 0;
        }

        if (!isAnimating) {
            const cur = parseCurrentTransform(wrapper);
            currentX = cur.x;
            currentY = cur.y;
            targetX = cur.x;
            targetY = cur.y;
        }

        const speed = 1.25;
        targetX -= deltaX * speed;
        targetY -= deltaY * speed;

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(smoothWheelStep);
        }
    }, { passive: false, capture: true });
})();
// ============================================================================
// [34] ⌨️ ESC 키 입력 시 시뮬레이터 전체 화면 및 상태 완벽 초기화
//      - 모든 모달/인페이지 팝업 닫기 + 좌측/하단 패널 접기 + 검색/선택/가상모드 해제 + 계보도 정중앙 정렬
// ============================================================================
(function initEscapeKeyFullPageResetV34() {
    window.resetSimulatorPageToInitialState = function() {
        // 1. 열려 있는 기본 모달창 모두 닫기
        const modalIds = [
            'addPartnerModal',
            'memberEditModal',
            'bonusDetailModal',
            'filterWidget',
            'bs-root-switch-modal-overlay',
            'bs-duplicate-partner-modal',
            'bs-dnd-line-modal-v28',
            'bs-id-unlock-pw-modal',
            'bs-mobile-drawer-overlay'
        ];
        modalIds.forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            if (id.indexOf('bs-') === 0 && id !== 'bs-mobile-drawer-overlay') {
                el.remove();
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        // 2. 맥북 스타일 인페이지 팝업 모달(내비게이터, 매출 기간 검색, 보상플랜 요약표 등) 모두 닫기
        document.querySelectorAll('.bs-inpage-modal-wrap-v29').forEach(function(wrap) {
            wrap.remove();
        });
        if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed) {
            try { window.bizNavPopupWindow.close(); } catch (e) {}
        }
        if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
            try { window.salesSearchPopupWindow.close(); } catch (e) {}
        }
        window.bizNavPopupWindow = null;
        window.salesSearchPopupWindow = null;

        // 3. 상단 톱니바퀴 표시 설정 드롭다운 메뉴 닫기
        const settingsMenu = document.getElementById('settingsDropdown') ? document.getElementById('settingsDropdown') : document.querySelector('.settings-menu');
        if (settingsMenu) {
            settingsMenu.style.setProperty('display', 'none', 'important');
        }

        // 4. 좌측 매출/구독 내역 패널 슬라이드 접기
        const salesW = document.getElementById('salesWidget');
        if (salesW) {
            salesW.classList.add('closed');
            salesW.style.setProperty('transform', 'translateX(-100%)', 'important');
        }

        // 5. 하단 실적/수당 시뮬레이터 위젯 슬라이드 접기
        if (typeof window.setPerfSidebarState === 'function') {
            window.setPerfSidebarState(true);
        }
        const perfW = document.getElementById('perfWidget');
        if (perfW) {
            perfW.style.setProperty('left', '0px', 'important');
        }

        // 6. 검색창 입력값 및 검색 하이라이트 초기화
        ['searchInput', 'salesSearchInput', 'bs-mobile-search-inp'].forEach(function(inpId) {
            const inp = document.getElementById(inpId);
            if (inp) {
                inp.value = '';
                inp.blur();
            }
        });
        if (window.searchedHighlightIds && typeof window.searchedHighlightIds.clear === 'function') {
            window.searchedHighlightIds.clear();
        }

        // 7. 가상모드(특정 파트너 최상단 고정 및 카드 픽커 모드) 해제 -> 전체 최상위 루트로 복귀
        if (typeof window.toggleRootCardPickMode === 'function') {
            window.toggleRootCardPickMode(false);
        }
        window.customTopRootId = null;
        localStorage.removeItem('bs_saved_custom_root_id');
        if (typeof window.isolateSubtreeInDOM === 'function') {
            window.isolateSubtreeInDOM(null);
        }

        // 8. 후원계보도 기본 모드로 복원 및 카드 선택 해제
        window.treeMode = 'sponsor';
        window.currentSelectedId = null;

        const salesName = document.getElementById('sales-target-name');
        if (salesName) salesName.innerText = '선택 안됨';
        const perfName = document.getElementById('perf-target-name');
        if (perfName) perfName.innerText = '(선택 안됨)';

        if (typeof window.loadMemberSales === 'function') {
            window.loadMemberSales(null);
        }
        if (typeof window.calculateLocalPerformance === 'function') {
            window.calculateLocalPerformance(null);
        }

        // 9. 계보도 재렌더링 및 루트 카드 화면 정중앙 정렬(초기 줌 배율 복원)
        if (typeof window.renderTree === 'function') {
            window.renderTree(true);
        }
        setTimeout(function() {
            if (typeof window.centerRootNode === 'function') {
                window.centerRootNode();
            }
            if (typeof window.applyCardHighlights === 'function') {
                window.applyCardHighlights();
            }
        }, 80);
    };

    // 캡처 단계에서 ESC 키를 감지하여 어떤 상태에서도 즉시 페이지 초기화 실행
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' ? true : (e.keyCode === 27)) {
            // 로그인 화면이 떠 있을 때는 제외
            if (document.getElementById('bs-auth-login-overlay')) return;

            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }

            window.resetSimulatorPageToInitialState();

            // 만약 아예 브라우저 새로고침(F5)과 동일한 완전 초기화를 원하실 경우 아래 주석을 해제하시면 됩니다:
            // window.location.reload();
        }
    }, true);
})();
// ============================================================================
// [35] 🎯 본인 매출(70만 PV -> MANIA / 7만 PV -> MEMBER) 자동 승급 + 4기수 이내(RECENT_4) 승급 판정 + 내비게이터 소실적 마킹 완성본
//      1) 초기 직급이 GUEST/MEMBER인 파트너(예: VJ-004 호소야)라도 본인 매출이 700,000 PV 이상이면 즉시 MANIA로 자동 승급!
//      2) 매니아 -> 디렉터(210만 PV), 디렉터 -> 에메랄드(1,400만 PV)는 반드시 '연속 4기수 합산 소실적 PV'로만 판정
//      3) VJ 모드와 VK 모드의 회원 ID 및 직급 캐시가 절대 섞이지 않도록 모드별 분리 적용
//      4) 복사 시 문법 에러를 유발하는 파이프(||) 및 백틱(`) 기호 완전 배제
// ============================================================================
(function restoreStrict4TermRankAndFullNavigatorV35() {
    const RANK_CACHE_KEY = 'BS_COMPUTED_RANK_CACHE_V35_MODE_SAFE';

    function normId(val) {
        if (!val) return '';
        let s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        return String(s).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
    }

    function modeSafeCacheKey(val) {
        if (!val) return '';
        let s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        const raw = String(s).trim().toLowerCase();
        if (raw.indexOf('vj') === 0) return 'vj_' + raw.replace(/^vj-?0*/, '');
        if (raw.indexOf('vk') === 0) return 'vk_' + raw.replace(/^vk-?0*/, '');
        const prefix = (window.currentCanvasMode === 'vj') ? 'vj_' : 'vk_';
        return prefix + raw.replace(/^v[kj]-?0*/, '');
    }

    function loadComputedRankCache() {
        try {
            const raw = localStorage.getItem(RANK_CACHE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveComputedRankCache(cacheObj) {
        try {
            localStorage.setItem(RANK_CACHE_KEY, JSON.stringify(cacheObj ? cacheObj : {}));
        } catch (e) {}
    }

    window.applyCachedRanksToTreeMemory = function() {
        const cache = loadComputedRankCache();
        if (!cache) return;

        function walkNode(n) {
            if (!n) return;
            const k = modeSafeCacheKey(n.id ? n.id : n.member_id);
            if (k && cache[k]) {
                n.rank = cache[k];
                n.rank_name = cache[k];
            }
            if (n.left && typeof n.left === 'object') walkNode(n.left);
            if (n.right && typeof n.right === 'object') walkNode(n.right);
            if (Array.isArray(n.children)) {
                n.children.forEach(function(c) { walkNode(c); });
            }
        }

        if (window.treeData) walkNode(window.treeData);
        if (window.flatMembersData && typeof window.flatMembersData === 'object') {
            Object.keys(window.flatMembersData).forEach(function(key) {
                const m = window.flatMembersData[key];
                const k = modeSafeCacheKey(m && m.id ? m.id : key);
                if (m && k && cache[k]) {
                    m.rank = cache[k];
                    m.rank_name = cache[k];
                }
            });
        }
        if (window.memberMap instanceof Map) {
            window.memberMap.forEach(function(m, key) {
                const k = modeSafeCacheKey(m && m.id ? m.id : key);
                if (m && k && cache[k]) {
                    m.rank = cache[k];
                    m.rank_name = cache[k];
                }
            });
        }
    };

    function isSameYearMonthHalf(y1, m1, h1, y2, m2, h2) {
        return (y1 === y2 && m1 === m2 && h1 === h2);
    }

    function isAfterYearMonthHalf(y1, m1, h1, y2, m2, h2) {
        if (y1 > y2) return true;
        if (y1 === y2 && m1 > m2) return true;
        if (y1 === y2 && m1 === m2 && h1 > h2) return true;
        return false;
    }

    // 1. 두 기수 키 사이의 모든 연속 반월 기수 배열 생성
    window.buildContinuousPeriodKeys = function(minKey, maxKey) {
        if (!minKey) return [];
        if (!maxKey) return [minKey];
        const p1 = String(minKey).split('-');
        const p2 = String(maxKey).split('-');
        if (p1.length < 3) return [minKey];
        if (p2.length < 3) return [minKey];

        let y = parseInt(p1[0], 10);
        let m = parseInt(p1[1], 10);
        let h = parseInt(p1[2], 10);

        const endY = parseInt(p2[0], 10);
        const endM = parseInt(p2[1], 10);
        const endH = parseInt(p2[2], 10);

        const result = [];
        let safety = 0;
        while (safety++ < 240) {
            const key = y + '-' + String(m).padStart(2, '0') + '-' + (h === 1 ? '1' : '2');
            result.push(key);
            if (isSameYearMonthHalf(y, m, h, endY, endM, endH)) break;
            if (isAfterYearMonthHalf(y, m, h, endY, endM, endH)) break;

            if (h === 1) {
                h = 2;
            } else {
                h = 1;
                m += 1;
                if (m > 12) {
                    m = 1;
                    y += 1;
                }
            }
        }
        return result;
    };

    // 2. 특정 기준 기수(anchorKey)로부터 정확히 연속된 최근 N개 기수 키 반환
    window.getContinuousRecentNPeriodKeys = function(anchorKey, count) {
        const n = count ? count : 4;
        let parts = String(anchorKey ? anchorKey : '2026-11-2').split('-');
        if (parts.length < 3) parts = ['2026', '11', '2'];

        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        const rawHalf = String(parts[2]).trim();
        let h = (rawHalf === '1' ? true : (rawHalf === '전')) ? 1 : 2;

        const keys = [];
        for (let i = 0; i < n; i++) {
            const mmStr = String(m).padStart(2, '0');
            const sortKey = y + '-' + mmStr + '-' + (h === 1 ? '1' : '2');
            const label = m + '월 ' + (h === 1 ? '1기' : '2기') + '(' + mmStr + '-' + (h === 1 ? '전' : '후') + ')';
            keys.push({ sortKey: sortKey, label: label });

            if (h === 2) {
                h = 1;
            } else {
                h = 2;
                m -= 1;
                if (m < 1) {
                    m = 12;
                    y -= 1;
                }
            }
        }
        return keys;
    };

    // 3. 🌟 본인 누적 매출(70만 PV -> MANIA, 7만 PV -> MEMBER) + 4기수 이내(RECENT_4) 산하 실적 직급 판정 함수
    window.resolveHistoricalRank = function(memberObj, orderKey, rawSk, backendMembersMap, accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo, selfTotalPV) {
        if (!memberObj) return 'GUEST';
        const rawDbRank = String(memberObj.rank ? memberObj.rank : (memberObj.rank_name ? memberObj.rank_name : 'GUEST')).trim().toUpperCase();
        const myPV = typeof selfTotalPV === 'number' ? selfTotalPV : 0;

        // 3-1. 본인 매출(myPV) 기준 기본 직급(GUEST -> MEMBER -> MANIA) 결정
        let achievedRank = 'GUEST';
        if (myPV >= 700000) {
            achievedRank = 'MANIA';
        } else if (myPV >= 70000) {
            achievedRank = (rawDbRank === 'GUEST' ? 'MEMBER' : (rawDbRank === 'MEMBER' ? 'MEMBER' : 'MANIA'));
        } else {
            // 본인 매출이 7만 PV 미만일 때는 원래 GUEST/MEMBER이면 그대로 유지, 원래 MANIA 이상으로 지정된 경우 MANIA에서 출발
            if (rawDbRank === 'GUEST' ? true : (rawDbRank === 'MEMBER')) {
                achievedRank = rawDbRank;
            } else {
                achievedRank = 'MANIA';
            }
        }

        // 아직 MANIA가 아닌 경우(GUEST 또는 MEMBER) 산하 실적 승급(DIRECTOR 이상) 대상이 아니므로 즉시 반환
        if (achievedRank === 'GUEST' ? true : (achievedRank === 'MEMBER')) {
            return achievedRank;
        }

        // 3-2. MANIA 달성자에 대해 산하 소실적(DIRECTOR/EMERALD는 연속 4기수 합산, DIAMOND 이상은 전체 누적) 평가
        const totalMinorLegPV = Math.min(accAPV ? accAPV : 0, accBPV ? accBPV : 0);
        const r4A = (recent4APV !== undefined && recent4APV !== null) ? recent4APV : 0;
        const r4B = (recent4BPV !== undefined && recent4BPV !== null) ? recent4BPV : 0;
        const recent4MinorLegPV = Math.min(r4A, r4B);

        const dbRanks = (Array.isArray(window.dbRanksSorted) && window.dbRanksSorted.length > 0)
            ? window.dbRanksSorted
            : [
                { rank_id: 4, rank_level: 4, rank_name: 'DIRECTOR', period_type: 'RECENT_4', minor_leg_pv: 2100000, required_partner_rank_id: 3, is_direct_sponsor: 1 },
                { rank_id: 5, rank_level: 5, rank_name: 'EMERALD', period_type: 'RECENT_4', minor_leg_pv: 14000000, required_partner_rank_id: 3, is_direct_sponsor: 1 },
                { rank_id: 6, rank_level: 6, rank_name: 'DIAMOND', period_type: 'UNLIMITED', minor_leg_pv: 100000000, required_partner_rank_id: 4, is_direct_sponsor: 0 }
            ];

        for (let i = 0; i < dbRanks.length; i++) {
            const rRow = dbRanks[i];
            const rName = String(rRow.rank_name ? rRow.rank_name : '').trim().toUpperCase();
            const reqMinorPv = Number(rRow.minor_leg_pv ? rRow.minor_leg_pv : 0);
            if (reqMinorPv <= 0) continue;

            const periodType = String(rRow.period_type ? rRow.period_type : '').trim().toUpperCase();
            const isRecent4Restricted = Boolean(periodType === 'RECENT_4' ? true : (rName === 'DIRECTOR' ? true : (rName === 'EMERALD')));
            const compareMinorPV = isRecent4Restricted ? recent4MinorLegPV : totalMinorLegPV;

            if (compareMinorPV < reqMinorPv) continue;

            const reqPartnerRankId = rRow.required_partner_rank_id;
            const isDirectSponsor = Number(rRow.is_direct_sponsor ? rRow.is_direct_sponsor : 0) === 1;

            if (reqPartnerRankId !== null && reqPartnerRankId !== undefined && reqPartnerRankId > 0 && legQualifyInfo) {
                if (isDirectSponsor) {
                    if (legQualifyInfo.maxDirectRankIdA < reqPartnerRankId) continue;
                    if (legQualifyInfo.maxDirectRankIdB < reqPartnerRankId) continue;
                } else {
                    if (legQualifyInfo.maxSubRankIdA < reqPartnerRankId) continue;
                    if (legQualifyInfo.maxSubRankIdB < reqPartnerRankId) continue;
                }
            }

            achievedRank = rName;
        }

        return achievedRank;
    };

    // 4. 전체 회원의 기수별 연속 4기수 슬라이딩 윈도우 평가 및 실제 달성 직급(GUEST -> MANIA -> DIRECTOR...) 동기화
    window.computeAllMembersTeamBonusByPeriod = function(allSales, backendMembersMap) {
        const isVjMode = (window.currentCanvasMode === 'vj');
        const allMembers = typeof window.getAllCombinedMembersList === 'function'
            ? window.getAllCombinedMembersList(backendMembersMap)
            : (typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : []);

        const salesByMember = new Map();
        let minGlobalKey = '';
        let maxGlobalKey = '';

        (allSales ? allSales : []).forEach(function(s) {
            if (!s) return;
            const rawMid = String(s.member_id ? s.member_id : (s.memberId ? s.memberId : (s.id ? s.id : ''))).trim();
            if (!rawMid) return;

            // VJ 모드와 VK 모드 매출이 섞이지 않도록 필터링
            const upperMid = rawMid.toUpperCase();
            if (isVjMode && upperMid.indexOf('VK-') === 0) return;
            if (!isVjMode && upperMid.indexOf('VJ-') === 0) return;

            const midNorm = normId(rawMid);
            if (!midNorm) return;

            const rawDate = s.transaction_date ? s.transaction_date : (s.sales_date ? s.sales_date : (s.buy_date ? s.buy_date : (s.date ? s.date : '')));
            const pInfo = typeof window.getPeriodInfoFromDate === 'function' ? window.getPeriodInfoFromDate(rawDate) : null;
            if (!pInfo) return;

            if (typeof window.getHeaderPeriodRange === 'function') {
                const range = window.getHeaderPeriodRange();
                const cleanD = typeof window.cleanDateStr === 'function' ? window.cleanDateStr(rawDate) : String(rawDate).slice(0, 10);
                if (range && range.end && cleanD > range.end) return;
            }

            const cvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ? s.cv : s.sales_cv) : Number(s.cv ? s.cv : 0);
            const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv ? s.pv : s.sales_pv) : Number(s.pv ? s.pv : 0);
            if (cvVal <= 0 && pvVal <= 0) return;

            if (!minGlobalKey) minGlobalKey = pInfo.sortOrderKey;
            else if (pInfo.sortOrderKey < minGlobalKey) minGlobalKey = pInfo.sortOrderKey;

            if (!maxGlobalKey) maxGlobalKey = pInfo.sortOrderKey;
            else if (pInfo.sortOrderKey > maxGlobalKey) maxGlobalKey = pInfo.sortOrderKey;

            if (!salesByMember.has(midNorm)) salesByMember.set(midNorm, []);
            salesByMember.get(midNorm).push({ pInfo: pInfo, cv: cvVal, pv: pvVal });
        });

        const sortedGlobalKeys = (minGlobalKey && maxGlobalKey)
            ? window.buildContinuousPeriodKeys(minGlobalKey, maxGlobalKey)
            : ['2026-11-2'];

        const teamBonusMap = new Map();
        const computedRankCache = loadComputedRankCache();

        const membersBottomUp = allMembers.slice().sort(function(a, b) {
            return Number(b.generation ? b.generation : 0) - Number(a.generation ? a.generation : 0);
        });

        membersBottomUp.forEach(function(m) {
            if (!m) return;
            if (!m.id) return;
            const mNorm = normId(m.id);
            const foundNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(m.id) : null;
            const treeNode = foundNode ? foundNode : m;
            const subSets = typeof window.getSublinePartnerSets === 'function' ? window.getSublinePartnerSets(treeNode) : { setA: new Set(), setB: new Set() };
            const setA = subSets.setA;
            const setB = subSets.setB;

            const directRecMap = typeof window.getDirectRecommendedPartnersMap === 'function' ? window.getDirectRecommendedPartnersMap(treeNode) : new Map();
            const directRecNormSet = new Set(Array.from(directRecMap.keys()).map(function(k) { return normId(k); }));

            const mPeriodBuckets = {};
            let selfTotalPV = 0;
            const selfSales = salesByMember.get(mNorm);
            if (selfSales) {
                selfSales.forEach(function(item) {
                    selfTotalPV += item.pv;
                    const sk = item.pInfo.sortOrderKey;
                    if (!mPeriodBuckets[sk]) {
                        mPeriodBuckets[sk] = { sortOrderKey: sk, backendKey: item.pInfo.backendKey, periodLabel: item.pInfo.periodLabel, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0, self_pv: 0 };
                    }
                    mPeriodBuckets[sk].self_pv = (mPeriodBuckets[sk].self_pv ? mPeriodBuckets[sk].self_pv : 0) + item.pv;
                });
            }

            setA.forEach(function(subNorm) {
                const list = salesByMember.get(normId(subNorm));
                if (!list) return;
                list.forEach(function(item) {
                    const sk = item.pInfo.sortOrderKey;
                    if (!mPeriodBuckets[sk]) {
                        mPeriodBuckets[sk] = { sortOrderKey: sk, backendKey: item.pInfo.backendKey, periodLabel: item.pInfo.periodLabel, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0, self_pv: 0 };
                    }
                    mPeriodBuckets[sk].a_cv += item.cv;
                    mPeriodBuckets[sk].a_pv += item.pv;
                });
            });

            setB.forEach(function(subNorm) {
                const list = salesByMember.get(normId(subNorm));
                if (!list) return;
                list.forEach(function(item) {
                    const sk = item.pInfo.sortOrderKey;
                    if (!mPeriodBuckets[sk]) {
                        mPeriodBuckets[sk] = { sortOrderKey: sk, backendKey: item.pInfo.backendKey, periodLabel: item.pInfo.periodLabel, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0, self_pv: 0 };
                    }
                    mPeriodBuckets[sk].b_cv += item.cv;
                    mPeriodBuckets[sk].b_pv += item.pv;
                });
            });

            let prevA = 0;
            let prevB = 0;
            let accAPV = 0;
            let accBPV = 0;
            let accSelfPV = 0;

            const rawInitRank = String(m.rank ? m.rank : (m.rank_name ? m.rank_name : 'GUEST')).trim().toUpperCase();
            // 🌟 본인 누적 매출(selfTotalPV)이 700,000 PV 이상이면 초기 직급이 GUEST였더라도 즉시 MANIA 자격 부여!
            let highestRankAchieved = 'GUEST';
            if (selfTotalPV >= 700000) {
                highestRankAchieved = 'MANIA';
            } else if (selfTotalPV >= 70000) {
                highestRankAchieved = (rawInitRank === 'GUEST' ? 'MEMBER' : (rawInitRank === 'MEMBER' ? 'MEMBER' : 'MANIA'));
            } else {
                highestRankAchieved = (rawInitRank === 'GUEST' ? 'GUEST' : (rawInitRank === 'MEMBER' ? 'MEMBER' : 'MANIA'));
            }

            const recent4Window = [];
            const memberPeriodResult = {};

            sortedGlobalKeys.forEach(function(k) {
                const parts = k.split('-');
                const defaultBackendKey = parts[0] + '-' + parts[1] + '-' + (parts[2] === '1' ? '전' : '후');
                const b = mPeriodBuckets[k] ? mPeriodBuckets[k] : { sortOrderKey: k, backendKey: defaultBackendKey, a_cv: 0, b_cv: 0, a_pv: 0, b_pv: 0, self_pv: 0 };

                accAPV += b.a_pv;
                accBPV += b.b_pv;
                accSelfPV += (b.self_pv ? b.self_pv : 0);

                recent4Window.push({ a_pv: b.a_pv ? b.a_pv : 0, b_pv: b.b_pv ? b.b_pv : 0 });
                if (recent4Window.length > 4) recent4Window.shift();

                const recent4APV = recent4Window.reduce(function(sum, item) { return sum + item.a_pv; }, 0);
                const recent4BPV = recent4Window.reduce(function(sum, item) { return sum + item.b_pv; }, 0);

                const legQualifyInfo = typeof window.getLegPartnerQualificationInfo === 'function'
                    ? window.getLegPartnerQualificationInfo(treeNode, setA, setB, directRecNormSet, k, teamBonusMap)
                    : null;

                // 해당 기수까지의 본인 누적 PV(accSelfPV) 또는 전체 본인 PV(selfTotalPV)로 승급 판정
                const effectiveSelfPV = Math.max(accSelfPV, selfTotalPV);

                const evaluatedRank = window.resolveHistoricalRank(
                    treeNode, k, b.backendKey ? b.backendKey : defaultBackendKey, backendMembersMap,
                    accAPV, accBPV, recent4APV, recent4BPV, legQualifyInfo, effectiveSelfPV
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

                memberPeriodResult[k] = {
                    teamBonus: tb,
                    matchedCV: deduct,
                    accAPV: accAPV,
                    accBPV: accBPV,
                    recent4APV: recent4APV,
                    recent4BPV: recent4BPV,
                    historicalRank: histRank
                };
            });

            if (highestRankAchieved && treeNode) {
                treeNode.rank = highestRankAchieved;
                treeNode.rank_name = highestRankAchieved;
                m.rank = highestRankAchieved;
                m.rank_name = highestRankAchieved;
                computedRankCache[modeSafeCacheKey(m.id)] = highestRankAchieved;
            }

            teamBonusMap.set(mNorm, memberPeriodResult);
        });

        saveComputedRankCache(computedRankCache);

        // 🌟 화면에 렌더링된 계보도 카드의 직급 텍스트 및 테두리 스타일(GUEST -> MANIA 등) 즉시 동기화
        const rankNames = ['GUEST', 'MEMBER', 'MANIA', 'DIRECTOR', 'EMERALD', 'DIAMOND', 'GREEN DIAMOND', 'BLUE DIAMOND', 'RED DIAMOND', 'CROWN'];
        const rankCssClasses = ['rank-guest', 'rank-member', 'rank-mania', 'rank-director', 'rank-emerald', 'rank-diamond', 'rank-green-diamond', 'rank-blue-diamond', 'rank-red-diamond', 'rank-crown'];

        document.querySelectorAll('.node-card').forEach(function(card) {
            const cId = card.getAttribute('data-member-id') ? card.getAttribute('data-member-id') : (card.id ? card.id.replace(/^card_/, '') : '');
            if (!cId) return;
            const node = typeof window.findMemberNode === 'function' ? window.findMemberNode(cId) : null;
            if (!node) return;
            if (!node.rank) return;
            const actualRank = String(node.rank).trim().toUpperCase();

            // 카드 클래스 업데이트 (GUEST 회색 테두리 -> MANIA 컬러 반영)
            const targetClass = 'rank-' + actualRank.toLowerCase().replace(/\s+/g, '-');
            if (!card.classList.contains(targetClass)) {
                rankCssClasses.forEach(function(cls) { card.classList.remove(cls); });
                card.classList.add(targetClass);
            }
            card.setAttribute('data-rank', actualRank);

            card.querySelectorAll('.t-common, div, span').forEach(function(el) {
                if (el.children.length === 0 && el.innerText) {
                    const txt = el.innerText.trim().toUpperCase();
                    if (rankNames.indexOf(txt) !== -1 && txt !== actualRank) {
                        el.innerText = actualRank;
                    }
                }
            });
        });

        return teamBonusMap;
    };

    // 5. 계보도 카드 우측 상단 [승급] / [품위유지] 배지도 4기수 제한 기준을 동일하게 적용
    window.evaluateMemberCardBadgeStatus = function(memberId) {
        const res = {
            showPromoBadge: false, showMaintBadge: false,
            promoPct: 0, promoTargetRank: '', promoCurrPV: 0, promoReqPV: 0,
            maintPct: 0, maintCurrVal: 0, maintReqVal: 0, maintUnit: 'CV'
        };
        if (!memberId) return res;
        if (typeof window.findMemberNode !== 'function') return res;

        let thresholdPct = parseInt(localStorage.getItem('bs_badge_threshold_pct') ? localStorage.getItem('bs_badge_threshold_pct') : '80', 10);
        if (isNaN(thresholdPct) ? true : (thresholdPct < 10)) thresholdPct = 80;

        const mNode = window.findMemberNode(memberId);
        if (!mNode) return res;

        const mNorm = normId(memberId);
        const currRank = String(mNode.rank ? mNode.rank : (mNode.rank_name ? mNode.rank_name : 'MANIA')).trim().toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];
        const foundNext = dbRanks.find(function(r) { return Number(r.rank_level ? r.rank_level : 0) > currLevel && Number(r.minor_leg_pv ? r.minor_leg_pv : 0) > 0; });
        const nextRank = foundNext ? foundNext : { rank_name: 'EMERALD', minor_leg_pv: 14000000, period_type: 'RECENT_4' };

        const reqMinorPV = Number(nextRank.minor_leg_pv ? nextRank.minor_leg_pv : 0);
        const nextRankName = String(nextRank.rank_name ? nextRank.rank_name : 'NEXT').toUpperCase();
        const pType = String(nextRank.period_type ? nextRank.period_type : '').toUpperCase();
        const isTermRestricted = Boolean(pType === 'RECENT_4' ? true : (nextRankName === 'DIRECTOR' ? true : (nextRankName === 'EMERALD')));

        let evalMinorPV = 0;
        if (window.lastAllMembersTeamBonusMap instanceof Map && window.lastAllMembersTeamBonusMap.has(mNorm)) {
            const pMap = window.lastAllMembersTeamBonusMap.get(mNorm);
            const keys = Object.keys(pMap).sort();
            if (keys.length > 0) {
                const lastData = pMap[keys[keys.length - 1]];
                if (lastData) {
                    evalMinorPV = isTermRestricted
                        ? Math.min(lastData.recent4APV ? lastData.recent4APV : 0, lastData.recent4BPV ? lastData.recent4BPV : 0)
                        : Math.min(lastData.accAPV ? lastData.accAPV : 0, lastData.accBPV ? lastData.accBPV : 0);
                }
            }
        }

        if (reqMinorPV > 0) {
            res.promoPct = Math.floor((evalMinorPV / reqMinorPV) * 100);
            res.promoTargetRank = nextRankName;
            res.promoCurrPV = evalMinorPV;
            res.promoReqPV = reqMinorPV;
            res.showPromoBadge = (res.promoPct >= thresholdPct);
        }

        if (typeof window.computeUnifiedDignityMetrics === 'function') {
            const dInfo = window.computeUnifiedDignityMetrics(memberId);
            if (dInfo && dInfo.isEligibleRank) {
                res.maintPct = dInfo.maintPct;
                res.maintCurrVal = dInfo.totalRecognizedCV;
                res.maintReqVal = dInfo.reqMaintCV;
                res.showMaintBadge = (dInfo.maintPct >= thresholdPct);
            }
        }
        return res;
    };

    // 6. 품위유지 달성 등급 판정 헬퍼 복원
    window.getDbRequiredMaintCV = function(rankName) {
        const rUpper = String(rankName ? rankName : '').trim().toUpperCase();
        if (!rUpper) return 0;
        if (rUpper === 'GUEST' ? true : (rUpper === 'MEMBER' ? true : (rUpper === 'MANIA'))) return 0;
        if (window.dbRankMaintenancePolicies && window.dbRankMaintenancePolicies[rUpper] && window.dbRankMaintenancePolicies[rUpper].reqSmallCv > 0) {
            return Number(window.dbRankMaintenancePolicies[rUpper].reqSmallCv);
        }
        const fallbackMap = {
            'DIRECTOR': 2100000,
            'EMERALD': 3500000,
            'DIAMOND': 10000000,
            'GREEN DIAMOND': 19000000,
            'BLUE DIAMOND': 34000000,
            'RED DIAMOND': 65000000,
            'CROWN': 135000000
        };
        return fallbackMap[rUpper] ? fallbackMap[rUpper] : 0;
    };

    window.evaluateMaintAchievedRank = function(currRank, recognizedCV) {
        const currUpper = String(currRank ? currRank : 'MANIA').trim().toUpperCase();
        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currUpper) : 0;
        const dbRanks = (Array.isArray(window.dbRanksSorted) && window.dbRanksSorted.length > 0)
            ? window.dbRanksSorted
            : [
                { rank_name: 'DIRECTOR', rank_level: 4 },
                { rank_name: 'EMERALD', rank_level: 5 },
                { rank_name: 'DIAMOND', rank_level: 6 },
                { rank_name: 'GREEN DIAMOND', rank_level: 7 },
                { rank_name: 'BLUE DIAMOND', rank_level: 8 },
                { rank_name: 'RED DIAMOND', rank_level: 9 },
                { rank_name: 'CROWN', rank_level: 10 }
            ];

        const maintTiers = [];
        dbRanks.forEach(function(r) {
            const rName = String(r.rank_name ? r.rank_name : '').trim().toUpperCase();
            const rLv = Number(r.rank_level ? r.rank_level : (typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(rName) : 0));
            const reqCV = window.getDbRequiredMaintCV(rName);
            if (reqCV > 0) {
                maintTiers.push({ rankName: rName, rankLevel: rLv, reqCV: reqCV });
            }
        });

        maintTiers.sort(function(a, b) { return a.reqCV - b.reqCV; });

        let achievedTier = null;
        for (let i = 0; i < maintTiers.length; i++) {
            const tier = maintTiers[i];
            if (currLevel > 0 && tier.rankLevel > 0 && tier.rankLevel > currLevel) continue;
            if (recognizedCV >= tier.reqCV) {
                achievedTier = tier;
            }
        }

        return {
            isAchieved: achievedTier !== null,
            achievedRank: achievedTier ? achievedTier.rankName : '없음',
            achievedReqCV: achievedTier ? achievedTier.reqCV : 0
        };
    };

    // 7. 비지네스 내비게이터 전체 상세 화면(①②③ 승급조건 + 본인내역 + 소실적/대실적 하이라이트 마킹 하위내역 + 품위유지 달성 현황)
    window.renderBusinessNavigator = async function(targetMemberId, optDoc) {
        const popup = window.bizNavPopupWindow;
        const pDoc = optDoc ? optDoc : ((popup && !popup.closed) ? popup.document : document);
        if (!pDoc) return;

        const bodyEl = pDoc.getElementById('bizNavBody');
        const badgeEl = pDoc.getElementById('bizNavTargetBadge');
        if (!bodyEl) return;

        if (typeof window.loadDbCompensationRates === 'function') {
            try { await window.loadDbCompensationRates(); } catch (e) {}
        }

        const defaultRoot = typeof window.getAbsoluteTopRoot === 'function' ? window.getAbsoluteTopRoot() : null;
        const targetId = targetMemberId ? targetMemberId : (window.currentSelectedId ? window.currentSelectedId : (defaultRoot ? defaultRoot.id : 'VK-1199464'));
        const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(targetId) : null;
        if (!mNode) {
            bodyEl.innerHTML = '<div style="padding:30px; text-align:center; color:#9ca3af;">회원 정보를 찾을 수 없습니다. (' + targetId + ')</div>';
            return;
        }

        const allSales = window.allSalesData ? window.allSalesData : (window.integrated_sales_history ? window.integrated_sales_history : []);
        if (typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
            window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData);
        }

        if (badgeEl) {
            badgeEl.innerHTML = '[' + (mNode.name ? mNode.name : mNode.id) + ' (<b style="font-weight:bold; color:#ffffff;">' + mNode.id + '</b>)]';
        }

        const mNorm = normId(targetId);
        let currRank = String(mNode.rank ? mNode.rank : (mNode.rank_name ? mNode.rank_name : 'MANIA')).trim().toUpperCase();
        if (window.lastAllMembersTeamBonusMap instanceof Map && window.lastAllMembersTeamBonusMap.has(mNorm)) {
            const pMap = window.lastAllMembersTeamBonusMap.get(mNorm);
            const pKeys = Object.keys(pMap).sort();
            if (pKeys.length > 0 && pMap[pKeys[pKeys.length - 1]].historicalRank) {
                currRank = pMap[pKeys[pKeys.length - 1]].historicalRank;
            }
        }

        const currLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(currRank) : 0;
        const dbRanks = Array.isArray(window.dbRanksSorted) ? window.dbRanksSorted : [];

        const foundNext = dbRanks.find(function(r) { return Number(r.rank_level ? r.rank_level : 0) > currLevel && Number(r.minor_leg_pv ? r.minor_leg_pv : 0) > 0; });
        const nextRank = foundNext ? foundNext : { rank_name: 'DIRECTOR', minor_leg_pv: 2100000, period_type: 'RECENT_4', required_partner_rank_id: 3, is_direct_sponsor: 1 };

        const nextRankName = String(nextRank.rank_name ? nextRank.rank_name : 'DIRECTOR').toUpperCase();
        const reqMinorPV = Number(nextRank.minor_leg_pv ? nextRank.minor_leg_pv : 0);

        const reqPartnerRankId = (nextRank.required_partner_rank_id !== null && nextRank.required_partner_rank_id !== undefined && nextRank.required_partner_rank_id !== '')
            ? Number(nextRank.required_partner_rank_id)
            : null;
        const reqPartnerRankObj = (reqPartnerRankId && window.dbRankByIdMap && window.dbRankByIdMap[reqPartnerRankId])
            ? window.dbRankByIdMap[reqPartnerRankId]
            : dbRanks.find(function(r) { return Number(r.rank_id) === reqPartnerRankId; });

        const reqPartnerRank = reqPartnerRankObj ? String(reqPartnerRankObj.rank_name).toUpperCase() : 'MANIA';
        const reqPartnerCountEach = Number(nextRank.required_partner_count ? nextRank.required_partner_count : 1);
        const isDirectSponsorReq = Number(nextRank.is_direct_sponsor ? nextRank.is_direct_sponsor : 0) === 1;

        const pType = String(nextRank.period_type ? nextRank.period_type : '').toUpperCase();
        const isTermRestricted = Boolean(pType === 'RECENT_4' ? true : (nextRankName === 'DIRECTOR' ? true : (nextRankName === 'EMERALD')));

        const subSets = typeof window.getSublinePartnerSets === 'function' ? window.getSublinePartnerSets(mNode) : { setA: new Set(), setB: new Set() };
        const setA = subSets.setA;
        const setB = subSets.setB;

        const directRecMap = typeof window.getDirectRecommendedPartnersMap === 'function' ? window.getDirectRecommendedPartnersMap(mNode) : new Map();
        const directRecNormSet = new Set(Array.from(directRecMap.keys()).map(function(k) { return normId(k); }));

        const cleanFn = typeof window.cleanDateStr === 'function' ? window.cleanDateStr : function(s) { return String(s ? s : '').trim().substring(0, 10); };
        const isVjMode = (window.currentCanvasMode === 'vj');

        let maxDate = '';
        if (typeof window.getHeaderPeriodRange === 'function') {
            const hRange = window.getHeaderPeriodRange();
            if (hRange && hRange.end) maxDate = hRange.end;
        }
        if (!maxDate) {
            (allSales ? allSales : []).forEach(function(s) {
                if (!s) return;
                const d = cleanFn(s.transaction_date ? s.transaction_date : (s.date ? s.date : ''));
                if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > maxDate) maxDate = d;
            });
        }
        if (!maxDate) maxDate = '2026-11-16';

        const anchorPInfo = typeof window.getPeriodInfoFromDate === 'function' ? window.getPeriodInfoFromDate(maxDate) : { sortOrderKey: '2026-11-2', periodLabel: '11-후', startDate: '2026-11-16', endDate: '2026-11-30' };
        const latestSortKey = anchorPInfo ? anchorPInfo.sortOrderKey : '2026-11-2';
        const latestPeriodLabel = anchorPInfo ? anchorPInfo.periodLabel : '11-후';
        const latestStartDate = anchorPInfo ? anchorPInfo.startDate : '2026-11-16';
        const latestEndDate = anchorPInfo ? anchorPInfo.endDate : '2026-11-30';

        let selfTotalPV = 0;
        let selfLastSalesDate = '';
        let selfTermCV = 0;
        let aTotalPV = 0;
        let bTotalPV = 0;

        const termSalesMapA = new Map();
        const termSalesMapB = new Map();

        (allSales ? allSales : []).forEach(function(s) {
            if (!s) return;
            const rawMid = String(s.member_id ? s.member_id : (s.memberId ? s.memberId : (s.id ? s.id : ''))).trim();
            if (!rawMid) return;
            const upperMid = rawMid.toUpperCase();
            if (isVjMode && upperMid.indexOf('VK-') === 0) return;
            if (!isVjMode && upperMid.indexOf('VJ-') === 0) return;

            const sNorm = normId(rawMid);
            if (!sNorm) return;

            const pv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.pv ? s.pv : s.sales_pv) : Number(s.pv ? s.pv : 0);
            const cv = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(s.cv ? s.cv : s.sales_cv) : Number(s.cv ? s.cv : 0);
            const sDate = cleanFn(s.transaction_date ? s.transaction_date : (s.date ? s.date : (s.sales_date ? s.sales_date : '')));

            if (sDate && sDate > latestEndDate) return;

            const isSelf = (sNorm === mNorm);
            const isA = !isSelf && setA.has(sNorm);
            const isB = !isSelf && setB.has(sNorm);

            if (isSelf) {
                selfTotalPV += pv;
                if (sDate && (!selfLastSalesDate ? true : (sDate > selfLastSalesDate))) selfLastSalesDate = sDate;
                if (sDate >= latestStartDate && sDate <= latestEndDate && cv > 0) selfTermCV += cv;
            }

            if (pv > 0 && (isA ? true : isB)) {
                if (isA) aTotalPV += pv;
                else if (isB) bTotalPV += pv;

                const pObj = typeof window.getPeriodInfoFromDate === 'function' ? window.getPeriodInfoFromDate(sDate) : null;
                if (pObj && pObj.sortOrderKey) {
                    if (isA) termSalesMapA.set(pObj.sortOrderKey, (termSalesMapA.get(pObj.sortOrderKey) ? termSalesMapA.get(pObj.sortOrderKey) : 0) + pv);
                    if (isB) termSalesMapB.set(pObj.sortOrderKey, (termSalesMapB.get(pObj.sortOrderKey) ? termSalesMapB.get(pObj.sortOrderKey) : 0) + pv);
                }
            }
        });

        const displaySelfPV = selfTotalPV > 0 ? selfTotalPV : Number(mNode.my_sales_pv ? mNode.my_sales_pv : (mNode.pv ? mNode.pv : 0));
        const rawFallbackDate = mNode.lastSales ? mNode.lastSales : (mNode.joinDate ? mNode.joinDate : '');
        const displayLastSalesDate = selfLastSalesDate ? selfLastSalesDate : (cleanFn(rawFallbackDate) ? cleanFn(rawFallbackDate) : '-');

        const recent4KeyObjs = window.getContinuousRecentNPeriodKeys(latestSortKey, 4);
        let sumLeft4PV = 0;
        let sumRight4PV = 0;
        const recentTerms = recent4KeyObjs.map(function(item) {
            const lPV = termSalesMapA.get(item.sortKey) ? termSalesMapA.get(item.sortKey) : 0;
            const rPV = termSalesMapB.get(item.sortKey) ? termSalesMapB.get(item.sortKey) : 0;
            sumLeft4PV += lPV;
            sumRight4PV += rPV;
            return { label: item.label, leftPV: lPV, rightPV: rPV };
        });

        const evalLeftPV = isTermRestricted ? sumLeft4PV : aTotalPV;
        const evalRightPV = isTermRestricted ? sumRight4PV : bTotalPV;
        const minorPV = Math.min(evalLeftPV, evalRightPV);
        const promoPct = reqMinorPV > 0 ? Math.floor((minorPV / reqMinorPV) * 100) : 0;

        const reqPartnerLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(reqPartnerRank) : 3;
        let dirCountA = 0;
        let dirCountB = 0;
        let firstNodeA = null;
        let firstNodeB = null;

        setA.forEach(function(norm) {
            const n = typeof window.findMemberNode === 'function' ? window.findMemberNode(norm) : null;
            if (!n) return;
            const nNorm = normId(n.id);
            const isDirect = Boolean(directRecNormSet.has(nNorm) ? true : (normId(n.recId ? n.recId : n.recommender_id) === mNorm));
            if (isDirectSponsorReq && !isDirect) return;

            if (!firstNodeA) firstNodeA = n;
            const nLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(n.rank ? n.rank : n.rank_name) : 0;
            if (nLevel >= reqPartnerLevel) {
                dirCountA++;
                if (!firstNodeA ? true : (nLevel > window.getDbRankLevel(firstNodeA.rank ? firstNodeA.rank : firstNodeA.rank_name))) {
                    firstNodeA = n;
                }
            }
        });

        setB.forEach(function(norm) {
            const n = typeof window.findMemberNode === 'function' ? window.findMemberNode(norm) : null;
            if (!n) return;
            const nNorm = normId(n.id);
            const isDirect = Boolean(directRecNormSet.has(nNorm) ? true : (normId(n.recId ? n.recId : n.recommender_id) === mNorm));
            if (isDirectSponsorReq && !isDirect) return;

            if (!firstNodeB) firstNodeB = n;
            const nLevel = typeof window.getDbRankLevel === 'function' ? window.getDbRankLevel(n.rank ? n.rank : n.rank_name) : 0;
            if (nLevel >= reqPartnerLevel) {
                dirCountB++;
                if (!firstNodeB ? true : (nLevel > window.getDbRankLevel(firstNodeB.rank ? firstNodeB.rank : firstNodeB.rank_name))) {
                    firstNodeB = n;
                }
            }
        });

        if (!firstNodeA && mNode.left) firstNodeA = typeof mNode.left === 'object' ? mNode.left : window.findMemberNode(mNode.left);
        if (!firstNodeB && mNode.right) firstNodeB = typeof mNode.right === 'object' ? mNode.right : window.findMemberNode(mNode.right);

        const isPartnerSatisfied = (dirCountA >= reqPartnerCountEach && dirCountB >= reqPartnerCountEach);
        const leftPartner = {
            id: firstNodeA && firstNodeA.id ? firstNodeA.id : '-',
            name: firstNodeA && firstNodeA.name ? firstNodeA.name : '-',
            rank: firstNodeA && firstNodeA.rank ? firstNodeA.rank : '-',
            count: dirCountA
        };
        const rightPartner = {
            id: firstNodeB && firstNodeB.id ? firstNodeB.id : '-',
            name: firstNodeB && firstNodeB.name ? firstNodeB.name : '-',
            rank: firstNodeB && firstNodeB.rank ? firstNodeB.rank : '-',
            count: dirCountB
        };

        const sponsorTypeLabel = isDirectSponsorReq ? '직접추천 파트너 조건' : '하위 육성 파트너 조건';
        const pvLackText = minorPV >= reqMinorPV
            ? '✓ 달성 완료'
            : '부족: -' + (reqMinorPV - minorPV).toLocaleString('ko-KR') + ' PV';
        const pvLackColor = minorPV >= reqMinorPV ? '#10b981' : '#ef4444';
        const partnerCondColor = isPartnerSatisfied ? '#10b981' : '#ef4444';
        const partnerCondText = isPartnerSatisfied
            ? '✓ 충족 완료 (좌:' + dirCountA + ' / 우:' + dirCountB + ')'
            : '현재 (좌:' + dirCountA + ' / 우:' + dirCountB + ')';

        const promoRequirementsCardHtml = [
            '<div style="background:#1f2937; border:1px solid #374151; border-radius:8px; padding:14px; margin-bottom:12px;">',
            '    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #374151;">',
            '        <div>',
            '            <div style="font-size:12px; font-weight:bold; color:#9ca3af; margin-bottom:3px;">기준기수 : ' + latestPeriodLabel + ' (' + latestStartDate + ' ~ ' + latestEndDate + ')</div>',
            '            <div style="font-size:15px; font-weight:bold; color:#ffffff;">승급 목표 : <span style="color:#10b981;">' + currRank + '</span> ➔ <span style="color:#60a5fa;">' + nextRankName + '</span></div>',
            '        </div>',
            '        <div style="text-align:right;">',
            '            <span style="background:#374151; color:#ffffff; font-size:12px; font-weight:bold; padding:4px 10px; border-radius:4px;">소실적 달성률: <b style="color:#fbbf24;">' + promoPct + '%</b></span>',
            '        </div>',
            '    </div>',
            '    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; text-align:center; font-size:12px;">',
            '        <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">',
            '            <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">① 소실적 목표 PV</div>',
            '            <div style="color:#ffffff; font-weight:bold; font-size:13px;">' + reqMinorPV.toLocaleString('ko-KR') + ' PV</div>',
            '            <div style="color:' + pvLackColor + '; font-size:11px; margin-top:4px; font-weight:bold;">' + pvLackText + '</div>',
            '        </div>',
            '        <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">',
            '            <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">② ' + sponsorTypeLabel + '</div>',
            '            <div style="color:#ffffff; font-weight:bold; font-size:12px;">좌/우 각 ' + reqPartnerRank + ' ' + reqPartnerCountEach + '명</div>',
            '            <div style="color:' + partnerCondColor + '; font-size:11px; margin-top:4px; font-weight:bold;">' + partnerCondText + '</div>',
            '        </div>',
            '        <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:10px;">',
            '            <div style="color:#9ca3af; font-size:11px; margin-bottom:4px;">③ 적용 기준 규정</div>',
            '            <div style="color:#fbbf24; font-weight:bold; font-size:12.5px;">' + (isTermRestricted ? '4기수 제한 적용' : '전체 누적 인정') + '</div>',
            '            <div style="color:#9ca3af; font-size:10.5px; margin-top:4px;">' + (isTermRestricted ? '연속 4개 기수 합산 (누적: 좌 ' + aTotalPV.toLocaleString('ko-KR') + ' / 우 ' + bTotalPV.toLocaleString('ko-KR') + ')' : '기간 제한 없음 (무한 누적)') + '</div>',
            '        </div>',
            '    </div>',
            '</div>'
        ].join('\n');

        let mainContentHtml = '';

        const isLeftMinor = evalLeftPV < evalRightPV;
        const isRightMinor = evalRightPV < evalLeftPV;
        const isEqualLeg = (evalLeftPV === evalRightPV && evalLeftPV > 0);

        const minorBadgeHtml = '<span style="display:inline-block; background:#dc2626; color:#ffffff; font-size:10.5px; font-weight:800; padding:2px 6px; border-radius:4px; margin-right:6px; border:1px solid #fca5a5; box-shadow:0 0 8px rgba(239,68,68,0.45); vertical-align:middle;">🎯 소실적</span>';
        const majorBadgeHtml = '<span style="display:inline-block; background:#1e3a8a; color:#93c5fd; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-right:6px; border:1px solid #3b82f6; vertical-align:middle;">대실적</span>';
        const equalBadgeHtml = '<span style="display:inline-block; background:#065f46; color:#6ee7b7; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-right:6px; border:1px solid #10b981; vertical-align:middle;">동률(매칭)</span>';

        const leftSumBadge = isLeftMinor ? minorBadgeHtml : (isRightMinor ? majorBadgeHtml : (isEqualLeg ? equalBadgeHtml : ''));
        const rightSumBadge = isRightMinor ? minorBadgeHtml : (isLeftMinor ? majorBadgeHtml : (isEqualLeg ? equalBadgeHtml : ''));

        const leftSumBg = isLeftMinor ? 'rgba(239, 68, 68, 0.16)' : '#111827';
        const rightSumBg = isRightMinor ? 'rgba(239, 68, 68, 0.16)' : '#111827';
        const leftSumColor = isLeftMinor ? '#fbbf24' : '#60a5fa';
        const rightSumColor = isRightMinor ? '#fbbf24' : '#10b981';

        const leftRowPvBg = isLeftMinor ? 'rgba(239, 68, 68, 0.08)' : 'transparent';
        const rightRowPvBg = isRightMinor ? 'rgba(239, 68, 68, 0.08)' : 'transparent';
        const leftRowPvColor = isLeftMinor ? '#fde68a' : '#ffffff';
        const rightRowPvColor = isRightMinor ? '#fde68a' : '#ffffff';

        if (isTermRestricted) {
            const termRowsHtml = recentTerms.map(function(t) {
                const leftPrefix = (isLeftMinor && t.leftPV > 0) ? '<span style="color:#f87171; font-size:10px; margin-right:4px;">▸</span>' : '';
                const rightPrefix = (isRightMinor && t.rightPV > 0) ? '<span style="color:#f87171; font-size:10px; margin-right:4px;">▸</span>' : '';

                return [
                    '<div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">',
                    '    <div style="width:135px; padding:8px 12px; background:#1f2937; color:' + (isLeftMinor ? '#fca5a5' : '#9ca3af') + '; font-weight:bold; border-right:1px solid #374151;">' + t.label + ' (좌)</div>',
                    '    <div style="flex:1; padding:8px 12px; background:' + leftRowPvBg + '; color:' + leftRowPvColor + '; text-align:right; font-weight:bold; border-right:1px solid #374151;">' + leftPrefix + t.leftPV.toLocaleString('ko-KR') + ' PV</div>',
                    '    <div style="width:135px; padding:8px 12px; background:#1f2937; color:' + (isRightMinor ? '#fca5a5' : '#9ca3af') + '; font-weight:bold; border-right:1px solid #374151;">' + t.label + ' (우)</div>',
                    '    <div style="flex:1; padding:8px 12px; background:' + rightRowPvBg + '; color:' + rightRowPvColor + '; text-align:right; font-weight:bold;">' + rightPrefix + t.rightPV.toLocaleString('ko-KR') + ' PV</div>',
                    '</div>'
                ].join('\n');
            }).join('\n');

            mainContentHtml = [
                '<div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">',
                '    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">본인내역</div>',
                '    <div style="display:flex; font-size:12px;">',
                '        <div style="width:135px; padding:10px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">본인누적매출</div>',
                '        <div style="flex:1; padding:10px 12px; color:#ffffff; font-weight:bold; text-align:right; border-right:1px solid #374151;">' + displaySelfPV.toLocaleString('ko-KR') + ' PV</div>',
                '        <div style="width:135px; padding:10px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">최근매출일자</div>',
                '        <div style="flex:1; padding:10px 12px; color:#ffffff; font-weight:bold; text-align:center;">' + displayLastSalesDate + '</div>',
                '    </div>',
                '</div>',
                '<div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937;">',
                '    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">하위내역 (최근 4기수 제한 실적 합산)</div>',
                '    <div style="display:flex; background:#111827; border-bottom:1px solid #374151; font-weight:bold; font-size:12px;">',
                '        <div style="width:135px; padding:10px 12px; color:' + leftSumColor + '; background:' + leftSumBg + '; border-right:1px solid #374151;">4기수 합계 (좌측)</div>',
                '        <div style="flex:1; padding:10px 12px; color:' + leftSumColor + '; background:' + leftSumBg + '; text-align:right; border-right:1px solid #374151;">' + leftSumBadge + sumLeft4PV.toLocaleString('ko-KR') + ' PV</div>',
                '        <div style="width:135px; padding:10px 12px; color:' + rightSumColor + '; background:' + rightSumBg + '; border-right:1px solid #374151;">4기수 합계 (우측)</div>',
                '        <div style="flex:1; padding:10px 12px; color:' + rightSumColor + '; background:' + rightSumBg + '; text-align:right;">' + rightSumBadge + sumRight4PV.toLocaleString('ko-KR') + ' PV</div>',
                '    </div>',
                '    <div style="display:flex; border-bottom:1px solid #374151; font-size:12px;">',
                '        <div style="width:135px; padding:8px 12px; background:#111827; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">직추천(후원라인 좌)</div>',
                '        <div style="flex:1; padding:8px 12px; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">' + leftPartner.name + ' (' + leftPartner.id + ')</div>',
                '        <div style="width:135px; padding:8px 12px; background:#111827; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">직추천(후원라인 우)</div>',
                '        <div style="flex:1; padding:8px 12px; color:#ffffff; font-weight:bold;">' + rightPartner.name + ' (' + rightPartner.id + ')</div>',
                '    </div>',
                termRowsHtml,
                '</div>'
            ].join('\n');
        } else {
            const remainLeftPV = Math.max(0, reqMinorPV - aTotalPV);
            const remainRightPV = Math.max(0, reqMinorPV - bTotalPV);
            mainContentHtml = [
                '<div style="border:1px solid #374151; border-radius:8px; overflow:hidden; margin-bottom:12px; background:#1f2937; font-size:12px;">',
                '    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">전체누적 PV (무한 누적 기준)</div>',
                '    <div style="display:flex; align-items:center; text-align:center; border-bottom:1px solid #374151;">',
                '        <div style="width:80px; padding:10px; background:#111827; color:' + leftSumColor + '; font-weight:bold; border-right:1px solid #374151;">좌(A)</div>',
                '        <div style="flex:1; padding:10px; background:' + leftSumBg + '; color:' + leftSumColor + '; font-weight:bold; font-size:13px; border-right:1px solid #374151;">' + leftSumBadge + aTotalPV.toLocaleString('ko-KR') + ' PV</div>',
                '        <div style="width:80px; padding:10px; background:#111827; color:' + rightSumColor + '; font-weight:bold; border-right:1px solid #374151;">우(B)</div>',
                '        <div style="flex:1; padding:10px; background:' + rightSumBg + '; color:' + rightSumColor + '; font-weight:bold; font-size:13px;">' + rightSumBadge + bTotalPV.toLocaleString('ko-KR') + ' PV</div>',
                '    </div>',
                '    <div style="background:#111827; padding:8px; text-align:center; font-weight:bold; color:#ffffff; border-bottom:1px solid #374151;">' + nextRankName + ' 승급까지 부족 PV</div>',
                '    <div style="display:flex; align-items:center; text-align:center;">',
                '        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">좌(A)</div>',
                '        <div style="flex:1; padding:10px; background:' + leftRowPvBg + '; color:' + (remainLeftPV === 0 ? '#10b981' : '#ef4444') + '; font-weight:bold; font-size:13px; border-right:1px solid #374151;">' + (remainLeftPV === 0 ? '충족 완료' : '-' + remainLeftPV.toLocaleString('ko-KR') + ' PV') + '</div>',
                '        <div style="width:80px; padding:10px; background:#111827; color:#ffffff; font-weight:bold; border-right:1px solid #374151;">우(B)</div>',
                '        <div style="flex:1; padding:10px; background:' + rightRowPvBg + '; color:' + (remainRightPV === 0 ? '#10b981' : '#ef4444') + '; font-weight:bold; font-size:13px;">' + (remainRightPV === 0 ? '충족 완료' : '-' + remainRightPV.toLocaleString('ko-KR') + ' PV') + '</div>',
                '    </div>',
                '</div>'
            ].join('\n');
        }

        const reqMaintCV = window.getDbRequiredMaintCV(currRank);
        let minorSubTermCV = 0;
        if (Array.isArray(window.perfData) && window.perfData.length > 0) {
            minorSubTermCV = Number(window.perfData[0].matchedCV ? window.perfData[0].matchedCV : 0);
        } else if (window.lastAllMembersTeamBonusMap instanceof Map && window.lastAllMembersTeamBonusMap.has(mNorm)) {
            const pMap = window.lastAllMembersTeamBonusMap.get(mNorm);
            if (pMap[latestSortKey]) minorSubTermCV = Number(pMap[latestSortKey].matchedCV ? pMap[latestSortKey].matchedCV : 0);
        }

        const totalRecognizedMaintCV = minorSubTermCV + selfTermCV;
        const maintPct = reqMaintCV > 0 ? Math.min(100, Math.floor((totalRecognizedMaintCV / reqMaintCV) * 100)) : 0;
        const maintDiffCV = Math.max(0, reqMaintCV - totalRecognizedMaintCV);

        const maintEval = window.evaluateMaintAchievedRank(currRank, totalRecognizedMaintCV);
        const maintStatusText = maintEval.isAchieved
            ? '달성직급: ' + maintEval.achievedRank + ' (달성)'
            : '달성직급: 없음 (미달성)';
        const maintStatusColor = maintEval.isAchieved ? '#10b981' : '#ef4444';

        const maintHtml = [
            '<div style="border:1px solid #374151; border-radius:8px; overflow:hidden; background:#1f2937; padding:14px;">',
            '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #374151;">',
            '        <span style="font-size:13px; font-weight:bold; color:#ffffff;">[' + currRank + '] 품위유지 등급 달성 현황 (기준기수: ' + latestPeriodLabel + ')</span>',
            '        <div style="display:flex; align-items:center; gap:8px;">',
            '            <span style="font-size:11.5px; font-weight:bold; color:' + maintStatusColor + ';">' + maintStatusText + '</span>',
            '            <span style="background:#374151; color:#ffffff; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:4px;">달성률: ' + maintPct + '%</span>',
            '        </div>',
            '    </div>',
            '    <div style="border:1px solid #374151; border-radius:6px; overflow:hidden; margin-bottom:10px; background:#111827;">',
            '        <div style="background:#111827; padding:6px 8px; text-align:center; font-weight:bold; font-size:11.5px; color:#ffffff; border-bottom:1px solid #374151;">본인 당기 매출 내역</div>',
            '        <div style="display:flex; font-size:12px;">',
            '            <div style="width:135px; padding:9px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">당기 본인 CV</div>',
            '            <div style="flex:1; padding:9px 12px; color:#ffffff; font-weight:bold; text-align:right; border-right:1px solid #374151;">' + selfTermCV.toLocaleString('ko-KR') + ' CV</div>',
            '            <div style="width:135px; padding:9px 12px; background:#1f2937; color:#9ca3af; font-weight:bold; border-right:1px solid #374151;">최근 매출일자</div>',
            '            <div style="flex:1; padding:9px 12px; color:#ffffff; font-weight:bold; text-align:center;">' + displayLastSalesDate + '</div>',
            '        </div>',
            '    </div>',
            '    <div style="display:grid; grid-template-columns: 1fr 1.6fr 1fr; gap:10px; text-align:center; font-size:12px; background:#111827; padding:12px; border-radius:6px; border:1px solid #374151;">',
            '        <div style="display:flex; flex-direction:column; justify-content:center;">',
            '            <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">[' + currRank + '] 유지 기준 CV</div>',
            '            <div style="color:#ffffff; font-weight:bold; font-size:13px;">' + reqMaintCV.toLocaleString('ko-KR') + ' CV</div>',
            '        </div>',
            '        <div style="border-left:1px solid #374151; border-right:1px solid #374151; padding:0 8px; display:flex; flex-direction:column; justify-content:center;">',
            '            <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">해당기수 인정 소실적 CV</div>',
            '            <div style="color:#60a5fa; font-weight:bold; font-size:13px; margin-bottom:2px;">' + totalRecognizedMaintCV.toLocaleString('ko-KR') + ' CV</div>',
            '            <div style="color:#9ca3af; font-size:10.5px;">(하위공제: <b style="color:#fff;">' + minorSubTermCV.toLocaleString('ko-KR') + '</b> + 본인: <b style="color:#fff;">' + selfTermCV.toLocaleString('ko-KR') + '</b>)</div>',
            '        </div>',
            '        <div style="display:flex; flex-direction:column; justify-content:center;">',
            '            <div style="color:#9ca3af; margin-bottom:4px; font-size:11px; font-weight:bold;">품위유지 부족분 CV</div>',
            '            <div style="color:' + (maintDiffCV === 0 && reqMaintCV > 0 ? '#10b981' : '#ef4444') + '; font-weight:bold; font-size:13px;">' + (reqMaintCV === 0 ? '해당 없음' : (maintDiffCV === 0 ? '✓ 유지 달성' : '-' + maintDiffCV.toLocaleString('ko-KR') + ' CV')) + '</div>',
            '        </div>',
            '    </div>',
            '</div>'
        ].join('\n');

        bodyEl.innerHTML = promoRequirementsCardHtml + mainContentHtml + maintHtml;
    };

    // 8. renderTree가 카드를 그리기 직전에 미리 캐시된 직급 및 본인/산하 실적 계산 결과를 노드에 주입
    const origRenderTree = window.renderTree;
    if (typeof origRenderTree === 'function' && !origRenderTree._preRankSyncWrappedV35) {
        const wrappedRenderTree = function() {
            window.applyCachedRanksToTreeMemory();
            const allSales = window.allSalesData ? window.allSalesData : (window.integrated_sales_history ? window.integrated_sales_history : []);
            if (Array.isArray(allSales) && allSales.length > 0 && typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
                window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData);
            }
            const r = origRenderTree.apply(this, arguments);
            if (Array.isArray(allSales) && allSales.length > 0 && typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
                window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData);
            }
            return r;
        };
        wrappedRenderTree._preRankSyncWrappedV35 = true;
        window.renderTree = wrappedRenderTree;
    }

    // 9. 카드 클릭 시 내비게이터 창이 열려 있다면 선택된 회원으로 즉시 자동 갱신
    const origExecClick = window.executeNodeSingleClick;
    if (typeof origExecClick === 'function' && !origExecClick._navSyncWrappedV35) {
        const wrappedClick = async function(id) {
            const r = await origExecClick.apply(this, arguments);
            if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed) {
                window.renderBusinessNavigator(id, window.bizNavPopupWindow.document);
            }
            return r;
        };
        wrappedClick._navSyncWrappedV35 = true;
        window.executeNodeSingleClick = wrappedClick;
    }

    window.applyCachedRanksToTreeMemory();
    setTimeout(function() {
        const allSales = window.allSalesData ? window.allSalesData : (window.integrated_sales_history ? window.integrated_sales_history : []);
        if (typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
            window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData);
        }
        if (typeof window.calculateLocalPerformance === 'function') {
            window.calculateLocalPerformance(window.currentSelectedId);
        }
        if (typeof window.renderTreeCardStatusBadges === 'function') {
            window.renderTreeCardStatusBadges();
        }
    }, 120);
})();
// ============================================================================
// [36] 📐 내비게이터 & 매출기간검색 인페이지(In-Page) 모달 전환 + 콘텐츠 딱 맞춤(Auto-fit) + 크기/위치 영구 유지
//      - 외부 브라우저 팝업(about:blank) 대신 화면 내부 모달창으로 통합 렌더링
//      - 내부 콘텐츠 높이에 딱 맞게 자동 조절되며, 사용자가 조절한 창 크기와 위치를 localStorage에 영구 보존
//      - 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호 완전 배제
// ============================================================================
(function initAutoFitResizableInPageModalsV36() {
    const STORAGE_PREFIX = 'BS_MODAL_SIZE_POS_V36_';
    let topZIndex = 2147483600;

    function injectModalStylesV36() {
        if (document.getElementById('bs-autofit-modal-css-v36')) return;
        const st = document.createElement('style');
        st.id = 'bs-autofit-modal-css-v36';
        st.textContent = [
            '.bs-modal-wrap-v36 {',
            '    position: fixed !important;',
            '    background: #111827 !important;',
            '    border: 1.5px solid #475569 !important;',
            '    border-radius: 10px !important;',
            '    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255,255,255,0.06) !important;',
            '    display: flex !important;',
            '    flex-direction: column !important;',
            '    overflow: hidden !important;',
            '    min-width: 420px !important;',
            '    min-height: 220px !important;',
            '    max-width: 98vw !important;',
            '    max-height: 95vh !important;',
            '    box-sizing: border-box !important;',
            '}',
            '.bs-modal-header-v36 {',
            '    height: 38px !important;',
            '    min-height: 38px !important;',
            '    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;',
            '    border-bottom: 1px solid #334155 !important;',
            '    display: flex !important;',
            '    align-items: center !important;',
            '    justify-content: space-between !important;',
            '    padding: 0 12px !important;',
            '    cursor: move !important;',
            '    user-select: none !important;',
            '    flex-shrink: 0 !important;',
            '}',
            '.bs-modal-title-box-v36 {',
            '    display: flex !important;',
            '    align-items: center !important;',
            '    gap: 8px !important;',
            '    color: #f8fafc !important;',
            '    font-size: 13px !important;',
            '    font-weight: 800 !important;',
            '    overflow: hidden !important;',
            '    white-space: nowrap !important;',
            '    text-overflow: ellipsis !important;',
            '}',
            '.bs-modal-ctrl-box-v36 {',
            '    display: flex !important;',
            '    align-items: center !important;',
            '    gap: 6px !important;',
            '    flex-shrink: 0 !important;',
            '}',
            '.bs-modal-size-badge-v36 {',
            '    font-size: 10.5px !important;',
            '    color: #94a3b8 !important;',
            '    background: #0f172a !important;',
            '    border: 1px solid #334155 !important;',
            '    padding: 2px 6px !important;',
            '    border-radius: 4px !important;',
            '    font-family: monospace !important;',
            '}',
            '.bs-modal-btn-v36 {',
            '    background: #1e293b !important;',
            '    border: 1px solid #475569 !important;',
            '    color: #e2e8f0 !important;',
            '    border-radius: 5px !important;',
            '    padding: 3px 8px !important;',
            '    font-size: 11px !important;',
            '    font-weight: 700 !important;',
            '    cursor: pointer !important;',
            '    line-height: 1.2 !important;',
            '}',
            '.bs-modal-btn-v36:hover {',
            '    background: #334155 !important;',
            '    color: #ffffff !important;',
            '}',
            '.bs-modal-btn-close-v36 {',
            '    background: rgba(239, 68, 68, 0.2) !important;',
            '    border: 1px solid rgba(239, 68, 68, 0.5) !important;',
            '    color: #fca5a5 !important;',
            '}',
            '.bs-modal-btn-close-v36:hover {',
            '    background: #ef4444 !important;',
            '    color: #ffffff !important;',
            '}',
            '.bs-modal-iframe-v36 {',
            '    flex: 1 !important;',
            '    width: 100% !important;',
            '    height: 100% !important;',
            '    border: none !important;',
            '    background: #111827 !important;',
            '    display: block !important;',
            '}',
            '.bs-modal-resize-e-v36 { position: absolute !important; top: 38px; right: 0; width: 7px; bottom: 14px; cursor: ew-resize !important; z-index: 20 !important; }',
            '.bs-modal-resize-s-v36 { position: absolute !important; left: 0; right: 14px; bottom: 0; height: 7px; cursor: ns-resize !important; z-index: 20 !important; }',
            '.bs-modal-resize-se-v36 {',
            '    position: absolute !important;',
            '    right: 0; bottom: 0;',
            '    width: 16px; height: 16px;',
            '    cursor: nwse-resize !important;',
            '    z-index: 25 !important;',
            '    background: linear-gradient(135deg, transparent 50%, #60a5fa 50%) !important;',
            '    border-bottom-right-radius: 8px !important;',
            '}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function getDefaultModalConfig(typeKey) {
        if (typeKey === 'BIZNAVIGATORPOPUP') {
            return { width: 690, height: 615, title: '🧭 비지네스 내비게이터 (승급 & 품위유지 가이드)' };
        }
        if (typeKey === 'SALESSEARCHPOPUP') {
            return { width: 850, height: 540, title: '🔍 매출 기간 검색' };
        }
        if (typeKey === 'COMP_PLAN_HELP') {
            return { width: 1060, height: 680, title: '📋 Compensation Plan (보상플랜 요약표)' };
        }
        return { width: 720, height: 580, title: '비지네스 모달' };
    }

    function loadSavedModalState(typeKey) {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + typeKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.width >= 400 && parsed.height >= 200) {
                return parsed;
            }
        } catch (e) {}
        return null;
    }

    function saveModalState(typeKey, wrapEl, isUserResized) {
        if (!wrapEl) return;
        const rect = wrapEl.getBoundingClientRect();
        if (rect.width < 400) return;
        if (rect.height < 200) return;

        const prev = loadSavedModalState(typeKey);
        const stateObj = {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            userResized: Boolean(isUserResized ? true : (prev && prev.userResized))
        };
        try {
            localStorage.setItem(STORAGE_PREFIX + typeKey, JSON.stringify(stateObj));
        } catch (e) {}

        if (typeKey === 'BIZNAVIGATORPOPUP') {
            localStorage.setItem('bs_biz_nav_popup_w', String(stateObj.width));
            localStorage.setItem('bs_biz_nav_popup_h', String(stateObj.height));
        } else if (typeKey === 'SALESSEARCHPOPUP') {
            localStorage.setItem('bs_sales_search_popup_w', String(stateObj.width));
            localStorage.setItem('bs_sales_search_popup_h', String(stateObj.height));
        }
    }

    // 🌟 핵심: 모달 내부 콘텐츠(표/카드) 높이와 너비를 정밀 측정하여 여백 없이 딱 맞게 조절하는 함수
    function fitModalToInnerContent(wrapEl, iframeEl, typeKey, forceFit) {
        if (!wrapEl) return;
        if (!iframeEl) return;

        const saved = loadSavedModalState(typeKey);
        // 사용자가 직접 크기를 조절해 저장한 적이 있고 강제 맞춤(forceFit)이 아니면 사용자의 크기 유지!
        if (!forceFit && saved && saved.userResized) {
            return;
        }

        try {
            const iDoc = iframeEl.contentDocument ? iframeEl.contentDocument : (iframeEl.contentWindow ? iframeEl.contentWindow.document : null);
            if (!iDoc) return;
            if (!iDoc.body) return;

            // 내부 중복 헤더(.popup-header) 숨김 및 여백 최적화
            let fixStyle = iDoc.getElementById('bs-inner-autofit-style-v36');
            if (!fixStyle) {
                fixStyle = iDoc.createElement('style');
                fixStyle.id = 'bs-inner-autofit-style-v36';
                fixStyle.textContent = [
                    '.popup-header { display: none !important; }',
                    'body { margin: 0 !important; overflow-x: hidden !important; }',
                    '#bizNavBody { padding: 12px 14px !important; }',
                    '.table-wrap { max-height: calc(100vh - 96px) !important; }'
                ].join('\n');
                if (iDoc.head) iDoc.head.appendChild(fixStyle);
            }

            // 모달 상단 타이틀 텍스트에 대상 회원명 배지(#bizNavTargetBadge) 동기화
            const targetBadge = iDoc.getElementById('bizNavTargetBadge');
            const titleSpan = wrapEl.querySelector('.bs-modal-title-text-v36');
            if (titleSpan && typeKey === 'BIZNAVIGATORPOPUP') {
                const badgeTxt = targetBadge && targetBadge.innerText ? ' ' + targetBadge.innerText : '';
                titleSpan.textContent = '🧭 비지네스 내비게이터 ' + badgeTxt;
            }

            const vw = window.innerWidth ? window.innerWidth : 1400;
            const vh = window.innerHeight ? window.innerHeight : 900;
            const headerBarH = 38;

            let idealW = wrapEl.getBoundingClientRect().width;
            let idealH = wrapEl.getBoundingClientRect().height;

            if (typeKey === 'BIZNAVIGATORPOPUP') {
                const navBody = iDoc.getElementById('bizNavBody');
                if (navBody && navBody.children.length > 0) {
                    const contentH = navBody.scrollHeight;
                    idealW = forceFit ? 690 : Math.max(660, Math.min(760, idealW));
                    idealH = Math.min(vh - 36, Math.max(320, contentH + headerBarH + 6));
                }
            } else if (typeKey === 'SALESSEARCHPOPUP') {
                const filterBar = iDoc.querySelector('.filter-bar');
                const summaryBar = iDoc.querySelector('.summary-bar');
                const tableEl = iDoc.querySelector('table');

                const fH = filterBar ? filterBar.offsetHeight : 46;
                const sH = summaryBar ? summaryBar.offsetHeight : 34;
                const tH = tableEl ? tableEl.offsetHeight : 220;

                const rawNeededH = fH + sH + tH + headerBarH + 10;
                idealW = forceFit ? 850 : Math.max(720, Math.min(980, idealW));
                // 행이 적을 때는 표 길이에 딱 맞추고, 행이 많을 때는 최대 640px(또는 화면 82%)에서 깔끔하게 스크롤
                idealH = Math.min(Math.round(vh * 0.82), Math.max(300, Math.min(640, rawNeededH)));
            } else if (typeKey === 'COMP_PLAN_HELP') {
                const cpTable = iDoc.querySelector('table.cp-table, table');
                const cpHeader = iDoc.querySelector('.cp-header');
                if (cpTable) {
                    const neededW = cpTable.scrollWidth + 60;
                    const neededH = (cpHeader ? cpHeader.offsetHeight : 60) + cpTable.offsetHeight + headerBarH + 65;
                    idealW = Math.min(vw - 40, Math.max(820, neededW));
                    idealH = Math.min(vh - 40, Math.max(480, neededH));
                }
            }

            wrapEl.style.width = Math.round(idealW) + 'px';
            wrapEl.style.height = Math.round(idealH) + 'px';

            // 화면 밖으로 삐져나가지 않도록 위치 보정
            const rect = wrapEl.getBoundingClientRect();
            if (rect.right > vw - 10) {
                wrapEl.style.left = Math.max(10, vw - Math.round(idealW) - 16) + 'px';
            }
            if (rect.bottom > vh - 10) {
                wrapEl.style.top = Math.max(10, vh - Math.round(idealH) - 16) + 'px';
            }

            const sizeBadge = wrapEl.querySelector('.bs-modal-size-badge-v36');
            if (sizeBadge) {
                sizeBadge.textContent = Math.round(idealW) + ' × ' + Math.round(idealH);
            }
        } catch (e) {}
    }

    if (!window._bsNativeOpenV36) {
        window._bsNativeOpenV36 = window.open.bind(window);
    }

    // 모든 내비게이터 / 매출기간검색 / 보상플랜 팝업 요청을 인페이지 모달창으로 변환
    window.open = function(url, name, specs) {
        const strUrl = String(url ? url : '').trim();
        if (strUrl && strUrl !== 'about:blank' && /^https?:\/\//i.test(strUrl) && !strUrl.includes(window.location.host)) {
            return window._bsNativeOpenV36(url, name, specs);
        }

        injectModalStylesV36();

        const typeKey = String(name ? name : 'MODAL').trim().toUpperCase();
        const modalId = 'bs-inpage-modal-' + typeKey;
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const defCfg = getDefaultModalConfig(typeKey);
        const saved = loadSavedModalState(typeKey);

        const vw = window.innerWidth ? window.innerWidth : 1400;
        const vh = window.innerHeight ? window.innerHeight : 900;

        let initW = saved ? Math.min(saved.width, vw - 24) : Math.min(defCfg.width, vw - 30);
        let initH = saved ? Math.min(saved.height, vh - 24) : Math.min(defCfg.height, vh - 30);
        let initLeft = saved && typeof saved.left === 'number'
            ? Math.min(Math.max(10, saved.left), Math.max(10, vw - initW - 10))
            : Math.max(20, Math.round((vw - initW) / 2));
        let initTop = saved && typeof saved.top === 'number'
            ? Math.min(Math.max(48, saved.top), Math.max(48, vh - initH - 10))
            : Math.max(54, Math.round((vh - initH) / 2));

        const wrap = document.createElement('div');
        wrap.id = modalId;
        wrap.className = 'bs-modal-wrap-v36 bs-inpage-modal-wrap-v29';
        wrap.style.width = initW + 'px';
        wrap.style.height = initH + 'px';
        wrap.style.left = initLeft + 'px';
        wrap.style.top = initTop + 'px';
        wrap.style.zIndex = String(++topZIndex);

        wrap.innerHTML = [
            '<div class="bs-modal-header-v36">',
            '    <div class="bs-modal-title-box-v36">',
            '        <span class="bs-modal-title-text-v36">' + defCfg.title + '</span>',
            '    </div>',
            '    <div class="bs-modal-ctrl-box-v36">',
            '        <span class="bs-modal-size-badge-v36" title="현재 모달창 크기 (가로 × 세로)">' + initW + ' × ' + initH + '</span>',
            '        <button type="button" class="bs-modal-btn-v36 bs-btn-autofit-v36" title="내부 콘텐츠 크기에 딱 맞게 창 크기를 자동 조절합니다">내용 맞춤</button>',
            '        <button type="button" class="bs-modal-btn-v36 bs-modal-btn-close-v36" title="모달 닫기 (ESC)">닫기 ✕</button>',
            '    </div>',
            '</div>',
            '<iframe class="bs-modal-iframe-v36" src="about:blank"></iframe>',
            '<div class="bs-modal-resize-e-v36" title="가로 크기 조절"></div>',
            '<div class="bs-modal-resize-s-v36" title="세로 크기 조절"></div>',
            '<div class="bs-modal-resize-se-v36" title="드래그하여 창 크기 조절 (자동 저장)"></div>'
        ].join('');

        document.body.appendChild(wrap);

        wrap.addEventListener('mousedown', function() {
            wrap.style.zIndex = String(++topZIndex);
        });

        const headerEl = wrap.querySelector('.bs-modal-header-v36');
        const titleTextEl = wrap.querySelector('.bs-modal-title-text-v36');
        const sizeBadgeEl = wrap.querySelector('.bs-modal-size-badge-v36');
        const btnAutoFit = wrap.querySelector('.bs-btn-autofit-v36');
        const btnClose = wrap.querySelector('.bs-modal-btn-close-v36');
        const iframeEl = wrap.querySelector('.bs-modal-iframe-v36');

        let isClosed = false;
        const closeModal = function() {
            if (isClosed) return;
            saveModalState(typeKey, wrap, false);
            isClosed = true;
            wrap.remove();
            if (typeKey === 'BIZNAVIGATORPOPUP') window.bizNavPopupWindow = null;
            if (typeKey === 'SALESSEARCHPOPUP') window.salesSearchPopupWindow = null;
        };

        btnClose.onclick = function(e) {
            e.stopPropagation();
            closeModal();
        };

        // [내용 맞춤] 버튼 클릭 시: 수동 크기 잠금을 해제하고 콘텐츠에 딱 맞게 즉시 리사이즈 후 저장!
        btnAutoFit.onclick = function(e) {
            e.stopPropagation();
            try { localStorage.removeItem(STORAGE_PREFIX + typeKey); } catch (err) {}
            fitModalToInnerContent(wrap, iframeEl, typeKey, true);
            saveModalState(typeKey, wrap, false);
        };

        // 상단 헤더 더블클릭 시에도 내용 맞춤 실행
        headerEl.addEventListener('dblclick', function() {
            btnAutoFit.click();
        });

        // 1. 상단 바 드래그 이동 (위치 자동 저장)
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            e.preventDefault();
            wrap.style.zIndex = String(++topZIndex);
            iframeEl.style.pointerEvents = 'none';

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = wrap.getBoundingClientRect();

            const onMove = function(ev) {
                const nx = Math.max(0, Math.min(window.innerWidth - 80, rect.left + ev.clientX - startX));
                const ny = Math.max(0, Math.min(window.innerHeight - 40, rect.top + ev.clientY - startY));
                wrap.style.left = Math.round(nx) + 'px';
                wrap.style.top = Math.round(ny) + 'px';
            };
            const onUp = function() {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                iframeEl.style.pointerEvents = 'auto';
                saveModalState(typeKey, wrap, false);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        // 2. 우측 / 하단 / 우하단 모서리 드래그 크기 조절 (조절한 크기 영구 유지!)
        function bindResizeHandle(handleSelector, allowW, allowH) {
            const handleEl = wrap.querySelector(handleSelector);
            if (!handleEl) return;

            handleEl.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                wrap.style.zIndex = String(++topZIndex);
                iframeEl.style.pointerEvents = 'none';

                const startX = e.clientX;
                const startY = e.clientY;
                const rect = wrap.getBoundingClientRect();

                const onMove = function(ev) {
                    const nw = allowW ? Math.max(420, Math.min(window.innerWidth - rect.left - 8, rect.width + ev.clientX - startX)) : rect.width;
                    const nh = allowH ? Math.max(220, Math.min(window.innerHeight - rect.top - 8, rect.height + ev.clientY - startY)) : rect.height;
                    if (allowW) wrap.style.width = Math.round(nw) + 'px';
                    if (allowH) wrap.style.height = Math.round(nh) + 'px';
                    sizeBadgeEl.textContent = Math.round(nw) + ' × ' + Math.round(nh);
                };
                const onUp = function() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    iframeEl.style.pointerEvents = 'auto';
                    // 사용자가 직접 조절했으므로 userResized = true 로 영구 저장!
                    saveModalState(typeKey, wrap, true);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        }

        bindResizeHandle('.bs-modal-resize-e-v36', true, false);
        bindResizeHandle('.bs-modal-resize-s-v36', false, true);
        bindResizeHandle('.bs-modal-resize-se-v36', true, true);

        const win = iframeEl.contentWindow;
        if (win) {
            win.close = closeModal;
            win.focus = function() {
                wrap.style.zIndex = String(++topZIndex);
            };
            try {
                Object.defineProperty(win, 'closed', {
                    get: function() { return isClosed; },
                    configurable: true
                });
            } catch (e) {}

            // 내부 문서가 렌더링되거나 회원이 바뀔 때마다 자동 맞춤 점검 (수동 리사이즈 안 했을 시 콘텐츠에 딱 맞춤)
            const triggerAutoFitChecks = function() {
                [60, 180, 380].forEach(function(delay) {
                    setTimeout(function() {
                        if (isClosed) return;
                        if (win.document && win.document.title && typeKey !== 'BIZNAVIGATORPOPUP') {
                            titleTextEl.textContent = win.document.title;
                        }
                        fitModalToInnerContent(wrap, iframeEl, typeKey, false);
                    }, delay);
                });
            };

            triggerAutoFitChecks();
    // 🌟 [깜빡임 원천 차단] 계보도(renderTree)가 화면에 카드를 그리기 직전에
    // 미리 4기수 제한 직급 계산을 먼저 수행하여 처음부터 DIRECTOR로 렌더링되도록 처리!
    const origRenderTree = window.renderTree;
    if (typeof origRenderTree === 'function' && !origRenderTree._preRankSyncWrappedV35) {
        const wrappedRenderTree = function() {
            const allSales = window.allSalesData ? window.allSalesData : (window.integrated_sales_history ? window.integrated_sales_history : []);
            if (Array.isArray(allSales) && allSales.length > 0 && typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
                window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(allSales, window.flatMembersData);
            }
            return origRenderTree.apply(this, arguments);
        };
        wrappedRenderTree._preRankSyncWrappedV35 = true;
        window.renderTree = wrappedRenderTree;
    }
            setTimeout(function() {
                try {
                    if (!isClosed && win.document && win.document.body && typeof MutationObserver !== 'undefined') {
                        const obs = new MutationObserver(function() {
                            fitModalToInnerContent(wrap, iframeEl, typeKey, false);
                        });
                        obs.observe(win.document.body, { childList: true, subtree: true });
                    }
                } catch (e) {}
            }, 150);
        }

        return win;
    };
})();
// ============================================================================
// [37] 📝 매출 기간 검색 모달창 내부 매출/구독 등록(Create) · 편집(Update) · 삭제(Delete) 및 TiDB 실시간 연동
//      - 조회 전용이던 매출 기간 검색창을 인라인 CRUD 에디터로 업그레이드
//      - 등록/수정/삭제 즉시 백엔드(/api/sales) 저장 및 계보도·실적집계·내비게이터 실시간 반영
//      - 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호 완전 배제
// ============================================================================
(function initSalesSearchModalFullCRUDV37() {
    function normId(val) {
        if (!val) return '';
        let s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        return String(s).trim().toLowerCase().replace(/^v[kj]-?0*/, '');
    }

    function parseNum(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        const cleaned = String(val ? val : '').replace(/[^0-9.-]/g, '');
        const num = Number(cleaned);
        return isNaN(num) ? 0 : num;
    }

    function formatComma(val) {
        return parseNum(val).toLocaleString('ko-KR');
    }

    function cleanDate(val) {
        if (!val) return '';
        const s = String(val).trim().replace(/\//g, '-');
        if (/^\d{4}$/.test(s)) {
            const mm = s.substring(0, 2);
            const dd = s.substring(2, 4);
            return '2026-' + mm + '-' + dd;
        }
        return s.substring(0, 10);
    }

    function getMasterSalesArray() {
        if (!Array.isArray(window.allSalesData)) {
            window.allSalesData = Array.isArray(window.integrated_sales_history) ? window.integrated_sales_history : [];
        }
        window.integrated_sales_history = window.allSalesData;
        return window.allSalesData;
    }

    // 모든 매출 레코드에 고유 추적 ID(_crudUid) 부여
    function ensureSalesCrudUids() {
        const list = getMasterSalesArray();
        list.forEach(function(s, idx) {
            if (!s) return;
            if (!s._crudUid) {
                s._crudUid = 'sale_uid_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 7);
            }
        });
        return list;
    }

    // 회원번호 또는 이름으로 정확한 회원 노드 찾기
    window.resolveMemberForSalesCrud = function(rawInput) {
        const q = String(rawInput ? rawInput : '').trim();
        if (!q) return null;
        if (typeof window.findMemberNode === 'function') {
            const direct = window.findMemberNode(q);
            if (direct) return direct;
        }
        const pool = typeof window.getUniqueMembers === 'function' ? window.getUniqueMembers() : [];
        const qLower = q.toLowerCase();
        const qNorm = normId(q);

        for (let i = 0; i < pool.length; i++) {
            const m = pool[i];
            const mId = String(m.id ? m.id : (m.member_id ? m.member_id : '')).trim();
            const mName = String(m.name ? m.name : '').trim();
            if (mId.toLowerCase() === qLower) return m;
            if (normId(mId) === qNorm && qNorm !== '') return m;
            if (mName.toLowerCase() === qLower) return m;
        }
        return null;
    };

    // 특정 회원의 전체 매출 내역을 TiDB 백엔드(/api/sales)에 동기화하고 메인 화면 전체 갱신
    window.syncMemberSalesToBackendV37 = async function(memberId) {
        const mNode = window.resolveMemberForSalesCrud(memberId);
        const canonicalId = mNode && mNode.id ? mNode.id : String(memberId ? memberId : '').trim().toUpperCase();
        if (!canonicalId) return false;

        const targetNorm = normId(canonicalId);
        const masterList = ensureSalesCrudUids();

        const memberRecords = [];
        masterList.forEach(function(s) {
            if (!s) return;
            const sNorm = normId(s.member_id ? s.member_id : (s.memberId ? s.memberId : s.id));
            if (sNorm === targetNorm) {
                const dStr = cleanDate(s.transaction_date ? s.transaction_date : (s.sales_date ? s.sales_date : s.date));
                const sType = String(s.type ? s.type : (s.sale_type ? s.sale_type : (s.category ? s.category : '매출'))).trim();
                const cvVal = parseNum(s.cv !== undefined ? s.cv : s.sales_cv);
                const pvVal = parseNum(s.pv !== undefined ? s.pv : s.sales_pv);
                if (dStr) {
                    memberRecords.push({
                        member_id: canonicalId,
                        type: sType === '구독' ? '구독' : '매출',
                        sale_type: sType === '구독' ? '구독' : '매출',
                        category: sType === '구독' ? '구독' : '매출',
                        date: dStr,
                        sales_date: dStr,
                        transaction_date: dStr,
                        cv: cvVal,
                        sales_cv: cvVal,
                        pv: pvVal,
                        sales_pv: pvVal
                    });
                }
            }
        });

        try {
            const apiBase = window.API_BASE ? window.API_BASE : 'http://127.0.0.1:3005';
            await window.fetch(apiBase + '/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: canonicalId,
                    member_id: canonicalId,
                    sales: memberRecords,
                    records: memberRecords
                })
            });
        } catch (e) {}

        // 메인 화면의 좌측 매출 패널, 하단 실적 집계, 계보도 카드 직급/배지, 내비게이터 즉시 갱신
        if (typeof window.computeAllMembersTeamBonusByPeriod === 'function') {
            window.lastAllMembersTeamBonusMap = window.computeAllMembersTeamBonusByPeriod(masterList, window.flatMembersData);
        }
        if (window.currentSelectedId && normId(window.currentSelectedId) === targetNorm) {
            if (typeof window.loadMemberSales === 'function') window.loadMemberSales(window.currentSelectedId);
        }
        if (typeof window.calculateLocalPerformance === 'function') {
            window.calculateLocalPerformance(window.currentSelectedId);
        }
        if (typeof window.renderTreeCardStatusBadges === 'function') {
            window.renderTreeCardStatusBadges();
        }
        if (window.bizNavPopupWindow && !window.bizNavPopupWindow.closed && typeof window.renderBusinessNavigator === 'function') {
            window.renderBusinessNavigator(window.currentSelectedId, window.bizNavPopupWindow.document);
        }
        return true;
    };

    // 매출 기간 검색 모달창 HTML 템플릿 (인라인 등록/편집/삭제 UI 탑재)
    function buildSalesSearchCrudPopupHtml(initStart, initEnd) {
        return [
            '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>🔍 매출 기간 검색 (매출 등록/편집/삭제)</title>',
            '<style>',
            '  * { box-sizing: border-box; font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif; }',
            '  body { margin: 0; padding: 12px 14px; background: #111827; color: #f3f4f6; font-size: 12px; overflow-x: hidden; }',
            '  .filter-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; background: #1f2937; border: 1px solid #374151; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; }',
            '  .filter-left { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }',
            '  .filter-right { display: flex; align-items: center; gap: 6px; }',
            '  input[type="date"], input[type="text"], select { background: #111827; border: 1px solid #4b5563; color: #f9fafb; border-radius: 5px; padding: 4px 7px; font-size: 11.5px; outline: none; }',
            '  input[type="date"]:focus, input[type="text"]:focus, select:focus { border-color: #60a5fa; }',
            '  .btn { border-radius: 5px; padding: 5px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }',
            '  .btn-search { background: #2563eb; border-color: #3b82f6; color: #ffffff; }',
            '  .btn-search:hover { background: #1d4ed8; }',
            '  .btn-all { background: #374151; border-color: #4b5563; color: #e5e7eb; }',
            '  .btn-all:hover { background: #4b5563; }',
            '  .btn-add-toggle { background: #059669; border-color: #10b981; color: #ffffff; }',
            '  .btn-add-toggle:hover { background: #047857; }',
            '  .add-form-box { display: none; background: #1e293b; border: 1.5px dashed #3b82f6; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }',
            '  .add-form-box.open { display: flex; }',
            '  .summary-bar { display: flex; justify-content: space-between; align-items: center; background: #1f2937; border: 1px solid #374151; padding: 6px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 11.5px; }',
            '  .table-wrap { border: 1px solid #374151; border-radius: 8px; overflow-y: auto; max-height: calc(100vh - 145px); background: #0f172a; }',
            '  table { width: 100%; border-collapse: collapse; font-size: 11.5px; table-layout: fixed; }',
            '  thead th { position: sticky; top: 0; background: #1e293b; color: #9ca3af; font-weight: 700; padding: 7px 6px; border-bottom: 1px solid #374151; text-align: center; z-index: 5; }',
            '  tbody tr { border-bottom: 1px solid #1f2937; }',
            '  tbody tr:hover { background: rgba(59, 130, 246, 0.08); }',
            '  tbody td { padding: 5px 6px; vertical-align: middle; text-align: center; color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
            '  .row-inp { width: 100%; background: #111827; border: 1px solid #374151; color: #ffffff; border-radius: 4px; padding: 3px 6px; font-size: 11.5px; }',
            '  .row-inp-num { text-align: right; font-weight: 700; font-family: monospace; }',
            '  .row-inp.dirty { border-color: #f59e0b; background: rgba(245, 158, 11, 0.12); }',
            '  .btn-row-save { background: #1e293b; border: 1px solid #475569; color: #94a3b8; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; }',
            '  .btn-row-save.active { background: #2563eb; border-color: #60a5fa; color: #ffffff; box-shadow: 0 0 6px rgba(37,99,235,0.5); }',
            '  .btn-row-del { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 3px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: 3px; }',
            '  .btn-row-del:hover { background: #ef4444; color: #ffffff; }',
            '</style></head><body>',
            '  <div class="filter-bar">',
            '    <div class="filter-left">',
            '      <strong style="color:#9ca3af;">조회기간</strong>',
            '      <input type="date" id="sp-start-date" value="' + initStart + '">',
            '      <span style="color:#6b7280;">~</span>',
            '      <input type="date" id="sp-end-date" value="' + initEnd + '">',
            '      <input type="text" id="sp-member-kw" placeholder="회원명 또는 ID 필터..." style="width:135px;">',
            '      <button type="button" class="btn btn-search" id="sp-btn-search">조회</button>',
            '      <button type="button" class="btn btn-all" id="sp-btn-all" title="전체 기간 조회">전체기간</button>',
            '    </div>',
            '    <div class="filter-right">',
            '      <button type="button" class="btn btn-add-toggle" id="sp-btn-toggle-add">+ 신규 매출 등록</button>',
            '    </div>',
            '  </div>',
            '  <div class="add-form-box" id="sp-add-form-box">',
            '    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">',
            '      <strong style="color:#60a5fa; font-size:11.5px;">신규등록 :</strong>',
            '      <input type="text" id="sp-new-member" list="sp-member-datalist" placeholder="회원ID 또는 이름" style="width:140px;" title="계보도에 등록된 회원번호 또는 이름을 입력하세요">',
            '      <datalist id="sp-member-datalist"></datalist>',
            '      <select id="sp-new-type"><option value="매출">매출</option><option value="구독">구독</option></select>',
            '      <input type="text" id="sp-new-date" placeholder="YYYY-MM-DD (또는 MMDD)" style="width:115px;">',
            '      <input type="text" id="sp-new-cv" placeholder="CV 입력" style="width:95px; text-align:right;">',
            '      <input type="text" id="sp-new-pv" placeholder="PV 입력" style="width:95px; text-align:right;">',
            '    </div>',
            '    <div style="display:flex; align-items:center; gap:6px;">',
            '      <button type="button" class="btn btn-search" id="sp-btn-submit-new">등록 저장</button>',
            '      <button type="button" class="btn btn-all" id="sp-btn-cancel-new">닫기</button>',
            '    </div>',
            '  </div>',
            '  <div class="summary-bar">',
            '    <div>조회 건수: <strong id="sp-total-count" style="color:#fbbf24;">0</strong>건 <span id="sp-sync-msg" style="margin-left:10px; color:#10b981; font-weight:bold;"></span></div>',
            '    <div>합계 CV: <strong id="sp-total-cv" style="color:#60a5fa;">0</strong> CV &nbsp;/&nbsp; 합계 PV: <strong id="sp-total-pv" style="color:#10b981;">0</strong> PV</div>',
            '  </div>',
            '  <div class="table-wrap">',
            '    <table>',
            '      <colgroup>',
            '        <col style="width: 105px;">',
            '        <col style="width: 85px;">',
            '        <col style="width: 72px;">',
            '        <col style="width: 112px;">',
            '        <col style="width: 115px;">',
            '        <col style="width: 115px;">',
            '        <col style="width: 108px;">',
            '      </colgroup>',
            '      <thead>',
            '        <tr>',
            '          <th>회원번호</th>',
            '          <th>성명</th>',
            '          <th>구분</th>',
            '          <th>매출일자</th>',
            '          <th style="text-align:right; padding-right:10px;">CV</th>',
            '          <th style="text-align:right; padding-right:10px;">PV</th>',
            '          <th>관리 (편집/삭제)</th>',
            '        </tr>',
            '      </thead>',
            '      <tbody id="sp-crud-tbody"></tbody>',
            '    </table>',
            '  </div>',
            '</body></html>'
        ].join('\n');
    }

    // 모달 내부 이벤트 바인딩 및 테이블 렌더링 엔진
    window.bindAndRenderSalesSearchCrudModal = function(pDoc) {
        if (!pDoc) return;
        const tbody = pDoc.getElementById('sp-crud-tbody');
        if (!tbody) return;

        const startInp = pDoc.getElementById('sp-start-date');
        const endInp = pDoc.getElementById('sp-end-date');
        const kwInp = pDoc.getElementById('sp-member-kw');
        const btnSearch = pDoc.getElementById('sp-btn-search');
        const btnAll = pDoc.getElementById('sp-btn-all');
        const btnToggleAdd = pDoc.getElementById('sp-btn-toggle-add');
        const addFormBox = pDoc.getElementById('sp-add-form-box');
        const btnSubmitNew = pDoc.getElementById('sp-btn-submit-new');
        const btnCancelNew = pDoc.getElementById('sp-btn-cancel-new');
        const syncMsgEl = pDoc.getElementById('sp-sync-msg');

        const newMemberInp = pDoc.getElementById('sp-new-member');
        const newTypeSel = pDoc.getElementById('sp-new-type');
        const newDateInp = pDoc.getElementById('sp-new-date');
        const newCvInp = pDoc.getElementById('sp-new-cv');
        const newPvInp = pDoc.getElementById('sp-new-pv');
        const dataListEl = pDoc.getElementById('sp-member-datalist');

        function showSyncToast(msg, isErr) {
            if (!syncMsgEl) return;
            syncMsgEl.style.color = isErr ? '#f87171' : '#10b981';
            syncMsgEl.textContent = msg;
            setTimeout(function() {
                if (syncMsgEl.textContent === msg) syncMsgEl.textContent = '';
            }, 2800);
        }

        // 자동완성 회원 목록 채우기
        if (dataListEl && typeof window.getUniqueMembers === 'function') {
            const members = window.getUniqueMembers();
            dataListEl.innerHTML = members.map(function(m) {
                const mId = m.id ? m.id : m.member_id;
                const mName = m.name ? m.name : '';
                return '<option value="' + mId + '">' + mName + ' (' + mId + ')</option>';
            }).join('');
        }

        // 숫자 입력칸 콤마 자동 포맷팅 헬퍼
        function attachCommaFormatter(inpEl) {
            if (!inpEl) return;
            inpEl.addEventListener('input', function() {
                const raw = inpEl.value.replace(/[^0-9]/g, '');
                inpEl.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
            });
        }
        attachCommaFormatter(newCvInp);
        attachCommaFormatter(newPvInp);

        if (newDateInp) {
            newDateInp.addEventListener('blur', function() {
                newDateInp.value = cleanDate(newDateInp.value);
            });
        }

        function renderFilteredRows() {
            const masterList = ensureSalesCrudUids();
            const sDate = startInp ? cleanDate(startInp.value) : '';
            const eDate = endInp ? cleanDate(endInp.value) : '';
            const kw = kwInp ? String(kwInp.value ? kwInp.value : '').trim().toLowerCase() : '';

            const filtered = [];
            let sumCV = 0;
            let sumPV = 0;

            masterList.forEach(function(s) {
                if (!s) return;
                const rawId = String(s.member_id ? s.member_id : (s.memberId ? s.memberId : (s.id ? s.id : ''))).trim();
                if (!rawId) return;

                const dStr = cleanDate(s.transaction_date ? s.transaction_date : (s.sales_date ? s.sales_date : s.date));
                if (!dStr) return;

                if (sDate && dStr < sDate) return;
                if (eDate && dStr > eDate) return;

                const mNode = typeof window.findMemberNode === 'function' ? window.findMemberNode(rawId) : null;
                const mName = mNode && mNode.name ? mNode.name : (s.member_name ? s.member_name : (s.name ? s.name : '-'));

                if (kw) {
                    const matchId = rawId.toLowerCase().indexOf(kw) !== -1;
                    const matchName = String(mName).toLowerCase().indexOf(kw) !== -1;
                    if (!matchId && !matchName) return;
                }

                const cvVal = parseNum(s.cv !== undefined ? s.cv : s.sales_cv);
                const pvVal = parseNum(s.pv !== undefined ? s.pv : s.sales_pv);
                const sType = String(s.type ? s.type : (s.sale_type ? s.sale_type : (s.category ? s.category : '매출'))).trim();

                sumCV += cvVal;
                sumPV += pvVal;

                filtered.push({
                    uid: s._crudUid,
                    memberId: mNode && mNode.id ? mNode.id : rawId,
                    memberName: mName,
                    type: sType === '구독' ? '구독' : '매출',
                    date: dStr,
                    cv: cvVal,
                    pv: pvVal
                });
            });

            filtered.sort(function(a, b) {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return String(a.memberId).localeCompare(String(b.memberId));
            });

            const countEl = pDoc.getElementById('sp-total-count');
            const totalCvEl = pDoc.getElementById('sp-total-cv');
            const totalPvEl = pDoc.getElementById('sp-total-pv');
            if (countEl) countEl.textContent = String(filtered.length);
            if (totalCvEl) totalCvEl.textContent = formatComma(sumCV);
            if (totalPvEl) totalPvEl.textContent = formatComma(sumPV);

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="padding: 28px 10px; text-align: center; color: #6b7280;">해당 조건의 매출/구독 내역이 없습니다. 상단 [+ 신규 매출 등록] 버튼으로 추가할 수 있습니다.</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(function(row) {
                const isSub = row.type === '구독';
                return [
                    '<tr data-uid="' + row.uid + '" data-member-id="' + row.memberId + '">',
                    '  <td style="font-family:monospace; font-weight:700; color:#60a5fa; cursor:pointer;" class="sp-cell-member" title="클릭 시 계보도에서 해당 회원 선택">' + row.memberId + '</td>',
                    '  <td style="font-weight:700; color:#ffffff; cursor:pointer;" class="sp-cell-member">' + row.memberName + '</td>',
                    '  <td>',
                    '    <select class="row-inp sp-edit-type" style="text-align:center; font-weight:700; color:' + (isSub ? '#fbbf24' : '#60a5fa') + ';">',
                    '      <option value="매출"' + (!isSub ? ' selected' : '') + '>매출</option>',
                    '      <option value="구독"' + (isSub ? ' selected' : '') + '>구독</option>',
                    '    </select>',
                    '  </td>',
                    '  <td><input type="text" class="row-inp sp-edit-date" value="' + row.date + '" style="text-align:center; font-family:monospace;"></td>',
                    '  <td><input type="text" class="row-inp row-inp-num sp-edit-cv" value="' + formatComma(row.cv) + '" style="color:#93c5fd;"></td>',
                    '  <td><input type="text" class="row-inp row-inp-num sp-edit-pv" value="' + formatComma(row.pv) + '" style="color:#6ee7b7;"></td>',
                    '  <td>',
                    '    <button type="button" class="btn-row-save" title="수정 내용 저장 (Enter)">저장</button>',
                    '    <button type="button" class="btn-row-del" title="이 매출 내역 삭제">삭제</button>',
                    '  </td>',
                    '</tr>'
                ].join('');
            }).join('');

            // 각 행의 인라인 편집 / 저장 / 삭제 이벤트 연결
            Array.from(tbody.querySelectorAll('tr[data-uid]')).forEach(function(tr) {
                const uid = tr.getAttribute('data-uid');
                const mId = tr.getAttribute('data-member-id');
                const typeSel = tr.querySelector('.sp-edit-type');
                const dateInp = tr.querySelector('.sp-edit-date');
                const cvInp = tr.querySelector('.sp-edit-cv');
                const pvInp = tr.querySelector('.sp-edit-pv');
                const saveBtn = tr.querySelector('.btn-row-save');
                const delBtn = tr.querySelector('.btn-row-del');

                // 회원번호/성명 클릭 시 메인 계보도에서 해당 회원 카드 선택 연동
                tr.querySelectorAll('.sp-cell-member').forEach(function(cell) {
                    cell.onclick = function() {
                        if (typeof window.executeNodeSingleClick === 'function') {
                            window.executeNodeSingleClick(mId);
                        }
                    };
                });

                function markDirty(el) {
                    if (el) el.classList.add('dirty');
                    if (saveBtn) saveBtn.classList.add('active');
                }

                if (typeSel) {
                    typeSel.addEventListener('change', function() {
                        typeSel.style.color = typeSel.value === '구독' ? '#fbbf24' : '#60a5fa';
                        markDirty(typeSel);
                    });
                }
                if (dateInp) {
                    dateInp.addEventListener('input', function() { markDirty(dateInp); });
                    dateInp.addEventListener('blur', function() { dateInp.value = cleanDate(dateInp.value); });
                }
                if (cvInp) {
                    attachCommaFormatter(cvInp);
                    cvInp.addEventListener('input', function() { markDirty(cvInp); });
                }
                if (pvInp) {
                    attachCommaFormatter(pvInp);
                    pvInp.addEventListener('input', function() { markDirty(pvInp); });
                }

                async function saveRowChanges() {
                    const newType = typeSel ? typeSel.value : '매출';
                    const newDate = cleanDate(dateInp ? dateInp.value : '');
                    const newCv = parseNum(cvInp ? cvInp.value : 0);
                    const newPv = parseNum(pvInp ? pvInp.value : 0);

                    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                        window.alert('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 또는 MMDD(4자리)로 입력해 주세요.');
                        return;
                    }

                    const master = ensureSalesCrudUids();
                    const targetObj = master.find(function(item) { return item && item._crudUid === uid; });
                    if (!targetObj) return;

                    targetObj.type = newType;
                    targetObj.sale_type = newType;
                    targetObj.category = newType;
                    targetObj.date = newDate;
                    targetObj.sales_date = newDate;
                    targetObj.transaction_date = newDate;
                    targetObj.cv = newCv;
                    targetObj.sales_cv = newCv;
                    targetObj.pv = newPv;
                    targetObj.sales_pv = newPv;

                    if (saveBtn) saveBtn.textContent = '...';
                    await window.syncMemberSalesToBackendV37(mId);
                    showSyncToast('✓ ' + mId + ' 매출 수정 저장 완료', false);
                    renderFilteredRows();
                }

                if (saveBtn) {
                    saveBtn.onclick = function() { saveRowChanges(); };
                }

                [dateInp, cvInp, pvInp].forEach(function(inp) {
                    if (!inp) return;
                    inp.addEventListener('keydown', function(ev) {
                        if (ev.key === 'Enter') {
                            ev.preventDefault();
                            saveRowChanges();
                        }
                    });
                });

                if (delBtn) {
                    delBtn.onclick = async function() {
                        const master = ensureSalesCrudUids();
                        const idx = master.findIndex(function(item) { return item && item._crudUid === uid; });
                        if (idx === -1) return;

                        master.splice(idx, 1);
                        await window.syncMemberSalesToBackendV37(mId);
                        showSyncToast('🗑️ ' + mId + ' 매출 1건 삭제 완료', false);
                        renderFilteredRows();
                    };
                }
            });
        }

        // 상단 버튼 이벤트 연결
        if (!pDoc.body.dataset.crudBoundV37) {
            pDoc.body.dataset.crudBoundV37 = 'true';

            if (btnSearch) btnSearch.onclick = renderFilteredRows;
            if (startInp) startInp.onchange = renderFilteredRows;
            if (endInp) endInp.onchange = renderFilteredRows;
            if (kwInp) {
                kwInp.addEventListener('input', renderFilteredRows);
                kwInp.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') renderFilteredRows();
                });
            }

            if (btnAll) {
                btnAll.onclick = function() {
                    if (startInp) startInp.value = '';
                    if (endInp) endInp.value = '';
                    if (kwInp) kwInp.value = '';
                    renderFilteredRows();
                };
            }

            if (btnToggleAdd && addFormBox) {
                btnToggleAdd.onclick = function() {
                    const isOpen = addFormBox.classList.toggle('open');
                    if (isOpen) {
                        // 현재 계보도에서 선택된 회원이 있으면 기본값으로 자동 세팅
                        if (newMemberInp && !newMemberInp.value && window.currentSelectedId) {
                            newMemberInp.value = window.currentSelectedId;
                        }
                        if (newDateInp && !newDateInp.value) {
                            const hRange = typeof window.getHeaderPeriodRange === 'function' ? window.getHeaderPeriodRange() : null;
                            newDateInp.value = (hRange && hRange.end) ? hRange.end : '2026-11-16';
                        }
                        if (newMemberInp) newMemberInp.focus();
                    }
                };
            }

            if (btnCancelNew && addFormBox) {
                btnCancelNew.onclick = function() {
                    addFormBox.classList.remove('open');
                };
            }

            if (btnSubmitNew) {
                btnSubmitNew.onclick = async function() {
                    const rawMember = newMemberInp ? newMemberInp.value : '';
                    const mNode = window.resolveMemberForSalesCrud(rawMember);
                    if (!mNode) {
                        window.alert('유효한 회원번호 또는 성명을 입력해 주세요. (입력값: ' + rawMember + ')');
                        if (newMemberInp) newMemberInp.focus();
                        return;
                    }

                    const canonicalId = mNode.id ? mNode.id : mNode.member_id;
                    const sType = newTypeSel ? newTypeSel.value : '매출';
                    const dStr = cleanDate(newDateInp ? newDateInp.value : '');
                    const cvVal = parseNum(newCvInp ? newCvInp.value : 0);
                    const pvVal = parseNum(newPvInp ? newPvInp.value : 0);

                    if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
                        window.alert('매출일자를 YYYY-MM-DD 또는 MMDD(4자리) 형식으로 입력해 주세요.');
                        if (newDateInp) newDateInp.focus();
                        return;
                    }
                    if (cvVal <= 0 && pvVal <= 0) {
                        window.alert('CV 또는 PV 금액을 0보다 크게 입력해 주세요.');
                        if (newCvInp) newCvInp.focus();
                        return;
                    }

                    const master = ensureSalesCrudUids();
                    master.unshift({
                        _crudUid: 'sale_uid_' + Date.now() + '_new',
                        member_id: canonicalId,
                        memberId: canonicalId,
                        member_name: mNode.name ? mNode.name : '',
                        type: sType,
                        sale_type: sType,
                        category: sType,
                        date: dStr,
                        sales_date: dStr,
                        transaction_date: dStr,
                        cv: cvVal,
                        sales_cv: cvVal,
                        pv: pvVal,
                        sales_pv: pvVal
                    });

                    // 등록한 날짜가 현재 조회 기간 밖이면 조회 기간을 자동 확장하여 방금 등록한 내역이 바로 보이게 처리
                    if (startInp && startInp.value && dStr < startInp.value) startInp.value = dStr;
                    if (endInp && endInp.value && dStr > endInp.value) endInp.value = dStr;

                    await window.syncMemberSalesToBackendV37(canonicalId);

                    if (newCvInp) newCvInp.value = '';
                    if (newPvInp) newPvInp.value = '';
                    showSyncToast('✓ ' + (mNode.name ? mNode.name : canonicalId) + ' 신규 매출 등록 완료', false);
                    renderFilteredRows();
                };
            }
        }

        renderFilteredRows();
    };

    // 기존 매출 기간 검색 팝업 오픈 함수를 인라인 CRUD 모달 버전으로 오버라이드
    window.openSalesSearchPopupWindow = function() {
        let initStart = '2026-11-16';
        let initEnd = '2026-11-30';
        if (typeof window.getHeaderPeriodRange === 'function') {
            const r = window.getHeaderPeriodRange();
            if (r && r.start) initStart = r.start;
            if (r && r.end) initEnd = r.end;
        }

        const win = window.open('', 'SALESSEARCHPOPUP', 'width=860,height=560,resizable=yes,scrollbars=yes');
        if (!win) return;
        window.salesSearchPopupWindow = win;

        win.document.open();
        win.document.write(buildSalesSearchCrudPopupHtml(initStart, initEnd));
        win.document.close();

        setTimeout(function() {
            window.bindAndRenderSalesSearchCrudModal(win.document);
        }, 40);
    };

    window.toggleSalesSearchPopup = function() {
        if (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed) {
            window.salesSearchPopupWindow.close();
            window.salesSearchPopupWindow = null;
            return;
        }
        window.openSalesSearchPopupWindow();
    };

    window.renderSalesPeriodSearchModal = function(optDoc) {
        const doc = optDoc ? optDoc : (window.salesSearchPopupWindow && !window.salesSearchPopupWindow.closed ? window.salesSearchPopupWindow.document : null);
        if (doc) {
            window.bindAndRenderSalesSearchCrudModal(doc);
        }
    };
})();
// ============================================================================
// [38] 🔄 상단 헤더 계보도 새로고침(↻) 아이콘을 'VJ 모드 전용 초기화 아이콘'으로 전환
//      1) 기본(VK) 모드에서는 화면에서 완전히 숨김(display: none) 처리
//      2) VJ 모드(window.currentCanvasMode === 'vj')일 때만 아이콘을 표시하여 VJ 캔버스 초기화 실행
//      3) 하단 줌 컨트롤 바(.zoom-controls)에 중복 생성되던 기존 리셋 아이콘은 자동 제거
//      4) 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호 완전 배제
// ============================================================================
(function initHeaderRefreshAsVjOnlyResetButtonV38() {
    // 1. VJ 모드 초기화 실행 함수
    window.handleResetVjCanvas = async function() {
        if (window.currentCanvasMode !== 'vj') return;

        const confirmed = window.confirm('현재 VJ 캔버스의 모든 파트너와 매출 내역을 삭제하고 최초 상태(VJ-001 박성혜 마스터 1명)로 초기화하시겠습니까?');
        if (!confirmed) return;

        try {
            const apiBase = window.API_BASE ? window.API_BASE : 'http://127.0.0.1:3005';
            const res = await window.fetch(apiBase + '/api/vj/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-canvas-mode': 'vj' },
                body: JSON.stringify({ _canvasMode: 'vj' })
            });
            const data = await res.json();
            if (res.ok && data && data.success) {
                window._vjCachedMembersMap = {};
                window.customTopRootId = null;
                window.currentSelectedId = null;
                localStorage.removeItem('BS_COMPUTED_RANK_CACHE_V35');

                if (typeof window.fetchTreeData === 'function') {
                    await window.fetchTreeData(true);
                } else {
                    window.location.reload();
                }
            } else {
                window.alert('VJ 초기화 중 문제가 발생했습니다.');
            }
        } catch (err) {
            window.alert('VJ 초기화 요청 실패: ' + err.message);
        }
    };

    // 2. 상단 헤더에서 노란색 새로고침(↻) 아이콘 요소 정밀 탐색
    function findHeaderRefreshButton() {
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        if (!headerEl) return null;

        let targetBtn = headerEl.querySelector('#headerRefreshBtn, #resetTreeBtn, #refreshTreeBtn');
        if (targetBtn) return targetBtn;

        const candidates = Array.from(headerEl.querySelectorAll('button, a, .icon-btn, [onclick]'));
        for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            if (el.id === 'bsVjCanvasToggleBtn') continue;
            if (el.id === 'bs-comp-plan-help-btn-v32') continue;
            if (el.id === 'bsLogoutBtn') continue;

            const onclickStr = String(el.getAttribute('onclick') ? el.getAttribute('onclick') : '');
            const titleStr = String(el.getAttribute('title') ? el.getAttribute('title') : '');
            const htmlStr = String(el.innerHTML ? el.innerHTML : '');

            const isSettings = onclickStr.indexOf('toggleSettingsMenu') !== -1 ? true : (titleStr.indexOf('설정') !== -1);
            if (isSettings) continue;

            const isRefreshAction = Boolean(
                onclickStr.indexOf('fetchTreeData') !== -1 ? true :
                onclickStr.indexOf('reset') !== -1 ? true :
                onclickStr.indexOf('reload') !== -1 ? true :
                onclickStr.indexOf('init') !== -1 ? true :
                titleStr.indexOf('새로고침') !== -1 ? true :
                titleStr.indexOf('초기화') !== -1 ? true :
                htmlStr.indexOf('M23 4v6h-6') !== -1 ? true :
                htmlStr.indexOf('M21 12a9 9 0 1 1') !== -1 ? true :
                htmlStr.indexOf('M3 12a9 9 0 1 0') !== -1 ? true :
                htmlStr.indexOf('rotate') !== -1
            );

            if (isRefreshAction) {
                return el;
            }
        }
        return null;
    }

    // 3. 헤더 새로고침 버튼을 기본(VK) 모드에서는 비표시(display: none), VJ 모드에서만 표시
    window.syncHeaderVjResetButtonState = function() {
        const duplicateZoomReset = document.getElementById('bs-vj-floating-reset-btn-v33');
        if (duplicateZoomReset) {
            duplicateZoomReset.remove();
        }

        const refreshBtn = findHeaderRefreshButton();
        if (!refreshBtn) return;

        if (refreshBtn.dataset.vjResetBoundV38 !== 'true') {
            refreshBtn.dataset.vjResetBoundV38 = 'true';
            refreshBtn.removeAttribute('onclick');

            refreshBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }

                if (window.currentCanvasMode !== 'vj') {
                    return;
                }
                window.handleResetVjCanvas();
            }, true);
        }

        const isVj = (window.currentCanvasMode === 'vj');
        const nextModeState = isVj ? 'vj_visible' : 'main_hidden';

        if (refreshBtn.dataset.renderedVjState === nextModeState) return;
        refreshBtn.dataset.renderedVjState = nextModeState;

        if (isVj) {
            refreshBtn.disabled = false;
            refreshBtn.title = 'VJ 모드 초기화 (VJ-001 초기 상태로 리셋)';
            refreshBtn.style.setProperty('display', 'inline-flex', 'important');
            refreshBtn.style.setProperty('align-items', 'center', 'important');
            refreshBtn.style.setProperty('justify-content', 'center', 'important');
            refreshBtn.style.setProperty('opacity', '1', 'important');
            refreshBtn.style.setProperty('filter', 'none', 'important');
            refreshBtn.style.setProperty('cursor', 'pointer', 'important');
            refreshBtn.style.setProperty('pointer-events', 'auto', 'important');
            refreshBtn.style.setProperty('color', '#fbbf24', 'important');
        } else {
            // 기본(VK) 모드에서는 아예 보이지 않도록 숨김 처리
            refreshBtn.style.setProperty('display', 'none', 'important');
        }
    };

    // VJ 스위치 클릭 시 즉시 버튼 표시/비표시 전환 연동
    const origToggleVj = window.toggleVjCanvasMode;
    if (typeof origToggleVj === 'function' && !origToggleVj._vjResetSyncWrappedV38) {
        const wrappedToggle = async function(e) {
            const p = origToggleVj.apply(this, arguments);
            window.syncHeaderVjResetButtonState();
            return await p;
        };
        wrappedToggle._vjResetSyncWrappedV38 = true;
        window.toggleVjCanvasMode = wrappedToggle;
    }

    setTimeout(window.syncHeaderVjResetButtonState, 40);
    setTimeout(window.syncHeaderVjResetButtonState, 200);
    setInterval(window.syncHeaderVjResetButtonState, 500);
})();
// ============================================================================
// [39] 📅 VJ 모드 최상위 파트너 가입일 기준 헤더 기수 자동 지정 + 최초/최종매출일 2줄 정밀 동기화
//      1) VJ 모드 진입 또는 최상위 파트너(VJ-001) 가입일 변경 시, 상단 헤더 기간(시작일~종료일)을
//         최상위 파트너의 가입일이 속한 반월 기수(예: 2027-04-01 -> 2027-04-01 ~ 2027-04-15)로 자동 세팅
//      2) VJ-001과 VK-001이 섞이지 않도록 모드별 매출을 엄격히 분리하고 카드 하단 최초/최종매출일 2줄 동기화
//      3) 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호 완전 배제
// ============================================================================
(function initFutureSalesDateSupportAndCardSyncV39() {
    let lastSyncedVjRootJoinDate = '';
    let lastCanvasModeForPeriod = '';

    function modeSafeId(val) {
        if (!val) return '';
        let s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        const raw = String(s).trim().toLowerCase();
        if (raw.indexOf('vj') === 0) {
            return 'vj_' + raw.replace(/^vj-?0*/, '');
        }
        if (raw.indexOf('vk') === 0) {
            return 'vk_' + raw.replace(/^vk-?0*/, '');
        }
        const prefix = (window.currentCanvasMode === 'vj') ? 'vj_' : 'vk_';
        return prefix + raw.replace(/^v[kj]-?0*/, '');
    }

    function cleanDate(val) {
        if (!val) return '';
        const s = String(val).trim().replace(/\//g, '-');
        if (/^\d{4}$/.test(s)) {
            return '2026-' + s.substring(0, 2) + '-' + s.substring(2, 4);
        }
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '';
    }

    // 특정 날짜(YYYY-MM-DD)가 속한 반월 기수의 시작일(start)과 종료일(end) 반환
    function getHalfMonthPeriodBounds(dateStr) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const ymPrefix = parts[0] + '-' + parts[1];

        if (d <= 15) {
            return {
                start: ymPrefix + '-01',
                end: ymPrefix + '-15'
            };
        }
        const lastDay = new Date(y, m, 0).getDate();
        return {
            start: ymPrefix + '-16',
            end: ymPrefix + '-' + String(lastDay).padStart(2, '0')
        };
    }

    // 상단 헤더의 시작일/종료일 input 요소 탐색
    function findHeaderDateInputs() {
        if (typeof window.getHeaderPeriodRange === 'function') {
            const r = window.getHeaderPeriodRange();
            if (r && r.startInput && r.endInput) {
                return { startInput: r.startInput, endInput: r.endInput };
            }
        }
        const headerEl = document.querySelector('header, .header, .top-bar, .top-header-bar');
        const scope = headerEl ? headerEl : document;
        const dateInps = Array.from(scope.querySelectorAll('input[type="date"], input#startDate, input#endDate'));
        if (dateInps.length >= 2) {
            return { startInput: dateInps[0], endInput: dateInps[1] };
        }
        return null;
    }

    // 🌟 VJ 모드 최상위 파트너(VJ-001 등)의 가입일 추출
    function getVjTopRootJoinDate(dateStatsMap) {
        let rootNode = typeof window.getAbsoluteTopRoot === 'function' ? window.getAbsoluteTopRoot() : window.treeData;
        if (!rootNode && typeof window.findMemberNode === 'function') {
            rootNode = window.findMemberNode('VJ-001');
        }

        let joinD = '';
        if (rootNode) {
            const rawJoin = rootNode.joinDate ? rootNode.joinDate : (rootNode.join_date ? rootNode.join_date : (rootNode.reg_date ? rootNode.reg_date : (rootNode.created_at ? rootNode.created_at : '')));
            joinD = cleanDate(rawJoin);
        }

        // 아직 노드에 가입일이 없거나 기본 더미값(2026-11-04)일 경우, 화면에 렌더링된 최상위 카드(VJ-001) 또는 최초매출일에서 확인
        const rootCard = document.getElementById('card_VJ-001') ? document.getElementById('card_VJ-001') : document.querySelector('.node-card');
        if (rootCard) {
            const leafDates = Array.from(rootCard.querySelectorAll('div, span')).map(function(el) {
                return el.children.length === 0 ? cleanDate(el.innerText) : '';
            }).filter(function(d) {
                return /^\d{4}-\d{2}-\d{2}$/.test(d);
            });
            // 카드의 첫 번째 날짜 줄이 가입일(예: 2027-04-01)
            if (leafDates.length > 0 && (!joinD ? true : (joinD === '2026-11-04' && leafDates[0] !== '2026-11-04'))) {
                joinD = leafDates[0];
            }
        }

        if ((!joinD ? true : (joinD === '2026-11-04')) && dateStatsMap instanceof Map) {
            const rootStat = dateStatsMap.get('vj_1');
            if (rootStat && rootStat.minDate) {
                joinD = rootStat.minDate;
            }
        }

        return joinD;
    }

    // 🌟 VJ 모드일 때 최상위 파트너의 가입일 기준 기수로 상단 헤더 기간(시작일~종료일) 지정
    window.syncVjHeaderPeriodToTopRootJoinDate = function(forceApply, dateStatsMap) {
        const curMode = window.currentCanvasMode === 'vj' ? 'vj' : 'vk';
        const modeJustChangedToVj = (curMode === 'vj' && lastCanvasModeForPeriod !== 'vj');
        lastCanvasModeForPeriod = curMode;

        if (curMode !== 'vj') {
            lastSyncedVjRootJoinDate = '';
            return false;
        }

        const rootJoinDate = getVjTopRootJoinDate(dateStatsMap);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rootJoinDate)) return false;

        const bounds = getHalfMonthPeriodBounds(rootJoinDate);
        if (!bounds) return false;

        const inps = findHeaderDateInputs();
        if (!inps) return false;

        const curStart = inps.startInput.value;
        const curEnd = inps.endInput.value;
        const isDefaultNov2026 = (curStart === '2026-11-16' && curEnd === '2026-11-30');
        const joinDateChanged = (rootJoinDate !== lastSyncedVjRootJoinDate);

        if (forceApply ? true : (modeJustChangedToVj ? true : (joinDateChanged ? true : isDefaultNov2026))) {
            lastSyncedVjRootJoinDate = rootJoinDate;
            if (curStart !== bounds.start ? true : (curEnd !== bounds.end)) {
                inps.startInput.value = bounds.start;
                inps.endInput.value = bounds.end;
                return true;
            }
        }
        return false;
    };

    // 1. 현재 모드의 매출 데이터 스캔 및 최초매출일/최종매출일 & VJ 헤더 기수 동기화
    window.syncAllMembersFirstAndLastSalesDates = function(forceHeaderSync) {
        const isVjMode = (window.currentCanvasMode === 'vj');
        const allSales = Array.isArray(window.allSalesData)
            ? window.allSalesData
            : (Array.isArray(window.integrated_sales_history) ? window.integrated_sales_history : []);

        const dateStatsMap = new Map();

        allSales.forEach(function(s) {
            if (!s) return;
            const rawMemberId = String(s.member_id ? s.member_id : (s.memberId ? s.memberId : (s.id ? s.id : ''))).trim();
            if (!rawMemberId) return;

            const upperId = rawMemberId.toUpperCase();
            if (isVjMode && upperId.indexOf('VK-') === 0) return;
            if (!isVjMode && upperId.indexOf('VJ-') === 0) return;

            const mKey = modeSafeId(rawMemberId);
            if (!mKey) return;

            const dStr = cleanDate(s.transaction_date ? s.transaction_date : (s.sales_date ? s.sales_date : (s.buy_date ? s.buy_date : s.date)));
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return;

            const rawCv = s.cv !== undefined ? s.cv : s.sales_cv;
            const rawPv = s.pv !== undefined ? s.pv : s.sales_pv;
            const cvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(rawCv) : Number(String(rawCv ? rawCv : '0').replace(/[^0-9.-]/g, ''));
            const pvVal = typeof window.parseCommaNumber === 'function' ? window.parseCommaNumber(rawPv) : Number(String(rawPv ? rawPv : '0').replace(/[^0-9.-]/g, ''));
            if (cvVal <= 0 && pvVal <= 0) return;

            if (!dateStatsMap.has(mKey)) {
                dateStatsMap.set(mKey, { minDate: dStr, maxDate: dStr });
            } else {
                const st = dateStatsMap.get(mKey);
                if (dStr < st.minDate) st.minDate = dStr;
                if (dStr > st.maxDate) st.maxDate = dStr;
            }
        });

        // 🌟 VJ 모드일 때 최상위 파트너의 가입일 기준 기수로 헤더 날짜 자동 세팅!
        const headerUpdated = window.syncVjHeaderPeriodToTopRootJoinDate(Boolean(forceHeaderSync), dateStatsMap);

        // 메모리상의 트리 노드에 최초매출일 / 최종매출일 동기화
        function updateNodeDates(n) {
            if (!n) return;
            const rawId = n.id ? n.id : n.member_id;
            const k = modeSafeId(rawId);
            const stat = k ? dateStatsMap.get(k) : null;

            if (stat) {
                n.firstSales = stat.minDate;
                n.first_sales_date = stat.minDate;
                n.firstSaleDate = stat.minDate;
                n.lastSales = stat.maxDate;
                n.last_sales_date = stat.maxDate;
                n.lastSaleDate = stat.maxDate;
                n.recentSalesDate = stat.maxDate;
            } else if (isVjMode) {
                n.firstSales = '-';
                n.first_sales_date = '-';
                n.firstSaleDate = '-';
                n.lastSales = '-';
                n.last_sales_date = '-';
                n.lastSaleDate = '-';
                n.recentSalesDate = '-';
            }

            if (n.left && typeof n.left === 'object') updateNodeDates(n.left);
            if (n.right && typeof n.right === 'object') updateNodeDates(n.right);
            if (Array.isArray(n.children)) {
                n.children.forEach(function(c) { updateNodeDates(c); });
            }
        }

        if (window.treeData) updateNodeDates(window.treeData);

        if (window.flatMembersData && typeof window.flatMembersData === 'object') {
            Object.keys(window.flatMembersData).forEach(function(key) {
                updateNodeDates(window.flatMembersData[key]);
            });
        }
        if (window.memberMap instanceof Map) {
            window.memberMap.forEach(function(m) {
                updateNodeDates(m);
            });
        }

        // 화면에 렌더링된 계보도 카드(.node-card) 하단 2줄(최초매출일/최종매출일) 정밀 교체
        document.querySelectorAll('.node-card').forEach(function(card) {
            const cId = card.getAttribute('data-member-id') ? card.getAttribute('data-member-id') : (card.id ? card.id.replace(/^card_/, '') : '');
            if (!cId) return;
            const stat = dateStatsMap.get(modeSafeId(cId));

            const leafEls = Array.from(card.querySelectorAll('div, span, p')).filter(function(el) {
                if (el.children.length > 0) return false;
                if (el.closest('.bs-card-top-badges')) return false;
                if (el.classList.contains('node-pos-badge')) return false;
                return true;
            });

            const dateLikeEls = leafEls.filter(function(el) {
                const t = String(el.innerText ? el.innerText : '').trim();
                return /^\d{4}-\d{2}-\d{2}$/.test(t) ? true : (t === '-' ? true : (t.indexOf('최초') !== -1 ? true : (t.indexOf('최종') !== -1)));
            });

            if (stat) {
                if (dateLikeEls.length >= 3) {
                    const firstSaleEl = dateLikeEls[dateLikeEls.length - 2];
                    const lastSaleEl = dateLikeEls[dateLikeEls.length - 1];
                    if (firstSaleEl.innerText !== stat.minDate) firstSaleEl.innerText = stat.minDate;
                    if (lastSaleEl.innerText !== stat.maxDate) lastSaleEl.innerText = stat.maxDate;
                } else if (dateLikeEls.length === 2) {
                    const firstSaleEl = dateLikeEls[0];
                    const lastSaleEl = dateLikeEls[1];
                    if (firstSaleEl.innerText !== stat.minDate) firstSaleEl.innerText = stat.minDate;
                    if (lastSaleEl.innerText !== stat.maxDate) lastSaleEl.innerText = stat.maxDate;
                }
            } else if (isVjMode && dateLikeEls.length >= 3) {
                const firstSaleEl = dateLikeEls[dateLikeEls.length - 2];
                const lastSaleEl = dateLikeEls[dateLikeEls.length - 1];
                if (firstSaleEl.innerText === '2026-11-04') firstSaleEl.innerText = '-';
                if (lastSaleEl.innerText === '2026-11-04') lastSaleEl.innerText = '-';
            }
        });

        // 헤더 기수가 변경되었다면 실적 집계 및 배지도 새 기수에 맞춰 즉시 재계산
        if (headerUpdated && typeof window.calculateLocalPerformance === 'function') {
            window.calculateLocalPerformance(window.currentSelectedId);
        }
    };

    // 2. VJ 모드 전환 시 및 트리 로드 시 최상위 파트너 가입일 기준 기수로 즉시 동기화
    const origToggleVj = window.toggleVjCanvasMode;
    if (typeof origToggleVj === 'function' && !origToggleVj._vjPeriodSyncWrappedV39) {
        const wrappedToggleVj = async function() {
            const res = await origToggleVj.apply(this, arguments);
            setTimeout(function() {
                window.syncAllMembersFirstAndLastSalesDates(true);
            }, 80);
            return res;
        };
        wrappedToggleVj._vjPeriodSyncWrappedV39 = true;
        window.toggleVjCanvasMode = wrappedToggleVj;
    }

    const origRenderTree = window.renderTree;
    if (typeof origRenderTree === 'function' && !origRenderTree._salesDateSyncWrappedV39) {
        const wrappedRender = function() {
            window.syncAllMembersFirstAndLastSalesDates(false);
            const res = origRenderTree.apply(this, arguments);
            window.syncAllMembersFirstAndLastSalesDates(false);
            return res;
        };
        wrappedRender._salesDateSyncWrappedV39 = true;
        window.renderTree = wrappedRender;
    }

    const origSaveSales = window.saveAllMemberSalesToTiDB;
    if (typeof origSaveSales === 'function' && !origSaveSales._salesDateSyncWrappedV39) {
        const wrappedSave = async function() {
            const res = await origSaveSales.apply(this, arguments);
            window.syncAllMembersFirstAndLastSalesDates(false);
            if (typeof window.renderTree === 'function') window.renderTree(true);
            return res;
        };
        wrappedSave._salesDateSyncWrappedV39 = true;
        window.saveAllMemberSalesToTiDB = wrappedSave;
    }

    setTimeout(function() { window.syncAllMembersFirstAndLastSalesDates(true); }, 120);
    setInterval(function() { window.syncAllMembersFirstAndLastSalesDates(false); }, 500);
})();
// ============================================================================
// [40] 📌 VJ 모드 상태에서 페이지 새로고침(F5) 시에도 VJ 화면 및 선택 상태 완벽 유지
//      1) VJ/VK 모드 전환 상태를 localStorage(BS_SAVED_CANVAS_MODE_V40)에 실시간 저장
//      2) 새로고침 즉시 초기 API 요청(/api/tree, /api/sales)에 VJ 모드 헤더/쿼리를 자동 주입하여
//         VK 화면으로 돌아가지 않고 처음부터 VJ 계보도 화면으로 렌더링
//      3) 복사 시 문법 에러를 유발하는 백틱(`) 및 파이프(||) 기호 완전 배제
// ============================================================================
(function initPersistVjCanvasModeAcrossReloadV40() {
    const MODE_STORAGE_KEY = 'BS_SAVED_CANVAS_MODE_V40';
    const VJ_SELECTED_ID_KEY = 'BS_SAVED_VJ_SELECTED_ID_V40';

    function getSavedMode() {
        try {
            const m = localStorage.getItem(MODE_STORAGE_KEY);
            return m === 'vj' ? 'vj' : 'main';
        } catch (e) {
            return 'main';
        }
    }

    function saveCurrentMode(mode) {
        try {
            const norm = mode === 'vj' ? 'vj' : 'main';
            localStorage.setItem(MODE_STORAGE_KEY, norm);
            localStorage.setItem('bs_canvas_mode', norm);
            sessionStorage.setItem('bs_canvas_mode', norm);
        } catch (e) {}
    }

    // 1. 스크립트 로드 즉시 저장된 모드가 'vj'이면 전역 상태를 최우선으로 'vj'로 고정!
    const initialSavedMode = getSavedMode();
    if (initialSavedMode === 'vj') {
        window.currentCanvasMode = 'vj';
        if (document.body) {
            document.body.setAttribute('data-canvas-mode', 'vj');
        }
    }

    // 2. 다른 초기화 코드가 부팅 중 window.currentCanvasMode를 'main'으로 덮어쓰지 못하도록 보호하고
    //    fetch 호출 시 VJ 모드 헤더(x-canvas-mode: vj)와 쿼리(_canvasMode=vj)가 누락되지 않게 보장
    const origFetch = window.fetch;
    if (typeof origFetch === 'function' && !origFetch._vjPersistWrappedV40) {
        const wrappedFetch = function(input, init) {
            const activeMode = window.currentCanvasMode === 'vj' ? 'vj' : 'main';
            if (activeMode === 'vj' && typeof input === 'string') {
                const isSimApi = Boolean(
                    input.indexOf('/api/tree') !== -1 ? true :
                    input.indexOf('/api/sales') !== -1 ? true :
                    input.indexOf('/api/members') !== -1 ? true :
                    input.indexOf('/api/performance') !== -1
                );
                if (isSimApi) {
                    let newUrl = input;
                    if (newUrl.indexOf('_canvasMode=') === -1) {
                        const sep = newUrl.indexOf('?') === -1 ? '?' : '&';
                        newUrl = newUrl + sep + '_canvasMode=vj';
                    }
                    const newInit = init ? Object.assign({}, init) : {};
                    const hdrs = newInit.headers ? Object.assign({}, newInit.headers) : {};
                    hdrs['x-canvas-mode'] = 'vj';
                    newInit.headers = hdrs;
                    return origFetch.call(this, newUrl, newInit);
                }
            }
            return origFetch.apply(this, arguments);
        };
        wrappedFetch._vjPersistWrappedV40 = true;
        window.fetch = wrappedFetch;
    }

    // 3. 상단 헤더의 [VJ] 토글 스위치 버튼 UI를 현재 모드(VJ / 기본)에 맞춰 동기화
    window.syncVjToggleSwitchButtonUI = function() {
        const isVj = (window.currentCanvasMode === 'vj');
        if (document.body) {
            document.body.setAttribute('data-canvas-mode', isVj ? 'vj' : 'main');
        }

        const vjBtn = document.getElementById('bsVjCanvasToggleBtn');
        if (vjBtn) {
            if (isVj) {
                vjBtn.style.setProperty('background', 'linear-gradient(135deg, #2563eb, #1d4ed8)', 'important');
                vjBtn.style.setProperty('border-color', '#60a5fa', 'important');
                vjBtn.style.setProperty('color', '#ffffff', 'important');
                vjBtn.style.setProperty('box-shadow', '0 0 12px rgba(37, 99, 235, 0.6)', 'important');
            } else {
                vjBtn.style.setProperty('background', '#1f2937', 'important');
                vjBtn.style.setProperty('border-color', '#4b5563', 'important');
                vjBtn.style.setProperty('color', '#9ca3af', 'important');
                vjBtn.style.setProperty('box-shadow', 'none', 'important');
            }
        }

        if (typeof window.syncHeaderVjResetButtonState === 'function') {
            window.syncHeaderVjResetButtonState();
        }
    };

    // 4. [VJ] 스위치 클릭 함수(toggleVjCanvasMode) 호출 시 변경된 모드를 즉시 저장
    const origToggleVj = window.toggleVjCanvasMode;
    if (typeof origToggleVj === 'function' && !origToggleVj._persistModeWrappedV40) {
        const wrappedToggle = async function(e) {
            const res = await origToggleVj.apply(this, arguments);
            const cur = window.currentCanvasMode === 'vj' ? 'vj' : 'main';
            saveCurrentMode(cur);
            window.syncVjToggleSwitchButtonUI();
            return res;
        };
        wrappedToggle._persistModeWrappedV40 = true;
        window.toggleVjCanvasMode = wrappedToggle;
    }

    // 5. VJ 모드에서 카드 클릭 시 선택된 파트너 ID를 기억해 두었다가 새로고침 후 복원
    const origExecClick = window.executeNodeSingleClick;
    if (typeof origExecClick === 'function' && !origExecClick._vjSelectSaveWrappedV40) {
        const wrappedClick = async function(id) {
            if (window.currentCanvasMode === 'vj' && id && String(id).toUpperCase().indexOf('VJ-') === 0) {
                try { localStorage.setItem(VJ_SELECTED_ID_KEY, String(id)); } catch (e) {}
            }
            return await origExecClick.apply(this, arguments);
        };
        wrappedClick._vjSelectSaveWrappedV40 = true;
        window.executeNodeSingleClick = wrappedClick;
    }

    // 6. 만약 페이지 부팅 과정에서 기본(VK) 트리가 먼저 로드되었더라도,
    //    저장된 모드가 'vj'이면 즉시 VJ 데이터로 재호출하여 VJ 화면을 완벽 복원!
    async function ensureVjScreenRestoredOnBoot() {
        if (getSavedMode() !== 'vj') {
            window.syncVjToggleSwitchButtonUI();
            return;
        }

        window.currentCanvasMode = 'vj';
        window.syncVjToggleSwitchButtonUI();

        const rootNode = typeof window.getAbsoluteTopRoot === 'function' ? window.getAbsoluteTopRoot() : window.treeData;
        const rootId = rootNode && rootNode.id ? String(rootNode.id).toUpperCase() : '';

        // 현재 로드된 루트가 VJ-가 아니면(즉, VK 데이터가 로드되었으면) 즉시 VJ 트리와 매출 데이터를 다시 불러옴
        if (rootId.indexOf('VJ-') !== 0) {
            if (typeof window.fetchTreeData === 'function') {
                try { await window.fetchTreeData(true); } catch (e) {}
            }
        }

        setTimeout(function() {
            window.syncVjToggleSwitchButtonUI();
            if (typeof window.syncAllMembersFirstAndLastSalesDates === 'function') {
                window.syncAllMembersFirstAndLastSalesDates(true);
            }

            // 직전에 선택했던 VJ 파트너 카드가 있으면 선택 상태 복원 (없으면 VJ-001 선택)
            let savedVjTarget = '';
            try { savedVjTarget = localStorage.getItem(VJ_SELECTED_ID_KEY) ? localStorage.getItem(VJ_SELECTED_ID_KEY) : ''; } catch (e) {}
            const targetNode = (savedVjTarget && typeof window.findMemberNode === 'function') ? window.findMemberNode(savedVjTarget) : null;
            const finalTargetId = targetNode ? targetNode.id : 'VJ-001';

            if (typeof window.executeNodeSingleClick === 'function' && typeof window.findMemberNode === 'function' && window.findMemberNode(finalTargetId)) {
                window.executeNodeSingleClick(finalTargetId);
            }
        }, 180);
    }

    setTimeout(ensureVjScreenRestoredOnBoot, 80);
    setTimeout(ensureVjScreenRestoredOnBoot, 400);
})();
// ============================================================================
// [41]~[45] 통합 패치 블록 [Version-3.5] (VK/VJ 모드별 독립 기간설정 & 최상위 파트너 가입일 기준 VJ 기본기수 엔진)
// - Update: Version-3.5
// - 1) VK 모드와 VJ 모드의 헤더 기간설정이 서로 동기화되지 않도록 모드별 독립 기간 저장소(modePeriodStoreV35) 분리!
// - 2) VK 모드 기본기수: 실제 현재 날짜(new Date())에 해당하는 반월 기수(01~15일 / 16~말일) 자동 표시
// - 3) VJ 모드 기본기수: 최상위 파트너의 가입일(join_date / 카드 가입일) 기준 반월 기수를 기본 표시하되,
//      실제 현재 날짜가 최상위 파트너의 가입일을 지났다면 VK 모드와 동일하게 현재 날짜 기준 기수로 표시!
// - 4) [42] 최상위 파트너 위쪽 드래그·휠 스크롤 차단, 디렉터 클릭 깜빡임 0ms 제거, 품위유지 상향/하향 표기 유지
// ============================================================================
(function initUnifiedSimulatorPatchesVersion3_5() {
    var PATCH_VERSION = 'Version-3.5';
    var isClampingTransform = false;
    var isProgrammaticDateUpdate = false;
    var isEnforcingDomSync = false;
    var pendingPromptAnswer = null;
    var pendingPromptQuestion = '';
    var lastInteractionContext = null;
    var MOVED_STATE_KEY = 'BS_LAST_MOVED_PARTNER_STATE_V43';

    var indexedSalesCount = -1;
    var indexedDomCardCount = -1;
    var indexedFirstCardId = '';
    var indexedPeriodKey = '';
    var indexedMode = '';

    // 🌟 VK / VJ 모드별 독립 기간 상태 및 사용자 수동 변경 여부 추적
    var modePeriodStoreV35 = { vk: null, vj: null };
    var userManuallyChangedPeriodV35 = { vk: false, vj: false };
    var lastAppliedCanvasModeV35 = '';

    var salesByMemberNormMap = new Map();
    var memberNodeByNormMap = new Map();
    var memberNormByNameMap = new Map();
    var initialRawRankByNormMap = new Map();
    var binaryChildrenByParentNormMap = new Map();
    var sublineSetsByNormMap = new Map();
    var computedMetricsByNormMap = new Map();
    var periodRankByNormMap = new Map();
    var cachedBadgeHtmlByPeriodAndNormMap = new Map();
    var lastDomBadgeRenderSig = '';
    var activeTreeObserver = null;
    var observedTreeContainerEl = null;

    var navDragState = {
        isDragging: false,
        hasMoved: false,
        targetEl: null,
        startX: 0,
        startY: 0,
        origLeft: 0,
        origTop: 0
    };

    var KNOWN_RANKS = [
        'CROWN', 'RED DIAMOND', 'BLUE DIAMOND', 'GREEN DIAMOND',
        'DIAMOND', 'EMERALD', 'DIRECTOR', 'MANIA', 'MEMBER', 'GUEST'
    ];
    var RANK_LEVEL_MAP = {
        'GUEST': 1, 'MEMBER': 2, 'MANIA': 3, 'DIRECTOR': 4, 'EMERALD': 5,
        'DIAMOND': 6, 'GREEN DIAMOND': 7, 'BLUE DIAMOND': 8, 'RED DIAMOND': 9, 'CROWN': 10
    };
    var LEVEL_TO_RANK_NAME = {
        1: 'GUEST', 2: 'MEMBER', 3: 'MANIA', 4: 'DIRECTOR', 5: 'EMERALD',
        6: 'DIAMOND', 7: 'GREEN DIAMOND', 8: 'BLUE DIAMOND', 9: 'RED DIAMOND', 10: 'CROWN'
    };

    var RANK_COLOR_MAP = {
        'GUEST': '#94a3b8',
        'MEMBER': '#38bdf8',
        'MANIA': '#4ade80',
        'DIRECTOR': '#fbbf24',
        'EMERALD': '#34d399',
        'DIAMOND': '#a78bfa',
        'GREEN DIAMOND': '#4ade80',
        'BLUE DIAMOND': '#60a5fa',
        'RED DIAMOND': '#f87171',
        'CROWN': '#fcd34d'
    };

    var MAINT_REQ_CV_LIST = [
        { rank: 'CROWN', level: 10, cv: 135000000 },
        { rank: 'RED DIAMOND', level: 9, cv: 65000000 },
        { rank: 'BLUE DIAMOND', level: 8, cv: 34000000 },
        { rank: 'GREEN DIAMOND', level: 7, cv: 19000000 },
        { rank: 'DIAMOND', level: 6, cv: 10000000 },
        { rank: 'EMERALD', level: 5, cv: 3500000 },
        { rank: 'DIRECTOR', level: 4, cv: 2100000 }
    ];

    function detectActiveCanvasModeV35() {
        var firstCard = document.querySelector('.node-card');
        if (firstCard) {
            var cardTxt = String(firstCard.innerText ? firstCard.innerText : '');
            if (/VJ-\d+/i.test(cardTxt)) return 'vj';
            if (/VK-\d+/i.test(cardTxt)) return 'vk';
        }
        var rawMode = String(window.currentCanvasMode ? window.currentCanvasMode : (window.canvasMode ? window.canvasMode : '')).trim().toLowerCase();
        if (rawMode === 'vj') return 'vj';
        if (window.treeData) {
            var rootId = String(window.treeData.id ? window.treeData.id : (window.treeData.member_id ? window.treeData.member_id : '')).trim().toUpperCase();
            if (rootId.indexOf('VJ-') === 0) return 'vj';
        }
        return 'vk';
    }

    function normNumStr(val) {
        if (!val) return '';
        var s = '';
        if (typeof val === 'object') {
            s = val.id ? val.id : (val.member_id ? val.member_id : (val.memberId ? val.memberId : ''));
        } else {
            s = String(val);
        }
        var cleaned = String(s).trim().toLowerCase();
        if (!cleaned ? true : (cleaned === '-')) return '';
        var prefix = '';
        if (cleaned.indexOf('vj') === 0) prefix = 'vj_';
        else if (cleaned.indexOf('vk') === 0) prefix = 'vk_';
        else prefix = detectActiveCanvasModeV35() + '_';

        var numPart = cleaned.replace(/^v[kj]-?0*/, '');
        if (!numPart) numPart = '0';
        return prefix + numPart;
    }

    function parseNum(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        var cleaned = String(val ? val : '').replace(/[^0-9.-]/g, '');
        var n = Number(cleaned);
        return isNaN(n) ? 0 : n;
    }

    function cleanDate(val) {
        if (!val) return '';
        var s = String(val).trim().replace(/[./]/g, '-');
        if (/^\d{4}$/.test(s)) {
            var defaultYear = (detectActiveCanvasModeV35() === 'vj') ? '2027-' : '2026-';
            return defaultYear + s.substring(0, 2) + '-' + s.substring(2, 4);
        }
        if (/^\d{8}$/.test(s)) {
            return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
        }
        var m = s.match(/^(\d{4}-\d{1,2}-\d{1,2})/);
        if (m) {
            var p = m[1].split('-');
            return p[0] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[2]).padStart(2, '0');
        }
        return '';
    }

    function getLastDayOfMonthV35(year, month) {
        return new Date(year, month, 0).getDate();
    }

    // 🌟 임의의 날짜(YYYY-MM-DD)가 속한 반월 기수({ startDate, endDate }) 반환
    function dateStrToHalfMonthPeriodV35(dateStr) {
        var cleaned = cleanDate(dateStr);
        if (!cleaned) return null;
        var p = cleaned.split('-');
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        var d = parseInt(p[2], 10);
        var mPad = String(m).padStart(2, '0');
        if (d <= 15) {
            return {
                startDate: y + '-' + mPad + '-01',
                endDate: y + '-' + mPad + '-15'
            };
        } else {
            var lastD = getLastDayOfMonthV35(y, m);
            return {
                startDate: y + '-' + mPad + '-16',
                endDate: y + '-' + mPad + '-' + String(lastD).padStart(2, '0')
            };
        }
    }

    // 🌟 실제 현재 날짜(new Date()) 문자열 및 해당 반월 기수 산출
    function getTodayRealDateStrV35() {
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function getCurrentRealDatePeriodV35() {
        return dateStrToHalfMonthPeriodV35(getTodayRealDateStrV35());
    }

    // 🌟 최상위 파트너의 가입일(YYYY-MM-DD) 추출 (VJ 모드 등)
    function extractJoinDateFromNodeObjV35(node) {
        if (!node ? true : typeof node !== 'object') return '';
        var raw = node.join_date ? node.join_date
            : (node.joinDate ? node.joinDate
            : (node.reg_date ? node.reg_date
            : (node.regDate ? node.regDate
            : (node.entry_date ? node.entry_date
            : (node.entryDate ? node.entryDate
            : (node.created_at ? node.created_at : node.date))))));
        return cleanDate(raw);
    }

    function getTopMostPartnerJoinDateV35(mode) {
        var targetMode = mode ? mode : detectActiveCanvasModeV35();

        // 1순위: 현재 화면에 렌더링된 최상위 파트너 카드(.node-card)가 해당 모드와 일치하면 카드/노드에서 추출
        var topCard = findTopMostPartnerCard();
        if (topCard) {
            var topCardId = extractMemberIdFromCardEl(topCard);
            var isCardMatchingMode = (targetMode === 'vj') ? (topCardId.indexOf('VJ-') === 0) : (topCardId.indexOf('VK-') === 0);
            if (isCardMatchingMode) {
                var nObj = memberNodeByNormMap.get(normNumStr(topCardId));
                var dFromNode = extractJoinDateFromNodeObjV35(nObj);
                if (dFromNode) return dFromNode;

                if (typeof window.findMemberNode === 'function') {
                    try {
                        var foundN = window.findMemberNode(topCardId);
                        var dFromFound = extractJoinDateFromNodeObjV35(foundN);
                        if (dFromFound) return dFromFound;
                    } catch (e) {}
                }

                // 카드 DOM 내부의 첫 번째 YYYY-MM-DD 날짜(가입일) 추출
                var cardTxt = String(topCard.innerText ? topCard.innerText : '');
                var dateMatches = cardTxt.match(/\d{4}-\d{2}-\d{2}/g);
                if (dateMatches && dateMatches.length > 0) {
                    return dateMatches[0];
                }
            }
        }

        // 2순위: 전역 트리 데이터(vjTreeData / treeData) 루트 노드에서 추출
        var treeRoot = (targetMode === 'vj' && window.vjTreeData) ? window.vjTreeData : window.treeData;
        if (treeRoot) {
            var rootId = String(treeRoot.id ? treeRoot.id : (treeRoot.member_id ? treeRoot.member_id : '')).trim().toUpperCase();
            var rootMatchesMode = (targetMode === 'vj') ? (rootId.indexOf('VJ-') === 0) : (rootId.indexOf('VK-') === 0);
            if (rootMatchesMode) {
                var dFromRoot = extractJoinDateFromNodeObjV35(treeRoot);
                if (dFromRoot) return dFromRoot;
            }
        }

        // 3순위: 플랫 회원 배열(vjFlatMembersData / flatMembersData / membersData)의 최상위(루트) 회원에서 추출
        var flatLists = [window.vjFlatMembersData, window.flatMembersData, window.membersData];
        for (var i = 0; i < flatLists.length; i++) {
            var arr = flatLists[i];
            if (!Array.isArray(arr) ? true : arr.length === 0) continue;
            var modeMembers = arr.filter(function(m) {
                if (!m) return false;
                var mid = String(m.id ? m.id : (m.member_id ? m.member_id : (m.memberId ? m.memberId : ''))).trim().toUpperCase();
                return (targetMode === 'vj') ? (mid.indexOf('VJ-') === 0) : (mid.indexOf('VK-') === 0);
            });
            if (modeMembers.length > 0) {
                // 부모/후원인이 없거나 가장 첫 번째 등록된 최상위 멤버 탐색
                var rootMember = modeMembers.find(function(m) {
                    var p = m.parent_id ? m.parent_id : (m.sponsor_id ? m.sponsor_id : '');
                    return !p || String(p).trim() === '' || String(p).trim() === '-';
                }) || modeMembers[0];
                var dFromFlat = extractJoinDateFromNodeObjV35(rootMember);
                if (dFromFlat) return dFromFlat;
            }
        }

        return '';
    }

    // 🌟 모드별 기본 기간 결정 규칙:
    // - VK 모드: 현재 날짜(new Date())에 해당하는 반월 기수
    // - VJ 모드: 최상위 파트너의 가입일 기준 반월 기수. 단, 실제 현재 날짜가 최상위 파트너의 가입일을 지났다면 VK 모드와 동일하게 현재 날짜 기준 기수!
    function getDefaultPeriodForModeV35(mode) {
        var activeMode = mode ? mode : detectActiveCanvasModeV35();
        var currentRealPeriod = getCurrentRealDatePeriodV35();

        if (activeMode !== 'vj') {
            return currentRealPeriod;
        }

        var topJoinDate = getTopMostPartnerJoinDateV35('vj');
        if (!topJoinDate) {
            return currentRealPeriod;
        }

        var todayStr = getTodayRealDateStrV35();
        // 실제 날짜가 최상위 파트너의 가입일을 지났다면 현재 날짜에 해당하는 기수로 표시
        if (todayStr > topJoinDate) {
            return currentRealPeriod;
        }

        var joinPeriod = dateStrToHalfMonthPeriodV35(topJoinDate);
        return joinPeriod ? joinPeriod : currentRealPeriod;
    }

    function isEntryMatchingCurrentMode(rawId) {
        var up = String(rawId ? rawId : '').trim().toUpperCase();
        if (!up) return false;
        var activeMode = detectActiveCanvasModeV35();
        if (activeMode === 'vj') {
            if (up.indexOf('VK-') === 0) return false;
            return true;
        } else {
            if (up.indexOf('VJ-') === 0) return false;
            return true;
        }
    }

    function getAllActiveSalesArray() {
        var activeMode = detectActiveCanvasModeV35();
        var primaryArr = null;

        if (activeMode === 'vj') {
            if (Array.isArray(window.vjSalesData) && window.vjSalesData.length > 0) {
                primaryArr = window.vjSalesData;
            } else if (Array.isArray(window.allVjSalesData) && window.allVjSalesData.length > 0) {
                primaryArr = window.allVjSalesData;
            }
        }

        if (!primaryArr) {
            if (Array.isArray(window.allSalesData) && window.allSalesData.length > 0) {
                primaryArr = window.allSalesData;
            } else if (Array.isArray(window.integrated_sales_history) && window.integrated_sales_history.length > 0) {
                primaryArr = window.integrated_sales_history;
            } else if (Array.isArray(window.salesData) && window.salesData.length > 0) {
                primaryArr = window.salesData;
            }
        }

        if (!Array.isArray(primaryArr)) return [];

        var filtered = [];
        var seenObj = new Set();
        var seenSaleId = new Set();

        for (var i = 0; i < primaryArr.length; i++) {
            var item = primaryArr[i];
            if (!item ? true : seenObj.has(item)) continue;
            seenObj.add(item);

            var rawMid = String(item.member_id ? item.member_id : (item.memberId ? item.memberId : (item.id ? item.id : ''))).trim();
            if (rawMid && !isEntryMatchingCurrentMode(rawMid)) continue;

            var explicitSaleId = item.sale_id ? item.sale_id : (item.sales_id ? item.sales_id : (item.history_id ? item.history_id : (item.id && item.member_id ? item.id : '')));
            if (explicitSaleId) {
                var sKey = String(explicitSaleId).trim();
                if (seenSaleId.has(sKey)) continue;
                seenSaleId.add(sKey);
            }

            filtered.push(item);
        }
        return filtered;
    }

    function extractMemberIdFromCardEl(cardEl) {
        if (!cardEl) return '';
        var cachedAttr = cardEl.getAttribute('data-member-id');
        if (cachedAttr && /V[KJ]-\d+/i.test(cachedAttr)) {
            return cachedAttr.trim().toUpperCase();
        }
        var txt = String(cardEl.innerText ? cardEl.innerText : '');
        var matches = txt.match(/V[KJ]-\d+/gi);
        if (matches && matches.length > 0) {
            var foundId = matches[0].toUpperCase();
            cardEl.setAttribute('data-member-id', foundId);
            return foundId;
        }
        if (cardEl.id && /V[KJ]-\d+/i.test(cardEl.id)) {
            var m0 = cardEl.id.match(/(V[KJ]-\d+)/i);
            if (m0 && m0[1]) {
                var id0 = m0[1].toUpperCase();
                cardEl.setAttribute('data-member-id', id0);
                return id0;
            }
        }
        return '';
    }

    function extractMemberNameFromCardEl(cardEl, cleanId) {
        if (!cardEl) return '';
        var lines = String(cardEl.innerText ? cardEl.innerText : '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].toUpperCase() === cleanId && i + 1 < lines.length) {
                var candidate = lines[i + 1];
                if (KNOWN_RANKS.indexOf(candidate.toUpperCase()) === -1) {
                    return candidate;
                }
            }
        }
        return '';
    }

    function extractRankFromCardDOM(cardEl, fallbackRank) {
        if (cardEl) {
            var leafEls = cardEl.querySelectorAll('div, span');
            for (var i = 0; i < leafEls.length; i++) {
                var el = leafEls[i];
                if (el.children.length > 0) continue;
                if (el.closest('.bs-custom-badge-layer-v44') ? true : el.closest('.bs-card-top-badges')) continue;
                var txt = String(el.innerText ? el.innerText : '').trim().toUpperCase();
                if (KNOWN_RANKS.indexOf(txt) !== -1) {
                    return txt;
                }
            }
        }
        return fallbackRank ? String(fallbackRank).trim().toUpperCase() : 'GUEST';
    }

    function enforceCardDOMRankTitleV35(cardEl, mNorm, targetRankName, sortKeyNum) {
        if (!cardEl ? true : !targetRankName) return;
        var finalRank = String(targetRankName).trim().toUpperCase();
        if (mNorm && sortKeyNum) {
            periodRankByNormMap.set(sortKeyNum + '_' + mNorm, finalRank);
        }

        if (cardEl.getAttribute('data-rank') !== finalRank) {
            cardEl.setAttribute('data-rank', finalRank);
        }

        var leafEls = cardEl.querySelectorAll('div, span');
        for (var i = 0; i < leafEls.length; i++) {
            var el = leafEls[i];
            if (el.children.length > 0) continue;
            if (el.closest('.bs-custom-badge-layer-v44') ? true : el.closest('.bs-card-top-badges')) continue;
            var txt = String(el.innerText ? el.innerText : '').trim().toUpperCase();
            if (KNOWN_RANKS.indexOf(txt) !== -1) {
                if (txt !== finalRank) {
                    el.innerText = finalRank;
                }
                if (RANK_COLOR_MAP[finalRank]) {
                    el.style.setProperty('color', RANK_COLOR_MAP[finalRank], 'important');
                }
                break;
            }
        }
    }

    function fastApplyCachedRanksAndBadgesToAllCardsV35() {
        if (isEnforcingDomSync) return;
        var cards = document.querySelectorAll('.node-card');
        if (!cards ? true : cards.length === 0) return;

        var pKeys = getActiveHeaderPeriodKeysV44();
        var topCard = findTopMostPartnerCard();
        var topMostNormId = topCard ? normNumStr(extractMemberIdFromCardEl(topCard)) : '';

        isEnforcingDomSync = true;
        try {
            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                var memberId = extractMemberIdFromCardEl(card);
                if (!memberId) continue;
                var mNorm = normNumStr(memberId);
                var pKey = pKeys.sortKeyNum + '_' + mNorm;

                if (periodRankByNormMap.has(pKey)) {
                    var cachedRank = periodRankByNormMap.get(pKey);
                    enforceCardDOMRankTitleV35(card, mNorm, cachedRank, pKeys.sortKeyNum);
                }

                var oldBadges = card.querySelectorAll('.bs-card-top-badges');
                for (var o = 0; o < oldBadges.length; o++) {
                    if (oldBadges[o].style.display !== 'none') oldBadges[o].style.display = 'none';
                }

                if (cachedBadgeHtmlByPeriodAndNormMap.has(pKey)) {
                    var badgeInfo = cachedBadgeHtmlByPeriodAndNormMap.get(pKey);
                    var badgeWrap = card.querySelector('.bs-custom-badge-layer-v44');
                    if (!badgeInfo ? true : !badgeInfo.html) {
                        if (badgeWrap) badgeWrap.remove();
                    } else {
                        card.style.setProperty('overflow', 'visible', 'important');
                        if (!badgeWrap) {
                            badgeWrap = document.createElement('div');
                            badgeWrap.className = 'bs-custom-badge-layer-v44';
                            card.appendChild(badgeWrap);
                        }
                        badgeWrap.setAttribute('data-badge-member-id', memberId);

                        var isTopMost = (mNorm === topMostNormId);
                        var targetCss = isTopMost
                            ? 'position:absolute !important; top:6px !important; left:calc(100% + 5px) !important; display:flex !important; flex-direction:column !important; gap:4px !important; z-index:999 !important; pointer-events:auto !important;'
                            : 'position:absolute !important; top:-9px !important; left:-2px !important; right:-2px !important; width:calc(100% + 4px) !important; display:flex !important; flex-direction:row !important; justify-content:' + badgeInfo.justify + ' !important; z-index:999 !important; pointer-events:auto !important;';

                        if (badgeWrap.style.cssText !== targetCss) {
                            badgeWrap.style.cssText = targetCss;
                        }
                        if (badgeWrap.innerHTML !== badgeInfo.html) {
                            badgeWrap.innerHTML = badgeInfo.html;
                        }
                    }
                }
            }
        } finally {
            isEnforcingDomSync = false;
        }
    }

    // ========================================================================
    // [42] 최상위 파트너 카드 위쪽으로 마우스 드래그 및 휠 스크롤 이동 완전 차단
    // ========================================================================
    var TOP_CEILING_GAP_PX = 28;

    function findTopMostPartnerCard() {
        var cards = document.querySelectorAll('.node-card');
        if (!cards ? true : cards.length === 0) return null;
        var topCard = null;
        var minTop = Infinity;
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (c.offsetParent === null) continue;
            var rect = c.getBoundingClientRect();
            if (rect.height === 0 && rect.width === 0) continue;
            if (rect.top < minTop) {
                minTop = rect.top;
                topCard = c;
            }
        }
        return topCard;
    }

    function getCanvasViewportAndLayer(topCard) {
        if (!topCard) return null;
        var transformedLayer = null;
        var scrollableContainer = null;
        var curr = topCard.parentElement;

        while (curr && curr !== document.body && curr !== document.documentElement) {
            var style = window.getComputedStyle(curr);
            var inlineTf = curr.style && curr.style.transform ? curr.style.transform : '';
            var compTf = style.transform ? style.transform : '';
            if (!transformedLayer && ((inlineTf && inlineTf !== 'none') ? true : (compTf && compTf !== 'none'))) {
                transformedLayer = curr;
            }
            if (!scrollableContainer && (curr.scrollHeight > curr.clientHeight + 2) && (style.overflowY === 'auto' ? true : (style.overflowY === 'scroll'))) {
                scrollableContainer = curr;
            }
            curr = curr.parentElement;
        }

        if (!transformedLayer) {
            var tc = document.getElementById('treeContainer');
            if (tc) {
                var tcTf = window.getComputedStyle(tc).transform;
                if (tcTf && tcTf !== 'none') {
                    transformedLayer = tc;
                } else if (tc.firstElementChild) {
                    var childTf = window.getComputedStyle(tc.firstElementChild).transform;
                    if (childTf && childTf !== 'none') transformedLayer = tc.firstElementChild;
                }
            }
        }

        if (!transformedLayer) {
            transformedLayer = topCard.parentElement;
        }
        var scrollViewport = scrollableContainer
            ? scrollableContainer
            : ((transformedLayer && transformedLayer.parentElement) ? transformedLayer.parentElement : document.body);

        return { layer: transformedLayer, viewport: scrollViewport, scrollable: scrollableContainer };
    }

    function getViewportTopBoundaryY(viewportEl) {
        var ceilingY = 56 + TOP_CEILING_GAP_PX;
        var headerEl = document.querySelector('header, .header, .top-bar');
        if (headerEl) {
            var hRect = headerEl.getBoundingClientRect();
            if (hRect.bottom > 0 && hRect.bottom < 160) {
                ceilingY = hRect.bottom + TOP_CEILING_GAP_PX;
            }
        }
        if (viewportEl && viewportEl !== document.body) {
            var vRect = viewportEl.getBoundingClientRect();
            var vTopWithGap = vRect.top + TOP_CEILING_GAP_PX;
            if (vTopWithGap > ceilingY) ceilingY = vTopWithGap;
        }
        return ceilingY;
    }

    function applyClampedTranslateY(layerEl, deltaY) {
        if (!layerEl) return;
        var compStyle = window.getComputedStyle(layerEl);
        var matrixStr = compStyle.transform;
        if (!matrixStr ? true : (matrixStr === 'none')) return;
        var match = matrixStr.match(/matrix\(([^)]+)\)/);
        if (!match ? true : !match[1]) return;
        var parts = match[1].split(',').map(function(v) { return parseFloat(v.trim()); });
        if (parts.length < 6) return;

        var scaleX = parts[0];
        var skewY = parts[1];
        var skewX = parts[2];
        var scaleY = parts[3];
        var tx = parts[4];
        var newTy = Math.round((parts[5] - deltaY) * 100) / 100;

        if (typeof window.panY === 'number') window.panY = newTy;
        if (typeof window.translateY === 'number') window.translateY = newTy;
        if (typeof window.pointY === 'number') window.pointY = newTy;
        if (typeof window.offsetY === 'number') window.offsetY = newTy;
        if (typeof window.canvasY === 'number') window.canvasY = newTy;
        if (window.panState && typeof window.panState.y === 'number') window.panState.y = newTy;
        if (window.viewState && typeof window.viewState.y === 'number') window.viewState.y = newTy;

        var inlineTf = String(layerEl.style.transform ? layerEl.style.transform : '');
        isClampingTransform = true;
        try {
            if (skewY === 0 && skewX === 0 && Math.abs(scaleX - scaleY) < 0.0001) {
                if (inlineTf.indexOf('translate3d') !== -1) {
                    layerEl.style.transform = 'translate3d(' + tx + 'px, ' + newTy + 'px, 0px) scale(' + scaleX + ')';
                } else {
                    layerEl.style.transform = 'translate(' + tx + 'px, ' + newTy + 'px) scale(' + scaleX + ')';
                }
            } else {
                layerEl.style.transform = 'matrix(' + scaleX + ', ' + skewY + ', ' + skewX + ', ' + scaleY + ', ' + tx + ', ' + newTy + ')';
            }
        } finally {
            isClampingTransform = false;
        }
    }

    window.clampCanvasTopPartnerBoundaryV42 = function() {
        if (isClampingTransform ? true : navDragState.isDragging) return;
        var topCard = findTopMostPartnerCard();
        if (!topCard) return;
        var ctx = getCanvasViewportAndLayer(topCard);
        if (!ctx) return;

        var ceilingY = getViewportTopBoundaryY(ctx.viewport);
        var cardRect = topCard.getBoundingClientRect();
        var overDraggedDownPx = cardRect.top - ceilingY;

        if (overDraggedDownPx > 0.5) {
            if (ctx.scrollable && ctx.scrollable.scrollTop < overDraggedDownPx) {
                ctx.scrollable.scrollTop += overDraggedDownPx;
            }
            if (ctx.layer) {
                applyClampedTranslateY(ctx.layer, overDraggedDownPx);
            }
        }
    };

    function ensureTreeContainerMutationObserverV35() {
        var container = document.getElementById('treeContainer') || document.body;
        if (activeTreeObserver && observedTreeContainerEl === container) return;

        if (activeTreeObserver) {
            try { activeTreeObserver.disconnect(); } catch (e) {}
        }

        observedTreeContainerEl = container;
        activeTreeObserver = new MutationObserver(function(mutations) {
            var needsRankRestore = false;
            var needsCeilingClamp = false;

            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'attributes' && m.attributeName === 'style' && !isClampingTransform) {
                    needsCeilingClamp = true;
                } else if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0 && !isEnforcingDomSync) {
                    needsRankRestore = true;
                    needsCeilingClamp = true;
                } else if (m.type === 'characterData' && !isEnforcingDomSync) {
                    var parentEl = m.target && m.target.parentElement;
                    if (parentEl && parentEl.closest && parentEl.closest('.node-card') && !parentEl.closest('.bs-custom-badge-layer-v44')) {
                        needsRankRestore = true;
                    }
                }
            }

            if (needsRankRestore) {
                fastApplyCachedRanksAndBadgesToAllCardsV35();
            }
            if (needsCeilingClamp) {
                window.clampCanvasTopPartnerBoundaryV42();
            }
        });

        activeTreeObserver.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['style']
        });
    }

    // ========================================================================
    // 🌟 [Version-3.5 핵심] VK / VJ 모드별 독립 기간 동기화 및 기본 기수 적용 컨트롤러
    // ========================================================================
    function getHeaderDateInputPairV35() {
        var allInputs = Array.from(document.querySelectorAll('input'));
        var topCandidates = [];

        for (var i = 0; i < allInputs.length; i++) {
            var inp = allInputs[i];
            if (inp.type === 'hidden' ? true : (inp.type === 'checkbox' ? true : (inp.type === 'radio'))) continue;
            if (inp.closest('#bizNavModal') ? true : inp.closest('#bs-line-move-custom-modal-v43')) continue;

            var rect = inp.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.top < -5 ? true : (rect.top > 110)) continue;

            var ph = String(inp.getAttribute('placeholder') ? inp.getAttribute('placeholder') : '');
            var idStr = String(inp.id ? inp.id : '');
            var nameStr = String(inp.name ? inp.name : '');
            var combinedMeta = (ph + ' ' + idStr + ' ' + nameStr).toLowerCase();

            if (combinedMeta.indexOf('계보도') !== -1 ? true : (combinedMeta.indexOf('회원') !== -1 ? true : (combinedMeta.indexOf('member') !== -1))) {
                continue;
            }

            topCandidates.push({ el: inp, left: rect.left, meta: combinedMeta, val: String(inp.value ? inp.value : '').trim() });
        }

        if (topCandidates.length < 2) return null;
        topCandidates.sort(function(a, b) { return a.left - b.left; });

        var dateFormatted = topCandidates.filter(function(c) {
            return /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(c.val) ? true : (/^\d{4}$/.test(c.val) ? true : /^\d{8}$/.test(c.val));
        });
        if (dateFormatted.length >= 2) {
            return { startInput: dateFormatted[0].el, endInput: dateFormatted[1].el };
        }

        var metaMatched = topCandidates.filter(function(c) {
            return /date|start|end|from|to|period|시작|종료|기수|yyyy/i.test(c.meta);
        });
        if (metaMatched.length >= 2) {
            return { startInput: metaMatched[0].el, endInput: metaMatched[1].el };
        }

        return { startInput: topCandidates[0].el, endInput: topCandidates[1].el };
    }

    function normalizeUserDateTextV35(rawStr, referenceYearStr) {
        var s = String(rawStr ? rawStr : '').trim();
        if (!s) return '';
        var refYear = (referenceYearStr && /^\d{4}$/.test(referenceYearStr))
            ? referenceYearStr
            : ((detectActiveCanvasModeV35() === 'vj') ? '2027' : '2026');

        if (/^\d{4}$/.test(s)) {
            var mm = parseInt(s.substring(0, 2), 10);
            var dd = parseInt(s.substring(2, 4), 10);
            if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                var maxD = getLastDayOfMonthV35(parseInt(refYear, 10), mm);
                if (dd > maxD) dd = maxD;
                return refYear + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
            }
        }
        return cleanDate(s);
    }

    function shiftHalfMonthPeriodV35(currStartStr, currEndStr, deltaHalfMonths) {
        var baseStr = cleanDate(currEndStr) ? cleanDate(currEndStr) : cleanDate(currStartStr);
        if (!baseStr) {
            var defP = getDefaultPeriodForModeV35(detectActiveCanvasModeV35());
            baseStr = defP.endDate;
        }
        var parts = baseStr.split('-');
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        var d = parseInt(parts[2], 10);
        var halfIdx = (d <= 15) ? 0 : 1;

        var totalHalves = (y * 24) + ((m - 1) * 2) + halfIdx + deltaHalfMonths;
        var newY = Math.floor(totalHalves / 24);
        var rem = totalHalves % 24;
        if (rem < 0) { rem += 24; newY -= 1; }
        var newM = Math.floor(rem / 2) + 1;
        var newHalf = rem % 2;

        var mPadded = String(newM).padStart(2, '0');
        var newStart = newY + '-' + mPadded + '-' + (newHalf === 0 ? '01' : '16');
        var endDay = (newHalf === 0) ? '15' : String(getLastDayOfMonthV35(newY, newM)).padStart(2, '0');
        var newEnd = newY + '-' + mPadded + '-' + endDay;

        return { startDate: newStart, endDate: newEnd };
    }

    function setNativeInputValueSafelyV35(inpEl, newVal) {
        if (!inpEl ? true : !newVal) return;
        isProgrammaticDateUpdate = true;
        try {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            if (nativeSetter && nativeSetter.set) {
                nativeSetter.set.call(inpEl, newVal);
            } else {
                inpEl.value = newVal;
            }
            inpEl.setAttribute('value', newVal);
            inpEl.dispatchEvent(new Event('input', { bubbles: true }));
            inpEl.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            inpEl.value = newVal;
        } finally {
            setTimeout(function() { isProgrammaticDateUpdate = false; }, 10);
        }
    }

    // 🌟 현재 활성 모드(VK 또는 VJ)에 맞는 기간이 헤더에 설정되어 있는지 확인하고,
    //    모드가 전환되었거나 초기 로드 시 각 모드의 기본 기간을 독립적으로 적용!
    function syncHeaderPeriodForActiveModeV35(forceResetToDefault) {
        var activeMode = detectActiveCanvasModeV35();
        var pair = getHeaderDateInputPairV35();
        if (!pair) return;

        var modeChanged = (activeMode !== lastAppliedCanvasModeV35);
        if (!forceResetToDefault && !modeChanged) {
            // 비동기 로드 직후 VJ 최상위 파트너 가입일이 뒤늦게 확보된 경우, 사용자가 수동 변경하지 않았다면 기본 기수로 보정
            if (activeMode === 'vj' && !userManuallyChangedPeriodV35.vj) {
                var freshDefVj = getDefaultPeriodForModeV35('vj');
                var storedVj = modePeriodStoreV35.vj;
                if (!storedVj ? true : (storedVj.startDate !== freshDefVj.startDate ? true : (storedVj.endDate !== freshDefVj.endDate))) {
                    modePeriodStoreV35.vj = freshDefVj;
                    window.applyTimeSlipPeriodChangeV35(freshDefVj.startDate, freshDefVj.endDate, false);
                }
            }
            return;
        }

        lastAppliedCanvasModeV35 = activeMode;

        // 해당 모드에서 사용자가 수동으로 변경해둔 기간이 있으면 그 값을 복원하고, 없으면 해당 모드의 기본 기간 계산
        var targetPeriod = (!forceResetToDefault && userManuallyChangedPeriodV35[activeMode] && modePeriodStoreV35[activeMode])
            ? modePeriodStoreV35[activeMode]
            : getDefaultPeriodForModeV35(activeMode);

        modePeriodStoreV35[activeMode] = targetPeriod;
        window.applyTimeSlipPeriodChangeV35(targetPeriod.startDate, targetPeriod.endDate, false);
    }

    window.applyTimeSlipPeriodChangeV35 = function(newStartDate, newEndDate, isManualUserAction) {
        var activeMode = detectActiveCanvasModeV35();
        var pair = getHeaderDateInputPairV35();
        var refYear = '';
        if (pair && pair.startInput && /^\d{4}-/.test(pair.startInput.value)) {
            refYear = pair.startInput.value.substring(0, 4);
        } else {
            refYear = (activeMode === 'vj') ? '2027' : '2026';
        }

        var normStart = normalizeUserDateTextV35(newStartDate, refYear);
        var normEnd = normalizeUserDateTextV35(newEndDate, normStart ? normStart.substring(0, 4) : refYear);

        if (normStart && !normEnd) {
            var sp = normStart.split('-');
            var isFH = parseInt(sp[2], 10) <= 15;
            normEnd = sp[0] + '-' + sp[1] + '-' + (isFH ? '15' : String(getLastDayOfMonthV35(parseInt(sp[0], 10), parseInt(sp[1], 10))).padStart(2, '0'));
        } else if (!normStart && normEnd) {
            var ep = normEnd.split('-');
            var isFH2 = parseInt(ep[2], 10) <= 15;
            normStart = ep[0] + '-' + ep[1] + '-' + (isFH2 ? '01' : '16');
        }

        if (pair && normStart && normEnd) {
            if (pair.startInput.value !== normStart) setNativeInputValueSafelyV35(pair.startInput, normStart);
            if (pair.endInput.value !== normEnd) setNativeInputValueSafelyV35(pair.endInput, normEnd);
        }

        var activeStart = normStart ? normStart : (pair ? cleanDate(pair.startInput.value) : '');
        var activeEnd = normEnd ? normEnd : (pair ? cleanDate(pair.endInput.value) : '');

        if (activeStart && activeEnd) {
            modePeriodStoreV35[activeMode] = { startDate: activeStart, endDate: activeEnd };
            if (isManualUserAction !== false) {
                userManuallyChangedPeriodV35[activeMode] = true;
            }
        }

        if (activeStart) {
            window.currentStartDate = activeStart;
            window.filterStartDate = activeStart;
            window.selectedStartDate = activeStart;
        }
        if (activeEnd) {
            window.currentEndDate = activeEnd;
            window.filterEndDate = activeEnd;
            window.selectedEndDate = activeEnd;
        }

        indexedPeriodKey = '';
        computedMetricsByNormMap.clear();
        lastDomBadgeRenderSig = '';

        window.renderTreeCardStatusBadgesV44(true);

        if (window.currentSelectedId) {
            if (typeof window.calculateLocalPerformance === 'function') {
                try { window.calculateLocalPerformance(window.currentSelectedId); } catch (e) {}
            } else if (typeof window.updatePerformanceTable === 'function') {
                try { window.updatePerformanceTable(window.currentSelectedId); } catch (e) {}
            }
            fastApplyCachedRanksAndBadgesToAllCardsV35();
        }

        var navModal = document.getElementById('bizNavModal');
        if (navModal && navModal.style.display !== 'none' && window.currentSelectedId) {
            window.openInstantNavigatorV35(window.currentSelectedId);
        }
    };

    function isHeaderPeriodNavButtonV35(targetEl) {
        if (!targetEl ? true : !targetEl.closest) return null;
        var btn = targetEl.closest('button, a, span[role="button"], div[role="button"]');
        if (!btn) return null;
        if (btn.closest('#bizNavModal') ? true : btn.closest('#bs-line-move-custom-modal-v43')) return null;
        var rect = btn.getBoundingClientRect();
        if (rect.top > 110) return null;

        var txt = String(btn.innerText ? btn.innerText : '').replace(/\s+/g, '');
        if (txt.indexOf('이전') !== -1 && (txt.indexOf('◀') !== -1 ? true : txt.length <= 5)) {
            return { btn: btn, dir: -1 };
        }
        if (txt.indexOf('다음') !== -1 && (txt.indexOf('▶') !== -1 ? true : txt.length <= 5)) {
            return { btn: btn, dir: 1 };
        }
        return null;
    }

    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' ? true : (e.keyCode === 27)) {
            var navModal = document.getElementById('bizNavModal');
            if (navModal && navModal.style.display !== 'none') {
                window.closeInstantNavigatorV35();
            }
            return;
        }
        if (e.key === 'Enter' ? true : (e.keyCode === 13)) {
            var pair = getHeaderDateInputPairV35();
            if (pair && (e.target === pair.startInput ? true : (e.target === pair.endInput))) {
                e.preventDefault();
                e.stopPropagation();
                window.applyTimeSlipPeriodChangeV35(pair.startInput.value, pair.endInput.value, true);
            }
        }
    }, true);

    window.addEventListener('change', function(e) {
        if (isProgrammaticDateUpdate) return;
        var t = e.target;
        if (!t) return;

        var pair = getHeaderDateInputPairV35();
        if (pair && (t === pair.startInput ? true : (t === pair.endInput))) {
            window.applyTimeSlipPeriodChangeV35(pair.startInput.value, pair.endInput.value, true);
            return;
        }

        if (t.tagName === 'SELECT') {
            var rect = t.getBoundingClientRect();
            if (rect.top >= 0 && rect.top <= 110) {
                var opt = t.options && t.selectedIndex >= 0 ? t.options[t.selectedIndex] : null;
                var optVal = opt ? String(opt.value ? opt.value : '') : '';
                var optTxt = opt ? String(opt.text ? opt.text : '') : '';

                setTimeout(function() {
                    var pNow = getHeaderDateInputPairV35();
                    var activeMode = detectActiveCanvasModeV35();

                    var rangeMatches = (optVal + ' ' + optTxt).match(/\d{4}-\d{2}-\d{2}/g);
                    if (rangeMatches && rangeMatches.length >= 2) {
                        window.applyTimeSlipPeriodChangeV35(rangeMatches[0], rangeMatches[1], true);
                        return;
                    }

                    if (optTxt.indexOf('이번') !== -1) {
                        userManuallyChangedPeriodV35[activeMode] = false;
                        var defP = getDefaultPeriodForModeV35(activeMode);
                        window.applyTimeSlipPeriodChangeV35(defP.startDate, defP.endDate, false);
                    } else if (optTxt.indexOf('지난') !== -1 ? true : (optTxt.indexOf('전월') !== -1 ? true : (optTxt.indexOf('이전') !== -1))) {
                        var curModeStore = modePeriodStoreV35[activeMode] ? modePeriodStoreV35[activeMode] : getDefaultPeriodForModeV35(activeMode);
                        var shifted = shiftHalfMonthPeriodV35(curModeStore.startDate, curModeStore.endDate, -1);
                        window.applyTimeSlipPeriodChangeV35(shifted.startDate, shifted.endDate, true);
                    } else if (pNow) {
                        window.applyTimeSlipPeriodChangeV35(pNow.startInput.value, pNow.endInput.value, true);
                    }
                }, 25);
            }
        }
    }, true);

    // ========================================================================
    // [43] 파트너 라인 이동 다크 테마 모달창 (window.prompt 가로채기)
    // ========================================================================
    function saveMovedPartnerFocusState(movedId, sponsorId) {
        if (!movedId) return;
        try {
            localStorage.setItem(MOVED_STATE_KEY, JSON.stringify({
                movedId: String(movedId).trim().toUpperCase(),
                sponsorId: sponsorId ? String(sponsorId).trim().toUpperCase() : '',
                timestamp: Date.now()
            }));
        } catch (e) {}
    }

    window.focusAndCenterOnMovedPartnerV43 = function(movedId) {
        if (!movedId) return;
        var targetId = String(movedId).trim().toUpperCase();
        window.currentSelectedId = targetId;
        if (typeof window.executeNodeSingleClick === 'function') {
            try { window.executeNodeSingleClick(targetId); } catch (e) {}
        }
        var cards = Array.from(document.querySelectorAll('.node-card'));
        var cardEl = cards.find(function(c) { return extractMemberIdFromCardEl(c) === targetId; });
        if (!cardEl) return;

        document.querySelectorAll('.node-card.selected, .node-card.active').forEach(function(el) {
            if (el !== cardEl) el.classList.remove('selected', 'active');
        });
        cardEl.classList.add('selected');

        var cardRect = cardEl.getBoundingClientRect();
        var ctx = getCanvasViewportAndLayer(cardEl);
        if (ctx && ctx.layer && ctx.viewport) {
            var vpRect = ctx.viewport.getBoundingClientRect();
            var shiftX = (vpRect.left + vpRect.width / 2) - (cardRect.left + cardRect.width / 2);
            var shiftY = (vpRect.top + vpRect.height * 0.38) - (cardRect.top + cardRect.height / 2);
            var match = window.getComputedStyle(ctx.layer).transform.match(/matrix\(([^)]+)\)/);
            if (match && match[1]) {
                var parts = match[1].split(',').map(function(v) { return parseFloat(v.trim()); });
                if (parts.length >= 6) {
                    var newTx = Math.round((parts[4] + shiftX) * 100) / 100;
                    var newTy = Math.round((parts[5] + shiftY) * 100) / 100;
                    if (typeof window.panX === 'number') window.panX = newTx;
                    if (typeof window.panY === 'number') window.panY = newTy;
                    ctx.layer.style.transform = 'translate(' + newTx + 'px, ' + newTy + 'px) scale(' + parts[0] + ')';
                    window.clampCanvasTopPartnerBoundaryV42();
                }
            }
        }
    };

    window.addEventListener('drop', function(e) {
        var cardEl = e.target && e.target.closest ? e.target.closest('.node-card, .empty-slot, [data-member-id]') : e.target;
        lastInteractionContext = {
            type: 'drop',
            target: cardEl ? cardEl : e.target,
            dataTransfer: e.dataTransfer,
            draggedMemberId: window.draggedMemberId,
            currentDraggedId: window.currentDraggedId,
            draggingNodeId: window.draggingNodeId
        };
    }, true);

    function replayLastInteraction(movedId, sponsorId) {
        if (!lastInteractionContext ? true : !lastInteractionContext.target) return;
        if (movedId) saveMovedPartnerFocusState(movedId, sponsorId);
        if (lastInteractionContext.draggedMemberId !== undefined) window.draggedMemberId = lastInteractionContext.draggedMemberId;
        if (lastInteractionContext.currentDraggedId !== undefined) window.currentDraggedId = lastInteractionContext.currentDraggedId;
        if (lastInteractionContext.draggingNodeId !== undefined) window.draggingNodeId = lastInteractionContext.draggingNodeId;

        if (lastInteractionContext.type === 'drop') {
            try {
                var replayDrop = new CustomEvent('drop', { bubbles: true, cancelable: true });
                if (lastInteractionContext.dataTransfer) {
                    Object.defineProperty(replayDrop, 'dataTransfer', { value: lastInteractionContext.dataTransfer });
                }
                lastInteractionContext.target.dispatchEvent(replayDrop);
            } catch (err) {}
        }
        indexedSalesCount = -1;
        periodRankByNormMap.clear();
        cachedBadgeHtmlByPeriodAndNormMap.clear();
        if (movedId) {
            setTimeout(function() { window.focusAndCenterOnMovedPartnerV43(movedId); }, 120);
        }
    }

    window.openLineSelectPromptModalV43 = function(questionText, defaultVal, onSelectCallback) {
        var existing = document.getElementById('bs-line-move-custom-modal-v43');
        if (existing) existing.remove();

        var msg = String(questionText ? questionText : '').trim();
        var idMatches = msg.match(/V[KJ]-\d+/gi);
        var sourceId = (idMatches && idMatches.length >= 1) ? idMatches[0].toUpperCase() : '';
        var targetSponsorId = (idMatches && idMatches.length >= 2) ? idMatches[1].toUpperCase() : '';
        var selectedLine = 'A';

        var overlay = document.createElement('div');
        overlay.id = 'bs-line-move-custom-modal-v43';
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(2px); z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:16px;';
        overlay.innerHTML = [
            '<div style="width:450px; max-width:95vw; background:#111827; border:1.5px solid #3b82f6; border-radius:12px; box-shadow:0 25px 60px rgba(0,0,0,0.9); overflow:hidden;">',
            '  <div style="height:44px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 16px; color:#f8fafc; font-size:13.5px; font-weight:800;">',
            '    <span>🔀 파트너 산하 라인 이동 배치</span>',
            '    <button type="button" id="bs-line-x-v35" style="background:transparent;border:none;color:#94a3b8;font-size:15px;cursor:pointer;">✕</button>',
            '  </div>',
            '  <div style="padding:16px 18px;">',
            '    <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:12px; margin-bottom:14px; color:#e2e8f0; font-size:13px; text-align:center; font-weight:700;">' + msg + '</div>',
            '    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">',
            '      <button type="button" id="bs-btn-line-a-v35" style="padding:12px; border-radius:8px; border:2px solid #60a5fa; background:rgba(37,99,235,0.28); color:#fff; font-weight:800; cursor:pointer;">👈 A 라인 (좌측)</button>',
            '      <button type="button" id="bs-btn-line-b-v35" style="padding:12px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#94a3b8; font-weight:800; cursor:pointer;">👉 B 라인 (우측)</button>',
            '    </div>',
            '  </div>',
            '  <div style="display:flex; justify-content:flex-end; gap:8px; padding:10px 18px 14px; background:#0f172a; border-top:1px solid #1e293b;">',
            '    <button type="button" id="bs-line-cancel-v35" style="padding:8px 16px; background:#334155; border:1px solid #475569; color:#e2e8f0; border-radius:6px; font-size:12.5px; font-weight:700; cursor:pointer;">취소</button>',
            '    <button type="button" id="bs-line-ok-v35" style="padding:8px 18px; background:#2563eb; border:1px solid #60a5fa; color:#fff; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer;">이동 실행</button>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var btnA = document.getElementById('bs-btn-line-a-v35');
        var btnB = document.getElementById('bs-btn-line-b-v35');
        btnA.onclick = function() {
            selectedLine = 'A';
            btnA.style.border = '2px solid #60a5fa'; btnA.style.background = 'rgba(37,99,235,0.28)'; btnA.style.color = '#fff';
            btnB.style.border = '1px solid #334155'; btnB.style.background = '#1e293b'; btnB.style.color = '#94a3b8';
        };
        btnB.onclick = function() {
            selectedLine = 'B';
            btnB.style.border = '2px solid #34d399'; btnB.style.background = 'rgba(16,185,129,0.25)'; btnB.style.color = '#fff';
            btnA.style.border = '1px solid #334155'; btnA.style.background = '#1e293b'; btnA.style.color = '#94a3b8';
        };
        function close(val) {
            overlay.remove();
            if (onSelectCallback) onSelectCallback(val, sourceId, targetSponsorId);
        }
        document.getElementById('bs-line-ok-v35').onclick = function() { close(selectedLine); };
        document.getElementById('bs-line-cancel-v35').onclick = function() { close(null); };
        document.getElementById('bs-line-x-v35').onclick = function() { close(null); };
    };

    var origPrompt = window.prompt;
    if (typeof origPrompt === 'function' && !origPrompt._v35Wrapped) {
        var wrappedPrompt = function(message, defaultVal) {
            var msgStr = String(message ? message : '').trim();
            if (msgStr.indexOf('이동') === -1 && msgStr.indexOf('라인') === -1) {
                return origPrompt.apply(this, arguments);
            }
            if (pendingPromptAnswer !== null && pendingPromptQuestion === msgStr) {
                var ans = pendingPromptAnswer;
                pendingPromptAnswer = null;
                pendingPromptQuestion = '';
                return ans;
            }
            window.openLineSelectPromptModalV43(msgStr, defaultVal, function(chosenLine, movedId, sponsorId) {
                if (!chosenLine) return;
                pendingPromptQuestion = msgStr;
                pendingPromptAnswer = chosenLine;
                setTimeout(function() { pendingPromptAnswer = null; pendingPromptQuestion = ''; }, 1500);
                replayLastInteraction(movedId, sponsorId);
            });
            return null;
        };
        wrappedPrompt._v35Wrapped = true;
        window.prompt = wrappedPrompt;
    }

    // ========================================================================
    // 🌟 다단계 하위 라인(A/B) 완전 추적 & 시점별 직급 정밀 산출
    // ========================================================================
    function getActiveHeaderPeriodKeysV44() {
        var activeMode = detectActiveCanvasModeV35();
        var endD = '';
        var startD = '';

        // 1순위: 현재 활성 모드 전용 기간 저장소(modePeriodStoreV35) 값 우선 사용 (VK/VJ 간 기간 오염 차단)
        if (modePeriodStoreV35[activeMode]) {
            startD = modePeriodStoreV35[activeMode].startDate;
            endD = modePeriodStoreV35[activeMode].endDate;
        } else {
            var pair = getHeaderDateInputPairV35();
            if (pair) {
                var refY = (activeMode === 'vj') ? '2027' : '2026';
                startD = normalizeUserDateTextV35(pair.startInput.value, refY);
                endD = normalizeUserDateTextV35(pair.endInput.value, startD ? startD.substring(0, 4) : refY);
            }
            if (!endD) {
                var defP = getDefaultPeriodForModeV35(activeMode);
                startD = defP.startDate;
                endD = defP.endDate;
            }
        }

        var parts = endD.split('-');
        var y = parts[0];
        var m = parts[1];
        var dNum = parseInt(parts[2], 10);
        var isFirstHalf = (dNum <= 15);
        return {
            sortKeyNum: y + '-' + m + '-' + (isFirstHalf ? '1' : '2'),
            periodLabel: m + '-' + (isFirstHalf ? '전' : '후'),
            startDate: startD ? startD : (y + '-' + m + '-' + (isFirstHalf ? '01' : '16')),
            endDate: endD
        };
    }

    function buildContinuousKeysUpToTarget(minKey, targetKey) {
        if (minKey > targetKey) return [targetKey];
        var p1 = String(minKey).split('-');
        var p2 = String(targetKey).split('-');
        if (p1.length < 3 ? true : p2.length < 3) return [targetKey];
        var y = parseInt(p1[0], 10);
        var m = parseInt(p1[1], 10);
        var h = parseInt(p1[2], 10);
        var endY = parseInt(p2[0], 10);
        var endM = parseInt(p2[1], 10);
        var endH = parseInt(p2[2], 10);
        var list = [];
        var guard = 0;
        while (guard++ < 240) {
            list.push(y + '-' + String(m).padStart(2, '0') + '-' + (h === 1 ? '1' : '2'));
            if (y === endY && m === endM && h === endH) break;
            if (y > endY ? true : (y === endY && m > endM)) break;
            if (h === 1) { h = 2; } else { h = 1; m++; if (m > 12) { m = 1; y++; } }
        }
        return list;
    }

    function formatShortKorPeriodLabel(sortKey) {
        var parts = String(sortKey).split('-');
        if (parts.length < 3) return sortKey;
        var mNum = parseInt(parts[1], 10);
        var halfIdx = parts[2] === '1' ? '1기' : '2기';
        var halfKor = parts[2] === '1' ? '전' : '후';
        return mNum + '월 ' + halfIdx + '(' + parts[1] + '-' + halfKor + ')';
    }

    function setBinarySlotChildV35(parentNorm, childNorm, side) {
        if (!parentNorm ? true : (!childNorm ? true : (parentNorm === childNorm))) return;
        var slot = binaryChildrenByParentNormMap.get(parentNorm);
        if (!slot) {
            slot = { leftNorm: '', rightNorm: '' };
            binaryChildrenByParentNormMap.set(parentNorm, slot);
        }
        if (side === 'A' ? true : (side === 'L')) {
            if (!slot.leftNorm) slot.leftNorm = childNorm;
            else if (!slot.rightNorm && slot.leftNorm !== childNorm) slot.rightNorm = childNorm;
        } else if (side === 'B' ? true : (side === 'R')) {
            if (!slot.rightNorm) slot.rightNorm = childNorm;
            else if (!slot.leftNorm && slot.rightNorm !== childNorm) slot.leftNorm = childNorm;
        } else {
            if (!slot.leftNorm) slot.leftNorm = childNorm;
            else if (!slot.rightNorm && slot.leftNorm !== childNorm) slot.rightNorm = childNorm;
        }
    }

    function reconstructBinarySlotsFromDOMGeometryV35() {
        var cards = Array.from(document.querySelectorAll('.node-card'));
        if (cards.length < 2) return;

        var items = [];
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.offsetParent === null) continue;
            var id = extractMemberIdFromCardEl(card);
            if (!id) continue;
            var rect = card.getBoundingClientRect();
            if (rect.width === 0) continue;
            items.push({
                id: id,
                norm: normNumStr(id),
                cx: rect.left + rect.width / 2,
                cy: rect.top + (rect.height > 0 ? rect.height / 2 : 50),
                w: rect.width,
                h: rect.height > 20 ? rect.height : 100
            });
        }

        if (items.length < 2) return;
        items.sort(function(a, b) { return a.cy - b.cy; });

        var levels = [];
        var rowTolerance = items[0].h * 0.55;

        for (var j = 0; j < items.length; j++) {
            var it = items[j];
            var lastLvl = levels.length > 0 ? levels[levels.length - 1] : null;
            if (!lastLvl ? true : (Math.abs(it.cy - lastLvl.avgY) > rowTolerance)) {
                levels.push({ avgY: it.cy, nodes: [it] });
            } else {
                lastLvl.nodes.push(it);
            }
        }

        for (var lv = 0; lv < levels.length; lv++) {
            levels[lv].nodes.sort(function(a, b) { return a.cx - b.cx; });
        }

        for (var l = 1; l < levels.length; l++) {
            var parents = levels[l - 1].nodes;
            var children = levels[l].nodes;

            var pairs = [];
            for (var pIdx = 0; pIdx < parents.length; pIdx++) {
                var p = parents[pIdx];
                var leftBound = (pIdx > 0) ? ((parents[pIdx - 1].cx + p.cx) / 2 - p.w * 0.35) : -Infinity;
                var rightBound = (pIdx < parents.length - 1) ? ((p.cx + parents[pIdx + 1].cx) / 2 + p.w * 0.35) : Infinity;

                for (var cIdx = 0; cIdx < children.length; cIdx++) {
                    var c = children[cIdx];
                    if (c.cx < leftBound ? true : (c.cx > rightBound)) continue;
                    var dx = Math.abs(c.cx - p.cx);
                    var side = (c.cx <= p.cx + 2) ? 'A' : 'B';
                    pairs.push({
                        pNorm: p.norm,
                        cNorm: c.norm,
                        side: side,
                        dx: dx
                    });
                }
            }

            pairs.sort(function(a, b) { return a.dx - b.dx; });

            var assignedChildren = new Set();
            var parentLeftTaken = new Set();
            var parentRightTaken = new Set();

            for (var k = 0; k < pairs.length; k++) {
                var pr = pairs[k];
                if (assignedChildren.has(pr.cNorm)) continue;
                if (pr.side === 'A' && !parentLeftTaken.has(pr.pNorm)) {
                    parentLeftTaken.add(pr.pNorm);
                    assignedChildren.add(pr.cNorm);
                    setBinarySlotChildV35(pr.pNorm, pr.cNorm, 'A');
                } else if (pr.side === 'B' && !parentRightTaken.has(pr.pNorm)) {
                    parentRightTaken.add(pr.pNorm);
                    assignedChildren.add(pr.cNorm);
                    setBinarySlotChildV35(pr.pNorm, pr.cNorm, 'B');
                }
            }

            for (var cIdx2 = 0; cIdx2 < children.length; cIdx2++) {
                var remChild = children[cIdx2];
                if (assignedChildren.has(remChild.norm)) continue;

                var bestP = null;
                var bestSlotSide = '';
                var minDist = Infinity;

                for (var pIdx2 = 0; pIdx2 < parents.length; pIdx2++) {
                    var candP = parents[pIdx2];
                    var hasL = parentLeftTaken.has(candP.norm);
                    var hasR = parentRightTaken.has(candP.norm);
                    if (hasL && hasR) continue;

                    var d = Math.abs(remChild.cx - candP.cx);
                    if (d < minDist) {
                        minDist = d;
                        bestP = candP;
                        if (!hasL && !hasR) {
                            bestSlotSide = (remChild.cx <= candP.cx) ? 'A' : 'B';
                        } else if (!hasL) {
                            bestSlotSide = 'A';
                        } else {
                            bestSlotSide = 'B';
                        }
                    }
                }

                if (bestP && bestSlotSide) {
                    assignedChildren.add(remChild.norm);
                    if (bestSlotSide === 'A') parentLeftTaken.add(bestP.norm);
                    else parentRightTaken.add(bestP.norm);
                    setBinarySlotChildV35(bestP.norm, remChild.norm, bestSlotSide);
                }
            }
        }
    }

    function ensureGlobalSalesAndTreeIndexedV35() {
        var activeMode = detectActiveCanvasModeV35();
        var allSales = getAllActiveSalesArray();
        var domCards = document.querySelectorAll('.node-card');
        var domCardCount = domCards ? domCards.length : 0;
        var firstCardId = (domCardCount > 0) ? extractMemberIdFromCardEl(domCards[0]) : '';
        var pKeys = getActiveHeaderPeriodKeysV44();

        if (
            allSales.length === indexedSalesCount &&
            domCardCount === indexedDomCardCount &&
            firstCardId === indexedFirstCardId &&
            pKeys.endDate === indexedPeriodKey &&
            activeMode === indexedMode &&
            binaryChildrenByParentNormMap.size > 0
        ) {
            return;
        }

        indexedSalesCount = allSales.length;
        indexedDomCardCount = domCardCount;
        indexedFirstCardId = firstCardId;
        indexedPeriodKey = pKeys.endDate;
        indexedMode = activeMode;

        salesByMemberNormMap.clear();
        memberNodeByNormMap.clear();
        memberNormByNameMap.clear();
        binaryChildrenByParentNormMap.clear();
        sublineSetsByNormMap.clear();
        computedMetricsByNormMap.clear();
        lastDomBadgeRenderSig = '';

        function recordInitialRawRankOnce(nId, rawRankVal) {
            if (!nId ? true : initialRawRankByNormMap.has(nId)) return;
            var rUp = String(rawRankVal ? rawRankVal : 'GUEST').trim().toUpperCase();
            if (KNOWN_RANKS.indexOf(rUp) !== -1) {
                initialRawRankByNormMap.set(nId, rUp);
            }
        }

        function indexTreeNodes(node, parentNorm, branchSide) {
            if (!node) return;
            var rawNodeId = String(node.id ? node.id : (node.member_id ? node.member_id : (node.memberId ? node.memberId : ''))).trim();
            var nId = normNumStr(rawNodeId);
            if (nId && isEntryMatchingCurrentMode(rawNodeId)) {
                memberNodeByNormMap.set(nId, node);
                recordInitialRawRankOnce(nId, node.initial_rank ? node.initial_rank : (node.base_rank ? node.base_rank : (node.rank ? node.rank : node.rank_name)));
                if (node.name) {
                    memberNormByNameMap.set(String(node.name).trim(), nId);
                }
                if (parentNorm && parentNorm !== nId && branchSide) {
                    setBinarySlotChildV35(parentNorm, nId, branchSide);
                }
            }
            if (node.left) indexTreeNodes(node.left, nId, 'A');
            if (node.right) indexTreeNodes(node.right, nId, 'B');
            if (Array.isArray(node.children)) {
                for (var i = 0; i < node.children.length; i++) {
                    var ch = node.children[i];
                    var pos = String(ch && (ch.position ? ch.position : (ch.line ? ch.line : (ch.direction ? ch.direction : '')))).toUpperCase();
                    var side = (pos === 'A' ? true : (pos === 'L' ? true : (pos === 'LEFT' ? true : (pos === '1' ? true : (pos === '' && i === 0))))) ? 'A' : 'B';
                    indexTreeNodes(ch, nId, side);
                }
            }
        }

        if (activeMode === 'vj' && window.vjTreeData) indexTreeNodes(window.vjTreeData, '', '');
        if (window.treeData) indexTreeNodes(window.treeData, '', '');

        var flatSources = [window.flatMembersData, window.vjFlatMembersData, window.membersData];
        for (var fs = 0; fs < flatSources.length; fs++) {
            var flatArr = flatSources[fs];
            if (!Array.isArray(flatArr)) continue;
            for (var j = 0; j < flatArr.length; j++) {
                var fm = flatArr[j];
                if (!fm) continue;
                var rawId = String(fm.id ? fm.id : (fm.member_id ? fm.member_id : (fm.memberId ? fm.memberId : ''))).trim();
                if (!isEntryMatchingCurrentMode(rawId)) continue;
                var fNorm = normNumStr(rawId);
                if (!fNorm) continue;
                recordInitialRawRankOnce(fNorm, fm.initial_rank ? fm.initial_rank : (fm.base_rank ? fm.base_rank : (fm.rank ? fm.rank : fm.rank_name)));
                if (!memberNodeByNormMap.has(fNorm)) {
                    memberNodeByNormMap.set(fNorm, fm);
                }
                if (fm.name) {
                    memberNormByNameMap.set(String(fm.name).trim(), fNorm);
                }
            }
        }

        for (var dIdx = 0; dIdx < domCardCount; dIdx++) {
            var card = domCards[dIdx];
            var cId = extractMemberIdFromCardEl(card);
            if (!cId) continue;
            var cNorm = normNumStr(cId);
            var cName = extractMemberNameFromCardEl(card, cId);
            if (cName) {
                memberNormByNameMap.set(cName, cNorm);
            }
            if (typeof window.findMemberNode === 'function') {
                try {
                    var realNode = window.findMemberNode(cId);
                    if (realNode) {
                        indexTreeNodes(realNode, '', '');
                    }
                } catch (e) {}
            }
            var domRank = extractRankFromCardDOM(card, 'GUEST');
            recordInitialRawRankOnce(cNorm, domRank);
            if (!memberNodeByNormMap.has(cNorm)) {
                memberNodeByNormMap.set(cNorm, { id: cId, member_id: cId, name: cName, rank: domRank });
            }
        }

        reconstructBinarySlotsFromDOMGeometryV35();

        for (var sIdx = 0; sIdx < allSales.length; sIdx++) {
            var s = allSales[sIdx];
            if (!s) continue;
            var rawMid = String(s.member_id ? s.member_id : (s.memberId ? s.memberId : (s.id ? s.id : ''))).trim();
            var sNorm = '';
            if (rawMid && /v[kj]-?\d+/i.test(rawMid)) {
                if (!isEntryMatchingCurrentMode(rawMid)) continue;
                sNorm = normNumStr(rawMid);
            } else if (rawMid && /^\d+$/.test(rawMid)) {
                sNorm = normNumStr(rawMid);
            } else {
                var rawName = String(s.member_name ? s.member_name : (s.memberName ? s.memberName : (s.name ? s.name : rawMid))).trim();
                if (rawName && memberNormByNameMap.has(rawName)) {
                    sNorm = memberNormByNameMap.get(rawName);
                }
            }
            if (!sNorm) continue;

            var dStr = cleanDate(s.transaction_date ? s.transaction_date : (s.sales_date ? s.sales_date : (s.buy_date ? s.buy_date : s.date)));
            if (!dStr) continue;

            var pvVal = parseNum(s.pv !== undefined ? s.pv : s.sales_pv);
            var cvVal = parseNum(s.cv !== undefined ? s.cv : s.sales_cv);
            var dp = dStr.split('-');
            var sk = dp[0] + '-' + dp[1] + '-' + (parseInt(dp[2], 10) <= 15 ? '1' : '2');

            var list = salesByMemberNormMap.get(sNorm);
            if (!list) {
                list = [];
                salesByMemberNormMap.set(sNorm, list);
            }
            list.push({ dStr: dStr, sk: sk, pv: pvVal, cv: cvVal });
        }
    }

    function getSublineSetsFastV35(mNorm, cleanId) {
        if (sublineSetsByNormMap.has(mNorm)) return sublineSetsByNormMap.get(mNorm);

        var setA = new Set();
        var setB = new Set();

        function collectSubtreeNorms(startNorm, outSet) {
            if (!startNorm) return;
            var queue = [startNorm];
            while (queue.length > 0) {
                var currNorm = queue.shift();
                if (!currNorm ? true : outSet.has(currNorm)) continue;
                outSet.add(currNorm);

                var slot = binaryChildrenByParentNormMap.get(currNorm);
                if (slot) {
                    if (slot.leftNorm && !outSet.has(slot.leftNorm)) queue.push(slot.leftNorm);
                    if (slot.rightNorm && !outSet.has(slot.rightNorm)) queue.push(slot.rightNorm);
                }

                var nodeObj = memberNodeByNormMap.get(currNorm);
                if (nodeObj) {
                    if (nodeObj.left) {
                        var ln = normNumStr(nodeObj.left.id ? nodeObj.left.id : nodeObj.left);
                        if (ln && !outSet.has(ln)) queue.push(ln);
                    }
                    if (nodeObj.right) {
                        var rn = normNumStr(nodeObj.right.id ? nodeObj.right.id : nodeObj.right);
                        if (rn && !outSet.has(rn)) queue.push(rn);
                    }
                    if (Array.isArray(nodeObj.children)) {
                        for (var c = 0; c < nodeObj.children.length; c++) {
                            var cn = normNumStr(nodeObj.children[c].id ? nodeObj.children[c].id : nodeObj.children[c]);
                            if (cn && !outSet.has(cn)) queue.push(cn);
                        }
                    }
                }
            }
        }

        var liveNode = (cleanId && typeof window.findMemberNode === 'function') ? window.findMemberNode(cleanId) : null;
        if (!liveNode) liveNode = memberNodeByNormMap.get(mNorm);

        if (liveNode) {
            if (liveNode.left) collectSubtreeNorms(normNumStr(liveNode.left.id ? liveNode.left.id : liveNode.left), setA);
            if (liveNode.right) collectSubtreeNorms(normNumStr(liveNode.right.id ? liveNode.right.id : liveNode.right), setB);
        }

        if (liveNode && typeof window.getSublinePartnerSets === 'function') {
            try {
                var sub = window.getSublinePartnerSets(liveNode);
                if (sub && sub.setA && sub.setB) {
                    sub.setA.forEach(function(id) { setA.add(normNumStr(id)); });
                    sub.setB.forEach(function(id) { setB.add(normNumStr(id)); });
                }
            } catch (e) {}
        }

        var rootSlot = binaryChildrenByParentNormMap.get(mNorm);
        if (rootSlot) {
            if (rootSlot.leftNorm && !setB.has(rootSlot.leftNorm)) collectSubtreeNorms(rootSlot.leftNorm, setA);
            if (rootSlot.rightNorm && !setA.has(rootSlot.rightNorm)) collectSubtreeNorms(rootSlot.rightNorm, setB);
        }

        setA.delete(mNorm);
        setB.delete(mNorm);

        var pair = { setA: setA, setB: setB };
        if (setA.size > 0 ? true : (setB.size > 0)) {
            sublineSetsByNormMap.set(mNorm, pair);
        }
        return pair;
    }

    function lookupBonusMapForMemberV35(memberId, mNorm) {
        if (!(window.lastAllMembersTeamBonusMap instanceof Map)) return null;
        var map = window.lastAllMembersTeamBonusMap;
        var rawUp = String(memberId ? memberId : '').trim().toUpperCase();
        var rawLow = rawUp.toLowerCase();
        var numOnly = rawLow.replace(/^v[kj]-?0*/, '');
        var padded3 = numOnly.padStart(3, '0');

        var candidateKeys = [
            rawUp, rawLow, mNorm, numOnly, padded3,
            'vj-' + padded3, 'VJ-' + padded3, 'vk-' + numOnly, 'VK-' + numOnly
        ];
        for (var i = 0; i < candidateKeys.length; i++) {
            var k = candidateKeys[i];
            if (k && map.has(k)) return map.get(k);
        }
        return null;
    }

    function computeHistoricalRankAtPeriodV35(mNorm, cleanId, selfAccPVAtPeriod, maxRecent4MinorPVAtPeriod, accMinorPVAtPeriod, bonusBucketAtPeriod) {
        var histRankFromMap = (bonusBucketAtPeriod && bonusBucketAtPeriod.historicalRank)
            ? String(bonusBucketAtPeriod.historicalRank).trim().toUpperCase()
            : '';

        var allSelfSalesEver = salesByMemberNormMap.get(mNorm) ? salesByMemberNormMap.get(mNorm) : [];
        var totalEverSelfPV = 0;
        for (var i = 0; i < allSelfSalesEver.length; i++) {
            totalEverSelfPV += allSelfSalesEver[i].pv;
        }

        var initialRaw = initialRawRankByNormMap.get(mNorm) ? initialRawRankByNormMap.get(mNorm) : 'GUEST';
        var initialRawLvl = RANK_LEVEL_MAP[initialRaw] ? RANK_LEVEL_MAP[initialRaw] : 1;

        var startLevel = 1;
        if (totalEverSelfPV === 0 && initialRawLvl >= 2) {
            startLevel = Math.min(3, initialRawLvl);
        } else if (selfAccPVAtPeriod === 0 && totalEverSelfPV > 0) {
            startLevel = 1;
        }

        var effLevel = startLevel;

        if (selfAccPVAtPeriod >= 700000 && effLevel < 3) {
            effLevel = 3;
        } else if (selfAccPVAtPeriod >= 100000 && effLevel < 2) {
            effLevel = 2;
        }

        if (initialRawLvl >= 3 && selfAccPVAtPeriod > 0 && effLevel < 3) {
            effLevel = 3;
        }

        if (effLevel >= 3) {
            if (maxRecent4MinorPVAtPeriod >= 2100000 && effLevel < 4) effLevel = 4;
            if (maxRecent4MinorPVAtPeriod >= 14000000 && effLevel < 5) effLevel = 5;

            if (accMinorPVAtPeriod >= 100000000 && effLevel < 6) effLevel = 6;
            if (accMinorPVAtPeriod >= 250000000 && effLevel < 7) effLevel = 7;
            if (accMinorPVAtPeriod >= 500000000 && effLevel < 8) effLevel = 8;
            if (accMinorPVAtPeriod >= 1000000000 && effLevel < 9) effLevel = 9;
            if (accMinorPVAtPeriod >= 2000000000 && effLevel < 10) effLevel = 10;
        }

        if (histRankFromMap && RANK_LEVEL_MAP[histRankFromMap]) {
            var mapHistLvl = RANK_LEVEL_MAP[histRankFromMap];
            if (mapHistLvl <= 3 && mapHistLvl > effLevel && selfAccPVAtPeriod > 0) {
                effLevel = mapHistLvl;
            } else if (mapHistLvl >= 4 && maxRecent4MinorPVAtPeriod >= 2100000 && mapHistLvl > effLevel) {
                effLevel = mapHistLvl;
            }
        }

        var subSets = getSublineSetsFastV35(mNorm, cleanId);
        if (subSets.setA.size === 0 && subSets.setB.size === 0 && initialRawLvl >= 4) {
            effLevel = initialRawLvl;
        }

        return LEVEL_TO_RANK_NAME[effLevel] ? LEVEL_TO_RANK_NAME[effLevel] : 'GUEST';
    }

    function syncInMemoryNodeRankV35(cleanId, mNorm, effectiveRank) {
        var mNode = memberNodeByNormMap.get(mNorm);
        if (mNode) {
            mNode.rank = effectiveRank;
            mNode.rank_name = effectiveRank;
        }
        if (typeof window.findMemberNode === 'function') {
            try {
                var origTreeNode = window.findMemberNode(cleanId);
                if (origTreeNode) {
                    origTreeNode.rank = effectiveRank;
                    origTreeNode.rank_name = effectiveRank;
                }
            } catch (e) {}
        }
        var flatArrays = [window.flatMembersData, window.vjFlatMembersData, window.membersData];
        for (var fa = 0; fa < flatArrays.length; fa++) {
            var arr = flatArrays[fa];
            if (!Array.isArray(arr)) continue;
            for (var f = 0; f < arr.length; f++) {
                var fmItem = arr[f];
                if (fmItem && normNumStr(fmItem.id ? fmItem.id : fmItem.member_id) === mNorm) {
                    fmItem.rank = effectiveRank;
                    fmItem.rank_name = effectiveRank;
                }
            }
        }
    }

    function getFastComputedMemberMetricsV35(memberId, optCardEl) {
        ensureGlobalSalesAndTreeIndexedV35();
        var cleanId = String(memberId ? memberId : '').trim().toUpperCase();
        var mNorm = normNumStr(cleanId);
        if (!mNorm) return null;

        var pKeys = getActiveHeaderPeriodKeysV44();

        if (computedMetricsByNormMap.has(mNorm)) {
            var cached = computedMetricsByNormMap.get(mNorm);
            if (cached.effectiveRank) {
                syncInMemoryNodeRankV35(cleanId, mNorm, cached.effectiveRank);
                if (optCardEl) {
                    enforceCardDOMRankTitleV35(optCardEl, mNorm, cached.effectiveRank, pKeys.sortKeyNum);
                }
            }
            return cached;
        }

        var selfSales = salesByMemberNormMap.get(mNorm) ? salesByMemberNormMap.get(mNorm) : [];
        var selfAccPV = 0;
        var selfTermCV = 0;
        var lastSaleDate = '-';

        for (var i = 0; i < selfSales.length; i++) {
            var ss = selfSales[i];
            if (ss.dStr > pKeys.endDate) continue;
            selfAccPV += ss.pv;
            if (ss.dStr >= pKeys.startDate && ss.dStr <= pKeys.endDate) {
                selfTermCV += ss.cv;
            }
            if (lastSaleDate === '-' ? true : (ss.dStr > lastSaleDate)) {
                lastSaleDate = ss.dStr;
            }
        }

        var subSets = getSublineSetsFastV35(mNorm, cleanId);
        var buckets = {};
        var minKey = pKeys.sortKeyNum;
        var accAPV = 0;
        var accBPV = 0;

        subSets.setA.forEach(function(aNorm) {
            var aList = salesByMemberNormMap.get(aNorm);
            if (!aList) return;
            for (var j = 0; j < aList.length; j++) {
                var item = aList[j];
                if (item.dStr > pKeys.endDate ? true : (item.sk > pKeys.sortKeyNum)) continue;
                accAPV += item.pv;
                if (item.sk < minKey) minKey = item.sk;
                if (!buckets[item.sk]) buckets[item.sk] = { a_pv: 0, b_pv: 0, a_cv: 0, b_cv: 0 };
                buckets[item.sk].a_pv += item.pv;
                buckets[item.sk].a_cv += item.cv;
            }
        });

        subSets.setB.forEach(function(bNorm) {
            var bList = salesByMemberNormMap.get(bNorm);
            if (!bList) return;
            for (var k = 0; k < bList.length; k++) {
                var item = bList[k];
                if (item.dStr > pKeys.endDate ? true : (item.sk > pKeys.sortKeyNum)) continue;
                accBPV += item.pv;
                if (item.sk < minKey) minKey = item.sk;
                if (!buckets[item.sk]) buckets[item.sk] = { a_pv: 0, b_pv: 0, a_cv: 0, b_cv: 0 };
                buckets[item.sk].b_pv += item.pv;
                buckets[item.sk].b_cv += item.cv;
            }
        });

        var bonusMapEntry = lookupBonusMapForMemberV35(cleanId, mNorm);
        var bonusBucketAtTarget = null;
        if (bonusMapEntry && typeof bonusMapEntry === 'object') {
            var bKeys = Object.keys(bonusMapEntry).sort();
            for (var bkIdx = 0; bkIdx < bKeys.length; bkIdx++) {
                var bk = bKeys[bkIdx];
                if (bk > pKeys.sortKeyNum) continue;
                var bm = bonusMapEntry[bk];
                if (!bm) continue;
                bonusBucketAtTarget = bm;
                if (bk < minKey) minKey = bk;
                if (!buckets[bk]) buckets[bk] = { a_pv: 0, b_pv: 0, a_cv: 0, b_cv: 0 };

                var bmNewAPV = parseNum(bm.newAPV !== undefined ? bm.newAPV : bm.aPV);
                var bmNewBPV = parseNum(bm.newBPV !== undefined ? bm.newBPV : bm.bPV);
                var bmNewACV = parseNum(bm.newACV !== undefined ? bm.newACV : bm.aCV);
                var bmNewBCV = parseNum(bm.newBCV !== undefined ? bm.newBCV : bm.bCV);

                if (bmNewAPV > buckets[bk].a_pv) buckets[bk].a_pv = bmNewAPV;
                if (bmNewBPV > buckets[bk].b_pv) buckets[bk].b_pv = bmNewBPV;
                if (bmNewACV > buckets[bk].a_cv) buckets[bk].a_cv = bmNewACV;
                if (bmNewBCV > buckets[bk].b_cv) buckets[bk].b_cv = bmNewBCV;
            }
        }

        var continuousKeys = buildContinuousKeysUpToTarget(minKey, pKeys.sortKeyNum);
        var cA = 0;
        var cB = 0;
        var minorSubTermCV = 0;
        var maxRecent4MinorPVUpToTarget = 0;
        var sumAllAPV = 0;
        var sumAllBPV = 0;

        for (var cIdx = 0; cIdx < continuousKeys.length; cIdx++) {
            var key = continuousKeys[cIdx];
            if (key > pKeys.sortKeyNum) break;
            var b = buckets[key] ? buckets[key] : { a_pv: 0, b_pv: 0, a_cv: 0, b_cv: 0 };
            sumAllAPV += b.a_pv;
            sumAllBPV += b.b_pv;

            var sA = cA + b.a_cv;
            var sB = cB + b.b_cv;
            var ded = Math.min(sA, sB);
            cA = sA - ded;
            cB = sB - ded;
            if (key === pKeys.sortKeyNum) minorSubTermCV = ded;

            var wA = 0;
            var wB = 0;
            for (var w = Math.max(0, cIdx - 3); w <= cIdx; w++) {
                var wb = buckets[continuousKeys[w]];
                if (wb) { wA += wb.a_pv; wB += wb.b_pv; }
            }
            var wMinor = Math.min(wA, wB);
            if (wMinor > maxRecent4MinorPVUpToTarget) maxRecent4MinorPVUpToTarget = wMinor;
        }

        accAPV = Math.max(accAPV, sumAllAPV);
        accBPV = Math.max(accBPV, sumAllBPV);

        var recent4Keys = continuousKeys.slice(-4).reverse();
        while (recent4Keys.length < 4) {
            var lastK = recent4Keys.length > 0 ? recent4Keys[recent4Keys.length - 1] : pKeys.sortKeyNum;
            var kp = lastK.split('-');
            var py = parseInt(kp[0], 10);
            var pm = parseInt(kp[1], 10);
            var ph = parseInt(kp[2], 10);
            if (ph === 2) { ph = 1; } else { ph = 2; pm--; if (pm < 1) { pm = 12; py--; } }
            recent4Keys.push(py + '-' + String(pm).padStart(2, '0') + '-' + ph);
        }

        var recent4APV = 0;
        var recent4BPV = 0;
        var recent4Rows = [];
        for (var rIdx = 0; rIdx < recent4Keys.length; rIdx++) {
            var rk = recent4Keys[rIdx];
            var rb = buckets[rk] ? buckets[rk] : { a_pv: 0, b_pv: 0 };
            recent4APV += rb.a_pv;
            recent4BPV += rb.b_pv;
            recent4Rows.push({
                key: rk,
                label: formatShortKorPeriodLabel(rk),
                aPV: rb.a_pv,
                bPV: rb.b_pv
            });
        }

        if (bonusMapEntry && bonusMapEntry[pKeys.sortKeyNum]) {
            var exactB = bonusMapEntry[pKeys.sortKeyNum];
            if (parseNum(exactB.recent4APV) > recent4APV) recent4APV = parseNum(exactB.recent4APV);
            if (parseNum(exactB.recent4BPV) > recent4BPV) recent4BPV = parseNum(exactB.recent4BPV);
            if (parseNum(exactB.accAPV) > accAPV) accAPV = parseNum(exactB.accAPV);
            if (parseNum(exactB.accBPV) > accBPV) accBPV = parseNum(exactB.accBPV);
            if (parseNum(exactB.matchedCV) > minorSubTermCV) minorSubTermCV = parseNum(exactB.matchedCV);
        }

        var currMinorR4 = Math.min(recent4APV, recent4BPV);
        if (currMinorR4 > maxRecent4MinorPVUpToTarget) maxRecent4MinorPVUpToTarget = currMinorR4;
        var accMinorPV = Math.min(accAPV, accBPV);

        var effectiveRank = computeHistoricalRankAtPeriodV35(mNorm, cleanId, selfAccPV, maxRecent4MinorPVUpToTarget, accMinorPV, bonusBucketAtTarget);

        syncInMemoryNodeRankV35(cleanId, mNorm, effectiveRank);
        if (optCardEl) {
            enforceCardDOMRankTitleV35(optCardEl, mNorm, effectiveRank, pKeys.sortKeyNum);
        }

        var result = {
            effectiveRank: effectiveRank,
            selfAccPV: selfAccPV,
            selfTermCV: selfTermCV,
            lastSaleDate: lastSaleDate,
            minorSubTermCV: minorSubTermCV,
            recent4APV: recent4APV,
            recent4BPV: recent4BPV,
            recent4Rows: recent4Rows,
            accAPV: accAPV,
            accBPV: accBPV,
            pKeys: pKeys
        };

        computedMetricsByNormMap.set(mNorm, result);
        return result;
    }

    window.getBadgeThresholdSettingsV44 = function() {
        var minFound = null;
        try {
            for (var kIdx = 0; kIdx < localStorage.length; kIdx++) {
                var keyName = localStorage.key(kIdx);
                if (!keyName) continue;
                var lowerK = keyName.toLowerCase();
                if (lowerK.indexOf('badge') !== -1 ? true : (lowerK.indexOf('threshold') !== -1)) {
                    var num = parseInt(String(localStorage.getItem(keyName)).replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(num) && num >= 5 && num <= 100) {
                        if (minFound === null ? true : (num < minFound)) minFound = num;
                    }
                }
            }
        } catch (e) {}
        var finalTh = (minFound !== null) ? minFound : 10;
        return { promoThreshold: finalTh, maintThreshold: finalTh };
    };

    function getRequiredMaintCvForRankV44(rankName) {
        var rUpper = String(rankName ? rankName : 'GUEST').trim().toUpperCase();
        var rLevel = RANK_LEVEL_MAP[rUpper] ? RANK_LEVEL_MAP[rUpper] : 0;
        if (rLevel < 4) return 0;
        var table = {
            'DIRECTOR': 2100000, 'EMERALD': 3500000, 'DIAMOND': 10000000,
            'GREEN DIAMOND': 19000000, 'BLUE DIAMOND': 34000000, 'RED DIAMOND': 65000000, 'CROWN': 135000000
        };
        return table[rUpper] ? table[rUpper] : 0;
    }

    function evaluateMaintStatusAndDisplayLabelV35(currRankName, totalRecognizedCV, reqMaintCV) {
        var rUpper = String(currRankName ? currRankName : 'GUEST').trim().toUpperCase();
        var currLevel = RANK_LEVEL_MAP[rUpper] ? RANK_LEVEL_MAP[rUpper] : 0;

        if (reqMaintCV > 0 && totalRecognizedCV >= reqMaintCV) {
            return {
                statusType: 'ACHIEVED_CURRENT',
                achievedRank: rUpper,
                labelHtml: '<span style="font-size:11.5px; font-weight:800; color:#10b981;">✓ 유지 달성</span>'
            };
        }

        if (currLevel <= 4) {
            return {
                statusType: 'UNACHIEVED_DIRECTOR',
                achievedRank: '',
                labelHtml: '<span style="font-size:11.5px; font-weight:800; color:#f87171;">미달성</span>'
            };
        }

        var downwardRank = '';
        for (var i = 0; i < MAINT_REQ_CV_LIST.length; i++) {
            var item = MAINT_REQ_CV_LIST[i];
            if (item.level < currLevel && totalRecognizedCV >= item.cv) {
                downwardRank = item.rank;
                break;
            }
        }

        if (downwardRank) {
            return {
                statusType: 'DOWNWARD_ACHIEVED',
                achievedRank: downwardRank,
                labelHtml: '<span style="font-size:11.5px; font-weight:800; color:#fbbf24;">하향 달성 (달성직급: ' + downwardRank + ')</span>'
            };
        }

        return {
            statusType: 'UNACHIEVED_HIGHER',
            achievedRank: '',
            labelHtml: '<span style="font-size:11.5px; font-weight:800; color:#f87171;">미달성 (달성직급: 없음)</span>'
        };
    }

    window.evaluateMemberCardBadgeStatusV44 = function(memberId, cardEl) {
        var thObj = window.getBadgeThresholdSettingsV44();
        var res = { showPromoBadge: false, showMaintBadge: false, promoPct: 0, maintPct: 0, currRank: 'GUEST' };
        if (!memberId) return res;

        var metrics = getFastComputedMemberMetricsV35(memberId, cardEl);
        if (!metrics) return res;

        var currRank = metrics.effectiveRank;
        res.currRank = currRank;

        if (currRank === 'GUEST' ? true : (currRank === 'MEMBER')) {
            res.promoPct = Math.floor((metrics.selfAccPV / 700000) * 100);
            res.showPromoBadge = (res.promoPct >= thObj.promoThreshold && res.promoPct < 100);
        } else {
            var rankTargets = {
                'MANIA': { pv: 2100000, r4: true },
                'DIRECTOR': { pv: 14000000, r4: true },
                'EMERALD': { pv: 100000000, r4: false },
                'DIAMOND': { pv: 250000000, r4: false },
                'GREEN DIAMOND': { pv: 500000000, r4: false },
                'BLUE DIAMOND': { pv: 1000000000, r4: false },
                'RED DIAMOND': { pv: 2000000000, r4: false }
            };
            var tInfo = rankTargets[currRank];
            if (tInfo) {
                var minorPV = tInfo.r4
                    ? Math.min(metrics.recent4APV, metrics.recent4BPV)
                    : Math.min(metrics.accAPV, metrics.accBPV);
                res.promoPct = Math.floor((minorPV / tInfo.pv) * 100);
                res.showPromoBadge = (res.promoPct >= thObj.promoThreshold);
            }
        }

        var reqMaintCV = getRequiredMaintCvForRankV44(currRank);
        if (reqMaintCV > 0) {
            var totalCV = metrics.minorSubTermCV + metrics.selfTermCV;
            res.maintPct = Math.floor((totalCV / reqMaintCV) * 100);
            res.showMaintBadge = (res.maintPct >= thObj.maintThreshold);
        }
        return res;
    };

    // ========================================================================
    // [45] 비지네스 내비게이터 드래그 이동 & 렌더러
    // ========================================================================
    function findNavigatorBoxAndHeaderFromTargetV35(targetEl) {
        if (!targetEl ? true : !targetEl.closest) return null;
        var modalRoot = targetEl.closest('#bizNavModal');
        if (!modalRoot) return null;

        var navBody = document.getElementById('bizNavBody');
        var boxEl = (navBody && navBody.parentElement && navBody.parentElement !== document.body)
            ? navBody.parentElement
            : modalRoot;

        var boxRect = boxEl.getBoundingClientRect();
        if (boxRect.width > window.innerWidth * 0.94 && modalRoot.firstElementChild) {
            boxEl = modalRoot.firstElementChild;
            boxRect = boxEl.getBoundingClientRect();
        }

        if (navBody && navBody.contains(targetEl)) return null;
        var headerEl = boxEl.firstElementChild;

        return {
            modalRoot: modalRoot,
            box: boxEl,
            header: headerEl,
            boxRect: boxRect
        };
    }

    window.closeInstantNavigatorV35 = function() {
        var modal = document.getElementById('bizNavModal');
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
            modal.classList.add('hidden');
            modal.classList.remove('active', 'open', 'show');
        }
        var customModals = document.querySelectorAll('#bs-v16-navigator-modal, #bs-v15-direct-nav-modal');
        for (var i = 0; i < customModals.length; i++) {
            customModals[i].remove();
        }
    };

    window.closeBusinessNavigatorModal = window.closeInstantNavigatorV35;
    window.hideBusinessNavigatorModal = window.closeInstantNavigatorV35;

    function fitInstantNavigatorHeightV35() {
        var body = document.getElementById('bizNavBody');
        if (!body) return;
        body.style.maxHeight = 'none';
        body.style.height = 'auto';
        if (body.parentElement) {
            body.parentElement.style.height = 'auto';
            body.parentElement.style.maxHeight = '94vh';
        }
    }

    function ensureBizNavModalContainerExistsV35() {
        var existingModal = document.getElementById('bizNavModal');
        var existingBody = document.getElementById('bizNavBody');
        if (existingModal && existingBody) {
            var hdr = existingBody.parentElement ? existingBody.parentElement.firstElementChild : null;
            if (hdr) {
                hdr.style.setProperty('cursor', 'move', 'important');
                hdr.style.setProperty('user-select', 'none', 'important');
            }
            return { modal: existingModal, body: existingBody, badge: document.getElementById('bizNavTargetBadge') };
        }

        var modalWrap = document.createElement('div');
        modalWrap.id = 'bizNavModal';
        modalWrap.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:2147483645; display:none; align-items:center; justify-content:center; padding:16px;';
        modalWrap.innerHTML = [
            '<div id="bizNavDialogBox" style="width:610px; max-width:96vw; background:#0f172a; border:1.5px solid #3b82f6; border-radius:10px; box-shadow:0 25px 60px rgba(0,0,0,0.92); overflow:hidden; display:flex; flex-direction:column;">',
            '  <div id="bizNavHeaderBar" style="height:42px; background:#1e293b; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between; padding:0 14px; user-select:none; cursor:move;" title="마우스로 잡고 드래그하여 창 위치를 이동할 수 있습니다">',
            '    <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:800; color:#f8fafc; pointer-events:none;">',
            '      <span>🧭 비지네스 내비게이터</span>',
            '      <span id="bizNavTargetBadge" style="color:#60a5fa;"></span>',
            '    </div>',
            '    <div style="display:flex; align-items:center; gap:6px;">',
            '      <span style="background:#0f172a; border:1px solid #334155; color:#64748b; padding:2px 7px; border-radius:4px; font-size:10.5px; font-family:monospace;">610 × 625</span>',
            '      <button type="button" id="bizNavFitBtnV35" style="background:#1e3a8a; border:1px solid #3b82f6; color:#bfdbfe; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">내용 맞춤</button>',
            '      <button type="button" id="bizNavCloseBtnV35" style="background:#7f1d1d; border:1px solid #ef4444; color:#fecaca; padding:3px 9px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">닫기 ✕</button>',
            '    </div>',
            '  </div>',
            '  <div id="bizNavBody" style="padding:14px 16px; max-height:82vh; overflow-y:auto; color:#f8fafc;"></div>',
            '</div>'
        ].join('');

        document.body.appendChild(modalWrap);
        return {
            modal: modalWrap,
            body: document.getElementById('bizNavBody'),
            badge: document.getElementById('bizNavTargetBadge')
        };
    }

    function buildInstantNavigatorHtmlV35(memberId) {
        var cleanId = String(memberId).trim().toUpperCase();
        var mNorm = normNumStr(cleanId);
        var cards = Array.from(document.querySelectorAll('.node-card'));
        var cardEl = cards.find(function(c) { return extractMemberIdFromCardEl(c) === cleanId; });

        computedMetricsByNormMap.delete(mNorm);
        var metrics = getFastComputedMemberMetricsV35(cleanId, cardEl);
        if (!metrics) return { title: cleanId, html: '' };

        var mNode = memberNodeByNormMap.get(mNorm);
        var mName = mNode && mNode.name ? mNode.name : '';
        if (!mName && cardEl) {
            mName = extractMemberNameFromCardEl(cardEl, cleanId);
        }
        if (!mName) mName = cleanId;

        var currRank = metrics.effectiveRank;
        var pKeys = metrics.pKeys;

        if (currRank === 'MEMBER' ? true : (currRank === 'GUEST')) {
            var isTargetMania = Boolean(currRank === 'MEMBER' ? true : (metrics.selfAccPV >= 100000));
            var nextRank = isTargetMania ? 'MANIA' : 'MEMBER';
            var reqPV = isTargetMania ? 700000 : 100000;
            var lackPV = Math.max(0, reqPV - metrics.selfAccPV);
            var pct = reqPV > 0 ? Math.min(100, Math.floor((metrics.selfAccPV / reqPV) * 100)) : 0;
            var lackText = lackPV > 0 ? ('부족: -' + lackPV.toLocaleString('ko-KR') + ' PV') : '✓ 목표 PV 달성 완료';
            var lackColor = lackPV > 0 ? '#f87171' : '#10b981';

            var htmlMember = [
                '<div style="background:#162032; border:1px solid #2d3d5b; border-radius:8px; padding:12px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;">',
                '  <div>',
                '    <div style="font-size:11.5px; color:#94a3b8; margin-bottom:4px;">기준기수: ' + pKeys.periodLabel + ' (' + pKeys.startDate + ' ~ ' + pKeys.endDate + ')</div>',
                '    <div style="font-size:15px; font-weight:800; color:#60a5fa;">승급 목표 : <span style="color:#38bdf8;">' + currRank + '</span> ➔ <span style="color:#fbbf24;">' + nextRank + '</span></div>',
                '  </div>',
                '  <div style="background:#272324; border:1px solid #b45309; color:#fbbf24; padding:5px 12px; border-radius:6px; font-size:12.5px; font-weight:800;">본인매출 달성률: ' + pct + '%</div>',
                '</div>',
                '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:14px;">',
                '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 10px; text-align:center;">',
                '    <div style="font-size:11px; color:#64748b; margin-bottom:5px;">① 본인 누적 목표 PV</div>',
                '    <div style="font-size:14.5px; font-weight:800; color:#f8fafc; font-family:monospace; margin-bottom:4px;">' + reqPV.toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="font-size:11.5px; font-weight:700; color:' + lackColor + ';">' + lackText + '</div>',
                '  </div>',
                '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 10px; text-align:center;">',
                '    <div style="font-size:11px; color:#64748b; margin-bottom:5px;">② 직접추천 파트너 조건</div>',
                '    <div style="font-size:13px; font-weight:800; color:#f8fafc; margin-bottom:4px;">제한 없음 (본인 매출 승급)</div>',
                '    <div style="font-size:11.5px; font-weight:700; color:#10b981;">✓ 추천 조건 없음</div>',
                '  </div>',
                '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 10px; text-align:center;">',
                '    <div style="font-size:11px; color:#64748b; margin-bottom:5px;">③ 적용 기준 규정</div>',
                '    <div style="font-size:13px; font-weight:800; color:#fbbf24; margin-bottom:4px;">기간 제한 없음 (누적 인정)</div>',
                '    <div style="font-size:11px; color:#94a3b8;">본인 누적 매출 PV 기준 즉시 승급</div>',
                '  </div>',
                '</div>',
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; overflow:hidden; margin-bottom:14px;">',
                '  <div style="background:#1e293b; padding:8px 12px; text-align:center; font-size:12px; font-weight:800; color:#e2e8f0; border-bottom:1px solid #28354e;">본인내역 (' + nextRank + ' 승급 기준)</div>',
                '  <div style="display:grid; grid-template-columns:1fr 1.2fr 1fr 1.2fr; border-bottom:1px solid #1e293b; font-size:12px;">',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827;">본인누적매출</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:800; color:#ffffff; font-family:monospace;">' + metrics.selfAccPV.toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827; border-left:1px solid #1e293b;">최근매출일자</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:700; color:#e2e8f0; font-family:monospace;">' + metrics.lastSaleDate + '</div>',
                '  </div>',
                '  <div style="display:grid; grid-template-columns:1fr 1.2fr 1fr 1.2fr; font-size:12px;">',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827;">' + nextRank + ' 목표 PV</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:800; color:#60a5fa; font-family:monospace;">' + reqPV.toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827; border-left:1px solid #1e293b;">승급까지 부족 PV</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:800; color:' + lackColor + '; font-family:monospace;">-' + lackPV.toLocaleString('ko-KR') + ' PV</div>',
                '  </div>',
                '</div>',
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 14px;">',
                '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">',
                '    <div style="font-size:12.5px; font-weight:800; color:#e2e8f0;">[' + currRank + '] 품위유지 등급 달성 현황 (기준기수: ' + pKeys.periodLabel + ')</div>',
                '    <div style="font-size:11.5px; font-weight:700; color:#94a3b8; background:#1e293b; border:1px solid #334155; padding:3px 10px; border-radius:4px;">적용 대상 아님 (DIRECTOR 직급부터 적용)</div>',
                '  </div>',
                '  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">[' + currRank + '] 유지 기준 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#94a3b8;">해당 없음 (0 CV)</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">당기 본인 매출 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#e2e8f0; font-family:monospace;">' + metrics.selfTermCV.toLocaleString('ko-KR') + ' CV</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">품위유지 적용 안내</div>',
                '      <div style="font-size:12px; font-weight:700; color:#60a5fa;">DIRECTOR 승급 후 적용</div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');

            return { title: '[' + mName + ' (' + cleanId + ')]', html: htmlMember };
        }

        var rankTargets = {
            'MANIA': { next: 'DIRECTOR', pv: 2100000, r4: true, condTitle: '② 직접추천 파트너 조건', condText: '좌/우 각 MANIA 1명' },
            'DIRECTOR': { next: 'EMERALD', pv: 14000000, r4: true, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 DIRECTOR 1명' },
            'EMERALD': { next: 'DIAMOND', pv: 100000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 DIRECTOR 1명' },
            'DIAMOND': { next: 'GREEN DIAMOND', pv: 250000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 EMERALD 1명' },
            'GREEN DIAMOND': { next: 'BLUE DIAMOND', pv: 500000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 DIAMOND 1명' },
            'BLUE DIAMOND': { next: 'RED DIAMOND', pv: 1000000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 GREEN DIAMOND 1명' },
            'RED DIAMOND': { next: 'CROWN', pv: 2000000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '좌/우 각 BLUE DIAMOND 1명' },
            'CROWN': { next: 'CROWN', pv: 2000000000, r4: false, condTitle: '② 하위 육성 파트너 조건', condText: '최고 직급 달성' }
        };
        var tObj = rankTargets[currRank] ? rankTargets[currRank] : rankTargets['MANIA'];
        var evalAPV = tObj.r4 ? metrics.recent4APV : metrics.accAPV;
        var evalBPV = tObj.r4 ? metrics.recent4BPV : metrics.accBPV;
        var minorPV = Math.min(evalAPV, evalBPV);
        var promoShortage = Math.max(0, tObj.pv - minorPV);
        var promoPct = tObj.pv > 0 ? Math.min(100, Math.floor((minorPV / tObj.pv) * 100)) : 0;

        var subTableSectionHtml = '';
        if (tObj.r4) {
            var rRowsHtml = metrics.recent4Rows.map(function(r) {
                return [
                    '<div style="display:grid; grid-template-columns:1.1fr 1.1fr 1.1fr 1.1fr; border-top:1px solid #1e293b; font-size:11.5px;">',
                    '  <div style="padding:7px 10px; color:#94a3b8; background:#111827;">' + r.label + ' (좌)</div>',
                    '  <div style="padding:7px 10px; text-align:right; font-weight:700; color:#e2e8f0; font-family:monospace;">' + r.aPV.toLocaleString('ko-KR') + ' PV</div>',
                    '  <div style="padding:7px 10px; color:#94a3b8; background:#111827; border-left:1px solid #1e293b;">' + r.label + ' (우)</div>',
                    '  <div style="padding:7px 10px; text-align:right; font-weight:700; color:#e2e8f0; font-family:monospace;">' + r.bPV.toLocaleString('ko-KR') + ' PV</div>',
                    '</div>'
                ].join('');
            }).join('');

            subTableSectionHtml = [
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; overflow:hidden; margin-bottom:12px;">',
                '  <div style="background:#1e293b; padding:7px 12px; text-align:center; font-size:12px; font-weight:800; color:#e2e8f0; border-bottom:1px solid #28354e;">하위내역 (최근 4기수 제한 실적 합산)</div>',
                '  <div style="display:grid; grid-template-columns:1.1fr 1.1fr 1.1fr 1.1fr; font-size:12px; background:#162032;">',
                '    <div style="padding:8px 10px; color:#38bdf8; font-weight:800;">4기수 합계 (좌측)</div>',
                '    <div style="padding:8px 10px; text-align:right; font-weight:800; color:#38bdf8; font-family:monospace;">' + evalAPV.toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="padding:8px 10px; color:#34d399; font-weight:800; border-left:1px solid #1e293b;">4기수 합계 (우측)</div>',
                '    <div style="padding:8px 10px; text-align:right; font-weight:800; color:#34d399; font-family:monospace;">' + evalBPV.toLocaleString('ko-KR') + ' PV</div>',
                '  </div>',
                rRowsHtml,
                '</div>'
            ].join('');
        } else {
            var isALarger = (evalAPV >= evalBPV);
            var tagA = isALarger
                ? '<span style="background:#1e3a8a;color:#93c5fd;padding:1px 6px;border-radius:4px;font-size:10px;margin-right:6px;">대실적</span>'
                : '<span style="background:#7f1d1d;color:#fca5a5;padding:1px 6px;border-radius:4px;font-size:10px;margin-right:6px;">★ 소실적</span>';
            var tagB = !isALarger
                ? '<span style="background:#1e3a8a;color:#93c5fd;padding:1px 6px;border-radius:4px;font-size:10px;margin-right:6px;">대실적</span>'
                : '<span style="background:#7f1d1d;color:#fca5a5;padding:1px 6px;border-radius:4px;font-size:10px;margin-right:6px;">★ 소실적</span>';

            subTableSectionHtml = [
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; overflow:hidden; margin-bottom:12px;">',
                '  <div style="background:#1e293b; padding:7px 12px; text-align:center; font-size:12px; font-weight:800; color:#e2e8f0; border-bottom:1px solid #28354e;">전체누적 PV (무한 누적 기준)</div>',
                '  <div style="display:grid; grid-template-columns:0.7fr 1.5fr 0.7fr 1.5fr; border-bottom:1px solid #1e293b; font-size:12px;">',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827;">좌(A)</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:800; color:#60a5fa; font-family:monospace;">' + tagA + evalAPV.toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="padding:10px 12px; color:#94a3b8; background:#111827; border-left:1px solid #1e293b;">우(B)</div>',
                '    <div style="padding:10px 12px; text-align:right; font-weight:800; color:#fbbf24; font-family:monospace;">' + tagB + evalBPV.toLocaleString('ko-KR') + ' PV</div>',
                '  </div>',
                '  <div style="background:#1e293b; padding:6px 12px; text-align:center; font-size:11.5px; font-weight:800; color:#cbd5e1; border-bottom:1px solid #28354e;">' + tObj.next + ' 승급까지 부족 PV</div>',
                '  <div style="display:grid; grid-template-columns:0.7fr 1.5fr 0.7fr 1.5fr; font-size:12px;">',
                '    <div style="padding:9px 12px; color:#94a3b8; background:#111827;">좌(A)</div>',
                '    <div style="padding:9px 12px; text-align:right; font-weight:700; color:#f87171; font-family:monospace;">-' + Math.max(0, tObj.pv - evalAPV).toLocaleString('ko-KR') + ' PV</div>',
                '    <div style="padding:9px 12px; color:#94a3b8; background:#111827; border-left:1px solid #1e293b;">우(B)</div>',
                '    <div style="padding:9px 12px; text-align:right; font-weight:700; color:#f87171; font-family:monospace;">-' + Math.max(0, tObj.pv - evalBPV).toLocaleString('ko-KR') + ' PV</div>',
                '  </div>',
                '</div>'
            ].join('');
        }

        var reqMaintCV = getRequiredMaintCvForRankV44(currRank);
        var totalRecognizedCV = metrics.minorSubTermCV + metrics.selfTermCV;
        var maintPct = reqMaintCV > 0 ? Math.floor((totalRecognizedCV / reqMaintCV) * 100) : 0;
        var maintShortage = Math.max(0, reqMaintCV - totalRecognizedCV);

        var maintSectionHtml = '';
        if (currRank === 'MANIA') {
            maintSectionHtml = [
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 14px;">',
                '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">',
                '    <div style="font-size:12.5px; font-weight:800; color:#e2e8f0;">[MANIA] 품위유지 등급 달성 현황 (기준기수: ' + pKeys.periodLabel + ')</div>',
                '    <div style="font-size:11.5px; font-weight:700; color:#94a3b8; background:#1e293b; border:1px solid #334155; padding:3px 10px; border-radius:4px;">적용 대상 아님 (DIRECTOR 직급부터 적용)</div>',
                '  </div>',
                '  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">[MANIA] 유지 기준 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#94a3b8;">0 CV</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">해당기수 인정 소실적 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#60a5fa; font-family:monospace;">' + totalRecognizedCV.toLocaleString('ko-KR') + ' CV</div>',
                '      <div style="font-size:10px; color:#94a3b8; margin-top:2px;">(하위공제: ' + metrics.minorSubTermCV.toLocaleString('ko-KR') + ' + 본인: ' + metrics.selfTermCV.toLocaleString('ko-KR') + ')</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">품위유지 부족분 CV</div>',
                '      <div style="font-size:12px; font-weight:700; color:#f87171;">해당 없음</div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
        } else {
            var maintEval = evaluateMaintStatusAndDisplayLabelV35(currRank, totalRecognizedCV, reqMaintCV);

            maintSectionHtml = [
                '<div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:12px 14px;">',
                '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">',
                '    <div style="font-size:12.5px; font-weight:800; color:#e2e8f0;">[' + currRank + '] 품위유지 등급 달성 현황 (기준기수: ' + pKeys.periodLabel + ')</div>',
                '    <div style="display:flex; align-items:center; gap:8px;">',
                '      ' + maintEval.labelHtml,
                '      <span style="background:#1e293b; border:1px solid #334155; color:#f8fafc; padding:2px 8px; border-radius:4px; font-size:11.5px; font-weight:800;">달성률: ' + maintPct + '%</span>',
                '    </div>',
                '  </div>',
                '  <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; overflow:hidden; margin-bottom:10px;">',
                '    <div style="background:#1e293b; padding:5px 10px; text-align:center; font-size:11px; font-weight:800; color:#e2e8f0;">본인 당기 매출 내역</div>',
                '    <div style="display:grid; grid-template-columns:1fr 1.2fr 1fr 1.2fr; font-size:11.5px;">',
                '      <div style="padding:7px 10px; color:#94a3b8;">당기 본인 CV</div>',
                '      <div style="padding:7px 10px; text-align:right; font-weight:800; color:#fff; font-family:monospace;">' + metrics.selfTermCV.toLocaleString('ko-KR') + ' CV</div>',
                '      <div style="padding:7px 10px; color:#94a3b8; border-left:1px solid #1e293b;">최근 매출일자</div>',
                '      <div style="padding:7px 10px; text-align:right; font-weight:700; color:#e2e8f0; font-family:monospace;">' + metrics.lastSaleDate + '</div>',
                '    </div>',
                '  </div>',
                '  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">[' + currRank + '] 유지 기준 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#f8fafc; font-family:monospace;">' + reqMaintCV.toLocaleString('ko-KR') + ' CV</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">해당기수 인정 소실적 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:#60a5fa; font-family:monospace;">' + totalRecognizedCV.toLocaleString('ko-KR') + ' CV</div>',
                '      <div style="font-size:10px; color:#94a3b8; margin-top:2px;">(하위공제: ' + metrics.minorSubTermCV.toLocaleString('ko-KR') + ' + 본인: ' + metrics.selfTermCV.toLocaleString('ko-KR') + ')</div>',
                '    </div>',
                '    <div style="background:#111827; border:1px solid #1e293b; border-radius:6px; padding:10px; text-align:center;">',
                '      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">품위유지 부족분 CV</div>',
                '      <div style="font-size:13px; font-weight:800; color:' + (maintShortage > 0 ? '#f87171' : '#10b981') + '; font-family:monospace;">' + (maintShortage > 0 ? ('-' + maintShortage.toLocaleString('ko-KR') + ' CV') : '✓ 달성 완료') + '</div>',
                '    </div>',
                '  </div>',
                '</div>'
            ].join('');
        }

        var fullHtml = [
            '<div style="background:#162032; border:1px solid #2d3d5b; border-radius:8px; padding:12px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;">',
            '  <div>',
            '    <div style="font-size:11.5px; color:#94a3b8; margin-bottom:4px;">기준기수: ' + pKeys.periodLabel + ' (' + pKeys.startDate + ' ~ ' + pKeys.endDate + ')</div>',
            '    <div style="font-size:15px; font-weight:800; color:#60a5fa;">승급 목표 : <span style="color:#fbbf24;">' + currRank + '</span> ➔ <span style="color:#38bdf8;">' + tObj.next + '</span></div>',
            '  </div>',
            '  <div style="background:#272324; border:1px solid #b45309; color:#fbbf24; padding:5px 12px; border-radius:6px; font-size:12.5px; font-weight:800;">소실적 달성률: ' + promoPct + '%</div>',
            '</div>',
            '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:12px;">',
            '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:10px; text-align:center;">',
            '    <div style="font-size:11px; color:#64748b; margin-bottom:4px;">① 소실적 목표 PV</div>',
            '    <div style="font-size:14px; font-weight:800; color:#f8fafc; font-family:monospace; margin-bottom:3px;">' + tObj.pv.toLocaleString('ko-KR') + ' PV</div>',
            '    <div style="font-size:11px; font-weight:700; color:' + (promoShortage > 0 ? '#f87171' : '#10b981') + ';">' + (promoShortage > 0 ? ('부족: -' + promoShortage.toLocaleString('ko-KR') + ' PV') : '✓ 목표 달성') + '</div>',
            '  </div>',
            '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:10px; text-align:center;">',
            '    <div style="font-size:11px; color:#64748b; margin-bottom:4px;">' + tObj.condTitle + '</div>',
            '    <div style="font-size:12.5px; font-weight:800; color:#f8fafc; margin-bottom:3px;">' + tObj.condText + '</div>',
            '    <div style="font-size:11px; font-weight:700; color:#10b981;">✓ 계보도 라인 기준</div>',
            '  </div>',
            '  <div style="background:#151d2e; border:1px solid #28354e; border-radius:8px; padding:10px; text-align:center;">',
            '    <div style="font-size:11px; color:#64748b; margin-bottom:4px;">③ 적용 기준 규정</div>',
            '    <div style="font-size:12.5px; font-weight:800; color:' + (tObj.r4 ? '#10b981' : '#fbbf24') + '; margin-bottom:3px;">' + (tObj.r4 ? '4기수 제한 적용' : '전체 누적 인정') + '</div>',
            '    <div style="font-size:10.5px; color:#94a3b8;">' + (tObj.r4 ? '연속 4개 기수 합산 실적' : '기간 제한 없음 (무한 누적)') + '</div>',
            '  </div>',
            '</div>',
            subTableSectionHtml,
            maintSectionHtml
        ].join('');

        return { title: '[' + mName + ' (' + cleanId + ')]', html: fullHtml };
    }

    window.openInstantNavigatorV35 = function(optMemberId) {
        var targetId = optMemberId ? String(optMemberId).trim().toUpperCase() : '';

        if (!targetId && window.currentSelectedId) {
            var cand = String(window.currentSelectedId).trim().toUpperCase();
            if (isEntryMatchingCurrentMode(cand)) targetId = cand;
        }
        if (!targetId) {
            var selCard = document.querySelector('.node-card.selected, .node-card.active');
            if (selCard) targetId = extractMemberIdFromCardEl(selCard);
        }
        if (!targetId) {
            var topC = findTopMostPartnerCard();
            if (topC) targetId = extractMemberIdFromCardEl(topC);
        }
        if (!targetId) return;

        window.currentSelectedId = targetId;

        var modalRefs = ensureBizNavModalContainerExistsV35();
        var built = buildInstantNavigatorHtmlV35(targetId);

        if (modalRefs.badge) modalRefs.badge.innerText = built.title;
        modalRefs.body.innerHTML = built.html;
        modalRefs.modal.classList.remove('hidden');

        var isOverlayWrap = modalRefs.modal.querySelector('#bizNavDialogBox') !== null;
        modalRefs.modal.style.setProperty('display', isOverlayWrap ? 'flex' : 'block', 'important');

        window.renderTreeCardStatusBadgesV44(true);
    };

    window.openBusinessNavigatorModal = window.openInstantNavigatorV35;
    window.renderBusinessNavigator = window.openInstantNavigatorV35;

    window.renderTreeCardStatusBadgesV44 = function(forceRebuild) {
        ensureTreeContainerMutationObserverV35();
        syncHeaderPeriodForActiveModeV35(false);

        var cards = document.querySelectorAll('.node-card');
        if (!cards ? true : cards.length === 0) return;

        ensureGlobalSalesAndTreeIndexedV35();

        var pKeys = getActiveHeaderPeriodKeysV44();

        if (!forceRebuild) {
            for (var chk = 0; chk < cards.length; chk++) {
                var chkCard = cards[chk];
                var chkId = extractMemberIdFromCardEl(chkCard);
                if (!chkId) continue;
                var chkNorm = normNumStr(chkId);
                var periodKeyForMember = pKeys.sortKeyNum + '_' + chkNorm;
                if (periodRankByNormMap.has(periodKeyForMember)) {
                    var expectedR = periodRankByNormMap.get(periodKeyForMember);
                    var currentDomR = extractRankFromCardDOM(chkCard, '');
                    if (currentDomR !== expectedR) {
                        forceRebuild = true;
                        break;
                    }
                }
            }
        }

        var allSales = getAllActiveSalesArray();
        var thObj = window.getBadgeThresholdSettingsV44();
        var firstCardId = extractMemberIdFromCardEl(cards[0]);
        var activeMode = detectActiveCanvasModeV35();
        var mapSize = (window.lastAllMembersTeamBonusMap instanceof Map) ? window.lastAllMembersTeamBonusMap.size : 0;

        var globalStateSig = activeMode + '_' + cards.length + '_' + firstCardId + '_' + allSales.length + '_' + memberNodeByNormMap.size + '_' + binaryChildrenByParentNormMap.size + '_' + mapSize + '_' + pKeys.startDate + '_' + pKeys.endDate + '_' + thObj.promoThreshold;

        if (!forceRebuild && globalStateSig === lastDomBadgeRenderSig) {
            return;
        }
        lastDomBadgeRenderSig = globalStateSig;

        var topCard = findTopMostPartnerCard();
        var topMostNormId = topCard ? normNumStr(extractMemberIdFromCardEl(topCard)) : '';

        isEnforcingDomSync = true;
        try {
            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                var memberId = extractMemberIdFromCardEl(card);
                if (!memberId) continue;
                var mNorm = normNumStr(memberId);
                var pKey = pKeys.sortKeyNum + '_' + mNorm;

                var oldBadges = card.querySelectorAll('.bs-card-top-badges');
                for (var o = 0; o < oldBadges.length; o++) oldBadges[o].style.display = 'none';

                var status = window.evaluateMemberCardBadgeStatusV44(memberId, card);
                var badgeWrap = card.querySelector('.bs-custom-badge-layer-v44');
                if (!status.showPromoBadge && !status.showMaintBadge) {
                    cachedBadgeHtmlByPeriodAndNormMap.set(pKey, { html: '', justify: 'flex-end' });
                    if (badgeWrap) badgeWrap.remove();
                    continue;
                }

                card.style.setProperty('overflow', 'visible', 'important');
                if (!badgeWrap) {
                    badgeWrap = document.createElement('div');
                    badgeWrap.className = 'bs-custom-badge-layer-v44';
                    card.appendChild(badgeWrap);
                }
                badgeWrap.setAttribute('data-badge-member-id', memberId);

                var justify = (status.showMaintBadge && status.showPromoBadge) ? 'space-between' : (status.showMaintBadge ? 'flex-start' : 'flex-end');
                var isTopMost = (mNorm === topMostNormId);
                if (isTopMost) {
                    badgeWrap.style.cssText = 'position:absolute !important; top:6px !important; left:calc(100% + 5px) !important; display:flex !important; flex-direction:column !important; gap:4px !important; z-index:999 !important; pointer-events:auto !important;';
                } else {
                    badgeWrap.style.cssText = 'position:absolute !important; top:-9px !important; left:-2px !important; right:-2px !important; width:calc(100% + 4px) !important; display:flex !important; flex-direction:row !important; justify-content:' + justify + ' !important; z-index:999 !important; pointer-events:auto !important;';
                }

                var htmlParts = [];
                if (status.showMaintBadge) {
                    htmlParts.push('<span class="bs-v35-badge-btn" data-badge-member-id="' + memberId + '" style="display:inline-flex;align-items:center;height:16px;padding:0 5px;background:#34966b;color:#fff;border:1px solid #86efac;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.7);cursor:pointer;" title="클릭 시 비지네스 내비게이터 즉시 열기">유지 ' + status.maintPct + '%</span>');
                }
                if (status.showPromoBadge) {
                    htmlParts.push('<span class="bs-v35-badge-btn" data-badge-member-id="' + memberId + '" style="display:inline-flex;align-items:center;height:16px;padding:0 5px;background:#c88a2e;color:#fff;border:1px solid #fcd34d;border-radius:2px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.7);cursor:pointer;" title="클릭 시 비지네스 내비게이터 즉시 열기">승급 ' + status.promoPct + '%</span>');
                }
                var builtHtml = htmlParts.join('');
                cachedBadgeHtmlByPeriodAndNormMap.set(pKey, { html: builtHtml, justify: justify });
                badgeWrap.innerHTML = builtHtml;
            }
        } finally {
            isEnforcingDomSync = false;
        }
    };

    function isHeaderCompassButtonElement(el) {
        if (!el ? true : !el.closest) return null;
        var btn = el.closest('button, a, div[role="button"], span');
        if (!btn) return null;
        if (btn.children.length > 2) return null;
        var txt = String(btn.innerText ? btn.innerText : '').trim();
        var title = String(btn.getAttribute('title') ? btn.getAttribute('title') : '').trim();
        var id = String(btn.id ? btn.id : '').toLowerCase();
        if (
            txt === '🧭' ? true :
            title.indexOf('내비게이터') !== -1 ? true :
            title.indexOf('네비게이터') !== -1 ? true :
            id.indexOf('biznav') !== -1 ? true :
            id.indexOf('compass') !== -1 ? true :
            id.indexOf('navigator') !== -1
        ) {
            if (btn.closest('#bizNavModal')) return null;
            return btn;
        }
        return null;
    }

    function isNavigatorCloseButtonOrBackdrop(targetEl) {
        if (!targetEl) return false;
        if (navDragState.isDragging ? true : navDragState.hasMoved) return false;

        var navModal = document.getElementById('bizNavModal');
        if (!navModal) return false;

        var mRect = navModal.getBoundingClientRect();
        if (targetEl === navModal && mRect.width >= window.innerWidth * 0.92) {
            return true;
        }

        if (targetEl.closest && targetEl.closest('#bizNavModal')) {
            var btn = targetEl.closest('button, a, span[role="button"], div[role="button"]');
            if (btn) {
                var txt = String(btn.innerText ? btn.innerText : '').trim();
                var bId = String(btn.id ? btn.id : '').toLowerCase();
                var bCls = String(btn.className ? btn.className : '').toLowerCase();
                if (
                    txt.indexOf('닫기') !== -1 ? true :
                    txt === '✕' ? true :
                    txt === '✖' ? true :
                    txt === 'X' ? true :
                    txt === '×' ? true :
                    bId.indexOf('close') !== -1 ? true :
                    bCls.indexOf('close') !== -1
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    function isNavigatorFitButton(targetEl) {
        if (!targetEl ? true : !targetEl.closest) return false;
        if (!targetEl.closest('#bizNavModal')) return false;
        var btn = targetEl.closest('button, a, span[role="button"]');
        if (!btn) return false;
        var txt = String(btn.innerText ? btn.innerText : '').trim();
        var bId = String(btn.id ? btn.id : '').toLowerCase();
        return Boolean(txt.indexOf('내용 맞춤') !== -1 ? true : (bId.indexOf('fit') !== -1));
    }

    function handleFastInterceptV35(e) {
        if (isNavigatorCloseButtonOrBackdrop(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            window.closeInstantNavigatorV35();
            return;
        }

        if (isNavigatorFitButton(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e.type === 'mousedown') {
                fitInstantNavigatorHeightV35();
            }
            return;
        }

        var navBtnInfo = isHeaderPeriodNavButtonV35(e.target);
        if (navBtnInfo) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e.type === 'mousedown') {
                var activeMode = detectActiveCanvasModeV35();
                var curStore = modePeriodStoreV35[activeMode] ? modePeriodStoreV35[activeMode] : getDefaultPeriodForModeV35(activeMode);
                var nextPeriod = shiftHalfMonthPeriodV35(curStore.startDate, curStore.endDate, navBtnInfo.dir);
                window.applyTimeSlipPeriodChangeV35(nextPeriod.startDate, nextPeriod.endDate, true);
            }
            return;
        }

        if (e.type === 'mousedown' && e.button === 0) {
            var dragInfo = findNavigatorBoxAndHeaderFromTargetV35(e.target);
            if (dragInfo && dragInfo.box) {
                var isBtn = e.target.closest && e.target.closest('button, a, input, select');
                if (!isBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

                    var bRect = dragInfo.box.getBoundingClientRect();
                    navDragState.isDragging = true;
                    navDragState.hasMoved = false;
                    navDragState.targetEl = dragInfo.box;
                    navDragState.startX = e.clientX;
                    navDragState.startY = e.clientY;
                    navDragState.origLeft = bRect.left;
                    navDragState.origTop = bRect.top;

                    dragInfo.box.style.setProperty('position', 'fixed', 'important');
                    dragInfo.box.style.setProperty('left', Math.round(bRect.left) + 'px', 'important');
                    dragInfo.box.style.setProperty('top', Math.round(bRect.top) + 'px', 'important');
                    dragInfo.box.style.setProperty('right', 'auto', 'important');
                    dragInfo.box.style.setProperty('bottom', 'auto', 'important');
                    dragInfo.box.style.setProperty('margin', '0', 'important');
                    dragInfo.box.style.setProperty('transform', 'none', 'important');
                    return;
                }
            }
        }

        var badgeTarget = e.target && e.target.closest ? e.target.closest('.bs-custom-badge-layer-v44, .bs-v35-badge-btn') : null;
        if (badgeTarget) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e.type === 'mousedown') {
                var mId = badgeTarget.getAttribute('data-badge-member-id');
                if (!mId) {
                    var parentCard = badgeTarget.closest('.node-card');
                    mId = extractMemberIdFromCardEl(parentCard);
                }
                if (mId) {
                    window.openInstantNavigatorV35(mId);
                }
            }
            return;
        }

        var compassBtn = isHeaderCompassButtonElement(e.target);
        if (compassBtn) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e.type === 'mousedown') {
                window.openInstantNavigatorV35();
            }
            return;
        }

        if (e.type === 'click') {
            var clickedBtn = e.target && e.target.closest ? e.target.closest('button') : null;
            if (clickedBtn) {
                var bTxt = String(clickedBtn.innerText ? clickedBtn.innerText : '').trim();
                if (bTxt === 'VJ' ? true : (bTxt === 'VK' ? true : (bTxt.indexOf('매출') !== -1 ? true : (bTxt.indexOf('저장') !== -1 ? true : (bTxt.indexOf('등록') !== -1))))) {
                    indexedSalesCount = -1;
                    indexedPeriodKey = '';
                    periodRankByNormMap.clear();
                    cachedBadgeHtmlByPeriodAndNormMap.clear();
                    lastDomBadgeRenderSig = '';
                    setTimeout(function() {
                        syncHeaderPeriodForActiveModeV35(false);
                        window.renderTreeCardStatusBadgesV44(true);
                    }, 60);
                    setTimeout(function() {
                        syncHeaderPeriodForActiveModeV35(false);
                        window.renderTreeCardStatusBadgesV44(true);
                    }, 250);
                }
            }
        }

        if (e.type === 'mousedown' ? true : (e.type === 'click')) {
            var cardTarget = e.target && e.target.closest ? e.target.closest('.node-card') : null;
            if (cardTarget) {
                var cId = extractMemberIdFromCardEl(cardTarget);
                if (cId) {
                    window.currentSelectedId = cId;
                    fastApplyCachedRanksAndBadgesToAllCardsV35();
                    Promise.resolve().then(fastApplyCachedRanksAndBadgesToAllCardsV35);
                }
            }
        }
    }

    window.addEventListener('mousedown', handleFastInterceptV35, true);
    window.addEventListener('click', handleFastInterceptV35, true);

    function handleCanvasDragClampV35(e) {
        if (navDragState.isDragging && navDragState.targetEl) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            var dx = e.clientX - navDragState.startX;
            var dy = e.clientY - navDragState.startY;
            if (Math.abs(dx) > 2 ? true : (Math.abs(dy) > 2)) {
                navDragState.hasMoved = true;
            }

            var newL = Math.round(navDragState.origLeft + dx);
            var newT = Math.round(navDragState.origTop + dy);

            if (newT < 4) newT = 4;
            if (newT > window.innerHeight - 45) newT = window.innerHeight - 45;

            navDragState.targetEl.style.setProperty('position', 'fixed', 'important');
            navDragState.targetEl.style.setProperty('left', newL + 'px', 'important');
            navDragState.targetEl.style.setProperty('top', newT + 'px', 'important');
            navDragState.targetEl.style.setProperty('right', 'auto', 'important');
            navDragState.targetEl.style.setProperty('bottom', 'auto', 'important');
            navDragState.targetEl.style.setProperty('margin', '0', 'important');
            navDragState.targetEl.style.setProperty('transform', 'none', 'important');
            return;
        }

        if (e.buttons === 1 ? true : (e.which === 1)) {
            window.clampCanvasTopPartnerBoundaryV42();
        }
    }

    window.addEventListener('mousemove', handleCanvasDragClampV35, true);
    window.addEventListener('mousemove', function(e) {
        if (!navDragState.isDragging && (e.buttons === 1 ? true : (e.which === 1))) {
            window.clampCanvasTopPartnerBoundaryV42();
        }
    }, false);

    window.addEventListener('mouseup', function(e) {
        if (navDragState.isDragging) {
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            navDragState.isDragging = false;
            setTimeout(function() {
                navDragState.hasMoved = false;
            }, 60);
            return;
        }
        window.clampCanvasTopPartnerBoundaryV42();
    }, true);
    window.addEventListener('mouseup', function() {
        if (!navDragState.isDragging) window.clampCanvasTopPartnerBoundaryV42();
    }, false);

    function handleCanvasWheelAndScrollClampV35(e) {
        if (e.target && e.target.closest && (e.target.closest('#bizNavModal') ? true : e.target.closest('#bs-line-move-custom-modal-v43'))) {
            return;
        }
        window.clampCanvasTopPartnerBoundaryV42();
        requestAnimationFrame(window.clampCanvasTopPartnerBoundaryV42);
        setTimeout(window.clampCanvasTopPartnerBoundaryV42, 20);
    }

    window.addEventListener('wheel', handleCanvasWheelAndScrollClampV35, { passive: true, capture: false });
    window.addEventListener('scroll', handleCanvasWheelAndScrollClampV35, { passive: true, capture: true });
    window.addEventListener('touchmove', handleCanvasWheelAndScrollClampV35, { passive: true, capture: false });

    function wrapSyncPostGuardV35(fnName) {
        if (typeof window[fnName] === 'function' && !window[fnName]._v35Wrapped) {
            var origFn = window[fnName];
            var wrappedFn = function() {
                var r = origFn.apply(this, arguments);
                syncHeaderPeriodForActiveModeV35(false);
                fastApplyCachedRanksAndBadgesToAllCardsV35();
                window.clampCanvasTopPartnerBoundaryV42();
                return r;
            };
            wrappedFn._v35Wrapped = true;
            window[fnName] = wrappedFn;
        }
    }

    wrapSyncPostGuardV35('renderTree');
    wrapSyncPostGuardV35('executeNodeSingleClick');
    wrapSyncPostGuardV35('calculateLocalPerformance');

    ensureTreeContainerMutationObserverV35();
    setTimeout(function() {
        syncHeaderPeriodForActiveModeV35(false);
        window.renderTreeCardStatusBadgesV44(true);
        window.clampCanvasTopPartnerBoundaryV42();
    }, 100);
    setTimeout(function() {
        syncHeaderPeriodForActiveModeV35(false);
        window.renderTreeCardStatusBadgesV44(true);
        window.clampCanvasTopPartnerBoundaryV42();
    }, 350);
    setTimeout(function() {
        syncHeaderPeriodForActiveModeV35(false);
        window.renderTreeCardStatusBadgesV44(true);
        window.clampCanvasTopPartnerBoundaryV42();
    }, 800);

    setInterval(function() {
        window.renderTreeCardStatusBadgesV44(false);
    }, 250);

    console.log('[Cellvia Sim] Independent Mode Period & Top-Join-Date Default Patch Loaded:', PATCH_VERSION);
})();