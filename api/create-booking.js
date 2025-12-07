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
    console.error(error); 
    return res.status(500).json({
      success: false,
      error: error.message || "ERROR,Please try again later.",
    });
  }
} 

export const config = {
  api: {
    bodyParser: true,
  },
};