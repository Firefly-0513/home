document.addEventListener("DOMContentLoaded", () => {
  const bookingForm = document.getElementById("bookingForm");
  const submit = document.getElementById("submit");



  submit.addEventListener("click", async (e) => {
    e.preventDefault();
    
    try {
    const formData = {
      TID: document.getElementById("TID").value, // 对应HTML中id="userName"的输入框
      classroom: document.getElementById("classroom").value,
      date: document.getElementById("date").value,
      stime: document.getElementById("stime").value,
      etime: document.getElementById("etime").value,
      reason: document.getElementById("reason").value,
      people: document.getElementById("people").value,
      special: document.getElementById("special").value,
    };


    try {
      const response = await fetch('/api/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });

      const result = await response.json();

      if (result.success) {
        alert(`预约成功！您的预约ID是：${result.booking_bid}`);
        bookingForm.reset();
      } else {
        alert("预约失败：" + result.error);
      }
    } catch (error) {
      alert("网络错误：" + error.message);
    }
  });

  // 3. 点击“返回修改”：隐藏确认区域，允许重新编
  cancelBtn.addEventListener("click", () => {
    confirmArea.style.display = "none";
    nextBtn.style.display = "block"; // 显示“下一步”按钮
  });
});
