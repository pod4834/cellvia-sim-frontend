// frontend/js/state.js
// 전역 상태 변수 및 공통 유틸리티 관리 (로컬 개발 & 클라우드 웹 배포 자동 호환)

(function initGlobalApiEnvironment() {
    const host = window.location.hostname;
    const isLocal = (
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '' ||
        window.location.protocol === 'file:'
    );

    // 프론트엔드와 백엔드를 별도 도메인으로 분리 배포할 경우에만 아래에 백엔드 주소를 입력
    const SEPARATE_PROD_BACKEND_URL = '';

    const resolvedBase = isLocal
        ? 'http://127.0.0.1:3001'
        : (SEPARATE_PROD_BACKEND_URL || window.location.origin);

    window.API_BASE = resolvedBase.replace(/\/+$/, '');
    window.API_BASE_URL = window.API_BASE;

    // 🌟 [웹 배포 안전망] main.js 등 다른 파일에 'http://127.0.0.1:3001' 또는 'localhost:3001'이
    // 하드코딩되어 있더라도, 웹 배포 환경에서는 자동으로 배포 서버 주소로 변환하여 호출
    if (!isLocal && !window._fetchRedirectInstalled) {
        window._fetchRedirectInstalled = true;
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            if (typeof input === 'string') {
                input = input.replace(/^https?:\/\/(127\.0\.0\.1|localhost):300[01]/i, window.API_BASE);
            }
            return originalFetch.call(this, input, init);
        };
    }
})();

window.treeData = null;
window.flatMembersData = {};
window.currentPerfData = []; 
window.currentSalesData = []; 
window.downlineSalesData = []; 

// 🌟 DB 통합 매출 내역 전역 상태 추가
window.integrated_sales_history = [];

window.simMode = false; 
window.simMembers = []; 
window.simSales = [];

window.salesSortOrder = 'asc'; 
window.useCompression = true; // 2차 압축롤업 (3만원 미만 패스) 토글
window.dynamicCodes = {}; 
window.rankRules = [];
window.treeDisplaySettings = { 
    id: true, name: true, rank: true, type: true, isClone: true, 
    joinDate: true, recName: true, recId: true, code: true, 
    firstSales: false, lastSales: false 
};

// 🌟 [수정] main.js와 완벽한 호환을 위해 계보도 모드 변수명 통합
window.treeMode = 'sponsor'; // 기본값: 후원계보도 ('sponsor' 또는 'recommender')

window.currentWidgetZ = 100;
window.minimizedWidgets = new Set();
window.openAccordionKey = null;
window.clickTimer = null; 

// 전역 유틸리티: 날짜 파싱
window.parseDateToYMD = function(d) {
    if (!d) return null;
    const str = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    let val = str.replace(/[^0-9]/g, '');
    if (val.length === 4) return `${new Date().getFullYear()}-${val.substring(0,2)}-${val.substring(2,4)}`;
    if (val.length === 6) return `20${val.substring(0,2)}-${val.substring(2,4)}-${val.substring(4,6)}`;
    if (val.length === 8) return `${val.substring(0,4)}-${val.substring(4,6)}-${val.substring(6,8)}`;
    return str;
};