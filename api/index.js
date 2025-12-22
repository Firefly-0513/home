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

// 用户登录 API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Please enter username and password" });
  }

  try {
    const result = await pool.query(
      "SELECT tid, username, role FROM teacher WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];

    // 這裡簡單用 res.json 回傳角色，前端會根據角色跳轉
    // （注意：真實項目建議用 session 或 JWT，這裡為了簡單先這樣）
    res.json({
      success: true,
      role: user.role,        // 'A' 或 'T'
      tid: user.tid,
      username: user.username
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
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
    return res.status(400).json({ error: "Your must fill all fields" });
  }

  const cidNum = parseInt(cid, 10);
  const peopleNum = parseInt(people, 10);
  if (isNaN(cidNum) || isNaN(peopleNum)) {
    return res.status(400).json({ error: "It must be a number" });
  }

  // time驗證（結束時間必須大於開始）
  if (stime >= etime) {
    return res
      .status(400)
      .json({ error: "Starting time must be before ending time." });
  }
  // time驗證（不能超過18:00）
  if (etime > "18:00") {
    return res
      .status(400)
      .json({
        error:
          "Booking cannot end after 18:00 because the school closes at 6 PM.",
      });
  }
  // date驗證
  const today = new Date().toISOString().split("T")[0];
  if (bdate < today) {
    return res
      .status(400)
      .json({ error: "Booking date cannot be in the past." });
  }
  // time驗證（不能是今天之前的時間）
  const now = new Date().toISOString().split("T")[1].split(".")[0];
  if (bdate === today && stime < now) {
    return res
      .status(400)
      .json({ error: "Booking time cannot be in the past." });
  }

  // 課室容量驗證
  try {
    const capacityResult = await pool.query(
      `SELECT capacity FROM classroom WHERE cid = $1`,
      [cidNum]
    );

    const capacity = capacityResult.rows[0].capacity;

    if (peopleNum > capacity) {
      return res.status(400).json({
        error: `The venue only can contain ${capacity} peoples, you need to change another venue.`,
      });
    }

    // 2. 是否被book？
    const conflict = await pool.query(
      `
      SELECT 1 FROM booking 
      WHERE cid = $1 
      AND bdate = $2 
      AND (
        (stime < $3 AND etime > $3) OR  
        (stime < $4 AND etime > $4) OR  
        (stime >= $3 AND etime <= $4)   
      )
    `,
      [cidNum, bdate, etime, stime]
    );

    if (conflict.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "This venue is already booked for this time slot." });
    }

    // 輸入資料
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
// 獲取指定老師的未來預約（用於 T_edit）
app.get("/my-bookings", async (req, res) => {
  const tid = req.query.tid;
  if (!tid) {
    return res.status(400).json({ error: "Missing tid" });
  }

  try {
    const result = await pool.query(
      `SELECT bid, cid, bdate, stime, etime, reason, people, special 
       FROM booking 
       WHERE tid = $1 AND bdate >= CURRENT_DATE 
       ORDER BY bdate ASC, stime ASC`,
      [tid]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// 刪除預約（老師只能刪自己的）
app.delete("/booking/:bid", async (req, res) => {
  const bid = req.params.bid;
  const tid = req.query.tid;

  try {
    const result = await pool.query(
      "DELETE FROM booking WHERE bid = $1 AND tid = $2 RETURNING bid",
      [bid, tid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found or not yours" });
    }

    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// 更新預約（老師只能改自己的），加入完整驗證
app.put("/booking/:bid", async (req, res) => {
  const bid = req.params.bid;
  const tid = req.query.tid;
  const { cid, bdate, stime, etime, reason, people, special } = req.body;

  // 1. 必填檢查
  if (
    !cid ||
    !bdate ||
    !stime ||
    !etime ||
    !reason ||
    !people ||
    !special
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const cidNum = parseInt(cid, 10);
  const peopleNum = parseInt(people, 10);
  if (isNaN(cidNum) || isNaN(peopleNum)) {
    return res.status(400).json({ error: "Classroom ID and number of people must be numbers" });
  }

  // 2. 時間驗證：結束時間必須大於開始時間
  if (stime >= etime) {
    return res
      .status(400)
      .json({ error: "Starting time must be before ending time." });
  }

  // 3. 時間驗證：不能超過 18:00
  if (etime > "18:00") {
    return res.status(400).json({
      error: "Booking cannot end after 18:00 because the school closes at 6 PM.",
    });
  }

  // 4. 日期驗證：不能是過去的日期
  const today = new Date().toISOString().split("T")[0];
  if (bdate < today) {
    return res
      .status(400)
      .json({ error: "Booking date cannot be in the past." });
  }

  // 5. 當天時間驗證：如果是今天，不能選已經過去的開始時間
  const now = new Date().toISOString().split("T")[1].split(".")[0]; // HH:MM:SS
  if (bdate === today && stime < now.substring(0, 5)) { // 只比對 HH:MM
    return res
      .status(400)
      .json({ error: "Booking time cannot be in the past." });
  }

  try {
    // 6. 課室容量驗證
    const capacityResult = await pool.query(
      "SELECT capacity FROM classroom WHERE cid = $1",
      [cidNum]
    );

    if (capacityResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid classroom ID" });
    }

    const capacity = capacityResult.rows[0].capacity;

    if (peopleNum > capacity) {
      return res.status(400).json({
        error: `This venue can only accommodate ${capacity} people. Please choose another venue or reduce the number.`,
      });
    }

    // 7. 時間衝突檢查（排除自己這筆記錄）
    const conflict = await pool.query(
      `
      SELECT 1 FROM booking 
      WHERE cid = $1 
        AND bdate = $2 
        AND bid != $3  -- 排除正在編輯的這筆
        AND (
          (stime < $4 AND etime > $4) OR  -- 新結束時間落在別人時段內
          (stime < $5 AND etime > $5) OR  -- 新開始時間落在別人時段內
          (stime >= $4 AND etime <= $5)   -- 新時段完全包含在別人時段內
        )
      `,
      [cidNum, bdate, bid, etime, stime]
    );

    if (conflict.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "This time slot is already booked by someone else." });
    }

    // 8. 執行更新
    const result = await pool.query(
      `UPDATE booking 
       SET cid = $1, bdate = $2, stime = $3, etime = $4, 
           reason = $5, people = $6, special = $7
       WHERE bid = $8 AND tid = $9
       RETURNING bid`,
      [cidNum, bdate, stime, etime, reason, peopleNum, special, bid, tid]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found or not yours" });
    }

    res.json({ success: true, message: "Booking updated successfully" });
  } catch (err) {
    console.error("Update booking error:", err);
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});


// 监听端口（Vercel 会自动处理端口）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
