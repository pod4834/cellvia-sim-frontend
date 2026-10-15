// frontend/css/js/api.js
// 백엔드 API 비동기 통신 및 보안 인증 모듈 (로컬 개발 & 클라우드 웹 배포 자동 감지 지원)

(function initApiBaseAndSecurityGate() {
    const host = window.location.hostname;
    const isLocal = (
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '' ||
        window.location.protocol === 'file:'
    );
    window.IS_LOCAL_DEV = isLocal;

    // 💡 프론트엔드와 백엔드를 별도 도메인으로 분리 배포할 경우에만 아래 문자열에 백엔드 주소를 입력하세요.
    // (예: 'https://cellvia-sim-backend.onrender.com')
    // server.js가 프론트엔드 정적 파일까지 통합 서빙할 때는 비워두면 현재 도메인(window.location.origin)을 자동 사용합니다.
    const SEPARATE_PROD_BACKEND_URL = '';

    const resolvedBase = isLocal
        ? 'http://127.0.0.1:3001'
        : (SEPARATE_PROD_BACKEND_URL || window.location.origin);

    window.API_BASE = (window.API_BASE || resolvedBase).replace(/\/+$/, '');
    window.API_BASE_URL = window.API_BASE; // main.js 등 타 스크립트 호환용 별칭

    // ========================================================================
    // 🔒 [통합 보안 로그인 게이트 & 전역 Fetch 인증 토큰 자동 주입]
    // ========================================================================
    if (window._bsLoginGateMounted) return;
    window._bsLoginGateMounted = true;

    const TOKEN_KEY = 'BS_AUTH_TOKEN_V3';
    const EXPECTED_ID = 'admin';
    const EXPECTED_PW = 'tourism9**';
    const LOCAL_VALID_TOKEN = 'verified_admin_tourism9_token';

    // 1) 모든 백엔드 API(/api/...) 요청 시 헤더에 인증 토큰 자동 첨부
    const origFetch = window.fetch;
    window.fetch = async function(input, init = {}) {
        const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
        const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        if (urlStr.includes('/api/') || (window.API_BASE && urlStr.startsWith(window.API_BASE))) {
            init.headers = Object.assign({}, init.headers || {}, {
                'x-auth-token': token
            });
        }

        const response = await origFetch.call(this, input, init);

        // 미인증(401) 응답 수신 시 즉시 로그인 화면 표시
        if (response.status === 401 && !urlStr.includes('/api/login')) {
            sessionStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(TOKEN_KEY);
            window.showSimulatorLoginModal();
        }
        return response;
    };

    // 2) 로그아웃 전역 함수
    window.logoutSimulator = function() {
        if (!confirm('시뮬레이터에서 로그아웃하시겠습니까?')) return;
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
        window.location.reload();
    };

    // 3) 상단 헤더에 [🔒 로그아웃] 버튼 자동 장착
    function mountLogoutBtn() {
        if (document.getElementById('bsLogoutBtn')) return;
        const aiBtn = document.getElementById('customAiAdvisorBtn');
        const headerContainer = (aiBtn && aiBtn.parentNode) || document.querySelector('header, .header, .top-bar');
        if (!headerContainer) return;

        const btn = document.createElement('button');
        btn.id = 'bsLogoutBtn';
        btn.type = 'button';
        btn.title = '잠금 / 로그아웃';
        btn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-left:4px; background:transparent; color:#f87171; border:1px solid transparent; border-radius:6px; cursor:pointer; transition:all 0.15s ease;';
        btn.innerHTML = '🔒';
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#1f2937';
            btn.style.borderColor = '#374151';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            btn.style.borderColor = 'transparent';
        });
        btn.onclick = window.logoutSimulator;
        headerContainer.appendChild(btn);
    }

    // 4) 전체화면 로그인 오버레이 모달 생성 및 검증
    window.showSimulatorLoginModal = function() {
        setTimeout(mountLogoutBtn, 600);
        if (sessionStorage.getItem(TOKEN_KEY)) return;

        let overlay = document.getElementById('bs-auth-login-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'bs-auth-login-overlay';
            overlay.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100vh !important; background:#0b0f19 !important; z-index:2147483647 !important; display:flex !important; align-items:center !important; justify-content:center !important; font-family:Pretendard,-apple-system,sans-serif !important;';
            overlay.innerHTML = `
                <div style="background:#1f2937; border:1px solid #374151; border-radius:12px; width:360px; padding:30px 24px; box-shadow:0 25px 50px rgba(0,0,0,0.85); color:#fff; text-align:center;">
                    <div style="width:52px; height:52px; margin:0 auto 14px; border-radius:12px; background:rgba(59,130,246,0.15); border:1px solid #3b82f6; display:flex; align-items:center; justify-content:center; font-size:24px;">🔒</div>
                    <h2 style="margin:0 0 6px; font-size:18px; font-weight:800; color:#fff;">비지네스 시뮬레이터 V3.0</h2>
                    <p style="margin:0 0 22px; font-size:12px; color:#9ca3af;">승인된 관리자 계정으로 로그인해 주세요.</p>
                    <form id="bs-login-form" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                        <div>
                            <label style="display:block; font-size:11.5px; color:#d1d5db; margin-bottom:4px; font-weight:bold;">관리자 아이디 (ID)</label>
                            <input type="text" id="bs-login-id" placeholder="admin" autocomplete="username" required style="width:100%; box-sizing:border-box; padding:10px 12px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; font-size:13px; outline:none;">
                        </div>
                        <div>
                            <label style="display:block; font-size:11.5px; color:#d1d5db; margin-bottom:4px; font-weight:bold;">비밀번호 (Password)</label>
                            <input type="password" id="bs-login-pw" placeholder="비밀번호 입력" autocomplete="current-password" required style="width:100%; box-sizing:border-box; padding:10px 12px; background:#111827; border:1px solid #4b5563; border-radius:6px; color:#fff; font-size:13px; outline:none;">
                        </div>
                        <div id="bs-login-error" style="display:none; color:#ef4444; font-size:12px; font-weight:bold; text-align:center; padding:4px 0;"></div>
                        <button type="submit" id="bs-login-submit" style="margin-top:6px; width:100%; padding:11px; background:#2563eb; border:1px solid #3b82f6; border-radius:6px; color:#fff; font-size:13.5px; font-weight:bold; cursor:pointer;">로그인</button>
                    </form>
                </div>
            `;
            document.documentElement.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
        }

        const form = document.getElementById('bs-login-form');
        const idInp = document.getElementById('bs-login-id');
        const pwInp = document.getElementById('bs-login-pw');
        const errEl = document.getElementById('bs-login-error');
        const submitBtn = document.getElementById('bs-login-submit');

        setTimeout(() => { if (idInp) idInp.focus(); }, 100);

        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errEl.style.display = 'none';
                const uid = idInp.value.trim();
                const upw = pwInp.value;

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = '인증 확인 중...';
                }

                let tokenToSave = null;
                try {
                    const res = await fetch(`${window.API_BASE}/api/login`, {
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

                // 백엔드 미배포 상태에서도 프론트엔드 자체 검증(admin / tourism9**) 지원
                if (!tokenToSave && uid === EXPECTED_ID && upw === EXPECTED_PW) {
                    tokenToSave = LOCAL_VALID_TOKEN;
                }

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = '로그인';
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
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.showSimulatorLoginModal);
    } else {
        window.showSimulatorLoginModal();
    }
})();

// ============================================================================
// 📡 [백엔드 데이터 연동 API 함수군]
// ============================================================================

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

// 덮어쓰기 전에 main.js에서 먼저 선언된 fetchTreeData가 있다면 안전하게 보존
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

// 매출 행 저장 시 서버에서 수신한 DB PK ID(_dbId)를 객체에 즉시 할당 (중복 INSERT 차단)
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