const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;
const multer = require('multer');
const fs = require('fs');

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studentlog.html'));
});

app.get('/students', (req, res) => {
  db.query('SELECT * FROM student_details', (err, results) => {
    if (err) return res.status(500).send('Database error');
    res.json(results);
  });
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminlog.html'));
});

app.post('/log-student-login', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send('Email is required');

  db.query('INSERT INTO users (email) VALUES (?)', [email], (err) => {
    if (err) return res.status(500).send('Database error');
    res.send('Student login recorded');
  });
});

app.post('/log-admin-login', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send('Email is required');

  db.query('INSERT INTO users (email) VALUES (?)', [email], (err) => {
    if (err) return res.status(500).send('Database error');
    res.send('Admin login recorded');
  });
});


const uploadDir = path.join(__dirname, 'uploads');

// Ensure the uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ New route to store Firebase user in MySQL
app.post('/api/register-user', (req, res) => {
  console.log("📥 Received user data from frontend:", req.body);

  const { uid, name, email, role } = req.body;
  if (!uid || !name || !email || !role) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const sql = 'INSERT INTO users (firebase_uid, name, email, role) VALUES (?, ?, ?, ?)';
  db.query(sql, [uid, name, email, role], (err) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    console.log("✅ User inserted into MySQL");
    res.json({ success: true, message: 'User added to MySQL' });
  });
});

// ✅ New endpoint to get role by email
app.post('/api/get-role', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const sql = 'SELECT role FROM users WHERE email = ? LIMIT 1';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, role: results[0].role });
  });
});

app.post('/api/student-info', (req, res) => {
  const {
    name, email, phone,
    hs_math, hs_science, hs_english, hs_hindi,
    phy, chem, math12, branch_pref_1, branch_pref_2
  } = req.body;

  if (!name || !email || !hs_math || !phy) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const total_10 = parseInt(hs_math) + parseInt(hs_science) + parseInt(hs_english) + parseInt(hs_hindi);
  const total_12 = parseInt(phy) + parseInt(chem) + parseInt(math12);

  const sql = `INSERT INTO student_details 
    (name, email, phone, hs_math, hs_science, hs_english, hs_hindi,
     phy, chem, math12, total_10, total_12,branch_pref_1, branch_pref_2)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`;

  db.query(sql, [name, email, phone, hs_math, hs_science, hs_english, hs_hindi,
    phy, chem, math12, total_10, total_12,branch_pref_1, branch_pref_2], (err) => {
      if (err) {
        console.error("DB error:", err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true });
  });
});

// Route: GET all student details
app.get('/api/students', (req, res) => {
  const sql = 'SELECT * FROM student_details';
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching students:", err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    console.log("🎓 Students loaded:", results);
    res.json(results); // send array of students as response
  });
});


app.post('/api/allocate-branch', (req, res) => {
  const { id, branch } = req.body;

  if (!id || !branch) {
    return res.status(400).json({ success: false, message: 'Missing student ID or branch' });
  }

  const sql = 'UPDATE student_details SET allocated_branch = ? WHERE id = ?';

  db.query(sql, [branch, id], (err) => {
    if (err) {
      console.error("❌ Allocation error:", err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true });
  });
});

// ✅ Endpoint: Get allocation by student email
app.post('/api/check-allocation', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const sql = 'SELECT name, allocated_branch FROM student_details WHERE email = ? LIMIT 1';

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('❌ Database error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = results[0];
    res.json({
      success: true,
      name: student.name,
      allocated_branch: student.allocated_branch || null
    });
  });
});

app.post('/api/check-marks-submitted', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ submitted: false, message: "Email is required" });
  }

  const sql = `
    SELECT phy, chem, math12, branch_pref_1, branch_pref_2 
    FROM student_details 
    WHERE email = ?
  `;

  db.query(sql, [email], (err, results) => { 
    if (err) {
      console.error("❌ Database error:", err);
      return res.status(500).json({ submitted: false });
    }

    if (results.length === 0) {
      // No student found with that email
      return res.json({ submitted: false });
    }

    const student = results[0];

    // Check if all required fields are not null or empty
    const submitted = (
      student.phy !== null &&
      student.chem !== null &&
      student.math12 !== null &&
      student.branch_pref_1 !== null &&
      student.branch_pref_2 !== null
    );

    res.json({ submitted });
  });
});

// ✅ Receipt upload route
app.post('/api/upload-receipt', upload.single('receipt'), (req, res) => {
  const email = req.body.email;
  const file = req.file;

  if (!email || !file) {
    return res.status(400).json({ success: false, message: 'Email or file missing' });
  }

  console.log(`📥 Receipt uploaded by ${email}: ${file.filename}`);

  return res.json({ success: true, message: 'Receipt uploaded successfully' });
});



// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});



