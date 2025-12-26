require("dotenv").config();
const express = require("express");
const { Pool } = require("@neondatabase/serverless");
const ws = require("ws");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.options.webSocketConstructor = ws;
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'Asia/Hong_Kong';");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/reserve", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "booking.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Please enter username and password" });
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

    res.json({
      success: true,
      role: user.role,
      tid: user.tid,
      username: user.username,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/book", async (req, res) => {
  try {
    const { tid, cid, bdate, stime, etime, reason, people, special } = req.body;

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

    if (stime >= etime) {
      return res
        .status(400)
        .json({ error: "Starting time must be before ending time." });
    }
    if (stime < "06:30") {
      return res.status(400).json({
        error: "Booking cannot before 06:30 because the school close.",
      });
    }
    if (etime > "18:00") {
      return res.status(400).json({
        error:
          "Booking cannot end after 18:00 because the school closes at 6 PM.",
      });
    }

    const timeResult = await pool.query(`
      SELECT 
        CURRENT_DATE AS today,
        TO_CHAR(CURRENT_TIMESTAMP, 'HH24:MI:SS') AS now
    `);
    const today = timeResult.rows[0].today.toISOString().split("T")[0];
    const now = timeResult.rows[0].now;

    if (bdate < today) {
      return res
        .status(400)
        .json({ error: "Booking date cannot be in the past." });
    }

    const currentTimeStr = now.substring(0, 5);
    if (bdate === today && stime <= currentTimeStr) {
      return res
        .status(400)
        .json({ error: "Booking time cannot be in the past." });
    }

    const capacityResult = await pool.query(
      `SELECT capacity FROM classroom WHERE cid = $1`,
      [cidNum]
    );

    if (capacityResult.rows.length === 0) {
      return res.status(404).json({ error: "Venue not found" });
    }

    const capacity = capacityResult.rows[0].capacity;

    if (peopleNum > capacity) {
      return res.status(400).json({
        error: `The venue only can contain ${capacity} peoples, you need to change another venue.`,
      });
    }

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

    const result = await pool.query(
      `INSERT INTO booking (tid, cid, bdate, stime, etime, reason, people, special) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING bid`,
      [tid, cidNum, bdate, stime, etime, reason, peopleNum, special]
    );

    const newBookingId = result.rows[0].bid;

    res.json({
      success: true,
      bookingId: newBookingId,
      message: "Booking successful!",
    });
  } catch (err) {
    console.error("Booking error:", err);
    res
      .status(500)
      .json({ error: "Some Data is wrong,Try it again", details: err.message });
  }
});

