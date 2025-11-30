const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: "rzp_test_RluprVlNeV6oUv",
  key_secret: "Rxh1yNWMlukR8DSuahNTbDBK"
});


exports.createOrder = async (amount, bookingId) => {
  const options = {
    amount: amount * 100, 
    currency: 'INR',
    receipt: bookingId,
    payment_capture: 1
  };

  const order = await razorpay.orders.create(options);
  return order;
};


exports.verifyPayment = (orderId, paymentId, signature) => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', "Rxh1yNWMlukR8DSuahNTbDBK")
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
};


exports.createRefund = async (paymentId, amount) => {
  const options = {
    payment_id: paymentId,
    amount: amount * 100 
  };

  const refund = await razorpay.payments.refund(paymentId, options);
  return refund;
};