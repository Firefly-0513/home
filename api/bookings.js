import { neon } from "@neondatabase/serverless";

export default async function handler(request, response) {
  // 只允许 POST 请求
  if (request.method !== "POST") {
    return response.status(405).json({ error: "只允许 POST 请求" });
  }

  try {
    // 从环境变量获取数据库连接字符串
    const sql = neon(process.env.DATABASE_URL);

    // 获取请求体中的数据
    const {
      room_name,
      booker_name,
      booking_date,
      start_time,
      end_time,
      purpose,
    } = request.body;

    // 插入数据到数据库
    const result = await sql`
            INSERT INTO bookings (room_name, booker_name, booking_date, start_time, end_time, purpose)
            VALUES (${room_name}, ${booker_name}, ${booking_date}, ${start_time}, ${end_time}, ${purpose})
            RETURNING *
        `;

    // 返回成功结果
    return response.status(200).json({
      success: true,
      message: "预约成功",
      booking: result[0],
    });
  } catch (error) {
    console.error("Database error:", error);
    return response.status(500).json({
      error: "数据库错误",
      details: error.message,
    });
  }
}
