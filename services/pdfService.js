

const QRCode = require('qrcode');

exports.generateTicket = async (booking) => {
  
  
  const ticketContent = `
    SRS EVENTS - EVENT TICKET
    
    Booking ID: ${booking.bookingId}
    Event: ${booking.event.title}
    Date: ${new Date(booking.event.startDate).toLocaleDateString()}
    Time: ${new Date(booking.event.startDate).toLocaleTimeString()}
    Location: ${booking.event.location}
    Seats: ${booking.seatCount}
    Amount Paid: ₹${booking.totalAmount}
    
    Customer Details:
    Name: ${booking.user.firstName} ${booking.user.lastName}
    Email: ${booking.user.email}
    Phone: ${booking.user.phone}
    
    QR Code: ${booking.qrCode}
    
    Please present this ticket at the event venue.
    For support, contact: support@srsevents.com
  `;
  
  return Buffer.from(ticketContent, 'utf8');
};