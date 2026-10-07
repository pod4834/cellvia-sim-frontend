// frontend/css/js/main.js
// cellvia_db.integrated_sales_history DB 연동 및 계보도/매출 시뮬레이션 메인 엔진

// ============================================================================
// 🌟 [최상단 정의 0] 전역 변수, 캐시 및 모든 전역 함수 최우선 사전 바인딩
// ============================================================================

window.currentSelectedId = window.currentSelectedId || null;
window.recommenderRootId = window.recommenderRootId || null;
window.currentPeriodAnchorDate = window.currentPeriodAnchorDate || new Date();
window.salesSortOrder = window.salesSortOrder || 'desc';
window.cardClickTimer = null;
window.addPartnerState = window.addPartnerState || { recommenderId: null, sponsorId: null, position: 'left', isAddingParent: false };

// DB 매출 이력 전역 배열 및 실적 연산 캐시 메모리
window.integrated_sales_history = window.integrated_sales_history || [];
window.perfCache = {};

// 🌟 HTML 인라인 이벤트 및 트리 제어 전역 함수 사전 안전 바인딩
window.renderTree = window.renderTree || function() {};
window.fetchTreeData = window.fetchTreeData || function() {};
window.calculateLocalPerformance = window.calculateLocalPerformance || function() {};
window.toggleTreeMode = window.toggleTreeMode || function() {};
window.searchPanelMember = window.searchPanelMember || function(e, el) {};
window.clickSearchPanel = window.clickSearchPanel || function() {};
window.toggleSalesSidebar = window.toggleSalesSidebar || function() {};
window.toggleSalesSort = window.toggleSalesSort || function() {};
window.removeTaskbarItem = window.removeTaskbarItem || function(id) {};
window.toggleSettingsMenu = window.toggleSettingsMenu || function(e) {};
window.togglePerfSidebar = window.togglePerfSidebar || function(e) {};
window.toggleWidgetGlobal = window.toggleWidgetGlobal || function(chkId, wId) {};
window.closeWidgetGlobal = window.closeWidgetGlobal || function(e, wId, chkId) {};
window.applyPeriodPreset = window.applyPeriodPreset || function(preset) {};
window.navigatePeriod = window.navigatePeriod || function(dir) {};
window.searchPeriodSales = window.searchPeriodSales || function() {};
window.addPeriodSalesRow = window.addPeriodSalesRow || function() {};
window.toggleAllPeriodRows = window.toggleAllPeriodRows || function(chk) {};
window.updatePeriodSummary = window.updatePeriodSummary || function() {};
window.updatePeriodRow = window.updatePeriodRow || function() {};
window.updatePeriodRowNum = window.updatePeriodRowNum || function() {};
window.deletePeriodSalesRow = window.deletePeriodSalesRow || function(id) {};
window.addSalesRow = window.addSalesRow || function() {};
window.saveSalesData = window.saveSalesData || function() {};
window.closeBonusDetailModal = window.closeBonusDetailModal || function() {};
window.openBonusDetailModal = window.openBonusDetailModal || function() {};
window.openEditMemberModal = window.openEditMemberModal || function(id) {};
window.submitEditMember = window.submitEditMember || function() {};
window.closeEditMemberModal = window.closeEditMemberModal || function() {};

// 카드 표시 설정
window.cardSettings = window.cardSettings || {
    id: true, name: true, rank: true, type: true, code: true, joinDate: true,
    recName: true, recId: true, firstSales: false, lastSales: false
};

// 🌟 [DB bonus_matching 테이블 기준 직급별 세대 요율 마스터]
window.BONUS_MATCHING_RATES = {
    'CROWN':         [0.10, 0.05, 0.05, 0.03, 0.03],
    'RED DIAMOND':   [0.10, 0.05, 0.05, 0.03, 0.02],
    'BLUE DIAMOND':  [0.10, 0.05, 0.05, 0.03, 0.00],
    'GREEN DIAMOND': [0.10, 0.05, 0.05, 0.02, 0.00],
    'DIAMOND':       [0.10, 0.05, 0.05, 0.00, 0.00],
    'EMERALD':       [0.10, 0.05, 0.00, 0.00, 0.00],
    'DIRECTOR':      [0.10, 0.00, 0.00, 0.00, 0.00],
    'MANIA':         [0.00, 0.00, 0.00, 0.00, 0.00],
    'MEMBER':        [0.00, 0.00, 0.00, 0.00, 0.00]
};

// 백엔드 통신 실패 시 계보도 표출용 기본 트리 데이터
if (!window.treeData || !window.treeData.id) {
    window.treeData = {
        id: 'VK-1199458',
        name: '성명수',
        rank: 'MANIA',
        type: '사업자',
        code: 'm',
        joinDate: '2026-04-20',
        left: {
            id: 'VK-1199464',
            name: '박성혜',
            rank: 'EMERALD',
            type: '사업자',
            code: 'm1-a1',
            joinDate: '2026-04-20',
            recId: 'VK-1199458',
            left: {
                id: 'VK-1199472',
                name: '구본진',
                rank: 'DIRECTOR',
                type: '사업자',
                code: 'm1-a2',
                joinDate: '2026-04-20',
                recId: 'VK-1199464',
                left: {
                    id: 'VK-1199474',
                    name: '김숙희',
                    rank: 'MANIA',
                    type: '사업자',
                    code: 'm1-a3',
                    joinDate: '2026-04-20',
                    recId: 'VK-1199472',
                    left: {
                        id: 'VK-1209568',
                        name: '이백합',
                        rank: 'MANIA',
                        type: '사업자',
                        code: 'm1-a4',
                        joinDate: '2026-04-20',
                        recId: 'VK-1199474',
                        left: {
                            id: 'VK-1201678',
                            name: '김기영',
                            rank: 'MANIA',
                            type: '사업자',
                            code: 'm1-a5',
                            joinDate: '2026-04-20',
                            recId: 'VK-1209568'
                        }
                    }
                }
            },
            right: {
                id: 'VK-1209224',
                name: '안혜정',
                rank: 'MANIA',
                type: '사업자',
                code: 'm1-a24',
                joinDate: '2026-05-13',
                recId: 'VK-1199464',
                left: {
                    id: 'VK-1211101',
                    name: '김유희',
                    rank: 'MANIA',
                    type: '사업자',
                    code: 'm1-a25',
                    joinDate: '2026-05-15',
                    recId: 'VK-1209224',
                    left: {
                        id: 'VK-1212195',
                        name: '정춘희',
                        rank: 'MANIA',
                        type: '사업자',
                        code: 'm1-a26',
                        joinDate: '2026-05-20',
                        recId: 'VK-1211101'
                    }
                }
            }
        },
        right: {
            id: 'VK-1207312',
            name: '이현경',
            rank: 'MANIA',
            type: '사업자',
            code: 'm1-b1',
            joinDate: '2026-06-08',
            recId: 'VK-1199458',
            left: {
                id: 'VK-1207313',
                name: '이현경',
                rank: 'MEMBER',
                type: '사업자',
                code: 'b1-2-b2',
                joinDate: '2026-06-08',
                recId: 'VK-1207312',
                left: {
                    id: 'VK-1207315',
                    name: '박성혜',
                    rank: 'MANIA',
                    type: '사업자',
                    code: 'm3-b3',
                    joinDate: '2026-06-12',
                    recId: 'VK-1207313'
                }
            }
        }
    };
}

// ============================================================================
// 🌟 [전역 함수 구체적 구현 1] 기본 유틸리티 및 UI 제어 함수군
// ============================================================================

window.cleanDateStr = function(str) {
    if (!str) return '';
    let s = String(str).trim();
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    if (s.includes('.')) s = s.replace(/\./g, '-');

    let numOnly = s.replace(/[^0-9]/g, '');
    if (numOnly.length === 4) {
        const yyyy = new Date().getFullYear();
        return `${yyyy}-${numOnly.slice(0,2)}-${numOnly.slice(2,4)}`;
    } else if (numOnly.length >= 8) {
        return `${numOnly.slice(0,4)}-${numOnly.slice(4,6)}-${numOnly.slice(6,8)}`;
    }
    return s.slice(0, 10);
};

window.isSameMemberId = function(id1, id2) {
    if (!id1 || !id2) return false;
    let s1 = String(id1).trim().toLowerCase().replace(/^vk-?/, '');
    let s2 = String(id2).trim().toLowerCase().replace(/^vk-?/, '');
    return s1 === s2;
};

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

        if (node.left) {
            if (typeof node.left === 'object') flatten(node.left);
            else if (map[node.left]) flatten(map[node.left]);
        }
        if (node.right) {
            if (typeof node.right === 'object') flatten(node.right);
            else if (map[node.right]) flatten(map[node.right]);
        }
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
            let norm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (!uniqueMap.has(norm)) {
                uniqueMap.set(norm, m);
            }
        }
    });
    return Array.from(uniqueMap.values());
};

window.findMemberNode = function(id) {
    if (!id) return null;
    const flatMap = window.getFlatMembers();
    if (flatMap[id]) return flatMap[id];
    let norm = String(id).trim().toLowerCase().replace(/^vk-?/, '');
    if (flatMap[norm]) return flatMap[norm];
    if (flatMap['VK-' + norm]) return flatMap['VK-' + norm];
    if (flatMap['vk-' + norm]) return flatMap['vk-' + norm];
    return Object.values(flatMap).find(m => m && window.isSameMemberId(m.id, id)) || null;
};

window.getAbsoluteTopRoot = function() {
    const flatMap = window.getFlatMembers();
    if (window.treeData && window.treeData.id) {
        let root = window.findMemberNode(window.treeData.id);
        if (root) return root;
        return window.treeData;
    }
    const members = Object.values(flatMap);
    if (members.length === 0) return null;
    return members[0];
};

window.getRelativeLineMap = function(targetId) {
    const map = { A: new Set(), B: new Set(), Self: targetId };
    if (!targetId) return map;

    let targetNode = window.findMemberNode(targetId);
    if (!targetNode) return map;

    function traverse(nodeOrId, lineSet, visited) {
        if (!nodeOrId) return;
        let node = (typeof nodeOrId === 'object') ? nodeOrId : window.findMemberNode(nodeOrId);
        if (!node || !node.id) return;

        let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visited.has(norm)) return;
        visited.add(norm);

        lineSet.add(node.id);
        lineSet.add(norm);
        lineSet.add('vk-' + norm);
        lineSet.add('VK-' + norm);

        let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
        if (leftChild) traverse(leftChild, lineSet, visited);

        let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;
        if (rightChild) traverse(rightChild, lineSet, visited);
    }

    let normSelf = String(targetId).trim().toLowerCase().replace(/^vk-?/, '');

    if (targetNode.left) {
        const visitedA = new Set([normSelf]);
        traverse(targetNode.left, map.A, visitedA);
    }

    if (targetNode.right) {
        const visitedB = new Set([normSelf]);
        traverse(targetNode.right, map.B, visitedB);
    }

    return map;
};

window.getAllSalesListFromDB = function() {
    let list = [];

    ['integrated_sales_history', 'currentSalesData', 'realSalesData', 'allSalesData', 'salesHistory'].forEach(key => {
        if (Array.isArray(window[key])) {
            window[key].forEach(item => {
                if (item) list.push({ ...item });
            });
        }
    });

    let uniqueMap = new Map();
    list.forEach((item, index) => {
        if (!item || item.isDeleted) return;
        
        let rawDate = item.transaction_date || item.date || item.buy_date || item.sales_date || item.created_at || '';
        let dateStr = (typeof window.cleanDateStr === 'function') ? window.cleanDateStr(rawDate) : String(rawDate).slice(0, 10);
        let memId = item.member_id || item.user_id || item.memberId || '';

        let cv = Number(String(item.cv || item.amount || 0).replace(/,/g, ''));
        let pv = Number(String(item.pv || 0).replace(/,/g, ''));
        let categoryVal = item.category || item.type || item.gubun || '매출';

        let mNode = window.findMemberNode(memId);
        let memName = item.member_name || item.name || (mNode ? mNode.name : '');
        
        let rawDbId = item._dbId || (item.id && !isNaN(Number(item.id)) ? Number(item.id) : null);
        if (!rawDbId && item.sales_id && !isNaN(Number(item.sales_id))) {
            rawDbId = Number(item.sales_id);
        }

        let itemKey = rawDbId ? `db_${rawDbId}` : (item.id || `temp_${memId}_${dateStr}_${cv}_${pv}_${index}`);
        
        if (!uniqueMap.has(itemKey)) {
            uniqueMap.set(itemKey, {
                ...item,
                id: itemKey,
                _dbId: rawDbId,
                transaction_date: dateStr,
                member_id: memId,
                member_name: memName,
                category: categoryVal,
                type: categoryVal,
                cv: cv,
                pv: pv
            });
        }
    });

    return Array.from(uniqueMap.values());
};

