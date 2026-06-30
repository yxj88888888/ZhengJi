/* ===== 管理页面 ===== */

let adminCurrent = 'registrations';

document.getElementById('section-admin').addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-tab')) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    adminCurrent = e.target.dataset.list;
    loadAdminData();
  }
  if (e.target.id === 'admin-refresh' || e.target.closest('#admin-refresh')) {
    loadAdminData();
  }
});

function loadAdminData() {
  const endpoint = adminCurrent === 'registrations' ? '/api/registrations' : '/api/orders';
  const wrap = document.getElementById('admin-table-wrap');
  wrap.innerHTML = '<div class="admin-loading"><i class="fa fa-spinner fa-spin"></i> 加载中...</div>';

  fetch(endpoint)
    .then(r => r.json())
    .then(json => {
      if (json.code !== 1 || !json.data.length) {
        wrap.innerHTML = '<div class="admin-empty"><i class="fa fa-inbox"></i><p>暂无数据</p></div>';
        return;
      }

      if (adminCurrent === 'registrations') {
        renderRegistrations(json.data);
      } else {
        renderOrders(json.data);
      }
    })
    .catch(() => {
      wrap.innerHTML = '<div class="admin-empty"><i class="fa fa-exclamation-triangle"></i><p>加载失败</p></div>';
    });
}

function renderRegistrations(data) {
  const wrap = document.getElementById('admin-table-wrap');
  const rows = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.phone)}</td>
      <td>${esc(r.idNumber)}</td>
      <td>${formatAdminTime(r.createdAt)}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>姓名</th><th>手机号</th><th>身份证号</th><th>登记时间</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderOrders(data) {
  const wrap = document.getElementById('admin-table-wrap');
  const names = { gold_bar: '金条', gold_bean: '金豆', silver_bar: '银条', recycle: '黄金回收' };
  const statusNames = { pending: '待处理', confirmed: '已确认', done: '已完成' };
  const rows = data.map((o, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(o.id)}</td>
      <td>${names[o.productType] || o.productType}</td>
      <td>${o.weight} 克</td>
      <td>${esc(o.contactName)}</td>
      <td>${esc(o.contactPhone)}</td>
      <td class="admin-amount">${o.estimatedAmount ? '¥' + o.estimatedAmount : '--'}</td>
      <td><span class="admin-status status-${o.status}">${statusNames[o.status] || o.status}</span></td>
      <td>${formatAdminTime(o.createdAt)}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>订单号</th><th>产品</th><th>克重</th><th>联系人</th><th>电话</th><th>预估金额</th><th>状态</th><th>下单时间</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function esc(s) { return (s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function formatAdminTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' +
    d.getHours().toString().padStart(2,'0') + ':' +
    d.getMinutes().toString().padStart(2,'0') + ':' +
    d.getSeconds().toString().padStart(2,'0');
}

// 初始化：进入管理页时加载
document.addEventListener('navChanged', (e) => {
  if (e.detail === 'admin') loadAdminData();
});

loadAdminData();
