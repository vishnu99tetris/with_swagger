const express = require('express');
const userRoutes = require("./routes/User");
const profileRoutes = require("./routes/Profile");
const postRoutes = require("./routes/post"); // Import post routes (lowercase)
const database = require('./config/database');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require('dotenv');
const { cloudinaryConnect } = require("./config/cloudinary");
const fileUpload = require("express-fileupload");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp",
  })
);
cloudinaryConnect(); // Connect to Cloudinary

// Initialize database and run migrations
database
  .initDatabase()
  .then(() => {
    console.log('Database initialized successfully');
    return database.migrateDatabase();
  })
  .then(() => {
    console.log('Database migration completed successfully');
  })
  .catch((err) => {
    console.error('Error initializing database:', err);
    process.exit(1);
  });

// Routes
app.use("/api/v1", userRoutes);
app.use("/api/v1/profiles", profileRoutes);
app.use("/api/v1/posts", postRoutes); // Add post routes mounting

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