window.fetchSalesHistory = async function(startDate = '', endDate = '') {
    if (!window.API_BASE) return;
    try {
        let url = `${window.API_BASE}/api/sales/history`;
        if (startDate || endDate) {
            url += `?start=${startDate}&end=${endDate}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                window.integrated_sales_history = data;
            }
        }
    } catch (e) {}
};

// ============================================================================
// 🌟 [공통 기수별 정밀 이월/공제 계산 히스토리 엔진]
// ============================================================================

window.getMemberPerformanceHistory = function(targetId, salesListParam) {
    if (!targetId) return {};
    let normId = String(targetId).trim().toLowerCase().replace(/^vk-?/, '');
    
    if (window.perfCache && window.perfCache[normId]) {
        return window.perfCache[normId];
    }

    let targetMember = window.findMemberNode(targetId);
    if (!targetMember) return {};

    let actualId = targetMember.id;
    const lineMap = window.getRelativeLineMap(actualId);
    const allSales = salesListParam || (typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : []);

    let minDateStr = '';
    allSales.forEach(s => {
        if (!s || s.isDeleted) return;
        let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
        if (d && (!minDateStr || d < minDateStr)) minDateStr = d;
    });

    let currDate = new Date();
    let endYear = currDate.getFullYear();
    let endMonth = currDate.getMonth() + 1;
    let endIsSecondHalf = currDate.getDate() > 15;

    let startYear = endYear, startMonth = endMonth, startIsSecondHalf = endIsSecondHalf;
    if (minDateStr) {
        let parts = minDateStr.split('-');
        if (parts.length >= 2) {
            startYear = parseInt(parts[0], 10);
            startMonth = parseInt(parts[1], 10);
            let day = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
            startIsSecondHalf = day > 15;
        }
    } else {
        startMonth = endMonth - 3;
        if (startMonth < 1) { startMonth += 12; startYear -= 1; }
    }

    const terms = [];
    let y = startYear, m = startMonth, isHalf = startIsSecondHalf;

    while (true) {
        let monthPadded = String(m).padStart(2, '0');
        let halfStr = isHalf ? '후' : '전';
        let label = `${monthPadded}-${halfStr}`;

        let startDateStr, endDateStr;
        let lastDay = new Date(y, m, 0).getDate();

        if (isHalf) {
            startDateStr = `${y}-${monthPadded}-16`;
            endDateStr = `${y}-${monthPadded}-${String(lastDay).padStart(2,'0')}`;
        } else {
            startDateStr = `${y}-${monthPadded}-01`;
            endDateStr = `${y}-${monthPadded}-15`;
        }

        terms.push({ label, year: y, month: m, isSecondHalf: isHalf, startDate: startDateStr, endDate: endDateStr });

        if (y > endYear || (y === endYear && m > endMonth) || (y === endYear && m === endMonth && isHalf === endIsSecondHalf)) break;

        if (!isHalf) isHalf = true;
        else { isHalf = false; m++; if (m > 12) { m = 1; y++; } }

        if (terms.length > 120) break;
    }

    let carryA = 0, carryB = 0;
    const historyByEndDate = {};

    terms.forEach(term => {
        let aNewCv = 0, bNewCv = 0;
        allSales.forEach(s => {
            if (!s || s.isDeleted) return;
            let memId = s.member_id || s.user_id || s.memberId || '';
            if (!memId) return;
            let normMemId = String(memId).trim().toLowerCase().replace(/^vk-?/, '');
            let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
            if (d >= term.startDate && d <= term.endDate) {
                let cv = Number(String(s.cv || 0).replace(/,/g, '')) || 0;
                if (lineMap.A.has(memId) || lineMap.A.has(normMemId)) aNewCv += cv;
                if (lineMap.B.has(memId) || lineMap.B.has(normMemId)) bNewCv += cv;
            }
        });

        let availA = carryA + aNewCv;
        let availB = carryB + bNewCv;
        let matchedCv = Math.min(availA, availB);

        carryA = availA - matchedCv;
        carryB = availB - matchedCv;

        let sponBonus = Math.floor(matchedCv * 0.12);

        historyByEndDate[term.endDate] = {
            term,
            matchedCv,
            sponBonus
        };
    });

    window.perfCache = window.perfCache || {};
    window.perfCache[normId] = historyByEndDate;
    return historyByEndDate;
};

// ============================================================================
// 🌟 [추천계보 압축롤업 정밀 계산 연산 엔진]
// ============================================================================

window.computeRecommenderMatchingBonus = function(targetId, endDate, targetRank, allSalesParam) {
    const uniqueMembers = window.getUniqueMembers();
    const rates = window.BONUS_MATCHING_RATES[targetRank] || window.BONUS_MATCHING_RATES['MANIA'];
    const isRollup = document.getElementById('chk-rollup')?.checked !== false;

    let totalMatching = 0;
    const matchingDetails = [];
    
    let normTargetId = String(targetId).trim().toLowerCase().replace(/^vk-?/, '');
    const visited = new Set([normTargetId]);

    // 순수 추천인 기반 관계 맵 구성
    const recChildrenMap = {};
    uniqueMembers.forEach(m => {
        if (!m || !m.id) return;
        let rId = m.recId || m.recommender_id || m.rec_id;
        if (rId) {
            let normRId = String(rId).trim().toLowerCase().replace(/^vk-?/, '');
            if (!recChildrenMap[normRId]) recChildrenMap[normRId] = [];
            
            let normChildId = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (!recChildrenMap[normRId].some(c => String(c.id).trim().toLowerCase().replace(/^vk-?/, '') === normChildId)) {
                recChildrenMap[normRId].push(m);
            }
        }
    });

    function getMemberTeamBonus(mId) {
        let history = window.getMemberPerformanceHistory(mId, allSalesParam);
        if (history && history[endDate]) {
            return history[endDate].sponBonus || 0;
        }
        return 0;
    }

    function traverse(parentId, currentGen, physGen) {
        if (currentGen > 5) return;

        let normParentId = String(parentId).trim().toLowerCase().replace(/^vk-?/, '');
        const children = recChildrenMap[normParentId] || [];

        children.forEach(child => {
            let normChildId = String(child.id).trim().toLowerCase().replace(/^vk-?/, '');
            if (visited.has(normChildId)) return;
            visited.add(normChildId);

            let teamBonus = getMemberTeamBonus(child.id);
            let payMatching = false;

            // 💡 3만원 미만 세대 미소비 압축롤업 정밀 처리
            if (isRollup) {
                if (teamBonus >= 30000) {
                    payMatching = true;
                } else {
                    payMatching = false;
                }
            } else {
                if (teamBonus > 0) payMatching = true;
            }

            let nextGen = currentGen;
            if (payMatching) {
                let rate = rates[currentGen - 1] || 0;
                if (rate > 0) {
                    let bonusAmt = Math.floor(teamBonus * rate);
                    if (bonusAmt > 0) {
                        totalMatching += bonusAmt;
                        
                        let genDisplay = (physGen > currentGen) ? `${physGen}세대>${currentGen}세대` : `${currentGen}세대`;
                        matchingDetails.push({
                            gen: currentGen,
                            physGen: physGen,
                            genLabel: genDisplay,
                            member_id: child.id,
                            name: child.name || child.id,
                            rank: child.rank || 'MANIA',
                            teamBonus: teamBonus,
                            rate: rate,
                            amount: bonusAmt
                        });
                    }
                }
                nextGen = currentGen + 1; // 3만원 이상일 때만 세대를 소비하여 증가시킴
            } else {
                if (!isRollup) nextGen = currentGen + 1;
                // isRollup이 켜져 있으면 nextGen은 증가하지 않고 currentGen 값을 그대로 유지 (세대 미소비 통과)
            }

            traverse(child.id, nextGen, physGen + 1);
        });
    }

    traverse(targetId, 1, 1);
    return { totalMatching, matchingDetails };
};

// ============================================================================
// 🌟 [보너스 검증 신규 모달 제어 함수] (#bonusDetailModal)
// ============================================================================

window.closeBonusDetailModal = function() {
    const modal = document.getElementById('bonusDetailModal');
    if (modal) modal.style.display = 'none';
};

window.openBonusDetailModal = function(targetId, termLabel, startDate, endDate, bonusType) {
    const modal = document.getElementById('bonusDetailModal');
    const summaryEl = document.getElementById('b-detail-summary');
    const logicEl = document.getElementById('b-detail-logic');
    const theadEl = document.getElementById('b-detail-thead');
    const tbodyEl = document.getElementById('b-detail-tbody');

    if (!modal || !summaryEl || !tbodyEl) return;

    let member = window.findMemberNode(targetId);
    if (!member) return;

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    const uniqueMembers = window.getUniqueMembers();
    const lineMap = window.getRelativeLineMap(targetId);

    const directRecs = uniqueMembers.filter(m => m && window.isSameMemberId(m.recId || m.recommender_id, targetId));

    let bonusTitle = '';
    let logicText = '';
    let theadHtml = '';
    let rowsHtml = '';
    let totalCalculated = 0;

    if (bonusType === 'recBonus') {
        bonusTitle = '추천수당 (Direct Bonus)';
        logicText = `💡 <b>계산 로직:</b> 수령자 <b>${member.name}(${member.id})</b>의 추천계보 직추천 파트너가 당기(${termLabel})에 발생시킨 매출 CV의 <b>12%</b> 산출`;
        theadHtml = `
            <tr>
                <th style="padding:6px;">회원번호</th>
                <th style="padding:6px;">회원이름</th>
                <th style="padding:6px;">직급</th>
                <th style="padding:6px;">당기 발생 CV</th>
                <th style="padding:6px;">적용 요율</th>
                <th style="padding:6px;">산출 추천수당</th>
            </tr>`;

        directRecs.forEach(rec => {
            let recSales = allSales.filter(s => {
                if (!s || s.isDeleted) return false;
                let mId = s.member_id;
                let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
                return window.isSameMemberId(mId, rec.id) && d >= startDate && d <= endDate;
            });
            let sumCv = recSales.reduce((sum, s) => sum + (Number(String(s.cv || 0).replace(/,/g, '')) || 0), 0);
            if (sumCv > 0) {
                let amt = Math.floor(sumCv * 0.12);
                totalCalculated += amt;
                rowsHtml += `
                    <tr style="border-bottom:1px solid #374151;">
                        <td style="padding:6px; color:#fff;">${rec.id}</td>
                        <td style="padding:6px; color:#fff; font-weight:bold;">${rec.name || '-'}</td>
                        <td style="padding:6px; color:#9ca3af;">${rec.rank || 'MANIA'}</td>
                        <td style="padding:6px; color:#60a5fa; font-weight:bold; text-align:right;">${sumCv.toLocaleString()} CV</td>
                        <td style="padding:6px; color:#f59e0b;">12%</td>
                        <td style="padding:6px; color:#10b981; font-weight:bold; text-align:right;">${amt.toLocaleString()} 원</td>
                    </tr>`;
            }
        });

    } else if (bonusType === 'sponBonus') {
        bonusTitle = '지원수당 (Team Bonus)';
        logicText = `💡 <b>계산 로직:</b> 수령자 <b>${member.name}(${member.id})</b>의 당기(${termLabel}) 누적 CV 기준 소실적(공제 CV)의 <b>12%</b> 산출`;
        theadHtml = `
            <tr>
                <th style="padding:6px;">구분/라인</th>
                <th style="padding:6px;">회원번호</th>
                <th style="padding:6px;">회원이름</th>
                <th style="padding:6px;">직급</th>
                <th style="padding:6px;">당기 발생 CV</th>
                <th style="padding:6px;">적용 요율</th>
            </tr>`;

        let termSales = allSales.filter(s => {
            if (!s || s.isDeleted) return false;
            let mId = s.member_id;
            let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
            return (lineMap.A.has(mId) || lineMap.B.has(mId)) && d >= startDate && d <= endDate;
        });

        termSales.forEach(s => {
            let mId = s.member_id;
            let mNode = window.findMemberNode(mId);
            let lineTag = lineMap.A.has(mId) ? 'A라인' : 'B라인';
            let lineColor = lineTag === 'A라인' ? '#3b82f6' : '#ef4444';
            let cvVal = Number(String(s.cv || 0).replace(/,/g, '')) || 0;

            rowsHtml += `
                <tr style="border-bottom:1px solid #374151;">
                    <td style="padding:6px; font-weight:bold; color:${lineColor};">${lineTag}</td>
                    <td style="padding:6px; color:#fff;">${mId}</td>
                    <td style="padding:6px; color:#fff; font-weight:bold;">${mNode ? mNode.name : '-'}</td>
                    <td style="padding:6px; color:#9ca3af;">${mNode ? (mNode.rank || 'MANIA') : '-'}</td>
                    <td style="padding:6px; color:#60a5fa; font-weight:bold; text-align:right;">${cvVal.toLocaleString()} CV</td>
                    <td style="padding:6px; color:#f59e0b;">12% (소실적)</td>
                </tr>`;
        });

    } else if (bonusType === 'matchBonus') {
        bonusTitle = '추천매칭보너스 (Matching Bonus)';
        let targetRank = member.rank || 'MANIA';
        
        let { totalMatching, matchingDetails } = window.computeRecommenderMatchingBonus(targetId, endDate, targetRank, allSales);

        logicText = `💡 <b>계산 로직:</b> 수령자 직급(<b>${targetRank}</b>)의 DB <code>bonus_matching</code> 세대 요율 × 추천계보 산하 파트너 당기 지원수당`;
        theadHtml = `
            <tr>
                <th style="padding:6px;">세대</th>
                <th style="padding:6px;">회원번호</th>
                <th style="padding:6px;">회원이름</th>
                <th style="padding:6px;">직급</th>
                <th style="padding:6px;">산하회원 지원수당</th>
                <th style="padding:6px;">매칭 요율</th>
                <th style="padding:6px;">추천매칭보너스</th>
            </tr>`;

        matchingDetails.forEach(item => {
            totalCalculated += item.amount;
            rowsHtml += `
                <tr style="border-bottom:1px solid #374151;">
                    <td style="padding:6px; color:#f59e0b; font-weight:bold;">${item.genLabel || item.gen + '세대'}</td>
                    <td style="padding:6px; color:#fff;">${item.member_id}</td>
                    <td style="padding:6px; color:#fff; font-weight:bold;">${item.name}</td>
                    <td style="padding:6px; color:#9ca3af;">${item.rank}</td>
                    <td style="padding:6px; color:#60a5fa; font-weight:bold; text-align:right;">${item.teamBonus.toLocaleString()} 원</td>
                    <td style="padding:6px; color:#f59e0b;">${(item.rate * 100).toFixed(0)}%</td>
                    <td style="padding:6px; color:#10b981; font-weight:bold; text-align:right;">${item.amount.toLocaleString()} 원</td>
                </tr>`;
        });

    } else if (bonusType === 'dignityBonus') {
        bonusTitle = '품위유지비 (Dignity Bonus)';
        logicText = `💡 <b>계산 로직:</b> 당기(${termLabel}) 소실적 CV 달성 구간별 품위유지비 지급 (DIRECTOR 210만 CV: 15만원 ~ CROWN 1.35억 CV: 600만원)`;
        theadHtml = `
            <tr>
                <th style="padding:6px;">달성 직급</th>
                <th style="padding:6px;">요구 소실적 CV</th>
                <th style="padding:6px;">당기 실적 소실적 CV</th>
                <th style="padding:6px;">달성 여부</th>
                <th style="padding:6px;">지급 품위유지비</th>
            </tr>`;
        
        let history = window.getMemberPerformanceHistory(targetId, allSales);
        let weakCv = history && history[endDate] ? history[endDate].matchedCv : 0;

        const dignityTiers = [
            { name: 'CROWN', reqCV: 135000000, amt: 6000000 },
            { name: 'RED DIAMOND', reqCV: 65000000, amt: 4000000 },
            { name: 'BLUE DIAMOND', reqCV: 34000000, amt: 2300000 },
            { name: 'GREEN DIAMOND', reqCV: 19000000, amt: 1400000 },
            { name: 'DIAMOND', reqCV: 10000000, amt: 750000 },
            { name: 'EMERALD', reqCV: 3500000, amt: 300000 },
            { name: 'DIRECTOR', reqCV: 2100000, amt: 150000 }
        ];

        dignityTiers.forEach(t => {
            let isMet = weakCv >= t.reqCV;
            if (isMet && totalCalculated === 0) totalCalculated = t.amt;
            rowsHtml += `
                <tr style="border-bottom:1px solid #374151; ${isMet ? 'background:#1e293b;' : ''}">
                    <td style="padding:6px; color:#fff; font-weight:bold;">${t.name}</td>
                    <td style="padding:6px; color:#9ca3af;">${t.reqCV.toLocaleString()} CV</td>
                    <td style="padding:6px; color:#60a5fa;">${weakCv.toLocaleString()} CV</td>
                    <td style="padding:6px; color:${isMet ? '#10b981' : '#ef4444'}; font-weight:bold;">${isMet ? '✅ 달성' : '미달성'}</td>
                    <td style="padding:6px; color:${isMet ? '#10b981' : '#6b7280'}; font-weight:bold; text-align:right;">${isMet ? t.amt.toLocaleString() + ' 원' : '-'}</td>
                </tr>`;
        });

    } else if (bonusType === 'carBonus') {
        bonusTitle = '차량유지비 (Car Bonus)';
        logicText = `💡 <b>계산 로직:</b> 당기(${termLabel}) 소실적 CV 달성 구간별 차량유지비 지급 (DIAMOND 1,000만 CV: 80만원 ~ CROWN 1.35억 CV: 400만원)`;
        theadHtml = `
            <tr>
                <th style="padding:6px;">달성 직급</th>
                <th style="padding:6px;">요구 소실적 CV</th>
                <th style="padding:6px;">당기 실적 소실적 CV</th>
                <th style="padding:6px;">달성 여부</th>
                <th style="padding:6px;">지급 차량유지비</th>
            </tr>`;

        let history = window.getMemberPerformanceHistory(targetId, allSales);
        let weakCv = history && history[endDate] ? history[endDate].matchedCv : 0;

        const carTiers = [
            { name: 'CROWN', reqCV: 135000000, amt: 4000000 },
            { name: 'RED DIAMOND', reqCV: 65000000, amt: 2000000 },
            { name: 'BLUE DIAMOND', reqCV: 34000000, amt: 1500000 },
            { name: 'GREEN DIAMOND', reqCV: 19000000, amt: 1000000 },
            { name: 'DIAMOND', reqCV: 10000000, amt: 800000 }
        ];

        carTiers.forEach(t => {
            let isMet = weakCv >= t.reqCV;
            if (isMet && totalCalculated === 0) totalCalculated = t.amt;
            rowsHtml += `
                <tr style="border-bottom:1px solid #374151; ${isMet ? 'background:#1e293b;' : ''}">
                    <td style="padding:6px; color:#fff; font-weight:bold;">${t.name}</td>
                    <td style="padding:6px; color:#9ca3af;">${t.reqCV.toLocaleString()} CV</td>
                    <td style="padding:6px; color:#60a5fa;">${weakCv.toLocaleString()} CV</td>
                    <td style="padding:6px; color:${isMet ? '#10b981' : '#ef4444'}; font-weight:bold;">${isMet ? '✅ 달성' : '미달성'}</td>
                    <td style="padding:6px; color:${isMet ? '#10b981' : '#6b7280'}; font-weight:bold; text-align:right;">${isMet ? t.amt.toLocaleString() + ' 원' : '-'}</td>
                </tr>`;
        });
    }

    summaryEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="color:#9ca3af;">대상 회원:</span> <strong style="color:#fff;">${member.name} (${member.id})</strong> | 
                <span style="color:#9ca3af;">기수:</span> <strong style="color:#60a5fa;">${termLabel}</strong>
            </div>
            <div>
                <span style="color:#9ca3af;">항목:</span> <strong style="color:#fbbf24;">${bonusTitle}</strong>
            </div>
        </div>`;

    logicEl.innerHTML = logicText;
    theadEl.innerHTML = theadHtml;
    tbodyEl.innerHTML = rowsHtml || `<tr><td colspan="7" style="padding:20px; color:#9ca3af; text-align:center;">해당 기수에 기여한 내역이 없거나 산출된 보너스가 없습니다.</td></tr>`;

    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};

// ============================================================================
// 🌟 [계보도 동적 코드 산정 유틸리티]
// ============================================================================

function getTagFromCode(codeStr) {
    if (!codeStr || codeStr === 'm') return 'm';
    if (codeStr === 'x') return 'x';
    let parts = String(codeStr).split('-');
    return parts[parts.length - 1] || 'm';
}

window.setDynamicCode = function(id, code) {
    if (!id) return;
    window.dynamicCodes = window.dynamicCodes || {};
    let strId = String(id).trim();
    window.dynamicCodes[strId] = code;
    let norm = strId.toLowerCase().replace(/^vk-?/, '');
    window.dynamicCodes[norm] = code;
    window.dynamicCodes['VK-' + norm] = code;
    window.dynamicCodes['vk-' + norm] = code;

    let node = window.findMemberNode(id);
    if (node) node.code = code;
};

window.getDynamicCode = function(id) {
    if (!id) return '';
    let strId = String(id).trim();
    if (window.dynamicCodes && window.dynamicCodes[strId]) return window.dynamicCodes[strId];
    let norm = strId.toLowerCase().replace(/^vk-?/, '');
    if (window.dynamicCodes && window.dynamicCodes[norm]) return window.dynamicCodes[norm];
    if (window.dynamicCodes && window.dynamicCodes['VK-' + norm]) return window.dynamicCodes['VK-' + norm];
    let node = window.findMemberNode(id);
    return node ? (node.code || '') : '';
};

window.computeDynamicCodes = function(selectedRootId) {
    window.dynamicCodes = {};
    const uniqueMembers = window.getUniqueMembers();
    if (uniqueMembers.length === 0) return;

    let rootId = selectedRootId || window.currentSelectedId;
    let rootNode = rootId ? window.findMemberNode(rootId) : window.getAbsoluteTopRoot();
    if (!rootNode) rootNode = window.getAbsoluteTopRoot();
    if (!rootNode) return;

    uniqueMembers.forEach(m => { 
        m._genFromM = -1;
        m._branchLine = 'a';
    });

    const visited = new Set();
    function traverseFromRoot(node, depth, branchLine) {
        if (!node || !node.id) return;
        let norm = String(node.id).trim().toLowerCase().replace(/^vk-?/, '');
        if (visited.has(norm)) return;
        visited.add(norm);

        node._genFromM = depth;
        node._branchLine = branchLine;

        let leftChild = node.left ? (typeof node.left === 'object' ? node.left : window.findMemberNode(node.left)) : null;
        if (leftChild) {
            let childBranch = (depth === 0) ? 'a' : branchLine;
            traverseFromRoot(leftChild, depth + 1, childBranch);
        }

        let rightChild = node.right ? (typeof node.right === 'object' ? node.right : window.findMemberNode(node.right)) : null;
        if (rightChild) {
            let childBranch = (depth === 0) ? 'b' : branchLine;
            traverseFromRoot(rightChild, depth + 1, childBranch);
        }
    }

    traverseFromRoot(rootNode, 0, 'a');

    window.setDynamicCode(rootNode.id, 'm');

    uniqueMembers.filter(m => m._genFromM < 0).forEach(m => {
        window.setDynamicCode(m.id, 'x');
    });

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

            let recTag = 'x';
            if (isRecInSubtree) {
                let recCode = window.getDynamicCode(recommender.id) || 'm';
                recTag = getTagFromCode(recCode);
            } else {
                recTag = 'x';
            }

            let computedCode = `${recTag}-${gen}-${myLineTag}`;
            window.setDynamicCode(m.id, computedCode);
        });
    });
};

