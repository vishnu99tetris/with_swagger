const express = require('express');
const { 
  createPost, 
  likePost, 
  unlikePost, 
  commentOnPost, 
  deleteComment, 
  getPostComments, 
  getPostLikes 
} = require('../controllers/postController');

// Initialize Router
const router = express.Router();

// Post routes
router.post('/create', createPost); // Create a new post

// Like routes
router.post('/:postId/like', (req, res, next) => {
  req.params.postId = parseInt(req.params.postId);
  next();
}, likePost); // Like a post

router.delete('/:postId/like', (req, res, next) => {
  req.params.postId = parseInt(req.params.postId);
  next();
}, unlikePost); // Unlike a post

router.get('/:postId/likes', (req, res, next) => {
  req.params.postId = parseInt(req.params.postId);
  next();
}, getPostLikes); // Get like count for a post

// Comment routes
router.post('/:postId/comment', (req, res, next) => {
  req.params.postId = parseInt(req.params.postId);
  next();
}, commentOnPost); // Comment on a post

router.delete('/comment/:commentId', (req, res, next) => {
  req.params.commentId = parseInt(req.params.commentId);
  next();
}, deleteComment); // Delete a comment

router.get('/:postId/comments', (req, res, next) => {
  req.params.postId = parseInt(req.params.postId);
  next();
}, getPostComments); // Get all comments for a post

module.exports = router;
