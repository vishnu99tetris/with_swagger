const { Pool } = require('pg');
require('dotenv').config();
const nodemailer = require('nodemailer');
const emailTemplate = require('../mail/templates/emailVerificationTemplate');

// Create a connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

// Mail sender function
const mailSender = async (email, title, body) => {
  try {
    // Create a transporter
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.gmail.com",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      }
    });

    // Send mail
    let info = await transporter.sendMail({
      from: `"Social Media" <${process.env.MAIL_USER}>`,
      to: email,
      subject: title,
      html: body,
    });

    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

async function sendVerificationEmail(email, otp) {
  try {
    const mailResponse = await mailSender(
      email,
      "Verification Email",
      emailTemplate(otp)
    );
    console.log("Email sent successfully: ", mailResponse.response);
  } catch (error) {
    console.log("Error occurred while sending email: ", error);
    throw error;
  }
}

// Function to initialize database tables if they don't exist
const initDatabase = async () => {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Create profiles table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        gender VARCHAR(10),
        date_of_birth DATE,
        about TEXT,
        contact_number VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firstname VARCHAR(100) NOT NULL,
        lastname VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        account_type VARCHAR(20) NOT NULL,
        approved BOOLEAN DEFAULT TRUE,
        profile_id INTEGER REFERENCES profiles(id),
        image TEXT,
        bio TEXT DEFAULT '',
        website TEXT DEFAULT '',
        active BOOLEAN DEFAULT TRUE,
        account_privacy VARCHAR(20) DEFAULT 'public',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create posts table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create likes table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create comments table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error initializing database tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

const migrateDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add like_count and comment_count columns if they don't exist
    await client.query(`
      DO $$ 
      BEGIN
        BEGIN
          ALTER TABLE posts ADD COLUMN like_count INTEGER DEFAULT 0;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
      END $$;
    `);

    // Update existing posts with actual like and comment counts
    await client.query(`
      UPDATE posts p
      SET 
        like_count = (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id),
        comment_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
    `);

    await client.query('COMMIT');
    console.log('Database migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database migration:', error);
    throw error;
  } finally {
    client.release();
  }
};

const saveAndSendOTP = async (email, otp) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO otps (email, otp) VALUES ($1, $2)`,
      [email, otp]
    );

    await sendVerificationEmail(email, otp);

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving OTP:', error);
    return { success: false, message: error.message };
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initDatabase,
  migrateDatabase,
  query: (text, params) => pool.query(text, params),
  saveAndSendOTP,
  sendVerificationEmail
};
