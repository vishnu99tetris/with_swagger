const { pool } = require('../config/database');
const cloudinary = require('cloudinary').v2; // Import Cloudinary directly

// Upload a new post
const createPost = async (req, res) => {
  const { userId, content } = req.body;
  const image = req.files?.image;

  try {
    let imageUrl = null;

    // If there is an image, upload it to Cloudinary
    if (image) {
      const cloudinaryResponse = await cloudinary.uploader.upload(image.tempFilePath);
      imageUrl = cloudinaryResponse.secure_url;
    }

    // Save post to the database
    const result = await pool.query(
      'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING *',
      [userId, content, imageUrl]
    );

    res.status(201).json({ success: true, post: result.rows[0] });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to validate IDs
const validateId = (id) => {
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 0;
};

// Like a post
const likePost = async (req, res) => {
  const { userId } = req.body;
  const { postId } = req.params;

  if (!validateId(postId) || !validateId(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid post ID or user ID' 
    });
  }

  try {
    // Check if post exists
    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if user already liked the post
    const existingLike = await pool.query(
      'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingLike.rows.length > 0) {
      // If already liked, unlike the post
      await pool.query(
        'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );
      
      // Update like count
      await pool.query(
        'UPDATE posts SET like_count = like_count - 1 WHERE id = $1',
        [postId]
      );

      return res.status(200).json({ 
        success: true, 
        message: 'Post unliked successfully',
        action: 'unliked'
      });
    }

    // If not liked, like the post
    const result = await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) RETURNING *',
      [userId, postId]
    );

    // Update like count
    await pool.query(
      'UPDATE posts SET like_count = like_count + 1 WHERE id = $1',
      [postId]
    );

    res.status(201).json({ 
      success: true, 
      like: result.rows[0],
      action: 'liked'
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Unlike a post
const unlikePost = async (req, res) => {
  const { userId } = req.body;
  const { postId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2 RETURNING *',
      [userId, postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Like not found' });
    }

    // Update like count in posts table
    await pool.query(
      'UPDATE posts SET like_count = like_count - 1 WHERE id = $1',
      [postId]
    );

    res.status(200).json({ success: true, message: 'Post unliked successfully' });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Comment on a post
const commentOnPost = async (req, res) => {
  const { userId, content } = req.body;
  const { postId } = req.params;

  if (!validateId(postId) || !validateId(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid post ID or user ID' 
    });
  }

  if (!content || content.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Comment content cannot be empty' 
    });
  }

  try {
    // Check if post exists
    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Insert comment
    const result = await pool.query(
      `INSERT INTO comments (user_id, post_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [userId, postId, content]
    );

    // Get user information for the comment
    const userResult = await pool.query(
      `SELECT firstname, lastname, image as user_image 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    // Update comment count in posts table
    await pool.query(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );

    // Format the response
    const comment = {
      ...result.rows[0],
      user: {
        id: userId,
        fullName: `${userResult.rows[0].firstname} ${userResult.rows[0].lastname}`,
        image: userResult.rows[0].user_image
      }
    };

    res.status(201).json({ 
      success: true, 
      comment,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Error commenting on post:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const { userId } = req.body;

  if (!validateId(commentId) || !validateId(userId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid comment ID or user ID' 
    });
  }

  try {
    // Check if comment exists and belongs to the user
    const commentCheck = await pool.query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found or unauthorized to delete' 
      });
    }

    const postId = commentCheck.rows[0].post_id;

    // Delete the comment
    await pool.query(
      'DELETE FROM comments WHERE id = $1',
      [commentId]
    );

    // Update comment count in posts table
    await pool.query(
      'UPDATE posts SET comment_count = comment_count - 1 WHERE id = $1',
      [postId]
    );

    res.status(200).json({ 
      success: true, 
      message: 'Comment deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all comments for a post
const getPostComments = async (req, res) => {
  const { postId } = req.params;

  if (!validateId(postId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid post ID' 
    });
  }

  try {
    // Check if post exists
    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Get comments with user information
    const result = await pool.query(
      `SELECT c.*, 
              u.firstname, 
              u.lastname, 
              u.image as user_image 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.post_id = $1 
       ORDER BY c.created_at DESC`,
      [postId]
    );

    // Format the comments
    const comments = result.rows.map(comment => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.user_id,
        fullName: `${comment.firstname} ${comment.lastname}`,
        image: comment.user_image
      }
    }));

    res.status(200).json({ 
      success: true, 
      comments,
      totalComments: comments.length
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get detailed like information for a post
const getPostLikes = async (req, res) => {
  const { postId } = req.params;

  try {
    // Get total like count
    const likeCountResult = await pool.query(
      'SELECT COUNT(*) as like_count FROM likes WHERE post_id = $1',
      [postId]
    );

    // Get users who liked the post with their names
    const likesResult = await pool.query(
      `SELECT l.*, 
              u.firstname, 
              u.lastname, 
              u.image as user_image 
       FROM likes l 
       JOIN users u ON l.user_id = u.id 
       WHERE l.post_id = $1 
       ORDER BY l.created_at DESC`,
      [postId]
    );

    // Format the response to include full name
    const formattedLikes = likesResult.rows.map(like => ({
      ...like,
      fullName: `${like.firstname} ${like.lastname}`
    }));

    res.status(200).json({ 
      success: true, 
      likeCount: parseInt(likeCountResult.rows[0].like_count),
      likes: formattedLikes
    });
  } catch (error) {
    console.error('Error fetching like information:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPost,
  likePost,
  unlikePost,
  commentOnPost,
  deleteComment,
  getPostComments,
  getPostLikes
};