window.predictMemberCode = function(recommenderNode, sponsorNode, position) {
    let rootId = window.currentSelectedId;
    let rootNode = rootId ? window.findMemberNode(rootId) : window.getAbsoluteTopRoot();
    if (!rootNode) rootNode = window.getAbsoluteTopRoot();

    let recTag = 'x';
    let isRecInSubtree = (recommenderNode && recommenderNode._genFromM >= 0);

    if (isRecInSubtree) {
        let recCode = window.getDynamicCode(recommenderNode.id) || 'm';
        recTag = getTagFromCode(recCode);
    } else {
        recTag = 'x';
    }

    let posLine = (position === 'left' || position === 'A라인') ? 'a' : 'b';

    let sponDepth = sponsorNode ? (sponsorNode._genFromM >= 0 ? sponsorNode._genFromM + 1 : 1) : 1;
    let gen = Math.max(1, sponDepth);

    const uniqueMembers = window.getUniqueMembers();
    let lineCount = uniqueMembers.filter(m => m._genFromM > 0 && m._branchLine === posLine).length;

    let seqNum = lineCount + 1;
    let newTag = `${posLine}${seqNum}`;
    return `${recTag}-${gen}-${newTag}`;
};

window.updateModalCodeByPos = function() {
    const sponId = document.getElementById('m-spon-id')?.value.trim();
    const recId = document.getElementById('m-rec-id')?.value.trim();
    const posVal = document.getElementById('m-pos')?.value;

    let sponsorNode = window.findMemberNode(sponId);
    let recommenderNode = window.findMemberNode(recId);

    const codeEl = document.getElementById('m-code');
    if (codeEl) {
        codeEl.value = window.predictMemberCode(recommenderNode, sponsorNode, posVal);
    }
};

