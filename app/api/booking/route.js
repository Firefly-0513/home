import { sql } from "@vercel/postgres";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // 加载所有教室给下拉框用
  if (searchParams.get("classrooms") === "true") {
    const { rows } =
      await sql`SELECT cid, cname, capacity FROM classroom ORDER BY cid`;
    return Response.json(rows);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const result = await sql`
      INSERT INTO booking (tid, cid, bdate, stime, etime, reason, special)
      VALUES (
        ${body.tid},
        ${body.cid},
        ${body.bdate},
        ${body.stime},
        ${body.etime},
        ${body.reason},
        ${body.special}
      )
      RETURNING bid
    `;

    return Response.json({ bid: result.rows[0].bid });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
