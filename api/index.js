require("dotenv").config();
const express = require("express");
const { Pool } = require("@neondatabase/serverless"); // 改用 Neon serverless driver
const ws = require("ws");
const path = require("path");

const app = express();
app.use(express.json()); // 解析 JSON 请求
app.use(express.static(path.join(__dirname, "public"))); // 提供静态文件（HTML）

// 数据库连接，使用环境变量（本地从 .env 读，Vercel 从面板读）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.options.webSocketConstructor = ws;

// 欢迎页面路由
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 预约页面路由
app.get("/reserve", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "booking.html"));
});

// 输入数据到数据库（POST 请求）
app.post("/book", async (req, res) => {
  // 假設前端傳來的資料還是只有教室和時間，先擴充其他欄位
  const { tid, cid, bdate, stime, etime, reason, people, special } = req.body;

  // 后端必填检查
  if (
    !tid ||
    !cid ||
    !bdate ||
    !stime ||
    !etime ||
    !reason ||
    !people ||
    !special
  ) {
    return res.status(400).json({ error: "缺少必要字段" });
  }

  const cidNum = parseInt(cid, 10);
  const peopleNum = parseInt(people, 10);
  if (isNaN(cidNum) || isNaN(peopleNum)) {
    return res.status(400).json({ error: "教室 ID 或人數必須是數字" });
  }

  // 时间逻辑验证
  if (stime >= etime) {
    return res.status(400).json({ error: "结束时间必须晚于开始时间" });
  }
  // 日期不能是过去
  const today = new Date().toISOString().split("T")[0];
  if (bdate < today) {
    return res.status(400).json({ error: "不能预约过去的日期" });
  }
  // time驗證（不能是今天之前的時間）
  const now = new Date().toISOString().split("T")[1].split(".")[0];
  if (bdate === today && stime < now) {
    alert("Error: Booking time cannot be in the past.");
    return;
  }

  try {
    // Step 1: 查詢該教室的容量
    const capacityResult = await pool.query(
      `SELECT capacity FROM classroom WHERE cid = $1`,
      [cidNum]
    );

    if (capacityResult.rows.length === 0) {
      return res.status(400).json({ error: "找不到該教室（CID 不存在）" });
    }

    const capacity = capacityResult.rows[0].capacity;

    // Step 2: 檢查人數是否超過容量
    if (peopleNum > capacity) {
      return res.status(400).json({ 
        error: `預約失敗：該教室最多容納 ${capacity} 人，您輸入 ${peopleNum} 人，已超額` 
      });
    }
    

  try {
    const result = await pool.query(
      `INSERT INTO booking (tid, cid, bdate, stime, etime, reason, people, special) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING bid`,
      [tid, cid, bdate, stime, etime, reason, people, special]
    );

    const newBookingId = result.rows[0].bid;

    res.json({
      success: true,
      bookingId: newBookingId,
      message: "Booking successful!",
    }); // 确保是 JSON
  } catch (err) {
    console.error(err);
    console.error("Database insert error:", err);
    res
      .status(500)
      .json({ error: "Some Data is wrong,Try it again", details: err.message }); // 总是 JSON
  }
});

// 从数据库读取数据（GET 请求）
app.get("/get-booking", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM booking");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("read error");
  }
});

// 监听端口（Vercel 会自动处理端口）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
