const emailTemplate = (otp) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Verify Your Email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #3897f0;
            color: #fff;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            padding: 20px;
        }
        .otp-container {
            text-align: center;
            margin: 30px 0;
        }
        .otp {
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #3897f0;
            padding: 15px;
            background-color: #f8f8f8;
            border-radius: 5px;
            display: inline-block;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            color: #777;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verify Your Email Address</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Thank you for registering with our Social Media App! To complete your registration, please use the following verification code:</p>
            
            <div class="otp-container">
                <div class="otp">${otp}</div>
            </div>
            
            <p>This code will expire in 5 minutes.</p>
            
            <p>If you didn't request this code, you can safely ignore this email.</p>
            
            <p>Best regards,<br>The Social Media Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2023 Social Media App. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>`;
};

module.exports = emailTemplate; 