let currentTeacher = null;

// 老师登录
async function login() {
  const tid = document.getElementById('tid').value.trim();
  const res = await fetch(`/api/booking/teacher?tid=${tid}`);
  const teacher = await res.json();
  
  if (teacher.length === 0) {
    alert('查無此教師！');
    return;
  }
  
  currentTeacher = teacher[0];
  document.getElementById('login').style.display = 'none';
  document.getElementById('form').style.display = 'block';
  document.getElementById('teacherName').textContent = `歡迎 ${teacher[0].tname}`;
  
  loadClassrooms();
  loadTodayBookings();
}

// 加载所有教室到下拉框
async function loadClassrooms() {
  const res = await fetch('/api/booking/classrooms');
  const rooms = await res.json();
  const select = document.getElementById('cid');
  select.innerHTML = '<option value="">請選擇教室</option>';
  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.cid;
    opt.textContent = `${r.cname} (容量 ${r.capacity})`;
    select.appendChild(opt);
  });
}

// 提交预约
async function submitBooking() {
  const data = {
    tid: currentTeacher.tid,
    cid: document.getElementById('cid').value,
    bdate: document.getElementById('bdate').value,
    stime: document.getElementById('stime').value,
    etime: document.getElementById('etime').value,
    reason: document.getElementById('reason').value,
    special: document.getElementById('special').value || null
  };

  const res = await fetch('/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    alert('預約成功！');
    loadTodayBookings();
  } else {
    alert('預約失敗，可能時間衝突');
  }
}

function logout() {
  currentTeacher = null;
  document.getElementById('login').style.display = 'block';
  document.getElementById('form').style.display = 'none';
  document.getElementById('tid').value = '';
}

// 加载今日所有预约
async function loadTodayBookings() {
  const today = new Date().toISOString().slice(0,10);
  const res = await fetch(`/api/booking?date=${today}`);
  const bookings = await res.json();
  
  const list = document.getElementById('list');
  list.innerHTML = '';
  bookings.forEach(b => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${b.cname}</strong> ${b.stime}-${b.etime} 
                     ${b.tname} - ${b.reason} ${b.special?'<small style="color:red">('+b.special+')</small>':''}`;
    list.appendChild(div);
  });
}
