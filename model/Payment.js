const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    order_id: { type: String, required: true },
    payment_id: { type: String, required: true },
    signature: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, default: "Success" },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", PaymentSchema);
