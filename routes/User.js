const express = require("express")
const router = express.Router()

const {
  signup,
  sendotp,
  login,
  forgotPassword,
  resetPassword,
} = require("../controllers/Auth")


router.post("/signup", signup)
router.post("/sendotp",sendotp)
router.post("/login", login);

router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);
module.exports = router
