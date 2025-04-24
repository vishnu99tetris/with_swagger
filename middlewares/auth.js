const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();
exports.auth = async (req, res, next) => {
	try {
		const authHeader = req.header("Authorization");
		console.log("Token is running");
		const token =
		req.cookies?.token ||
		req.body?.token ||
		(authHeader && authHeader.startsWith("Bearer ")
		  ? authHeader.replace("Bearer ", "")
		  : null);
  
	  console.log("Extracted Token:", token); // ✅ Should show token in terminal
  
	  if (!token) {
		return res.status(401).json({ success: false, message: "Token Missing" });
	  }
  
	  try {
		const decode = await jwt.verify(token, process.env.JWT_SECRET);
		req.user = decode;
	  } catch (error) {
		return res.status(401).json({ success: false, message: "Token is invalid" });
	  }
  
	  next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			message: `Something Went Wrong While Validating the Token`,
		});
	}
};