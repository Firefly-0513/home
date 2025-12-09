document.addEventListener("DOMContentLoaded", () => {
  const bookingForm = document.getElementById("bookingForm");
  const submitBtn = document.getElementById("submit");

  // 检查是否成功获取到了按钮，如果没有，说明HTML ID写错了
  if (!submitBtn) {
    console.error("Error: Cannot find button with id='submit'");
    return;
  }

  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault(); // 防止表单默认提交刷新页面

    // 1. 获取数据
    const TID = document.getElementById("TID")?.value;
    const CID = document.getElementById("classroom")?.value;
    const Bdate = document.getElementById("date")?.value;
    const stime = document.getElementById("stime")?.value;
    const etime = document.getElementById("etime")?.value;
    const reason = document.getElementById("reason")?.value;
    const special = document.getElementById("special")?.value;

    // 2. 前端校验
    if (!TID || !CID || !Bdate || !stime || !etime || !reason || !special) {
      alert("Please fill in all required fields.");
      return;
    }

    const formData = {
      TID,
      CID,
      Bdate,
      stime,
      etime,
      reason,
      people,
      special,
    };

    // 按钮变更为加载状态
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    try {
      // 3. 发送请求
      const response = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`Success! Booking ID: ${result.booking_bid}`);
        bookingForm.reset(); // 清空表单
      } else {
        alert("Failed: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Network Error:", error);
      alert("Network error. Please check console for details.");
    } finally {
      // 恢复按钮状态
      submitBtn.textContent = "Confirm Booking";
      submitBtn.disabled = false;
    }
  });
});