// ============================================================================
// 🌟 패널 & 위젯 렌더링 함수군
// ============================================================================

window.addSalesRow = function() {
    const targetId = window.currentSelectedId;
    if (!targetId) {
        alert('먼저 계보도에서 회원을 선택해주세요.');
        return;
    }

    window.integrated_sales_history = window.integrated_sales_history || [];
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${yyyy}-${mm}-${dd}`;
    
    const newId = `new_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const flatMap = typeof window.getFlatMembers === 'function' ? window.getFlatMembers() : {};
    let targetName = flatMap && flatMap[targetId] ? flatMap[targetId].name : '';

    const newRow = {
        id: newId,
        _dbId: null,
        transaction_date: defaultDate,
        member_id: targetId,
        member_name: targetName,
        category: '매출',
        type: '매출',
        cv: 0,
        pv: 0
    };

    window.integrated_sales_history.unshift(newRow);
    
    window.renderSalesWidget();
    if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') {
        window.searchPeriodSales();
    }
    if (window.currentSelectedId) {
        window.calculateLocalPerformance(window.currentSelectedId);
        window.renderTree(false);
    }
};

window.renderSalesWidget = function() {
    try {
        const container = document.getElementById('sales-rows-container');
        if (!container) return;
        
        container.innerHTML = ''; 
        
        const sortIcon = document.getElementById('sales-sort-icon');
        if (sortIcon) {
            sortIcon.innerText = (window.salesSortOrder === 'desc') ? '↓' : '↑';
        }

        const targetId = window.currentSelectedId;
        if (!targetId) {
            container.innerHTML = '<div id="no-data-msg" style="text-align:center; padding:30px 0; color:#9ca3af; font-size:12px;">선택된 회원이 없습니다.</div>';
            return;
        }

        let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
        let data = allSales.filter(item => window.isSameMemberId(item.member_id, targetId));

        data.sort((a, b) => {
            let d1 = a.transaction_date || '';
            let d2 = b.transaction_date || '';
            return (window.salesSortOrder === 'desc') ? d2.localeCompare(d1) : d1.localeCompare(d2);
        });
        
        if (data.length === 0) {
            container.innerHTML = '<div id="no-data-msg" style="text-align:center; padding:30px 0; color:#9ca3af; font-size:12px;">조회된 내역이 없습니다.</div>';
        } else {
            data.forEach(item => {
                if(!item) return;
                const row = document.createElement('div');
                row.className = 'sales-row';
                
                const typeVal = item.category || item.gubun || item.type || '매출';
                let rawDate = item.transaction_date || item.date || item.buy_date || item.sales_date || item.sub_date || item.buyDate || item.payDate || '';
                let dateVal = window.cleanDateStr(rawDate);
                
                let cvVal = item.cv || 0;
                let pvVal = item.pv || 0;
                if (typeof cvVal === 'number' || !isNaN(Number(cvVal.toString().replace(/,/g, '')))) cvVal = Number(cvVal.toString().replace(/,/g, '')).toLocaleString();
                if (typeof pvVal === 'number' || !isNaN(Number(pvVal.toString().replace(/,/g, '')))) pvVal = Number(pvVal.toString().replace(/,/g, '')).toLocaleString();
                
                row.innerHTML = `
                    <select class="s-type" onchange="window.updatePeriodRow('${item.id}', 'category', this.value, true); window.updatePeriodRow('${item.id}', 'type', this.value, true);">
                        <option value="매출" ${typeVal === '매출' ? 'selected' : ''}>매출</option>
                        <option value="구독" ${typeVal === '구독' ? 'selected' : ''}>구독</option>
                    </select>
                    <input type="text" class="s-date" value="${dateVal}" onfocus="window.onDateInputFocus(this)" onblur="window.onDateInputBlur(this, '${item.id}', 'transaction_date')" onkeydown="if(event.key==='Enter') this.blur();" placeholder="MMDD">
                    <input type="text" class="s-cv" value="${cvVal}" onblur="window.updatePeriodRowNum('${item.id}', 'cv', this)">
                    <input type="text" class="s-pv" value="${pvVal}" onblur="window.updatePeriodRowNum('${item.id}', 'pv', this)">
                    <button class="btn-del-row" onclick="window.deletePeriodSalesRow('${item.id}')" title="행 삭제">×</button>
                `;
                container.appendChild(row);
            });
        }
        
        const addBtnWrapper = document.createElement('div');
        addBtnWrapper.id = 'add-btn-wrapper';
        addBtnWrapper.style.textAlign = 'center';
        addBtnWrapper.style.padding = '10px 0';
        addBtnWrapper.innerHTML = `<button onclick="window.addSalesRow()" style="background:#10b981; color:#fff; border:none; padding:8px 14px; border-radius:4px; font-size:11.5px; cursor:pointer; font-weight:bold; width: 95%; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: background 0.2s;">+ 본인 내역 추가하기</button>`;
        container.appendChild(addBtnWrapper);
        
    } catch (e) { console.error("Sales Widget Rendering Error:", e); }
};

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

    let innerContent = '';
    
    const memberCode = window.getDynamicCode(node.id) || node.code || '';
    if (window.cardSettings.code && memberCode) {
        innerContent += `<div class="t-code" style="font-size:13px; font-weight:bold; color:#60a5fa; margin-bottom:2px; text-align:center;">${memberCode}</div>`;
    }

    if (window.cardSettings.id) {
        innerContent += `<div class="t-id" style="font-size:13px; font-weight:bold; color:#fff; text-align:center;">${node.id}</div>`;
    }

    if (window.cardSettings.name) innerContent += `<div class="t-common" style="font-size:14px; font-weight:bold; color:#fff;">${node.name}</div>`;
    if (window.cardSettings.rank && node.rank) innerContent += `<div class="t-common">${node.rank}</div>`;
    if (window.cardSettings.type && node.type) innerContent += `<div class="t-common">${node.type}</div>`;
    if (window.cardSettings.joinDate) {
        innerContent += `<div class="t-common" style="font-size:10px; color:#cbd5e1; margin-top:2px;">${jDate}</div>`;
    }
    if (window.cardSettings.recName && node.recName) {
        innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:4px;">${node.recName}</div>`;
    }
    if (window.cardSettings.recId && node.recId) {
        innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px;">(${node.recId})</div>`;
    }
    if (window.cardSettings.firstSales) {
        innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:2px;">최초매출: ${fSales}</div>`;
    }
    if (window.cardSettings.lastSales) {
        innerContent += `<div class="t-detail" style="color:#9ca3af; font-size:10px; margin-top:2px;">최종매출: ${lSales}</div>`;
    }

    if (!innerContent) innerContent = `<div class="t-id">${node.id}</div>`;

    const topRoot = window.getAbsoluteTopRoot();
    let topParentBtn = '';
    if (topRoot && window.isSameMemberId(node.id, topRoot.id)) {
        topParentBtn = `<div class="btn-add-parent" title="상위 파트너(최상위) 추가" onclick="window.addParentPartner(event, '${node.id}')">▲</div>`;
    }

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
        const uniqueMembers = window.getUniqueMembers();
        const recommendees = uniqueMembers.filter(m => {
            if (!m || window.isSameMemberId(m.id, node.id)) return false;
            const rId = m.recId || m.rec_id || m.recommenderId || m.recommender_id || m.recNo;
            return window.isSameMemberId(rId, node.id);
        });
        recommendees.forEach(child => { childrenHtml += window.buildNodeHTML(child, visited); });
    }
    
    if (childrenHtml) html += `<ul>${childrenHtml}</ul>`;
    html += `</li>`; 
    return html;
};

window.renderTree = function(recenter = false) {
    const rootEl = document.getElementById('tree-root');
    if (!rootEl) return;
    
    let rootNode = window.treeData;
    
    if (window.treeMode === 'recommender') {
        let rId = window.recommenderRootId || (window.treeData ? window.treeData.id : null);
        if (rId) rootNode = window.findMemberNode(rId);
        if (!rootNode) rootNode = window.getAbsoluteTopRoot() || window.treeData;
    } else {
        window.computeDynamicCodes(window.currentSelectedId);
    }

    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    window.memberSalesDateMap = {};
    allSales.forEach(s => {
        if (!s || !s.member_id) return;
        let mId = String(s.member_id).trim().toLowerCase().replace(/^vk-?/, '');
        let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
        if (!d) return;
        if (!window.memberSalesDateMap[mId]) {
            window.memberSalesDateMap[mId] = { first: d, last: d };
        } else {
            if (d < window.memberSalesDateMap[mId].first) window.memberSalesDateMap[mId].first = d;
            if (d > window.memberSalesDateMap[mId].last) window.memberSalesDateMap[mId].last = d;
        }
    });
    
    if (!rootNode) return;
    
    rootEl.innerHTML = `<ul>${window.buildNodeHTML(rootNode, new Set())}</ul>`;
    
    if (recenter) setTimeout(window.centerRootNode, 100);
    
    if (window.currentSelectedId) {
        setTimeout(() => { 
            document.querySelectorAll('.node-card').forEach(el => {
                let cardNodeId = el.id.replace(/^card_/, '');
                if (window.isSameMemberId(cardNodeId, window.currentSelectedId)) {
                    el.style.borderColor = '#10b981';
                    el.style.borderWidth = '2px';
                } else {
                    el.style.borderColor = '';
                    el.style.borderWidth = '';
                }
            });
        }, 50);
    }

    if (typeof window.updateHeaderLineCount === 'function') {
        window.updateHeaderLineCount();
    }
    
    if (typeof window.calculateLocalPerformance === 'function') {
        window.calculateLocalPerformance(window.currentSelectedId);
    }
};

window.fetchTreeData = async function(recenter = true) {
    try {
        if (window.API_BASE) {
            const res = await fetch(`${window.API_BASE}/api/tree`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.tree && data.tree.id) {
                    window.treeData = data.tree;
                } else if (data && data.id) {
                    window.treeData = data;
                }
            }
        }
    } catch (e) {}
    
    if (typeof window.fetchSalesHistory === 'function') {
        await window.fetchSalesHistory();
    }
    window.getFlatMembers();
    window.computeDynamicCodes();
    window.renderTree(recenter);
};

// ============================================================================
// 🌟 [초고속 메인 실적 집계 엔진]
// ============================================================================

