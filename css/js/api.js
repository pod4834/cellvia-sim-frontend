// frontend/css/js/api.js
// 백엔드 API 비동기 통신 모듈 (안전한 예외 처리 및 프론트엔드 실시간 계산 연동)

window.API_BASE = window.API_BASE || 'http://127.0.0.1:3001';

window.loadTargetData = async function(id) {
    if (!id) return;

    let cleanId = String(id).trim().replace(/^VK-?/i, '');
    let targetId = cleanId ? cleanId : id;

    try {
        let salesRes = await fetch(`${window.API_BASE}/api/sales/${targetId}`);
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

window.fetchTreeData = async function(recenter = false) {
    try {
        if (typeof window.fetchSalesHistory === 'function') {
            try { await window.fetchSalesHistory(); } catch(e) {}
        }

        const res = await fetch(`${window.API_BASE}/api/tree`);
        if (res.ok) {
            const data = await res.json();
            window.treeData = data.tree || data;
            window.flatMembersData = data.flatMembers || {};
            
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
            } catch(e) {}
            
            if (typeof window.renderTree === 'function') {
                window.renderTree(recenter);
            }
        }
    } catch (e) {
        console.error("계보도 트리 데이터 수신 실패:", e);
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
    } catch(e) {}

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
            url += `?start=${startDate}&end=${endDate}`;
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

// 🌟 [핵심 수정] 매출 행 저장 시 서버에서 수신한 DB PK ID(_dbId)를 객체에 즉시 할당 (중복 INSERT 차단)
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