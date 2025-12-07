import { sql } from "@vercel/postgres";
import { NextApiRequest, NextApiResponse } from 'next';

try {
    const { TID, classroom,date, stime, etime, reason, people, special } = req.body;

    if (!TID || !classroom || !date || !stime || !etime || !reason || !people || !special) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }

    const result = await sql`
      INSERT INTO booking (tid, cid, bdate, stime, etime, reason, special)
      VALUES (${TID}, ${classroom}, ${date}, ${stime}, ${etime}, ${reason},  ${special})
      RETURNING bid; 
    `;

res.status(200).json({ 
    success: true, 
    message: 'Booking successful！', 
    booking_bid: result.rows[0].bid 
    });

  } catch (error) {
    res.status(500).json({ 
     error: error.message,
     message: 'Error,Try it later！',
    });
  }
} 