window.calculateLocalPerformance = function(targetId) {
    window.perfCache = {};

    const tbody = document.getElementById('perf-table-tbody');
    const nameEl = document.getElementById('perf-target-name');
    if (!tbody) return;

    let effectiveId = (targetId !== undefined && targetId !== null) ? targetId : window.currentSelectedId;

    if (!effectiveId) {
        if (nameEl) nameEl.innerText = '(선택 안됨)';
        tbody.innerHTML = `<tr><td colspan="18" style="padding:30px; text-align:center; color:#9ca3af;">선택된 회원이 없습니다. 계보도 카드를 클릭해 주세요.</td></tr>`;
        return;
    }

    let targetMember = window.findMemberNode(effectiveId);
    if (!targetMember) {
        if (nameEl) nameEl.innerText = '(선택 안됨)';
        tbody.innerHTML = `<tr><td colspan="18" style="padding:30px; text-align:center; color:#9ca3af;">선택된 회원이 없습니다. 계보도 카드를 클릭해 주세요.</td></tr>`;
        return;
    }

    let actualId = targetMember.id;
    let targetName = targetMember.name || actualId;
    if (nameEl) nameEl.innerText = `(${targetName} / ${actualId})`;

    const lineMap = window.getRelativeLineMap(actualId);
    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    const uniqueMembers = window.getUniqueMembers();

    const directRecIds = new Set();
    uniqueMembers.forEach(m => {
        if (m && window.isSameMemberId(m.recId || m.recommender_id, actualId)) {
            directRecIds.add(m.id);
            let norm = String(m.id).trim().toLowerCase().replace(/^vk-?/, '');
            directRecIds.add(norm);
        }
    });

    let minDateStr = '';
    allSales.forEach(s => {
        if (!s || s.isDeleted) return;
        let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
        if (d && (!minDateStr || d < minDateStr)) minDateStr = d;
    });

    let currDate = new Date();
    let endYear = currDate.getFullYear();
    let endMonth = currDate.getMonth() + 1;
    let endIsSecondHalf = currDate.getDate() > 15;

    let startYear = endYear, startMonth = endMonth, startIsSecondHalf = endIsSecondHalf;
    if (minDateStr) {
        let parts = minDateStr.split('-');
        if (parts.length >= 2) {
            startYear = parseInt(parts[0], 10);
            startMonth = parseInt(parts[1], 10);
            let day = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
            startIsSecondHalf = day > 15;
        }
    } else {
        startMonth = endMonth - 3;
        if (startMonth < 1) { startMonth += 12; startYear -= 1; }
    }

    const terms = [];
    let y = startYear, m = startMonth, isHalf = startIsSecondHalf;

    while (true) {
        let monthPadded = String(m).padStart(2, '0');
        let halfStr = isHalf ? '후' : '전';
        let label = `${monthPadded}-${halfStr}`;

        let startDateStr, endDateStr;
        let lastDay = new Date(y, m, 0).getDate();

        if (isHalf) {
            startDateStr = `${y}-${monthPadded}-16`;
            endDateStr = `${y}-${monthPadded}-${String(lastDay).padStart(2,'0')}`;
        } else {
            startDateStr = `${y}-${monthPadded}-01`;
            endDateStr = `${y}-${monthPadded}-15`;
        }

        terms.push({ label, year: y, month: m, isSecondHalf: isHalf, startDate: startDateStr, endDate: endDateStr });

        if (y > endYear || (y === endYear && m > endMonth) || (y === endYear && m === endMonth && isHalf === endIsSecondHalf)) break;

        if (!isHalf) isHalf = true;
        else { isHalf = false; m++; if (m > 12) { m = 1; y++; } }

        if (terms.length > 120) break;
    }

    tbody.innerHTML = '';

    let carryA = 0, carryB = 0;
    let cumA_CV = 0, cumB_CV = 0;
    let cumA_PV = 0, cumB_PV = 0;

    const calculatedRows = [];

    terms.forEach(term => {
        let aNewCv = 0, aNewPv = 0;
        let bNewCv = 0, bNewPv = 0;
        let directRecCvInTerm = 0;

        allSales.forEach(s => {
            if (!s || s.isDeleted) return;
            let memId = s.member_id || s.user_id || s.memberId || '';
            if (!memId) return;

            let normMemId = String(memId).trim().toLowerCase().replace(/^vk-?/, '');
            let d = window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '');
            if (!d) return;

            let cv = Number(String(s.cv || 0).replace(/,/g, '')) || 0;
            let pv = Number(String(s.pv || 0).replace(/,/g, '')) || 0;

            let isALine = lineMap.A.has(memId) || lineMap.A.has(normMemId);
            let isBLine = lineMap.B.has(memId) || lineMap.B.has(normMemId);

            if (d >= term.startDate && d <= term.endDate) {
                if (isALine) { aNewCv += cv; aNewPv += pv; }
                if (isBLine) { bNewCv += cv; bNewPv += pv; }

                if (directRecIds.has(memId) || directRecIds.has(normMemId)) {
                    directRecCvInTerm += cv;
                }
            }
        });

        cumA_CV += aNewCv;
        cumB_CV += bNewCv;
        cumA_PV += aNewPv;
        cumB_PV += bNewPv;

        let availA = carryA + aNewCv;
        let availB = carryB + bNewCv;

        let matchedCv = Math.min(availA, availB);

        let aDeductCv = matchedCv;
        let bDeductCv = matchedCv;

        carryA = availA - matchedCv;
        carryB = availB - matchedCv;

        let recBonus = Math.floor(directRecCvInTerm * 0.12);
        let sponBonus = Math.floor(matchedCv * 0.12);

        let targetRank = 'MANIA';
        if (matchedCv >= 135000000) targetRank = 'CROWN';
        else if (matchedCv >= 65000000) targetRank = 'RED DIAMOND';
        else if (matchedCv >= 34000000) targetRank = 'BLUE DIAMOND';
        else if (matchedCv >= 19000000) targetRank = 'GREEN DIAMOND';
        else if (matchedCv >= 10000000) targetRank = 'DIAMOND';
        else if (matchedCv >= 3500000)  targetRank = 'EMERALD';
        else if (matchedCv >= 2100000)  targetRank = 'DIRECTOR';
        else targetRank = targetMember.rank || 'MANIA';

        let { totalMatching: matchBonus } = window.computeRecommenderMatchingBonus(actualId, term.endDate, targetRank, allSales);

        let dignityBonus = 0;
        if (matchedCv >= 135000000) dignityBonus = 6000000;
        else if (matchedCv >= 65000000) dignityBonus = 4000000;
        else if (matchedCv >= 34000000) dignityBonus = 2300000;
        else if (matchedCv >= 19000000) dignityBonus = 1400000;
        else if (matchedCv >= 10000000) dignityBonus = 750000;
        else if (matchedCv >= 3500000)  dignityBonus = 300000;
        else if (matchedCv >= 2100000)  dignityBonus = 150000;

        let carBonus = 0;
        if (matchedCv >= 135000000) carBonus = 4000000;
        else if (matchedCv >= 65000000) carBonus = 2000000;
        else if (matchedCv >= 34000000) carBonus = 1500000;
        else if (matchedCv >= 19000000) carBonus = 1000000;
        else if (matchedCv >= 10000000) carBonus = 800000;

        let fastPower = 0;
        let totalBonus = recBonus + sponBonus + matchBonus + dignityBonus + carBonus + fastPower;

        calculatedRows.push({
            term,
            actualId,
            aNewCv, aCumCv: cumA_CV, aDeductCv,
            aNewPv, aCumPv: cumA_PV,
            bNewCv, bCumCv: cumB_CV, bDeductCv,
            bNewPv, bCumPv: cumB_PV,
            recBonus, sponBonus, matchBonus, dignityBonus, carBonus, fastPower, totalBonus
        });
    });

    calculatedRows.reverse();

    const fmtBonus = (num, type, row) => {
        if (!num || num <= 0) return '-';
        return `<span onclick="window.openBonusDetailModal('${row.actualId}', '${row.term.label}', '${row.term.startDate}', '${row.term.endDate}', '${type}')" style="cursor:pointer; text-decoration:underline; color:#60a5fa;" title="클릭하여 보너스 산출 상세 검증">${num.toLocaleString()}</span>`;
    };

    const fmt = (num) => num > 0 ? num.toLocaleString() : '-';

    calculatedRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #374151';
        tr.style.transition = 'background 0.2s';
        tr.onmouseover = function() { this.style.background = '#374151'; };
        tr.onmouseout = function() { this.style.background = 'transparent'; };

        tr.innerHTML = `
            <td style="padding:8px 8px; text-align:center; font-weight:bold; color:#fff; border-right:1px solid #374151; background:#111827;">${row.term.label}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.aNewCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.aCumCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; border-right:1px solid #374151;">${fmt(row.aDeductCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.aNewPv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; border-right:1px solid #374151;">${fmt(row.aCumPv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.bNewCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.bCumCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#ef4444; border-right:1px solid #374151;">${fmt(row.bDeductCv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff;">${fmt(row.bNewPv)}</td>
            <td style="padding:8px 6px; font-weight:bold; color:#fff; border-right:1px solid #374151;">${fmt(row.bCumPv)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmtBonus(row.recBonus, 'recBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmtBonus(row.sponBonus, 'sponBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmtBonus(row.matchBonus, 'matchBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmtBonus(row.dignityBonus, 'dignityBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmtBonus(row.carBonus, 'carBonus', row)}</td>
            <td style="padding:8px 6px; font-weight:bold; border-right:1px solid #374151;">${fmt(row.fastPower)}</td>
            <td style="padding:8px 8px; font-weight:bold; color:#fff;">${fmt(row.totalBonus)}</td>
        `;
        tbody.appendChild(tr);
    });
};

// ============================================================================
// 🌟 [이벤트 & 액션 제어 함수군]
// ============================================================================

window.executeNodeSingleClick = async function(id) {
    const modal = document.getElementById('addPartnerModal');
    if (modal && window.getComputedStyle(modal).display !== 'none') {
        let clickedMember = window.findMemberNode(id);
        const clickedId = clickedMember ? clickedMember.id : id;

        const sponInput = document.getElementById('m-spon-id');
        if (sponInput) {
            sponInput.value = clickedId;
            sponInput.style.borderColor = '#10b981';
            setTimeout(() => { sponInput.style.borderColor = '#60a5fa'; }, 600);
        }
        window.addPartnerState.sponsorId = clickedId;
        window.updateModalCodeByPos();
        return;
    }

    window.currentSelectedId = id; 
    let member = window.findMemberNode(id);
    
    const memberId = member ? member.id : id;
    const memberName = member ? member.name : id;
    
    const salesIdInput = document.getElementById('sales-target-id');
    if (salesIdInput) salesIdInput.value = memberId;
    
    const perfName = document.getElementById('perf-target-name');
    if (perfName) perfName.innerText = `${memberName} (${memberId})`;
    
    const salesName = document.getElementById('sales-target-name');
    if (salesName) salesName.innerText = `${memberName} (${memberId})`;
    
    window.renderTree(false);
    
    const chkPerf = document.getElementById('chk-perf-widget');
    if (chkPerf && chkPerf.checked) window.restoreWidget('perfWidget'); 
    
    if(typeof window.loadTargetData === 'function') {
        try { await window.loadTargetData(memberId); } catch(e) {}
    }
    
    window.renderSalesWidget();
    if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') {
        window.searchPeriodSales();
    }
};

window.handleNodeClickLogic = function(id) {
    if (!id) return;

    if (window.cardClickTimer) {
        clearTimeout(window.cardClickTimer);
        window.cardClickTimer = null;
    }

    window.cardClickTimer = setTimeout(async () => {
        window.cardClickTimer = null;
        await window.executeNodeSingleClick(id);
    }, 220);
};

window.handleNodeDblClickLogic = function(e, id) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    
    if (window.cardClickTimer) {
        clearTimeout(window.cardClickTimer);
        window.cardClickTimer = null;
    }

    window.openEditMemberModal(id);
};

