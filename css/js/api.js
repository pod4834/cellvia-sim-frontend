// frontend/css/js/api.js
// 백엔드 API 비동기 통신 모듈 (로컬 개발 & 클라우드 웹 배포 자동 감지 지원)

(function initApiBaseConfig() {
    const host = window.location.hostname;
    const isLocal = (
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '' ||
        window.location.protocol === 'file:'
    );

    // 💡 프론트엔드와 백엔드를 별도 도메인으로 분리 배포할 경우에만 아래 문자열에 백엔드 주소를 입력하세요.
    // (예: 'https://cellvia-sim-backend.onrender.com')
    // 지금처럼 server.js가 프론트엔드까지 통합 서빙할 때는 비워두시면 현재 도메인(window.location.origin)을 자동 사용합니다.
    const SEPARATE_PROD_BACKEND_URL = '';

    const resolvedBase = isLocal
        ? 'http://127.0.0.1:3001'
        : (SEPARATE_PROD_BACKEND_URL || window.location.origin);

    window.API_BASE = (window.API_BASE || resolvedBase).replace(/\/+$/, '');
    window.API_BASE_URL = window.API_BASE; // main.js 등 타 스크립트 호환용 별칭
})();

window.loadTargetData = async function(id) {
    if (!id) return;

    let cleanId = String(id).trim().replace(/^VK-?/i, '');
    let targetId = cleanId ? cleanId : id;

    try {
        let salesRes = await fetch(`${window.API_BASE}/api/sales/${encodeURIComponent(targetId)}`);
        if (salesRes.ok) {
            const salesData = await salesRes.json();
            window.currentSalesData = Array.isArray(salesData) ? salesData : (salesData.data || []);
        } else {
            window.currentSalesData = [];
        }
    } catch (e) {
        window.currentSalesData = [];
    }

    if (typeof window.calculateLocalPerformance === 'function') {
        window.calculateLocalPerformance(id);
    }

    if (typeof window.renderSalesWidget === 'function') {
        window.renderSalesWidget();
    }
};

// 🌟 덮어쓰기 전에 main.js에서 먼저 선언된 fetchTreeData가 있다면 안전하게 보존
if (typeof window.fetchTreeData === 'function' && window.fetchTreeData.toString().includes("서버 통신 에러 발생")) {
    window.fetchTreeData_MAIN = window.fetchTreeData;
}

window.fetchTreeData = async function(recenter = false) {
    // main.js의 전용 fetchTreeData_MAIN이 있으면 위임
    if (typeof window.fetchTreeData_MAIN === 'function' && window.fetchTreeData_MAIN !== window.fetchTreeData) {
        return window.fetchTreeData_MAIN(recenter);
    }

    try {
        if (typeof window.fetchSalesHistory === 'function') {
            try { await window.fetchSalesHistory(); } catch (e) {}
        }

        const res = await fetch(`${window.API_BASE}/api/tree`);
        if (!res.ok) throw new Error(`서버 응답 상태 코드: ${res.status}`);
        
        const data = await res.json();
        if (data && data.tree) {
            window.treeData = data.tree;
            window.flatMembersData = data.flatMembers || {};

            // 서버에서 함께 전달된 보상플랜 정책(compRules) 전역 동기화
            if (data.compRules) window.compRules = data.compRules;
            if (data.policiesByRankName) window.policiesByRankName = data.policiesByRankName;
            
            try {
                let localMembers = JSON.parse(localStorage.getItem('bs_new_members') || '[]');
                localMembers.forEach(newMem => {
                    if (!window.flatMembersData[newMem.id]) {
                        window.flatMembersData[newMem.id] = newMem;
                        let parent = window.flatMembersData[newMem.sponId];
                        if (parent) {
                            if (newMem.line === 'A') parent.left = newMem;
                            else if (newMem.line === 'B') parent.right = newMem;
                        }
                    }
                });
            } catch (e) {}
            
            if (typeof window.renderTree === 'function') {
                window.renderTree(recenter);
            }
        } else {
            throw new Error("서버에서 계보도 데이터를 받지 못했습니다.");
        }
    } catch (e) {
        console.error("🔥 계보도 트리 데이터 수신 실패:", e);
        throw e;
    }
};

window.saveNewMember = async function(memberObj) {
    if (!memberObj) return;
    
    try {
        let localMembers = JSON.parse(localStorage.getItem('bs_new_members') || '[]');
        if (!localMembers.find(m => m.id === memberObj.id)) {
            localMembers.push(memberObj);
            localStorage.setItem('bs_new_members', JSON.stringify(localMembers));
        }
    } catch (e) {}

    try {
        let res = await fetch(`${window.API_BASE}/api/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memberObj)
        });
        
        let data = await res.json();
        
        if (res.ok && data.success) {
            console.log("✅ [DB] 신규 회원 저장 완료:", data);
            if (typeof window.fetchTreeData === 'function') {
                await window.fetchTreeData(false);
            }
        } else {
            console.error("❌ DB 저장 실패:", data.error);
            alert(`DB 저장 오류: ${data.error || '저장할 수 없습니다.'}`);
        }
    } catch (e) {
        console.error("신규 회원 DB 저장 통신 에러:", e);
    }
};

window.fetchSalesHistory = async function(startDate = '', endDate = '') {
    try {
        let url = `${window.API_BASE}/api/sales/history`;
        if (startDate || endDate) {
            url += `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            window.integrated_sales_history = Array.isArray(data) ? data : (data.data || []);
        }
    } catch (e) {
        console.warn("기간 매출 수신 실패 (로컬 상태 유지):", e);
    }
};

// 🌟 매출 행 저장 시 서버에서 수신한 DB PK ID(_dbId)를 객체에 즉시 할당 (중복 INSERT 차단)
window.saveSalesHistoryRow = async function(rowObj) {
    if (!rowObj || rowObj._isSaving) return null;
    try {
        rowObj._isSaving = true;
        let res = await fetch(`${window.API_BASE}/api/sales/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rowObj)
        });
        let data = await res.json();
        
        if (data && data.success && data.id) {
            rowObj._dbId = data.id;
            rowObj.id = `db_${data.id}`;
        }
        rowObj._isSaving = false;
        return data;
    } catch (e) {
        rowObj._isSaving = false;
        console.warn("매출 행 DB 동기화 실패:", e);
        return null;
    }
};

// 숫자 DB ID만 정제하여 안전 삭제
window.deleteSalesHistoryRow = async function(id) {
    if (!id) return;
    try {
        let cleanId = String(id).replace(/[^0-9]/g, '');
        if (!cleanId) return;
        await fetch(`${window.API_BASE}/api/sales/history/${cleanId}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.warn("매출 행 DB 삭제 실패:", e);
    }
};