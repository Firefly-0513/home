require("dotenv").config();
const express = require("express");
const { Pool } = require("@neondatabase/serverless");
const path = require("path");

const app = express();
app.use(express.json()); // 解析 JSON 请求
app.use(express.static(path.join(__dirname, "public"))); // 提供静态文件（HTML）

// 数据库连接，使用环境变量（本地从 .env 读，Vercel 从面板读）
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 欢迎页面路由
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 预约页面路由
app.get("/reserve", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reserve.html"));
});

// 输入数据到数据库（POST 请求）
app.post("/book", async (req, res) => {
  const { room, time } = req.body;
  try {
    await pool.query("INSERT INTO bookings (room, time) VALUES ($1, $2)", [
      room,
      time,
    ]);
    res.send("预约成功！");
  } catch (err) {
    console.error(err);
    console.error("Database insert error:", err);
    res.status(500).send("预约失败");
  }
});

// 从数据库读取数据（GET 请求）
app.get("/bookings", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bookings");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("读取失败");
  }
});

// 监听端口（Vercel 会自动处理端口）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