window.updatePeriodSummary = function() {
    const tbody = document.getElementById('period-sales-tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const checkedBoxes = tbody.querySelectorAll('.p-row-chk:checked');

    let totalCv = 0;
    let totalPv = 0;
    let count = 0;
    let isSelectionMode = checkedBoxes.length > 0;

    rows.forEach(tr => {
        const chk = tr.querySelector('.p-row-chk');
        if (!chk) return;

        if (isSelectionMode) {
            if (chk.checked) {
                const cvInput = tr.querySelector('.p-cv-input');
                const pvInput = tr.querySelector('.p-pv-input');
                let cv = Number((cvInput ? cvInput.value : '0').replace(/[^0-9]/g, '')) || 0;
                let pv = Number((pvInput ? pvInput.value : '0').replace(/[^0-9]/g, '')) || 0;
                totalCv += cv;
                totalPv += pv;
                count++;
            }
        } else {
            const cvInput = tr.querySelector('.p-cv-input');
            const pvInput = tr.querySelector('.p-pv-input');
            let cv = Number((cvInput ? cvInput.value : '0').replace(/[^0-9]/g, '')) || 0;
            let pv = Number((pvInput ? pvInput.value : '0').replace(/[^0-9]/g, '')) || 0;
            totalCv += cv;
            totalPv += pv;
            count++;
        }
    });

    const titleEl = document.getElementById('p-summary-title');
    const cvEl = document.getElementById('p-sum-cv');
    const pvEl = document.getElementById('p-sum-pv');

    if (titleEl) {
        titleEl.innerHTML = isSelectionMode 
            ? `📊 선택합계 (<strong style="color:#60a5fa;">${count}건</strong> 선택됨)` 
            : `📊 조회합계 (전체 <strong style="color:#9ca3af;">${count}건</strong>)`;
    }
    if (cvEl) cvEl.innerText = totalCv.toLocaleString();
    if (pvEl) pvEl.innerText = totalPv.toLocaleString();
};

window.toggleAllPeriodRows = function(masterChk) {
    const tbody = document.getElementById('period-sales-tbody');
    if (!tbody) return;
    const checkboxes = tbody.querySelectorAll('.p-row-chk');
    checkboxes.forEach(chk => {
        chk.checked = masterChk.checked;
    });
    window.updatePeriodSummary();
};

window.searchPeriodSales = async function() {
    const startEl = document.getElementById('p-start-date');
    const endEl = document.getElementById('p-end-date');

    const startVal = startEl?.value ? window.cleanDateStr(startEl.value) : '';
    const endVal = endEl?.value ? window.cleanDateStr(endEl.value) : '';
    
    if (startEl && startVal) startEl.value = startVal;
    if (endEl && endVal) endEl.value = endVal;

    const lineVal = document.getElementById('p-line')?.value || 'all';
    const typeVal = document.getElementById('p-type')?.value || 'all';

    const tbody = document.getElementById('period-sales-tbody');
    if (!tbody) return;
    
    const targetId = window.currentSelectedId || (window.treeData ? window.treeData.id : null);
    const titleEl = document.getElementById('filter-target-name');
    if (titleEl) {
        let tNode = window.findMemberNode(targetId);
        const tName = tNode ? tNode.name : '전체(루트)';
        titleEl.innerText = `(${tName} 기준 하선매출)`;
    }
    
    const lineMap = window.getRelativeLineMap(targetId);

    if (typeof window.fetchSalesHistory === 'function') {
        try { await window.fetchSalesHistory(startVal, endVal); } catch(e) {}
    }

    let db = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];

    let filtered = db.filter(item => {
        let memId = item.member_id || '';
        let isNewEmpty = String(item.id).startsWith('new_') && !memId;
        
        let relLine = '기타';
        if (window.isSameMemberId(memId, lineMap.Self)) relLine = '본인';
        else if (lineMap.A.has(memId) || lineMap.A.has(String(memId).trim().toLowerCase().replace(/^vk-?/, ''))) relLine = 'A';
        else if (lineMap.B.has(memId) || lineMap.B.has(String(memId).trim().toLowerCase().replace(/^vk-?/, ''))) relLine = 'B';
        
        if (relLine === '기타' && !isNewEmpty) return false;
        
        item._relLine = isNewEmpty ? '신규' : relLine;

        let matchDate = true;
        if (startVal && item.transaction_date && item.transaction_date < startVal) matchDate = false;
        if (endVal && item.transaction_date && item.transaction_date > endVal) matchDate = false;

        let matchLine = true;
        if (lineVal !== 'all') {
            if (lineVal === 'A' && relLine !== 'A') matchLine = false;
            if (lineVal === 'B' && relLine !== 'B') matchLine = false;
        }

        let matchType = (typeVal === 'all' || item.category === typeVal || item.type === typeVal);

        return matchDate && matchLine && matchType;
    });

    filtered.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));

    tbody.innerHTML = '';

    const allChk = document.getElementById('chk-all-period');
    if (allChk) allChk.checked = false;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:20px; color:#9ca3af; text-align:center;">선택된 회원의 해당 기간 하선 매출 내역이 없습니다.</td></tr>`;
        window.updatePeriodSummary();
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        
        let cvStr = Number(item.cv || 0).toLocaleString();
        let pvStr = Number(item.pv || 0).toLocaleString();
        let catVal = item.category || item.type || '매출';
        
        let relLine = item._relLine || '기타';
        let lineColor = (relLine === 'A') ? '#3b82f6' : (relLine === 'B') ? '#ef4444' : (relLine === '본인') ? '#10b981' : '#9ca3af';

        tr.innerHTML = `
            <td><input type="checkbox" class="p-row-chk" onchange="window.updatePeriodSummary()" style="cursor:pointer;"></td>
            <td>
                <input type="text" 
                       value="${item.transaction_date || ''}" 
                       style="width:70px; text-align:center; background:transparent; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" 
                       onfocus="window.onDateInputFocus(this)" 
                       onblur="window.onDateInputBlur(this, '${item.id}', 'transaction_date')" 
                       onkeydown="if(event.key==='Enter') this.blur();" 
                       placeholder="YYYY-MM-DD">
            </td>
            <td><input type="text" value="${item.member_id || ''}" style="width:60px; text-align:center; background:transparent; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" oninput="window.updatePeriodRow('${item.id}', 'member_id', this.value, true)"></td>
            <td><input type="text" value="${item.member_name || ''}" style="width:50px; text-align:center; background:transparent; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" onchange="window.updatePeriodRow('${item.id}', 'member_name', this.value, true)"></td>
            <td>
                <select style="background:#1f2937; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" onchange="window.updatePeriodRow('${item.id}', 'category', this.value, true); window.updatePeriodRow('${item.id}', 'type', this.value, true);">
                    <option value="매출" ${catVal === '매출' ? 'selected' : ''}>매출</option>
                    <option value="구독" ${catVal === '구독' ? 'selected' : ''}>구독</option>
                </select>
            </td>
            <td style="font-weight:bold; color:${lineColor}; padding:2px; font-size:11px;">${relLine}</td>
            <td><input type="text" class="p-cv-input" value="${cvStr}" style="width:55px; text-align:right; background:transparent; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" onblur="window.updatePeriodRowNum('${item.id}', 'cv', this); window.updatePeriodSummary();"></td>
            <td><input type="text" class="p-pv-input" value="${pvStr}" style="width:55px; text-align:right; background:transparent; color:#fff; border:1px solid #4b5563; border-radius:4px; padding:2px; font-size:10.5px;" onblur="window.updatePeriodRowNum('${item.id}', 'pv', this); window.updatePeriodSummary();"></td>
            <td><button onclick="window.deletePeriodSalesRow('${item.id}')" style="background:transparent; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:14px;">×</button></td>
        `;
        tbody.appendChild(tr);
    });

    window.updatePeriodSummary();
};

window.deletePeriodSalesRow = function(id) {
    if (confirm('해당 매출 내역을 삭제하시겠습니까?')) {
        let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
        let targetItem = allSales.find(item => String(item.id) === String(id) || String(item._dbId) === String(id));

        let dbId = targetItem ? targetItem._dbId : null;
        if (!dbId && id && !String(id).startsWith('new_') && !String(id).startsWith('temp_') && !String(id).startsWith('db_')) {
            dbId = id;
        }

        ['integrated_sales_history', 'currentSalesData', 'realSalesData', 'allSalesData', 'salesHistory'].forEach(key => {
            if (Array.isArray(window[key])) {
                window[key] = window[key].filter(item => {
                    if (!item) return false;
                    if (String(item.id) === String(id)) return false;
                    if (dbId && (String(item._dbId) === String(dbId) || String(item.id) === String(dbId) || String(item.sales_id) === String(dbId))) return false;
                    return true;
                });
            }
        });

        if (dbId && typeof window.deleteSalesHistoryRow === 'function') {
            window.deleteSalesHistoryRow(dbId);
        }

        window.renderSalesWidget();
        if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') {
            window.searchPeriodSales();
        }
        if (window.currentSelectedId) {
            window.calculateLocalPerformance(window.currentSelectedId);
        }
        window.renderTree(false);
    }
};

window.addPeriodSalesRow = function() {
    window.integrated_sales_history = window.integrated_sales_history || [];
    
    const startVal = document.getElementById('p-start-date')?.value;
    let defaultDate = window.cleanDateStr(startVal);

    if (!defaultDate) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        defaultDate = `${yyyy}-${mm}-${dd}`;
    }

    const newId = `new_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const newRow = {
        id: newId,
        _dbId: null,
        transaction_date: defaultDate,
        member_id: '',
        member_name: '',
        category: '매출',
        type: '매출',
        cv: 0,
        pv: 0
    };

    window.integrated_sales_history.unshift(newRow);
    
    window.renderSalesWidget();
    window.searchPeriodSales();
};

window.updatePeriodRow = function(id, field, value, syncDb = false) {
    let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    let item = allSales.find(s => String(s.id) === String(id) || String(s._dbId) === String(id));
    if (item) {
        item[field] = value;
        ['integrated_sales_history', 'currentSalesData', 'realSalesData', 'allSalesData', 'salesHistory'].forEach(key => {
            if (Array.isArray(window[key])) {
                let target = window[key].find(s => s && (String(s.id) === String(id) || String(s._dbId) === String(id)));
                if (target) target[field] = value;
            }
        });
    }
};

window.updatePeriodRowNum = function(id, field, inputEl) {
    if (!inputEl) return;
    let rawVal = inputEl.value.replace(/[^0-9]/g, '');
    let numVal = Number(rawVal) || 0;
    inputEl.value = numVal.toLocaleString();
    window.updatePeriodRow(id, field, numVal, true);
    if (window.currentSelectedId) {
        window.calculateLocalPerformance(window.currentSelectedId);
    }
};

window.saveSalesData = async function() {
    let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    let savedCount = 0;
    for (let item of allSales) {
        if (item && !item._dbId && item.member_id && item.transaction_date && (item.cv > 0 || item.pv > 0)) {
            let res = await window.saveSalesHistoryRow(item);
            if (res && res.id) {
                item._dbId = res.id;
                savedCount++;
            }
        }
    }
    alert(savedCount > 0 ? `${savedCount}건의 매출이 DB에 동기화되었습니다.` : '동기화할 신규 매출 내역이 없습니다.');
    if (typeof window.fetchSalesHistory === 'function') await window.fetchSalesHistory();
    if (window.currentSelectedId) window.calculateLocalPerformance(window.currentSelectedId);
    window.renderSalesWidget();
};

window.addParentPartner = function(e, childId) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    
    let childNode = window.findMemberNode(childId);
    if (!childNode) return;

    window.addPartnerState = {
        isAddingParent: true,
        childId: childNode.id,
        position: 'left'
    };

    const modalTitle = document.getElementById('modal-partner-title');
    if (modalTitle) {
        modalTitle.innerText = `신규 상위 파트너 등록 (${childNode.name} 상위 배치)`;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newNum = Math.floor(1200000 + Math.random() * 900000);
    const newId = `VK-${newNum}`;

    const elCode = document.getElementById('m-code'); if (elCode) elCode.value = 'm';
    const elId = document.getElementById('m-id'); if (elId) elId.value = newId;
    const elName = document.getElementById('m-name'); if (elName) elName.value = '';
    const elSpon = document.getElementById('m-spon-id'); if (elSpon) elSpon.value = '최상위 파트너';
    const elPos = document.getElementById('m-pos'); if (elPos) elPos.value = 'A라인';
    const elRecId = document.getElementById('m-rec-id'); if (elRecId) elRecId.value = '';
    const elRecName = document.getElementById('m-rec-name'); if (elRecName) elRecName.value = '';
    const elJoin = document.getElementById('m-join-date'); if (elJoin) elJoin.value = todayStr;
    const elFirst = document.getElementById('m-first-sales'); if (elFirst) elFirst.value = todayStr;
    const elLast = document.getElementById('m-last-sales'); if (elLast) elLast.value = todayStr;

    const modal = document.getElementById('addPartnerModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.addTreeChild = function(e, parentId, position) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    
    let recommenderNode = window.findMemberNode(parentId);
    if (!recommenderNode) return;

    let sponsorNode = recommenderNode;
    let actualPos = position || 'left';

    if (actualPos === 'left' && sponsorNode.left) {
        let curr = window.findMemberNode(typeof sponsorNode.left === 'object' ? sponsorNode.left.id : sponsorNode.left);
        while (curr && curr.left) {
            let next = window.findMemberNode(typeof curr.left === 'object' ? curr.left.id : curr.left);
            if (!next) break;
            curr = next;
        }
        if (curr) sponsorNode = curr;
    } else if (actualPos === 'right' && sponsorNode.right) {
        let curr = window.findMemberNode(typeof sponsorNode.right === 'object' ? sponsorNode.right.id : sponsorNode.right);
        while (curr && curr.right) {
            let next = window.findMemberNode(typeof curr.right === 'object' ? curr.right.id : curr.right);
            if (!next) break;
            curr = next;
        }
        if (curr) sponsorNode = curr;
    }

    window.addPartnerState = {
        isAddingParent: false,
        recommenderId: recommenderNode.id,
        sponsorId: sponsorNode.id,
        position: actualPos
    };

    const modalTitle = document.getElementById('modal-partner-title');
    if (modalTitle) {
        const isSpillover = !window.isSameMemberId(sponsorNode.id, recommenderNode.id);
        modalTitle.innerText = `신규 파트너 등록 (${actualPos === 'left' ? 'A라인' : 'B라인'}${isSpillover ? ' 스필오버' : ''} 추가)`;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newNum = Math.floor(1200000 + Math.random() * 900000);
    const newId = `VK-${newNum}`;

    const autoCode = window.predictMemberCode(recommenderNode, sponsorNode, actualPos);

    const elCode = document.getElementById('m-code'); if (elCode) elCode.value = autoCode;
    const elId = document.getElementById('m-id'); if (elId) elId.value = newId;
    const elName = document.getElementById('m-name'); if (elName) elName.value = '';
    const elSpon = document.getElementById('m-spon-id'); if (elSpon) elSpon.value = sponsorNode.id;
    const elPos = document.getElementById('m-pos'); if (elPos) elPos.value = actualPos === 'left' ? 'A라인' : 'B라인';
    const elRecId = document.getElementById('m-rec-id'); if (elRecId) elRecId.value = recommenderNode.id;
    const elRecName = document.getElementById('m-rec-name'); if (elRecName) elRecName.value = recommenderNode.name || '';
    const elJoin = document.getElementById('m-join-date'); if (elJoin) elJoin.value = todayStr;
    const elFirst = document.getElementById('m-first-sales'); if (elFirst) elFirst.value = todayStr;
    const elLast = document.getElementById('m-last-sales'); if (elLast) elLast.value = todayStr;

    const modal = document.getElementById('addPartnerModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.closeAddPartnerModal = function() {
    const modal = document.getElementById('addPartnerModal');
    if (modal) modal.style.display = 'none';
    window.removeTaskbarItem('addPartnerModal');
};

window.submitAddPartner = async function() {
    const nameVal = document.getElementById('m-name')?.value.trim();
    if (!nameVal) {
        alert('회원이름을 입력해주세요.');
        document.getElementById('m-name')?.focus();
        return;
    }

    const posSelectVal = document.getElementById('m-pos')?.value === 'A라인' ? 'left' : 'right';
    let newId = document.getElementById('m-id')?.value.trim() || `VK-${Date.now().toString().slice(-7)}`;
    if (!/^vk-/i.test(newId) && /^\d+$/.test(newId)) newId = 'VK-' + newId;

    const rankVal = document.getElementById('m-rank')?.value || 'MANIA';
    const typeVal = document.getElementById('m-type')?.value || '사업자';
    
    const joinDateVal = window.cleanDateStr(document.getElementById('m-join-date')?.value);
    const firstSalesVal = window.cleanDateStr(document.getElementById('m-first-sales')?.value);
    const lastSalesVal = window.cleanDateStr(document.getElementById('m-last-sales')?.value);

    let recIdVal = document.getElementById('m-rec-id')?.value.trim();
    if (recIdVal && !/^vk-/i.test(recIdVal) && /^\d+$/.test(recIdVal)) recIdVal = 'VK-' + recIdVal;
    const recNameVal = document.getElementById('m-rec-name')?.value.trim();

    if (window.addPartnerState && window.addPartnerState.isAddingParent) {
        let childNode = window.findMemberNode(window.addPartnerState.childId);
        if (!childNode) {
            alert('기존 최상위 파트너를 찾을 수 없습니다.');
            return;
        }

        const newMember = {
            id: newId,
            name: nameVal,
            rank: rankVal,
            type: typeVal,
            code: 'm',
            joinDate: joinDateVal,
            firstSales: firstSalesVal,
            lastSales: lastSalesVal,
            recId: recIdVal || null,
            recName: recNameVal || null,
            sponId: null,
            parent_id: null,
            line: 'A',
            left: posSelectVal === 'left' ? childNode : null,
            right: posSelectVal === 'right' ? childNode : null
        };

        childNode.parent_id = newId;
        childNode.sponId = newId;
        childNode.position = posSelectVal === 'left' ? 'A' : 'B';

        window.flatMembersData = window.getFlatMembers();
        window.flatMembersData[newId] = newMember;
        window.treeData = newMember;

        if (typeof window.saveNewMember === 'function') {
            await window.saveNewMember(newMember);
        }

        try {
            await fetch(`${window.API_BASE}/api/member/${childNode.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newId: childNode.id,
                    name: childNode.name,
                    rank: childNode.rank || childNode.rank_name,
                    type: childNode.type || childNode.member_type,
                    parentId: newId,
                    position: posSelectVal === 'left' ? 'A' : 'B',
                    recId: childNode.recId || childNode.recommender_id,
                    recName: childNode.recName || childNode.recommender_name,
                    join_date: childNode.joinDate || childNode.join_date
                })
            });
        } catch(e) {
            console.warn("기존 파트너 상위 연결 업데이트 실패:", e);
        }

        window.addPartnerState.isAddingParent = false;
        window.computeDynamicCodes();
        window.renderTree(true);
        window.closeAddPartnerModal();
        return;
    }

    const sponInputVal = document.getElementById('m-spon-id')?.value.trim();
    if (!sponInputVal) {
        alert('후원인번호를 입력하거나 계보도 카드를 선택해주세요.');
        return;
    }

    let sponsorNode = window.findMemberNode(sponInputVal);
    let recommenderNode = window.findMemberNode(recIdVal) || sponsorNode;
    
    if (!sponsorNode) {
        alert('존재하지 않는 후원인번호입니다. 계보도 카드를 클릭하여 다시 선택해 주세요.');
        return;
    }

    let targetSponsor = sponsorNode;
    if (posSelectVal === 'left' && targetSponsor.left) {
        let curr = window.findMemberNode(typeof targetSponsor.left === 'object' ? targetSponsor.left.id : targetSponsor.left);
        while (curr && curr.left) {
            let next = window.findMemberNode(typeof curr.left === 'object' ? curr.left.id : curr.left);
            if (!next) break;
            curr = next;
        }
        if (curr) targetSponsor = curr;
    } else if (posSelectVal === 'right' && targetSponsor.right) {
        let curr = window.findMemberNode(typeof targetSponsor.right === 'object' ? targetSponsor.right.id : targetSponsor.right);
        while (curr && curr.right) {
            let next = window.findMemberNode(typeof curr.right === 'object' ? curr.right.id : curr.right);
            if (!next) break;
            curr = next;
        }
        if (curr) targetSponsor = curr;
    }

    const finalCode = document.getElementById('m-code')?.value || 'm-1-a1';

    const newMember = {
        id: newId,
        name: nameVal,
        rank: rankVal,
        type: typeVal,
        code: finalCode,
        joinDate: joinDateVal,
        firstSales: firstSalesVal,
        lastSales: lastSalesVal,
        recId: recommenderNode ? recommenderNode.id : recIdVal,
        recName: recommenderNode ? recommenderNode.name : recNameVal,
        sponId: targetSponsor.id,
        line: posSelectVal === 'left' ? 'A' : 'B',
        left: null,
        right: null
    };

    window.flatMembersData = window.getFlatMembers();
    window.flatMembersData[newId] = newMember;

    if (posSelectVal === 'left') targetSponsor.left = newMember;
    else targetSponsor.right = newMember;

    window.computeDynamicCodes(window.currentSelectedId);

    window.renderTree(false);
    window.closeAddPartnerModal();

    if (typeof window.saveNewMember === 'function') {
        await window.saveNewMember(newMember);
    }
};

