import nodemailer from 'nodemailer';

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.mailtrap.io",
        port: process.env.SMTP_PORT || 2525,
        auth: {
            user: process.env.SMTP_USER || "test_user",
            pass: process.env.SMTP_PASS || "test_pass"
        },
        connectionTimeout: 10000 // 10 seconds timeout to prevent hanging
    });
};

export const sendVerificationEmail = async (email, code) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: '"Lumina Support" <support@lumina.com>',
            to: email,
            subject: 'Verify your Lumina Account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #f97316; text-align: center;">Welcome to Lumina!</h2>
                    <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
                        <h1 style="letter-spacing: 5px; color: #0f172a; margin: 0;">${code}</h1>
                    </div>
                    <p>This code will expire in 15 minutes.</p>
                    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Error sending verification email:", error);
        throw new Error("Could not send verification email");
    }
};

export const sendPasswordResetEmail = async (email, resetUrl) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: '"Lumina Support" <support@lumina.com>',
            to: email,
            subject: 'Reset your Lumina Password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #f97316; text-align: center;">Password Reset Request</h2>
                    <p>We received a request to reset the password for your Lumina account.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #f97316; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">If you didn't request a password reset, you can safely ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Error sending password reset email:", error);
        throw new Error("Could not send password reset email");
    }
};