app.get("/my-bookings", async (req, res) => {
  const tid = req.query.tid;
  const bid = req.query.bid;
  const cid = req.query.cid;
  const bdate = req.query.bdate;

  if (!tid) {
    return res.status(400).json({ error: "Teacher ID (tid) is required" });
  }

  try {
    let query = `
      SELECT bid, cid, bdate, stime, etime, reason, people, special, create_at 
      FROM booking 
      WHERE tid = $1 AND bdate >= CURRENT_DATE
    `;
    const params = [tid];

    if (bid) {
      const bidNum = parseInt(bid, 10);
      if (isNaN(bidNum)) {
        return res.status(400).json({ error: "Invalid Booking ID" });
      }
      params.push(bidNum);
      query += ` AND bid = $${params.length}`;
    }
    if (cid) {
      params.push(cid);
      query += ` AND cid = $${params.length}`;
    }
    if (bdate) {
      params.push(bdate);
      query += ` AND bdate = $${params.length}`;
    }

    query += ` ORDER BY bdate ASC, stime ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("My bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.delete("/booking/:bid", async (req, res) => {
  const bid = parseInt(req.params.bid, 10);
  const tid = req.query.tid;

  if (isNaN(bid) || !tid) {
    return res.status(400).json({ error: "Invalid Booking ID or Teacher ID" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM booking WHERE bid = $1 AND tid = $2 RETURNING bid",
      [bid, tid]
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Booking not found or unauthorized" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete booking error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.put("/booking/:bid", async (req, res) => {
  const bid = parseInt(req.params.bid, 10);
  const tid = req.query.tid;
  const { cid, bdate, stime, etime, reason, people, special } = req.body;

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

  if (stime >= etime) {
    return res
      .status(400)
      .json({ error: "Starting time must be before ending time." });
  }
  if (stime < "06:30") {
    return res.status(400).json({
      error: "Booking cannot before 06:30 because the school close.",
    });
  }
  if (etime > "18:00") {
    return res.status(400).json({
      error:
        "Booking cannot end after 18:00 because the school closes at 6 PM.",
    });
  }

  const timeResult = await pool.query(`
      SELECT 
        CURRENT_DATE AS today,
        TO_CHAR(CURRENT_TIMESTAMP, 'HH24:MI:SS') AS now
    `);
  const today = timeResult.rows[0].today.toISOString().split("T")[0];
  const now = timeResult.rows[0].now;

  if (bdate < today) {
    return res
      .status(400)
      .json({ error: "Booking date cannot be in the past." });
  }

  const currentTimeStr = now.substring(0, 5);
  if (bdate === today && stime <= currentTimeStr) {
    return res
      .status(400)
      .json({ error: "Booking time cannot be in the past." });
  }

  const capacityResult = await pool.query(
    `SELECT capacity FROM classroom WHERE cid = $1`,
    [cidNum]
  );

  if (capacityResult.rows.length === 0) {
    return res.status(404).json({ error: "Venue not found" });
  }

  const capacity = capacityResult.rows[0].capacity;

  if (peopleNum > capacity) {
    return res.status(400).json({
      error: `The venue only can contain ${capacity} peoples, you need to change another venue.`,
    });
  }

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

  if (isNaN(bid) || !tid) {
    return res.status(400).json({ error: "Invalid Booking ID or Teacher ID" });
  }

  try {
    const result = await pool.query(
      `UPDATE booking SET cid = $1, bdate = $2, stime = $3, etime = $4, reason = $5, people = $6, special = $7
       WHERE bid = $8 AND tid = $9 RETURNING bid`,
      [cid, bdate, stime, etime, reason, people, special, bid, tid]
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Booking not found or unauthorized" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Update booking error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.get("/admin/all-bookings", async (req, res) => {
  const { cid, tid, bid, startDate, endDate } = req.query;

  try {
    let query = `
      SELECT b.bid, b.cid, b.bdate, b.stime, b.etime, 
             b.reason, b.people, b.special, b.create_at, t.tname
      FROM booking b
      JOIN teacher t ON b.tid = t.tid
      WHERE 1=1
    `;
    const params = [];

    if (cid) {
      params.push(cid);
      query += ` AND b.cid = $${params.length}`;
    }
    if (bid) {
      const bidNum = parseInt(bid, 10);
      if (isNaN(bidNum)) {
        return res.status(400).json({ error: "Invalid Booking ID" });
      }
      params.push(bidNum);
      query += ` AND b.bid = $${params.length}`;
    }
    if (tid) {
      params.push(tid);
      query += ` AND b.tid = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND b.bdate >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND b.bdate <= $${params.length}`;
    }

    query += ` ORDER BY b.bdate ASC, b.stime ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Admin all-bookings error:", err);
    res.status(500).json({ error: "Failed to fetch admin bookings" });
  }
});

app.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, message, TO_CHAR(create_at AT TIME ZONE 'Asia/Hong_Kong', 'DD/MM/YYYY, HH12:MI AM') AS create_at FROM announcements ORDER BY create_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch announcements error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

app.post("/admin/announcement", async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO announcements (message) VALUES ($1) RETURNING id",
      [message.trim()]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Add announcement error:", err);
    res.status(500).json({ error: "Add failed" });
  }
});

app.put("/admin/announcement/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { message } = req.body;
  if (isNaN(id) || !message || message.trim() === "") {
    return res.status(400).json({ error: "Invalid ID or message" });
  }

  try {
    const result = await pool.query(
      "UPDATE announcements SET message = $1 WHERE id = $2 RETURNING id",
      [message.trim(), id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Update announcement error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/admin/announcement/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM announcements WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Delete announcement error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
