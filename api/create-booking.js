import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  // 1. 允许跨域请求 (可选，但在调试时很有用)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { TID, classroom, date, stime, etime, reason, people, special } = req.body;

    // 2. 简单的后端校验
    if (!TID || !classroom || !date || !stime || !etime || !reason || !people || !special) {
      return res.status(400).json({ error: "Please fill all the required fields" });
    }

    // 3. 执行插入操作
    // 注意：这里去掉了 parseInt，直接存字符串
    // 注意：在 INSERT 中补充了 people 和 special
    const result = await sql`
      INSERT INTO booking (tid, classroom, bdate, stime, etime, reason, special)
      VALUES (${TID}, ${classroom}, ${date}, ${stime}, ${etime}, ${reason}, ${special})
      RETURNING bid;
    `;

    return res.status(200).json({
      success: true,
      message: "Booking successful！",
      booking_bid: result.rows[0].bid,
    });

  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Database connection failed",
    });
  }
}