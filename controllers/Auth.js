const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();
const otpGenerator = require("otp-generator");
const { query, saveAndSendOTP } = require("../config/database");
const { pool } = require("../config/database");

exports.signup = async (req, res) => {
  // Get a client from the pool
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    const {
      firstname,
      lastname,
      email,
      password,
      confirmPassword,
      accountType,
      otp
    } = req.body;
    
    if (!firstname || !lastname || !email || !password || !confirmPassword || !otp) {
      return res.status(403).send({
        success: false,
        message: "All Fields are required",
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and Confirm Password do not match. Please try again.",
      });
    }

    // Check if user already exists
    const checkExistingUser = await client.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    
    if (checkExistingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists. Please Login to continue.",
      });
    }

    // Verify OTP
    const otpResponse = await client.query(
      'SELECT * FROM otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email]
    );
    
    if (otpResponse.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The OTP is not valid",
      });
    } else if (otp !== otpResponse.rows[0].otp) {
      return res.status(400).json({
        success: false,
        message: "The OTP is not valid",
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Set approval status
    let approved = accountType === "TEACHER" ? false : true;

    // Create profile first
    const profileResult = await client.query(
      `INSERT INTO profiles (gender, date_of_birth, about, contact_number)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [null, null, null, null]
    );

    const profileId = profileResult.rows[0].id;
    
    // Generate profile image
    const image = `https://api.dicebear.com/5.x/initials/svg?seed=${firstname} ${lastname}`;
    
    // Create user
    const userResult = await client.query(
      `INSERT INTO users (firstname, lastname, email, password, account_type, approved, profile_id, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [firstname, lastname, email, hashedPassword, accountType, approved, profileId, image]
    );

    const user = userResult.rows[0];
    
    // Commit transaction
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      user,
      message: "User registered successfully",
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    console.error(error);
    
    // More specific error handling
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: "Email already exists. Please use a different email.",
      });
    }
    
    if (error.code === '23503') {
      return res.status(500).json({
        success: false,
        message: "Database relationship error. Please contact administrator.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "User cannot be registered. Please try again.",
      error: error.message
    });
  } finally {
    // Release client back to the pool
    client.release();
  }
};
exports.sendotp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user already exists in PostgreSQL
    const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (userCheck.rows.length > 0) {
      return res.status(401).json({
        success: false,
        message: `User is already registered`,
      });
    }

    // Generate a unique OTP
    let otp;
    let isUnique = false;

    while (!isUnique) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      const otpCheck = await query('SELECT * FROM otps WHERE otp = $1', [otp]);

      if (otpCheck.rows.length === 0) {
        isUnique = true;
      }
    }

    // Save OTP to DB and send email
    const result = await saveAndSendOTP(email, otp);

    if (!result.success) {
      throw new Error(result.message);
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otp, // Remove this in production
    });
  } catch (error) {
    console.error("Error sending OTP:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};
exports.login = async (req, res) => {
  console.log('Login request received:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const client = await pool.connect();
  try {
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ success: false, message: "Incorrect credentials" });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password match:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Incorrect credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '2d' });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: "An error occurred during login", error: error.message });
  } finally {
    client.release();
  }
};

// ================= Forgot Password =================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const client = await pool.connect();
  try {
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const resetLink = `http://localhost:5000/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `<h3>Password Reset Request</h3><p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 15 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: "Password reset link sent to email" });
  } catch (error) {
    console.error('Forgot Password error:', error);
    return res.status(500).json({ success: false, message: "Error sending reset email" });
  } finally {
    client.release();
  }
};

// ================= Reset Password =================
exports.resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const client = await pool.connect();
    await client.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2',
      [hashedPassword, email]
    );

    client.release();

    return res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error('Reset Password error:', error);
    return res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
};
  