window.openEditMemberModal = function(id) {
    let member = window.findMemberNode(id);
    if (!member) {
        alert('회원 정보를 찾을 수 없습니다.');
        return;
    }

    let minD = '', maxD = '';
    const allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    const memSales = allSales.filter(s => window.isSameMemberId(s.member_id, member.id));
    
    if (memSales.length > 0) {
        const dates = memSales.map(s => window.cleanDateStr(s.transaction_date || s.date || s.buy_date || s.sales_date || '')).filter(d => d);
        if (dates.length > 0) {
            dates.sort();
            minD = dates[0];
            maxD = dates[dates.length - 1];
        }
    }

    const jDate = member.joinDate || member.join_date || member.regDate || member.reg_date || '';
    const fSales = minD || member.firstSales || member.firstSalesDate || member.first_sales || member.first_sales_date || '';
    const lSales = maxD || member.lastSales || member.lastSalesDate || member.last_sales || member.last_sales_date || '';
    const codeVal = window.getDynamicCode(member.id) || member.code || '';

    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.value = value || '';
    };

    setVal('edit-m-code', codeVal);
    setVal('edit-m-original-id', member.id);
    setVal('edit-m-id', member.id);
    setVal('edit-m-name', member.name || '');
    setVal('edit-m-rank', member.rank || member.rank_name || 'MANIA');
    setVal('edit-m-type', member.type || member.member_type || '사업자');

    const recId = member.recId || member.recommender_id || '';
    setVal('edit-m-rec-id', recId);
    
    let recNode = recId ? window.findMemberNode(recId) : null;
    setVal('edit-m-rec-name', recNode ? recNode.name : (member.recName || member.recommender_name || ''));

    setVal('edit-m-join-date', window.cleanDateStr(jDate));
    setVal('edit-m-first-sales', window.cleanDateStr(fSales));
    setVal('edit-m-last-sales', window.cleanDateStr(lSales));

    const modal = document.getElementById('editMemberModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    }
};

