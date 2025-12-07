
submit.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TID: formData.TID,
          classroom: formData.classroom,
          date: formData.date,
          stime: formData.stime,
          etime: formData.etime,
          reason: formData.reason,
          people: formData.people,
          special: formData.special
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`预约成功！您的预约ID是：${result.booking_bid}`);
        bookingForm.reset();
      } else {
        alert('预约失败：' + result.error);
      }
    } catch (error) {
      alert('网络错误：' + error.message);
    }
  });

  // 3. 点击“返回修改”：隐藏确认区域，允许重新编辑
  cancelBtn.addEventListener('click', () => {
    confirmArea.style.display = 'none';
    nextBtn.style.display = 'block'; // 显示“下一步”按钮
  });
});