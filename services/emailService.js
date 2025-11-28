const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});


exports.sendMemberCredentials = async (email, credentials) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to SRS Events - Your Member Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Welcome to SRS Events!</h2>
        <p>Dear ${credentials.firstName},</p>
        <p>Your member account has been created successfully. Here are your login credentials:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${credentials.email}</p>
          <p><strong>Password:</strong> ${credentials.password}</p>
        </div>
        
        <p>Please login using the link below and change your password immediately:</p>
        <a href="${credentials.loginUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
        
        <p style="margin-top: 30px;">As a member, you enjoy exclusive benefits including:</p>
        <ul>
          <li>Discounted event prices</li>
          <li>Priority booking</li>
          <li>Loyalty points on every booking</li>
          <li>Access to member-only events</li>
        </ul>
        
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>SRS Events Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};


exports.sendBookingConfirmation = async (booking) => {
  await booking.populate(['event', 'user']);
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: booking.user.email,
    subject: `Booking Confirmed - ${booking.event.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Booking Confirmed!</h2>
        <p>Dear ${booking.user.firstName},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${booking.event.title}</h3>
          <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
          <p><strong>Date:</strong> ${new Date(booking.event.startDate).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${booking.event.location}</p>
          <p><strong>Seats:</strong> ${booking.seatCount}</p>
          <p><strong>Total Amount:</strong> ₹${booking.totalAmount}</p>
        </div>
        
        <p>Please save this email and present your QR code at the event venue.</p>
        <p>You can view your ticket and QR code by logging into your account.</p>
        
        <p>Thank you for choosing SRS Events!</p>
        <p>Best regards,<br>SRS Events Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};


exports.sendPasswordResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset - SRS Events',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Password Reset Request</h2>
        <p>You requested a password reset for your SRS Events account.</p>
        <p>Click the link below to reset your password:</p>
        
        <a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        
        <p style="margin-top: 20px;">This link will expire in 10 minutes.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        
        <p>Best regards,<br>SRS Events Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};