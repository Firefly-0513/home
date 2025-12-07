import { sql } from "@vercel/postgres";
export default async function handler(req, res) {
  try {
    const { TID, classroom, date, stime, etime, reason, people, special } =
      req.body;
    const cid = parseInt(classroom);
    const bdate = date;
    if (
      !TID ||
      !classroom ||
      !date ||
      !stime ||
      !etime ||
      !reason ||
      !people ||
      !special
    ) {
      return res.status(400).json({ error: "Please fill all the fields" });
    }

    const result = await sql`
      INSERT INTO booking (tid, cid, bdate, stime, etime, reason)
      VALUES (${TID}, ${cid}, ${bdate}, ${stime}, ${etime}, ${reason})
      RETURNING bid
    `;

    return res.status(200).json({
      success: true,
      message: "Booking successful！",
      booking_bid: result.rows[0].bid,
    });
    
  } catch (error) {
    console.error("数据库插入失败:", error);

    // 关键：把真实错误返回给前端！！！
    return res.status(500).json({
      success: false,
      error: error.message, // 这一行让你马上看到到底哪里错
    });
  }
} 

export const config = {
  api: {
    bodyParser: true,
  },
};