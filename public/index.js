document.addEventListener("DOMContentLoaded", () => {
  const bookingForm = document.getElementById("bookingForm");
  const submit = document.getElementById("submit");



  submit.addEventListener("click", async (e) => {
    e.preventDefault();

    // 简单前端校验（可选，但强烈建议加）
    if (!bookingForm.checkValidity()) {
      alert("请填写所有必填项");
      return;
    }
    
    const formData = {
      TID: document.getElementById("TID").value, 
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

      if (response.ok && result.success) {
        alert(`预约成功！您的预约ID是：${result.booking_bid}`);
        bookingForm.reset();
      } else {
        alert("预约失败：" + (result.error || "未知错误"));
      }
    } catch (error) {
      alert("网络错误，请检查控制台：" + error.message);
      console.error(error);
    }
  });
}); 

