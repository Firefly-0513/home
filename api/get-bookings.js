import { neon } from "@neondatabase/serverless";

export default async function handler(request, response) {
  // 只允许 GET 请求
  if (request.method !== "GET") {
    return response.status(405).json({ error: "只允许 GET 请求" });
  }

  try {
    // 从环境变量获取数据库连接字符串
    const sql = neon(process.env.DATABASE_URL);

    // 查询所有预约记录，按日期和时间排序
    const bookings = await sql`
            SELECT 
                id,
                room_name,
                booker_name,
                TO_CHAR(booking_date, 'YYYY-MM-DD') as booking_date,
                TO_CHAR(start_time, 'HH24:MI') as start_time,
                TO_CHAR(end_time, 'HH24:MI') as end_time,
                purpose,
                created_at
            FROM bookings 
            ORDER BY booking_date DESC, start_time ASC
        `;

    // 返回预约列表
    return response.status(200).json({
      success: true,
      bookings: bookings,
    });
  } catch (error) {
    console.error("Database error:", error);
    return response.status(500).json({
      error: "数据库错误",
      details: error.message,
    });
  }
}
