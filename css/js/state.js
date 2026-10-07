// frontend/js/state.js
// 전역 상태 변수 및 공통 유틸리티 관리

window.API_BASE = 'http://127.0.0.1:3001';

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
window.useCompression = true; 
window.dynamicCodes = {}; 
window.rankRules = [];
window.treeDisplaySettings = { 
    id: true, name: true, rank: true, type: true, isClone: true, 
    joinDate: true, recName: true, recId: true, code: true, 
    firstSales: false, lastSales: false 
};

window.isRecommendTreeMode = false;

window.currentWidgetZ = 100;
window.minimizedWidgets = new Set();
window.openAccordionKey = null;
window.clickTimer = null; 

// 전역 유틸리티: 날짜 파싱
window.parseDateToYMD = function(d) {
    if(!d) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    let val = d.replace(/[^0-9]/g, '');
    if(val.length === 4) return `${new Date().getFullYear()}-${val.substring(0,2)}-${val.substring(2,4)}`;
    if(val.length === 6) return `20${val.substring(0,2)}-${val.substring(2,4)}-${val.substring(4,6)}`;
    if(val.length === 8) return `${val.substring(0,4)}-${val.substring(4,6)}-${val.substring(6,8)}`;
    return d;
};