window.submitEditMember = async function() {
    const originalId = document.getElementById('edit-m-original-id')?.value;
    const newIdRaw = document.getElementById('edit-m-id')?.value?.trim();
    const nameVal = document.getElementById('edit-m-name')?.value?.trim();

    if (!newIdRaw || !nameVal) {
        alert('회원번호와 회원이름은 필수 입력 항목입니다.');
        return;
    }

    let member = window.findMemberNode(originalId);
    if (!member) return;

    let newId = newIdRaw;
    if (!/^vk-/i.test(newId) && /^\d+$/.test(newId)) newId = 'VK-' + newId;

    let recIdVal = document.getElementById('edit-m-rec-id')?.value?.trim() || '';
    if (recIdVal && !/^vk-/i.test(recIdVal) && /^\d+$/.test(recIdVal)) recIdVal = 'VK-' + recIdVal;

    const rankVal = document.getElementById('edit-m-rank')?.value || 'MANIA';
    const typeVal = document.getElementById('edit-m-type')?.value || '사업자';
    const recNameVal = document.getElementById('edit-m-rec-name')?.value?.trim() || '';
    
    const joinDateVal = window.cleanDateStr(document.getElementById('edit-m-join-date')?.value);
    const firstSalesVal = window.cleanDateStr(document.getElementById('edit-m-first-sales')?.value);
    const lastSalesVal = window.cleanDateStr(document.getElementById('m-last-sales')?.value);
    const codeVal = document.getElementById('edit-m-code')?.value?.trim() || '';

    member.id = newId;
    member.name = nameVal;
    member.rank = rankVal;
    member.rank_name = rankVal;
    member.type = typeVal;
    member.member_type = typeVal;
    member.recId = recIdVal;
    member.recommender_id = recIdVal;
    member.recName = recNameVal;
    member.recommender_name = recNameVal;
    member.joinDate = joinDateVal;
    member.join_date = joinDateVal;
    member.firstSales = firstSalesVal;
    member.lastSales = lastSalesVal;
    member.code = codeVal;

    try {
        await fetch(`${window.API_BASE}/api/member/${originalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newId: newId,
                name: nameVal,
                rank: rankVal,
                type: typeVal,
                code: codeVal,
                join_date: joinDateVal,
                recId: recIdVal,
                recName: recNameVal,
                firstSales: firstSalesVal,
                lastSales: lastSalesVal,
                parentId: member.parent_id || member.sponId,
                position: member.position || member.line
            })
        });
    } catch(e) {
        console.warn("DB 회원정보 수정 통신 실패:", e);
    }

    window.closeEditMemberModal();
    window.renderTree(false);
};

window.minimizeAddPartnerModal = function() {
    const titleEl = document.getElementById('modal-partner-title');
    const title = titleEl ? titleEl.innerText : '신규 파트너 등록';
    window.minimizeWidget('addPartnerModal', title);
};

window.minimizeEditMemberModal = function() {
    const mName = document.getElementById('edit-m-name')?.value || '';
    const mId = document.getElementById('edit-m-id')?.value || '';
    window.minimizeWidget('editMemberModal', `회원수정: ${mName}(${mId})`);
};

window.closeEditMemberModal = function() {
    const modal = document.getElementById('editMemberModal');
    if (modal) modal.style.display = 'none';
    window.removeTaskbarItem('editMemberModal');
};

window.minimizeWidget = function(widgetId, title) {
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    if (window.getComputedStyle(widget).display === 'none') return;

    widget.style.display = 'none';

    const taskbar = document.getElementById('taskbar');
    if (!taskbar) return;
    if (document.getElementById('taskbar-' + widgetId)) return;

    const tab = document.createElement('div');
    tab.id = 'taskbar-' + widgetId;
    tab.className = 'taskbar-item';
    tab.innerHTML = `${title} <svg width="14" height="14" style="margin-left: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
    tab.title = "클릭하여 창 복원";
    
    tab.onclick = function(e) {
        e.stopPropagation();
        window.restoreWidget(widgetId);
    };
    taskbar.appendChild(tab);
};

window.restoreWidget = function(widgetId) {
    const widget = document.getElementById(widgetId);
    if (widget) {
        widget.style.display = (widgetId === 'addPartnerModal' || widgetId === 'editMemberModal' || widgetId === 'bonusDetailModal') ? 'flex' : 'block';
    }
    
    window.removeTaskbarItem(widgetId); 
    
    const chkMap = { 'perfWidget': 'chk-perf-widget', 'aiWidget': 'chk-ai-widget', 'filterWidget': 'chk-filter-widget' };
    const chkId = chkMap[widgetId];
    if (chkId) {
        const chk = document.getElementById(chkId);
        if (chk) chk.checked = true;
    }
};

window.treeMode = 'sponsor'; 
window.toggleTreeMode = function() {
    window.treeMode = window.treeMode === 'sponsor' ? 'recommender' : 'sponsor';
    const btn = document.getElementById('toggleTreeBtn');
    
    if (window.treeMode === 'recommender') {
        const topRoot = window.getAbsoluteTopRoot();
        window.recommenderRootId = topRoot ? topRoot.id : null;
        
        if (btn) {
            btn.style.color = "#10b981"; 
            btn.title = "후원계보도로 전환 (현재: 후원계보도)";
        }
        window.renderTree(true); 
    } else {
        if (btn) {
            btn.style.color = ""; 
            btn.title = "추천계보도로 전환 (현재: 후원계보도)";
        }
        if (typeof window.fetchTreeData === 'function') window.fetchTreeData(true);
        else window.renderTree(true);
    }
};

window.searchMember = function() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const keyword = input.value.trim().toLowerCase();
    
    document.querySelectorAll('.node-card').forEach(el => {
        el.style.borderColor = ''; 
        el.style.borderWidth = '';
    });

    if (!keyword) return;

    let matchCount = 0;
    const members = window.getUniqueMembers();
    
    members.forEach(m => {
        const searchString = `${m.id || ''} ${m.name || ''} ${m.code || ''} ${m.recId || ''} ${m.recName || ''} ${m.rank || ''}`.toLowerCase();
        
        if (searchString.includes(keyword)) {
            const card = document.getElementById(`card_${m.id}`);
            if (card) {
                card.style.borderColor = '#f97316'; 
                card.style.borderWidth = '3px';
                matchCount++;
            }
        }
    });

    if (matchCount === 0) alert('검색 결과가 없습니다. 다시 확인해주세요.');
};

window.searchPanelMember = function(event, inputEl) {
    if (!inputEl) inputEl = document.getElementById('salesSearchInput');
    if (!inputEl) return;
    
    if (event && event.key && event.key !== 'Enter') return;

    const keyword = inputEl.value.trim().toLowerCase();
    if (!keyword) return;

    const members = window.getUniqueMembers();
    let found = members.find(m => m && ((m.id && m.id.toLowerCase() === keyword) || (m.name && m.name.toLowerCase() === keyword)));
    if (!found) found = members.find(m => m && ((m.id && m.id.toLowerCase().includes(keyword)) || (m.name && m.name.toLowerCase().includes(keyword))));

    if (found) {
        window.handleNodeClickLogic(found.id); 
        inputEl.value = ''; 
    } else {
        alert('일치하는 회원명 또는 ID를 찾을 수 없습니다.');
    }
};

window.clickSearchPanel = function() {
    const inputEl = document.getElementById('salesSearchInput');
    if (inputEl) window.searchPanelMember(null, inputEl);
};

window.toggleSimMode = async function() {
    const chk = document.getElementById('sim-mode-toggle');
    window.simMode = chk.checked;
    
    if (window.simMode) {
        document.body.classList.add('sim-mode-active');
        document.getElementById('sim-controls').style.display = 'flex';
        window.simMembers = Object.values(window.getFlatMembers()).map(m => ({...m}));
        window.simSales = []; 
    } else {
        document.body.classList.remove('sim-mode-active');
        document.getElementById('sim-controls').style.display = 'none';
        window.simMembers = []; window.simSales = [];
    }
    if (typeof window.fetchTreeData === 'function') await window.fetchTreeData(true);
};

window.onDateInputFocus = function(el) {
    if (!el || !el.value) return;
    let val = el.value.trim();
    let numOnly = val.replace(/[^0-9]/g, '');
    
    if (numOnly.length === 8) {
        el.value = numOnly.slice(4, 8);
    } else if (val.includes('-')) {
        let parts = val.split('-');
        if (parts.length === 3) {
            el.value = parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
        }
    }
    el.select();
};

window.onDateInputBlur = function(el, id = null, field = null) {
    if (!el) return;
    let formatted = window.cleanDateStr(el.value);
    el.value = formatted;
    
    if (id && field && typeof window.updatePeriodRow === 'function') {
        window.updatePeriodRow(id, field, formatted);
    }
};

window.applyPeriodPreset = function(preset) {
    const startEl = document.getElementById('p-start-date');
    const endEl = document.getElementById('p-end-date');
    if (!startEl || !endEl) return;

    window.currentPeriodAnchorDate = new Date(); 
    const anchor = window.currentPeriodAnchorDate;
    const yyyy = anchor.getFullYear();
    const mm = String(anchor.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(yyyy, anchor.getMonth() + 1, 0).getDate();

    if (preset === 'all') {
        startEl.value = '';
        endEl.value = '';
    } else if (preset === 'month') {
        startEl.value = `${yyyy}-${mm}-01`;
        endEl.value = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'term') {
        if (anchor.getDate() <= 15) {
            startEl.value = `${yyyy}-${mm}-01`;
            endEl.value = `${yyyy}-${mm}-15`;
        } else {
            startEl.value = `${yyyy}-${mm}-16`;
            endEl.value = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
        }
    }
    if (typeof window.searchPeriodSales === 'function') {
        window.searchPeriodSales();
    }
};

window.navigatePeriod = function(direction) {
    const presetSelect = document.getElementById('p-preset');
    const preset = presetSelect ? presetSelect.value : 'custom';
    
    let anchor = window.currentPeriodAnchorDate || new Date();
    
    if (preset === 'month' || preset === 'custom' || preset === 'all') {
        anchor.setMonth(anchor.getMonth() + direction);
        window.currentPeriodAnchorDate = anchor;

        const yyyy = anchor.getFullYear();
        const mm = String(anchor.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(yyyy, anchor.getMonth() + 1, 0).getDate();

        document.getElementById('p-start-date').value = `${yyyy}-${mm}-01`;
        document.getElementById('p-end-date').value = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'term') {
        let isFirstTerm = anchor.getDate() <= 15;

        if (direction === 1) { 
            if (isFirstTerm) {
                anchor.setDate(16); 
            } else {
                anchor.setMonth(anchor.getMonth() + 1); 
                anchor.setDate(1);
            }
        } else if (direction === -1) { 
            if (isFirstTerm) {
                anchor.setMonth(anchor.getMonth() - 1); 
                anchor.setDate(16);
            } else {
                anchor.setDate(1); 
            }
        }

        window.currentPeriodAnchorDate = anchor;

        const yyyy = anchor.getFullYear();
        const mm = String(anchor.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(yyyy, anchor.getMonth() + 1, 0).getDate();

        if (anchor.getDate() <= 15) {
            document.getElementById('p-start-date').value = `${yyyy}-${mm}-01`;
            document.getElementById('p-end-date').value = `${yyyy}-${mm}-15`;
        } else {
            document.getElementById('p-start-date').value = `${yyyy}-${mm}-16`;
            document.getElementById('p-end-date').value = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
        }
    }

    if (typeof window.searchPeriodSales === 'function') {
        window.searchPeriodSales();
    }
};

window.updatePeriodRow = function(id, field, value, syncDb = false) {
    let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    let item = allSales.find(s => String(s.id) === String(id) || String(s._dbId) === String(id));
    if (item) {
        item[field] = value;
        ['integrated_sales_history', 'currentSalesData', 'realSalesData', 'allSalesData', 'salesHistory'].forEach(key => {
            if (Array.isArray(window[key])) {
                let target = window[key].find(s => s && (String(s.id) === String(id) || String(s._dbId) === String(id)));
                if (target) target[field] = value;
            }
        });
    }
};

window.updatePeriodRowNum = function(id, field, inputEl) {
    if (!inputEl) return;
    let rawVal = inputEl.value.replace(/[^0-9]/g, '');
    let numVal = Number(rawVal) || 0;
    inputEl.value = numVal.toLocaleString();
    window.updatePeriodRow(id, field, numVal, true);
    if (window.currentSelectedId) {
        window.calculateLocalPerformance(window.currentSelectedId);
    }
};

window.saveSalesData = async function() {
    let allSales = typeof window.getAllSalesListFromDB === 'function' ? window.getAllSalesListFromDB() : [];
    let savedCount = 0;
    for (let item of allSales) {
        if (item && !item._dbId && item.member_id && item.transaction_date && (item.cv > 0 || item.pv > 0)) {
            let res = await window.saveSalesHistoryRow(item);
            if (res && res.id) {
                item._dbId = res.id;
                savedCount++;
            }
        }
    }
    alert(savedCount > 0 ? `${savedCount}건의 매출이 DB에 동기화되었습니다.` : '동기화할 신규 매출 내역이 없습니다.');
    if (typeof window.fetchSalesHistory === 'function') await window.fetchSalesHistory();
    if (window.currentSelectedId) window.calculateLocalPerformance(window.currentSelectedId);
    window.renderSalesWidget();
};

// ============================================================================
// 🌟 [드래그 및 마우스 이벤트 제어]
// ============================================================================

let activeDragWidget = null;
let dragOffsetX = 0, dragOffsetY = 0;

document.addEventListener('pointerdown', (e) => {
    const header = e.target.closest('.widget-header');
    if (!header) return;

    const widget = header.closest('.widget');
    if (!widget || widget.id === 'salesWidget' || widget.id === 'perfWidget') return;
    if (e.target.closest('button, input, select, .close')) return;

    activeDragWidget = widget;
    const rect = widget.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    document.querySelectorAll('.widget').forEach(w => {
        if (w.id !== 'salesWidget' && w.id !== 'perfWidget') w.style.zIndex = '950';
    });
    widget.style.zIndex = '999';

    e.preventDefault();
});

document.addEventListener('pointermove', (e) => {
    if (!activeDragWidget) return;

    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    if (newY < 60) newY = 60;
    const maxW = window.innerWidth - activeDragWidget.offsetWidth;
    const maxH = window.innerHeight - 40;

    if (newX < 0) newX = 0;
    if (newX > maxW) newX = maxW;
    if (newY > maxH) newY = maxH;

    activeDragWidget.style.left = newX + 'px';
    activeDragWidget.style.top = newY + 'px';
    activeDragWidget.style.right = 'auto';
    activeDragWidget.style.bottom = 'auto';
    activeDragWidget.style.margin = '0';
});

document.addEventListener('pointerup', () => { activeDragWidget = null; });

let globalClickStartX = 0;
let globalClickStartY = 0;
let isDraggingCanvas = false;
let canvasDragStartX = 0, canvasDragStartY = 0;

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas-container');
    if(canvas) {
        canvas.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.widget, .node-card, .zoom-controls, .top-header-bar, button, input, select, .taskbar-item, #perf-resizer')) return;
            isDraggingCanvas = true;
            canvasDragStartX = e.clientX - window.panX;
            canvasDragStartY = e.clientY - window.panY;
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDraggingCanvas) return;
            e.preventDefault(); 
            window.panX = e.clientX - canvasDragStartX;
            window.panY = e.clientY - canvasDragStartY;
            const wrapper = document.getElementById('tree-wrapper');
            if(wrapper) wrapper.style.transform = `translate(${window.panX}px, ${window.panY}px) scale(${window.scale})`;
        });

        window.addEventListener('pointerup', () => {
            isDraggingCanvas = false;
            if(canvas) canvas.style.cursor = 'default';
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault(); 
            const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05; 
            if(typeof window.changeZoom === 'function') window.changeZoom(zoomDelta, e.clientX, e.clientY);
        }, { passive: false }); 
    }
});

document.addEventListener('mousedown', (e) => {
    globalClickStartX = e.clientX;
    globalClickStartY = e.clientY;
});

// ESC 키 누름 시 카드 선택 해제 및 화면 리셋
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        window.closeAddPartnerModal();
        window.closeEditMemberModal();
        window.closeBonusDetailModal();
        
        window.currentSelectedId = null; 
        
        document.querySelectorAll('.node-card').forEach(el => {
            el.style.borderColor = '';
            el.style.borderWidth = '';
        });
        
        const salesName = document.getElementById('sales-target-name');
        if (salesName) salesName.innerText = '선택 안됨';
        window.renderSalesWidget();

        window.calculateLocalPerformance(null);

        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        
        const salesSearchInput = document.getElementById('salesSearchInput');
        if (salesSearchInput) salesSearchInput.value = '';
        
        if (document.getElementById('filterWidget') && document.getElementById('filterWidget').style.display !== 'none') {
            window.searchPeriodSales();
        }

        window.renderTree(false); 
    }
});

document.addEventListener('mouseup', (e) => {
    const diffX = Math.abs(e.clientX - globalClickStartX);
    const diffY = Math.abs(e.clientY - globalClickStartY);
    if (diffX > 5 || diffY > 5) return; 
    
    if (e.target.closest('.widget') || e.target.closest('.node-card') || e.target.closest('.top-header-bar') || e.target.closest('.zoom-controls') || e.target.closest('.taskbar-item') || e.target.closest('button') || e.target.closest('input')) {
        return;
    }

    const widgetsToMinimize = [
        { id: 'aiWidget', title: '🧭 비지네스 내비게이터' },
        { id: 'filterWidget', title: '🔎 매출 기간 검색' }
    ];

    widgetsToMinimize.forEach(w => {
        const widget = document.getElementById(w.id);
        if (widget && window.getComputedStyle(widget).display !== 'none') {
            window.minimizeWidget(w.id, w.title);
        }
    });
});