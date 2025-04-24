const { pool } = require("../config/database"); // import your pg pool
const { uploadImageToCloudinary } = require("../utils/imageUploader");

exports.updateProfile = async (req, res) => {
  try {
    const {
      firstname = "",
      lastname = "",
      dateOfBirth = "",
      about = "",
      contactNumber = "",
      gender = "",
    } = req.body;
    const id = req.user.id;

    // Update basic user info
    await pool.query(
      `UPDATE users SET firstname = $1, lastname = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [firstname, lastname, id]
    );

    // Get profile ID
    const userResult = await pool.query(`SELECT profile_id FROM users WHERE id = $1`, [id]);
    const profileId = userResult.rows[0].profile_id;

    // Update profile info
    await pool.query(
      `UPDATE profiles SET date_of_birth = $1, about = $2, contact_number = $3, gender = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
      [dateOfBirth, about, contactNumber, gender, profileId]
    );

    // Get updated user with profile
    const updatedResult = await pool.query(`
      SELECT u.*, p.gender, p.date_of_birth, p.about, p.contact_number
      FROM users u
      JOIN profiles p ON u.profile_id = p.id
      WHERE u.id = $1
    `, [id]);

    return res.json({
      success: true,
      message: "Profile updated successfully",
      updatedUserDetails: updatedResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


exports.deleteAccount = async (req, res) => {
    try {
      const id = req.user.id;
  
      const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
  
      // First delete the user (CASCADE will delete profile if FK is set properly)
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  
      return res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
  

  exports.updateDisplayPicture = async (req, res) => {
    try {
      const displayPicture = req.files.displayPicture;
      const userId = req.user.id;
      console.log(userId);
  
      const image = await uploadImageToCloudinary(
        displayPicture,
        process.env.FOLDER_NAME,
        1000,
        1000
      );
  
      await pool.query(
        `UPDATE users SET image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [image.secure_url, userId]
      );
  
      const updatedUser = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  
      res.send({
        success: true,
        message: `Image Updated successfully`,
        data: updatedUser.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
