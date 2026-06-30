/* ===== 实名登记 ===== */

const regForm = document.getElementById('register-form');
const regSuccess = document.getElementById('reg-success');

regForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const idCard = document.getElementById('reg-idcard').value.trim();

  // 清除错误
  document.querySelectorAll('#section-register .form-group').forEach(g => g.classList.remove('error'));

  // 校验
  if (!name) {
    showError('reg-name', '请输入姓名');
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showError('reg-phone', '手机号格式不正确');
    return;
  }
  if (!/^\d{17}[\dXx]$/.test(idCard)) {
    showError('reg-idcard', '身份证号格式不正确');
    return;
  }

  const btn = document.getElementById('reg-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 提交中...';

  try {
    const resp = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, idNumber: idCard })
    });
    const json = await resp.json();
    if (json.code === 1) {
      regForm.style.display = 'none';
      regSuccess.style.display = 'block';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-check-circle"></i> 提交登记';
      alert(json.msg || '登记失败');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-check-circle"></i> 提交登记';
    alert('网络错误，请稍后重试');
  }
});

function showError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  const group = field.closest('.form-group');
  if (group) group.classList.add('error');
  field.focus();
  // 简单的 toast
  const existing = document.querySelector('.form-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'form-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:#ff4d4f;color:#fff;padding:10px 24px;border-radius:8px;
    font-size:14px;z-index:999;animation:fadeInOut 2s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// 页面切换时重置表单
document.addEventListener('navChanged', () => {
  const regSection = document.getElementById('section-register');
  if (regSection.classList.contains('active')) return;
  // 离开登记页3秒后重置
  setTimeout(() => {
    regForm.style.display = '';
    regSuccess.style.display = 'none';
    regForm.reset();
  }, 3000);
});
