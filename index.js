document.addEventListener("DOMContentLoaded", () => {
  const bookingForm = document.getElementById("bookingForm");
  const submit = document.getElementById("submit");



  submit.addEventListener("click", async () => {
    try {
    const formData = {
      userName: document.getElementById("TID").value, // 对应HTML中id="userName"的输入框
      userPhone: document.getElementById("classroom").value,
      classroomId: document.getElementById("date").value,
      bookingDate: document.getElementById("stime").value,
      startTime: document.getElementById("etime").value,
      endTime: document.getElementById("reason").value,
      endTime: document.getElementById("people").value,
      reason: document.getElementById("special").value,
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
